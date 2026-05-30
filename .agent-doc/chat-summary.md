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

## 规则修正

<!-- 例：AGENTS.md 应补充 Eagle 插件打包前的 `manifest.json` JSON 校验步骤 -->

## 工具经验

<!-- 例：`defaults read com.apple.screencapture location` 在用户未自定义截图目录时返回空字符串，要回退到 ~/Desktop -->

## 计划偏差

<!-- 例：plan.md 预估 M3 为 1 个 Session 实际花了 2 个（Eagle API 文档需现查） -->
