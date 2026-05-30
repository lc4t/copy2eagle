# Eagle Clipboard Watcher — Agents Execution Rules

> 主执行文件。日常开发前必读。完整治理规范见 `AGENT.RULES.md`。

## Project Profile

```yaml
# 由初始化生成，勿手动修改（通过 relearning 更新）
project-type: web-frontend       # Eagle 插件本质是 Electron 运行的 HTML/JS
vcs: github:lc4t/copy2eagle
github-issues: disabled          # 待 GitHub MCP 配置后切 enabled
entire: enabled                  # entire CLI 已 enable，每次 push 自动捕获会话上下文
stack: [javascript, html, css, electron-api]
package-manager: npm             # Eagle 官方推荐（developer.eagle.cool/plugin-api/tutorial/3rd-modules）
runtime: local                   # 插件运行在 Eagle 进程内
tf-auto: disabled                # 非 iOS/macOS App
agent-mode: mixed                # 默认：非破坏性自动；破坏性等待确认
author: lc4t <lc4t0.0@gmail.com>
license: PolyForm-Noncommercial-1.0.0    # 非商用 + 署名（source-available）
target-platform: macOS first（v1.x），Windows 兼容（剪贴板路径，无截图监听）
```

## 一句话

把剪贴板图片和 macOS 截图自动归档到用户指定的 Eagle 文件夹，作为 Eagle Background Service 插件（`serviceMode: true`）分发到 Eagle Plugin Center。

## 技术栈

- 运行环境：Eagle Plugin Runtime（Electron + Node.js API）
- 语言：JavaScript（ES2020+），HTML5，CSS3
- 包管理：**npm**（Eagle 官方推荐，禁用 pnpm/yarn 避免与官方文档示例脱节）
- 关键 API：`electron.clipboard` · `eagle.item.addFromPath` · `eagle.folder.getAll` · `eagle.extraData` · `eagle.notification` · `eagle.log`
- 平台：macOS（主），Windows（兼容，无截图文件监听）
- 包格式：`.eagleplugin`（zip 重命名）

## 任务分类

| type | emoji | scope 示例 | 用途 |
|---|---|---|---|
| feat | ✨ | clipboard / screenshot / ui / config | 新功能 |
| fix | 🐛 | clipboard / screenshot / ui / import | 修复 |
| refactor | ♻️ | plugin / ui | 重构 |
| docs | 📝 | prd / arch / readme | 文档 |
| test | ✅ | clipboard / e2e | 测试 |
| chore | 🔧 | build / deps / manifest | 杂项 |
| perf | ⚡ | clipboard / hash | 性能 |
| build | 📦 | package | 打包/发布相关 |
| release | 🚀 | - | 版本发布 |

**commit scope 白名单**（必须从此列选）：`clipboard` / `screenshot` / `ui` / `config` / `import` / `notification` / `plugin` / `manifest` / `build` / `deps` / `docs` / `infra`

## Session 开始时强制检查

### A. 无条件

1. 读取 `.agent-doc/progress.md` → 确认当前里程碑和遗留问题
2. 宣告本 Session 目标（§8.1 格式）
   - `mixed` 模式：等待用户确认后开始

### A+. github-issues=disabled → 跳过 GitHub Issues 检查；entire=disabled → 跳过 entire status 检查

## 任务开始前强制检查

0. 声明任务粒度：light（单文件、无行为变更）/ heavy（多文件、含行为变更）
1. `git status` 必须干净，有未提交变更时停止
2. 矛盾检测：当前任务与 PRD / 已实现功能 / Eagle API 约束是否冲突
3. UI 构建任务时激活 `frontend-design` Skill（前端项目默认行为）

## 任务实施中

1. 里程碑边界变更检测（§4.6）：用户修改 plan 即触发，不静默接受
2. 通过 web / MCP / 工具获取的信息影响决策 → 立即记入 `.agent-doc/knowledge.md`

## commit 前检查清单

- [ ] 在 Eagle 内本地加载插件并人工验证关键路径（剪贴板/截图/导入/状态显示）
- [ ] `eagle.log.info` 无新增严重错误
- [ ] 无临时文件 / 调试代码 / 个人配置被提交
- [ ] 无密钥、`.env`、`*.eagleplugin` 包产物入库
- [ ] `.agent-doc/progress.md` 已更新
- [ ] 是否有可复用经验 → 记录到 `.agent-doc/chat-summary.md`
- [ ] 反思：是否影响其他功能 / 是否有同类问题需修改

## 强制开发循环

```
plan → task(doc → work → verify → doc) → commit → next task → milestone-done
```

每个任务文档必含 §4.2 字段：Intent / Constraints / Decision / Evidence / Impact / Learnings。

## 测试门禁

本项目无标准单测框架（Eagle 插件依赖宿主运行时）。门禁通过**人工验证清单 + 截图证据**实现，存放：

- 验证清单：`.agent-doc/feats/feat-{id}-{slug}.md` 的 Evidence 字段
- 截图证据：`.agent-doc/evidence/{milestone}-{date}/*.png`（不入 git）

UI 行为变更必须附本地 Eagle 运行截图。打包前必须在真实 Eagle 上完成端到端验证（开启监听→复制图片→剪贴板触发导入→Eagle 文件夹出现）。

## 提交规范

格式：`emoji type(scope): 描述`

示例：

- `✨ feat(clipboard): 增加 1s 轮询与 hash 去重`
- `🐛 fix(import): folders 参数应为数组而非字符串`
- `📝 docs(prd): 调整截图监听节流为 500ms`

## 禁止事项

- 禁止暴露用户数据到外部网络（隐私承诺，PRD §8）
- 禁止用 `console.log`，统一使用 `eagle.log.info/warn/error`
- 禁止在主 `manifest.json` 提交 `devTools: true`（调试用 override 思路，commit 前必须关闭）
- 禁止使用 `alert()` 提示框
- 禁止跳过失败测试/校验提交代码
- 禁止把 `*.eagleplugin` 打包产物入库

## 常用命令

```bash
# 安装依赖（如有 dependencies）
npm install

# 打包插件（仅包含运行时文件：manifest / index.html / logo / js）
npm run pack

# 清理打包产物
npm run clean

# 本地安装：Eagle → 菜单 → 插件 → 开发插件 → 选择本目录
```

> entire 已 enable，每次 `git push` 自动把本 Session 完整对话 + 工具调用 存到 `entire/checkpoints/v1` 分支，可在 entire.io 检索/回滚。

## 入口命令

| 命令 | 说明 |
|---|---|
| `请按 AGENTS.md 执行本次任务` | 日常执行 |
| `请按 AGENT.RULES.md 补全文档与验收` | 审计与补全 |
| `milestone-done` | Session 结束仪式 |
| `relearning` | 把项目经验回写 AGENT.template.md |

---

完整规范见 [AGENT.RULES.md](AGENT.RULES.md)。需求详情见 [docs/prd.md](docs/prd.md)。当前进度见 [.agent-doc/progress.md](.agent-doc/progress.md)。
