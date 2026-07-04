# Project Knowledge Base

> 通过 MCP / 搜索 / Eagle 官方文档 / 实测获取的、对项目决策有影响的外部知识。

### K7: Eagle 公开 API 不含 `eagle.extraData`

- **来源**：https://developer.eagle.cool/plugin-api/llms-full.txt + https://developer.eagle.cool/plugin-api/api/folder
- **获取时间**：2026-05-30
- **知识摘要**：PRD §3.4 列举的 `eagle.extraData` 在 Eagle 官方文档中查无此 API。M2 真机运行时 `await eagle.extraData.set(...)` 抛错，导致"配置保存失败"。Eagle 文档原话：「To ensure data security, use the API-provided save() method ... avoid directly modifying any files under the Eagle resource library」——但只覆盖了 item/folder 等 Eagle 自身资源，并未提供插件自身配置的持久化 API。
- **项目影响**：ADR-010 决定改用 webview 原生 `localStorage`（同步、按 origin 隔离、10MB+ 容量）。**所有 PRD 中 `eagle.extraData` 字样应理解为 localStorage（PRD §2.2 / §3.4 已修订）。**
- **时效性**：长期有效，除非 Eagle 后续公开新的 storage API。

### K8: Eagle 主题 API 不是 `eagle.app.isDarkMode`

- **来源**：https://developer.eagle.cool/plugin-api/llms-full.txt
- **获取时间**：2026-05-30
- **知识摘要**：PRD §4.1 写的 `eagle.app.isDarkMode` 不存在。实际 API：
  - `const theme = await eagle.app.theme` → 返回 `'Auto' | 'LIGHT' | 'LIGHTGRAY' | 'GRAY' | 'DARK' | 'BLUE' | 'PURPLE'`
  - `eagle.onThemeChanged((theme) => {...})` 监听切换
- **项目影响**：M2.1 plugin.js / ui.js 已改用此 API；判定 dark 的逻辑：`/DARK|GRAY|BLUE|PURPLE/i.test(theme)`（深色系列主题都按 dark CSS 渲染）。
- **时效性**：长期有效。

### K9: Eagle 插件 manifest `main` 支持 maxWidth / maxHeight

- **来源**：https://developer.eagle.cool/plugin-api/llms-full.txt 引用 "minWidth, minHeight, maxWidth, maxHeight"
- **获取时间**：2026-05-30
- **知识摘要**：M2 反馈"插件窗口全屏"，原 manifest 只写了 width/height/minWidth/minHeight。修订时加入尺寸上限，并缩小默认 width: 380, height: 540。2026-06-15 真机确认 `maxHeight: 640` 会让高级设置面板过早触顶；纵向上限放宽为 960，同时继续用 `fullscreenable: false` / `maximizable: false` 防止全屏与最大化问题。
- **项目影响**：M2.1 加入窗口约束；v1.5.3 将 `maxHeight` 从 640 调整为 960。
- **时效性**：长期有效。

### K10: Eagle 文档明确 `addFromPath` 等方法 options 形态

- **来源**：https://developer.eagle.cool/plugin-api/llms-full.txt
- **获取时间**：2026-05-30
- **知识摘要**：`addFromURL` / `addFromBase64` / `addFromPath` 的 options 统一为 `{ name, website, tags: string[], folders: string[], annotation }`。`folders` 是 `string[]`（数组）—— 与 K1 一致，再次确认。`get(options)` 也接受 `folders: string[]`，可用于 M3 启动期回填查询。
- **项目影响**：M3 实现时 `eagle.item.get({ folders: [folderId] })` 是回填的主要入口。
- **时效性**：长期有效。

### K15: Eagle manifest 全键清单 + macOS 全屏陷阱（v1.5.1）

- **来源**：
  - https://developer.eagle.cool/plugin-api/llms-full.txt（已 fetch 验证）
  - v1.5.0 用户反馈：macOS 下 Eagle 全屏时插件面板跟着全屏 + 关闭黑屏
