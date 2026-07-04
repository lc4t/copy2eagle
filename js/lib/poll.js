/*
 * lib/poll.js — 剪贴板轮询状态机：setTimeout 链 + 自锁 + adaptive + 重试 ticker
 *
 * adaptive polling（M5）：同 hash 持续 3 轮后切 idle 模式，
 * 间隔放慢到 max(用户设置, 5s)；hash 变化或图片消失立即回 normal。
 *
 * 文件 URL 优先（v1.2.1 / #1）：runPoll 先看 file URL，存在则走多文件路径，
 * 不导入系统自动生成的预览 icon。
 */

const os = require('os')

const {
  ALLOW_DEDUP_WINDOW_MS,
  POLL_RETRY_MS,
  POLL_ERROR_THRESHOLD,
  ADAPTIVE_IDLE_INTERVAL_MS,
  ADAPTIVE_IDLE_THRESHOLD,
  ERROR_CODES,
} = require('./constants')
const { computeHash } = require('./utils')
const {
  state,
  scheduleRender,
  setRuntimeStatus,
  setLastError,
  clearLastError,
} = require('./state')
const { acquireLease } = require('./instance')
const {
  probeImageFormat,
  probeAnyFormat,
  readClipboardFilePaths,
  isImagePath,
  TEXT_FORMAT_CANDIDATES,
  FILE_URL_FORMAT_CANDIDATES,
} = require('./clipboard')
const {
  importImage,
  importFileBatch,
  fileBatchKey,
  detectImageSource,
  getImageDimensions,
} = require('./import')
const { resolveTargetFolder } = require('./config')

let pollTimer = null
let pollInFlight = false

function decideClipboardHash({ hash, lastHash, lastImportAt, strategy, now }) {
  if (hash !== lastHash) return { sameHash: false, shouldImport: true }
  if (strategy === 'skip') return { sameHash: true, shouldImport: false }
  const currentTime = typeof now === 'number' ? now : Date.now()
  return {
    sameHash: true,
    shouldImport: currentTime - Number(lastImportAt || 0) >= ALLOW_DEDUP_WINDOW_MS,
  }
}

// ─── 重试 ticker（UI 倒计时刷新）───
let retryTicker = null
function startRetryTicker() {
  stopRetryTicker()
  scheduleRender()
  retryTicker = setInterval(() => {
    if (!state.retryAt || Date.now() >= state.retryAt) stopRetryTicker()
    scheduleRender()
  }, 1000)
}
function stopRetryTicker() {
  if (retryTicker) {
    clearInterval(retryTicker)
    retryTicker = null
  }
}

