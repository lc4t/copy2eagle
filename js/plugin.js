/*
 * Clipboard Watcher — plugin.js
 *
 * M2 / M2.1 / M2.2 / M3 / M3.1 范围：
 *   - 配置 schema + localStorage 持久化
 *   - 文件夹拉取（含二级路径）
 *   - 生命周期钩子
 *   - 立即截图按钮（macOS screencapture -ic → 剪贴板）
 *   - 剪贴板轮询（先 eagle.clipboard.has 多 format 探测，再 readImage）
 *   - 按 folderId 维度的 hash 去重 + 启动期回填
 *   - duplicateStrategy 分支（skip 短路 / allow 30s 防抖）
 *   - 临时文件 + addFromPath + 失败清理
 *   - 错误兜底 + 5s 自动重试
 *
 * M3.1 API 修正（K7/K12/K13）：
 *   - PRD §3.4 写的 require('electron').clipboard 在 Eagle 插件 webview 不可用
 *     → 改用 eagle.clipboard
 *   - eagle.clipboard 仅有 has(format) / readImage()，没有 availableFormats()
 *     → 改用对多个图片 format 字符串依次 has() 探测
 *   - 没有 NSPasteboard.changeCount 透出，"image format 已存在"不等于"图片已变"
 *     → 仍需每轮 readImage + hash 比对（相同 hash 不重复导入）
 *
 * macOS 14+ 横幅现实（K12 修订）：
 *   - has() 不读 buffer，业界默认不触发横幅
 *   - readImage() 读 buffer，每次调用可能触发一次横幅
 *   - 剪贴板里始终有图片时，1Hz 轮询会按周期触发横幅；推荐用户调大间隔
 *   - M4 候选项：adaptive polling（同 hash 持续 N 轮则放慢）
 */

const os = require('os')
const fs = require('fs')
const path = require('path')
const { execFile } = require('child_process')

// 图片 format 候选（先试 Electron MIME 风格，再试 macOS UTI）
const IMAGE_FORMAT_CANDIDATES = [
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/bmp',
  'image/gif',
  'public.png',
  'public.tiff',
  'public.jpeg',
  'public.image',
]

const CONFIG_KEY = 'clipboardWatcher'
const CONFIG_VERSION = 1
const ALLOWED_DUPLICATE_STRATEGIES = ['skip', 'allow']
const ALLOW_DEDUP_WINDOW_MS = 30000
const POLL_RETRY_MS = 5000
const POLL_ERROR_THRESHOLD = 3
const BACKFILL_YIELD_EVERY = 20
const TMP_DIR_NAME = 'eagle-cw'

function pad(n) {
  return String(n).padStart(2, '0')
}

function nowStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function tmpFileStamp(d = new Date()) {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

function computeHash(buffer) {
  if (!buffer || typeof buffer.length !== 'number') return null
  const len = buffer.length
  const prefix = buffer.slice(0, 256).toString('base64').slice(0, 32)
  return `${len}_${prefix}`
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

  // M3 additions
  hashSetByFolder: new Map(),
  lastClipboardHash: null,
  lastClipboardAt: 0,
  lastFormatsKey: null,
  indexingFolderId: null,
  indexingProgress: 0,
  indexingTotal: 0,
  pollErrorCount: 0,
}

let pollTimer = null
let pollInFlight = false
let lastNotificationAt = 0
const NOTIFICATION_MIN_GAP_MS = 1500

function scheduleRender() {
  if (window.ClipboardWatcherUI && typeof window.ClipboardWatcherUI.render === 'function') {
    window.ClipboardWatcherUI.render()
  }
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

// ---------------------------------------------------------------------------
// Backfill：把目标文件夹现有 item 的 hash 拉进 hashSetByFolder
// ---------------------------------------------------------------------------

async function backfillFolder(folderId) {
  if (!folderId) return
  if (state.indexingFolderId === folderId) return // 已在跑

  state.indexingFolderId = folderId
  state.indexingProgress = 0
  state.indexingTotal = 0
  const set = state.hashSetByFolder.get(folderId) || new Set()
  state.hashSetByFolder.set(folderId, set)
  scheduleRender()

  try {
    const items = await eagle.item.get({ folders: [folderId] })
    state.indexingTotal = Array.isArray(items) ? items.length : 0
    scheduleRender()

    for (let i = 0; i < state.indexingTotal; i++) {
      // 用户中途换走当前文件夹 / 关插件，提前终止
      if (state.indexingFolderId !== folderId) break

      const item = items[i]
      try {
        if (item && typeof item.filePath === 'string' && fs.existsSync(item.filePath)) {
          const buffer = fs.readFileSync(item.filePath)
          const hash = computeHash(buffer)
          if (hash) set.add(hash)
        }
      } catch (err) {
        eagle.log.warn(
          `[clipboard-watcher] backfill skip ${item && item.id}: ${err && err.message ? err.message : err}`
        )
      }
      state.indexingProgress = i + 1
      if ((i + 1) % BACKFILL_YIELD_EVERY === 0) {
        scheduleRender()
        await sleep(0)
      }
    }
    eagle.log.info(
      `[clipboard-watcher] backfill done folder=${folderId} indexed=${set.size} items=${state.indexingTotal}`
    )
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] backfill failed: ${err && err.message ? err.message : err}`)
    state.lastError = 'BACKFILL_FAILED'
  } finally {
    if (state.indexingFolderId === folderId) {
      state.indexingFolderId = null
    }
    scheduleRender()
  }
}

// ---------------------------------------------------------------------------
// 轮询主循环：用 setTimeout 链而非 setInterval，避免 readImage 比 interval 慢时
// 任务堆积；每轮先 availableFormats() 缓解 macOS 14+ "已粘贴自" 横幅
// ---------------------------------------------------------------------------

function startPolling() {
  stopPolling()
  if (!state.config.enabled || !state.config.folderId) return
  schedulePoll(true)
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function schedulePoll(immediate = false) {
  if (!state.config.enabled || !state.config.folderId) return
  const delay = immediate ? 0 : state.config.intervalMs
  pollTimer = setTimeout(async () => {
    pollTimer = null
    await runPoll()
    schedulePoll(false)
  }, delay)
}

function probeImageFormat() {
  if (!eagle.clipboard || typeof eagle.clipboard.has !== 'function') {
    return { available: false, format: null }
  }
  for (const fmt of IMAGE_FORMAT_CANDIDATES) {
    try {
      if (eagle.clipboard.has(fmt)) {
        return { available: true, format: fmt }
      }
    } catch (err) {
      // 不识别的 format 字符串可能抛错，忽略继续试下一个
    }
  }
  return { available: true, format: null } // has() 可用但当前没图
}

async function runPoll() {
  if (pollInFlight) return
  pollInFlight = true
  try {
    if (!state.config.enabled || !state.config.folderId) return

    // 1. format 探测：用 eagle.clipboard.has(fmt) 依次试候选，找到第一个返回 true 的
    //    不存在图片格式 → 整轮跳过（不触发 readImage，不触发 macOS 横幅）
    const probe = probeImageFormat()
    if (!probe.available) {
      // 极端：eagle.clipboard 或 has 不可用，直接报错让用户感知
      throw new Error('eagle.clipboard.has is unavailable')
    }
    if (!probe.format) {
      // 剪贴板内没有任何已知图片 format
      state.lastFormatsKey = null
      return
    }

    // 2. 读图 + hash
    //    注意：这里每轮都 readImage 是必要的——has() 只能告诉我们"有图"，不能告诉
    //    我们"图是否变了"。Eagle/Electron 未透出 NSPasteboard.changeCount。
    const img = eagle.clipboard.readImage()
    if (!img || typeof img.isEmpty !== 'function' || img.isEmpty()) return
    const buffer = img.toPNG()
    const hash = computeHash(buffer)
    if (!hash) return

    // 同 hash 立即返回（剪贴板里还是上次那张图）
    if (hash === state.lastClipboardHash) {
      state.lastFormatsKey = probe.format
      return
    }
    state.lastFormatsKey = probe.format

    const folderId = state.config.folderId

    // 3. 去重判定
    if (state.config.duplicateStrategy === 'skip') {
      const set = state.hashSetByFolder.get(folderId)
      if (set && set.has(hash)) {
        state.lastClipboardHash = hash
        return
      }
    } else {
      const now = Date.now()
      if (
        state.lastClipboardHash === hash &&
        now - state.lastClipboardAt < ALLOW_DEDUP_WINDOW_MS
      ) {
        return
      }
    }

    // 4. 导入
    await importImage(buffer, hash, folderId)

    state.pollErrorCount = 0
    if (state.runtimeStatus !== 'running') {
      setRuntimeStatus('running')
      scheduleRender()
    }
  } catch (err) {
    const detail =
      err && err.stack ? err.stack : err && err.message ? err.message : String(err)
    eagle.log.error(`[clipboard-watcher] poll error: ${detail}`)
    state.pollErrorCount += 1
    state.lastError = 'POLL_FAILED'
    setRuntimeStatus('error')
    scheduleRender()

    if (state.pollErrorCount >= POLL_ERROR_THRESHOLD) {
      stopPolling()
      eagle.log.warn(`[clipboard-watcher] poll suspended; retry in ${POLL_RETRY_MS}ms`)
      setTimeout(() => {
        if (state.config.enabled && state.config.folderId) {
          state.pollErrorCount = 0
          setRuntimeStatus('running')
          scheduleRender()
          startPolling()
        }
      }, POLL_RETRY_MS)
    }
  } finally {
    pollInFlight = false
  }
}

// ---------------------------------------------------------------------------
// 导入管道
// ---------------------------------------------------------------------------

async function importImage(buffer, hash, folderId) {
  const tmpRoot = path.join(os.tmpdir(), TMP_DIR_NAME)
  try {
    fs.mkdirSync(tmpRoot, { recursive: true })
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] mkdir tmp failed: ${err.message}`)
    state.lastError = 'TMP_WRITE_FAILED'
    throw err
  }

  const ts = new Date()
  const tmpPath = path.join(tmpRoot, `clip-${tmpFileStamp(ts)}.png`)
  try {
    fs.writeFileSync(tmpPath, buffer)
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] write tmp failed: ${err.message}`)
    state.lastError = 'TMP_WRITE_FAILED'
    throw err
  }

  const name = `Clipboard ${nowStamp(ts)}`
  const tags = parseTags(state.config.tags)
  const folders = [folderId]

  try {
    await eagle.item.addFromPath(tmpPath, {
      name,
      folders,
      tags,
      annotation: 'Auto imported by Clipboard Watcher',
    })
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] addFromPath failed: ${err && err.message ? err.message : err}`)
    state.lastError = 'IMPORT_FAILED'
    cleanupTmp(tmpPath)
    throw err
  }

  // 成功
  let set = state.hashSetByFolder.get(folderId)
  if (!set) {
    set = new Set()
    state.hashSetByFolder.set(folderId, set)
  }
  set.add(hash)

  state.lastClipboardHash = hash
  state.lastClipboardAt = Date.now()

  rolloverTodayIfNeeded()
  state.todayCount += 1
  state.lastImport = {
    name,
    folderLabel: state.folderIndex.get(folderId) || folderId,
    importedAt: nowStamp(ts),
  }

  cleanupTmp(tmpPath)
  maybeNotify(state.lastImport.folderLabel)
  scheduleRender()
}

