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
| M3.1 | clipboard API 修正（eagle.clipboard） + 横幅策略修订 | ✅ Done | 2026-05-31 | - |
| ~~M4~~ | ~~macOS 截图目录监听~~ | ❌ 弃用 | 合并入 M3 | - |
| M4 | 用户反馈 5 项：删后再复制 / 命名 / 多文件 / 混排开关 / 延迟 | ✅ Done | 2026-05-31 | - |
| M5 | adaptive polling + 重试倒计时 + 最近导入列表 | ✅ Done | 2026-05-31 | - |
| M6 | 用户视角文案重写 + 打包验证 + README polish | ✅ Done | 2026-05-31 | - |
| M7 | 开源发布准备（首次 v1.0.0 release） | 🔄 文档级完成，待用户做 GUI / 设计资产 | 2026-05-31 | - |
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

## M3.1 完成回顾（2026-05-31）

**触发**：用户加载插件后立即报"剪贴板监听出错，5 秒后自动重试"。

**根因**：PRD §3.4 第三次写错 Eagle API——`require('electron').clipboard` 在 Eagle 插件 webview 不可用（前两次：`eagle.extraData` / `eagle.app.isDarkMode`）。destructure 得到 undefined，调 `.availableFormats()` 立即抛 `TypeError: Cannot read properties of undefined`，被 `runPoll` catch 后转成 POLL_FAILED 错误状态。

**修复**：
- 删除 `const { clipboard } = require('electron')`，全部改用 `eagle.clipboard`
- 因为 `eagle.clipboard` 没有 `availableFormats()`（只有 `has(format)`），实现 `probeImageFormat()` 依次对 9 个图片 format 候选（MIME + macOS UTI）try/catch 探测
- `runPoll` 改为：探到格式 → readImage → hash → 与 lastClipboardHash 比对（相同直接返回）→ 走去重 + 导入
- poll 错误日志加 `err.stack`，下次类似问题能直接看堆栈
- 新增 K13 沉淀「Eagle 插件用 eagle.clipboard，不是 require('electron').clipboard」
- K12 修订：原"formats 数组不变跳过"的优化已失效（has 不支持批量），实际策略改为「无图整轮跳过 + 同 hash 不重导入」；剪贴板长期留图时仍会按周期触发横幅

**M3 验收清单调整**：
- A/B/C/D/E/F/G/H 全部保持不变
- H 项观察"横幅频度"时记得：剪贴板一直留着图 + 1Hz 间隔 = 每秒一次横幅，是当前实现的已知代价；建议调到 2–5s 间隔再验

**仍未做（M4 候选）**：
- adaptive polling：同 hash 持续 N 轮 → 自动放慢轮询（减横幅）
- 重试倒计时显示
- 多条最近导入列表

## M4 完成回顾（2026-05-31）

**触发**：用户 M3 验收时反馈 5 项。

**5 项问题处理**：
1. ❌ 多文件复制 → ✅ 支持 macOS + Windows，shell-out 抓路径，**默认关 opt-in**（F10）
2. ❌ 图文混排 → ✅ 当前行为（导入图）默认开，**新加开关可关**（F11）
3. ⏳ 复制后延迟 → 维持 1 秒默认（用户接受推荐）；M5 做 adaptive polling 进一步优化
4. ❌ 删后再复制不出现 → ✅ 真 bug 修复：`backfillFolder` 改为整组替换 + onPluginShow 触发节流回填 + 重置按钮
5. ❌ 名字太机械 / 来源 APP 检测 → ✅ 名字加 `WxH` + 区分 `Screenshot/Clipboard`；来源 APP 确认**不可识别**（K14），不承诺

