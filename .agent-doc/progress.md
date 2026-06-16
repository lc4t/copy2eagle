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
| M7 | 开源发布准备（首次 v1.0.0 release） | ✅ Release 已建（v1.0.0 + .eagleplugin），待设计资产 + Plugin Center 提交 | 2026-05-31 | - |
| M8 | v1.1.0：点击跳转 + 失败通知 + Issue 模板 | ✅ Released | 2026-05-31 | - |
| M9 | v1.2.0：主题 bug 修复 + Linux 多文件 | ✅ Released | 2026-05-31 | - |
| M10 | v1.2.1 hotfix #1：Finder 复制文件时不再误导入系统预览 icon | ✅ Released | 2026-06-02 | #1 |
| M11 | v1.3.0 架构重构：plugin.js 拆 12 个 lib 模块 + i18n bootstrap | ✅ Released | 2026-06-02 | - |
| M12 | v1.4.0：多文件夹路由 + 全期计数 + EN 翻译完整化 | ✅ Released | 2026-06-02 | - |
| M13 + M14 | v1.5.0：bundle 修 [#2]（v1.3 起面板空白）+ 命名模板（F13） | ✅ Released | 2026-06-03 | #2 |
| M15 | v1.5.1 hotfix：manifest fullscreenable: false 防 macOS 全屏黑屏 | ✅ Released | 2026-06-03 | - |
| M16 | v1.5.2 心跳锁：双实例并存时跳过 import + UI 警告 + 自动恢复 | ✅ Released | 2026-06-06 | - |
| M17 | v1.5.3 correctness hotfix + 上架前置修复 | ✅ GitHub Released，待 Plugin Center 提交 | 2026-06-15 | - |
| M18 | v1.5.4 Plugin ID UUID 热修复 | 🔄 GitHub Released，待 Plugin Center 重新上传 | - | - |
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
3. 在 Eagle 里查看 item annotation → 应含 `Source: ...` `Size: ...` `Imported by 剪贴板图片留存 @ <主机名>`

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
- 在 Plugin Center 登录态提交页确认并替换 `manifest.json.id`
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
- 在 Plugin Center 登录态提交页确认正式 Plugin ID → 替换 manifest.json.id
- License 风险点：邮件 Eagle 官方询问是否接受 PolyForm-NC（ADR-006 fallback 已记）
- GitHub Release v1.0.0（可选，仓库 private 时 Release 对外不可见）
- Plugin Center 后台填表 + 上传 `.eagleplugin` + 提交审核
- 端到端验证（M3 A–H / M4 A–G / M5 A–D 清单）

**完成定义**：
- ✅ Plugin Center 审核通过 → 改 M7 状态为 ✅ Done
- ❌ 审核拒（License 原因等）→ 回 ADR-006 重新决策 → 起 M7.1

详细步骤见 [docs/release-checklist.md](../docs/release-checklist.md) 与 [docs/plugin-center-submission.md](../docs/plugin-center-submission.md)。

## M7.1–7.3（2026-05-31）追加

- **M7.1 设计 brief**：`docs/design-brief.md`，覆盖 logo / 封面 AI 生成 prompt（Midjourney / Ideogram / Recraft 多套）+ 5 张产品截图脚本（场景 / 准备步骤 / 命名约定）
- **M7.2 GitHub Release v1.0.0**：
  - 默认分支修正（entire 把它误标到 checkpoints 分支了 → 改回 `dev`）
  - `git tag -a v1.0.0`，push tag
  - `gh release create v1.0.0` 上传 `.eagleplugin` (17.5KB)
  - Release URL：https://github.com/lc4t/copy2eagle/releases/tag/v1.0.0
  - ⚠️ 仓库 private → 下载需登录 + 仓库读权限
- **M7.3 README 安装段写实**：把推荐路径设为「下载 .eagleplugin 双击」，明确标注「私仓须知」；Plugin Center 标「待审核」；开发者模式作兜底
- **未做（仍待你做）**：见 [docs/release-checklist.md](../docs/release-checklist.md)
  - 设计资产（按 `docs/design-brief.md` 跑 AI 生图或找设计师）
  - 在 Plugin Center 登录态提交页确认正式 Plugin ID
  - License 接受度问 Eagle 官方
  - Plugin Center 后台提交（材料已就位）
  - 端到端验证

## M8 完成回顾（2026-05-31）→ v1.1.0

- 点击「最近保存」卡片 → `eagle.item.open(itemId)` 在 Eagle 主窗口打开（`addFromPath` 返回值现在捕获）
- 导入失败也发系统通知（`addFromPath` / tmp 写入 / 多文件批量全失败 → 一条通知；共享 1.5s 节流）
- GitHub Issue 模板（bug.yml / feature.yml / config.yml）+ 仓库 Issues 启用（`gh repo edit --enable-issues`）
- 通知文案统一「保存」口径
- Release：https://github.com/lc4t/copy2eagle/releases/tag/v1.1.0

## M10 完成回顾（2026-06-02）→ v1.2.1（hotfix #1）

**触发**：用户提了 issue #1——复制文件夹 / PDF 时，系统自动生成的预览 icon 被导入 Eagle。

**根因**：macOS / Windows 在用户对文件 / 文件夹 / PDF 做 Cmd/Ctrl+C 时，剪贴板里**同时**有 file URL + 系统自动生成的预览 icon（`image/*` 槽位）。我们的 `runPoll` 看到 `image/*` 就当真图导入。

**修法**：`runPoll` 先 `probeAnyFormat(FILE_URL_FORMAT_CANDIDATES)`。有 file URL → 是"文件复制"场景，不导入 icon；只在用户开了多文件开关时走多文件路径（且只接受图片扩展名）。

**Release**：https://github.com/lc4t/copy2eagle/releases/tag/v1.2.1
**Issue 评论**：https://github.com/lc4t/copy2eagle/issues/1#issuecomment-4602429326

## M11 完成回顾（2026-06-02）→ v1.3.0（架构重构）

**触发**：用户判断"插件足够简单可以一步到位"，要求"先优化架构再做新功能"。

**重构内容**：
- `js/plugin.js` 单文件 1100 行 → 150 行入口编排器 + 12 个 `js/lib/` 模块
  - `constants` / `utils` / `state` / `config` / `i18n` / `theme` / `folders` / `clipboard` / `import` / `screenshot` / `notification` / `poll`
- 每模块单一职责，≤200 行
- `state` 集中：mutator 暴露为 `setRuntimeStatus / pushRecentImport / scheduleRender` 等
- 错误码集中：`ERROR_CODES` 枚举，配 i18n 表
- HTML 中文硬编码全改空壳 + id，`renderStaticLabels()` 注入
- i18n bootstrap：messages.zh 表 + `t(path, fallback, ...args)`，未来加 en 只需补表
- JSDoc typedef 加在 state.js

**行为**：与 v1.2.1 完全等价；用户感知零差异。

**Pack 产物**：从 19KB → 27.6KB（19 个文件含 lib/）。

**风险点**：Eagle webview 必须支持 `require('./lib/xxx')` 相对路径解析。若加载报错，回退 v1.2.1 后起 v1.3.1 改方案。

**Release**：https://github.com/lc4t/copy2eagle/releases/tag/v1.3.0

## M12 完成回顾（2026-06-02）→ v1.4.0

**触发**：用户在 v1.3.0 架构铺好后说"干"——第一波架构红利兑现。

**三件事**：
1. **多文件夹路由（F12）**：截图 / 复制 / 多文件按来源分流到不同 folder
   - 4 字段：`folderId`（主，必填）+ `folderIdScreenshot / folderIdClipboard / folderIdFiles`（可选）
   - `config.js: resolveTargetFolder(source)` 一处决策
   - enable 时同步 backfill 主 folder，后台异步 backfill 其他路由 folder
2. **持久化全期计数**：独立 localStorage key `clipboardWatcher.stats`，UI 状态行展示"今日 N · 累计 M"
3. **EN 翻译表**：67 个 key 完整 zh / en 对齐（自动校验通过），`navigator.language` 自动选

**架构投资落地**：M11 拆模块后，这 3 个特性各只改 2-3 个 lib 文件，没碰其他模块——证明架构边界是对的。

**已知取舍**：
- macOS 系统快捷键截图（非按钮）source 归为 `clipboard`，会落到剪贴板路由文件夹
- 区分需要 Eagle 暴露剪贴板 owner API，目前未公开

**Release**：https://github.com/lc4t/copy2eagle/releases/tag/v1.4.0

## M14 + M13 完成回顾（2026-06-03）→ v1.5.0

**触发**：用户在 v1.4.0 加载插件后开 issue [#2]——「面板全空，所有按钮不可点，只有'未运行'」。

**根因实锤**：v1.3.0 重构后 plugin.js 用 `require('./lib/xxx')` 加载 lib 模块。Eagle 4.x webview 的 `<script src>` 加载脚本里执行相对路径 `require()` 抛错——`window.ClipboardWatcher` 没建起来 → UI 渲染全跳过 →「未运行」是 HTML 残留的硬编码初始文本。这正是 v1.3.0 release notes 里我标注的风险点。

**修法（M14）**：本地 bundler
- 新增 `build/bundle.js`：read 所有 `js/lib/*.js` + `js/plugin.js` + `js/ui.js`，按依赖序拼成单个 `js/bundle.js`
- 重写 `require('./xxx')` → `__cw_require('lib/xxx')`，配 `__cw_modules` 表
- 模块用 IIFE 注入；plugin.js / ui.js 作入口 IIFE 跑副作用
- `npm run build` 生成；`npm run pack` 自动先 build
- `index.html` 改为只加载 `js/bundle.js`
- 源码维持模块化（开发体验不变），ship 单文件（绕开 Eagle webview 限制）
- 73.9KB bundle，3 套自动校验通过

**顺带兑现（M13）**：命名模板（F13）
- `nameTemplate` config 字段，默认 `{source} {dims} {timestamp}`
- 8 个 token：`{source}` / `{dims}` / `{timestamp}` / `{date}` / `{time}` / `{hostname}` / `{count}` / `{lifetime}`
- 多文件批量路径**不走模板**（保持向后兼容）
- UI：输入框 + 实时预览 + 「恢复默认」链接；input 不立即保存避免打断编辑
- `utils.js: renderTemplate(template, ctx)` 纯函数；`buildNameContext(...)` 在 import.js 暴露给 UI

**架构投资再次兑现**：bundler 本身是新增模块，没改任何 lib 文件。模板特性只改了 utils / config / import / i18n / index.html / ui.js 共 6 个文件。其他 lib 模块完全无改动。

**风险**：bundler 是新工具链，可能有 edge case（如复杂 `require` 表达式被正则漏掉）；目前所有 lib 都用简单 `require('./xxx')` 形式，已覆盖。

**Release**：https://github.com/lc4t/copy2eagle/releases/tag/v1.5.0

## M9 完成回顾（2026-05-31）→ v1.2.0

- **Bug 修**：`isDarkTheme()` 用 `/DARK|GRAY|BLUE|PURPLE/i` 正则，`LIGHTGRAY` 被误判为 dark 主题（含 `GRAY` 子串）。改为精确 `Set` 匹配
- **Linux 多文件**：`wl-paste --type text/uri-list`（Wayland）/ `xclip -t text/uri-list -o`（X11），根据 `$WAYLAND_DISPLAY` 自动优先；解析 file:// + URL decode
- UI hint：多文件开关下方文案补 Linux 说明
- Release：https://github.com/lc4t/copy2eagle/releases/tag/v1.2.0

## 后续计划

- **v1.2.x（hotfix）**：用户验证发现 bug → 修复 → patch 发布
- **v1.3（候选）**：
  - 自定义命名模板（用户配置 `{source}-{WxH}-{date}` 等）
  - 持久化全期计数（"你已经保存了 N 张" 满足感）
  - 首次空状态引导（无文件夹时大字 CTA）
  - i18n 抽取（为 Plugin Center 全球分发准备）
- **v1.4+（候选）**：
  - 多文件夹路由规则（按来源区分：截图 vs 复制 vs 多文件）
  - OCR 文字提取自动打标（依赖 Eagle AI SDK）
  - 全局快捷键（Eagle 插件 API 暂未公开）

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

- [x] Plugin Center 已明确拒绝旧 ID；`manifest.json.id` 已迁移并固定为 UUID v4 `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`
- [ ] Windows 已纳入商店版；发布后补齐真实设备验收
- [x] `logo.png` 已替换为 512×512 RGBA 正式图标
- [x] License 已改为 MIT
- [ ] frontend-design Skill 安装时机：M5 UI 精修前装

## 2026-06-13 发布准备度审计

**结论：尚不能直接提交 Eagle Plugin Center。**

- GitHub 当前无开放 issue，#1/#2 均已关闭，最新 release 为 v1.5.2。
- 静态构建、打包和 JS 语法检查通过。
- 发现 6 个尚未完成真修复的行为问题：双实例 heartbeat 互锁、heartbeat 提前失效、allow 重复策略失效、额外路由启动不回填、运行中改路由不回填、命名计数少 1。
- 上架阻塞：正式 Plugin ID、至少 256x256 正式图标、封面与至少 3 张真实截图、Eagle 端到端验收证据、reviewer README。
- README、提交材料和发布清单仍停在 v1.0.0，且包含“仓库 private / Issues 待开放”等已过时信息。
- 名称 `Clipboard Watcher` 未发现商店重名，改名不是硬要求；为提高功能表达，首选候选为 `Clipboard Image Importer`。

详细证据与影响见 `.agent-doc/bugs/bug-003-v1.5.2-release-readiness.md`。建议下一里程碑为 v1.5.3 correctness hotfix + Plugin Center readiness，待用户确认后写入 plan。

## M17 代码完成回顾（2026-06-13）— v1.5.3 候选

**已修复**：

1. 双实例改为 v2 单 owner lease；新旧 heartbeat 分离，兼容 v1.5.2 旧实例抢写。
2. lease 独立维护，不再受 adaptive 5 秒轮询或错误重试影响。
3. `duplicateStrategy=allow` 恢复 30 秒后允许同图再次导入。
4. 主文件夹与所有来源路由通过共享队列顺序回填；运行中改路由和手动刷新都会暂停、强制回填，并且只有最新操作恢复 polling。
5. `{count}` / `{lifetime}` 改为含本次值，跨日首张先重置今日计数。
6. UI 启停操作正确 await 异步 enable；tmp 写入失败会清理可能残留的半文件。

**自动验证**：

- `npm test`：13 checks passed（含 Windows PowerShell FileDropList 模拟）
- 所有 JS：`node --check` 通过
- `npm run pack`：通过，bundle 83,666 bytes；候选包 163,821 bytes / 6 文件，含 reviewer README 与 LICENSE
- manifest/package/index/runtime 版本统一为 1.5.3

**Eagle 4.0.0 macOS 基线验证（2026-06-14）**：

- `.eagleplugin` 安装成功，Eagle 创建 `剪贴板图片留存 1.5.3` 并启动 background service
- 既有配置被保留，目标文件夹 `COPY2SYNC` 的 130 项启动回填完成
- 512×512 PNG 从系统剪贴板导入成功，文件名、文件夹、标签和 annotation 正确
- 文本占位后再次复制同图，短窗口内未产生第二项
- 测试项已通过 Eagle Local API 移到回收站，目标文件夹恢复为 130 项
- 插件日志无新增 error/warn
- 2026-06-15 用户确认按 `P` 可找到「剪贴板图片留存」，面板正常打开且基础使用正常
- 2026-06-15 用户确认「立即截图」可被监听并成功入库；当场截图因包含主机名、私人文件夹和素材缩略图，仅用于验收后已删除，不得用于发布
- 发现面板纵向被 `maxHeight: 640` 过早限制，v1.5.3 候选已放宽为 960
- 2026-06-15 用户重开面板后确认纵向拉伸恢复正常

**仍待完成**：

- 非阻塞人工矩阵：来源路由切换、allow 超过 30 秒、双实例和错误恢复
- [x] Plugin Center 首图已升级为 1920×1200，满足后台大于 1560×1040 px 要求；3 张 1280×800 脱敏产品截图已生成并通过隐私复查

**发布候选结论（2026-06-15）**：

- 核心代码、自动测试、Eagle 安装/剪贴板/截图/UI/窗口拉伸验收和商店资产均已就绪
- 最终 `.eagleplugin` 为 163,821 bytes，6 个审核文件，manifest `devTools: false`
- GitHub Release 已发布：https://github.com/lc4t/copy2eagle/releases/tag/v1.5.3
- 下一步仅剩 Eagle Plugin Center 登录态上传与审核；剩余人工矩阵不阻塞首发

## M17 商店身份决策（2026-06-13）

- 中文主名称 / manifest：`剪贴板图片留存`
- 英文审核别名：`Clipboard Image Archive`
- License：MIT
- Plugin ID：原保留旧 ID 的决定已被 Plugin Center UUID 校验推翻；v1.5.4 起固定为 `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`
- 平台：2026-06-14 改为 macOS / Windows（manifest `platform: all`）
- 图标：F1 蓝色剪贴板图片流入归档盒，512×512 RGBA，32×32 可读
- 运行时：恢复 Windows PowerShell FileDropList；保留 macOS `screencapture` / `osascript`，不恢复 Linux shell 分支
- Windows 功能边界：普通剪贴板图片和多文件复制可用；`Win+Shift+S` 截图入库可用；内置截图按钮仅 macOS
- Windows 验证状态：自动模拟覆盖 PowerShell 调用，暂无真机证据，发布后按反馈补测和修复

## M18 进行中（2026-06-15）— v1.5.4 Plugin ID UUID 热修复

**触发**：

- Plugin Center 上传 v1.5.3 包时明确报错：插件 ID 格式不正确，要求有效 UUID。

**决定与改动**：

- 固定 Plugin ID 为 UUID v4 `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`。
- 版本升为 v1.5.4；不覆盖 v1.5.3 tag、Release 或附件。
- manifest / package / UI / runtime 版本同步，自动测试锁定固定 ID 与 UUID v4 格式。
- 旧 ID 与新 ID 可能不共享 localStorage 和 lease；安装 v1.5.4 前必须卸载旧插件，并重新选择目标文件夹。

**待完成**：

- [x] `npm test`：13 checks passed；全部 JavaScript `node --check` 通过
- [x] `npm run pack`：163,812 bytes / 6 个审核文件
- [x] 包内 manifest UUID、v1.5.4 与 `devTools: false` 复核通过
- [x] SHA-256：`c28af42b3fb0777b9fe4f9dbf7e96792532bda6eea08a027866c2aeef6092904`
- [x] GitHub v1.5.4 tag / Release：https://github.com/lc4t/copy2eagle/releases/tag/v1.5.4
- [ ] Plugin Center 重新上传
