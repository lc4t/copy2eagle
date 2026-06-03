/*
 * lib/config.js — schema / defaults / 持久化（localStorage，K7 / ADR-010）
 */

const {
  CONFIG_KEY,
  CONFIG_VERSION,
  ALLOWED_DUPLICATE_STRATEGIES,
  ERROR_CODES,
} = require('./constants')
const { getHostname } = require('./utils')
const { state, setLastError } = require('./state')

// v1.5：自定义命名模板（F13）默认值——还原 v1.4 行为
const DEFAULT_NAME_TEMPLATE = '{source} {dims} {timestamp}'

function defaultTags() {
  const host = getHostname()
  return host ? `clipboard-watcher,${host}` : 'clipboard-watcher'
}

function buildDefaults() {
  return {
    version: CONFIG_VERSION,
    enabled: false,
    folderId: null,
    // 多文件夹路由（v1.4 / F12）：按来源分流
    // null = 使用主 folderId；string = 该来源专属文件夹
    folderIdScreenshot: null,
    folderIdClipboard: null,
    folderIdFiles: null,
    intervalMs: 1000,
    tags: defaultTags(),
    notifyOnImport: true,
    duplicateStrategy: 'skip',
    importMixedContent: true,
    importMultipleFiles: false,
    nameTemplate: DEFAULT_NAME_TEMPLATE,
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
  // 路由字段：必须是 string 或 null
  for (const k of ['folderIdScreenshot', 'folderIdClipboard', 'folderIdFiles']) {
    if (typeof merged[k] !== 'string' || !merged[k]) merged[k] = null
  }
  // 模板：空 / 非 string → 用默认
  if (typeof merged.nameTemplate !== 'string' || !merged.nameTemplate.trim()) {
    merged.nameTemplate = DEFAULT_NAME_TEMPLATE
  }
  return merged
}

/**
 * 根据来源解析目标文件夹（v1.4 / F12）。
 * @param {'screenshot'|'clipboard'|'files'} source
 * @returns {string|null}
 */
function resolveTargetFolder(source, config) {
  const c = config || state.config || buildDefaults()
  if (source === 'screenshot' && c.folderIdScreenshot) return c.folderIdScreenshot
  if (source === 'clipboard' && c.folderIdClipboard) return c.folderIdClipboard
  if (source === 'files' && c.folderIdFiles) return c.folderIdFiles
  return c.folderId
}

/**
 * 列出当前配置里所有被使用的 folderId（去重）。
 * 用于 enable 时一次性 backfill。
 */
function getActiveFolderIds(config) {
  const c = config || state.config || buildDefaults()
  const ids = new Set()
  if (c.folderId) ids.add(c.folderId)
  if (c.folderIdScreenshot) ids.add(c.folderIdScreenshot)
  if (c.folderIdClipboard) ids.add(c.folderIdClipboard)
  if (c.folderIdFiles) ids.add(c.folderIdFiles)
  return Array.from(ids)
}

function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    state.config = normalizeConfig(raw ? JSON.parse(raw) : {})
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] load config failed: ${err && err.message ? err.message : err}`)
    state.config = buildDefaults()
    setLastError(ERROR_CODES.CONFIG_LOAD_FAILED)
  }
  return state.config
}

function saveConfig(patch) {
  state.config = normalizeConfig(Object.assign({}, state.config || buildDefaults(), patch))
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(state.config))
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] save config failed: ${err && err.message ? err.message : err}`)
    setLastError(ERROR_CODES.CONFIG_SAVE_FAILED)
    throw err
  }
  return state.config
}

module.exports = {
  buildDefaults,
  normalizeConfig,
  loadConfig,
  saveConfig,
  defaultTags,
  resolveTargetFolder,
  getActiveFolderIds,
  DEFAULT_NAME_TEMPLATE,
}