- **获取时间**：2026-06-03
- **知识摘要**：

  **Eagle 插件 manifest `main` 完整字段（v1.5.1 实测确认）**：
  | 字段 | 类型 | 默认 | 说明 |
  |---|---|---|---|
  | `url` | string | — | 入口 html |
  | `width` / `height` | number | — | 窗口初始尺寸 |
  | `minWidth` / `minHeight` | number | — | 最小尺寸 |
  | `maxWidth` / `maxHeight` | number | — | 最大尺寸 |
  | `alwaysOnTop` | bool | false | 置顶 |
  | `frame` | bool | true | 系统边框 |
  | `fullscreenable` | bool | **true** | **可全屏（macOS 陷阱）** |
  | `maximizable` | bool | true | 可最大化 |
  | `minimizable` | bool | true | 可最小化 |
  | `resizable` | bool | true | 可调整大小 |
  | `backgroundColor` | string | #FFF | 背景色 |
  | `childWindow` | bool | false | 附在主窗（继承 macOS Space）|
  | `followCursor` | bool | false | 跟随光标位置 |
  | `multiple` | bool | false | 允许多开 |
  | `runAfterInstall` | bool | false | 装完自启 |
  | `serviceMode` | bool | false | 后台常驻 |
  | `devTools` | bool | false | 开 DevTools |

  **macOS 全屏陷阱（v1.5.1 修）**：
  - `fullscreenable` 默认 true → macOS 上 Eagle 进全屏 Space 时，插件窗口跟随父 Space → 转场动画 → 关闭时黑屏一闪
  - 修法：插件类窗口（特别是 service mode 浮动面板）**应显式 `fullscreenable: false`**
  - 配套：`maximizable: false` 避免 macOS 绿色按钮退化的 maximize 行为也触发尺寸跳变
  - 可配合合理的 `maxWidth` / `maxHeight` 防止异常膨胀，但上限不能小到妨碍长表单；本项目纵向使用 960

  **不在文档里的字段**：
  - `transparent` / `modal` / `parent` / `type` / `hasShadow` / `focusable` / `skipTaskbar` / `simpleFullscreen` / `kiosk` — 未列出，不要在 manifest 里写（Eagle 可能忽略也可能报错）

- **项目影响**：
  - v1.5.1 修复
  - 后续新建 Eagle 插件 manifest 时，**默认加** `fullscreenable: false` + `maximizable: false`
- **时效性**：长期有效；除非 Eagle 修改默认行为（不太可能）。

### K16: Eagle Plugin Center 当前发布要求（2026-06-13 核验）

- **来源**：
  - https://developer.eagle.cool/plugin-api/distribution/prepare
  - https://developer.eagle.cool/plugin-api/distribution/package
  - https://developer.eagle.cool/plugin-api/distribution/publish
  - https://developer.eagle.cool/plugin-api/distribution/developer-policies
  - https://community-en.eagle.cool/plugins
  - https://en.eagle.cool/download
