# Bug 009 — Windows Win+Shift+S Screenshot Not Detected

## Intent

修复 Windows 测试中发现的 `Win+Shift+S` 截图进入剪贴板后没有自动入库的问题。

## Constraints

- macOS 仍需避免无谓 `readImage()`，以降低 macOS 14+ “已粘贴自 Eagle”通知频率。
- Windows 没有同类系统横幅顾虑，可以直接读取剪贴板图片作为兜底。
- 不改变 Plugin ID。

## Decision

1. 版本升为 v1.5.6，作为新的 Windows 测试包。
2. 在 Windows 上，当 `eagle.clipboard.has(...)` 没有匹配到图片格式时，仍尝试 `eagle.clipboard.readImage()`。
3. 仅当 `readImage()` 返回非空图片时继续 hash / 导入。
4. 增加自动测试模拟：Windows 上所有 format probe 都返回 false，但 `readImage()` 能读到截图。

## Evidence

- [x] 用户反馈：Windows 可按 P 找到插件，可选择文件夹，打开开关后显示运行，但 `Win+Shift+S` 截图未自动保存。
- [x] 代码审查：原逻辑只有 `probe.format` 为真才调用 `readImage()`。
- [x] `npm test`：14 checks passed
- [x] 全部 JavaScript `node --check` 通过
- [x] `npm run pack`：6 个审核文件，163,907 bytes
- [x] 包内 manifest：version `1.5.6`，`platform: "all"`，`devTools: false`
- [x] 包 SHA-256：`b439348047931f55826a1c71a9c66f61760d9103fda997b5a19e47327c01691a`
- [ ] Windows 复测

## Impact

- Windows `Win+Shift+S` 截图应能在进入剪贴板后被自动导入。
- Windows 空剪贴板时会多一次 `readImage()` 空读，预期成本可接受。
- macOS 路径不变。

## Learnings

- Windows / Eagle 的剪贴板图片可读性不能只依赖 `eagle.clipboard.has(format)`；`readImage()` 成功才是最终信号。
