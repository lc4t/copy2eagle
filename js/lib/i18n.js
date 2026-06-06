/*
 * lib/i18n.js — 字符串集中 + locale bootstrap
 *
 * 用法：const { t } = require('./lib/i18n'); t('errors.POLL_FAILED')
 *
 * 当前只接 zh-CN，但所有字符串走 t() 调用——下次加 en 只需补 messages.en，
 * 把 currentLocale 切换即可。Plugin Center 国际化分发的基础。
 */

const zh = {
  errors: {
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
    INSTANCE_CONFLICT: (otherVersion) =>
      `检测到另一个 Clipboard Watcher（v${otherVersion}）也在运行。请在 Eagle 插件管理中删掉旧版本，保留一个。`,
    UNKNOWN: '出错了，可以打开 Eagle 日志面板看看详情。',
  },
  status: {
    running: '正在运行',
    idle: '未运行',
    error: '出错了',
    indexing: '正在整理文件夹内容',
    indexing_with_total: (p, t) => `正在整理文件夹内容 ${p}/${t}`,
    today_count: (n) => `今日已保存：${n} 张`,
    lifetime_count: (n) => `累计 ${n} 张`,
    retry_in: (sec) => `暂时读不到剪贴板，${sec} 秒后再试`,
  },
  fields: {
    folder_label: '保存到 Eagle 的哪个文件夹',
    folder_placeholder_select: '请选择文件夹…',
    folder_placeholder_empty: '（Eagle 里还没有文件夹）',
    folder_hint_pick: '选择文件夹后才能开始自动保存',
    folder_hint_empty: '没看到任何文件夹。确认 Eagle 已打开，并至少有一个文件夹。',
    folder_hint_current: (label) => `保存到：${label}`,
    enable_label: '自动保存复制的图片',
    screenshot_button: '立即截图',
    screenshot_hint_default: '截图后会自动出现在 Eagle',
    screenshot_hint_win: 'Windows 请用 Win+Shift+S 截图，打开「自动保存」后会自动出现在 Eagle',
    screenshot_hint_no_folder: '先选好文件夹，截图就能自动出现在 Eagle',
    screenshot_hint_not_running: '截图会先进剪贴板，打开上面的「自动保存」开关后会进 Eagle',
    screenshot_hint_running: '点一下选区，截图自动出现在 Eagle',
    recent_label: '最近保存',
    recent_empty: '还没有保存过图片',
    recent_open_in_eagle: '点击在 Eagle 中打开',
    advanced_summary: '高级设置',
    interval_label: '检查频率（秒）',
    interval_unit: '秒',
    interval_hint: '数字越小响应越快。macOS 14 及以上读取剪贴板时会出现“已粘贴自 Eagle”通知，把数字调大可减少通知次数',
    tags_label: '自动加上的标签（用逗号分隔）',
    // v1.5 命名模板
    name_template_label: '保存时的名字模板',
    name_template_hint: '可用占位符：{source} {dims} {timestamp} {date} {time} {hostname} {count} {lifetime}（多文件批量始终用原文件名）',
    name_template_preview_label: '预览：',
    name_template_reset: '恢复默认',
    name_template_placeholder: '{source} {dims} {timestamp}',
    duplicate_label: '遇到已有的相同图片',
    duplicate_skip: '跳过不再保存',
    duplicate_allow: '再保存一份',
    duplicate_hint: '「跳过」会先检查文件夹里是否已存在同一张图',
    reset_index_default: '刷新已保存记录',
    reset_index_indexing: (p, t) => `正在整理 ${p}/${t || '…'}`,
    reset_index_hint: '在 Eagle 里手动删图后点这里，下次复制同图就会重新保存',
    notify_label: '保存成功时发送系统通知',
    mixed_label: '复制带文字的内容时，把里面的图片也保存',
    multi_file_label: '同时选中多张图片复制时也一并保存',
    multi_file_hint_mac: '在 Finder 中选中多张图片 Cmd+C，一次性全部进 Eagle（最多 50 张）',
    multi_file_hint_win: '在资源管理器中选中多张图片 Ctrl+C，一次性全部进 Eagle（最多 50 张）',
    multi_file_hint_linux: '在文件管理器中选中多张图片 Ctrl+C 即可（需安装 wl-paste 或 xclip，最多 50 张）',
    multi_file_hint_unknown: '此功能在当前系统不可用',
    // v1.4 多文件夹路由
    routing_section_label: '按来源分别保存到不同文件夹（可选）',
    routing_section_hint: '不选则跟随上面的主文件夹',
    routing_screenshot_label: '截图按钮保存到',
    routing_clipboard_label: '复制图片保存到',
    routing_files_label: '多文件复制保存到',
    routing_use_main: '— 跟随主文件夹 —',
  },
  notify: {
    title_normal: 'Clipboard Watcher',
    title_error: 'Clipboard Watcher · 出错了',
    saved_to: (label) => `已保存到 ${label}`,
    multi_saved_to: (label, n) => `已保存到 ${label}（${n} 张）`,
    import_failed: '保存到 Eagle 失败',
    tmp_failed: '写入临时文件失败（磁盘满？）',
    multi_all_failed: (n) => `${n} 个文件都没能保存（重复或失败）`,
  },
}