**关键实现**：
- `CONFIG_VERSION` 升到 2；新增 `importMixedContent`（默认 true）和 `importMultipleFiles`（默认 false）字段
- `backfillFolder` 重构：始终新建 `tempSet` → 完成后整组替换 `hashSetByFolder.set(folderId, tempSet)`，自然清理被删除 item 的旧 hash；`lastBackfillAt` 节流（5s）
- `resetFolderIndex()` 暴露给 UI；高级设置加按钮
- `onPluginShow` 调用 `backfillFolder(currentFolderId)`（节流自动跳过频繁触发）
- 命名：`buildItemName(source, dims, ts)` 拼 `Screenshot 1920x1080 2026-05-31 14:30:22`
- 来源检测：`detectImageSource()` 看 `state.lastScreenshotAt` 是否在 5s 窗口内
- 尺寸：`NativeImage.getSize()` 同步调用
- annotation：写明 Source / Size / hostname，去重做 mtime+长度+首文件 key
- 多文件：
  - macOS：`execFile('osascript', ['-e', script], {timeout: 2000})` — script 用 AppleScript 把 `the clipboard as «class furl»` 转 POSIX path linefeed 列表
  - Windows：`execFile('powershell', [...], {timeout: 2000})` — `Get-Clipboard -Format FileDropList`
  - 过滤 IMAGE_FILE_EXTS（11 个扩展名）；最多 50 张/批；batchKey 防重复触发
  - 单图剪贴板有图时**图优先**（多文件路径不会同时触发）
- 混排开关：`probeAnyFormat(TEXT_FORMAT_CANDIDATES)`，4 种 format 候选

**沉淀的新 Knowledge**：K14（来源 APP 不可识别 + 多文件需 shell-out）

**未做（M5 候选）**：
- adaptive polling（同 hash 持续 N 轮放慢 → 减 macOS 横幅）
- 重试倒计时显示
- 多条最近导入列表
- 「打开 Eagle 日志」快捷入口

### M4 本地验证清单（必跑）

> ⚠️ 在你本地 Eagle 中按顺序验证，发现不符合预期请描述步骤 + 现象。

**A. 回归**
1. 重新加载插件 → 加载后**不应再立即报错**（M3.1 修复）
2. 选文件夹 → 配置保存正常

**B. #4 修复：删后再复制**
1. 选 fold A → 开监听 → 复制图 X → X 入 fold A
2. **在 Eagle 里手动删除 X**
3. 不点重置按钮：关闭面板 → 重新打开（onPluginShow 触发节流回填） → 再复制 X → **应该重新入库**
4. 验证另一路径：开监听 → 复制 X 入库 → Eagle 里删 X → 点「重置当前文件夹索引」 → 再复制 X → 应重新入库

**C. #5 命名增强**
1. 普通剪贴板复制图 → 名字应是 `Clipboard 1920x1080 2026-05-31 ...`（实际尺寸数字）
2. 点「立即截图」按钮截一张 → 名字应是 `Screenshot 1920x1080 2026-05-31 ...`
3. 在 Eagle 里查看 item annotation → 应含 `Source: ...` `Size: ...` `Imported by Clipboard Watcher @ <主机名>`

**D. #2 图文混排开关**
1. 高级设置默认应**勾选**「允许从图文混排导入图片」
2. 从浏览器复制一段带图的内容（带文字）→ 应导入图片
3. 关闭这个开关 → 再次从浏览器复制带图带文字 → **应该跳过不导入**
4. 重新打开 → 又能导入

**E. #1 多文件复制（默认关，需开启）**
1. 默认情况下高级设置「支持多文件复制批量导入」**未勾选**
2. 在 Finder 里选 3 张 PNG → Cmd+C → 不应有任何反应（默认关）
3. 勾选开关 → 在 Finder 里再选 3 张图 → Cmd+C → 1 秒内 Eagle 出现这 3 张，名字是源文件名
4. 同样的 3 张文件**不要修改文件** → 再 Cmd+C → 应不重复（batchKey 命中）
5. 验证扩展名过滤：Finder 选 1 张 PNG + 1 个 .txt → Cmd+C → 只导入 PNG
6. **Windows 验证**（如果你在 Win 上）：资源管理器选多张 Ctrl+C，PowerShell 调用，行为应一致

**F. 验证节流**
1. 反复打开/关闭面板（5 秒内） → 不应每次都看到「索引中 N/M」（节流生效）
2. 选 fold A 开监听 → 切到 fold B → 应立即看到「索引中…」（切文件夹强制回填）

