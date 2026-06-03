/*
 * lib/import.js — 导入管道：tmp 文件 + eagle.item.addFromPath
 *
 * 命名规则（M4 / #5）：
 *   - 截图按钮触发后 5s 内：Screenshot {WxH} {timestamp}
 *   - 其他剪贴板：Clipboard {WxH} {timestamp}
 *   - 多文件：源文件名（去扩展名）
 */

const os = require('os')
const fs = require('fs')
const path = require('path')

const {
  TMP_DIR_NAME,
  SCREENSHOT_NAME_WINDOW_MS,
  ERROR_CODES,
} = require('./constants')
const {
  nowStamp,
  tmpFileStamp,
  parseTags,
  getHostname,
  computeHash,
  renderTemplate,
  shortDate,
  shortTime,
} = require('./utils')
const {
  state,
  scheduleRender,
  setLastError,
  pushRecentImport,
  incrementToday,
} = require('./state')
const { maybeNotify, maybeNotifyError } = require('./notification')
const { isImagePath } = require('./clipboard')

function detectImageSource() {
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

/**
 * 构造单图 / 截图导入的 item 名（v1.5：可自定义模板，F13）。
 * - 模板取自 state.config.nameTemplate（normalize 保证非空）
 * - 渲染失败 / 空 → 回退到默认行为
 * - 多文件批量路径**不走此函数**，仍用源文件 basename
 */
function buildItemName(source, dims, ts) {
  const sourceLabel = source === 'screenshot' ? 'Screenshot' : 'Clipboard'
  const ctx = buildNameContext({ source: sourceLabel, dims, ts })
  const tpl = (state.config && state.config.nameTemplate) || '{source} {dims} {timestamp}'
  const rendered = renderTemplate(tpl, ctx)
  if (rendered) return rendered
  // 兜底：所有 token 都空时回到默认拼法
  return [sourceLabel, dims, nowStamp(ts)].filter(Boolean).join(' ')
}

function buildNameContext({ source, dims, ts, name }) {
  const t = ts || new Date()
  return {
    source: source || '',
    dims: dims || '',
    timestamp: nowStamp(t),
    date: shortDate(t),
    time: shortTime(t),
    hostname: getHostname(),
    count: state.todayCount,
    lifetime: state.lifetimeCount,
    name: name || '',
  }
}

function buildAnnotation(source, dims) {
  const parts = [`Source: ${source === 'screenshot' ? 'Screenshot (button)' : 'Clipboard'}`]
  if (dims) parts.push(`Size: ${dims}`)
  parts.push(`Imported by Clipboard Watcher @ ${getHostname()}`)
  return parts.join('\n')
}

function cleanupTmp(p) {
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] cleanup tmp failed: ${err && err.message ? err.message : err}`)
  }
}

async function importImage(buffer, hash, folderId, options) {
  const opts = options || {}
  const tmpRoot = path.join(os.tmpdir(), TMP_DIR_NAME)
  try {
    fs.mkdirSync(tmpRoot, { recursive: true })
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] mkdir tmp failed: ${err.message}`)
    setLastError(ERROR_CODES.TMP_WRITE_FAILED)
    maybeNotifyError(require('./i18n').t('notify.tmp_failed'))
    throw err
  }

  const ts = new Date()
  const source = opts.source || detectImageSource()
  const dims = opts.dims || ''
  const tmpPath = path.join(tmpRoot, `${source}-${tmpFileStamp(ts)}.png`)
  try {
    fs.writeFileSync(tmpPath, buffer)
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] write tmp failed: ${err.message}`)
    setLastError(ERROR_CODES.TMP_WRITE_FAILED)
    maybeNotifyError(require('./i18n').t('notify.tmp_failed'))
    throw err
  }

  const name = buildItemName(source, dims, ts)
  const annotation = buildAnnotation(source, dims)
  const tags = parseTags(state.config.tags)
  const folders = [folderId]

  let itemId = null
  try {
    const result = await eagle.item.addFromPath(tmpPath, { name, folders, tags, annotation })
    if (typeof result === 'string' && result) itemId = result
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] addFromPath failed: ${err && err.message ? err.message : err}`)
    setLastError(ERROR_CODES.IMPORT_FAILED)
    cleanupTmp(tmpPath)
    maybeNotifyError(require('./i18n').t('notify.import_failed'))
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

  incrementToday()
  pushRecentImport({
    name,
    folderLabel: state.folderIndex.get(folderId) || folderId,
    importedAt: nowStamp(ts),
    source,
    dims,
    itemId,
  })

  cleanupTmp(tmpPath)
  maybeNotify(state.folderIndex.get(folderId) || folderId)
  scheduleRender()
}

function fileBatchKey(paths) {
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
        const result = await eagle.item.addFromPath(p, {
          name: baseName,
          folders: [folderId],
          tags,
          annotation: `Source: Multi-file clipboard\nFrom: ${p}\nImported by Clipboard Watcher @ ${getHostname()}`,
        })
        const itemId = typeof result === 'string' ? result : null
        let set = state.hashSetByFolder.get(folderId)
        if (!set) {
          set = new Set()
          state.hashSetByFolder.set(folderId, set)
        }
        set.add(hash)
        added++
        incrementToday()
        pushRecentImport({
          name: baseName,
          folderLabel: state.folderIndex.get(folderId) || folderId,
          importedAt: nowStamp(),
          source: 'files',
          dims: '',
          itemId,
        })
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
    maybeNotify(state.folderIndex.get(folderId) || folderId, added)
  } else if (skipped > 0 && paths.length > 0) {
    const { t } = require('./i18n')
    maybeNotifyError(t('notify.multi_all_failed', null, paths.length))
  }
  scheduleRender()
  return { added, skipped }
}

async function openItem(itemId) {
  if (!itemId || typeof eagle.item.open !== 'function') return false
  try {
    await eagle.item.open(itemId)
    return true
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] open item failed: ${err && err.message ? err.message : err}`)
    return false
  }
}

module.exports = {
  importImage,
  importFileBatch,
  detectImageSource,
  getImageDimensions,
  buildItemName,
  buildNameContext,
  buildAnnotation,
  fileBatchKey,
  isImagePath,
  openItem,
}