function cleanupTmp(p) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] cleanup tmp failed: ${err && err.message ? err.message : err}`)
  }
}

function maybeNotify(folderLabel) {
  if (!state.config.notifyOnImport) return
  const now = Date.now()
  if (now - lastNotificationAt < NOTIFICATION_MIN_GAP_MS) return
  lastNotificationAt = now
  try {
    if (eagle.notification && typeof eagle.notification.show === 'function') {
      eagle.notification.show({
        title: 'Clipboard Watcher',
        description: `已导入 1 张图片 → ${folderLabel}`,
      })
    }
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] notification failed: ${err && err.message ? err.message : err}`)
  }
}

// ---------------------------------------------------------------------------
// 用户操作入口
// ---------------------------------------------------------------------------

async function enableWatcher() {
  if (!state.config.folderId) {
    state.lastError = 'NO_FOLDER_SELECTED'
    setRuntimeStatus('error', state.lastError)
    scheduleRender()
    return false
  }
  saveConfig({ enabled: true })
  state.pollErrorCount = 0
  setRuntimeStatus('running')
  scheduleRender()

  // 没回填过当前文件夹则先回填
  if (!state.hashSetByFolder.has(state.config.folderId)) {
    await backfillFolder(state.config.folderId)
  }
  startPolling()
  eagle.log.info('[clipboard-watcher] watcher enabled')
  return true
}

