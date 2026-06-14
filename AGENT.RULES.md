# Eagle 剪贴板图片留存 — Governance Rules

> 完整治理规范。`AGENTS.md` 是日常摘要，本文件是审计 + 补全依据。每条规则附 Why。
> 模板出处：`AGENT.template.md v3.0`

---

## 1. 协作纪律

照搬 `AGENT.template.md §1`。本项目额外强调：

- **Eagle API 是黑盒**：能查官方文档/MCP 时优先查证，不要凭训练数据猜参数键名。PRD 已踩过的坑（如 `folders` 是数组而非 `folderId`）记入 `knowledge.md`。
- **macOS + Windows**：macOS 提供完整功能；Windows 支持剪贴板图片、Win+Shift+S 截图入库与资源管理器多文件复制，内置截图按钮仅 macOS。

---

## 2. 项目特定约束

### 2.1 Eagle 插件运行时

- 插件类型：Background Service（`manifest.json` 必含 `main.serviceMode: true`）
- 入口：`index.html` → `js/bundle.js`；源码由 `js/plugin.js` + `js/ui.js` + `js/lib/*` 组成
- 生命周期 hook：`eagle.onPluginCreate` 用于初始化轮询；`eagle.onPluginShow` 用于刷新 UI 状态

**Why**：`serviceMode` 保证面板关闭后监听继续，是 PRD F1/F2 的硬前提。

### 2.2 剪贴板 hash 去重

- 算法：`buffer.length + '_' + buffer.slice(0, 256).toString('base64').slice(0, 32)`
- 状态：`hashSetByFolder`（skip）+ `lastClipboardHash / lastClipboardAt`（allow 的 30 秒防抖）
- **不引入 crypto 库**

**Why**：PRD §3.5/§2.1 F4。避免依赖膨胀，hash 仅用于去重而非安全。

### 2.3 截图入口

- 所有截图走剪贴板单路径，不监听截图目录
- macOS 面板按钮调用 `screencapture -ic`，结果由标准剪贴板轮询接力

**Why**：ADR-011。避免目录检测、文件名语言和半写入文件等不稳定因素。

### 2.4 导入参数硬约束

- `eagle.item.addFromPath(path, opts)` 中 `folders` 必须为数组，**不是 `folderId` 字符串**
- 剪贴板路径：先写 `os.tmpdir()/eagle-cw/` 再 `addFromPath`，导入完成后删除
- 多文件路径：直接传原文件，不复制

**Why**：PRD §3.7 明示踩坑点，必须固化到代码与代码审查清单。

### 2.5 配置持久化

- 配置使用 `localStorage` key：`clipboardWatcher`
- 统计使用 `clipboardWatcher.stats`
- 双实例 lease 使用 `clipboardWatcher.lease.v2`；旧版兼容 heartbeat 使用 `clipboardWatcher.heartbeat`
- 必含字段：`enabled` / `folderId` / `intervalMs` / `tags` / `notifyOnImport` / `duplicateStrategy` / `importMixedContent` / `importMultipleFiles` / `nameTemplate`
- 可选路由字段：`folderIdScreenshot` / `folderIdClipboard` / `folderIdFiles`
- 插件启动时读取并恢复 `enabled` 状态

**Why**：Eagle 当前公开 API 没有 `eagle.extraData`；ADR-010 已改用 webview 原生 localStorage。

### 2.6 日志规范

- 统一 `eagle.log.info/warn/error`，**禁止 `console.log`**
- 高频路径（每秒轮询）默认 silent，仅在状态变化或错误时记录

**Why**：`console.log` 在 Eagle 主进程不可见，且高频日志拖累性能（PRD §8 要求 CPU < 0.5%）。

### 2.7 包管理与依赖

- 包管理工具：**npm**（Eagle 官方推荐，见 https://developer.eagle.cool/plugin-api/tutorial/3rd-modules）
- 禁止引入 `pnpm` / `yarn` 锁文件（避免与官方文档示例 / 用户期望脱节）
- 第三方依赖一律 `npm install <pkg> --save`，依赖必须经过审视：
  - 体积影响（最终 `.eagleplugin` 包大小）
  - 是否引入网络请求（违反隐私承诺，§2.8）
  - License 兼容（MIT/Apache/BSD 友好；GPL 需评审）
- `package.json` 的 `engines.node` 保持项目开发与打包基线（当前 `>=18`）；Eagle 宿主兼容性以真机验证为准
- 不引入 webpack/vite/tsc；保留项目内无依赖 bundler `build/bundle.js`
- `npm run pack` 必须先执行 `npm test`，再生成可读 `js/bundle.js`
- `node_modules/` 不入 git，但若有运行时依赖，打包前必须 `npm install --omit=dev` 后纳入 `.eagleplugin`

