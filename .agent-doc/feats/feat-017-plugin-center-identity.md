# Feat 017 — Plugin Center Identity

## Intent

冻结 v1.5.3 首次 Eagle Plugin Center 提交的名称、许可、Plugin ID、支持平台和正式图标，并让运行时、manifest 与审核材料保持一致。

## Constraints

- 保留现有安装的配置升级连续性。
- 对没有真机覆盖的平台准确披露验证状态和功能差异。
- 正式图标需至少 256×256 PNG、透明背景，并在 32×32 下可辨识。
- 不改变插件核心导入流程。

## Decision

1. 中文主名称和 manifest 名称使用「剪贴板图片留存」，英文审核别名使用 `Clipboard Image Archive`。
2. License 从 PolyForm Noncommercial 改为 MIT。
3. 保留既有 Plugin ID `CLIPBOARD_WATCHER_001`；仅在提交后台明确拒绝时再迁移。
4. `manifest.platform` 设为 `all`；恢复 Windows PowerShell FileDropList 分支，不声明 Linux 支持。
5. 使用 F1 正式图标：蓝色剪贴板图片流入归档盒，512×512 RGBA。

## Evidence

- [x] manifest / package / UI / README / submission 文案一致
- [x] LICENSE 为 MIT，package metadata 为 MIT
- [x] logo 为 512×512 RGBA，32×32 缩略图可读
- [x] runtime 包含 Windows PowerShell 分支，不含 Eagle 未分发平台的 wl-paste / xclip
- [x] Windows 多文件分支有注入式自动回归测试
- [x] Eagle 4.0.0 macOS 安装、服务启动、剪贴板导入与短窗口去重基线验证
- [x] Eagle `P` 可检索中文名称，面板可打开并正常基础使用
- [x] macOS 截图按钮成功入库
- [ ] Eagle 交互式功能完整人工矩阵
- [x] Plugin Center 封面与 3 张 1280×800 脱敏截图

## Impact

- 用户可在 Plugin Center 用中文名称搜索。
- MIT 允许商业使用、修改与再分发。
- macOS 和 Windows 均可安装；Windows 暂无真机证据，内置截图按钮保持 macOS-only。
- 既有 Plugin ID 保持不变，不主动制造 localStorage 配置迁移。

## Learnings

- 商店平台与功能差异必须分开披露：允许安装不等于每个按钮完全一致。
- 商店名称可以本地化，而 repo、npm package 和内部日志前缀无需同步重命名。
- Plugin ID 一旦有公开安装历史，应优先保持稳定。
