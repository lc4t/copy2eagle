/*
 * lib/notification.js — eagle.notification 包装 + 节流
 */

const { NOTIFICATION_MIN_GAP_MS } = require('./constants')
const { state } = require('./state')
const { t } = require('./i18n')

let lastNotificationAt = 0

function withinThrottle() {
  const now = Date.now()
  if (now - lastNotificationAt < NOTIFICATION_MIN_GAP_MS) return true
  lastNotificationAt = now
  return false
}

function maybeNotify(folderLabel, count) {
  if (!state.config || !state.config.notifyOnImport) return
  if (withinThrottle()) return
  const desc = count && count > 1
    ? t('notify.multi_saved_to', null, folderLabel, count)
    : t('notify.saved_to', null, folderLabel)
  try {
    if (eagle.notification && typeof eagle.notification.show === 'function') {
      eagle.notification.show({ title: t('notify.title_normal'), description: desc })
    }
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] notification failed: ${err && err.message ? err.message : err}`)
  }
}

function maybeNotifyError(description) {
  if (!state.config || !state.config.notifyOnImport) return
  if (withinThrottle()) return
  try {
    if (eagle.notification && typeof eagle.notification.show === 'function') {
      eagle.notification.show({ title: t('notify.title_error'), description })
    }
  } catch (err) {
    eagle.log.warn(`[clipboard-watcher] error-notification failed: ${err && err.message ? err.message : err}`)
  }
}

module.exports = { maybeNotify, maybeNotifyError }
