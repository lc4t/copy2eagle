# Decision Records (ADR)

> 重大技术决策记录。每条含 Context / Decision / Consequences / Why。

---

## ADR-001：插件类型选 Background Service（serviceMode）

- **Date**：2026-05-30
- **Context**：用户期望"开了就不用管"，截图/复制图片应自动归档，无需保持 Eagle 面板打开。
- **Decision**：`manifest.json.main.serviceMode = true`，配合 `eagle.onPluginCreate` 启动监听。
- **Consequences**：
  - 面板关闭后逻辑仍运行（满足 PRD F1/F2）。
  - 调试期需临时切普通 Window Plugin 才能用 DevTools，commit 前必须切回。
  - CPU 占用要严格控制（< 0.5%，PRD §8.5）。
- **Why**：唯一能满足"无感归档"的插件形态。

---

## ADR-002：剪贴板去重用轻量 hash，不引入 crypto

- **Date**：2026-05-30
- **Context**：每秒轮询要算 hash，引入 `crypto.createHash` 会增加包体积和启动开销。
- **Decision**：用 `buffer.length + '_' + buffer.slice(0,256).toString('base64').slice(0,32)` 作 hash，30 秒滑动窗口。
- **Consequences**：
  - 完全无依赖。
  - 理论碰撞率高于 SHA，但 256 字节前缀对截图/常见复制图片足够区分。
  - 同图反复复制 30 秒内不重复导入。
- **Why**：hash 用途是去重而非安全，工程权衡选最轻量方案。

---

## ADR-003：剪贴板写 tmp 文件再导入，截图直接传原路径

- **Date**：2026-05-30
- **Context**：`eagle.item.addFromPath` 需要一个文件路径；剪贴板是内存数据，截图本身是文件。
- **Decision**：
  - 剪贴板：`os.tmpdir()/eagle-cw/{ts}.png` → `addFromPath` → 删 tmp
  - 截图：直接传原文件路径，**不复制**
- **Consequences**：
  - 截图导入零额外 IO。
  - tmp 路径必须清理（包括失败分支），避免磁盘累积。
  - Eagle 拷贝/链接行为以 Eagle 实现为准（导入后改原文件不影响 Eagle 内副本）。
- **Why**：截图本身就是文件，没必要再拷贝；剪贴板必须落盘。

---

## ADR-004：截图监听仅在 macOS 实现，Windows 用剪贴板覆盖

- **Date**：2026-05-30
- **Context**：Windows 默认 `PrintScreen` 进剪贴板，Snipping Tool 存文件路径不固定。
- **Decision**：v1.x 仅 macOS 实现 `fs.watch(screenshotDir)`；Windows 仅靠 F1 剪贴板监听。
- **Consequences**：
  - macOS 用户：截图 + 剪贴板双路径。
  - Windows 用户：截图通过 `PrintScreen` 路径仍覆盖；Snipping Tool 存文件场景遗漏。
- **Why**：避免 Windows 上猜测截图工具的复杂度，集中精力做好 macOS 体验。Snipping Tool 路径延后 v1.1 评估。

---

## ADR-005：配置统一存 `eagle.extraData`，单一 key `clipboardWatcher`

- **Date**：2026-05-30
- **Context**：Eagle 提供 `eagle.extraData` 作为插件配置持久化方案，容量上限 10KB。
- **Decision**：单 JSON 对象，key=`clipboardWatcher`，包含 `enabled / folderId / intervalMs / tags / screenshotDir / notifyOnImport`。
- **Consequences**：
  - 读写原子，开发简单。
  - 后续新增字段做兼容默认值即可。
- **Why**：单 key 简化迁移逻辑；体积远低于 10KB。

---

## ADR-009：去重以"目标文件夹内不重复"为默认语义

- **Date**：2026-05-30
- **Context**：用户明确希望同一张图片不在目标文件夹里出现两次；旧的 PRD F4 仅做了 30 秒滑动窗口，无法防止跨 Session / 长时间间隔后的重复导入。
- **Decision**：
  - 去重维度：**目标 folderId 维度**，进程内 `Map<folderId, Set<hash>>`
  - 启动期 / 切换文件夹时通过 `eagle.item.get({ folders: [folderId] })` 回填现有内容
  - 暴露 `duplicateStrategy` 给用户：
    - `skip`（默认）：检测到重复直接短路，不导入
    - `allow`：允许重复入库，并启用 30 秒滑动窗口作为剪贴板防抖
  - hash 仍用 ADR-002 的轻量算法
