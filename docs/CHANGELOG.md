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
- 配置 schema 落地：`enabled` / `folderId` / `intervalMs` / `tags` / `notifyOnImport` / `duplicateStrategy`
- 面板 UI：状态指示灯 + 文件夹下拉（含二级路径 `父 / 子`）+ 主开关 + 「立即截图」按钮 + 最近导入区 + 高级折叠区（间隔滑块 / 标签 / 重复策略 Radio / 通知开关）

### Changed (M2.1)

- **持久化改用 `localStorage`**（原 PRD 写的 `eagle.extraData` 在 Eagle 官方 API 中不存在，导致 M2 配置保存失败）— ADR-010 / K7
- **主题检测改用 `eagle.app.theme` + `eagle.onThemeChanged`**（原 `eagle.app.isDarkMode` 不存在）— K8
- **窗口尺寸缩小到 380×540，加 maxWidth/maxHeight**（M2 默认被 Eagle 全屏化）— K9
- **默认 tag 自动追加 `os.hostname()`**（多机协作时区分来源）
- **截图改为剪贴板单路径**（参考 Alfred/Raycast）：
  - 主面板新增「立即截图（到剪贴板）」按钮，macOS 调 `screencapture -ic`
  - Windows 按钮置灰，提示用 `Win+Shift+S`
  - 移除高级设置中的"截图监听目录"字段
  - PRD F2 重写，M4 合并入 M3
  - ADR-004 修订 + 新增 ADR-011

### Changed (M2.2)

- 监听间隔 UI 单位由 ms 改为秒（slider 0.5–5s，步长 0.5）；存储仍用 ms（兼容 schema）
- PRD §8 新增第 6 条剪贴板权限与 macOS Sonoma "已粘贴自" 横幅说明；§7.2 修正残留的 `eagle.extraData` 引用为 `localStorage`
- 高级设置增加 hint：「轮询越快越及时；macOS 14+ 读剪贴板会触发系统横幅，可调大间隔减少触发」
- `plugin.js` 顶部注释加入 M3 实现指引（`availableFormats()` 预判 + hash 比对）
- 新增 K12 知识条目（剪贴板权限与横幅缓解策略）

---

## [0.0.0] - 2026-05-30

### Added
- 仓库初始化
