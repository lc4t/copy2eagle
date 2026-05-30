# Chat Summary

> 对话中产生的可复用经验。每次 commit 前检查是否需要更新；relearning 时回写母版。

## 开发习惯

- M2 Session：Eagle 插件骨架走"plugin.js 挂 `window.ClipboardWatcher` + ui.js 挂 `window.ClipboardWatcherUI`"的命名空间约定，避免模块系统依赖。两边通过 `getSnapshot()` 单向取状态、`saveConfig({patch})` 单向改状态，UI 只渲染不持状态。
- 配置规范化 `normalizeConfig` 集中在 plugin.js，所有外部输入（`extraData`、UI 事件）入口都过一遍，避免脏数据扩散。
- `safeAction(label, fn)` 在 ui.js 兜底所有异步事件，render() 必走 finally，保证错误也能反馈到 UI。

## 规则修正

<!-- 例：AGENTS.md 应补充 Eagle 插件打包前的 `manifest.json` JSON 校验步骤 -->

## 工具经验

<!-- 例：`defaults read com.apple.screencapture location` 在用户未自定义截图目录时返回空字符串，要回退到 ~/Desktop -->

## 计划偏差

<!-- 例：plan.md 预估 M3 为 1 个 Session 实际花了 2 个（Eagle API 文档需现查） -->
