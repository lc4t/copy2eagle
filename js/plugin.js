/*
 * Clipboard Watcher — plugin.js
 *
 * M2 范围：配置 schema + eagle.extraData 读写 + 文件夹拉取 + 生命周期钩子
 * M3 起追加：剪贴板轮询、hash 去重、addFromPath 导入
 * M4 起追加：截图目录监听
 */

const os = require('os')
const path = require('path')
const { execSync } = require('child_process')

const CONFIG_KEY = 'clipboardWatcher'
const CONFIG_VERSION = 1

const DEFAULT_CONFIG = Object.freeze({
  version: CONFIG_VERSION,
  enabled: false,
  folderId: null,
  intervalMs: 1000,
  tags: 'clipboard-watcher',
  screenshotDir: '',
  notifyOnImport: true,
  duplicateStrategy: 'skip',
})

const ALLOWED_DUPLICATE_STRATEGIES = ['skip', 'allow']

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
}

function normalizeConfig(raw) {
  const merged = Object.assign(cloneDefaults(), raw && typeof raw === 'object' ? raw : {})
  merged.version = CONFIG_VERSION
  if (typeof merged.enabled !== 'boolean') merged.enabled = false
  if (typeof merged.folderId !== 'string' || !merged.folderId) merged.folderId = null
  const interval = Number(merged.intervalMs)
  merged.intervalMs = Number.isFinite(interval) ? Math.min(5000, Math.max(500, interval)) : 1000
  if (typeof merged.tags !== 'string') merged.tags = DEFAULT_CONFIG.tags
  if (typeof merged.screenshotDir !== 'string') merged.screenshotDir = ''
  if (typeof merged.notifyOnImport !== 'boolean') merged.notifyOnImport = true
  if (!ALLOWED_DUPLICATE_STRATEGIES.includes(merged.duplicateStrategy)) {
    merged.duplicateStrategy = 'skip'
  }
  return merged
}

function parseTags(input) {
  if (typeof input !== 'string') return []
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

function detectScreenshotDir() {
  if (os.platform() !== 'darwin') return null
  try {
    const out = execSync('defaults read com.apple.screencapture location 2>/dev/null')
      .toString()
      .trim()
    if (out) return out
  } catch {
    // fall through to default
  }
  return path.join(os.homedir(), 'Desktop')
}

const state = {
  config: cloneDefaults(),
  folders: [],
  folderIndex: new Map(),
  todayCount: 0,
  todayDate: null,
  lastImport: null,
  lastError: null,
  runtimeStatus: 'idle', // 'idle' | 'running' | 'error'
}

function rolloverTodayIfNeeded() {
  const today = new Date().toISOString().slice(0, 10)
  if (state.todayDate !== today) {
    state.todayDate = today
    state.todayCount = 0
  }
}

async function loadConfig() {
  try {
    const raw = await eagle.extraData.get(CONFIG_KEY)
    state.config = normalizeConfig(raw)
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] load config failed: ${err && err.message ? err.message : err}`)
    state.config = cloneDefaults()
    state.lastError = 'CONFIG_LOAD_FAILED'
  }
  return state.config
}

async function saveConfig(patch) {
  state.config = normalizeConfig(Object.assign({}, state.config, patch))
  try {
    await eagle.extraData.set(CONFIG_KEY, state.config)
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] save config failed: ${err && err.message ? err.message : err}`)
    state.lastError = 'CONFIG_SAVE_FAILED'
    throw err
  }
  return state.config
}

function flattenFolders(folders, parentPath = '') {
  const list = []
  if (!Array.isArray(folders)) return list
  for (const f of folders) {
    if (!f || typeof f.id !== 'string') continue
    const label = parentPath ? `${parentPath} / ${f.name}` : f.name
    list.push({ id: f.id, label })
    if (Array.isArray(f.children) && f.children.length) {
      list.push(...flattenFolders(f.children, label))
    }
  }
  return list
}

async function refreshFolders() {
  try {
    const raw = await eagle.folder.getAll()
    state.folders = flattenFolders(raw)
    state.folderIndex = new Map(state.folders.map((f) => [f.id, f.label]))
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] refreshFolders failed: ${err && err.message ? err.message : err}`)
    state.folders = []
    state.folderIndex = new Map()
    state.lastError = 'FOLDER_FETCH_FAILED'
  }
  return state.folders
}

function setRuntimeStatus(status, errorCode = null) {
  state.runtimeStatus = status
  if (status === 'error') {
    state.lastError = errorCode || state.lastError || 'UNKNOWN'
  } else if (status === 'running') {
    state.lastError = null
  }
}

async function enableWatcher() {
  // M3 实装监听；M2 仅做状态切换
  if (!state.config.folderId) {
    state.lastError = 'NO_FOLDER_SELECTED'
    setRuntimeStatus('error', state.lastError)
    return false
  }
  await saveConfig({ enabled: true })
  setRuntimeStatus('running')
  eagle.log.info('[clipboard-watcher] enabled (M2 skeleton — actual polling lands in M3)')
  return true
}

async function disableWatcher() {
  await saveConfig({ enabled: false })
  setRuntimeStatus('idle')
  eagle.log.info('[clipboard-watcher] disabled')
}

async function selectFolder(folderId) {
  await saveConfig({ folderId: folderId || null })
  if (!folderId && state.config.enabled) {
    await disableWatcher()
  }
}

function getSnapshot() {
  rolloverTodayIfNeeded()
  return {
    config: state.config,
    folders: state.folders,
    folderLabel: state.config.folderId ? state.folderIndex.get(state.config.folderId) || null : null,
    todayCount: state.todayCount,
    lastImport: state.lastImport,
    lastError: state.lastError,
    runtimeStatus: state.runtimeStatus,
    detectedScreenshotDir: detectScreenshotDir(),
    defaults: cloneDefaults(),
  }
}

window.ClipboardWatcher = {
  CONFIG_KEY,
  DEFAULT_CONFIG,
  ALLOWED_DUPLICATE_STRATEGIES,
  state,
  loadConfig,
  saveConfig,
  refreshFolders,
  flattenFolders,
  detectScreenshotDir,
  parseTags,
  enableWatcher,
  disableWatcher,
  selectFolder,
  setRuntimeStatus,
  getSnapshot,
}

eagle.onPluginCreate(async () => {
  eagle.log.info('[clipboard-watcher] onPluginCreate')
  rolloverTodayIfNeeded()
  await loadConfig()
  await refreshFolders()

  if (state.config.enabled && state.config.folderId) {
    // M2：仅恢复 UI 状态；M3 才真正启动轮询
    setRuntimeStatus('running')
  } else if (state.config.enabled && !state.config.folderId) {
    // 配置异常：曾经 enabled 但 folder 丢失
    state.config.enabled = false
    setRuntimeStatus('idle')
  } else {
    setRuntimeStatus('idle')
  }

  if (window.ClipboardWatcherUI && typeof window.ClipboardWatcherUI.render === 'function') {
    window.ClipboardWatcherUI.render()
  }
})

eagle.onPluginShow(async () => {
  eagle.log.info('[clipboard-watcher] onPluginShow')
  rolloverTodayIfNeeded()
  await refreshFolders()
  if (window.ClipboardWatcherUI && typeof window.ClipboardWatcherUI.render === 'function') {
    window.ClipboardWatcherUI.render()
  }
})