**Why**：Eagle webview 无法稳定解析 `<script>` 中的相对 `require()`；issue #2 已证明必须 ship 单文件 bundle，同时源码继续模块化。

### 2.8 隐私与安全

- 插件全程本地运行，不发起任何外部网络请求
- 不收集、不上报任何用户数据
- Plugin Center 描述中必须注明本条

**Why**：PRD §8.4，是分发承诺。

---

## 3. 文档纪律

### 3.1 `docs/`（人类可读）

- `prd.md`：需求来源，变更须走 §4.6 边界变更流程
- `architecture.md`：模块边界、数据流、关键时序图（mermaid）
- `decisions.md`：ADR，每条含 Context / Decision / Consequences / Why
- `CHANGELOG.md`：Keep a Changelog 格式
- `refs/`：Eagle 官方 API 文档快照（如版本锁定）

### 3.2 `.agent-doc/`（过程文档）

- `plan.md`：里程碑分解（M1/M2/...）
- `progress.md`：当前任务状态（模板 T.3）
- `chat-summary.md`：可复用经验，relearning 素材
- `knowledge.md`：Eagle API / Electron clipboard / macOS 截图行为等外部知识
- `bugs/` `feats/`：单任务文档（§4.2 字段）
- `drafts/`：UI 草稿/设计草稿，禁覆盖写
- `evidence/`：人工验证截图，**不入 git**

---

## 4. 开发循环

### 4.1 强制循环

```
plan → task(doc → work → verify → doc) → commit → next task → milestone-done
```

### 4.2 任务文档字段

| 字段 | 说明 |
|---|---|
| Intent | 解决什么问题，为什么做 |
| Constraints | Eagle API / 平台 / PRD 约束 |
| Decision | 方案选择 + 取舍 + 被否决方案 |
| Evidence | 人工验证步骤 + 截图文件名 |
| Impact | 影响模块 + 回滚方法 |
| Learnings | 可沉淀为 relearning 的经验 |

### 4.3 清洁现场

- 任务开始前 `git status` 干净
- 任务结束后 `git status` 干净，含 commit + `.agent-doc` 记录

### 4.4 commit 前清单

见 [AGENTS.md](AGENTS.md) "commit 前检查清单"。

### 4.5 矛盾检测

报告格式：`⚠️ 矛盾检测：[描述] —— [涉及项] vs [冲突项] —— 建议：[方向]`

本项目高风险冲突源：

- PRD 监听间隔默认 1000ms vs `serviceMode` CPU < 0.5% 承诺：实测验证
- Eagle 文件夹只读 vs 用户期望"自动新建文件夹"：当前 PRD 不支持，遇此需求走 §4.6
- 中文 vs 英文截图文件名正则：必须双覆盖

### 4.6 里程碑边界变更

照搬模板 §4.6。本项目典型触发点：

- PRD 新增字段（如 OCR、多文件夹路由） → 插入 M{n}.1
- Eagle API 变更（升级宿主版本）→ 强制评审

### 4.7 commit 格式

`emoji type(scope): 描述`，scope 必须从 AGENTS.md 白名单选择。

### 4.8 错误恢复

#### 编译/打包失败（`zip` 失败 / `manifest.json` JSON 校验失败）

1. 自动诊断，最多重试 2 次
2. 第 3 次失败 → 停止，报告，等待人工
3. 打包失败不得发布

#### 验证失败（Eagle 本地加载报错、剪贴板未触发等）

1. 排查类型：API 调用错误 / 时序问题 / Eagle 版本差异
2. 修复后仍失败 → 停止，提交诊断日志到 `.agent-doc/bugs/`
3. 禁止：注释报错代码、降低 hash 严格度来强行去重通过

#### 工具失败（gh / entire 不可用）

降级为本地 `.agent-doc/progress.md` 跟踪，不阻塞开发。

---

## 5. 目录结构