- **Consequences**：
  - 默认行为最贴近用户预期（"在这个文件夹就不要重复"）
  - 重启后需重新回填一次（item 数大时显示 UI 索引状态），未来若性能成问题再持久化（不存 `extraData`，改用 plugin 用户态目录）
  - 不识别视觉相似（裁剪/缩放后视为不同图），是 MVP 显式取舍
- **被否决方案**：
  - **持久化 hash 到 `eagle.extraData`**：10KB 容量上限太小（~250 hash），且配置文件应"小且语义化"，不适合塞数据
  - **强制全局去重（跨文件夹）**：用户可能就是想把同图存到不同分类下，不该剥夺这个能力
  - **只在剪贴板路径去重**：截图路径同样会重复（例如同一张文档反复截图），覆盖不全
- **Why**：把"重复"语义和文件夹绑定，与 Eagle 自身的组织模型一致；用户用一个开关控制"是否允许重复"，心智成本最低。

---

## ADR-007：包管理用 npm，与 Eagle 官方推荐一致

- **Date**：2026-05-30
- **Context**：用户要求与 Eagle 官方推荐一致。Eagle 文档明确说 npm 是「the official package management tool for Node.js」，并以 `npm install xxx --save` 作示例（developer.eagle.cool/plugin-api/tutorial/3rd-modules）。
- **Decision**：使用 npm；禁止 pnpm/yarn 锁文件；不引入构建工具（webpack/vite/tsc）。
- **Consequences**：
  - 与 Eagle 文档示例可逐字对照，新人接手成本低
  - `package.json` 仅承担元数据 + scripts 角色，依赖（如有）可直接 `require()`
  - 若未来需 TypeScript 类型补全，可加 `@types/*` 但代码仍写 JS（保持零构建）
- **Why**：Eagle 官方推荐是社区共识基线；偏离会增加贡献者学习成本。

---

## ADR-008：启用 entire CLI 捕获 Session 上下文

- **Date**：2026-05-30
- **Context**：项目计划开源，AI 协作占主导。会话上下文（决策依据、试错路径）若仅留在本地终端会随关闭丢失。
- **Decision**：执行 `entire enable --agent claude-code`，生成 `.entire/settings.json` 与 `.claude/agents/entire-search.md`，纳入 git。
- **Consequences**：
  - 每次 `git push` 自动在 `entire/checkpoints/v1` 分支追加本 Session 完整对话 + 工具调用
  - 在 entire.io 可检索历史 Session、回滚到任意 checkpoint
  - 增加少量 hook 执行时间（可忽略）
- **Why**：开源项目尤其需要决策可追溯性；entire 提供 git-native 方案，零额外成本。

---

## ADR-006：License 选 PolyForm Noncommercial 1.0.0（非商用 + 署名）

- **Date**：2026-05-30
- **Context**：作者希望「别人引用必须声明来源 + 禁止商业使用」。
- **Decision**：使用 **PolyForm Noncommercial License 1.0.0**，LICENSE 文件保留官方原文 + 顶部 `Required Notice` 行（作者署名 + 项目地址）。
- **Consequences**：
  - 严格意义上是 **source-available**，不是 OSI 定义的「Open Source」（OSI 不允许限制商业用途）
  - 允许：个人、教育、研究、非营利组织使用与修改
  - 禁止：任何商业用途（含商业 SaaS 集成、企业内部生产使用按 PolyForm 定义可能例外，需个案判断）
  - 二次发布必须保留 LICENSE 文件和 `Required Notice` 行
  - Eagle Plugin Center 接受非商业 license 的策略需在 M7 提交前确认；若拒收，再评估调整
- **被否决方案**：
  - **MIT / Apache-2.0**：允许商用，不符合作者意图
  - **CC BY-NC 4.0**：通用作品许可，Creative Commons 官方不推荐用于软件
  - **GPL-3.0**：允许商用（强 copyleft 不等于禁商用），不符合意图
  - **BUSL（Business Source License）**：到期自动转 open source，作者未表达此需求
- **Why**：PolyForm Noncommercial 是专为代码起草、条款清晰、有真实生态采用（Sourcegraph 等）的非商用许可证。
