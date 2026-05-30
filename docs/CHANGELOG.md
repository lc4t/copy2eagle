# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com) | Versioning: Major.Minor.Patch

## [Unreleased]

### Added
- 项目治理文件（AGENTS / CLAUDE / AGENT.RULES）
- 需求文档迁入 `docs/prd.md`
- 架构说明 `docs/architecture.md` + 决策记录 `docs/decisions.md`（含 ADR-001 ~ ADR-008）
- 里程碑分解 `.agent-doc/plan.md` + 进度跟踪 `.agent-doc/progress.md`
- npm 项目初始化（`package.json` 含 pack/clean scripts，Eagle 官方推荐包管理）
- entire CLI 接入（`.entire/settings.json` + Claude Code subagent）
- License 选定 PolyForm Noncommercial 1.0.0（非商用 + 署名，source-available）
- 插件骨架（M2）：`manifest.json`、`logo.png` 占位、`index.html`、`js/plugin.js`、`js/ui.js`
- 配置 schema 落地：`enabled` / `folderId` / `intervalMs` / `tags` / `notifyOnImport` / `duplicateStrategy`
- 面板 UI：状态指示灯 + 文件夹下拉（含二级路径 `父 / 子`）+ 主开关 + 「立即截图」按钮 + 最近导入区 + 高级折叠区（间隔滑块 / 标签 / 重复策略 Radio / 通知开关）

### Changed (M2.1)

- **持久化改用 `localStorage`**（原 PRD 写的 `eagle.extraData` 在 Eagle 官方 API 中不存在，导致 M2 配置保存失败）— ADR-010 / K7
- **主题检测改用 `eagle.app.theme` + `eagle.onThemeChanged`**（原 `eagle.app.isDarkMode` 不存在）— K8
- **窗口尺寸缩小到 380×540，加 maxWidth/maxHeight**（M2 默认被 Eagle 全屏化）— K9
- **默认 tag 自动追加 `os.hostname()`**（多机协作时区分来源）
- **截图改为剪贴板单路径**（参考 Alfred/Raycast）：
  - 主面板新增「立即截图（到剪贴板）」按钮，macOS 调 `screencapture -ic`
  - Windows 按钮置灰，提示用 `Win+Shift+S`
  - 移除高级设置中的"截图监听目录"字段
  - PRD F2 重写，M4 合并入 M3
  - ADR-004 修订 + 新增 ADR-011

### Changed (M2.2)

- 监听间隔 UI 单位由 ms 改为秒（slider 0.5–5s，步长 0.5）；存储仍用 ms（兼容 schema）
- PRD §8 新增第 6 条剪贴板权限与 macOS Sonoma "已粘贴自" 横幅说明；§7.2 修正残留的 `eagle.extraData` 引用为 `localStorage`
- 高级设置增加 hint：「轮询越快越及时；macOS 14+ 读剪贴板会触发系统横幅，可调大间隔减少触发」
- `plugin.js` 顶部注释加入 M3 实现指引（`availableFormats()` 预判 + hash 比对）
- 新增 K12 知识条目（剪贴板权限与横幅缓解策略）

### Added / Fixed (M4 — 用户 M3 验收反馈)

- **#4 真 bug 修复：删后再复制导入失败**
  - `backfillFolder` 重构：始终新建 tempSet → 完成后整组替换 `hashSetByFolder.set(folderId, tempSet)`，自然清理 Eagle 里已删 item 的旧 hash
  - `onPluginShow` 钩子调用节流回填（5s freshMs），打开面板即感知用户在 Eagle 里手动删除
  - 高级设置加「重置当前文件夹索引」按钮 → `backfillFolder(folderId, {force: true})`
- **#5 命名增强**
  - 普通剪贴板复制 → `Clipboard 1920x1080 2026-05-31 14:30:22`
  - 截图按钮触发后 5s 内的导入 → `Screenshot {WxH} {timestamp}`
  - 尺寸来自 `NativeImage.getSize()`，缺失时省略
  - annotation 含 `Source: ... / Size: ... / Imported by Clipboard Watcher @ <hostname>`
  - **来源 APP 检测确认不可行**（K14），不在 UI 暴露假承诺
