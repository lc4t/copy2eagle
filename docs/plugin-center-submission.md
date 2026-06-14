# Eagle Plugin Center 提交材料 — v1.5.3

> 提交时直接复制下方对应段。中英文双版本均已准备。
> Eagle Plugin Center 后台填表项次序可能调整，按对应字段对号入座即可。

---

## 1. 基本信息

| 字段 | 内容 |
|---|---|
| Plugin Name (English alias) | Clipboard Image Archive |
| Plugin Name (中文 / manifest) | 剪贴板图片留存 |
| Version | 1.5.3 |
| Author | lc4t |
| Author Email | lc4t0.0@gmail.com |
| Homepage | https://github.com/lc4t/copy2eagle |
| Bug Report | https://github.com/lc4t/copy2eagle/issues |
| License | MIT |
| Platform | macOS / Windows |

---

## 2. 分类与关键词

**Category（建议）**：
- 一级：`Productivity` / 工具
- 二级（若有）：`Import Tools` / `Clipboard` / 导入

**Keywords**（不超过 6 个，逗号分隔）：

英文：
```
clipboard, screenshot, auto-import, productivity, watcher, batch-import
```

中文：
```
剪贴板, 截图, 自动入库, 效率工具, 批量导入, 自动归档
```

---

## 3. Description（短描述，≤ 80 字 / 词）

### 中文短描述

> 复制图片、截图、Cmd/Ctrl+C 多张图片，都自动保存到你指定的 Eagle 文件夹。开了就忘，专注内容本身。

### English short description

> Automatically save copied images, screenshots, and copied image files into your chosen Eagle folders.

---

## 4. Description（长描述，用于详情页）

### 中文长描述

```
剪贴板图片留存是一个让 Eagle 自动接管图片归档的 macOS / Windows 插件。

【它做什么】
- 复制任何图片（截图 / 浏览器右键 / 其他 App 里 Cmd/Ctrl+C 图片），按设置频率自动出现在你指定的 Eagle 文件夹
- 面板提供「立即截图」按钮（macOS），框选区域后自动入库
- Windows 使用 Win+Shift+S 截图，截图进入剪贴板后自动入库
- 复制带文字的图文混排内容（网页 / Word / 微信），里面的图片也会保存（可关）
- 在 Finder / 资源管理器选中多张图片复制，可一次性全部入库（默认关，按需打开）
- 智能去重：默认跳过目标文件夹已存在的同图；可改为允许重复
- 自动加主机名标签，多机协作时方便区分图片来自哪台机器

【特别照顾】
- 对 macOS 14 Sonoma「已粘贴自 Eagle」系统通知，采用 adaptive polling 自动放慢轮询：剪贴板里的图持续不变时自动从 1 秒一次降到 5 秒一次，明显减少通知频率
- 后台运行（serviceMode），关闭面板后监听继续，不打断你正常使用 Eagle

【隐私】
- 不发起任何外部网络请求
- 不上传 / 不统计 / 不遥测
- 所有数据均在本机处理
- 配置存在 localStorage（每个插件独立 sandbox）
- 临时图片只在系统临时目录短暂存在，入库完成即删除

适合喜欢「复制完图片就忘掉它」的用户。
```

### English long description

```
Clipboard Image Archive lets Eagle automatically handle image archiving on macOS and Windows.

【What it does】
- Copy any image (screenshot, browser right-click, Cmd/Ctrl+C from any app) and it appears in your chosen Eagle folder at the configured polling interval
- "Take Screenshot" button (macOS): drag-select region, auto-import on release
- On Windows, use Win+Shift+S; the clipboard screenshot is imported automatically
- Mixed clipboard content (image + text from web pages / Word / chat apps): the image is saved too (toggle to opt out)
- Select multiple image files in Finder or Explorer and press Cmd/Ctrl+C: all imported in one go (off by default, opt-in)
- Smart deduplication: skips images already in the target folder by default; or allow duplicates if you prefer
- Route screenshots, copied images, and copied files to separate Eagle folders
- Customize names with source, dimensions, date, time, hostname, and import counters
- Auto-appends hostname tag — useful when syncing Eagle libraries across machines

【macOS 14+ aware】
- Sonoma's "Pasted from Eagle" system banner: addressed via adaptive polling. When the clipboard image stays unchanged, polling slows from 1×/s to once every 5s, dramatically reducing banner frequency.
- Runs in serviceMode: closing the panel does not stop monitoring.

【Privacy】
- Zero external network requests
- No uploads / no analytics / no telemetry
- Everything happens locally
- Settings stored in localStorage (sandboxed per plugin)
- Temporary image files in OS tmpdir, auto-cleaned after import

Built for users who just want copied images to land where they belong — and to stop thinking about it.
```

---

## 5. 隐私声明（Privacy Policy）

```
剪贴板图片留存 (Clipboard Image Archive) does not collect, transmit, or share any data.

- No external network requests are made by this plugin.
- No analytics, telemetry, or crash reporting is performed.
- User settings are stored locally via the webview's localStorage API.
- Clipboard image data is held in memory only for the duration of import; temporary files are written to the OS temp directory and immediately deleted after successful import to Eagle.
- The plugin reads the system clipboard, imports local image files into the selected Eagle folder, and uses the OS temporary directory while processing clipboard images.
- For optional multi-file import it invokes the built-in macOS `osascript` command or Windows PowerShell locally.

On macOS 14+ (Sonoma), the system may display a "Pasted from Eagle" banner when the plugin reads the clipboard. This is macOS system behavior, not a privacy concern caused by the plugin. The plugin uses adaptive polling to minimize banner frequency when the clipboard is idle.

Contact: lc4t0.0@gmail.com
Source code: https://github.com/lc4t/copy2eagle
```

---

## 6. License 声明（提交时需填）

> **MIT License**
>
> Copyright (c) 2026 lc4t
>
> Full text is included in the package root `LICENSE` file.

---

## 7. 资产清单（提交前必须就位）

参见 [release-checklist.md §1](release-checklist.md#1-设计资产必须)：

- [x] Logo 512×512 PNG（透明背景，32×32 可读）
- [x] 封面图 1280×800：`assets/plugin-center/cover-1280x800.png`
- [x] 功能截图 3 张：`assets/plugin-center/screenshot-*.png`

---

## 8. 给 reviewer 的备注（提交时可选）

```
Tech notes:
- macOS and Windows; manifest platform is set to "all"
- Runs in serviceMode (background monitoring)
- All clipboard / filesystem access is local; no network calls
- Adaptive polling implementation specifically addresses macOS 14 Sonoma
  "Pasted from" banner concerns
- Multi-file clipboard support uses macOS osascript or Windows PowerShell
  via child_process with a 2s timeout;
  declared in the privacy section
- The built-in "Take Screenshot" button is macOS-only. Windows users use
  Win+Shift+S and the resulting clipboard image is imported normally.

Thanks for reviewing!
```
