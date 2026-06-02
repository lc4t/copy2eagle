/*
 * ui.js — DOM 渲染 + 事件分发（v1.3.0：接 i18n）
 *
 * 不持状态，只读 ClipboardWatcher.getSnapshot()，写通过 CW.xxx 方法回传。
 */

const { t } = require('./lib/i18n')

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
      ? t('status.indexing_with_total', null, progress, total)
      : t('status.indexing')
  } else if (snapshot.runtimeStatus === 'running') {
    text.textContent = t('status.running')
  } else if (snapshot.runtimeStatus === 'error') {
    text.textContent = t('status.error')
  } else {
    text.textContent = t('status.idle')
  }
  count.textContent = t('status.today_count', null, snapshot.todayCount)
}

function renderError(snapshot) {
  const banner = $('cw-error-banner')
  if (snapshot.lastError) {
    let msg = t(`errors.${snapshot.lastError}`, t('errors.UNKNOWN'))
    if (snapshot.retryRemainingSec > 0 && snapshot.lastError === 'POLL_FAILED') {
      msg = t('status.retry_in', null, snapshot.retryRemainingSec)
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
  placeholder.textContent = snapshot.folders.length
    ? t('fields.folder_placeholder_select')
    : t('fields.folder_placeholder_empty')
  select.appendChild(placeholder)

  for (const f of snapshot.folders) {
    const opt = document.createElement('option')
    opt.value = f.id
    opt.textContent = f.label
    if (f.id === current) opt.selected = true
    select.appendChild(opt)
  }

  if (!snapshot.folders.length) {
    hint.textContent = t('fields.folder_hint_empty')
  } else if (!current) {
    hint.textContent = t('fields.folder_hint_pick')
  } else {
    hint.textContent = t('fields.folder_hint_current', null, snapshot.folderLabel || current)
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
    hint.textContent = t('fields.screenshot_hint_win')
  } else if (!snapshot.config.folderId) {
    hint.textContent = t('fields.screenshot_hint_no_folder')
  } else if (!snapshot.config.enabled) {
    hint.textContent = t('fields.screenshot_hint_not_running')
  } else {
    hint.textContent = t('fields.screenshot_hint_running')
  }
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)} ${t('fields.interval_unit')}`
}

function renderAdvanced(snapshot) {
  const intervalSec = snapshot.config.intervalMs / 1000
  $('cw-interval').value = intervalSec
  $('cw-interval-value').textContent = formatSeconds(snapshot.config.intervalMs)

  const tagsInput = $('cw-tags')
  tagsInput.value = snapshot.config.tags
  tagsInput.placeholder = snapshot.defaults.tags

  const radios = document.getElementsByName('cw-duplicate')
  for (const r of radios) r.checked = r.value === snapshot.config.duplicateStrategy

  $('cw-notify').checked = !!snapshot.config.notifyOnImport
  $('cw-mixed').checked = !!snapshot.config.importMixedContent
  $('cw-multi-file').checked = !!snapshot.config.importMultipleFiles

  const resetBtn = $('cw-reset-index')
  resetBtn.disabled = !snapshot.config.folderId || !!snapshot.indexing
  if (snapshot.indexing) {
    resetBtn.textContent = t('fields.reset_index_indexing', null, snapshot.indexing.progress, snapshot.indexing.total)
  } else {
    resetBtn.textContent = t('fields.reset_index_default')
  }

  const multiHint = $('cw-multi-file-hint')
  if (snapshot.platform === 'darwin') multiHint.textContent = t('fields.multi_file_hint_mac')
  else if (snapshot.platform === 'win32') multiHint.textContent = t('fields.multi_file_hint_win')
  else if (snapshot.platform === 'linux') multiHint.textContent = t('fields.multi_file_hint_linux')
  else multiHint.textContent = t('fields.multi_file_hint_unknown')
}

function renderRecent(snapshot) {
  const CW = window.ClipboardWatcher
  const box = $('cw-recent')
  const list = snapshot.recentImports && snapshot.recentImports.length ? snapshot.recentImports : []
  if (!list.length) {
    box.classList.add('cw-recent-empty')
    box.classList.remove('cw-recent-list')
    box.textContent = t('fields.recent_empty')
    return
  }
  box.classList.remove('cw-recent-empty')
  box.classList.add('cw-recent-list')
  box.innerHTML = ''
  for (const entry of list) {
    const card = document.createElement('div')
    card.className = 'cw-recent-card'
    if (entry.itemId) {
      card.classList.add('cw-recent-card-clickable')
      card.title = t('fields.recent_open_in_eagle')
      card.addEventListener('click', () => {
        if (CW && typeof CW.openItem === 'function') {
          safeAction('openItem', () => CW.openItem(entry.itemId))
        }
      })
    }
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

function renderStaticLabels() {
  // 静态文案：只渲染一次
  const map = [
    ['cw-folder-label', 'fields.folder_label'],
    ['cw-toggle-label', 'fields.enable_label'],
    ['cw-recent-label', 'fields.recent_label'],
    ['cw-advanced-summary', 'fields.advanced_summary'],
    ['cw-interval-label', 'fields.interval_label'],
    ['cw-tags-label', 'fields.tags_label'],
    ['cw-duplicate-label', 'fields.duplicate_label'],
    ['cw-duplicate-skip-label', 'fields.duplicate_skip'],
    ['cw-duplicate-allow-label', 'fields.duplicate_allow'],
    ['cw-duplicate-hint', 'fields.duplicate_hint'],
    ['cw-reset-index-hint', 'fields.reset_index_hint'],
    ['cw-notify-label', 'fields.notify_label'],
    ['cw-mixed-label', 'fields.mixed_label'],
    ['cw-multi-file-label', 'fields.multi_file_label'],
    ['cw-screenshot', 'fields.screenshot_button'],
  ]
  for (const [id, key] of map) {
    const el = $(id)
    if (el) el.textContent = t(key)
  }
  // hint 段
  const intervalHint = $('cw-interval-hint')
  if (intervalHint) intervalHint.textContent = t('fields.interval_hint')
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
    if (CW && CW.state && !CW.state.lastError) CW.state.lastError = 'UNKNOWN'
  } finally {
    render()
  }
}

function bindEvents() {
  const CW = window.ClipboardWatcher
  if (!CW) return

  // 静态文案先渲染一次
  renderStaticLabels()

  $('cw-folder').addEventListener('change', (e) => {
    safeAction('selectFolder', () => CW.selectFolder(e.target.value || null))
  })
  $('cw-enabled').addEventListener('change', (e) => {
    safeAction('toggleEnabled', () => {
      if (e.target.checked) CW.enableWatcher()
      else CW.disableWatcher()
    })
  })
  $('cw-screenshot').addEventListener('click', () => {
    safeAction('screenshot', () => CW.triggerScreenshot())
  })
  $('cw-interval').addEventListener('input', (e) => {
    const sec = Number(e.target.value)
    $('cw-interval-value').textContent = `${sec.toFixed(1)} ${t('fields.interval_unit')}`
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
      if (e.target.checked) safeAction('duplicateStrategy', () => CW.saveConfig({ duplicateStrategy: e.target.value }))
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
