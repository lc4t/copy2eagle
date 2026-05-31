# Eagle Plugin Center 提交材料 — v1.0.0

> 提交时直接复制下方对应段。中英文双版本均已准备。
> Eagle Plugin Center 后台填表项次序可能调整，按对应字段对号入座即可。

---

## 1. 基本信息

| 字段 | 内容 |
|---|---|
| Plugin Name (English) | Clipboard Watcher |
| Plugin Name (中文) | 剪贴板自动入库 |
| Version | 1.0.0 |
| Author | lc4t |
| Author Email | lc4t0.0@gmail.com |
| Homepage | https://github.com/lc4t/copy2eagle |
| Bug Report | https://github.com/lc4t/copy2eagle/issues |
| License | PolyForm Noncommercial 1.0.0（source-available, 非商用 + 须署名） |
| Platform | macOS / Windows / Linux（macOS 含截图按钮 / 多文件批量；Windows 含多文件批量；Linux 仅剪贴板） |

---

## 2. 分类与关键词

**Category（建议）**：
- 一级：`Productivity` / 工具
- 二级（若有）：`Import Tools` / `Clipboard` / 导入

**Keywords**（5–8 个，逗号分隔）：

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

> 复制图片、截图、Cmd+C 多张图片，都自动保存到你指定的 Eagle 文件夹。开了就忘，专注内容本身。

### English short description

> Copy any image, take a screenshot, or Cmd/Ctrl+C multiple files — they auto-appear in your chosen Eagle folder. Set it once, then forget about importing.

---

## 4. Description（长描述，用于详情页）

### 中文长描述

```
Clipboard Watcher 是一个让 Eagle 自动接管图片归档的插件。

【它做什么】
- 复制任何图片（截图 / 浏览器右键 / 其他 App 里 Cmd+C 图片），1 秒内自动出现在你指定的 Eagle 文件夹
- 面板提供「立即截图」按钮（macOS），框选区域后自动入库
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
Clipboard Watcher lets Eagle automatically handle your image archiving.

【What it does】
- Copy any image (screenshot, browser right-click, Cmd+C from any app) — appears in your chosen Eagle folder within 1 second
- "Take Screenshot" button (macOS): drag-select region, auto-import on release
- Mixed clipboard content (image + text from web pages / Word / chat apps): the image is saved too (toggle to opt out)
- Select multiple image files in Finder / Explorer and Cmd/Ctrl+C: all imported in one go (off by default, opt-in)
- Smart deduplication: skips images already in the target folder by default; or allow duplicates if you prefer
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
Clipboard Watcher does not collect, transmit, or share any data.

- No external network requests are made by this plugin.
- No analytics, telemetry, or crash reporting is performed.
- User settings are stored locally via the webview's localStorage API.
- Clipboard image data is held in memory only for the duration of import; temporary files are written to the OS temp directory and immediately deleted after successful import to Eagle.
- The plugin only reads the system clipboard and writes to your selected Eagle folder — no other system access.

On macOS 14+ (Sonoma), the system may display a "Pasted from Eagle" banner when the plugin reads the clipboard. This is macOS system behavior, not a privacy concern caused by the plugin. The plugin uses adaptive polling to minimize banner frequency when the clipboard is idle.

Contact: lc4t0.0@gmail.com
Source code: https://github.com/lc4t/copy2eagle (private until v1.0.0+ feedback)
```

---

## 6. License 声明（提交时需填）

> **PolyForm Noncommercial License 1.0.0**（source-available, non-commercial）
>
> Permitted uses: personal, educational, research, public-interest organizations.
> Prohibited: any commercial use.
> Attribution required (see Required Notice in LICENSE).
>
> Full text: https://polyformproject.org/licenses/noncommercial/1.0.0
> For commercial licensing, contact lc4t0.0@gmail.com

> ⚠️ 提交时如果 Plugin Center 表单 license 字段只能选预设（MIT / Apache / GPL...），选 `Other` 或 `Custom`，并把上述文字粘到备注栏。

---

## 7. 资产清单（提交前必须就位）

参见 [release-checklist.md §1](release-checklist.md#1-设计资产必须)：

- [ ] Logo 128×128 PNG（透明背景）
- [ ] 封面图 1280×800
- [ ] 功能截图 3–5 张

---

## 8. 给 reviewer 的备注（提交时可选）

```
This plugin uses a source-available license (PolyForm Noncommercial 1.0.0)
rather than a permissive OSI-approved one. The intent is to keep source open
for learning and non-commercial use while preventing commercial repackaging
without explicit licensing.

If Plugin Center policy requires permissive open source licensing, please
let me know — I am open to discussion.

Tech notes:
- Runs in serviceMode (background monitoring)
- All clipboard / filesystem access is local; no network calls
- Adaptive polling implementation specifically addresses macOS 14 Sonoma
  "Pasted from" banner concerns
- Multi-file clipboard support uses osascript (macOS) / PowerShell (Windows)
  via child_process, both with 2s timeouts; declared in privacy section

Thanks for reviewing!
```