// ─── adaptive polling helpers ───
function bumpIdleStreak() {
  state.sameHashStreak += 1
  if (state.sameHashStreak >= ADAPTIVE_IDLE_THRESHOLD && state.adaptiveMode !== 'idle') {
    state.adaptiveMode = 'idle'
    eagle.log.info(`[clipboard-watcher] adaptive → idle (interval ${getEffectiveIntervalMs()}ms)`)
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
  if (state.adaptiveMode === 'idle') return Math.max(base, ADAPTIVE_IDLE_INTERVAL_MS)
  return base
}

// ─── 主循环 ───
function startPolling() {
  stopPolling()
  if (!state.config.enabled || !state.config.folderId) return
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

function schedulePoll(immediate) {
  if (!state.config.enabled || !state.config.folderId) return
  const delay = immediate ? 0 : getEffectiveIntervalMs()
  pollTimer = setTimeout(async () => {
    pollTimer = null
    await runPoll()
    schedulePoll(false)
  }, delay)
}

async function runPoll() {
  if (pollInFlight) return
  pollInFlight = true
  try {
    if (!state.config.enabled || !state.config.folderId) return

    // v1.5.3 / M17：单 owner lease。非 owner 只观察，不覆盖当前 owner。
    const lease = acquireLease()
    state.instanceConflict = lease.conflict
    if (!lease.owned && lease.conflict) {
      if (state.lastError !== ERROR_CODES.INSTANCE_CONFLICT) {
        setLastError(ERROR_CODES.INSTANCE_CONFLICT)
        setRuntimeStatus('error')
        scheduleRender()
      }
      return
    }
    if (!lease.owned) return
    if (state.lastError === ERROR_CODES.INSTANCE_CONFLICT) {
      // 旧实例消失，自动恢复
      clearLastError()
      setRuntimeStatus('running')
      scheduleRender()
    }

    const platform = os.platform()
    const probe = probeImageFormat()
    if (!probe.available) {
      if (platform !== 'win32' || !eagle.clipboard || typeof eagle.clipboard.readImage !== 'function') {
        throw new Error('eagle.clipboard.has is unavailable')
      }
      eagle.log.warn('[clipboard-watcher] clipboard.has unavailable; using Windows readImage fallback')
    }

    // 文件 URL 优先（v1.2.1 / #1）：Finder 复制文件时系统会同时塞预览 icon，
    // 见到 file URL 就走多文件路径，icon 整段跳过。
    const hasFileUrl = probeAnyFormat(FILE_URL_FORMAT_CANDIDATES)
    if (hasFileUrl) {
      state.lastFormatsKey = null
      resetIdleStreak()
      if (!state.config.importMultipleFiles) return
      const paths = await readClipboardFilePaths()
      if (!paths.length) return
      const imagePaths = paths.filter(isImagePath)
      if (!imagePaths.length) return
      const batchKey = fileBatchKey(imagePaths)
      if (batchKey && batchKey === state.lastFileBatchKey) return
      state.lastFileBatchKey = batchKey
      // v1.4：多文件按 source='files' 解析
      const folderId = resolveTargetFolder('files', state.config)
      const { added, skipped } = await importFileBatch(imagePaths, folderId)
      eagle.log.info(
        `[clipboard-watcher] multi-file (from file-url) added=${added} skipped=${skipped} total=${imagePaths.length}`
      )
      state.pollErrorCount = 0
      if (state.runtimeStatus !== 'running') {
        setRuntimeStatus('running')
        scheduleRender()
      }
      return
    }

    const shouldReadImage = !!probe.format || platform === 'win32'
    if (shouldReadImage) {
      // 单图（无 file URL，是真图）
      if (!state.config.importMixedContent && probeAnyFormat(TEXT_FORMAT_CANDIDATES)) {
        state.lastFormatsKey = probe.format || 'win32-direct-image'
        bumpIdleStreak()
        return
      }

      const img = eagle.clipboard.readImage()
      if (!img || typeof img.isEmpty !== 'function' || img.isEmpty()) return
      const buffer = img.toPNG()
      const hash = computeHash(buffer)
      if (!hash) return

      const hashDecision = decideClipboardHash({
        hash,
        lastHash: state.lastClipboardHash,
        lastImportAt: state.lastClipboardAt,
        strategy: state.config.duplicateStrategy,
      })
      state.lastFormatsKey = probe.format || 'win32-direct-image'
      if (hashDecision.sameHash) bumpIdleStreak()
      else resetIdleStreak()
      if (!hashDecision.shouldImport) return

      // v1.4：单图按 source（screenshot / clipboard）解析目标文件夹
      const source = detectImageSource()
      const folderId = resolveTargetFolder(source, state.config)

      if (state.config.duplicateStrategy === 'skip') {
        const set = state.hashSetByFolder.get(folderId)
        if (set && set.has(hash)) {
          state.lastClipboardHash = hash
          return
        }
      }

      const dims = getImageDimensions(img)
      await importImage(buffer, hash, folderId, { source, dims })
    } else {
      // 既无图也无 file URL：剪贴板空闲或仅文本
      state.lastFormatsKey = null
      resetIdleStreak()
    }

    state.pollErrorCount = 0
    if (state.runtimeStatus !== 'running') {
      setRuntimeStatus('running')
      scheduleRender()
    }
  } catch (err) {
    const detail = err && err.stack ? err.stack : err && err.message ? err.message : String(err)
    eagle.log.error(`[clipboard-watcher] poll error: ${detail}`)
    state.pollErrorCount += 1
    setLastError(ERROR_CODES.POLL_FAILED)
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

module.exports = {
  startPolling,
  stopPolling,
  runPoll,
  getEffectiveIntervalMs,
  bumpIdleStreak,
  resetIdleStreak,
  decideClipboardHash,
}
