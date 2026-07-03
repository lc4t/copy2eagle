# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com) | Versioning: Major.Minor.Patch

## [Unreleased]

_（待 v1.6+ 累积）_

---

## [1.5.5] — 2026-07-04

Plugin Center review resubmission.

### Changed

- Adjusted the Plugin Center cover to `1800×1200` at a 3:2 ratio after review feedback said the submitted cover looked incorrectly proportioned.
- Clarified macOS / Windows support in reviewer materials. The package manifest explicitly keeps `platform: "all"` per Eagle's manifest docs; the built-in screenshot button remains macOS-only, while Windows screenshots use `Win+Shift+S`.

---

## [1.5.4](https://github.com/lc4t/copy2eagle/releases/tag/v1.5.4) — 2026-06-15

Plugin Center submission compatibility hotfix.

### Fixed

- Replaced the placeholder Plugin ID with UUID v4 `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`, as required by the Plugin Center submission validator.
- Added a regression check that locks the fixed ID and validates UUID v4 format.

### Upgrade note

- The UUID changes the plugin identity. Users of v1.5.3 or earlier GitHub builds should uninstall the old plugin before installing v1.5.4, then select the target folder again.
- Old and new IDs may use separate localStorage origins and cannot be relied on to share the single-owner lease.

---

## [1.5.3](https://github.com/lc4t/copy2eagle/releases/tag/v1.5.3) — 2026-06-15

Correctness hotfix and Plugin Center preflight. Code/package checks and the macOS Eagle installation/clipboard baseline are complete.

### Fixed

- Replaced the v1.5.2 heartbeat race with a single-owner v2 lease.
  - Same-version instances no longer overwrite each other's ownership.
  - The owner renews independently of adaptive polling and error retries.
  - A legacy heartbeat guard keeps v1.5.2 instances paused without letting their writes affect v2 ownership.
  - Disabling, clearing the main folder, or exiting releases only the current owner's lease.
- Restored `duplicateStrategy=allow`: the same clipboard image may import again after the 30-second flood-control window.
- Rebuilt all active route-folder indexes on startup and enable, and rebuilt a new route before polling resumes after a route change.
- Fixed `{count}` and `{lifetime}` name tokens so they include the current import, including the first import after midnight.
- Awaited async watcher enable actions so UI errors and completion render consistently.
- Raised the panel's vertical resize limit from 640 to 960 so advanced settings can use available screen height without enabling maximize or fullscreen.

### Changed

- Added dependency-free regression checks for lease ownership, v1.5.2 compatibility, duplicate policy, serialized route backfill, version synchronization, name counters, and temporary-file cleanup.
- `npm run pack` now runs tests first and includes `README.md` plus `LICENSE` for Plugin Center reviewers.
- Updated README and Plugin Center materials to current repository visibility, platform support, v1.5.3 features, and official icon requirements.
- Renamed the store-facing product to `剪贴板图片留存` (`Clipboard Image Archive`) and adopted the MIT License.
- Replaced the placeholder icon with a 512×512 transparent production icon.
- Restored Windows distribution and Explorer multi-file clipboard import via PowerShell FileDropList; the built-in screenshot button remains macOS-only, while Windows screenshots use `Win+Shift+S`.
- Removed Linux-only `wl-paste` / `xclip` branches because Eagle officially distributes on macOS and Windows.

### Pending before release

- Optional macOS QA for route changes, allow-after-30s, duplicate instances, and error recovery; the updated vertical resize limit is verified.
- Real-device Windows QA will follow availability and user feedback.
- Plugin Center cover and at least three real product screenshots.

---

## [1.5.2] — 2026-06-06

防御性 hotfix：处理用户在 Eagle 里同时装了两个 Clipboard Watcher 时的"重复图片"误告警。

### Fixed

