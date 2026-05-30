# Progress

> 更新频率：每次 milestone-done 后必须更新；任务粒度变更时也要更新。

## 里程碑总览

| # | 名称 | 状态 | 完成时间 | GitHub Issue |
|---|---|---|---|---|
| M1 | 项目初始化 | ✅ Done | 2026-05-30 | - |
| M2 | 插件骨架 + 配置面板 | ✅ Done | 2026-05-30 | - |
| M2.1 | bug 修复 + scope 变更（剪贴板单路径） | ✅ Done | 2026-05-30 | - |
| M2.2 | 间隔单位改秒 + 剪贴板权限知识沉淀（K12） | ✅ Done | 2026-05-30 | - |
| M3 | 剪贴板监听 + 导入 + 截图按钮接入 | ✅ Done | 2026-05-30 | - |
| ~~M4~~ | ~~macOS 截图目录监听~~ | ❌ 弃用 | 合并入 M3 | - |
| M4(新) | 状态/通知/错误处理（增强） | ⬜ Todo | - | - |
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

## M2.2 完成回顾（2026-05-30）

**触发**：用户两个新问题：
1. 间隔单位用 ms 反人类
2. 剪贴板要不要申请系统权限

**改动**：
- UI 间隔滑块改为秒（0.5–5s 步长 0.5），内部仍存 ms（兼容 schema）；显示「1.0 s」
- 新增 K12 沉淀剪贴板权限调研：macOS / Windows 都不需要显式权限，但 macOS 14+ 有"已粘贴自"横幅，需用 `availableFormats()` 预判 + hash 比对降低触发
- PRD §8 新增第 6 条隐私说明；§7.2 调试建议中 `eagle.extraData` 残留改为 `localStorage`
- 高级设置 UI 加 hint 提示用户："轮询越快越及时；macOS 14+ 读剪贴板会触发系统横幅"
- `plugin.js` 顶部注释加 M3 实现指引（formats 预判 + hash 比对）

**沉淀的新 Knowledge**：K12（剪贴板权限 + Sonoma 横幅 + availableFormats 策略）

## M3 完成回顾（2026-05-30）

**实装范围**：
- `plugin.js` 大重写（~660 行）：剪贴板轮询 / 启动期回填 / 导入管道 / 生命周期接线
- `ui.js`：索引中状态显示、最近导入卡片、错误码扩展
- `index.html`：最近导入卡片样式

**核心实现**：
1. **轮询**：`setTimeout` 链而非 `setInterval`，避免 readImage 比 interval 慢时任务堆积；通过 `pollInFlight` 自锁
2. **macOS 横幅缓解**（K12）：
   - 每轮先 `clipboard.availableFormats()`（轻量元数据）
   - `formatsKey` 与上一帧相同则整轮跳过（避免无谓 readImage）
   - 仅在含 `image/*` 时才 `readImage()`
3. **去重**：
   - `skip`：查 `hashSetByFolder[folderId]`，命中直接退出
   - `allow`：仅做 30s 滑动窗口防抖，不查 hashSet
4. **回填**：`eagle.item.get({ folders: [folderId] })` → 逐个读 `item.filePath` → 计算 hash → 入 Set；每 20 条 `await sleep(0)` 让出主线程；用户切走文件夹则提前终止
5. **导入**：`os.tmpdir()/eagle-cw/clip-{stamp}.png` 写盘 → `addFromPath(path, {name, folders:[id], tags, annotation})` → 成功后入 hashSet / 更新 lastImport / 计数 / 节流通知 → finally 清 tmp
6. **错误兜底**：连续 3 次轮询错误 → 暂停轮询 → 5s 后自动重试（不修复"目标文件夹被删"这种结构性错误，需用户重选）
7. **通知节流**：1.5s 内最多一条 `eagle.notification.show`

**Eagle API 进一步验证**：
- `item.filePath` 是磁盘实路径（之前调研，本次直接使用）
- `eagle.item.get({folders: [id]})` 返回 `Promise<Item[]>`
- `addFromPath` 返回 `Promise<itemId: string>`

**未做（交给 M4 加强）**：
- 「最近导入」只显示最近 1 条；多条历史可在 M4 增加列表
- 错误显示比较简略（"剪贴板监听出错，5 秒后自动重试"），未展示重试倒计时
- 没有「清除配置」按钮（调试时用 DevTools 一句 `localStorage.removeItem('clipboardWatcher')` 即可）
- `eagle.notification.show` 的 `mute` 选项 / icon 字段未配置

### M3 本地验证清单（必跑）

> ⚠️ 沙箱无 Eagle，端到端验证只能由你来。请按顺序：

**A. 基础回归（M2.2 行为不该坏）**
1. 重新加载插件 → 面板正常展示
2. 选文件夹 → 不再"配置保存失败"
3. 暗色模式 → 配色跟随

**B. 剪贴板监听**
1. 选目标文件夹 → 开监听 → 状态变绿、文案"监听中"
2. 复制任意图片（截图到剪贴板 / 浏览器右键复制图片 / Finder 拷贝 PNG）
3. 1 秒内 Eagle 目标文件夹出现新 item，名字形如 `Clipboard 2026-05-30 13:42:10`，含标签 `clipboard-watcher,<主机名>`
4. 「今日导入」+1，最近导入卡片显示文件名 → 文件夹

**C. 去重（skip 默认）**
1. 同一张图反复复制 → 应只导入一次
2. 关插件 → 再开 → 再复制同图 → 仍不重复（启动期回填 K11 生效）
3. 用 Eagle 内置的"复制图片"复制一张文件夹里已有的图 → 应跳过

**D. 去重 allow**
1. 切到"允许重复" → 同图反复复制 → 第一次导入；之后 30s 内不导入；30s 后再复制 → 又导入一次

**E. 截图按钮（macOS）**
1. 选好文件夹 + 开监听
2. 点「立即截图」→ 选区光标弹出 → 框选 → 1–2 秒内 Eagle 出现新 item

**F. 切文件夹 / 改间隔**
1. 切到另一个文件夹 → 状态先变"索引中 X/Y" → 完成后变"监听中"
2. 拖间隔到 5.0s → 关再开监听仍是 5.0s；剪贴板更新后约 5s 内被捕获

**G. 错误恢复**
1. 选一个文件夹 → 开监听 → 在 Eagle 里删掉这个文件夹（不重启插件）
2. 复制一张图 → 面板应进入"出错"状态，5 秒后自动重试
3. 重新选一个存在的文件夹 → 状态恢复

**H. macOS 14+ 横幅观察**
1. 1 秒间隔下复制一张图，观察是否仅在剪贴板真的更新时才出现"已粘贴自 Eagle"横幅
2. 复制结束后再放一会，应不再有横幅（formatsKey 不变跳过）

**遇到不符合预期的现象告诉我具体步骤和现象，我跟进。**

## 当前里程碑：M4（新）— 状态/通知/错误处理增强

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