```
copy2eagle/
├── AGENTS.md
├── CLAUDE.md
├── AGENT.RULES.md
├── README.md                     # 项目说明（开源用，引导用户安装/使用）
├── LICENSE                       # MIT License
├── package.json                  # npm 元数据 + pack/clean scripts
├── .gitignore
│
├── manifest.json                 # [M2 创建] Eagle 插件清单
├── index.html                    # [M2 创建] 面板入口
├── logo.png                      # Plugin Center 至少 256×256 PNG
├── js/
│   ├── plugin.js                 # 生命周期与模块编排
│   ├── ui.js                     # UI 交互
│   └── lib/                      # 13 个职责模块
├── build/bundle.js               # 无依赖本地 bundler
├── tests/run.js                  # 无依赖自动回归
│
├── .entire/                      # entire CLI 配置（settings.json）
├── .claude/agents/               # entire 注入的 Claude Code subagent
│
├── docs/
│   ├── prd.md
│   ├── architecture.md
│   ├── decisions.md
│   ├── CHANGELOG.md
│   └── refs/
│       └── README.md
│
└── .agent-doc/
    ├── plan.md
    ├── progress.md
    ├── chat-summary.md
    ├── knowledge.md
    ├── relearning-log.md
    ├── bugs/
    ├── feats/
    ├── drafts/
    └── evidence/                 # 不入 git
```

---

## 6. Init Hooks

### 6.1 已执行

- [x] 创建目录结构 + 治理文件
- [x] 把 `PRD.md` 移入 `docs/prd.md`

### 6.2 待用户确认后执行

- [x] entire CLI 已 enable（`entire enable --agent claude-code`），生成 `.entire/settings.json` 与 `.claude/agents/entire-search.md`
- [x] npm 项目初始化：`package.json` 含 author/license/repository/scripts(pack, clean)
- [x] License 选定 MIT
- [x] GitHub Issues 暂不启用（保持 `github-issues: disabled`）
- [ ] `git add` + 初始 commit `📝 docs: 初始化项目治理文件`
- [ ] 创建 GitHub 仓库 `lc4t/copy2eagle`（公开），首次推送（推送后 entire 会自动建 checkpoint）
- [ ] 可选：安装 frontend-design Skill（前端默认推荐，UI 真正动手前装即可）

---

## 7. relearning

照搬模板 §7。素材：`chat-summary.md` + `knowledge.md` + `docs/decisions.md` + `relearning-log.md` + `git log` + 本文件。

---

## 8. Session 里程碑协议

照搬模板 §8。本项目 Session 划分见 [.agent-doc/plan.md](.agent-doc/plan.md)。

---

## 9. GitHub 同步

当前 `github-issues: disabled`，本章节流程暂不启用。开启步骤：

1. 配置 GitHub MCP（PAT 含 `repo` + `issues`）
2. 把 `AGENTS.md` Project Profile 中 `github-issues` 改为 `enabled`
3. 执行 `github-sync` 把 `plan.md` 同步到 Issues

---

## 10. Skill / 工具清单（本项目相关）

| ID | 工具 | 状态 | 说明 |
|---|---|---|---|
| S01 | frontend-design | 推荐 | UI 构建任务激活，避免 AI 平庸审美 |
| M01 | playwright MCP | 不适用 | Eagle 插件无浏览器 E2E |
| M02 | GitHub MCP | 待配置 | 启用后开 Issues 追踪 |
| C01 | entire CLI | ✅ 已 enable | `.entire/settings.json` 已配置；`git push` 自动建 checkpoint |
| -   | npm | ✅ 已配置 | Eagle 官方推荐；`package.json` 已初始化 |

---

## 11. 默认规则（按 Profile 启用）

### 11.1 前端规则（适用）

- 禁 `alert()`
- 禁付费 API/组件
- 资源（如有图表）默认 ECharts；本项目暂无图表需求
- 与 Eagle 主题一致：使用 CSS 变量，读取 `await eagle.app.theme` 并监听 `eagle.onThemeChanged`

### 11.2 多视角检查

| 节点 | 视角 | 维度 |
|---|---|---|
| 功能完成 | 用户 | 选文件夹→开监听→截图/复制图片→Eagle 里出现，一气呵成 |
| Bug 修复 | 测试 | 是否影响截图/剪贴板/通知三条路径 |
| 文档完成 | 开源使用者 | README 能否让陌生人跑起来 |

---

## 12. 验收（初始化完成判据）

- [x] `AGENTS.md` 含 Project Profile 与本项目运行时检查点
- [x] `CLAUDE.md` 为存根（仅路由）
- [x] `AGENT.RULES.md` 覆盖 Eagle 插件特有约束（serviceMode / addFromPath 参数 / 隐私）
- [x] `docs/` 与 `.agent-doc/` 最小文件集齐全
- [ ] entire CLI（按需）
- [ ] GitHub MCP（按需）
- [x] 用户已知入口命令（见 AGENTS.md 末）
