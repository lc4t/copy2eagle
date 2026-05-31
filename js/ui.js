/*
 * Clipboard Watcher — ui.js
 *
 * 仅做 DOM 渲染与事件分发。状态与配置全在 window.ClipboardWatcher（plugin.js）。
 */

const ERROR_MESSAGES = {
  CONFIG_LOAD_FAILED: '之前的设置读不出来了，已经恢复默认设置。',
  CONFIG_SAVE_FAILED: '设置保存不上，过会儿再试。',
  FOLDER_FETCH_FAILED: '读不到 Eagle 的文件夹列表，确认 Eagle 还开着？',
  NO_FOLDER_SELECTED: '先选一个目标文件夹。',
  SCREENSHOT_UNSUPPORTED: '当前系统暂不支持「立即截图」按钮，请用系统截图（截图结果要进剪贴板）。',
  SCREENSHOT_FAILED: '截图调用失败，过会儿再试。',
  BACKFILL_FAILED: '检查文件夹里已有的图片时出错，本次仅按这次启动后的图片做去重。',
  POLL_FAILED: '暂时读不到剪贴板，5 秒后再试。',
  IMPORT_FAILED: '保存到 Eagle 失败，目标文件夹是不是被删了？',
  TMP_WRITE_FAILED: '写入临时文件失败，磁盘是不是满了？',
  UNKNOWN: '出错了，可以打开 Eagle 日志面板看看详情。',
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
  if (snapshot.indexing) {
    const { progress, total } = snapshot.indexing
    text.textContent = total > 0
      ? `正在整理文件夹内容 ${progress}/${total}`
      : '正在整理文件夹内容…'
  } else if (snapshot.runtimeStatus === 'running') {
    text.textContent = '正在运行'
  } else if (snapshot.runtimeStatus === 'error') {
    text.textContent = '出错了'
  } else {
    text.textContent = '未运行'
  }
  count.textContent = `今日已保存：${snapshot.todayCount} 张`
}

function renderError(snapshot) {
  const banner = $('cw-error-banner')
  if (snapshot.lastError) {
    let msg = ERROR_MESSAGES[snapshot.lastError] || ERROR_MESSAGES.UNKNOWN
    if (snapshot.retryRemainingSec > 0 && snapshot.lastError === 'POLL_FAILED') {
      msg = `暂时读不到剪贴板，${snapshot.retryRemainingSec} 秒后再试`
    }
    banner.textContent = msg
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
  placeholder.textContent = snapshot.folders.length ? '请选择文件夹…' : '（Eagle 里还没有文件夹）'
  select.appendChild(placeholder)

  for (const f of snapshot.folders) {
    const opt = document.createElement('option')
    opt.value = f.id
    opt.textContent = f.label
    if (f.id === current) opt.selected = true
    select.appendChild(opt)
  }

  if (!snapshot.folders.length) {
    hint.textContent = '没看到任何文件夹。确认 Eagle 已打开，并至少有一个文件夹。'
  } else if (!current) {
    hint.textContent = '选择文件夹后才能开始自动保存'
  } else {
    hint.textContent = `保存到：${snapshot.folderLabel || current}`
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
    hint.textContent = 'Windows 请用 Win+Shift+S 截图，打开「自动保存」后会自动出现在 Eagle'
  } else if (!snapshot.config.folderId) {
    hint.textContent = '先选好文件夹，截图就能自动出现在 Eagle'
  } else if (!snapshot.config.enabled) {
    hint.textContent = '截图会先进剪贴板，打开上面的「自动保存」开关后会进 Eagle'
  } else {
    hint.textContent = '点一下选区，截图自动出现在 Eagle'
  }
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)} 秒`
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
  $('cw-mixed').checked = !!snapshot.config.importMixedContent
  $('cw-multi-file').checked = !!snapshot.config.importMultipleFiles

  const resetBtn = $('cw-reset-index')
  resetBtn.disabled = !snapshot.config.folderId || !!snapshot.indexing
  if (snapshot.indexing) {
    resetBtn.textContent = `正在整理 ${snapshot.indexing.progress}/${snapshot.indexing.total || '…'}`
  } else {
    resetBtn.textContent = '刷新已保存记录'
  }

  const multiHint = $('cw-multi-file-hint')
  if (snapshot.platform !== 'darwin' && snapshot.platform !== 'win32') {
    multiHint.textContent = '此功能仅在 macOS / Windows 可用'
  } else if (snapshot.platform === 'darwin') {
    multiHint.textContent = '在 Finder 中选中多张图片 Cmd+C，一次性全部进 Eagle（最多 50 张）'
  } else {
    multiHint.textContent = '在资源管理器中选中多张图片 Ctrl+C，一次性全部进 Eagle（最多 50 张）'
  }
}

function renderRecent(snapshot) {
  const box = $('cw-recent')
  const list = snapshot.recentImports && snapshot.recentImports.length
    ? snapshot.recentImports
    : []
  if (!list.length) {
    box.classList.add('cw-recent-empty')
    box.classList.remove('cw-recent-list')
    box.textContent = '尚无导入记录'
    return
  }
  box.classList.remove('cw-recent-empty')
  box.classList.add('cw-recent-list')
  box.innerHTML = ''
  for (const entry of list) {
    const card = document.createElement('div')
    card.className = 'cw-recent-card'

    const title = document.createElement('div')
    title.className = 'cw-recent-title'
    title.textContent = entry.name
    card.appendChild(title)

    const meta = document.createElement('div')
    meta.className = 'cw-recent-meta'
    meta.textContent = `${entry.importedAt} → ${entry.folderLabel || '—'}`
    card.appendChild(meta)

    box.appendChild(card)
  }
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
    $('cw-interval-value').textContent = `${sec.toFixed(1)} 秒`
  })
  $('cw-interval').addEventListener('change', (e) => {
    const ms = Math.round(Number(e.target.value) * 1000)
    safeAction('intervalMs', () => CW.updateIntervalMs(ms))
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

  $('cw-mixed').addEventListener('change', (e) => {
    safeAction('importMixedContent', () => CW.saveConfig({ importMixedContent: e.target.checked }))
  })

  $('cw-multi-file').addEventListener('change', (e) => {
    safeAction('importMultipleFiles', () => CW.saveConfig({ importMultipleFiles: e.target.checked }))
  })

  $('cw-reset-index').addEventListener('click', () => {
    safeAction('resetIndex', () => CW.resetFolderIndex())
  })
}

window.ClipboardWatcherUI = { render }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindEvents)
} else {
  bindEvents()
}
