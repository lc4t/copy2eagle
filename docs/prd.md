# Eagle 剪贴板图片留存 — 插件需求文档

> 面向 Codex 的完整开发需求，版本 v1.0  
> 目标：开发一个 Eagle Background Service 插件，自动将剪贴板图片和截图导入至用户指定的 Eagle 文件夹

---

## 一、产品概述

### 1.1 目标用户
Eagle 用户，习惯通过截图或复制图片收集素材，希望这些图片自动归档到 Eagle 特定文件夹，无需手动拖入。

### 1.2 核心价值
安装插件后，用户唯一需要做的事是：选好目标文件夹 → 开启监听。此后截图和复制的图片自动出现在 Eagle 里。

### 1.3 分发目标
打包为 `.eagleplugin` 文件，发布到 Eagle Plugin Center。v1.x 商店版仅声明支持 macOS。

---

## 二、功能需求

### 2.1 核心功能（MVP）

#### F1：剪贴板图片监听
- 每 **1 秒**轮询一次系统剪贴板
- 检测到图片类型内容时，与上一次内容做去重对比（用图片数据 hash，非时间戳）
- 内容变化时触发导入流程

#### F2：截图触发（剪贴板单路径，v1.1 修订）

> **重大调整**：放弃文件夹监听方案，所有图片获取都走剪贴板（参考 Alfred / Raycast）。详见 ADR-011。

##### F2.1 主面板「立即截图」按钮
- 主面板提供「立即截图（到剪贴板）」按钮
- macOS：点击后执行 `screencapture -ic`（interactive selection → clipboard）
- 截图结果进剪贴板后由 F1 剪贴板轮询自动捕获并导入

##### F2.2 推荐快捷键
- 建议用户在系统偏好中绑定截图快捷键（macOS：`Cmd+Shift+Ctrl+4` 即直接到剪贴板）
- 插件 README 中给出操作指引
- 不在 v1.x 实现全局快捷键注册（Eagle 插件 API 未公开此能力，引入第三方依赖收益过低）

##### F2.3 不再做
- ❌ 监听截图保存目录（`fs.watch`）
- ❌ 识别系统截图文件名正则
- ❌ 500ms 写盘等待

#### F3：导入到 Eagle 指定文件夹（v1.2 / M4 修订）
- 使用 `eagle.item.addFromPath(path, options)` 导入
- 单图（剪贴板）参数：
  ```json
  {
    "name": "Clipboard 1920x1080 YYYY-MM-DD HH:mm:ss",
    "folders": ["<用户配置的 folderId>"],
    "tags": ["clipboard-watcher", "<hostname>"],
    "annotation": "Source: Clipboard\nSize: 1920x1080\nImported by 剪贴板图片留存 @ <host>"
  }
  ```
- 命名规则（M4 / #5）：
  - 截图按钮触发后 **5 秒内**的导入 → `Screenshot {WxH} {timestamp}`，annotation 标 `Source: Screenshot (button)`
  - 其他剪贴板复制 → `Clipboard {WxH} {timestamp}`，annotation 标 `Source: Clipboard`
  - `{WxH}` 通过 `NativeImage.getSize()` 获取；失败时省略
  - **来源 APP 不可识别**（macOS clipboard 未透出原始应用，K14）
- 多文件批量（F10）参数：
  - `name`：源文件名（去扩展名）
  - `annotation`：含 `From: <full path>`
- 剪贴板图片：先将图片数据写入系统临时目录（`os.tmpdir()/eagle-cw/{source}-{stamp}.png`），再传路径给 API
- 多文件复制：直接传原始路径，不复制
- 导入完成（成功 or 失败）后删除临时文件

#### F4：去重机制（v1.1 修订）

**核心原则**：同一张图片在目标文件夹内不出现两次。

##### F4.1 hash 方法
- 对图片 PNG Buffer 取 `Buffer.byteLength` + 前 256 字节拼接做 hash（轻量，无需引入 crypto 库）

##### F4.2 检测范围
- 维度：**目标 folderId 维度**（更换文件夹则各自独立判定）
- 来源：
  - **进程内 hash 集合**：插件运行期间已成功导入过的所有 hash
  - **启动期回填**：插件启动 / 切换文件夹时，调用 `eagle.item.get({ folders: [folderId] })` 拉取该文件夹现有 item，按 item 实际文件路径逐个计算 hash 回填进集合