**G. 错误回归**
1. 删掉目标文件夹（在 Eagle 中） → 复制图 → 应报错并 5s 重试
2. shell-out 失败（卸载 osascript 不太可能，可在 Windows 上 disable PowerShell 模拟） → 多文件应静默失败，不影响单图路径

## M5 完成回顾（2026-05-31）

**实装范围**：
1. **Adaptive polling**：核心 UX 优化。同 hash 持续 3 轮 → `adaptiveMode = 'idle'` → schedulePoll 用 `max(用户设置, 5000ms)`；任何 hash 变化或图片不在 → 重置回 `normal`。
2. **重试倒计时**：`state.retryAt` + 1Hz `retryTicker`；UI 文案「将在 N 秒后重试」实时递减。
3. **最近导入列表**：`state.recentImports` (cap 5)；UI 列表渲染，单图 / 截图 / 多文件都写入。

**关键设计点**：
- adaptive 不暴露给用户控制：透明优化即可，过度暴露会让用户犹豫
- 用户已经把 base 调到 ≥5s 时不再额外放慢（避免双重节流）
- 截图按钮触发后，下一次轮询会拾到新图 → hash 变化 → 自动回 normal（自动响应快）
- 重试 ticker 跟 setTimeout 解耦：ticker 只刷 UI，真正的重启逻辑还在 setTimeout
- recent 列表用 `unshift + length cap`，简单可控

**未做（M6 候选）**：
- 用户视角文案重写（plan.md 已细化清单）
- 「打开 Eagle 日志」快捷入口（Eagle API 是否有 openLog 待查）
- 打开 Eagle item 点击跳转（依赖 Eagle 是否有 `eagle.item.open(id)`）

### M5 本地验证清单

**A. Adaptive polling**（核心）
1. 选文件夹 → 开监听 → 默认 1s 间隔
2. 复制一张图（hash 变化）→ 入库 → 继续 1s 轮询
3. **保持剪贴板不动 ~10 秒** → 观察 macOS 横幅频率：从 1Hz 应在 3s 后降到 0.2Hz（约 5s 一次）
4. 复制新图（hash 变化）→ 应立刻入库（≤1s 内），后续又恢复 1s 轮询
5. 把间隔调到 5s → 不要触发 adaptive 额外放慢（保持 5s）
6. Eagle 日志面板应能看到 `adaptive → idle` / `adaptive → normal` 切换日志

**B. 重试倒计时**
1. 选目标文件夹后在 Eagle 里删除该文件夹 → 复制图触发错误
2. 错误 banner 应显示「将在 N 秒后重试」N 从 5 倒数到 1
3. 重选合法文件夹 → 倒计时清除，回到「监听中」

**C. 最近导入列表**
1. 复制 6 张不同图 → 最近导入区应只显示最近 5 条（最新在顶）
2. 点截图按钮 → 截一张 → 列表顶部一条带 `Screenshot WxH ...`
3. 开多文件复制 → Finder 选 3 张 → 列表里应同时新增 3 条
4. 列表超出容器高度 → 应能滚动

**D. 回归**
1. 删后再复制（M4 #4 修复）仍生效
2. 文件夹切换 → 索引中… → 监听中
3. 暗色模式 → 列表样式跟随

## M6 完成回顾（2026-05-31）

**触发**：用户说"设置太开发者视角，后续要改成用户视角"，并跳过 M5 验证直接进 M6。

**M6.1 文案重写**——逐项落地 plan.md 的清单：
- 移除所有"（默认开启 / 默认关闭）"标记（控件初始态已表达）
- 去除 `osascript / PowerShell / format / hash / 索引` 等开发者用语
- 改用任务化口径：`检查频率` / `保存到 Eagle 的哪个文件夹` / `刷新已保存记录` / `自动保存复制的图片` / `遇到已有的相同图片` 等
- 错误信息口语化：`暂时读不到剪贴板` / `之前的设置读不出来了` 这类口吻
- 时间单位 `s` → `秒`
- 状态文案：`监听中` → `正在运行`；`索引中 N/M` → `正在整理文件夹内容 N/M`