- **#1 多文件复制（默认关 opt-in）**
  - 新增配置 `importMultipleFiles`（默认 false）
  - 探测剪贴板 file URL format（`public.file-url` / `NSFilenamesPboardType` / `CF_HDROP` / `FileDrop`）
  - macOS：`osascript -e '...'` 把 `the clipboard as «class furl»` 转 POSIX 路径列表
  - Windows：`powershell -Command "Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }"`
  - 2s shell 超时；过滤图片扩展名（11 个）；最多 50 张/批；batchKey 防重复触发
  - 单图剪贴板有图时 **图优先**（不并发触发多文件）
  - Linux 跳过
- **#2 图文混排开关（默认开 opt-out）**
  - 新增配置 `importMixedContent`（默认 true，沿用 M3 行为）
  - 关闭时探到 `text/html` / `text/plain` / `public.utf8-plain-text` / `public.html` 任一存在即跳过本张
- **#3 延迟**：保持 1s 默认（用户接受推荐），M5 做 adaptive polling 进一步优化

### Changed (M4)

- `CONFIG_VERSION` 升到 2（新增 `importMixedContent` / `importMultipleFiles` 字段）
- `normalizeConfig` 覆盖新字段，旧配置自动平滑升级
- PRD 新增 F10（多文件复制）+ F11（图文混排开关），F3 命名规则修订；§3.4 API 清单已用 `localStorage` 替代残留的 `eagle.extraData` 引用
- 知识库 K14：来源 APP 不可识别 + 多文件需 shell-out

### Fixed (M3.1)

- **致命 bug：剪贴板 API 用错** — `require('electron').clipboard` 在 Eagle 插件 webview 不可用，导致加载后立即报"剪贴板监听出错，5 秒后自动重试"。改用 `eagle.clipboard`（K13 / PRD §3.4 修订）
- `eagle.clipboard` 没有 `availableFormats()`，改为对 9 个图片 format 候选依次 `eagle.clipboard.has(fmt)` 探测（MIME + macOS UTI）
- 横幅缓解策略修订（K12 修订）：
  - 剪贴板**无图**时 `has()` 全 false → 整轮跳过（不触发横幅）
  - 剪贴板**有图**时仍需 readImage + hash 比对 → 每轮触发一次横幅，建议 macOS 14+ 用户调到 2–5s 间隔
  - adaptive polling 留给 M4
- poll 错误日志加 `err.stack`，下次类似 bug 直接见堆栈

### Added (M3)

- 剪贴板轮询主循环（`setTimeout` 链 + `pollInFlight` 自锁，避免任务堆积）
- macOS Sonoma 横幅缓解：先 `clipboard.availableFormats()` 过滤 + formatsKey 缓存（不变直接跳过）+ 仅在含 `image/*` 时才 `readImage()`
- 按 folderId 维度的进程内 `Map<folderId, Set<hash>>` 去重（ADR-009 / F4 v1.1）
- 启动 / 切换文件夹时的索引回填：`eagle.item.get({ folders })` → 逐个读 `item.filePath` → 计算 hash 入 Set；每 20 条让出主线程；UI「索引中 N/M」
- `duplicateStrategy` 分支落地：skip 查 hashSet 短路 / allow 启用 30s 滑动窗口防抖
- 导入管道：`os.tmpdir()/eagle-cw/clip-{stamp}.png` 写盘 → `addFromPath(path, {name, folders:[id], tags, annotation})` → 计数 / lastImport / hashSet 更新 → finally 删 tmp
- 通知：`eagle.notification.show` 接入 + 1.5s 节流；可在高级设置关闭
- 错误兜底：连续 3 次轮询错误自动暂停 + 5s 后重试
- UI：状态行支持"索引中 N/M"；「最近导入」卡片样式从 empty 切到 filled
- 错误码扩展：BACKFILL_FAILED / POLL_FAILED / IMPORT_FAILED / TMP_WRITE_FAILED 对应中文提示
- 间隔变更通过新接口 `updateIntervalMs` 触发轮询重启

---

## [0.0.0] - 2026-05-30

### Added
- 仓库初始化
