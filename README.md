# Eagle 剪贴板图片留存

> 一个 Eagle 插件：复制图片和截图自动出现在你指定的 Eagle 文件夹。

**开了就忘**。选好目标文件夹 → 打开「自动保存复制的图片」 → 之后截图和复制的图片自动出现在 Eagle 里。

## 它做什么

- **复制图片自动入库**：按设置频率检查系统剪贴板，新图片直接进 Eagle，无需手动拖入
- **一键截图**：面板里点「立即截图」（macOS），框选区域自动入库
- **图文混排**：从网页 / Word / 微信复制带文字的内容，里面的图自动保存（可关）
- **多文件批量**（可选）：Finder / 资源管理器选中多张图片复制，一次全进 Eagle
- **去重**：默认跳过文件夹里已有的同图；可改为允许重复
- **按来源分流**：截图、普通复制和多文件可分别进入不同 Eagle 文件夹
- **自定义命名**：支持来源、尺寸、时间、主机名和计数等命名占位符
- **离线本地**：不发起任何网络请求，所有处理在你本机完成

## 平台

| 平台 | 复制图片 | 截图按钮 | 多文件复制 |
|---|---|---|---|
| macOS | ✅ | ✅ `screencapture -ic` | ✅ AppleScript |
| Windows | ✅ | 使用 `Win+Shift+S`，截图进剪贴板后自动保存 | ✅ PowerShell FileDropList |

> macOS 和 Windows 均可安装。当前没有 Windows 真机验收设备；Windows 问题会按用户反馈持续修复。

## 安装

### 推荐：下载 `.eagleplugin` 双击安装

1. 打开 [最新 Release](https://github.com/lc4t/copy2eagle/releases/latest)
2. 下载附件里的 `eagle-clipboard-watcher.eagleplugin`
3. **双击下载的文件**，Eagle 会弹出安装确认 → 同意即可

### Eagle Plugin Center（准备提交）

```
状态：v1.5.6 正在做 Windows 剪贴板截图修复测试，暂缓 Plugin Center 复审提交
```

通过后可直接 `Eagle → 插件中心 → 搜 "剪贴板图片留存" → 安装`。

### 兜底：开发者模式 / 自己构建

```bash
git clone https://github.com/lc4t/copy2eagle.git
cd copy2eagle
npm run pack         # 产 eagle-clipboard-watcher.eagleplugin，再双击安装
```

或者直接挂源码热加载：
```
Eagle → 菜单 → 插件 → 开发插件 → 选这个 clone 下来的目录
```

> 这种方式每次改代码 reload 即可生效，适合给我提反馈或自己 fork 改造。

## 使用

1. 在 Eagle 里点开「剪贴板图片留存」面板
2. **选「保存到 Eagle 的哪个文件夹」**（必填）
3. **打开「自动保存复制的图片」开关**
4. 之后任何时候：
   - 复制图片（截图 / 浏览器右键 / 别的 App 里 Cmd/Ctrl+C 图） → 通常 1–5 秒内自动进 Eagle
   - macOS 点「立即截图」按钮 → 选区截图，自动进 Eagle
   - Windows 按 `Win+Shift+S` → 截图进入剪贴板后自动进 Eagle
5. 把面板关掉也没关系，监听在后台继续

## 高级设置（默认即可用）

| 设置 | 默认 | 含义 |
|---|---|---|
| 检查频率 | 1 秒 | 数字越小响应越快；macOS 14+ 会增加"已粘贴自 Eagle"通知 |
| 自动加上的标签 | `clipboard-watcher,<你的主机名>` | 多机协作时方便区分图片来自哪台机器 |
| 遇到已有的相同图片 | 跳过不再保存 | 也可改为「再保存一份」 |
| 刷新已保存记录 | — | 在 Eagle 里手动删图后点一下，下次复制同图就能重新保存 |
| 保存成功时发送系统通知 | ✅ | 关掉就完全静默 |
| 复制带文字的内容时也保存图片 | ✅ | 关掉后只保存纯图片复制 |
| 同时选中多张图片复制时也一并保存 | ❌ | 打开后 Finder / 资源管理器选多张图 Cmd/Ctrl+C 一次性入库 |
| 自定义保存名称 | `{source} {dims} {timestamp}` | 支持 `{source}`、`{dims}`、`{date}`、`{time}`、`{hostname}`、`{count}`、`{lifetime}` |
| 按来源选择文件夹 | 跟随主文件夹 | 截图、普通复制、多文件可分别指定目标文件夹 |

## 关于 macOS 14+ 的「已粘贴自 Eagle」通知

macOS 14 Sonoma 起，读剪贴板内容会出系统横幅。本插件采用以下策略压制：

- 剪贴板里**没图**时，仅做轻量格式探测，**不出现通知**
- 剪贴板里**有图**时需要读取才能判断是否变化，所以会有通知
- 同一张图持续不变 ≥ 3 秒后，自动放慢到 5 秒一次（adaptive polling）
- 想完全控制：把「检查频率」调到更大的数（如 3-5 秒）

这是 macOS 系统行为，不代表插件偷窥剪贴板。所有数据均在本机处理。

## 隐私

- ❌ 不发起任何外部网络请求
- ❌ 不上传 / 不统计 / 不遥测
- ✅ 配置存在 `localStorage`（每个插件独立 sandbox）
- ✅ 临时图片只在 `os.tmpdir()/eagle-cw/` 短暂存在，导入完成即删除

## 反馈

发现 bug 或想要新功能：[GitHub Issues](https://github.com/lc4t/copy2eagle/issues)

也可以直接邮件 lc4t0.0@gmail.com

## 升级与重复安装

v1.5.4 起为满足 Plugin Center 的 UUID 格式要求，更换了 Plugin ID。若安装过 v1.5.3 或更早的 GitHub 版本，请先在 Eagle 插件管理中卸载旧实例，再安装 v1.5.6，并重新选择一次目标文件夹。不同 Plugin ID 的安装可能无法共享 `localStorage` 配置或双实例 lease。

## 开发

完整开发规范见 [AGENTS.md](AGENTS.md)，需求 [docs/prd.md](docs/prd.md)，架构 [docs/architecture.md](docs/architecture.md)，决策记录 [docs/decisions.md](docs/decisions.md)。

## License

**[MIT License](LICENSE)** © 2026 [lc4t](mailto:lc4t0.0@gmail.com)
