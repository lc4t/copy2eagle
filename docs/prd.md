# Eagle Clipboard Watcher — 插件需求文档

> 面向 Codex 的完整开发需求，版本 v1.0  
> 目标：开发一个 Eagle Background Service 插件，自动将剪贴板图片和截图导入至用户指定的 Eagle 文件夹

---

## 一、产品概述

### 1.1 目标用户
Eagle 用户，习惯通过截图或复制图片收集素材，希望这些图片自动归档到 Eagle 特定文件夹，无需手动拖入。

### 1.2 核心价值
安装插件后，用户唯一需要做的事是：选好目标文件夹 → 开启监听。此后截图和复制的图片自动出现在 Eagle 里。

### 1.3 分发目标
打包为 `.eagleplugin` 文件，发布到 Eagle Plugin Center，面向全平台（macOS + Windows）用户。

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
- Windows：按钮置灰，提示用户使用 `Win+Shift+S`（系统截图默认即进剪贴板）
- 截图结果进剪贴板后由 F1 剪贴板轮询自动捕获并导入

##### F2.2 推荐快捷键
- 建议用户在系统偏好中绑定截图快捷键（macOS：`Cmd+Shift+Ctrl+4` 即直接到剪贴板）
- 插件 README 中给出操作指引
- 不在 v1.x 实现全局快捷键注册（Eagle 插件 API 未公开此能力，引入第三方依赖收益过低）

##### F2.3 不再做
- ❌ 监听截图保存目录（`fs.watch`）
- ❌ 识别系统截图文件名正则
- ❌ 500ms 写盘等待

#### F3：导入到 Eagle 指定文件夹
- 使用 `eagle.item.addFromPath(path, options)` 导入
- 导入参数：
  ```json
  {
    "name": "Clipboard YYYY-MM-DD HH:mm:ss",
    "folders": ["<用户配置的 folderId>"],
    "tags": ["clipboard-watcher"],
    "annotation": "Auto imported by Clipboard Watcher"
  }
  ```
- 剪贴板图片：先将图片数据写入系统临时目录（`os.tmpdir()/eagle-cw/`），再传路径给 API
- 截图文件：直接传原始路径，不复制
- 导入完成后删除临时文件

#### F4：去重机制（v1.1 修订）

**核心原则**：同一张图片在目标文件夹内不出现两次。

##### F4.1 hash 方法
- 对图片 PNG Buffer 取 `Buffer.byteLength` + 前 256 字节拼接做 hash（轻量，无需引入 crypto 库）

##### F4.2 检测范围
- 维度：**目标 folderId 维度**（更换文件夹则各自独立判定）
- 来源：
  - **进程内 hash 集合**：插件运行期间已成功导入过的所有 hash
  - **启动期回填**：插件启动 / 切换文件夹时，调用 `eagle.item.get({ folders: [folderId] })` 拉取该文件夹现有 item，按 item 实际文件路径逐个计算 hash 回填进集合
- 进程内 hash 集合不持久化（重启时由回填重建，避免 `eagle.extraData` 10KB 上限）

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
- 配置持久化：用 `eagle.extraData` 存储，key 为 `clipboardWatcher`

#### F6：启停开关
- 主界面提供一个开关（Toggle），控制监听是否激活
- 开关状态持久化到 `eagle.extraData`
- 插件启动时读取持久化状态，自动恢复上次的开启/关闭状态

#### F7：高级选项（可折叠区域）
- **监听间隔**：滑块，范围 500ms–5000ms，默认 1000ms
- **自动添加标签**：文本输入，用逗号分隔，默认 `clipboard-watcher,<os.hostname()>`（v1.1 修订：自动附主机名，便于多机协作时区分来源）
- **重复图片处理**：Radio 二选一（`skip` 默认 / `allow`），见 F4.3
- ❌ ~~截图监听目录~~（v1.1 移除，原因见 F2 修订与 ADR-011）

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
  "name": "Clipboard Watcher",
  "logo": "/logo.png",
  "keywords": ["clipboard", "screenshot", "auto", "import", "剪贴板"],
  "devTools": false,
  "main": {
    "serviceMode": true,
    "url": "index.html",
    "width": 480,
    "height": 600,
    "minWidth": 400,
    "minHeight": 500,
    "resizable": true,
    "backgroundColor": "#ffffff"
  }
}
```

> ⚠️ `id` 字段在提交 Eagle Plugin Center 前需替换为通过 Eagle 开发者工具生成的真实唯一 ID。

### 3.4 可用 API 清单

| API | 用途 |
|---|---|
| `require('electron').clipboard` | 读取剪贴板图片（`readImage()`） |
| `require('fs')` | 写入/删除临时文件 |
| `require('os')` | 获取 `tmpdir()`、`platform()` |
| `require('path')` | 路径拼接 |
| `eagle.item.addFromPath(path, opts)` | 导入文件到 Eagle |
| `eagle.folder.getAll()` | 获取所有文件夹 |
| `eagle.extraData` | 持久化配置（get/set） |
| `eagle.notification.show(opts)` | 发送系统通知 |
| `eagle.onPluginCreate(callback)` | 插件初始化入口 |
| `eagle.onPluginShow(callback)` | 面板显示时触发（用于刷新 UI） |

### 3.5 剪贴板读取逻辑（关键实现细节）

```javascript
const { clipboard, nativeImage } = require('electron')

