# Chat Summary

> 对话中产生的可复用经验。每次 commit 前检查是否需要更新；relearning 时回写母版。

## 开发习惯

- M2 Session：Eagle 插件骨架走"plugin.js 挂 `window.ClipboardWatcher` + ui.js 挂 `window.ClipboardWatcherUI`"的命名空间约定，避免模块系统依赖。两边通过 `getSnapshot()` 单向取状态、`saveConfig({patch})` 单向改状态，UI 只渲染不持状态。
- 配置规范化 `normalizeConfig` 集中在 plugin.js，所有外部输入（`extraData`、UI 事件）入口都过一遍，避免脏数据扩散。
- `safeAction(label, fn)` 在 ui.js 兜底所有异步事件，render() 必走 finally，保证错误也能反馈到 UI。
- M3 Session：polling 用 `setTimeout` 链 + `pollInFlight` 自锁，**别用 `setInterval`** —— interval 会在 readImage 比 interval 慢时堆积回调，行为难预测。
- macOS Sonoma 横幅缓解的核心是 `formatsKey` 缓存：format 数组未变 = 剪贴板未变（这是经验近似，不绝对，但对 image clipboard 足够精确）。读 `availableFormats()` 不触发横幅。
- 启动期回填要 yield（每 N 条 `await sleep(0)`）否则 1000+ item 的文件夹会卡 UI 几秒。
- `eagle.item.addFromPath` 返回 `Promise<itemId: string>`，**只是 id**——想要 metadata 还得 `eagle.item.getById(id)`。
- 通知节流（1.5s）必须做，否则连续粘贴会刷屏。
- M3.1 Session：**PRD 第三次写错 Eagle API**（前两次 `eagle.extraData` / `eagle.app.isDarkMode`，本次 `require('electron').clipboard`）。教训：**Eagle 插件 webview 不暴露 Electron 渲染进程模块**，所有 Electron-flavored API 都要走 `eagle.*` 命名空间；下次写新 API 之前先查 developer.eagle.cool 文档而不是按 Electron 习惯写。
- 错误日志一定要带 `err.stack`，不带的话 catch 之后只剩"undefined is not a function"这种无用信息。
- 对 Eagle API 完全没有的能力（如 `availableFormats()` / `changeCount`），不要硬撑"做和 macOS Sonoma 横幅彻底无关"，承认现实代价，给用户提供间隔调节是更诚实的方案。
- M5 Session：adaptive polling 的实现选了「2 档模式 + streak 计数」最简方案，没用复杂的指数退避——同 hash 持续 N 次就 idle，hash 变就 normal。可读性优先。
- 重试 ticker 跟 setTimeout 解耦：ticker 只刷 UI 文案，真正的重启 logic 还在原 setTimeout 里。否则两边状态机会撞车。
- 用户反馈"设置太开发者视角"——以后写 hint 时别再写 osascript / format / 索引 / hash 这种实现词，按"用户在意的动作和结果"写。

## 规则修正

<!-- 例：AGENTS.md 应补充 Eagle 插件打包前的 `manifest.json` JSON 校验步骤 -->

## 工具经验

<!-- 例：`defaults read com.apple.screencapture location` 在用户未自定义截图目录时返回空字符串，要回退到 ~/Desktop -->

## 计划偏差

<!-- 例：plan.md 预估 M3 为 1 个 Session 实际花了 2 个（Eagle API 文档需现查） -->
