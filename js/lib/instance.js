/*
 * lib/instance.js — 双实例检测（单 owner lease，v1.5.3 / M17）
 *
 * 场景：Eagle 没按 manifest.id 去重，导致用户依次装了 v1 + v2 时
 *      两个 serviceMode 实例同时跑，互相抢剪贴板 → Eagle 自己抛 duplicate 警告。
 *
 * 机制：
 *   1) 每个实例启动时生成随机 instanceId（plugin.js initInstance）
 *   2) 每轮轮询开始时 acquire/renew：
 *      - 新鲜 lease 属于别人 → 只观察，不覆盖，跳过本轮 import
 *      - lease 不存在 / 已过期 / 属于自己 → 写入自己的 lease 并继续
 *   3) 停用或退出时，仅 owner 删除自己的 lease
 *   4) owner 消失后 lease 过期，另一个实例自动接管
 *
 * 假设：Eagle 让同 id 的多实例共享 localStorage origin。若不共享，本机制
 *      退化为无害 no-op（每个实例只看到自己的 heartbeat）；用户仍可走文档
 *      指引手动清理 Eagle 插件管理。
 */

const { state } = require('./state')

// 新协议单独用 v2 key；旧 v1.5.2 只会抢写 heartbeat，不能污染新 owner 选举。
const LEASE_KEY = 'clipboardWatcher.lease.v2'
const LEGACY_HEARTBEAT_KEY = 'clipboardWatcher.heartbeat'
// 覆盖最大 5s adaptive interval + 5s error retry，并留出调度抖动空间。
const LEASE_TTL_MS = 12000
const LEASE_RENEW_MS = 2000
const LEGACY_GUARD_MS = 200
// 与 manifest.json / package.json 同步——bundler 不会动它，需手动 bump
const PLUGIN_VERSION = '1.5.6'
let leaseTimer = null
let legacyGuardTimer = null

function genInstanceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function initInstance() {
  if (!state.instanceId) {
    state.instanceId = genInstanceId()
    eagle.log.info(`[clipboard-watcher] instance ${state.instanceId} v${PLUGIN_VERSION}`)
  }
}

function readRecord(key) {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  const record = JSON.parse(raw)
  if (!record || typeof record !== 'object' || !record.instanceId) return null
  return record
}

function toConflict(lease) {
  return {
    otherInstanceId: lease.instanceId,
    otherVersion: lease.version || 'unknown',
  }
}

/**
 * 获取或续租单 owner lease。
 * localStorage 不可用时 fail-open，避免锁实现本身让插件停止工作。
 * 新 lease 首次写入后先等待一轮再工作，避免两个实例同时启动时都通过首次检查。
 * @returns {{owned:boolean, conflict:{otherInstanceId:string,otherVersion:string}|null}}
 */
function acquireLease(now) {
  if (!state.instanceId) return { owned: true, conflict: null }
  const currentTime = typeof now === 'number' ? now : Date.now()
  try {
    const current = readRecord(LEASE_KEY)
    const isFresh = current && currentTime - Number(current.ts || 0) < LEASE_TTL_MS
    if (isFresh && current.instanceId !== state.instanceId) {
      return { owned: false, conflict: toConflict(current) }
    }

    const next = JSON.stringify({
      instanceId: state.instanceId,
      ts: currentTime,
      version: PLUGIN_VERSION,
    })
    localStorage.setItem(LEASE_KEY, next)
    // 兼容 v1.5.2：旧实例看到这个 heartbeat 后会停止导入。
    // 即使旧实例反向覆盖，也不会影响 v2 lease 的 owner 选举。
    localStorage.setItem(LEGACY_HEARTBEAT_KEY, next)
    state.lastHeartbeatAt = currentTime

    if (!isFresh || !current) {
      return { owned: false, conflict: null }
    }

    // setItem 是同步的；回读可防御同一事件循环中被其他实例抢写。
    const confirmed = readRecord(LEASE_KEY)
    if (confirmed && confirmed.instanceId !== state.instanceId) {
      return { owned: false, conflict: toConflict(confirmed) }
    }

    return { owned: true, conflict: null }
  } catch {
    return { owned: true, conflict: null }
  }
}

function releaseLease() {
  if (!state.instanceId) return
  try {
    const current = readRecord(LEASE_KEY)
    if (current && current.instanceId === state.instanceId) {
      localStorage.removeItem(LEASE_KEY)
    }
    const legacy = readRecord(LEGACY_HEARTBEAT_KEY)
    if (legacy && legacy.instanceId === state.instanceId) {
      localStorage.removeItem(LEGACY_HEARTBEAT_KEY)
    }
  } catch {}
}

function guardLegacyHeartbeat(now) {
  if (!state.instanceId) return false
  const currentTime = typeof now === 'number' ? now : Date.now()
  try {
    const lease = readRecord(LEASE_KEY)
    const ownsFreshLease = lease &&
      lease.instanceId === state.instanceId &&
      currentTime - Number(lease.ts || 0) < LEASE_TTL_MS
    if (!ownsFreshLease) return false

    const legacy = readRecord(LEGACY_HEARTBEAT_KEY)
    if (legacy && legacy.instanceId === state.instanceId) return true
    localStorage.setItem(LEGACY_HEARTBEAT_KEY, JSON.stringify({
      instanceId: state.instanceId,
      ts: currentTime,
      version: PLUGIN_VERSION,
    }))
    return true
  } catch {
    return false
  }
}

function startLeaseMaintenance() {
  if (leaseTimer || legacyGuardTimer) return
  acquireLease()
  leaseTimer = setInterval(() => acquireLease(), LEASE_RENEW_MS)
  legacyGuardTimer = setInterval(() => guardLegacyHeartbeat(), LEGACY_GUARD_MS)
}

function stopLeaseMaintenance() {
  if (leaseTimer) {
    clearInterval(leaseTimer)
    leaseTimer = null
  }
  if (legacyGuardTimer) {
    clearInterval(legacyGuardTimer)
    legacyGuardTimer = null
  }
}

module.exports = {
  initInstance,
  acquireLease,
  releaseLease,
  guardLegacyHeartbeat,
  startLeaseMaintenance,
  stopLeaseMaintenance,
  PLUGIN_VERSION,
  LEASE_TTL_MS,
}