- **双实例并存导致 Eagle 报"重复图片"**
  - 现象：用户依次 `.eagleplugin` 装了 v1 + v2，Eagle 没按 manifest.id 去重，两个 serviceMode 实例并存。两个实例都轮询剪贴板，都调 `addFromPath` → Eagle 自己拦截第二个为 duplicate → 弹通知。
  - 修：心跳锁（`lib/instance.js`）
    - 每个实例生成随机 `instanceId`，每轮 poll 写 `localStorage['clipboardWatcher.heartbeat'] = { instanceId, ts, version }`
    - 每轮 poll 前先 read：看到别人的 instanceId 且 ts < 3s → 跳过本轮 import，UI 显示 `检测到另一个 Clipboard Watcher（v{version}）也在运行...`
    - 一个被用户删掉/重启后，另一个会在下一轮 poll 自动恢复
    - 假设：Eagle 让同 id 的多实例共享 localStorage origin。若 Eagle 不共享，本机制退化为无害 no-op（每个实例只看到自己），用户仍可走文档指引手动清理
  - 同时提示用户：去 Eagle → 菜单 → 插件 → 管理插件，把旧的 Clipboard Watcher 删掉

### Added

- 新模块 `js/lib/instance.js`（initInstance / writeHeartbeat / checkConflict / PLUGIN_VERSION）
- ERROR_CODES.INSTANCE_CONFLICT
- i18n: `errors.INSTANCE_CONFLICT(otherVersion)` 函数式消息（zh + en）
- bundler 加 `'instance'` 到 LIB_ORDER（位于 poll 之前）
- snapshot 暴露 `instanceConflict: { otherInstanceId, otherVersion }`

---

## [1.5.1] — 2026-06-03

Hotfix：macOS 全屏 Eagle 下打开插件面板会跟着全屏 + 关闭时黑屏一闪。

### Fixed

- **manifest 加 `fullscreenable: false`**
  - 之前 manifest 没声明这个字段 → Eagle 用默认值 `true` → 插件窗口被 macOS 当成"可全屏"
  - 当 Eagle 在 full-screen Space 时，插件窗口跟随 Eagle Space 触发 fullscreen 转场动画 → 用户看到面板全屏、关闭时黑屏
  - 显式 `fullscreenable: false` 后窗口不再支持全屏，macOS 把它当作普通浮动面板处理
- **manifest 加 `maximizable: false`**（防御）
  - macOS 上 fullscreenable: false 后，绿色按钮的行为退化为 maximize；显式禁掉避免任何尺寸跳变
  - 配合现有 maxWidth: 460 / maxHeight: 640，彻底锁死窗口尺寸不会膨胀

### Eagle manifest 字段参考（K15 新沉淀）

完整可用键（v1.5.1 实测确认）：
`url / width / height / minWidth / minHeight / maxWidth / maxHeight / alwaysOnTop / frame / fullscreenable / maximizable / minimizable / resizable / backgroundColor / childWindow / followCursor / multiple / runAfterInstall / serviceMode / devTools`

---

## [1.5.0] — 2026-06-03

