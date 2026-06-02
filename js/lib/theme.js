/*
 * lib/theme.js — Eagle 主题适配（K8，v1.2.0 修了 LIGHTGRAY 误判 bug）
 *
 * Eagle 主题取值：'Auto' | 'LIGHT' | 'LIGHTGRAY' | 'GRAY' | 'DARK' | 'BLUE' | 'PURPLE'
 * dark 系列只含 GRAY / DARK / BLUE / PURPLE；LIGHTGRAY 含 GRAY 子串但属于浅色，
 * 必须用精确 Set 而非正则匹配。
 */

const { state } = require('./state')

const DARK_THEMES = new Set(['GRAY', 'DARK', 'BLUE', 'PURPLE'])

function isDarkTheme() {
  const t = String(state.theme || '').toUpperCase()
  return DARK_THEMES.has(t)
}

async function refreshTheme() {
  try {
    state.theme = await eagle.app.theme
  } catch {
    state.theme = 'LIGHT'
  }
  return state.theme
}

function bindThemeListener(onChange) {
  if (typeof eagle.onThemeChanged === 'function') {
    eagle.onThemeChanged((theme) => {
      state.theme = theme
      if (typeof onChange === 'function') onChange(theme)
    })
  }
}

module.exports = { DARK_THEMES, isDarkTheme, refreshTheme, bindThemeListener }