- **获取时间**：2026-06-13
- **知识摘要**：
  - 名称应清楚表达单一用途，建议不超过 30 个字符或 6 个单词，以名词为主；英文单词使用标题式大小写。
  - 商店图标必须使用 PNG，分辨率至少 256x256，并按官方模板留出内边距。
  - 建议详情页至少提供 3 张真实功能图片。
  - 若插件需要额外配置、系统设置或启动外部进程，应在提交包根目录放 README，供审核人员测试。
  - 官方发布流程：导出 `.eagleplugin` → Plugin Center 右上角 Submit → Submit Plugin → 上传 → 填介绍与版本更新 → 提交审核。
  - 登录态提交入口为 https://community-en.eagle.cool/my/plugin/publish ；公开文档只把 `manifest.id` 定义为 Plugin ID，没有说明格式。
  - 2026-06-15 上传 v1.5.3 包时，提交后台明确要求有效 UUID；v1.5.4 起固定使用 UUID v4 `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`。
  - 项目影响：商店发布后不得再更换该 UUID；旧可读 ID 安装需先卸载，且不能假设跨 ID 共享 localStorage 或单 owner lease。
  - 官方 manifest 文档列出 `platform` 合法值：`all`、`mac`、`win`。当前复审包使用 `platform: "all"`，并在 reviewer notes 中解释为 macOS / Windows 支持。
  - 2026-06-17 上传封面时，提交后台要求首图必须大于 1560×1040 px；2026-07-04 审核反馈进一步指出错误比例会被退回。当前首图改为 3:2 的 `assets/plugin-center/cover-1800x1200.png`。
  - 提交时必须提供用户支持联系方式。
  - 审核政策要求功能完整可测试、准确披露限制、不得混淆或压缩代码，并应兼容 macOS 与 Windows。
  - manifest 官方支持 `platform: "mac"` 和 `"all"`；2026-06-14 用户将发布策略改为 macOS / Windows，允许 Windows 用户先用并按反馈修复。
  - Windows 普通图片剪贴板与 macOS 共用 Electron `readImage()`；资源管理器多文件需 PowerShell `Get-Clipboard -Format FileDropList`；内置截图按钮仍是 macOS 专属。
  - 2026-07-05 Windows smoke test 发现：`Win+Shift+S` 截图可能无法被 `eagle.clipboard.has(image/*)` 识别，但应尝试 `readImage()` 兜底；Windows 没有 macOS “已粘贴自 Eagle”横幅约束。
  - Eagle 官方下载页当前只提供 Windows 与 macOS 安装包；商店平台材料不应把代码中的 Linux fallback 宣称为正式支持平台。
  - 2026-06-13 检查英文 Plugin Center 列表，未发现原名 `Clipboard Watcher` 的重名；最终中文商店名决定为「剪贴板图片留存」。
- **项目影响**：
  - v1.5.2 的 128x128 占位图不满足要求；v1.5.3 已替换为 512x512 RGBA 正式图标。
  - v1.5.3 起审核包包含 README 与 LICENSE，并明确披露支持平台会调用的 `screencapture` 和 `osascript` 本地系统进程。
  - Plugin Center 首图必须使用 1800×1200 这类大于 1560×1040 px 且符合 3:2 比例的尺寸；不要再上传旧的 1280×800 或 1920×1200 封面。
  - manifest 名称使用「剪贴板图片留存」，英文审核别名为 `Clipboard Image Archive`。
  - macOS 安装与剪贴板导入基线已于 2026-06-14 在 Eagle 4.0.0 完成；上架前仍需至少 3 张真实截图和交互式功能人工矩阵。
- **时效性**：Plugin Center 政策可能更新；每次正式提交前重新核验。

### K14: 剪贴板图片来源 APP 无法识别 + 多文件路径需 shell-out

- **来源**：
  - macOS NSPasteboard 文档（无 source app metadata 公开 API）
  - https://developer.eagle.cool/plugin-api/api/clipboard（无 readURLs/readBuffer）
  - 实际尝试 osascript 与 PowerShell 验证可行性
- **获取时间**：2026-05-31
- **知识摘要**：

  **来源 APP 不可识别**：
  - macOS NSPasteboard 不暴露 source application metadata
  - Electron 与 Eagle 的 clipboard API 都没有 `getOwner()` / `source` 之类接口
  - 结论：「这张图来自 Safari / WeChat / Word」做不到，**别承诺**

  **多文件路径需 shell-out**：
  - Eagle 的 `eagle.clipboard` 只有 `has(format)` 和 `readImage()`，没有 `readBuffer` / `readURLs` / `read`
  - macOS：`osascript -e 'the clipboard as «class furl»'` 配合 `POSIX path of` 可拉路径列表
  - Windows：`powershell -Command "Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }"`
  - Linux：无标准工具，本项目跳过

- **项目影响**：
  - F3 命名只能用「时间 + 尺寸 + Screenshot/Clipboard 区分」，不暴露不可知信息
  - F10 多文件批量必须 shell-out，加 2s 超时 + 50 张上限 + 默认关
  - 跨平台兼容：Linux 多文件复制不实现
- **时效性**：长期有效，除非 Eagle 透出 NSPasteboard source / 增加文件 URL 读取 API。

### K13: Eagle 插件用 `eagle.clipboard`，不是 `require('electron').clipboard`

