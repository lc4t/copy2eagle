# Bug 007 — Plugin Center Cover Requires Larger First Image

## Intent

修复 Plugin Center 上传封面时提示“首图必须大于 1560 x 1040 px”的问题，提供可直接上传的高分辨率首图。

## Constraints

- 不使用包含个人信息的原始截图。
- 不修改插件运行逻辑或发布包。
- 保持现有脱敏构图和商店文案一致。

## Decision

1. 新增 `assets/plugin-center/cover-1920x1200.png` 作为 Plugin Center 首图。（已被 Bug 008 取代）
2. 保留 3 张功能截图为 1280×800。
3. 更新生成脚本，使后续重新生成时首图直接输出 1920×1200。
4. 发布材料统一指向新首图，并记录后台尺寸要求。

## Evidence

- [x] `assets/plugin-center/cover-1920x1200.png` 尺寸为 1920×1200（尺寸达标，但比例在审核中被退回）
- [x] 视觉复查未发现新的隐私信息
- [x] `swiftc -typecheck build/store-assets.swift`

## Impact

- Plugin Center 首图上传尺寸门槛应解除；比例问题见 Bug 008。
- 旧 `cover-1280x800.png` 不再作为上传首图使用。

## Learnings

- Plugin Center 实际后台校验比此前设计资料更严格；首图尺寸需按后台错误信息维护，而不是只按早期 1280×800 设计假设。
