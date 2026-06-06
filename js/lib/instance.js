/*
 * lib/instance.js — 双实例检测（心跳锁，v1.5.2 / M16）
 *
 * 场景：Eagle 没按 manifest.id 去重，导致用户依次装了 v1 + v2 时
 *      两个 serviceMode 实例同时跑，互相抢剪贴板 → Eagle 自己抛 duplicate 警告。
 *
 * 机制：
 *   1) 每个实例启动时生成随机 instanceId（plugin.js initInstance）
 *   2) 每轮轮询前先 read localStorage[HEARTBEAT_KEY]：
 *      - 看到别人的 instanceId 且 ts < 3s → 视为冲突，跳过本轮 import，UI 提示
 *      - 否则 clear 冲突态、继续 import
 *   3) 每轮轮询末尾 write 自己的 heartbeat（ts=now）
 *   4) 一个被用户删掉/重启后，另一个会在下一轮 poll 自动恢复
 *
 * 假设：Eagle 让同 id 的多实例共享 localStorage origin。若不共享，本机制
 *      退化为无害 no-op（每个实例只看到自己的 heartbeat）；用户仍可走文档
 *      指引手动清理 Eagle 插件管理。
 */

const { state } = require('./state')

const HEARTBEAT_KEY = 'clipboardWatcher.heartbeat'
const HEARTBEAT_FRESH_MS = 3000
// 与 manifest.json / package.json 同步——bundler 不会动它，需手动 bump
const PLUGIN_VERSION = '1.5.2'

function genInstanceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function initInstance() {
  if (!state.instanceId) {
    state.instanceId = genInstanceId()
    eagle.log.info(`[clipboard-watcher] instance ${state.instanceId} v${PLUGIN_VERSION}`)
  }
}

/**
 * 写自己的心跳到 localStorage。失败静默（隐私模式 / 磁盘满都不该闪烁）。
 */
function writeHeartbeat() {
  if (!state.instanceId) return
  try {
    localStorage.setItem(
      HEARTBEAT_KEY,
      JSON.stringify({
        instanceId: state.instanceId,
        ts: Date.now(),
        version: PLUGIN_VERSION,
      })
    )
    state.lastHeartbeatAt = Date.now()
  } catch {}
}

/**
 * 检测是否有另一个新鲜实例在跑。
 * @returns {{otherInstanceId:string, otherVersion:string} | null}
 */
function checkConflict() {
  if (!state.instanceId) return null
  try {
    const raw = localStorage.getItem(HEARTBEAT_KEY)
    if (!raw) return null
    const hb = JSON.parse(raw)
    if (!hb || typeof hb !== 'object' || !hb.instanceId) return null
    if (hb.instanceId === state.instanceId) return null // 自己的
    if (Date.now() - (hb.ts || 0) < HEARTBEAT_FRESH_MS) {
      return {
        otherInstanceId: hb.instanceId,
        otherVersion: hb.version || 'unknown',
      }
    }
    return null // 过期残留
  } catch {
    return null
  }
}

module.exports = { initInstance, writeHeartbeat, checkConflict, PLUGIN_VERSION }
