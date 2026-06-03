/*
 * plugin.js — Eagle Clipboard Watcher 入口编排器（v1.3.0 重构）
 *
 * 本文件只做：
 *   ① 编排各 lib/* 模块
 *   ② 注册 Eagle 生命周期 hooks
 *   ③ 暴露 window.ClipboardWatcher 接口给 ui.js
 *
 * 业务逻辑都在 lib/ 下，按职责拆分：
 *   constants / utils / state / config / i18n / theme / folders / clipboard /
 *   import / screenshot / notification / poll
 *
 * 重构动机：原单文件 1100 行，config/folders/poll/import/screenshot 全混在一起，
 * 加新功能要在多处穿插改动。拆分后每个模块 ≤200 行，单一职责，新功能可以
 * 锁定具体模块改。行为零变化（同 v1.2.1）。
 */

const { ERROR_CODES } = require('./lib/constants')
const { state, setRenderer, scheduleRender, rolloverTodayIfNeeded, setRuntimeStatus, setLastError, loadStats } = require('./lib/state')
const { buildDefaults, loadConfig, saveConfig, getActiveFolderIds, DEFAULT_NAME_TEMPLATE } = require('./lib/config')
const { detectLocale, setLocale } = require('./lib/i18n')
const { refreshTheme, isDarkTheme, bindThemeListener } = require('./lib/theme')
const { refreshFolders, backfillFolder, resetFolderIndex } = require('./lib/folders')
const { startPolling, stopPolling, getEffectiveIntervalMs } = require('./lib/poll')
const { openItem, buildNameContext } = require('./lib/import')
const { renderTemplate } = require('./lib/utils')
const { triggerScreenshot } = require('./lib/screenshot')

// ─── 用户操作入口（UI 调用）───

async function enableWatcher() {
  if (!state.config.folderId) {
    setLastError(ERROR_CODES.NO_FOLDER_SELECTED)
    setRuntimeStatus('error', ERROR_CODES.NO_FOLDER_SELECTED)
    scheduleRender()
    return false
  }
  saveConfig({ enabled: true })
  state.pollErrorCount = 0
  setRuntimeStatus('running')
  scheduleRender()

  // v1.4：backfill 主 folder 同步等待；其他活跃 folder（每个来源的专属）后台异步 backfill
  const activeIds = getActiveFolderIds(state.config)
  const mainId = state.config.folderId
  if (!state.hashSetByFolder.has(mainId)) {
    await backfillFolder(mainId)
  }
  for (const id of activeIds) {
    if (id === mainId) continue
    if (!state.hashSetByFolder.has(id)) {
      backfillFolder(id).catch(() => {})
    }
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
    if (state.config.enabled && state.config.folderId === next) startPolling()
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

// ─── Snapshot for UI ───

function getSnapshot() {
  rolloverTodayIfNeeded()
  const os = require('os')
  const retryRemainingMs = state.retryAt ? Math.max(0, state.retryAt - Date.now()) : 0
  return {
    config: state.config,
    folders: state.folders,
    folderLabel: state.config.folderId ? state.folderIndex.get(state.config.folderId) || null : null,
    todayCount: state.todayCount,
    lifetimeCount: state.lifetimeCount,
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
    effectiveIntervalMs: state.config ? getEffectiveIntervalMs() : 0,
  }
}

// ─── 暴露给 ui.js ───

/**
 * UI 模板预览专用：用当前 state 算一个示例名。
 * 不带任何副作用——专门为「实时预览」服务。
 */
function previewNameTemplate(template) {
  const ctx = buildNameContext({
    source: 'Screenshot',
    dims: '1920x1080',
    ts: new Date(),
  })
  return renderTemplate(template || DEFAULT_NAME_TEMPLATE, ctx)
}

window.ClipboardWatcher = {
  // 用户操作
  enableWatcher,
  disableWatcher,
  selectFolder,
  updateIntervalMs,
  triggerScreenshot,
  resetFolderIndex,
  openItem,
  // 配置
  saveConfig,
  buildDefaults,
  DEFAULT_NAME_TEMPLATE,
  previewNameTemplate,
  // 快照
  getSnapshot,
  // 内部访问（少数 UI 直接用）
  state,
}

// ─── Eagle 生命周期 ───

eagle.onPluginCreate(async () => {
  eagle.log.info('[clipboard-watcher] onPluginCreate (v1.3.0 modular)')

  // i18n 优先（影响后续报错文案）
  setLocale(detectLocale())

  // UI render 桥接：ui.js 加载后会写 window.ClipboardWatcherUI.render
  setRenderer(() => {
    if (window.ClipboardWatcherUI && typeof window.ClipboardWatcherUI.render === 'function') {
      window.ClipboardWatcherUI.render()
    }
  })

  rolloverTodayIfNeeded()
  loadConfig()
  loadStats()
  await refreshTheme()
  await refreshFolders()

  if (state.config.enabled && state.config.folderId) {
    setRuntimeStatus('running')
    scheduleRender()
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
  if (state.config && state.config.folderId) {
    backfillFolder(state.config.folderId).catch(() => {})
  }
})

bindThemeListener(() => scheduleRender())

if (typeof eagle.onPluginBeforeExit === 'function') {
  eagle.onPluginBeforeExit(() => stopPolling())
}