- 进程内 hash 集合不持久化；重启时从 Eagle 文件夹内容回填，确保 Eagle 本身是去重索引的事实来源

##### F4.3 重复处理策略（用户可选）

UI 控件：高级设置区下拉 / Radio，字段名 `duplicateStrategy`，可选：

| 值 | 行为 | 备注 |
|---|---|---|
| `skip`（**默认**） | 检测到重复直接跳过，不写 tmp、不调 `addFromPath`、不计数、不通知 | 符合用户"在这个文件夹就不要重复"的预期 |
| `allow` | 允许重复，仍然导入 | 用户明确想保留多份的场景 |

剪贴板路径：在写 tmp 之前先判 hash → skip 时整段流程短路。
截图路径：在调 `addFromPath` 之前判 hash → skip 时不导入但保留源文件（不动用户的截图原文件）。

##### F4.4 跨 Session 噪音抑制（保留）
- `skip` 策略下不再需要 30 秒滑动窗口（hash 集合已覆盖）
- `allow` 策略下保留 **30 秒滑动窗口**避免剪贴板被反复读取触发洪水（防抖 ≠ 去重）

##### F4.5 边界与限制
- 启动期回填若文件夹 item 数量大，初次扫描可能耗时（>1000 item 时显示「正在建立索引…」状态）
- 仅按 hash 算法判定，**不识别视觉相似**（裁剪、压缩、缩放后的同图被视为不同图，符合 MVP 期望）
- 用户在 Eagle 中手动添加的 item 也会被回填进 hash 集合（自然包含进去重范围）

### 2.2 配置功能

#### F5：目标文件夹选择
- 调用 `eagle.folder.getAll()` 获取所有文件夹列表
- 以下拉选择器展示（显示文件夹名称，存储 folderId）
- 支持二级文件夹（显示格式：`父文件夹 / 子文件夹`）
- 配置持久化：用 `localStorage`（key `clipboardWatcher`，K7 / ADR-010）

#### F6：启停开关
- 主界面提供一个开关（Toggle），控制监听是否激活
- 开关状态持久化到 `localStorage`
- 插件启动时读取持久化状态，自动恢复上次的开启/关闭状态