- **来源**：
  - https://developer.eagle.cool/plugin-api/api/clipboard（实际接口）
  - https://developer.eagle.cool/plugin-api/llms-full.txt（全量文档检索：未提及 `require('electron')`）
  - M3 真机运行直接报错"剪贴板监听出错，5 秒后自动重试"——`require('electron').clipboard` 在 Eagle 插件 webview 不可用，destructure 得到 undefined，调 `.availableFormats()` 抛错
- **获取时间**：2026-05-31
- **知识摘要**：
  - **Eagle 插件 webview 不暴露 Electron 渲染进程的 `electron` 模块**——`require('electron')` 不可用
  - 剪贴板访问走 `eagle.clipboard` 命名空间
  - 暴露：
    - `eagle.clipboard.has(format)` — 探测特定 format
    - `eagle.clipboard.readImage()` — 返回 NativeImage（仍然是 Electron 的 NativeImage 类型，`.isEmpty() / .toPNG() / .toJPEG()` 可用）
  - **不暴露**：`availableFormats()` / `readBuffer()` / `read()` / `changeCount`
- **项目影响**：
  - M3 原代码用 `availableFormats()` 整批查 format 不可行 → M3.1 改为 `has()` 依次试候选 format 串（`image/png` / `image/jpeg` / `image/tiff` / `image/bmp` / `image/gif` / `public.png` / `public.tiff` / `public.jpeg` / `public.image`）
  - 不识别的 format 字符串 `has()` 可能抛错，候选列表每个都 try/catch
  - format 字符串到底用 MIME 风格还是 UTI 风格 Eagle 文档未明示，本项目按可能性扔进候选列表，优先 MIME
- **时效性**：依赖 Eagle 插件 SDK 当前版本，若 Eagle 后续开放 Electron 直接访问可放宽。

### K12: 剪贴板权限与 macOS Sonoma "已粘贴自" 横幅（M3.1 修订）

- **来源**：
  - https://www.electronjs.org/docs/latest/api/clipboard（Electron clipboard 全量 API）
  - macOS 14 Sonoma 隐私行为（Apple 2023 WWDC 公开材料）
  - 业界做法（Maccy / Paste / Raycast / 1Password 等长期运行的剪贴板工具）
- **获取时间**：2026-05-30
- **知识摘要**：

  **权限层面**：
  - macOS / Windows 均**不需要显式申请权限**——没有 entitlement 或 TCC 提示
  - 插件运行在 Eagle 进程内，剪贴板访问署名为 Eagle，不需要单独申请

  **macOS 14+ 横幅问题（真正的痛点）**：
  - macOS 14 Sonoma 起，应用读取剪贴板**内容**（`NSPasteboard.dataForType:`）会触发"已粘贴自 XXX"横幅
  - 1Hz 轮询 `clipboard.readImage()` 会刷屏，UX 灾难
  - 触发的是「读内容」，**不是「查格式」**——`availableFormats()` 是轻量元数据查询，业界默认认为不触发横幅

  **Eagle 插件层 API 现状（M3.1 修正，K13）**：
  - Eagle 不暴露 `availableFormats()`，只有 `eagle.clipboard.has(format)` 单 format 探测
  - 没有 `changeCount` / 时间戳类接口
  - 实际可用策略：
    1. `eagle.clipboard.has(fmt)` 依次试图片 format 候选 → 全部 false 整轮跳过（不触发横幅）
    2. 探到任一为 true → `eagle.clipboard.readImage()`（此次可能触发横幅）
    3. 立即 `toPNG()` → hash → 与上次比对：相同则不再导入

- **项目影响**：
  - 剪贴板**有图持续不变**时，每轮仍要 readImage 才能判定 hash 是否变化，此时**每轮触发一次横幅**
  - 剪贴板**没图**时，仅 `has()` 探测，**不触发横幅**
  - 横幅刷屏的最坏情况：剪贴板留着图 + 1Hz 间隔 → 每秒一次。**建议用户在 macOS 14+ 把间隔调到 2–5s**
  - M4 候选项：adaptive polling（同 hash 持续 N 轮后放慢，hash 变化时立即回到默认间隔），可显著降低横幅触发频率
  - README 与面板必须明示这一点
