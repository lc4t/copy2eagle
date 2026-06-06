/*
 * lib/state.js — 全局可变状态 + 受控 mutator
 *
 * 设计原则：
 *   - 外部模块只能通过本模块导出的 setter / mutator 改 state
 *   - getSnapshot 返回快照（浅拷贝 + 派生字段）供 UI 渲染
 *   - state 本体也 export，但仅供 plugin.js 编排器读（写要走 mutator）
 *
 * @typedef {Object} RecentImport
 * @property {string} name
 * @property {string} folderLabel
 * @property {string} importedAt
 * @property {'screenshot'|'clipboard'|'files'} source
 * @property {string} dims
 * @property {string|null} itemId
 *
 * @typedef {Object} PluginState
 * @property {Object} config
 * @property {Array<{id:string,label:string}>} folders
 * @property {Map<string,string>} folderIndex
 * @property {number} todayCount
 * @property {string|null} todayDate
 * @property {RecentImport|null} lastImport
 * @property {string|null} lastError
 * @property {'idle'|'running'|'error'} runtimeStatus
 * @property {string} theme
 */

const { RECENT_IMPORTS_CAP } = require('./constants')

/** @type {PluginState} */
const state = {
  // 用 buildDefaults 填一份；config.js 启动时再 load
  config: null,
  folders: [],
  folderIndex: new Map(),
  todayCount: 0,
  todayDate: null,
  lastImport: null,
  lastError: null,
  runtimeStatus: 'idle', // 'idle' | 'running' | 'error'
  theme: 'LIGHT',

  // 去重相关
  hashSetByFolder: new Map(),
  lastClipboardHash: null,
  lastClipboardAt: 0,
  lastFormatsKey: null,

  // 索引相关
  indexingFolderId: null,
  indexingProgress: 0,
  indexingTotal: 0,

  // 错误 / 重试
  pollErrorCount: 0,
  retryAt: 0,

  // 文件夹回填节流
  lastBackfillAt: new Map(),

  // 截图按钮 → import 命名联动
  lastScreenshotAt: 0,

  // 多文件去重
  lastFileBatchKey: null,

  // adaptive polling
  sameHashStreak: 0,
  adaptiveMode: 'normal', // 'normal' | 'idle'

  // 最近导入
  recentImports: [],

  // 全期计数（v1.4）：跨 session 持久化的"保存总数"
  lifetimeCount: 0,

  // 双实例检测（v1.5.2 / M16）
  instanceId: null,
  instanceConflict: null, // { otherInstanceId, otherVersion } | null
  lastHeartbeatAt: 0,
}

// 全期计数独立 localStorage key，与 config 解耦
const STATS_KEY = 'clipboardWatcher.stats'

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY)
    if (raw) {
      const obj = JSON.parse(raw)
      if (typeof obj.lifetimeCount === 'number' && obj.lifetimeCount >= 0) {
        state.lifetimeCount = obj.lifetimeCount
      }
    }
  } catch {
    state.lifetimeCount = 0
  }
}

function saveStats() {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify({ lifetimeCount: state.lifetimeCount }))
  } catch {
    // 静默：stats 写失败不影响主流程
  }
}

// ─── render 桥接：plugin.js 启动时塞进来 ───
let renderFn = null
function setRenderer(fn) {
  renderFn = typeof fn === 'function' ? fn : null
}
function scheduleRender() {
  if (renderFn) renderFn()
}

// ─── 受控 mutator ───
function rolloverTodayIfNeeded() {
  const today = new Date().toISOString().slice(0, 10)
  if (state.todayDate !== today) {
    state.todayDate = today
    state.todayCount = 0
  }
}

function setRuntimeStatus(status, errorCode) {
  state.runtimeStatus = status
  if (status === 'error') {
    state.lastError = errorCode || state.lastError || 'UNKNOWN'
  } else if (status === 'running') {
    state.lastError = null
  }
}

function setLastError(code) {
  state.lastError = code
}

function clearLastError() {
  state.lastError = null
}

function pushRecentImport(entry) {
  state.recentImports.unshift(entry)
  if (state.recentImports.length > RECENT_IMPORTS_CAP) {
    state.recentImports.length = RECENT_IMPORTS_CAP
  }
  state.lastImport = entry
}

function incrementToday() {
  rolloverTodayIfNeeded()
  state.todayCount += 1
  state.lifetimeCount += 1
  saveStats()
}

module.exports = {
  state,
  setRenderer,
  scheduleRender,
  rolloverTodayIfNeeded,
  setRuntimeStatus,
  setLastError,
  clearLastError,
  pushRecentImport,
  incrementToday,
  loadStats,
  saveStats,
}
