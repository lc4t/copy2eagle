# Plan — Eagle Clipboard Watcher

> 里程碑分解。每个里程碑对应一个 Session。完成后执行 `milestone-done`。

## 里程碑总览

| # | 名称 | 状态 | 预计产物 | GitHub Issue |
|---|---|---|---|---|
| M1 | 项目初始化 | 🔄 In Progress | 治理文件、目录、README、LICENSE、`.gitignore` | - |
| M2 | 插件骨架 + 配置面板 | ⬜ Todo | `manifest.json` / `index.html` / `js/ui.js` / 文件夹选择 / 开关 / 配置持久化 | - |
| M3 | 剪贴板监听 + 导入（核心 F1/F3/F4 修订版） | ⬜ Todo | 轮询 + 按文件夹 hash 集合 + 启动期回填 + `duplicateStrategy` 用户开关 + tmp 文件 + `addFromPath` | - |
| M4 | macOS 截图监听（F2） | ⬜ Todo | 截图目录自动检测 + 文件监听 + 500ms 节流 + 文件名正则 | - |
| M5 | 状态/通知/错误处理（F8/F9 + §5） | ⬜ Todo | 状态指示灯、今日计数、最近导入、通知开关、错误展示 | - |
| M6 | 打包 + 本地端到端验证 | ⬜ Todo | `.eagleplugin` 包、安装文档、截图证据 | - |
| M7 | 开源发布准备 | ⬜ Todo | README 完善、CHANGELOG v1.0.0、Plugin Center 提交材料 | - |

## 当前里程碑：M1

- [x] 创建 `docs/` `.agent-doc/` 目录骨架
- [x] 把 `PRD.md` 移入 `docs/prd.md`
- [x] 生成 `AGENTS.md` / `CLAUDE.md` / `AGENT.RULES.md`
- [x] 生成 `docs/architecture.md` / `decisions.md` / `CHANGELOG.md`
- [x] 生成 `.agent-doc/` 最小集（plan / progress / chat-summary / knowledge / relearning-log）
- [ ] 生成 `README.md` / `LICENSE` / `.gitignore`
- [ ] 用户确认后初始 commit
- [ ] 用户确认是否启用 GitHub Issues / entire / frontend-design Skill

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
- **M4** 难点：`fs.watch` 在 macOS 上的事件去重（同一文件可能多次触发），`com.apple.screencapture` 用户改默认目录后的热更新（v1.x 接受重启生效）。
- **M5** 难点：错误展示要 actionable，不只是 stacktrace；通知节流避免连续导入炸推送。
- **M6** 必须在干净的 Eagle 环境下测试（避免开发期残留 `extraData`）。

## 遗留问题

- [ ] `manifest.json.id` 临时占位 `CLIPBOARD_WATCHER_001`，M7 提交 Plugin Center 前替换真实 ID
- [ ] Windows 截图监听（Snipping Tool 文件路径）延后至 v1.1，本期不实现
