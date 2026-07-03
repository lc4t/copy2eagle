# Bug 008 — Plugin Center Review Rejection: Cover Ratio and Platform Clarity

## Intent

处理 2026-07-04 Eagle Plugin Center 审核退回意见：封面比例看起来不符合规范，以及平台支持说明不够明确。

## Constraints

- 保持既有固定 Plugin ID `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`。
- 不回退 Windows 支持；按官方 manifest 文档使用 `platform: "all"`。
- 明确说明截图按钮仅 macOS，Windows 使用 `Win+Shift+S` 后由剪贴板自动入库。
- 首图不能再使用 16:10 比例的 `1920×1200`。

## Decision

1. 版本升为 v1.5.5，作为复审包。
2. 首图改为 `assets/plugin-center/cover-1800x1200.png`，3:2 比例，尺寸大于 1560×1040 px。
3. 保留 `manifest.platform = "all"`；依据 Eagle 官方文档，`all` 为合法平台值。
4. 在 README、提交材料和 reviewer notes 中明确 macOS / Windows 支持边界。

## Evidence

- [x] 官方 manifest 文档列出 `platform` 支持 `all` / `mac` / `win`
- [x] 包内 manifest 已包含顶层 `"platform": "all"`
- [x] 新首图为 1800×1200
- [x] 新首图视觉复查无拉伸
- [x] `npm test`：13 checks passed
- [x] 全部 JavaScript `node --check` 通过
- [x] `swiftc -typecheck build/store-assets.swift` 通过（仅 Xcode 缓存 / FSEvents 警告）
- [x] `npm run pack`：6 个审核文件，163,835 bytes
- [x] 包内 manifest：version `1.5.5`，`platform: "all"`，`devTools: false`
- [x] 包 SHA-256：`9e2ac18bd43e644c9020cb009a3003c7f5fcb1c488be1e5340cd42c4add53cd0`
- [x] 首图 SHA-256：`b494e4366e06533e2eccb237d0a950ff785c9ffbab832d26816377c94943951d`

## Impact

- 复审材料能明确回应两个退回点。
- Windows 用户仍可安装使用剪贴板图片与多文件导入；内置截图按钮差异通过文案披露。

## Learnings

- Plugin Center 首图不仅要超过尺寸门槛，也要符合审核预期比例；1560×1040 暗示 3:2。
- 即使 manifest 已设 `platform: "all"`，审核备注也应直接说明平台值和功能边界，减少误读。
