# Bug 010 — Windows Screenshot Blocked By FileDrop-Like Format

## Intent

修复 v1.5.6 Windows 测试中 `Win+Shift+S` 截图运行时不自动导入、但重启 Eagle 后会导入最后一次截图的问题。

## Constraints

- Windows `Win+Shift+S` 必须在插件运行中及时入库。
- macOS Finder 复制文件时仍不能导入系统预览 icon。
- 多文件导入逻辑仍需保留，且默认关闭时不能误导入文件列表。

## Decision

1. 版本升为 v1.5.7，作为新的 Windows 测试包。
2. Windows 改为先尝试 `eagle.clipboard.readImage()`；读不到图片时再处理 `CF_HDROP/FileDrop` 文件列表。
3. macOS 保持文件 URL 优先，维持 v1.2.1 修复过的 Finder 预览 icon 保护。
4. 增加自动测试覆盖 Windows false-positive FileDrop 和 macOS Finder 保护回归。

## Evidence

- [x] 用户反馈：v1.5.6 截图后不会自动添加，插件无反应；重启 Eagle 后会把最后一次截图添加进来。
- [x] 代码审查：v1.5.6 在 Windows direct `readImage()` 前仍先处理 file URL 分支。
- [x] `npm test`：16 checks passed
- [x] 全部 JavaScript `node --check` 通过
- [x] `npm run pack`：6 个审核文件，164,059 bytes
- [x] 包内 manifest：version `1.5.7`，`platform: "all"`，`devTools: false`
- [x] 包 SHA-256：`73d464fa8eb7e416e42f37b960902c25faef433cae9fe71e8f4f442e663d417c`
- [x] GitHub Windows test pre-release：https://github.com/lc4t/copy2eagle/releases/tag/win-test-v1.5.7-20260705
- [x] Windows 复测：v1.5.7 仍不会实时识别 `Win+Shift+S`
- [x] 决策：Windows 正式支持暂缓，v1.5.8 Plugin Center 包回退为 macOS-only

## Impact

- v1.5.7 未解决 Windows 真实运行问题，不能作为正式 Windows 支持依据。
- Windows 截图仍需在 Windows 真机上继续诊断 Eagle 运行时剪贴板行为。
- Windows 复制文件列表时，如果没有可读图片，仍会走原来的多文件路径。
- macOS 行为不变，并作为 v1.5.8 正式发布范围。

## Learnings

- Windows 剪贴板格式候选只能作为线索，不能早于 bitmap 读取成为截图导入的阻断条件。
