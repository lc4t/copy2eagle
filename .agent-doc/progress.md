# Progress

> 更新频率：每次 milestone-done 后必须更新；任务粒度变更时也要更新。

## 里程碑总览

| # | 名称 | 状态 | 完成时间 | GitHub Issue |
|---|---|---|---|---|
| M1 | 项目初始化 | 🔄 In Progress | - | - |
| M2 | 插件骨架 + 配置面板 | ⬜ Todo | - | - |
| M3 | 剪贴板监听 + 导入 | ⬜ Todo | - | - |
| M4 | macOS 截图监听 | ⬜ Todo | - | - |
| M5 | 状态/通知/错误处理 | ⬜ Todo | - | - |
| M6 | 打包 + 端到端验证 | ⬜ Todo | - | - |
| M7 | 开源发布准备 | ⬜ Todo | - | - |

## 当前里程碑：M1 — 项目初始化

- [x] 目录骨架（`docs/`、`.agent-doc/`）
- [x] PRD 入库（`docs/prd.md`）
- [x] 治理文件（AGENTS / CLAUDE / AGENT.RULES）
- [x] `docs/` 最小集（architecture / decisions / CHANGELOG）
- [x] `.agent-doc/` 最小集（plan / progress / chat-summary / knowledge / relearning-log）
- [x] `README.md` / `LICENSE` / `.gitignore`
- [x] entire CLI enable（`entire enable --agent claude-code`）→ `.entire/` + `.claude/agents/entire-search.md`
- [x] npm 初始化 → `package.json`（含 `pack` / `clean` scripts）
- [x] License 选定 PolyForm Noncommercial 1.0.0（含 Required Notice）
- [x] GitHub Issues 暂不启用
- [ ] 用户确认 → 初始 commit
- [ ] M7 阶段确认：Eagle Plugin Center 是否接受非商业 license（如拒，再评估）

## 遗留问题

- [ ] `manifest.json.id` 待替换为 Eagle 开发者工具生成的真实 ID（M7 处理）
- [ ] Windows 截图监听延后至 v1.1
- [ ] frontend-design Skill 安装时机：M2 / M5 UI 实际动手前装即可
