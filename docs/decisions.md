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

## ADR-004：截图统一走剪贴板（v1.1 修订，原方案弃用）

- **Date**：2026-05-30（原决策）/ 2026-05-30（修订）
- **Context（修订）**：用户澄清意图——所有图片获取走剪贴板，参考 Alfred/Raycast 的工作流。文件夹监听复杂度高且与心智模型不符：用户复制图片和按截图键应进入同一流水线。
- **Decision（修订）**：
  - 放弃 `fs.watch(screenshotDir)` 方案
  - macOS：主面板「立即截图」按钮 → `screencapture -ic`（结果进剪贴板）
  - Windows：按钮置灰，提示用户用 `Win+Shift+S`（系统截图默认进剪贴板）
  - 所有路径汇入 §2.1 剪贴板轮询（单一导入入口）
- **Consequences**：
  - 心智模型统一：所有图片走剪贴板
  - 实现复杂度大幅降低：不再需要文件名正则 / 写盘延迟 / 目录可达性检测
  - 用户需养成习惯：截图快捷键应配置为"到剪贴板"（macOS 默认是到桌面文件，要加 Ctrl 修饰键）
  - 没有按钮的用户路径同样可用——系统截图到剪贴板后会被轮询拾起
- **被否决方案（原方案）**：
  - 监听截图目录 + 文件名正则匹配：维护成本高，且与"剪贴板单路径"心智不一致
- **Why**：用户原话「ctrl+c 后就自动获取截图」+ 提及 Alfred/Raycast，清楚指向"剪贴板是唯一输入"。详见 ADR-011。

---

## ADR-010：配置持久化用 localStorage，PRD 中的 eagle.extraData 不存在

- **Date**：2026-05-30
- **Context**：PRD §3.4 / §2.2 描述用 `eagle.extraData.get/set` 持久化配置；实际查 Eagle 官方文档（developer.eagle.cool/plugin-api/api/folder 等）没有 `eagle.extraData` 这个 API。M2 真实运行时 `await eagle.extraData.set(...)` 抛出，导致"配置保存失败"。
- **Decision**：用 webview 原生 `localStorage` 持久化配置：
  - `localStorage.getItem(CONFIG_KEY)` → `JSON.parse` → `normalizeConfig`
  - `saveConfig(patch)` → `normalizeConfig` → `localStorage.setItem(CONFIG_KEY, JSON.stringify(config))`
  - 同步 API，无 async 噪音
- **Consequences**：
  - 立即修复"配置保存失败"
  - localStorage 在 Electron webview 中按 origin 隔离，相当于"每个插件独立 sandbox"，符合预期
  - 容量 10MB+，远超 10KB 限制
  - 不再依赖 Eagle 未公开 API（更稳）
- **被否决方案**：
  - **Node `fs` 写 JSON 文件**：需选目录（`os.homedir()/.eagle-clipboard-watcher/`），增加文件系统复杂度
  - **等 Eagle 官方出 storage API**：阻塞 v1.0 发布，不可取
- **Why**：localStorage 是 Web 标准，零依赖，同步且可靠。**PRD 中所有 `eagle.extraData` 字样需替换为 localStorage（已修订）。**

---

## ADR-011：剪贴板为唯一图片输入路径

- **Date**：2026-05-30
- **Context**：M2.1 用户反馈澄清意图——所有图片应走剪贴板（参考 Alfred / Raycast）。原 PRD F2 的"监听截图保存目录 + 文件名正则"实现复杂度高、跨平台行为差异大、且与用户心智不一致。
- **Decision**：
  - **剪贴板**是 v1.x 唯一图片输入路径（剪贴板复制 / 系统截图到剪贴板 / 插件触发的 `screencapture -ic` 全部汇入）
  - 主面板提供「立即截图」按钮（macOS：`screencapture -ic`，Windows：置灰 + 提示 `Win+Shift+S`）
  - 不实现全局快捷键（Eagle 插件 API 未公开此能力，引入第三方 hook 监听复杂度高且影响性能）
- **Consequences**：
  - 架构大幅简化：剪贴板轮询 + 一个截图触发按钮 = 全部输入
  - 用户需理解：截图快捷键应配置为"到剪贴板"模式
  - README / 面板 hint 中给出 macOS 推荐快捷键（`Cmd+Shift+Ctrl+4`）
- **被否决方案**：
  - 文件夹 `fs.watch`（见 ADR-004 修订）
  - 全局快捷键库（如 `electron-localshortcut`）：增加依赖，且 Eagle 插件运行时未开放注册全局快捷键的能力
- **Why**：单一输入路径心智成本最低；Alfred / Raycast 已验证这种模式的可用性。

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
