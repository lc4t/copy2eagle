/*
 * lib/screenshot.js — 截图按钮触发（macOS `screencapture -ic` → 剪贴板，K11）
 */

const os = require('os')
const { execFile } = require('child_process')

const { ERROR_CODES } = require('./constants')
const { state, scheduleRender, setLastError } = require('./state')

/**
 * 调用 macOS screencapture -ic：interactive 选区 → 剪贴板
 * 截图后由剪贴板轮询自动接力导入。设置 lastScreenshotAt 标记，
 * 让随后的导入命名为 Screenshot。
 */
function triggerScreenshot() {
  if (os.platform() !== 'darwin') {
    setLastError(ERROR_CODES.SCREENSHOT_UNSUPPORTED)
    scheduleRender()
    return Promise.resolve(false)
  }
  return new Promise((resolve) => {
    execFile('screencapture', ['-ic'], (err) => {
      if (err) {
        eagle.log.error(`[clipboard-watcher] screencapture failed: ${err.message}`)
        setLastError(ERROR_CODES.SCREENSHOT_FAILED)
        scheduleRender()
        resolve(false)
        return
      }
      state.lastScreenshotAt = Date.now()
      eagle.log.info('[clipboard-watcher] screencapture done; awaiting clipboard pickup')
      resolve(true)
    })
  })
}

module.exports = { triggerScreenshot }
