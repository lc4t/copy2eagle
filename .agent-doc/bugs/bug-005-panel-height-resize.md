# Bug 005 — Panel Height Resize Limit

## Intent

修复插件面板只能横向扩展、纵向在高级设置仍有大量内容时过早触顶的问题。

## Constraints

- 保持默认窗口紧凑，不改主流程和 UI 布局。
- 不重新启用 macOS 全屏或最大化，避免 v1.5.1 的黑屏回归。
- 继续使用 Eagle 官方 manifest 窗口尺寸字段。

## Decision

将 `manifest.main.maxHeight` 从 640 放宽到 960；保留默认高度 540、最小高度 480、`resizable: true`、`fullscreenable: false` 和 `maximizable: false`。

## Evidence

- [x] 2026-06-15 用户截图外框约 668pt，扣除标题栏后与 640 内容区上限吻合
- [x] Eagle 官方文档确认 `maxHeight` 为窗口最大高度，`resizable` 控制窗口尺寸调整
- [x] 自动检查约束 `maxHeight >= 900`，并锁定不可全屏、不可最大化
- [x] 2026-06-15 覆盖新 manifest 并重开面板后，用户确认可继续向下拉高

## Impact

- 仅影响窗口允许的最大纵向尺寸。
- 用户可在高分辨率屏幕上展开更多高级设置，仍可保持原默认大小。
- 回滚方式：将 `maxHeight` 恢复为 640。

## Learnings

- `resizable: true` 不代表两个方向都有足够调整空间；最大尺寸可能让某个方向看起来完全不可拉伸。
- 长表单窗口应把默认尺寸与最大尺寸分开设计，不能用过小上限解决全屏问题。
