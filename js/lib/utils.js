/*
 * lib/utils.js — 纯函数小工具，无副作用
 */

const os = require('os')

function pad(n) {
  return String(n).padStart(2, '0')
}

function nowStamp(d) {
  const t = d || new Date()
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`
}

function tmpFileStamp(d) {
  const t = d || new Date()
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}-${pad(t.getHours())}${pad(t.getMinutes())}${pad(t.getSeconds())}-${String(t.getMilliseconds()).padStart(3, '0')}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 轻量 hash：长度 + 前 256 字节 base64 前 32 字符
 * 不用 crypto 库，足够区分剪贴板里的图（去重用，非安全场景）。
 */
function computeHash(buffer) {
  if (!buffer || typeof buffer.length !== 'number') return null
  const len = buffer.length
  const prefix = buffer.slice(0, 256).toString('base64').slice(0, 32)
  return `${len}_${prefix}`
}

function getHostname() {
  try {
    const h = os.hostname()
    return typeof h === 'string' && h ? h : ''
  } catch {
    return ''
  }
}

function parseTags(input) {
  if (typeof input !== 'string') return []
  return input
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

/**
 * 命名模板渲染器（v1.5 / F13）。
 * 用法：renderTemplate('{source} {dims} {timestamp}', { source: 'Screenshot', dims: '1920x1080', timestamp: '...' })
 * - 空值 token 替换为空串后做 whitespace 合并
 * - 末尾去空白
 * - 缺失 token 当空处理（不抛错）
 *
 * 支持的 token 由调用方提供，不在此处硬编码。
 */
function renderTemplate(template, ctx) {
  if (typeof template !== 'string' || !template.trim()) return ''
  const safe = ctx && typeof ctx === 'object' ? ctx : {}
  return template
    .replace(/\{(\w+)\}/g, (_, key) => {
      const v = safe[key]
      return v == null ? '' : String(v)
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function shortDate(d) {
  const t = d || new Date()
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
}

function shortTime(d) {
  const t = d || new Date()
  return `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`
}

module.exports = {
  pad,
  nowStamp,
  tmpFileStamp,
  sleep,
  computeHash,
  getHostname,
  parseTags,
  renderTemplate,
  shortDate,
  shortTime,
}
