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
- **知识摘要**：M2 反馈"插件窗口全屏"，原 manifest 只写了 width/height/minWidth/minHeight。修订时加入 `maxWidth: 460, maxHeight: 640`，并缩小默认 width: 380, height: 540。Eagle 在 serviceMode 下窗口仍是独立 popup，不约束就会被 Eagle 给出过大默认。
- **项目影响**：M2.1 manifest.json 已调整。
- **时效性**：长期有效。

### K10: Eagle 文档明确 `addFromPath` 等方法 options 形态

- **来源**：https://developer.eagle.cool/plugin-api/llms-full.txt
- **获取时间**：2026-05-30
- **知识摘要**：`addFromURL` / `addFromBase64` / `addFromPath` 的 options 统一为 `{ name, website, tags: string[], folders: string[], annotation }`。`folders` 是 `string[]`（数组）—— 与 K1 一致，再次确认。`get(options)` 也接受 `folders: string[]`，可用于 M3 启动期回填查询。
- **项目影响**：M3 实现时 `eagle.item.get({ folders: [folderId] })` 是回填的主要入口。
- **时效性**：长期有效。

### K12: 剪贴板权限与 macOS Sonoma "已粘贴自" 横幅

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

  **Electron clipboard API 现状**：
  - 没有 `changeCount`（macOS 原生 `NSPasteboard.changeCount` 未透出）
  - 可用：`availableFormats()` / `has(format)`（experimental）/ `readImage()`
  - 业界 OK 的代理方案：先 `availableFormats()` 过滤 → 仅在含 `image/*` 时 `readImage()` → 再用 hash 比对，相同 hash 直接退出

- **项目影响**：
  - M3 实现时**必须**：先 `availableFormats()` 预判，仅在 `formats.some(f => f.startsWith('image/'))` 时 `readImage()`
  - 进一步：把上一帧的 formats 也缓存，formats 不变时连 `availableFormats()` 都可省（额外节流）
  - README 与面板加 macOS 用户提示，避免用户误以为"插件在偷窥"
- **时效性**：依赖 macOS / Electron 行为；macOS 15 / Electron 后续版本若改变，需重新评估。

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