const en = {
  errors: {
    CONFIG_LOAD_FAILED: "Couldn't read your previous settings. Defaults restored.",
    CONFIG_SAVE_FAILED: "Couldn't save settings. Try again in a moment.",
    FOLDER_FETCH_FAILED: "Can't read Eagle's folder list. Is Eagle still running?",
    NO_FOLDER_SELECTED: 'Pick a destination folder first.',
    SCREENSHOT_UNSUPPORTED: 'The "Take Screenshot" button only works on macOS. Use your system screenshot tool (result must go to clipboard).',
    SCREENSHOT_FAILED: 'Screenshot tool failed. Try again in a moment.',
    BACKFILL_FAILED: "Could not index the folder's existing contents. Dedup will only use images seen this session.",
    POLL_FAILED: "Can't read the clipboard right now. Retrying in 5 seconds.",
    IMPORT_FAILED: 'Save to Eagle failed. Was the destination folder deleted?',
    TMP_WRITE_FAILED: 'Could not write a temporary file. Is the disk full?',
    INSTANCE_CONFLICT: (otherVersion) =>
      `Another Clipboard Watcher instance (v${otherVersion}) is also running. Please remove the older one in Eagle's Plugins manager and keep only one.`,
    UNKNOWN: 'Something went wrong. Check the Eagle log panel for details.',
  },
  status: {
    running: 'Running',
    idle: 'Idle',
    error: 'Error',
    indexing: 'Indexing folder contents',
    indexing_with_total: (p, t) => `Indexing folder contents ${p}/${t}`,
    today_count: (n) => `Saved today: ${n}`,
    lifetime_count: (n) => `${n} total`,
    retry_in: (sec) => `Can't read the clipboard right now. Retrying in ${sec}s.`,
  },
  fields: {
    folder_label: 'Save to which Eagle folder',
    folder_placeholder_select: 'Choose a folder…',
    folder_placeholder_empty: '(No folders in Eagle yet)',
    folder_hint_pick: 'Pick a folder to start auto-saving',
    folder_hint_empty: 'No folders found. Make sure Eagle is open with at least one folder.',
    folder_hint_current: (label) => `Saving to: ${label}`,
    enable_label: 'Auto-save copied images',
    screenshot_button: 'Take Screenshot',
    screenshot_hint_default: 'Screenshots appear in Eagle automatically',
    screenshot_hint_win: 'On Windows, use Win+Shift+S — with auto-save enabled, screenshots show up in Eagle',
    screenshot_hint_no_folder: 'Pick a folder first; screenshots will then appear in Eagle',
    screenshot_hint_not_running: 'Screenshot goes to clipboard. Toggle "Auto-save" above to import it.',
    screenshot_hint_running: 'Click, drag-select, and the screenshot lands in Eagle',
    recent_label: 'Recent saves',
    recent_empty: 'No saves yet',
    recent_open_in_eagle: 'Click to open in Eagle',
    advanced_summary: 'Advanced settings',
    interval_label: 'Check frequency (seconds)',
    interval_unit: 's',
    interval_hint: 'Smaller is faster. macOS 14+ shows a "Pasted from Eagle" notification when reading the clipboard; raise this to reduce it.',
    tags_label: 'Auto-applied tags (comma-separated)',
    name_template_label: 'Name template',
    name_template_hint: 'Tokens: {source} {dims} {timestamp} {date} {time} {hostname} {count} {lifetime}. Multi-file imports always use the original filename.',
    name_template_preview_label: 'Preview:',
    name_template_reset: 'Restore default',
    name_template_placeholder: '{source} {dims} {timestamp}',
    duplicate_label: 'When the same image already exists',
    duplicate_skip: "Skip — don't save again",
    duplicate_allow: 'Save another copy',
    duplicate_hint: '"Skip" first checks whether the same image is already in the folder',
    reset_index_default: 'Refresh save history',
    reset_index_indexing: (p, t) => `Indexing ${p}/${t || '…'}`,
    reset_index_hint: 'After manually deleting in Eagle, click here so re-copying the same image will save it again',
    notify_label: 'Send a system notification on save',
    mixed_label: 'When copying mixed text + image, save the image too',
    multi_file_label: 'Also save when multiple images are copied at once',
    multi_file_hint_mac: 'Select multiple images in Finder and Cmd+C — all imported at once (max 50)',
    multi_file_hint_win: 'Select multiple images in Explorer and Ctrl+C — all imported at once (max 50)',
    multi_file_hint_linux: 'Select multiple images in your file manager and Ctrl+C (needs wl-paste or xclip, max 50)',
    multi_file_hint_unknown: 'Not available on this OS',
    routing_section_label: 'Route by source (optional)',
    routing_section_hint: "Leave blank to use the main folder above",
    routing_screenshot_label: 'Screenshot button saves to',
    routing_clipboard_label: 'Copied image saves to',
    routing_files_label: 'Multi-file copy saves to',
    routing_use_main: '— use main folder —',
  },
  notify: {
    title_normal: 'Clipboard Watcher',
    title_error: 'Clipboard Watcher · Error',
    saved_to: (label) => `Saved to ${label}`,
    multi_saved_to: (label, n) => `Saved to ${label} (${n})`,
    import_failed: 'Save to Eagle failed',
    tmp_failed: 'Temp file write failed (disk full?)',
    multi_all_failed: (n) => `None of the ${n} files were saved (duplicates or errors)`,
  },
}

const messages = { zh, en }
let currentLocale = 'zh'

/**
 * 根据 path 取消息。支持 'errors.POLL_FAILED' 或 'status.today_count'（函数）。
 * 函数项：调用 t('status.today_count', null, 42) → "今日已保存：42 张"
 * 缺失时回退 fallback 或 path 本身。
 */
function t(path, fallback, ...args) {
  const parts = path.split('.')
  let v = messages[currentLocale]
  for (const p of parts) {
    if (!v || typeof v !== 'object') return fallback || path
    v = v[p]
  }
  if (typeof v === 'function') return v(...args)
  if (v === undefined || v === null) return fallback || path
  return v
}

function setLocale(locale) {
  if (messages[locale]) {
    currentLocale = locale
    return true
  }
  return false
}

function detectLocale() {
  try {
    const lang = (navigator && navigator.language) || 'zh'
    if (lang.toLowerCase().startsWith('en')) return 'en'
    return 'zh'
  } catch {
    return 'zh'
  }
}

module.exports = { t, setLocale, detectLocale, messages }
