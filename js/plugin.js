/*
 * Clipboard Watcher — plugin.js
 *
 * M2 / M2.1 / M2.2 范围：配置 schema + localStorage 持久化 + 文件夹拉取
 *                       + 生命周期钩子 + 立即截图按钮（macOS screencapture -ic → 剪贴板）
 * M3 起追加：剪贴板轮询、按 folderId 维度 hash 去重、addFromPath 导入
 *
 * M3 实装时必读（K12 / PRD §8.6）：
 *   - macOS 14+ (Sonoma) 读剪贴板内容会触发"已粘贴自 Eagle"系统横幅
 *   - 必须先 clipboard.availableFormats() 过滤格式，仅在含 image/* 时才 readImage()
 *   - 上一帧 formats 不变时直接跳过本轮（额外节流），降低横幅触发频率
 *   - hash 比对放在 readImage 之后，相同 hash 直接退出
 */

const os = require('os')
const { execFile } = require('child_process')

const CONFIG_KEY = 'clipboardWatcher'
const CONFIG_VERSION = 1
const ALLOWED_DUPLICATE_STRATEGIES = ['skip', 'allow']

function getHostname() {
  try {
    const h = os.hostname()
    return typeof h === 'string' && h ? h : ''
  } catch {
    return ''
  }
}

function defaultTags() {
  const host = getHostname()
  return host ? `clipboard-watcher,${host}` : 'clipboard-watcher'
}

function buildDefaults() {
  return {
    version: CONFIG_VERSION,
    enabled: false,
    folderId: null,
    intervalMs: 1000,
    tags: defaultTags(),
    notifyOnImport: true,
    duplicateStrategy: 'skip',
  }
}

function normalizeConfig(raw) {
  const defaults = buildDefaults()
  const merged = Object.assign({}, defaults, raw && typeof raw === 'object' ? raw : {})
  merged.version = CONFIG_VERSION
  if (typeof merged.enabled !== 'boolean') merged.enabled = false
  if (typeof merged.folderId !== 'string' || !merged.folderId) merged.folderId = null
  const interval = Number(merged.intervalMs)
  merged.intervalMs = Number.isFinite(interval) ? Math.min(5000, Math.max(500, interval)) : 1000
  if (typeof merged.tags !== 'string') merged.tags = defaults.tags
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

const state = {
  config: buildDefaults(),
  folders: [],
  folderIndex: new Map(),
  todayCount: 0,
  todayDate: null,
  lastImport: null,
  lastError: null,
  runtimeStatus: 'idle', // 'idle' | 'running' | 'error'
  theme: 'LIGHT',
}

function rolloverTodayIfNeeded() {
  const today = new Date().toISOString().slice(0, 10)
  if (state.todayDate !== today) {
    state.todayDate = today
    state.todayCount = 0
  }
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    state.config = normalizeConfig(raw ? JSON.parse(raw) : {})
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] load config failed: ${err && err.message ? err.message : err}`)
    state.config = buildDefaults()
    state.lastError = 'CONFIG_LOAD_FAILED'
  }
  return state.config
}

function saveConfig(patch) {
  state.config = normalizeConfig(Object.assign({}, state.config, patch))
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config))
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
    if (state.lastError === 'FOLDER_FETCH_FAILED') state.lastError = null
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] refreshFolders failed: ${err && err.message ? err.message : err}`)
    state.folders = []
    state.folderIndex = new Map()
    state.lastError = 'FOLDER_FETCH_FAILED'
  }
  return state.folders
}

async function refreshTheme() {
  try {
    state.theme = await eagle.app.theme
  } catch {
    state.theme = 'LIGHT'
  }
  return state.theme
}

function isDarkTheme() {
  return /DARK|GRAY|BLUE|PURPLE/i.test(String(state.theme || ''))
}

function setRuntimeStatus(status, errorCode = null) {
  state.runtimeStatus = status
  if (status === 'error') {
    state.lastError = errorCode || state.lastError || 'UNKNOWN'
  } else if (status === 'running') {
    state.lastError = null
  }
}

function enableWatcher() {
  // M3 实装实际监听；M2 仅做状态切换
  if (!state.config.folderId) {
    state.lastError = 'NO_FOLDER_SELECTED'
    setRuntimeStatus('error', state.lastError)
    return false
  }
  saveConfig({ enabled: true })
  setRuntimeStatus('running')
  eagle.log.info('[clipboard-watcher] enabled (M2.1 skeleton — polling lands in M3)')
  return true
}

function disableWatcher() {
  saveConfig({ enabled: false })
  setRuntimeStatus('idle')
  eagle.log.info('[clipboard-watcher] disabled')
}

function selectFolder(folderId) {
  saveConfig({ folderId: folderId || null })
  if (!folderId && state.config.enabled) {
    disableWatcher()
  }
}

/**
 * 触发系统截图 → 直接进剪贴板
 * macOS: screencapture -ic = interactive selection → clipboard
 * Windows: 提示用户使用 Win+Shift+S（系统截图工具默认进剪贴板）
 * 截图后由剪贴板轮询（M3 实装）自动捕获并导入。
 */
function triggerScreenshot() {
  const platform = os.platform()
  if (platform !== 'darwin') {
    state.lastError = 'SCREENSHOT_UNSUPPORTED'
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    execFile('screencapture', ['-ic'], (err) => {
      if (err) {
        eagle.log.error(`[clipboard-watcher] screencapture failed: ${err.message}`)
        state.lastError = 'SCREENSHOT_FAILED'
        resolve(false)
        return
      }
      eagle.log.info('[clipboard-watcher] screencapture done; awaiting clipboard pickup')
      resolve(true)
    })
  })
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
    theme: state.theme,
    isDark: isDarkTheme(),
    platform: os.platform(),
    defaults: buildDefaults(),
  }
}

window.ClipboardWatcher = {
  CONFIG_KEY,
  ALLOWED_DUPLICATE_STRATEGIES,
  state,
  loadConfig,
  saveConfig,
  refreshFolders,
  refreshTheme,
  flattenFolders,
  parseTags,
  enableWatcher,
  disableWatcher,
  selectFolder,
  triggerScreenshot,
  setRuntimeStatus,
  getSnapshot,
  buildDefaults,
}

eagle.onPluginCreate(async () => {
  eagle.log.info('[clipboard-watcher] onPluginCreate')
  rolloverTodayIfNeeded()
  loadConfig()
  await refreshTheme()
  await refreshFolders()

  if (state.config.enabled && state.config.folderId) {
    setRuntimeStatus('running')
  } else if (state.config.enabled && !state.config.folderId) {
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
  await refreshTheme()
  await refreshFolders()
  if (window.ClipboardWatcherUI && typeof window.ClipboardWatcherUI.render === 'function') {
    window.ClipboardWatcherUI.render()
  }
})

if (typeof eagle.onThemeChanged === 'function') {
  eagle.onThemeChanged((theme) => {
    state.theme = theme
    if (window.ClipboardWatcherUI && typeof window.ClipboardWatcherUI.render === 'function') {
      window.ClipboardWatcherUI.render()
    }
  })
}
