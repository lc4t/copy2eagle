# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com) | Versioning: Major.Minor.Patch

## [Unreleased]

### Added
- 项目治理文件（AGENTS / CLAUDE / AGENT.RULES）
- 需求文档迁入 `docs/prd.md`
- 架构说明 `docs/architecture.md` + 决策记录 `docs/decisions.md`（含 ADR-001 ~ ADR-008）
- 里程碑分解 `.agent-doc/plan.md` + 进度跟踪 `.agent-doc/progress.md`
- npm 项目初始化（`package.json` 含 pack/clean scripts，Eagle 官方推荐包管理）
- entire CLI 接入（`.entire/settings.json` + Claude Code subagent）
- License 选定 PolyForm Noncommercial 1.0.0（非商用 + 署名，source-available）
- 插件骨架（M2）：`manifest.json`、`logo.png` 占位、`index.html`、`js/plugin.js`、`js/ui.js`
- 配置 schema 落地：`enabled` / `folderId` / `intervalMs` / `tags` / `screenshotDir` / `notifyOnImport` / `duplicateStrategy`，通过 `eagle.extraData` 持久化
- 面板 UI：状态指示灯 + 文件夹下拉（含二级路径 `父 / 子`）+ 主开关 + 最近导入区 + 高级折叠区（间隔滑块 / 标签 / 截图目录 / 重复策略 Radio / 通知开关）
- 主题适配：基于 `eagle.app.isDarkMode` 切换 light/dark CSS 变量

---

## [0.0.0] - 2026-05-30

### Added
- 仓库初始化
