/*
 * lib/clipboard.js — 剪贴板探测 + macOS/Windows 文件路径读取
 *
 * Eagle 只暴露 has(format) + readImage()，无 availableFormats / changeCount（K13）。
 * 这里实现 has() 多 format 候选探测 + shell-out 读取文件 URL 列表（K14）。
 */

const os = require('os')
const path = require('path')
const { execFile } = require('child_process')

const {
  IMAGE_FORMAT_CANDIDATES,
  FILE_URL_FORMAT_CANDIDATES,
  TEXT_FORMAT_CANDIDATES,
  IMAGE_FILE_EXTS,
  MULTI_FILE_MAX,
  SHELL_TIMEOUT_MS,
} = require('./constants')

/**
 * 探测剪贴板里第一个匹配的图片 format。
 * @returns {{available:boolean, format:string|null}}
 */
function probeImageFormat() {
  if (!eagle.clipboard || typeof eagle.clipboard.has !== 'function') {
    return { available: false, format: null }
  }
  for (const fmt of IMAGE_FORMAT_CANDIDATES) {
    try {
      if (eagle.clipboard.has(fmt)) return { available: true, format: fmt }
    } catch {
      // 不识别的 format 字符串 has() 可能抛错，忽略继续
    }
  }
  return { available: true, format: null }
}

function probeAnyFormat(candidates) {
  if (!eagle.clipboard || typeof eagle.clipboard.has !== 'function') return false
  for (const fmt of candidates) {
    try {
      if (eagle.clipboard.has(fmt)) return true
    } catch {}
  }
  return false
}

function parsePathList(stdout) {
  if (typeof stdout !== 'string') return []
  return stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MULTI_FILE_MAX)
}

/**
 * 读取剪贴板里的文件路径列表。
 * macOS 使用 osascript，Windows 使用系统自带 PowerShell。
 */
function readClipboardFilePaths(options = {}) {
  return new Promise((resolve) => {
    const platform = options.platform || os.platform()
    const runFile = options.execFile || execFile

    if (platform === 'win32') {
      const script =
        "$ErrorActionPreference='SilentlyContinue';" +
        " Get-Clipboard -Format FileDropList |" +
        ' ForEach-Object { $_.FullName }'
      runFile(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', script],
        { timeout: SHELL_TIMEOUT_MS },
        (err, stdout) => {
          if (err) {
            eagle.log.warn(`[clipboard-watcher] powershell failed: ${err.message}`)
            resolve([])
            return
          }
          resolve(parsePathList(stdout))
        }
      )
      return
    }

    if (platform !== 'darwin') {
      resolve([])
      return
    }

    const script =
      'try\n' +
      '  set theItems to the clipboard as «class furl»\n' +
      'on error\n' +
      '  return ""\n' +
      'end try\n' +
      'set thePaths to {}\n' +
      'try\n' +
      '  repeat with f in theItems\n' +
      '    set end of thePaths to POSIX path of f\n' +
      '  end repeat\n' +
      'on error\n' +
      '  try\n' +
      '    set end of thePaths to POSIX path of theItems\n' +
      '  end try\n' +
      'end try\n' +
      'set AppleScript\'s text item delimiters to linefeed\n' +
      'return thePaths as text'
    runFile(
      'osascript',
      ['-e', script],
      { timeout: SHELL_TIMEOUT_MS },
      (err, stdout) => {
        if (err) {
          eagle.log.warn(`[clipboard-watcher] osascript failed: ${err.message}`)
          resolve([])
          return
        }
        resolve(parsePathList(stdout))
      }
    )
  })
}

function isImagePath(p) {
  if (typeof p !== 'string') return false
  return IMAGE_FILE_EXTS.has(path.extname(p).toLowerCase())
}

module.exports = {
  probeImageFormat,
  probeAnyFormat,
  readClipboardFilePaths,
  parsePathList,
  isImagePath,
  // 重新导出常量便于其他模块少 import 一次
  IMAGE_FORMAT_CANDIDATES,
  FILE_URL_FORMAT_CANDIDATES,
  TEXT_FORMAT_CANDIDATES,
}
