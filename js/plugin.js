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
const CONFIG_VERSION = 2
const ALLOWED_DUPLICATE_STRATEGIES = ['skip', 'allow']
const ALLOW_DEDUP_WINDOW_MS = 30000
const POLL_RETRY_MS = 5000
const POLL_ERROR_THRESHOLD = 3
const BACKFILL_YIELD_EVERY = 20
const BACKFILL_FRESH_MS = 5000 // onPluginShow 触发回填的节流窗口
const SCREENSHOT_NAME_WINDOW_MS = 5000 // 截图按钮触发后 N 秒内的导入标 Screenshot
const TMP_DIR_NAME = 'eagle-cw'

// M5：adaptive polling — 剪贴板里图片不变时自动放慢，降低 macOS 横幅触发频率
const ADAPTIVE_IDLE_INTERVAL_MS = 5000
const ADAPTIVE_IDLE_THRESHOLD = 3 // 同 hash 连续观测到这么多次后进入 idle 模式

// M5：最近导入列表长度
const RECENT_IMPORTS_CAP = 5

// 多文件复制相关
const FILE_URL_FORMAT_CANDIDATES = [
  'public.file-url',
  'NSFilenamesPboardType',
  'CF_HDROP',
  'FileDrop',
]
const TEXT_FORMAT_CANDIDATES = [
  'text/html',
  'text/plain',
  'public.utf8-plain-text',
  'public.html',
]
const IMAGE_FILE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.svg', '.avif',
])
const MULTI_FILE_MAX = 50
const SHELL_TIMEOUT_MS = 2000

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
    importMixedContent: true,    // F11 / M4：含 HTML/RTF 的混排，默认仍导入图片
    importMultipleFiles: false,  // F10 / M4：多文件批量复制，默认关
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
  if (typeof merged.importMixedContent !== 'boolean') merged.importMixedContent = true
  if (typeof merged.importMultipleFiles !== 'boolean') merged.importMultipleFiles = false
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

  // M4 additions
  lastBackfillAt: new Map(), // folderId -> timestamp（节流 onPluginShow 触发的回填）
  lastScreenshotAt: 0,        // 截图按钮触发时间（导入命名用）
  lastFileBatchKey: null,     // 多文件复制路径列表的 hash，避免同批反复导入

  // M5 additions
  sameHashStreak: 0,          // 同 hash 连续观测次数（adaptive polling）
  adaptiveMode: 'normal',     // 'normal' | 'idle' — schedulePoll 用这个决定下一轮间隔
  recentImports: [],          // 最近导入历史，cap = RECENT_IMPORTS_CAP
  retryAt: 0,                 // 错误恢复 deadline；UI 显示倒计时
}

let pollTimer = null
let pollInFlight = false
let lastNotificationAt = 0
const NOTIFICATION_MIN_GAP_MS = 1500

let retryTicker = null
function startRetryTicker() {
  stopRetryTicker()
  scheduleRender()
  retryTicker = setInterval(() => {
    if (!state.retryAt || Date.now() >= state.retryAt) {
      stopRetryTicker()
    }
    scheduleRender()
  }, 1000)
}
function stopRetryTicker() {
  if (retryTicker) {
    clearInterval(retryTicker)
    retryTicker = null
  }
}

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

/**
 * 回填指定文件夹的 hash 集合。
 * - 每次都重建到 tempSet，结束时整组替换 → 这是修复「删了又复制」bug 的关键：
 *   Eagle 里已删的 item，不会在 tempSet 里出现，set 替换后旧 hash 自然脱离去重表。
 * - 非 force 模式下用 freshMs 节流，避免 onPluginShow 频繁触发。
 * - 极小概率竞态：回填进行中用户复制一张新图被导入并写入旧 set，结束替换时会丢失。
 *   折中为可接受（最坏导致下一次同图重复导入一次）。
 */
