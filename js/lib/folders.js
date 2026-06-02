/*
 * lib/folders.js — Eagle 文件夹拉取 + 启动期回填（修 #4 / ADR-009）
 */

const fs = require('fs')

const {
  BACKFILL_YIELD_EVERY,
  BACKFILL_FRESH_MS,
  ERROR_CODES,
} = require('./constants')
const { sleep, computeHash } = require('./utils')
const { state, scheduleRender, setLastError, clearLastError } = require('./state')

function flattenFolders(folders, parentPath) {
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
    state.folders = flattenFolders(raw, '')
    state.folderIndex = new Map(state.folders.map((f) => [f.id, f.label]))
    if (state.lastError === ERROR_CODES.FOLDER_FETCH_FAILED) clearLastError()
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] refreshFolders failed: ${err && err.message ? err.message : err}`)
    state.folders = []
    state.folderIndex = new Map()
    setLastError(ERROR_CODES.FOLDER_FETCH_FAILED)
  }
  return state.folders
}

/**
 * 回填指定文件夹的 hash 集合。
 * 整组替换：扫完整个 folder 用 tempSet 替换 hashSetByFolder[folderId]，
 * 这样 Eagle 里已删的 item 不会残留旧 hash（修 v1.0.x 的 #4）。
 * 节流：非 force 模式下 5s 内已回填过则跳过。
 */
async function backfillFolder(folderId, options) {
  const opts = options || {}
  const force = !!opts.force
  const freshMs = typeof opts.freshMs === 'number' ? opts.freshMs : BACKFILL_FRESH_MS

  if (!folderId) return
  if (state.indexingFolderId === folderId) return // 已在跑

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
    state.hashSetByFolder.set(folderId, tempSet)
    state.lastBackfillAt.set(folderId, Date.now())
    eagle.log.info(
      `[clipboard-watcher] backfill done folder=${folderId} indexed=${tempSet.size} items=${state.indexingTotal} force=${force}`
    )
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] backfill failed: ${err && err.message ? err.message : err}`)
    setLastError(ERROR_CODES.BACKFILL_FAILED)
  } finally {
    if (state.indexingFolderId === folderId) state.indexingFolderId = null
    scheduleRender()
  }
}

async function resetFolderIndex() {
  if (!state.config || !state.config.folderId) return
  await backfillFolder(state.config.folderId, { force: true })
}

module.exports = {
  flattenFolders,
  refreshFolders,
  backfillFolder,
  resetFolderIndex,
}