**M6.2 打包验证**：
- `npm run pack` 实跑通过
- 产物 17.5KB，6 个文件（manifest/index.html/logo.png/js/{ui,plugin}.js）
- `docs/` `.agent-doc/` `.git/` 等开发期文件均**未**进 .eagleplugin
- `.gitignore` 已覆盖 `*.eagleplugin` 和 `*.zip`

**M6.3 README polish**：
- 用户视角重写「它做什么 / 平台 / 安装 / 使用 / 高级设置」
- 新增 macOS 14+ 横幅说明段（透明告知 + adaptive polling 缓解 + 用户级建议）
- 隐私段落：不联网 / 不上传 / 不遥测
- 高级设置改表格便于扫读
- 反馈渠道：GitHub Issues 占位 + 邮件

**未做（M7 才做）**：
- Eagle Plugin Center 提交材料（封面图 1280×800 / 描述文案 / 分类）
- 替换 `manifest.json.id` 为 Eagle 开发者工具生成的真实 ID
- GitHub Release v1.0.0 with `.eagleplugin` 附件
- 截图素材生成（README/Plugin Center 用）

## M7 完成回顾（2026-05-31）— 文档级 / 代码级到位

**用户决策**：
- 仓库**保持 private**，不切 public
- 走 Eagle Plugin Center 正常发布流程
- 用户最后做验证

**M7 已交付（代码 / 文档级）**：
- `package.json` version 0.0.0 → 1.0.0
- `docs/CHANGELOG.md` 切版到 `[1.0.0] — 2026-05-31`；新建空 `[Unreleased]` 留给 v1.1+；M1–M6 完整里程碑总览
- `docs/release-checklist.md`：用户手动步骤清单，覆盖设计资产 / Eagle 开发者工具 / License 风险点 / GitHub Release / Plugin Center 提交 / 提交后回流
- `docs/plugin-center-submission.md`：中英文短/长描述、隐私声明、License 声明、reviewer 备注、关键词、分类建议
- `manifest.json` 最终确认：`version: 1.0.0` / `devTools: false` / `serviceMode: true`
- `npm run pack` 再跑一遍：产物 17.5KB / 6 文件 / 干净

**M7 待用户做（GUI / 设计资产 / 账户权限，I 做不了）**：
- Logo 128×128 PNG（当前占位）
- 封面图 1280×800
- 功能截图 3–5 张
- Eagle 开发者工具生成正式 Plugin ID → 替换 manifest.json.id
- License 风险点：邮件 Eagle 官方询问是否接受 PolyForm-NC（ADR-006 fallback 已记）
- GitHub Release v1.0.0（可选，仓库 private 时 Release 对外不可见）
- Plugin Center 后台填表 + 上传 `.eagleplugin` + 提交审核
- 端到端验证（M3 A–H / M4 A–G / M5 A–D 清单）

**完成定义**：
- ✅ Plugin Center 审核通过 → 改 M7 状态为 ✅ Done
- ❌ 审核拒（License 原因等）→ 回 ADR-006 重新决策 → 起 M7.1

详细步骤见 [docs/release-checklist.md](../docs/release-checklist.md) 与 [docs/plugin-center-submission.md](../docs/plugin-center-submission.md)。

## 后续计划

- **v1.0.x（hotfix）**：用户验证发现 bug → 修复 → patch 发布
- **v1.1（候选）**：
  - 多文件复制 Linux 支持（xclip / wl-paste）
  - 「打开 Eagle 里的 item」点击跳转（需 Eagle 是否有 `eagle.item.open`）
  - 暗色模式 7 种主题逐一适配（当前 DARK/GRAY/BLUE/PURPLE 都按 dark 渲染）
  - 自定义命名模板（用户配置 `{source}-{WxH}-{date}` 等）
- **v1.2（候选）**：
  - 多文件夹路由规则（按来源区分：截图 vs 复制）
  - OCR 文字提取自动打标（依赖 Eagle AI SDK）

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