function disableWatcher() {
  saveConfig({ enabled: false })
  stopPolling()
  setRuntimeStatus('idle')
  scheduleRender()
  eagle.log.info('[clipboard-watcher] watcher disabled')
}

async function selectFolder(folderId) {
  const next = folderId || null
  const wasEnabled = state.config.enabled
  stopPolling()
  saveConfig({ folderId: next })

  if (!next) {
    if (wasEnabled) {
      saveConfig({ enabled: false })
      setRuntimeStatus('idle')
    }
    scheduleRender()
    return
  }

  if (state.config.enabled) {
    setRuntimeStatus('running')
    scheduleRender()
    await backfillFolder(next)
    if (state.config.enabled && state.config.folderId === next) {
      startPolling()
    }
  } else {
    scheduleRender()
  }
}

async function updateIntervalMs(intervalMs) {
  saveConfig({ intervalMs })
  if (state.config.enabled && state.config.folderId) {
    stopPolling()
    startPolling()
  }
}

/**
 * 触发系统截图 → 直接进剪贴板
 * macOS: screencapture -ic = interactive selection → clipboard
 * Windows: 提示用户使用 Win+Shift+S
 * 截图后由剪贴板轮询自动捕获并导入。
 */
function triggerScreenshot() {
  const platform = os.platform()
  if (platform !== 'darwin') {
    state.lastError = 'SCREENSHOT_UNSUPPORTED'
    scheduleRender()
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    execFile('screencapture', ['-ic'], (err) => {
      if (err) {
        eagle.log.error(`[clipboard-watcher] screencapture failed: ${err.message}`)
        state.lastError = 'SCREENSHOT_FAILED'
        scheduleRender()
        resolve(false)
        return
      }
      eagle.log.info('[clipboard-watcher] screencapture done; awaiting clipboard pickup')
      resolve(true)
    })
  })
}

// ---------------------------------------------------------------------------
// Snapshot for UI
// ---------------------------------------------------------------------------

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
    indexing:
      state.indexingFolderId && state.indexingFolderId === state.config.folderId
        ? { progress: state.indexingProgress, total: state.indexingTotal }
        : null,
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
  updateIntervalMs,
}

eagle.onPluginCreate(async () => {
  eagle.log.info('[clipboard-watcher] onPluginCreate')
  rolloverTodayIfNeeded()
  loadConfig()
  await refreshTheme()
  await refreshFolders()

  if (state.config.enabled && state.config.folderId) {
    setRuntimeStatus('running')
    scheduleRender()
    // 回填后启动轮询；不阻塞 onPluginCreate
    backfillFolder(state.config.folderId).then(() => {
      if (state.config.enabled && state.config.folderId) startPolling()
    })
  } else if (state.config.enabled && !state.config.folderId) {
    saveConfig({ enabled: false })
    setRuntimeStatus('idle')
    scheduleRender()
  } else {
    setRuntimeStatus('idle')
    scheduleRender()
  }
})

eagle.onPluginShow(async () => {
  eagle.log.info('[clipboard-watcher] onPluginShow')
  rolloverTodayIfNeeded()
  await refreshTheme()
  await refreshFolders()
  scheduleRender()
})

if (typeof eagle.onThemeChanged === 'function') {
  eagle.onThemeChanged((theme) => {
    state.theme = theme
    scheduleRender()
  })
}

if (typeof eagle.onPluginBeforeExit === 'function') {
  eagle.onPluginBeforeExit(() => {
    stopPolling()
  })
}