async function backfillFolder(folderId, options = {}) {
  if (!folderId) return
  if (state.indexingFolderId === folderId) return // 已在跑

  const { force = false, freshMs = BACKFILL_FRESH_MS } = options
  if (!force) {
    const lastAt = state.lastBackfillAt.get(folderId) || 0
    if (Date.now() - lastAt < freshMs) return
  }

  state.indexingFolderId = folderId
  state.indexingProgress = 0
  state.indexingTotal = 0
  scheduleRender()

  const tempSet = new Set()

  try {
    const items = await eagle.item.get({ folders: [folderId] })
    state.indexingTotal = Array.isArray(items) ? items.length : 0
    scheduleRender()

    for (let i = 0; i < state.indexingTotal; i++) {
      if (state.indexingFolderId !== folderId) break

      const item = items[i]
      try {
        if (item && typeof item.filePath === 'string' && fs.existsSync(item.filePath)) {
          const buffer = fs.readFileSync(item.filePath)
          const hash = computeHash(buffer)
          if (hash) tempSet.add(hash)
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

    // 整组替换（修复 #4：Eagle 里已删的 item 不会留在 set 里）
    state.hashSetByFolder.set(folderId, tempSet)
    state.lastBackfillAt.set(folderId, Date.now())
    eagle.log.info(
      `[clipboard-watcher] backfill done folder=${folderId} indexed=${tempSet.size} items=${state.indexingTotal} force=${force}`
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

async function resetFolderIndex() {
  if (!state.config.folderId) return
  await backfillFolder(state.config.folderId, { force: true })
}

// ---------------------------------------------------------------------------
// 轮询主循环：用 setTimeout 链而非 setInterval，避免 readImage 比 interval 慢时
// 任务堆积；每轮先 availableFormats() 缓解 macOS 14+ "已粘贴自" 横幅
// ---------------------------------------------------------------------------

function startPolling() {
  stopPolling()
  if (!state.config.enabled || !state.config.folderId) return
  // 重新启动时回到 normal 模式
  state.sameHashStreak = 0
  state.adaptiveMode = 'normal'
  schedulePoll(true)
}

function stopPolling() {
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
}

function bumpIdleStreak() {
  state.sameHashStreak += 1
  if (state.sameHashStreak >= ADAPTIVE_IDLE_THRESHOLD && state.adaptiveMode !== 'idle') {
    state.adaptiveMode = 'idle'
    eagle.log.info(
      `[clipboard-watcher] adaptive → idle (interval ${getEffectiveIntervalMs()}ms)`
    )
  }
}

function resetIdleStreak() {
  if (state.sameHashStreak !== 0 || state.adaptiveMode !== 'normal') {
    state.sameHashStreak = 0
    state.adaptiveMode = 'normal'
    eagle.log.info('[clipboard-watcher] adaptive → normal')
  }
}

function getEffectiveIntervalMs() {
  const base = state.config.intervalMs
  // base 已是用户设置（0.5–5s）。idle 模式取 max(base, ADAPTIVE_IDLE_INTERVAL_MS)
  // 用户已经把 base 调到 >= 5s 时不再 adaptive（已经够慢）
  if (state.adaptiveMode === 'idle') {
    return Math.max(base, ADAPTIVE_IDLE_INTERVAL_MS)
  }
  return base
}

function schedulePoll(immediate = false) {
  if (!state.config.enabled || !state.config.folderId) return
  const delay = immediate ? 0 : getEffectiveIntervalMs()
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

function probeAnyFormat(candidates) {
  if (!eagle.clipboard || typeof eagle.clipboard.has !== 'function') return false
  for (const fmt of candidates) {
    try {
      if (eagle.clipboard.has(fmt)) return true
    } catch {}
  }
  return false
}

/**
 * 读取剪贴板里的多文件路径列表（仅 macOS / Windows）。
 * macOS: osascript 把 `the clipboard as «class furl»` 拉出来转 POSIX 路径
 * Windows: PowerShell `Get-Clipboard -Format FileDropList`
 * 返回 string[]；超时 / 出错都返回 []
 */
function readClipboardFilePaths() {
  return new Promise((resolve) => {
    const platform = os.platform()
    if (platform === 'darwin') {
      const script =
        'try\n' +
        '  set theItems to the clipboard as «class furl»\n' +
        'on error\n' +
        '  return ""\n' +
        'end try\n' +
        'set thePaths to {}\n' +
        'try\n' +
        '  repeat with f in theItems\n' +
        '    set end of thePaths to POSIX path of f\n' +
        '  end repeat\n' +
        'on error\n' +
        '  try\n' +
        '    set end of thePaths to POSIX path of theItems\n' +
        '  end try\n' +
        'end try\n' +
        'set AppleScript\'s text item delimiters to linefeed\n' +
        'return thePaths as text'
      execFile(
        'osascript',
        ['-e', script],
        { timeout: SHELL_TIMEOUT_MS },
        (err, stdout) => {
          if (err) {
            eagle.log.warn(`[clipboard-watcher] osascript failed: ${err.message}`)
            resolve([])
            return
          }
          resolve(parsePathList(stdout))
        }
      )
    } else if (platform === 'win32') {
      const script =
        "$ErrorActionPreference='SilentlyContinue';" +
        " Get-Clipboard -Format FileDropList |" +
        ' ForEach-Object { $_.FullName }'
      execFile(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: SHELL_TIMEOUT_MS },
        (err, stdout) => {
          if (err) {
            eagle.log.warn(`[clipboard-watcher] powershell failed: ${err.message}`)
            resolve([])
            return
          }
          resolve(parsePathList(stdout))
        }
      )
    } else {
      resolve([])
    }
  })
}

function parsePathList(stdout) {
  if (typeof stdout !== 'string') return []
  return stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MULTI_FILE_MAX)
}

function isImagePath(p) {
  if (typeof p !== 'string') return false
  const ext = path.extname(p).toLowerCase()
  return IMAGE_FILE_EXTS.has(ext)
}

function fileBatchKey(paths) {
  // 用路径列表 + 第一个文件 mtime 做 key；避免同批反复导入
  if (!paths.length) return null
  let mtimeMs = 0
  try {
    mtimeMs = fs.statSync(paths[0]).mtimeMs
  } catch {}
  return `${paths.length}|${paths[0]}|${mtimeMs}`
}

async function importFileBatch(paths, folderId) {
  let added = 0
  let skipped = 0
  for (const p of paths) {
    try {
      if (!fs.existsSync(p)) {
        skipped++
        continue
      }
      const buffer = fs.readFileSync(p)
      const hash = computeHash(buffer)
      if (!hash) {
        skipped++
        continue
      }

      // 去重判定（沿用 skip / allow）
      if (state.config.duplicateStrategy === 'skip') {
        const set = state.hashSetByFolder.get(folderId)
        if (set && set.has(hash)) {
          skipped++
          continue
        }
      }

      const baseName = path.basename(p, path.extname(p))
      const tags = parseTags(state.config.tags)
      try {
        await eagle.item.addFromPath(p, {
          name: baseName,
          folders: [folderId],
          tags,
          annotation: `Source: Multi-file clipboard\nFrom: ${p}\nImported by Clipboard Watcher @ ${getHostname()}`,
        })
        let set = state.hashSetByFolder.get(folderId)
        if (!set) {
          set = new Set()
          state.hashSetByFolder.set(folderId, set)
        }
        set.add(hash)
        added++
        rolloverTodayIfNeeded()
        state.todayCount += 1
        const entry = {
          name: baseName,
          folderLabel: state.folderIndex.get(folderId) || folderId,
          importedAt: nowStamp(),
          source: 'files',
          dims: '',
        }
        state.lastImport = entry
        pushRecentImport(entry)
      } catch (err) {
        skipped++
        eagle.log.warn(`[clipboard-watcher] addFromPath failed for ${p}: ${err && err.message ? err.message : err}`)
      }
    } catch (err) {
      skipped++
      eagle.log.warn(`[clipboard-watcher] file batch item failed ${p}: ${err && err.message ? err.message : err}`)
    }
  }
  if (added > 0) {
    maybeNotify(`${state.folderIndex.get(folderId) || folderId}（${added} 张）`)
  }
  scheduleRender()
  return { added, skipped }
}

async function runPoll() {
  if (pollInFlight) return
  pollInFlight = true
  try {
    if (!state.config.enabled || !state.config.folderId) return

    // 1. format 探测
    const probe = probeImageFormat()
    if (!probe.available) {
      throw new Error('eagle.clipboard.has is unavailable')
    }

    if (probe.format) {
      // ───── 单张图片路径 ─────
      // 1a. 混排判定（#2）：开关关闭时，若同时存在 text/html 或 text/plain 则跳过
      if (!state.config.importMixedContent) {
        if (probeAnyFormat(TEXT_FORMAT_CANDIDATES)) {
          state.lastFormatsKey = probe.format
          // 混排被跳过也算"剪贴板里有图但我们不动" → 进 idle 节流
          bumpIdleStreak()
          return
        }
      }

      // 2. 读图 + hash
      const img = eagle.clipboard.readImage()
      if (!img || typeof img.isEmpty !== 'function' || img.isEmpty()) return
      const buffer = img.toPNG()
      const hash = computeHash(buffer)
      if (!hash) return

      // 同 hash 立即返回
      if (hash === state.lastClipboardHash) {
        state.lastFormatsKey = probe.format
        bumpIdleStreak()
        return
      }
      // hash 变化 → 立刻回 normal 模式
      resetIdleStreak()
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

      // 4. 导入（带尺寸 + 来源）
      const source = detectImageSource()
      const dims = getImageDimensions(img)
      await importImage(buffer, hash, folderId, { source, dims })
    } else {
      // ───── 多文件路径（#1 / F10）─────
      state.lastFormatsKey = null
      // 没有单图：剪贴板无活动 → 重置 idle streak（normal 模式）
      resetIdleStreak()
      if (!state.config.importMultipleFiles) return
      if (!probeAnyFormat(FILE_URL_FORMAT_CANDIDATES)) return

      const paths = await readClipboardFilePaths()
      if (!paths.length) return
      const imagePaths = paths.filter(isImagePath)
      if (!imagePaths.length) return

      const batchKey = fileBatchKey(imagePaths)
      if (batchKey && batchKey === state.lastFileBatchKey) return
      state.lastFileBatchKey = batchKey

      const folderId = state.config.folderId
      const { added, skipped } = await importFileBatch(imagePaths, folderId)
      eagle.log.info(
        `[clipboard-watcher] multi-file batch added=${added} skipped=${skipped} total=${imagePaths.length}`
      )
    }

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
      state.retryAt = Date.now() + POLL_RETRY_MS
      startRetryTicker()
      eagle.log.warn(`[clipboard-watcher] poll suspended; retry in ${POLL_RETRY_MS}ms`)
      setTimeout(() => {
        stopRetryTicker()
        state.retryAt = 0
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

function detectImageSource() {
  // 5 秒内截图按钮被按过 → 标 Screenshot
  if (state.lastScreenshotAt && Date.now() - state.lastScreenshotAt < SCREENSHOT_NAME_WINDOW_MS) {
    return 'screenshot'
  }
  return 'clipboard'
}

function getImageDimensions(img) {
  try {
    if (img && typeof img.getSize === 'function') {
      const s = img.getSize()
      if (s && s.width && s.height) return `${s.width}x${s.height}`
    }
  } catch {}
  return ''
}

function buildItemName(source, dims, ts) {
  const prefix = source === 'screenshot' ? 'Screenshot' : 'Clipboard'
  return [prefix, dims, nowStamp(ts)].filter(Boolean).join(' ')
}

function buildAnnotation(source, dims) {
  const parts = [`Source: ${source === 'screenshot' ? 'Screenshot (button)' : 'Clipboard'}`]
  if (dims) parts.push(`Size: ${dims}`)
  parts.push(`Imported by Clipboard Watcher @ ${getHostname()}`)
  return parts.join('\n')
}

async function importImage(buffer, hash, folderId, options = {}) {
  const tmpRoot = path.join(os.tmpdir(), TMP_DIR_NAME)
  try {
    fs.mkdirSync(tmpRoot, { recursive: true })
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] mkdir tmp failed: ${err.message}`)
    state.lastError = 'TMP_WRITE_FAILED'
    throw err
  }

  const ts = new Date()
  const source = options.source || detectImageSource()
  const dims = options.dims || ''
  const tmpPath = path.join(tmpRoot, `${source}-${tmpFileStamp(ts)}.png`)
  try {
    fs.writeFileSync(tmpPath, buffer)
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] write tmp failed: ${err.message}`)
    state.lastError = 'TMP_WRITE_FAILED'
    throw err
  }

  const name = buildItemName(source, dims, ts)
  const annotation = buildAnnotation(source, dims)
  const tags = parseTags(state.config.tags)
  const folders = [folderId]

  try {
    await eagle.item.addFromPath(tmpPath, { name, folders, tags, annotation })
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
  const entry = {
    name,
    folderLabel: state.folderIndex.get(folderId) || folderId,
    importedAt: nowStamp(ts),
    source,
    dims,
  }
  state.lastImport = entry
  pushRecentImport(entry)

  cleanupTmp(tmpPath)
  maybeNotify(state.lastImport.folderLabel)
  scheduleRender()
}

function pushRecentImport(entry) {
  state.recentImports.unshift(entry)
  if (state.recentImports.length > RECENT_IMPORTS_CAP) {
    state.recentImports.length = RECENT_IMPORTS_CAP
  }
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
      // 标记触发时间，让随后的 import 命名为 "Screenshot ..."
      state.lastScreenshotAt = Date.now()
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
  const retryRemainingMs = state.retryAt ? Math.max(0, state.retryAt - Date.now()) : 0
  return {
    config: state.config,
    folders: state.folders,
    folderLabel: state.config.folderId ? state.folderIndex.get(state.config.folderId) || null : null,
    todayCount: state.todayCount,
    lastImport: state.lastImport,
    recentImports: state.recentImports.slice(),
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
    retryRemainingSec: retryRemainingMs > 0 ? Math.ceil(retryRemainingMs / 1000) : 0,
    adaptiveMode: state.adaptiveMode,
    effectiveIntervalMs: getEffectiveIntervalMs(),
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
  resetFolderIndex,
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
  // 节流回填：让本次打开面板能感知到 Eagle 里被手动删除的 item
  if (state.config.folderId) {
    backfillFolder(state.config.folderId).catch(() => {})
  }
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