**重要修复 + 命名模板。v1.3.0 和 v1.4.0 用户请务必升级**——前两版在 Eagle webview 里**面板会全空**（issue [#2](https://github.com/lc4t/copy2eagle/issues/2)）。

### Fixed

- **[#2] 修复 v1.3.0 以来面板空白的回归**
  - 根因：v1.3.0 把 `js/plugin.js` 拆为 `js/lib/*` 共 12 个模块，运行时用 `require('./lib/xxx')` 加载。
  - 实测 Eagle 4.x webview 不支持 `<script src>` 加载的脚本里调用相对路径 `require()`——require 抛错 → `window.ClipboardWatcher` 没建起来 → UI 渲染全跳过。
  - 修法：新增 `build/bundle.js` 本地 bundler，build 时把 `js/lib/*` + `js/plugin.js` + `js/ui.js` 按依赖顺序拼成单个 `js/bundle.js`。运行时 `index.html` 只加载这一个文件。
  - 源码保持模块化（开发体验不退化），ship 单文件（绕开 Eagle webview 限制）。
  - 新 `npm run build`；`npm run pack` 自动先 build 再打包。

### Added

- **自定义命名模板（F13）**：保存到 Eagle 的 item name 可自定义
  - 配置：`nameTemplate`，默认 `{source} {dims} {timestamp}`（还原 v1.4 行为）
  - 支持占位符：`{source}` / `{dims}` / `{timestamp}` / `{date}` / `{time}` / `{hostname}` / `{count}` / `{lifetime}`
  - 多文件批量导入**不走模板**，仍用源文件名（保持向后兼容）
  - UI：高级设置加输入框 + 实时预览 + 「恢复默认」链接
  - 输入时不立即保存（不打断编辑），失焦或回车提交
  - 模板为空时自动回退默认（不会让 item 没名字）

### Changed

- 项目结构：新增 `build/`、`js/lib/`、`js/bundle.js`（gitignored）；`index.html` 单一 script 入口
- `package.json` 加 `build` script；`pack` 自动先 build
- `.gitignore` 加 `js/bundle.js`（每次 build 重新生成）

### Notes

- 升级路径：直接覆盖安装 v1.5.0 `.eagleplugin`，配置不会丢（localStorage 不变）
- 如果 v1.5.0 仍有空白问题，请在 issue [#2](https://github.com/lc4t/copy2eagle/issues/2) 留言，附 Eagle 日志面板的 `[bundle]` 开头错误（如有）

---

## [1.4.0] — 2026-06-02

第一波架构红利兑现：多文件夹路由 + 全期计数 + EN 翻译完整化。

### Added

- **多文件夹路由（F12）**：截图 / 复制 / 多文件三种来源可分别配置不同的 Eagle 文件夹
  - config 新增 `folderIdScreenshot` / `folderIdClipboard` / `folderIdFiles`（默认 null，跟随主 folder）
  - `lib/config.js: resolveTargetFolder(source)` 集中决定落地文件夹
  - `lib/poll.js` runPoll：单图 + 多文件路径都按 source 解析
  - enable 时同步 backfill 主 folder + 后台异步 backfill 各路由 folder（不阻塞 polling）
  - UI 高级设置末尾加 3 个可选 select，标注"不选则跟随主文件夹"
- **持久化全期计数**：跨 session 显示"累计 N 张"
  - 独立 localStorage key `clipboardWatcher.stats`，与 config 解耦
  - `incrementToday` 同步 +1 lifetime，写盘失败静默
  - 状态行格式：`今日已保存：N 张 · 累计 M 张`（M = 0 时不显示"累计"段）
- **EN 翻译表**：i18n 完整 zh / en 双表
  - 67 个 key 全部对齐（自动校验通过）
  - `detectLocale()` 用 `navigator.language` 自动选 zh / en
  - 加新语言只需补 `messages.xx` 表

### Changed

- 入库 source 判定保持现状：截图按钮触发 5s 内 = `screenshot`，多文件路径 = `files`，其余 = `clipboard`
- 状态行展示新增 lifetime（仅当 > 0）

### Notes

- 路由 select 只在高级设置里出现，**首次启用默认行为不变**——所有图仍进主文件夹
- macOS 用户用系统快捷键截图（非插件按钮），来源被归为 `clipboard`，会落到剪贴板路由文件夹（如果配置了）。这是已知取舍——区分需要 Eagle 暴露剪贴板 owner API，目前未公开

---

## [1.3.0] — 2026-06-02

**架构重构版本，行为零变化**（与 v1.2.1 完全等价）。

> 用户不会感知任何 UI / 功能 / 命令差异；这版本是给后续功能开发铺地基的。
> 任何回归，请优先回退到 v1.2.1 验证；如能复现 bug 也烦请同时反馈 v1.2.1 是否同样存在。

### Refactored

- **`js/plugin.js` 单文件 1100 行拆为 12 个 lib 模块**：
  ```
  js/
  ├── plugin.js          # 入口编排（~150 行）
  ├── ui.js              # DOM 渲染 + 事件
  └── lib/
      ├── constants.js   # 全局常量 / 错误码 / format 候选
      ├── utils.js       # 纯函数：pad/nowStamp/sleep/computeHash/parseTags
      ├── state.js       # 全局 state + 受控 mutator
      ├── config.js      # schema/defaults/load/save (localStorage)
      ├── i18n.js        # 消息表（zh）+ t(key) + locale 检测
      ├── theme.js       # Eagle 主题适配
      ├── folders.js     # eagle.folder + 启动期回填
      ├── clipboard.js   # 多平台 has(format) + 文件 URL 读取
      ├── import.js      # 单图 + 多文件 → addFromPath
      ├── screenshot.js  # macOS screencapture -ic
      ├── notification.js# eagle.notification 节流封装
      └── poll.js        # 轮询状态机 + adaptive + retry
  ```
- **i18n 启动**：所有 UI 字符串走 `t('namespace.key')`，未来加英文翻译只需补 `messages.en` 表
  - 当前默认 zh；用 `navigator.language` 检测，将来 Eagle 提供 locale API 可切换
  - 这版本只接 zh，避免半英半中
- **state 集中**：所有可变状态在 `lib/state.js`，通过 `setRuntimeStatus / pushRecentImport / scheduleRender` 等 mutator 修改
- **错误码集中**：原 `'CONFIG_LOAD_FAILED'` 等裸字符串改用 `ERROR_CODES.CONFIG_LOAD_FAILED` 枚举（i18n 拿文案）
- **HTML 静态文案抽离**：`index.html` 里写死的中文全改空壳 + id，由 `renderStaticLabels()` 注入

### Why

- 原单文件改一处常常牵动多处
- 新功能（自定义命名模板 / 多文件夹路由 / OCR）会涉及多个职责，需要清晰边界
- i18n 是 Plugin Center 国际化分发的前置条件

### Known notes

- Eagle webview 必须支持 `require('./lib/xxx')` 相对路径解析（Electron renderer + nodeIntegration 标准行为，但具体取决于 Eagle 实现）
- 若加载报错，回滚到 v1.2.1 后再起 v1.3.1 改方案

---

## [1.2.1] — 2026-06-02

Hotfix [#1](https://github.com/lc4t/copy2eagle/issues/1)。

### Fixed

- **不再误导入 Finder / 资源管理器复制文件 / 文件夹 / PDF 时系统自动生成的预览 icon**（[#1](https://github.com/lc4t/copy2eagle/issues/1)）
  - macOS / Windows 在用户对文件 Cmd/Ctrl+C 时，会**同时**在剪贴板放：① file URL ② 自动生成的预览图标（也是 `image/*` 格式）
  - 之前 `runPoll` 看到 `image/*` 就当真图导入 → 图标进了 Eagle
  - 修复：`runPoll` 在跑图片路径**之前**先 `probeAnyFormat(FILE_URL_FORMAT_CANDIDATES)`：
    - 有 file URL → 是文件/文件夹复制场景，**跳过 icon**；只在用户开了「同时选中多张图片复制时也一并保存」时走多文件路径
    - 无 file URL → 才走单图剪贴板路径（截图 / 浏览器复制 / 别的 App 真图）
  - 行为收益：复制 PDF / 文件夹 / 非图片文件时**完全静默**，不再产生意外条目

### Changed

- 多文件路径从「单图分支的 else」前移到「file URL 优先判定」中，逻辑更清晰
- 单图分支注释明确「无 file URL，确认是真图」

---

## [1.2.0] — 2026-05-31

跨平台完整化 + 主题 bug 修复。

### Fixed

- **LIGHTGRAY 主题被误判为 dark** —— 原 `isDarkTheme()` 用 `/DARK|GRAY|BLUE|PURPLE/i` 正则，`LIGHTGRAY` 含 `GRAY` 子串导致误判。换为精确 `Set` 匹配，dark 系列只含 `GRAY / DARK / BLUE / PURPLE`（K8）

### Added

- **Linux 多文件复制支持**（之前只 macOS / Windows）
  - Wayland：`wl-paste --type text/uri-list`
  - X11：`xclip -selection clipboard -t text/uri-list -o`
  - 根据 `$WAYLAND_DISPLAY` 自动选择优先项；不可用时回落另一个
  - 解析 `text/uri-list`：剥 `file://` 前缀 + URL decode
  - 工具均缺失时静默失败，不影响其他路径

### Changed

- UI hint：多文件复制开关下方的提示文案，Linux 也明确支持（"在文件管理器中选中多张图片 Ctrl+C 即可（需安装 wl-paste 或 xclip）"）

---

## [1.1.0] — 2026-05-31

体验增强 patch。基于 v1.0.0，无破坏性改动。

### Added

- **点击「最近保存」→ 在 Eagle 主窗口打开该 item**（`eagle.item.open(itemId)`）
  - `addFromPath` 现在捕获返回的 itemId 写入 `recentImports`
  - 可点击的卡片加 hover 反馈 + cursor pointer
  - 多文件批量导入也同样支持
- **导入失败时也发系统通知**（受同一个「保存成功时发送系统通知」开关控制）
  - `addFromPath` 失败 / tmp 写入失败 / 多文件批量全失败 → 一条通知
  - 1.5s 节流共享，不会刷屏
- **GitHub Issue 模板**
  - `.github/ISSUE_TEMPLATE/bug.yml`：Bug 反馈，含版本 / OS / Eagle 版本 / 复现步骤 / 高级设置状态 / 日志面板输出
  - `.github/ISSUE_TEMPLATE/feature.yml`：功能建议，含痛点 / 期望体验 / 替代方案 / 优先级
  - `config.yml`：禁用空白 issue，加文档/邮件入口
  - 仓库 Issues 已启用（`gh repo edit --enable-issues`）

### Changed

- 通知文案：`已导入 1 张图片 → XX` → `已保存到 XX`（与 UI 统一为「保存」口径）

---

## [1.0.0] — 2026-05-31

首次公开发布。覆盖 PRD 的 F1–F11，跨 macOS / Windows / Linux（Linux 仅剪贴板路径）。

### 里程碑总览

- **M1** 项目治理 / npm 工具链 / entire CLI / PolyForm-NC License
- **M2** 插件骨架与配置面板（manifest / index / plugin / ui）
- **M2.1** 4 项 M2 bug 修复（localStorage / 窗口 / 主题 / hostname）+ scope 变更（剪贴板单路径）
- **M2.2** 间隔单位改秒 + 剪贴板权限调研（K12）
- **M3** 剪贴板轮询 + 按文件夹去重 + 启动期回填 + 导入管道
- **M3.1** clipboard API 修正（eagle.clipboard 替代 require('electron').clipboard）
- **M4** 用户 M3 反馈 5 项：删后再复制修复 / 命名增强 / 多文件 / 混排开关 / 延迟讨论
- **M5** Adaptive polling + 重试倒计时 + 最近导入列表
- **M6** 用户视角文案重写 + 打包验证 + README polish

### 设计决策

- ADR-001 ~ ADR-011（详见 [docs/decisions.md](decisions.md)）
- K1 ~ K14 知识沉淀（详见 [.agent-doc/knowledge.md](../.agent-doc/knowledge.md)）

### 原 Unreleased 详情

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

### Changed (M6.1 — 用户视角文案重写)

按用户反馈「设置太开发者视角」做全面文案 audit：
- 状态文案：`监听中` → `正在运行`；`已停止` → `未运行`；`出错` → `出错了`；`索引中 N/M` → `正在整理文件夹内容 N/M`
- 计数：`今日导入：N` → `今日已保存：N 张`
- 字段标签：`目标文件夹` → `保存到 Eagle 的哪个文件夹`；`开启监听` → `自动保存复制的图片`；`最近导入` → `最近保存`
- 高级设置：
  - `监听间隔（秒）` → `检查频率（秒）`
  - `重复图片处理` → `遇到已有的相同图片`，选项 `跳过（默认）/允许重复` → `跳过不再保存/再保存一份`
  - `重置当前文件夹索引` → `刷新已保存记录`
  - `允许从图文混排导入图片（默认开启）` → `复制带文字的内容时，把里面的图片也保存`
  - `支持多文件复制批量导入（默认关闭）` → `同时选中多张图片复制时也一并保存`
  - 所有"（默认开启 / 关闭）"label 标记移除（默认值通过控件初始态体现）
- Hint：移除 `osascript / PowerShell / format / hash / 索引` 等开发者用语，改用任务化口径
- 截图按钮：`立即截图（到剪贴板）` → `立即截图`；hint 描述用户能理解的"截图后会自动出现在 Eagle"
- 错误信息口语化：
  - `配置读取失败` → `之前的设置读不出来了，已经恢复默认设置`
  - `配置保存失败，请稍后重试` → `设置保存不上，过会儿再试`
  - `剪贴板监听出错` → `暂时读不到剪贴板`
  - `索引现有文件夹内容失败` → `检查文件夹里已有的图片时出错`
  - 等等
- 时间单位 `s` → `秒`

### Added (M6.2 — 打包验证)

- `npm run pack` 实跑通过：产出 17.5KB `.eagleplugin`，含 6 个文件（manifest/index.html/logo.png/js/{ui,plugin}.js）
- 验证 `docs/` `.agent-doc/` `.git/` `package.json` `AGENTS.md` 等开发期文件均**未**被打入产物
- `.gitignore` 已覆盖 `*.eagleplugin` 和 `*.zip`，打包产物不会污染 git

### Added (M7 — release prep, 文档级)

- `package.json` version 0.0.0 → 1.0.0
- `docs/CHANGELOG.md` 切版到 `[1.0.0] — 2026-05-31`，新建空 `[Unreleased]`
- `docs/release-checklist.md`：用户手动步骤清单（设计资产 / Eagle 开发者工具 / License 风险点 / GitHub Release / Plugin Center 提交）
- `docs/plugin-center-submission.md`：中英文短/长描述、隐私声明、License 声明、reviewer 备注、关键词、分类建议
- 最终打包验证通过：`npm run pack` 产 17.5KB 干净 `.eagleplugin`，version 1.0.0 / devTools false

### Added (M7.1 — 设计 brief)

- `docs/design-brief.md`：
  - Logo 128×128 prompt 多版本（Midjourney v6 / Ideogram / Recraft / 通用文字）
  - 封面 1280×800 设计指导（背景层 prompt + 排版建议）
  - 5 张产品截图脚本（场景 / 准备步骤 / 命名约定）
  - 风格参考（macOS Sonoma / Raycast / Linear 类）+ 避雷条款

### Added (M7.2 — GitHub Release v1.0.0)

- 修正 GitHub 仓库默认分支：原 `entire/checkpoints/v1` → `dev`（entire 注入 hooks 时误改了默认分支）
- `git tag -a v1.0.0` 含完整 release notes
- `gh release create v1.0.0`，附 `.eagleplugin` (17.5KB)
- Release URL：https://github.com/lc4t/copy2eagle/releases/tag/v1.0.0

### Changed (M7.3 — README install)

- 推荐路径设为「下载 .eagleplugin 双击安装」（取代之前"待 Plugin Center"占位）
- 增加「私仓须知」明确告知 Release 下载需登录 + 仓库读权限
- Plugin Center 标"待审核"并附预计时间
- 开发者模式作兜底，附 `npm run pack` 流程

### Changed (M6.3 — README polish)

- 用户视角重写「它做什么 / 平台 / 安装 / 使用 / 高级设置」段落
- 新增「关于 macOS 14+ 已粘贴自 Eagle 通知」说明，承认现实代价、解释 adaptive polling 缓解、给出"调大间隔"的用户级建议
- 隐私段落明确：不联网 / 不上传 / 不遥测；配置存 localStorage；临时图导入即删
- 反馈渠道：GitHub Issues（待开放）+ 邮件
- 高级设置以表格形式呈现，便于扫读
- 保留 PolyForm Noncommercial License 段落

### Added (M5)

- **Adaptive polling**：剪贴板里同一张图持续 3 轮未变 → 自动放慢轮询到 5s（取 max(用户设置, 5000ms)）；任何 hash 变化或图片消失即刻回到 normal 模式
  - 直接降低 macOS 14+ 「已粘贴自 Eagle」横幅触发频率：从最差 1Hz 降到 0.2Hz（约 5×）
  - 透明优化，UI 不暴露切换；snapshot 暴露 `adaptiveMode` / `effectiveIntervalMs` 用于调试
  - 用户设置 ≥ 5s 时 adaptive 不再额外放慢（已经够慢）
  - 截图按钮 / 切文件夹 / 启用监听都会重置到 normal
- **重试倒计时**：错误状态文案从「5 秒后自动重试」改为「将在 N 秒后重试」，N 实时递减
  - `state.retryAt` 记录重试 deadline
  - `retryTicker` 每秒 tick 重新渲染
  - 倒计时归零或恢复 running 自动清除 ticker
- **最近导入列表**：替代 M3 的单条卡片
  - `state.recentImports` 数组，cap = 5（最新在顶）
  - 单图剪贴板、截图按钮、多文件批量都会写入
  - UI 滚动列表展示，超过容器高度（156px）出滚动条
  - 每条卡片：文件名 + 时间戳 + 目标文件夹标签

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