function checkClipboard() {
  const img = clipboard.readImage()
  if (img.isEmpty()) return null
  const buffer = img.toPNG()
  // 轻量 hash：长度 + 前256字节内容
  const hash = buffer.length + '_' + buffer.slice(0, 256).toString('base64').slice(0, 32)
  return { img, buffer, hash }
}
```

### 3.6 截图目录自动检测（macOS）

macOS 截图目录存储在系统偏好设置中，可通过以下方式读取：

```javascript
const { execSync } = require('child_process')

function getScreenshotDir() {
  if (require('os').platform() !== 'darwin') return null
  try {
    const dir = execSync(
      'defaults read com.apple.screencapture location 2>/dev/null'
    ).toString().trim()
    return dir || require('os').homedir() + '/Desktop'
  } catch {
    return require('os').homedir() + '/Desktop'
  }
}
```

### 3.7 `eagle.item.addFromPath` 参数说明

```javascript
await eagle.item.addFromPath(filePath, {
  name: 'Clipboard 2026-05-27 14:30:00',
  folders: [folderId],          // 注意是数组，不是单个 folderId
  tags: ['clipboard-watcher'],
  annotation: 'Auto imported by Clipboard Watcher'
})
```

> ⚠️ 参数键名是 `folders`（数组），不是 `folderId`（字符串）。

---

## 四、UI 设计规范

### 4.1 整体风格
- 与 Eagle 主界面风格一致，采用 Eagle 的 CSS 变量（Eagle 注入了 `--eagle-*` 前缀变量）
- 支持 Eagle 的明暗主题切换（监听 `eagle.app.isDarkMode`）
- 字体：系统默认 `-apple-system, "Segoe UI", sans-serif`

### 4.2 面板布局（从上到下）

```
┌──────────────────────────────────┐
│  Clipboard Watcher          v1.0 │
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
- `manifest.json` 中的唯一 `id`（通过 Eagle 开发者工具生成）
- 插件名称：`Clipboard Watcher`
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

1. **Windows 截图监听**：Windows 使用 `PrintScreen` / `Win+Shift+S` 截图默认进剪贴板，F1 已覆盖；Snipping Tool 存文件的场景暂不处理（v1.2+ 考虑）
2. **Eagle 必须运行**：插件是 Eagle 的子进程，Eagle 关闭则监听停止，这是合理预期
3. **配置存储**：使用 webview 原生 `localStorage`（ADR-010 / K7），容量 10MB+ 远超 PRD 早期写的 10KB；配置 JSON 仍应保持小（< 10KB 量级）以便打印日志
4. **隐私**：插件只在本地运行，不向任何外部服务器发送数据，需在 Plugin Center 描述中注明
5. **`clipboard.readImage()` 性能**：每秒调用不会有明显性能问题，但面板关闭期间 `serviceMode` 后台运行时 CPU 占用应低于 0.5%
6. **剪贴板权限与 macOS Sonoma 横幅（v1.1 新增，K12）**：
   - macOS / Windows 都**不需要显式申请权限**——没有"剪贴板访问"开关，插件随 Eagle 进程运行
   - **macOS 14+ (Sonoma) 起读剪贴板内容会触发"已粘贴自 Eagle"系统横幅**，1Hz 轮询会刷屏
   - 实现策略（M3 必做）：
     - 先调 `clipboard.availableFormats()` 查格式（轻量元数据查询，业界默认不触发横幅）
     - 仅在含 `image/*` 时才调 `clipboard.readImage()`
     - 上一帧 formats 不变时可直接跳过本轮（额外节流）
     - hash 比对放在 readImage 之后，相同 hash 直接退出
   - README 与面板需提示用户：横幅是 macOS 系统行为，不代表插件偷窥；如不接受可调大间隔或关闭监听
