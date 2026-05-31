# Plan — Eagle Clipboard Watcher

> 里程碑分解。每个里程碑对应一个 Session。完成后执行 `milestone-done`。

## 里程碑总览

| # | 名称 | 状态 | 预计产物 | GitHub Issue |
|---|---|---|---|---|
| M1 | 项目初始化 | ✅ Done | 治理文件、目录、README、LICENSE、`.gitignore` | - |
| M2 | 插件骨架 + 配置面板 | ✅ Done | `manifest.json` / `index.html` / `js/ui.js` / 文件夹选择 / 开关 / 配置持久化 | - |
| M2.1 | M2 bug 修复 + scope 变更（剪贴板单路径） | ✅ Done | localStorage、窗口尺寸、hostname tag、theme、PRD F2 重写、ADR-010/011 | - |
| M2.2 | 间隔单位改秒 + 剪贴板权限 K12 | ✅ Done | 0.5–5s slider、macOS Sonoma 横幅缓解策略 | - |
| M3 | 剪贴板监听 + 导入 + 截图按钮 | ✅ Done | 轮询 + 按文件夹 hash 集合 + 启动期回填 + `duplicateStrategy` 分支 + tmp 文件 + `addFromPath` + 5s 重试 | - |
| ~~M4~~ | ~~macOS 截图目录监听~~ | ❌ 弃用（ADR-004 修订） | 合并入 M3 截图按钮 | - |
| M4 | 用户反馈 5 项（删后复制/命名/多文件/混排/延迟） | ✅ Done | backfill 整组替换 + Screenshot 命名 + osascript 多文件 + 混排开关 + WxH | - |
| M5 | adaptive polling + 重试倒计时 + 最近导入列表 | 🔄 In Progress | 同 hash 持续 3 轮放慢到 5s；倒计时 1s tick；recent cap 5 | - |
| M6 | 用户视角文案 + 打包 + 端到端验证 | ⬜ Todo | 设置文案去开发者用语；`.eagleplugin` 包；安装文档；截图证据 | - |
| M7 | 开源发布准备 | ⬜ Todo | README 完善、CHANGELOG v1.0.0、Plugin Center 提交材料 | - |

## 当前里程碑：M5 — adaptive polling + 重试倒计时 + 最近导入列表

实装内容：
- **Adaptive polling**：剪贴板里图片不变 N 轮后自动放慢到 5s，hash 变化即刻回 1s。透明优化，UI 不暴露切换。
- **重试倒计时**：错误状态显示"将在 N 秒后重试"，1s tick 更新。
- **最近导入列表**：state 保留最近 5 条，UI 列表展示。

## 后续里程碑：M6 — 用户视角文案 + 打包 + 端到端验证

M6 任务（按优先级）：

### M6.1 设置文案重写（用户反馈"太开发者视角"）

需要重写的开发者用语清单：
- "（默认开启 / 默认关闭）" → 删除（默认通过控件初始态体现）
- "osascript / PowerShell" → "复制图片文件后批量入库"
- "索引" → "已导入记录" / "查找重复"
- "format / hash" → "重复" / "已经存在"
- "重置当前文件夹索引" → "刷新已导入记录"
- "支持多文件复制批量导入" → "把复制的图片文件一并入库（Cmd/Ctrl+C 多张文件时）"
- "允许从图文混排导入图片" → "复制带文字的内容时，把图片也放进 Eagle"
- "监听间隔（秒）" → "检查频率（秒）"
- hint 里的实现细节（"shell-out / 50 张上限"）→ 移到 README 高级说明，UI 只留"上限 50 张"提示
- 错误码中文：保持，但更口语化（"剪贴板监听出错" → "暂时没法读取剪贴板"）

### M6.2 打包 + E2E
- `manifest.json` serviceMode/devTools 最终确认
- `npm run pack` 产 `.eagleplugin`
- 干净 Eagle 环境跑 progress.md A–H + M4 A–G 全部清单
- 1 小时空跑 CPU 监测
- 截图证据存 `.agent-doc/evidence/M6-{date}/`

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
