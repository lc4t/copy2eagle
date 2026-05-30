/*
 * Clipboard Watcher — ui.js
 *
 * 仅做 DOM 渲染与事件分发。状态与配置全在 window.ClipboardWatcher（plugin.js）。
 */

const ERROR_MESSAGES = {
  CONFIG_LOAD_FAILED: '配置读取失败，已重置为默认值。',
  CONFIG_SAVE_FAILED: '配置保存失败，请稍后重试。',
  FOLDER_FETCH_FAILED: '无法获取 Eagle 文件夹列表，请确认 Eagle 正在运行。',
  NO_FOLDER_SELECTED: '请先选择目标文件夹。',
  SCREENSHOT_UNSUPPORTED: '当前系统暂不支持「立即截图」按钮，请使用系统截图工具（结果需进剪贴板）。',
  SCREENSHOT_FAILED: '调用系统截图工具失败，请稍后重试。',
  UNKNOWN: '发生未知错误，请查看 Eagle 日志面板。',
}

function $(id) {
  return document.getElementById(id)
}

function applyTheme(snapshot) {
  document.documentElement.setAttribute('data-theme', snapshot.isDark ? 'dark' : 'light')
}

function renderStatus(snapshot) {
  const dot = $('cw-status-dot')
  const text = $('cw-status-text')
  const count = $('cw-status-count')
  dot.dataset.status = snapshot.runtimeStatus
  if (snapshot.runtimeStatus === 'running') {
    text.textContent = '监听中'
  } else if (snapshot.runtimeStatus === 'error') {
    text.textContent = '出错'
  } else {
    text.textContent = '已停止'
  }
  count.textContent = `今日导入：${snapshot.todayCount}`
}

function renderError(snapshot) {
  const banner = $('cw-error-banner')
  if (snapshot.lastError) {
    banner.textContent = ERROR_MESSAGES[snapshot.lastError] || ERROR_MESSAGES.UNKNOWN
    banner.dataset.visible = 'true'
  } else {
    banner.textContent = ''
    banner.dataset.visible = 'false'
  }
}

function renderFolders(snapshot) {
  const select = $('cw-folder')
  const hint = $('cw-folder-hint')
  const current = snapshot.config.folderId || ''
  select.innerHTML = ''

  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = snapshot.folders.length ? '请选择文件夹…' : '（无可用文件夹）'
  select.appendChild(placeholder)

  for (const f of snapshot.folders) {
    const opt = document.createElement('option')
    opt.value = f.id
    opt.textContent = f.label
    if (f.id === current) opt.selected = true
    select.appendChild(opt)
  }

  if (!snapshot.folders.length) {
    hint.textContent = '未获取到文件夹。请确认 Eagle 已打开且至少存在一个文件夹。'
  } else if (!current) {
    hint.textContent = '未选择文件夹时无法开启监听'
  } else {
    hint.textContent = `当前目标：${snapshot.folderLabel || current}`
  }
}

function renderToggle(snapshot) {
  const toggle = $('cw-enabled')
  toggle.checked = !!snapshot.config.enabled
  toggle.disabled = !snapshot.config.folderId
}

function renderScreenshotButton(snapshot) {
  const btn = $('cw-screenshot')
  const hint = $('cw-screenshot-hint')
  const macSupported = snapshot.platform === 'darwin'
  btn.disabled = !macSupported || !snapshot.config.folderId
  if (!macSupported) {
    hint.textContent = 'Windows：请用 Win+Shift+S 截图（结果会自动进剪贴板，监听开启后自动导入）'
  } else if (!snapshot.config.folderId) {
    hint.textContent = '选择目标文件夹后即可点击截图（结果自动进剪贴板，监听开启时自动入库）'
  } else if (!snapshot.config.enabled) {
    hint.textContent = '截图将进入剪贴板，开启监听后才会自动入库'
  } else {
    hint.textContent = '点击后选择区域截图，结果自动进剪贴板并入库'
  }
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)} s`
}

function renderAdvanced(snapshot) {
  const intervalSec = snapshot.config.intervalMs / 1000
  $('cw-interval').value = intervalSec
  $('cw-interval-value').textContent = formatSeconds(snapshot.config.intervalMs)

  const tagsInput = $('cw-tags')
  tagsInput.value = snapshot.config.tags
  tagsInput.placeholder = snapshot.defaults.tags

  const radios = document.getElementsByName('cw-duplicate')
  for (const r of radios) {
    r.checked = r.value === snapshot.config.duplicateStrategy
  }

  $('cw-notify').checked = !!snapshot.config.notifyOnImport
}

function renderRecent(snapshot) {
  const box = $('cw-recent')
  if (!snapshot.lastImport) {
    box.textContent = '尚无导入记录'
    return
  }
  const { name, folderLabel, importedAt } = snapshot.lastImport
  box.textContent = `${importedAt} · ${name} → ${folderLabel || '—'}`
}

function render() {
  const CW = window.ClipboardWatcher
  if (!CW) return
  const snapshot = CW.getSnapshot()
  applyTheme(snapshot)
  renderStatus(snapshot)
  renderError(snapshot)
  renderFolders(snapshot)
  renderToggle(snapshot)
  renderScreenshotButton(snapshot)
  renderAdvanced(snapshot)
  renderRecent(snapshot)
}

async function safeAction(label, fn) {
  const CW = window.ClipboardWatcher
  try {
    await fn()
  } catch (err) {
    eagle.log.error(`[clipboard-watcher] ui action "${label}" failed: ${err && err.message ? err.message : err}`)
    if (CW && !CW.state.lastError) CW.state.lastError = 'UNKNOWN'
  } finally {
    render()
  }
}

function bindEvents() {
  const CW = window.ClipboardWatcher
  if (!CW) return

  $('cw-folder').addEventListener('change', (e) => {
    safeAction('selectFolder', () => CW.selectFolder(e.target.value || null))
  })

  $('cw-enabled').addEventListener('change', (e) => {
    safeAction('toggleEnabled', () => {
      if (e.target.checked) {
        CW.enableWatcher()
      } else {
        CW.disableWatcher()
      }
    })
  })

  $('cw-screenshot').addEventListener('click', () => {
    safeAction('screenshot', () => CW.triggerScreenshot())
  })

  $('cw-interval').addEventListener('input', (e) => {
    const sec = Number(e.target.value)
    $('cw-interval-value').textContent = `${sec.toFixed(1)} s`
  })
  $('cw-interval').addEventListener('change', (e) => {
    const ms = Math.round(Number(e.target.value) * 1000)
    safeAction('intervalMs', () => CW.saveConfig({ intervalMs: ms }))
  })

  $('cw-tags').addEventListener('change', (e) => {
    safeAction('tags', () => CW.saveConfig({ tags: e.target.value }))
  })

  for (const r of document.getElementsByName('cw-duplicate')) {
    r.addEventListener('change', (e) => {
      if (e.target.checked) {
        safeAction('duplicateStrategy', () => CW.saveConfig({ duplicateStrategy: e.target.value }))
      }
    })
  }

  $('cw-notify').addEventListener('change', (e) => {
    safeAction('notifyOnImport', () => CW.saveConfig({ notifyOnImport: e.target.checked }))
  })
}

window.ClipboardWatcherUI = { render }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindEvents)
} else {
  bindEvents()
}