- **时效性**：依赖 Eagle / macOS / Electron 行为；macOS 15 / Eagle 后续版本若放开 changeCount 可彻底解决。

### K1: Eagle `addFromPath` 的 `folders` 是数组

- **来源**：PRD §3.7（用户已踩坑）
- **获取时间**：2026-05-30
- **知识摘要**：`eagle.item.addFromPath(filePath, opts)` 的 `opts.folders` 必须传 `[folderId]` 数组形式，不是 `folderId` 字符串。
- **项目影响**：M3 实现 + 所有相关代码审查清单的强制项。
- **时效性**：长期有效（Eagle API 公开契约）。

### K2: macOS 截图默认目录读取（v1.1 弃用）

- **来源**：PRD §3.6（v1.0 草案）
- **获取时间**：2026-05-30
- **知识摘要（已作废）**：`defaults read com.apple.screencapture location` 可读取用户设置；命令失败或返回空时回退 `~/Desktop`。**v1.1 改剪贴板单路径后（ADR-004 修订 / ADR-011），此知识不再使用。**
- **替代方案**：macOS 截图改用 `screencapture -ic`（interactive selection → clipboard），由插件主面板「立即截图」按钮触发。
- **时效性**：归档保留，未来若重新做文件夹监听可再次启用。

### K11: macOS `screencapture -ic` 直接进剪贴板

- **来源**：macOS 系统命令 `man screencapture`
- **获取时间**：2026-05-30
- **知识摘要**：`screencapture -ic`
  - `-i` interactive，弹选区光标
  - `-c` capture to clipboard，不写文件
  - 用户取消（ESC）时命令以 0 退出但剪贴板不更新，需由轮询自然忽略
- **项目影响**：M2.1 主面板「立即截图」按钮 + M3 轮询接力。
- **时效性**：长期有效。

### K3: 剪贴板轻量 hash 算法

- **来源**：PRD §3.5 / §2.1 F4（v1.1 修订）
- **获取时间**：2026-05-30
- **知识摘要**：`buffer.length + '_' + buffer.slice(0, 256).toString('base64').slice(0, 32)`，无需引入 crypto 库。**v1.1 修订**：30 秒滑动窗口仅在 `duplicateStrategy === 'allow'` 时启用（剪贴板防抖）；`skip`（默认）下使用按 folderId 维度的进程内 `Set<hash>` 做实际去重，启动/切换文件夹时通过 `eagle.item.get` 回填。详见 ADR-009。
- **项目影响**：M3 实现核心；避免依赖膨胀；用户控制重复策略。
- **时效性**：长期有效，hash 仅用于去重而非安全。

### K4: Eagle 截图文件名正则（双语）

- **来源**：PRD §2.1 F2
- **获取时间**：2026-05-30
- **知识摘要**：
  - 中文：`截屏 YYYY-MM-DD HH.MM.SS.png`
  - 英文：`Screenshot YYYY-MM-DD at HH.MM.SS.png`
- **项目影响**：M4 文件名匹配必须双语覆盖。
- **时效性**：随 macOS 版本可能调整，每个大版本验证一次。

### K6: Eagle 官方推荐 npm 作为包管理

- **来源**：https://developer.eagle.cool/plugin-api/tutorial/3rd-modules
- **获取时间**：2026-05-30
- **知识摘要**：Eagle 文档明确说 npm 是「the official package management tool for Node.js」，并以 `npm install is_js --save` 作为引入第三方模块的示例。文档未提及 pnpm/yarn，也未推荐特定 scaffold/build 工具。
- **项目影响**：ADR-007 固化 npm；禁止 pnpm/yarn 锁文件；MVP 不引入构建工具。
- **时效性**：长期有效（Eagle 官方推荐基线）。

### K5: `serviceMode` 与 CPU 预算

- **来源**：PRD §8.5
- **获取时间**：2026-05-30
- **知识摘要**：面板关闭、`serviceMode: true` 后台运行时 CPU 占用应低于 0.5%。每秒 `clipboard.readImage()` 在 macOS 实测无明显开销。
- **项目影响**：M3 默认轮询 1000ms；M6 端到端验证含 CPU 占用监测。
- **时效性**：实测验证，硬件相关。
