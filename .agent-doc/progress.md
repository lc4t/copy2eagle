# Progress

> 更新频率：每次 milestone-done 后必须更新；任务粒度变更时也要更新。

## 里程碑总览

| # | 名称 | 状态 | 完成时间 | GitHub Issue |
|---|---|---|---|---|
| M1 | 项目初始化 | ✅ Done | 2026-05-30 | - |
| M2 | 插件骨架 + 配置面板 | ✅ Done | 2026-05-30 | - |
| M2.1 | bug 修复 + scope 变更（剪贴板单路径） | ✅ Done | 2026-05-30 | - |
| M3 | 剪贴板监听 + 导入 + 截图按钮接入 | ⬜ Todo | - | - |
| ~~M4~~ | ~~macOS 截图目录监听~~ | ❌ 弃用 | 合并入 M3 | - |
| M4(新) | 状态/通知/错误处理 | ⬜ Todo | - | - |
| M5(新) | 打包 + 端到端验证 | ⬜ Todo | - | - |
| M6(新) | 开源发布准备 | ⬜ Todo | - | - |

## M2.1 完成回顾（2026-05-30）

**触发**：用户在 M2 真机验证后反馈 4 点：
1. 配置保存失败（PRD 假设的 `eagle.extraData` API 实际不存在）
2. 窗口默认全屏，应该小一点
3. 默认 tag 应附加 hostname
4. 截图监听语义不对——应像 Alfred/Raycast 走剪贴板，不要监听目录

**Bug 修复**：
- `js/plugin.js`：`eagle.extraData.get/set` → `localStorage.getItem/setItem`（ADR-010），`eagle.app.isDarkMode` → `await eagle.app.theme` + `onThemeChanged`（K8），默认 tag 加 `os.hostname()`
- `manifest.json`：宽高 380×540 + maxWidth/maxHeight，避免被默认成全屏

**Scope 变更**（§4.6 里程碑边界变更）：
- 弃用文件夹 `fs.watch` 方案（ADR-004 修订）
- 主面板新增「立即截图（到剪贴板）」按钮，macOS 调 `screencapture -ic`（K11）
- 所有图片输入收敛到剪贴板单路径（ADR-011）
- UI 移除截图目录字段；M4 合并入 M3

**沉淀的新 Knowledge**：K7（无 extraData）/ K8（theme API）/ K9（manifest maxWidth）/ K10（addFromPath options 形态）/ K11（screencapture -ic）

## 当前里程碑：M3 — 剪贴板监听 + 导入 + 截图按钮

> 详见 [.agent-doc/plan.md](plan.md) 的 M3 段。

### M3 任务清单（首次进入 Session 时由 Agent 细化）

- [ ] 实现 `setInterval` 剪贴板轮询 + 开关响应（暂停/恢复）
- [ ] 实现按 folderId 维度的进程内 `Map<folderId, Set<hash>>`（ADR-009 / F4 v1.1）
- [ ] 实现启动 / 切换文件夹时的 `eagle.item.get({ folders: [folderId] })` 回填 + UI「索引中…」状态（K10）
- [ ] 实现 `duplicateStrategy` 分支：skip 短路 / allow 仍导入并启用 30s 防抖
- [ ] 实现 tmp 文件写入 + `addFromPath`（`folders:[folderId]` 数组 / ADR-003 / K10）+ 失败分支清理
- [ ] 接入截图按钮 → 调 `screencapture -ic`（K11）→ 由轮询自动接力
- [ ] 错误捕获 → UI 错误状态 → 5s 重试
- [ ] 真实 Eagle 中验证：复制图 / 按钮截图 → 出现在文件夹；同图重复 → 按策略表现

## M1 完成回顾（2026-05-30）

- 目录骨架（`docs/`、`.agent-doc/`）+ PRD 入库
- 治理文件三件套（AGENTS / CLAUDE / AGENT.RULES）
- 架构 + 9 条 ADR（含 ADR-006 License / ADR-007 npm / ADR-008 entire / ADR-009 文件夹去重）
- entire CLI enable（首次 `git push` 已自动创建 checkpoint）
- npm 初始化 + License（PolyForm Noncommercial 1.0.0）
- 初始 commit `948d8c0`，已 push 到 `origin/dev`（private 仓库）

## M2 完成回顾（2026-05-30）

- `manifest.json`：serviceMode: true，devTools: false（开发期可本地切 true，commit 前切回）
- `logo.png`：128×128 占位（M7 替换正式版）
- `index.html`：面板 UI（状态行 / 文件夹下拉 / 主开关 / 最近导入区 / 高级折叠区含 5 项设置）
- `js/plugin.js`：配置 schema + `eagle.extraData` 读写 + 文件夹拉取与扁平化（含二级路径 `父/子`）+ 生命周期钩子 + 配置规范化与降级
- `js/ui.js`：纯渲染 + 事件分发 + 错误 banner + 主题切换（依赖 `eagle.app.isDarkMode`）
- 配置 schema 已含 `duplicateStrategy`（默认 `skip`），为 M3 留好开关

### M2 未做（M3 起补齐）

- 剪贴板轮询（plugin.js 仅切状态，未启动 setInterval）
- 截图目录 `fs.watch`（M4）
- 「最近导入」面板填充（依赖 M3 第一次成功导入）
- 索引中 UI 状态（M3 引入回填时实现）

### M2 验收限制

> ⚠️ 真实 Eagle 加载验证未在本 Session 完成（无沙箱 Eagle 实例）。需要用户在本地 Eagle → 开发插件 → 选择本目录后人工验证：
> 1. 面板正常显示，文件夹下拉拉到列表
> 2. 选文件夹 → 开关可点 → 重启 Eagle / 重开面板 → 配置保留
> 3. Dark Mode 切换面板配色跟随
> 4. 高级折叠区所有控件状态可改并持久化

## 遗留问题

- [ ] `manifest.json.id` 待替换为 Eagle 开发者工具生成的真实 ID（M7 处理）
- [ ] Windows 截图监听延后至 v1.1
- [ ] `logo.png` 为占位（M7 换正式版）
- [ ] M7 阶段确认：Eagle Plugin Center 是否接受非商业 license
- [ ] frontend-design Skill 安装时机：M5 UI 精修前装
