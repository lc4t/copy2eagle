# Project Knowledge Base

> 通过 MCP / 搜索 / Eagle 官方文档 / 实测获取的、对项目决策有影响的外部知识。

### K1: Eagle `addFromPath` 的 `folders` 是数组

- **来源**：PRD §3.7（用户已踩坑）
- **获取时间**：2026-05-30
- **知识摘要**：`eagle.item.addFromPath(filePath, opts)` 的 `opts.folders` 必须传 `[folderId]` 数组形式，不是 `folderId` 字符串。
- **项目影响**：M3 实现 + 所有相关代码审查清单的强制项。
- **时效性**：长期有效（Eagle API 公开契约）。

### K2: macOS 截图默认目录读取

- **来源**：PRD §3.6
- **获取时间**：2026-05-30
- **知识摘要**：`defaults read com.apple.screencapture location` 可读取用户设置；命令失败或返回空时回退 `~/Desktop`。
- **项目影响**：M4 截图目录自动检测实现。
- **时效性**：依赖 macOS 系统命令，长期有效。

### K3: 剪贴板轻量 hash 算法

- **来源**：PRD §3.5 / §2.1 F4（v1.1 修订）
- **获取时间**：2026-05-30
- **知识摘要**：`buffer.length + '_' + buffer.slice(0, 256).toString('base64').slice(0, 32)`，无需引入 crypto 库。**v1.1 修订**：30 秒滑动窗口仅在 `duplicateStrategy === 'allow'` 时启用（剪贴板防抖）；`skip`（默认）下使用按 folderId 维度的进程内 `Set<hash>` 做实际去重，启动/切换文件夹时通过 `eagle.item.get` 回填。详见 ADR-009。
- **项目影响**：M3 实现核心；避免依赖膨胀；用户控制重复策略。
- **时效性**：长期有效，hash 仅用于去重而非安全。

### K4: Eagle 截图文件名正则（双语）

- **来源**：PRD §2.1 F2
- **获取时间**：2026-05-30
- **知识摘要**：
  - 中文：`截屏 YYYY-MM-DD HH.MM.SS.png`
  - 英文：`Screenshot YYYY-MM-DD at HH.MM.SS.png`
- **项目影响**：M4 文件名匹配必须双语覆盖。
- **时效性**：随 macOS 版本可能调整，每个大版本验证一次。

### K6: Eagle 官方推荐 npm 作为包管理

- **来源**：https://developer.eagle.cool/plugin-api/tutorial/3rd-modules
- **获取时间**：2026-05-30
- **知识摘要**：Eagle 文档明确说 npm 是「the official package management tool for Node.js」，并以 `npm install is_js --save` 作为引入第三方模块的示例。文档未提及 pnpm/yarn，也未推荐特定 scaffold/build 工具。
- **项目影响**：ADR-007 固化 npm；禁止 pnpm/yarn 锁文件；MVP 不引入构建工具。
- **时效性**：长期有效（Eagle 官方推荐基线）。

### K5: `serviceMode` 与 CPU 预算

- **来源**：PRD §8.5
- **获取时间**：2026-05-30
- **知识摘要**：面板关闭、`serviceMode: true` 后台运行时 CPU 占用应低于 0.5%。每秒 `clipboard.readImage()` 在 macOS 实测无明显开销。
- **项目影响**：M3 默认轮询 1000ms；M6 端到端验证含 CPU 占用监测。
- **时效性**：实测验证，硬件相关。
