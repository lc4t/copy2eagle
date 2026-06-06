/*
 * lib/constants.js — 全局常量与错误码
 *
 * 所有 magic number 集中此处，便于 tuning + 文档化。
 */

const CONFIG_KEY = 'clipboardWatcher'
const CONFIG_VERSION = 2

const ALLOWED_DUPLICATE_STRATEGIES = ['skip', 'allow']

// 时间
const ALLOW_DEDUP_WINDOW_MS = 30000           // allow 模式下剪贴板防抖窗口
const POLL_RETRY_MS = 5000                    // poll 错误自动重试间隔
const NOTIFICATION_MIN_GAP_MS = 1500          // 通知节流，避免连续粘贴刷屏
const BACKFILL_FRESH_MS = 5000                // onPluginShow 触发回填的节流窗口
const SCREENSHOT_NAME_WINDOW_MS = 5000        // 截图按钮后多久内的导入命名为 Screenshot
const SHELL_TIMEOUT_MS = 2000                 // osascript / PowerShell / xclip 单次调用超时

// 阈值
const POLL_ERROR_THRESHOLD = 3                // 连续多少次轮询错误后暂停
const BACKFILL_YIELD_EVERY = 20               // 回填每多少 item 让出主线程一次
const ADAPTIVE_IDLE_INTERVAL_MS = 5000        // adaptive idle 模式下的最小轮询间隔
const ADAPTIVE_IDLE_THRESHOLD = 3             // 同 hash 持续多少次后进 idle 模式
const RECENT_IMPORTS_CAP = 5                  // 最近导入历史长度
const MULTI_FILE_MAX = 50                     // 多文件批量单批上限

// 文件
const TMP_DIR_NAME = 'eagle-cw'               // os.tmpdir() 子目录名

// 剪贴板格式候选（按可能性排序）
const IMAGE_FORMAT_CANDIDATES = [
  'image/png',
  'image/jpeg',
  'image/tiff',
  'image/bmp',
  'image/gif',
  'public.png',
  'public.tiff',
  'public.jpeg',
  'public.image',
]

const TEXT_FORMAT_CANDIDATES = [
  'text/html',
  'text/plain',
  'public.utf8-plain-text',
  'public.html',
]

const FILE_URL_FORMAT_CANDIDATES = [
  'public.file-url',
  'NSFilenamesPboardType',
  'CF_HDROP',
  'FileDrop',
]

const IMAGE_FILE_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.tif', '.heic', '.svg', '.avif',
])

// 错误码——所有内部错误用枚举值，UI 拿到后查 i18n 拿文案
const ERROR_CODES = {
  CONFIG_LOAD_FAILED: 'CONFIG_LOAD_FAILED',
  CONFIG_SAVE_FAILED: 'CONFIG_SAVE_FAILED',
  FOLDER_FETCH_FAILED: 'FOLDER_FETCH_FAILED',
  NO_FOLDER_SELECTED: 'NO_FOLDER_SELECTED',
  SCREENSHOT_UNSUPPORTED: 'SCREENSHOT_UNSUPPORTED',
  SCREENSHOT_FAILED: 'SCREENSHOT_FAILED',
  BACKFILL_FAILED: 'BACKFILL_FAILED',
  POLL_FAILED: 'POLL_FAILED',
  IMPORT_FAILED: 'IMPORT_FAILED',
  TMP_WRITE_FAILED: 'TMP_WRITE_FAILED',
  INSTANCE_CONFLICT: 'INSTANCE_CONFLICT',
  UNKNOWN: 'UNKNOWN',
}

module.exports = {
  CONFIG_KEY,
  CONFIG_VERSION,
  ALLOWED_DUPLICATE_STRATEGIES,
  ALLOW_DEDUP_WINDOW_MS,
  POLL_RETRY_MS,
  NOTIFICATION_MIN_GAP_MS,
  BACKFILL_FRESH_MS,
  SCREENSHOT_NAME_WINDOW_MS,
  SHELL_TIMEOUT_MS,
  POLL_ERROR_THRESHOLD,
  BACKFILL_YIELD_EVERY,
  ADAPTIVE_IDLE_INTERVAL_MS,
  ADAPTIVE_IDLE_THRESHOLD,
  RECENT_IMPORTS_CAP,
  MULTI_FILE_MAX,
  TMP_DIR_NAME,
  IMAGE_FORMAT_CANDIDATES,
  TEXT_FORMAT_CANDIDATES,
  FILE_URL_FORMAT_CANDIDATES,
  IMAGE_FILE_EXTS,
  ERROR_CODES,
}
