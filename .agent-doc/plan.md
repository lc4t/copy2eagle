# Plan — Eagle Clipboard Watcher

> 里程碑分解。每个里程碑对应一个 Session。完成后执行 `milestone-done`。

## 里程碑总览

| # | 名称 | 状态 | 预计产物 | GitHub Issue |
|---|---|---|---|---|
| M1 | 项目初始化 | ✅ Done | 治理文件、目录、README、LICENSE、`.gitignore` | - |
| M2 | 插件骨架 + 配置面板 | ✅ Done | `manifest.json` / `index.html` / `js/ui.js` / 文件夹选择 / 开关 / 配置持久化 | - |
| M2.1 | M2 bug 修复 + scope 变更（剪贴板单路径） | 🔄 In Progress | localStorage、窗口尺寸、hostname tag、theme、PRD F2 重写、ADR-010/011 | - |
| M3 | 剪贴板监听 + 导入 + 截图按钮 | ⬜ Todo | 轮询 + 按文件夹 hash 集合 + 启动期回填 + `duplicateStrategy` 分支 + tmp 文件 + `addFromPath` + macOS `screencapture -ic` | - |
| ~~M4~~ | ~~macOS 截图目录监听~~ | ❌ 弃用（ADR-004 修订） | 合并入 M3 截图按钮 | - |
| M4(新) | 状态/通知/错误处理（F8/F9 + §5） | ⬜ Todo | 状态指示灯、今日计数、最近导入、通知开关、错误展示 | - |
| M5(新) | 打包 + 本地端到端验证 | ⬜ Todo | `.eagleplugin` 包、安装文档、截图证据 | - |
| M6(新) | 开源发布准备 | ⬜ Todo | README 完善、CHANGELOG v1.0.0、Plugin Center 提交材料 | - |

## 当前里程碑：M2.1 — bug 修复 + scope 变更

- [x] 4 项 M2 bug：localStorage / 窗口尺寸 / hostname tag / theme
- [x] PRD F2 重写为剪贴板单路径 + 截图按钮（v1.1 修订）
- [x] architecture 移除截图 watcher，新增截图按钮路径
- [x] 修订 ADR-004 + 新增 ADR-010 / ADR-011
- [x] UI 移除截图目录字段，新增「立即截图」按钮
- [ ] 更新 progress / CHANGELOG / knowledge
- [ ] commit + push

## 下一里程碑：M2 — 插件骨架 + 配置面板

**Intent**：搭好可在 Eagle 中本地加载的最小插件结构，能展示 UI 面板、读写 `eagle.extraData`、列出文件夹并选定，但不实际监听。
**预计产物**：
- `manifest.json`（`serviceMode: true`，但开发期可临时切普通 Window Plugin 调试，commit 前切回）
- `logo.png`（占位 128×128 即可，M7 替换正式版）
- `index.html` + `js/ui.js`：状态行（指示灯+计数）/ 文件夹下拉 / 开关 / 高级设置折叠区
- 配置 schema：`enabled` / `folderId` / `intervalMs` / `tags` / `screenshotDir` / `notifyOnImport`
- `eagle.onPluginCreate` 初始化、`eagle.onPluginShow` 刷新

**验收**：在 Eagle 中开发模式加载后能看到面板、选择文件夹、切换开关、刷新插件后状态保留。

## 后续里程碑要点

- **M3** 难点：
  - 启动期回填的耗时控制（`eagle.item.get` 大量结果 + 逐文件读 hash），需 UI「索引中…」状态与中断能力
  - 切换 folderId 时旧 hashSet 是否保留（建议丢弃，新文件夹重新回填，避免内存膨胀）
  - tmp 文件命名（含时间戳避免冲突）、`addFromPath` 完成后异步清理、轮询暂停（开关关闭时停 setInterval）
  - `duplicateStrategy` UI 切换时要清晰告诉用户「skip = 不重复进该文件夹 / allow = 允许重复但 30s 内同图不连击」
  - macOS 截图按钮调 `screencapture -ic` 是 fire-and-forget，结果通过轮询拾取——要注意快速连点的体验（v1.x 不做防抖，由 hash 去重兜底）
- **M4（新）** 难点：错误展示要 actionable，不只是 stacktrace；通知节流避免连续导入炸推送。
- **M5（新）** 必须在干净的 Eagle 环境下测试（避免开发期残留 localStorage / item 索引）。

## 遗留问题

- [ ] `manifest.json.id` 临时占位 `CLIPBOARD_WATCHER_001`，M7 提交 Plugin Center 前替换真实 ID
- [ ] Windows 截图监听（Snipping Tool 文件路径）延后至 v1.1，本期不实现