#### F7：高级选项（可折叠区域）
- **监听间隔**：滑块，范围 500ms–5000ms，默认 1000ms
- **自动添加标签**：文本输入，用逗号分隔，默认 `clipboard-watcher,<os.hostname()>`（v1.1 修订：自动附主机名，便于多机协作时区分来源）
- **重复图片处理**：Radio 二选一（`skip` 默认 / `allow`），见 F4.3
- **重置当前文件夹索引**：button（M4 新增）。用户在 Eagle 里手动删除 item 后点这里，hash 索引重建后下次同图可重新入库（修复 #4）
- **允许从图文混排导入图片**：checkbox（M4 新增），默认开 → 含 HTML/RTF 时仍导入图片；关 → 探到 text/* format 则跳过本张（见 F11）
- **支持多文件复制批量导入**：checkbox（M4 新增），默认关 → 用户主动开启；开启后走 shell-out 读路径（见 F10）
- ❌ ~~截图监听目录~~（v1.1 移除，原因见 F2 修订与 ADR-011）

#### F10：多文件复制批量导入（M4 新增，opt-in）

- **触发条件**：用户在高级设置勾选「支持多文件复制」+ 剪贴板探到文件 URL format
- **format 探测候选**：`public.file-url` / `NSFilenamesPboardType`（macOS）
- **路径读取**（Eagle 没暴露 `readBuffer`/`readURLs`，shell 出去抓）：
  - macOS：`osascript -e '...'` 把 `the clipboard as «class furl»` 转 POSIX 路径列表
- **超时**：2000ms（shell 调用上限）
- **过滤**：只处理图片扩展名（`.png/.jpg/.jpeg/.gif/.webp/.bmp/.tiff/.tif/.heic/.svg/.avif`）
- **批次上限**：50 张（防呆）
- **batchKey 去重**：用 `paths.length|paths[0]|mtimeMs(paths[0])` 做 key，避免同批反复触发
- **命名**：以文件原名（去扩展名）作为 Eagle item name；annotation 含来源路径
- **去重**：沿用 `duplicateStrategy`（skip / allow）
- **优先级**：单图剪贴板 > 多文件批量。剪贴板同时有图和文件 URL 时，**图优先**
- **平台差异**：Windows 支持剪贴板图片、多文件复制与 `Win+Shift+S` 截图入库；内置「立即截图」按钮仅 macOS。Linux 不在 Eagle 正式分发范围。

#### F11：图文混排导入开关（M4 新增）

- 默认 `importMixedContent = true`：剪贴板含图 + HTML/RTF 仍正常导入图片（当前 M3 行为）
- 关闭后：探到剪贴板里**同时**有 `text/html` / `text/plain` / `public.utf8-plain-text` / `public.html` 其一时，跳过本张
- **为什么默认开**：用户口径——"复制了图就该到 Eagle"；关闭只服务"我只是想用文本，别偷我图"的保守诉求

#### F12：多文件夹路由（v1.4 新增）

**核心诉求**：按来源把不同类型的图分流到不同文件夹（截图归"截图"文件夹，复制图归"剪藏"文件夹，多文件批量归"导入"文件夹）。

**Schema**（4 个 folder 字段）：
- `folderId`（主文件夹，必填）—— 作为默认/兜底
- `folderIdScreenshot`（可选）—— 截图按钮触发的导入目标
- `folderIdClipboard`（可选）—— 普通剪贴板复制的导入目标
- `folderIdFiles`（可选）—— 多文件复制的导入目标

任一可选字段为 `null` → 该来源落回主 `folderId`。

**Resolve 逻辑**（`config.js: resolveTargetFolder`）：
```js
function resolveTargetFolder(source, config) {
  if (source === 'screenshot' && config.folderIdScreenshot) return config.folderIdScreenshot
  if (source === 'clipboard' && config.folderIdClipboard) return config.folderIdClipboard
  if (source === 'files' && config.folderIdFiles) return config.folderIdFiles
  return config.folderId
}
```

**回填策略**：
- enable 时同步 backfill 主 folder
- 配置了的额外 folder 后台异步 backfill（不阻塞 polling 启动）
- 多 folder hash 集合各自维护（`hashSetByFolder: Map<folderId, Set<hash>>` 已支持）

**UI**：高级设置最后加 3 个 select，标签明确"不选则跟随主文件夹"。

**Source 来源判定**：保持 v1.0 行为
- `source = 'screenshot'`：截图按钮触发后 5s 内的导入
- `source = 'files'`：runPoll 多文件路径
- `source = 'clipboard'`：其余（含 macOS 系统截图 Cmd+Shift+Ctrl+4，因为我们无法区分按钮触发外的截图）

#### F13：自定义命名模板（v1.5 新增）

**核心诉求**：让用户决定 Eagle item 名字怎么拼。

**Config**：`nameTemplate`（string），默认 `{source} {dims} {timestamp}`（还原 v1.4 行为）。

**Token 表**：
| Token | 含义 | 举例 |
|---|---|---|
| `{source}` | 来源类型 | `Screenshot` / `Clipboard` |
| `{dims}` | 尺寸 WxH（无尺寸时为空） | `1920x1080` |
| `{timestamp}` | 完整时间戳 | `2026-06-03 02:30:00` |
| `{date}` | 日期 | `2026-06-03` |
| `{time}` | 时间 | `02:30:00` |
| `{hostname}` | 主机名 | `MacBook-Pro` |
| `{count}` | 今日计数（含本次） | `5` |
| `{lifetime}` | 累计计数（含本次） | `1234` |

**渲染规则**（`lib/utils.js: renderTemplate`）：
- 占位符替换；缺失 token 当空串
- 连续空白合并为单空格
- 末尾去空白
- 渲染结果为空 → 回退默认模板

**应用范围**：
- 单图剪贴板路径 ✓
- 截图按钮路径 ✓
- 多文件批量路径 ❌ — 仍用源文件 basename（保持向后兼容）

**UI**：
- 高级设置加输入框 + 占位符 hint + 实时预览 + 「恢复默认」按钮
- 实时预览：用 `{source=Screenshot, dims=1920x1080, ts=now()}` 作示例 ctx 渲染
- 输入时只更新预览，change（失焦 / Enter）才落到 `saveConfig`，避免打断编辑

### 2.3 状态与反馈

#### F8：状态展示
- 插件面板显示：
  - 当前状态：`监听中` / `已停止`（带颜色指示灯：绿/灰）
  - 今日导入计数
  - 最近一次导入记录（时间 + 缩略图预览，如 Eagle API 支持）
  - 上次错误信息（如有）

#### F9：系统通知（可选，用户可关闭）
- 每次成功导入后发送一条 `eagle.notification`
- 通知内容：`已导入 1 张图片 → [文件夹名]`
- 默认开启，可在高级选项中关闭

---

## 三、技术约束

### 3.1 插件类型
**Background Service Plugin**（后台服务插件）

```json
{
  "main": {
    "serviceMode": true,
    "url": "index.html",
    "width": 480,
    "height": 600
  }
}
```

`serviceMode: true` 使插件随 Eagle 启动自动运行，面板关闭后监听进程仍持续存在。

### 3.2 文件结构

```
eagle-clipboard-watcher.eagleplugin（实质是 zip）
├── manifest.json
├── logo.png              # 128×128 PNG
├── index.html            # 插件面板 UI
└── js/
    ├── plugin.js         # 主逻辑：监听、导入
    └── ui.js             # UI 交互逻辑
```

### 3.3 manifest.json 完整配置

```json
{
  "id": "CLIPBOARD_WATCHER_001",
  "version": "1.0.0",
  "platform": "all",
  "arch": "all",
  "name": "剪贴板图片留存",
  "logo": "/logo.png",
  "keywords": ["clipboard", "screenshot", "auto", "import", "剪贴板"],
  "devTools": false,
  "main": {
    "serviceMode": true,
    "url": "index.html",
    "width": 380,
    "height": 540,
    "minWidth": 360,
    "minHeight": 480,
    "maxWidth": 460,
    "maxHeight": 960,
    "resizable": true,
    "fullscreenable": false,
    "maximizable": false,
    "backgroundColor": "#ffffff"
  }
}
```

> v1.5.3 决定继续使用既有 ID `CLIPBOARD_WATCHER_001`，优先保持升级连续性。

### 3.4 可用 API 清单（v1.1 修订：实际验证过的接口）

| API | 用途 | 备注 |
|---|---|---|
| `eagle.clipboard.has(format)` | 探测剪贴板是否含指定 format | **替代** PRD v1.0 写错的 `require('electron').clipboard.availableFormats()`（K13） |
| `eagle.clipboard.readImage()` | 读取剪贴板图片，返回 NativeImage | NativeImage 上有 `isEmpty()` / `toPNG()` 等 Electron 方法 |
| `require('fs')` | 写入/删除临时文件 | ✓ |
| `require('os')` | 获取 `tmpdir()`、`platform()`、`hostname()` | ✓ |
| `require('path')` | 路径拼接 | ✓ |
| `require('child_process')` | 调 `screencapture -ic` | ✓ |
| `eagle.item.addFromPath(path, opts)` | 导入文件到 Eagle | `opts.folders` 必须是 `string[]` 数组（K10） |
| `eagle.item.get({ folders: [id] })` | 拉文件夹现有 item，回填 hashSet 用 | 每个 item 有 `.filePath` 是磁盘路径 |
| `eagle.folder.getAll()` | 获取所有文件夹（含 `children` 树） | ✓ |
| `localStorage.getItem/setItem` | 持久化配置 | **替代** PRD v1.0 写错的 `eagle.extraData`（K7 / ADR-010） |
| `eagle.notification.show(opts)` | 发送系统通知 | 插件内做 1.5s 节流避免刷屏 |
| `eagle.app.theme` (Promise) | 当前主题字符串 | **替代** PRD v1.0 写错的 `eagle.app.isDarkMode`（K8） |
| `eagle.onThemeChanged(cb)` | 主题切换监听 | ✓ |
| `eagle.onPluginCreate(callback)` | 插件初始化入口 | ✓ |
| `eagle.onPluginShow(callback)` | 面板显示时触发（用于刷新 UI） | ✓ |
| `eagle.onPluginBeforeExit(callback)` | 关闭前钩子（停轮询） | ✓ |
| `eagle.log.info/warn/error(msg)` | 写 Eagle 日志面板 | 替代 console.log |

### 3.5 剪贴板读取逻辑（v1.1 修订：用 eagle.clipboard）

```javascript
const IMAGE_FORMAT_CANDIDATES = [
  'image/png', 'image/jpeg', 'image/tiff', 'image/bmp', 'image/gif',
  'public.png', 'public.tiff', 'public.jpeg', 'public.image',
]

function probeImageFormat() {
  for (const fmt of IMAGE_FORMAT_CANDIDATES) {
    try { if (eagle.clipboard.has(fmt)) return fmt } catch {}
  }
  return null
}

function checkClipboard() {
  if (!probeImageFormat()) return null            // 不读 buffer → 不触发 macOS 横幅
  const img = eagle.clipboard.readImage()
  if (!img || img.isEmpty()) return null
  const buffer = img.toPNG()
  const hash = buffer.length + '_' + buffer.slice(0, 256).toString('base64').slice(0, 32)
  return { img, buffer, hash }
}
```

**为什么不用 `availableFormats()`**：Eagle 的 `eagle.clipboard` 只暴露 `has(format)` 和 `readImage()`，没有 `availableFormats()`（K13）。必须依次试已知 format 候选。

### 3.6 截图目录方案（已弃用）

不再读取或监听 macOS 截图目录。截图按钮使用 `screencapture -ic` 写入剪贴板，统一走 F1 导入路径，详见 ADR-011。

### 3.7 `eagle.item.addFromPath` 参数说明

```javascript
await eagle.item.addFromPath(filePath, {
  name: 'Clipboard 2026-05-27 14:30:00',
  folders: [folderId],          // 注意是数组，不是单个 folderId
  tags: ['clipboard-watcher'],
  annotation: 'Auto imported by 剪贴板图片留存'
})
```

> ⚠️ 参数键名是 `folders`（数组），不是 `folderId`（字符串）。

---

## 四、UI 设计规范

### 4.1 整体风格
- 与 Eagle 主界面风格一致，采用 Eagle 的 CSS 变量（Eagle 注入了 `--eagle-*` 前缀变量）
- 支持 Eagle 的明暗主题切换（读取 `await eagle.app.theme`，监听 `eagle.onThemeChanged`）
- 字体：系统默认 `-apple-system, "Segoe UI", sans-serif`

### 4.2 面板布局（从上到下）

```
┌──────────────────────────────────┐
│  剪贴板图片留存             v1.5 │
├──────────────────────────────────┤
│  ● 监听中        今日导入: 12 张  │
├──────────────────────────────────┤
│  目标文件夹                       │
│  [设计参考 ▾]                     │
├──────────────────────────────────┤
│  [ 开启监听 ●────────────── ]    │
├──────────────────────────────────┤
│  最近导入                         │
│  ┌───┐ Clipboard 14:32:01        │
│  │ 图│ → 设计参考                │
│  └───┘                           │
├──────────────────────────────────┤
│  ▶ 高级设置                       │
│  监听间隔: ──●────── 1000ms      │
│  自动标签: [clipboard-watcher  ] │
│  通知:     [✓] 导入成功时通知    │
│  截图目录: [~/Desktop        ] □ │
└──────────────────────────────────┘
```

### 4.3 状态指示灯颜色
- 监听中：`#52c41a`（绿）
- 已停止：`#d9d9d9`（灰）
- 发生错误：`#ff4d4f`（红）

---

## 五、错误处理

| 错误场景 | 处理方式 |
|---|---|
| Eagle 未运行 / API 不可用 | 捕获异常，面板显示错误状态，每 5 秒重试 |
| 未选择目标文件夹 | 开关置灰，提示「请先选择目标文件夹」 |
| 临时文件写入失败 | 跳过本次导入，记录错误日志到面板 |
| `addFromPath` 返回错误 | 显示具体错误信息，不崩溃 |
| 截图目录不存在 | 回退到 `~/Desktop`，面板提示 |

---

## 六、打包与分发

### 6.1 打包步骤

```bash
# 在插件目录下执行
zip -r "eagle-clipboard-watcher.zip" . -x "*.DS_Store" -x "__MACOSX/*"
mv eagle-clipboard-watcher.zip eagle-clipboard-watcher.eagleplugin
```

### 6.2 提交 Eagle Plugin Center 所需材料
- `manifest.json` 中已在 Plugin Center 提交后台确认的正式唯一 `id`
- 插件名称：`剪贴板图片留存`（英文别名 `Clipboard Image Archive`）
- 分类：`Productivity` / `Import Tools`
- 封面图：1280×800 PNG，展示插件面板截图
- 描述（英文）：
  > Automatically import screenshots and clipboard images into your Eagle library. Set a target folder once, and every image you copy or screenshot will appear there instantly — no drag and drop needed.

### 6.3 版本规划

| 版本 | 内容 |
|---|---|
| v1.0 | MVP：剪贴板监听 + 截图监听 + 文件夹选择 + 开关 |
| v1.1 | 多文件夹路由规则（按来源区分：截图 vs 复制） |
| v1.2 | 关键词触发标签（图片含文字时自动 OCR 打标，依赖 Eagle AI SDK） |

---

## 七、开发环境与调试

### 7.1 本地安装插件
1. Eagle → 菜单 → 插件 → 开发插件 → 选择插件目录
2. 开启 `devTools: true` 可打开 Chrome DevTools 调试

### 7.2 调试建议
- `plugin.js` 中用 `eagle.log.info()` 替代 `console.log`，日志在 Eagle 日志面板可见
- 配置存在 `localStorage`（key=`clipboardWatcher`），DevTools Console 一句 `localStorage.removeItem('clipboardWatcher')` 即可重置（ADR-010）
- `serviceMode` 插件在调试阶段建议临时把 `manifest.json` 里 `devTools` 改为 `true`，commit 前必须切回 `false`

---

## 八、已知限制与注意事项

1. **Windows 真机补测**：商店版允许 Windows 安装；当前通过自动模拟覆盖 PowerShell 多文件路径，仍需补齐真实设备上的剪贴板、多文件和生命周期验收
2. **Eagle 必须运行**：插件是 Eagle 的子进程，Eagle 关闭则监听停止，这是合理预期
3. **配置存储**：使用 webview 原生 `localStorage`（ADR-010 / K7），容量 10MB+ 远超 PRD 早期写的 10KB；配置 JSON 仍应保持小（< 10KB 量级）以便打印日志
4. **隐私**：插件只在本地运行，不向任何外部服务器发送数据，需在 Plugin Center 描述中注明
5. **`clipboard.readImage()` 性能**：每秒调用不会有明显性能问题，但面板关闭期间 `serviceMode` 后台运行时 CPU 占用应低于 0.5%
6. **剪贴板权限与 macOS Sonoma 横幅（v1.1 / M3.1 修订，K12 / K13）**：
   - macOS 不需要插件自行声明 entitlement；系统可能显示“已粘贴自 Eagle”横幅
   - **macOS 14+ (Sonoma) 起读剪贴板内容会触发"已粘贴自 Eagle"系统横幅**
   - 实现策略：
     - 先调 `eagle.clipboard.has(fmt)` 依次探测图片 format 候选（不读 buffer，不触发横幅）
     - 全部 false → 整轮跳过
     - 探到任一为 true → `eagle.clipboard.readImage()`（每次调用可能触发一次横幅）→ `toPNG()` → hash → 与上次比对，相同 hash 直接返回
   - **真实代价**：剪贴板里持续留着一张图时，每轮 readImage 会触发横幅；1Hz 间隔意味着每秒一次横幅
   - **缓解**：建议 macOS 14+ 用户把间隔调到 2–5s；后续 M4 可做 adaptive polling（同 hash 持续 N 轮放慢）
   - README 与面板已提示：横幅是 macOS 系统行为，不代表插件偷窥
