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
    importMixedContent: true,
    importMultipleFiles: false,
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
}
