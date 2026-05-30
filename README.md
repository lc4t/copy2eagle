# Eagle Clipboard Watcher

> 一个 Eagle 插件：把剪贴板里的图片和 macOS 截图自动归档到你指定的 Eagle 文件夹。

设计目标：**开了就忘**。选好目标文件夹 → 打开开关 → 之后截图和复制的图片自动出现在 Eagle 里。

## 功能

- **剪贴板监听**：每秒检测一次系统剪贴板，新图片自动导入（带 hash 去重）。
- **macOS 截图监听**：自动识别系统截图保存目录，新截图出现时自动导入。
- **目标文件夹可选**：从 Eagle 文件夹列表里选一个，配置自动持久化。
- **后台运行**：基于 Eagle `serviceMode`，面板关闭后监听继续。
- **隐私本地**：插件不发起任何外部网络请求，所有处理本地完成。

## 平台

| 平台 | 剪贴板监听 | 截图监听 |
|---|---|---|
| macOS | ✅ | ✅ |
| Windows | ✅ | 🚧（v1.1 计划） |

## 安装

### 从 Eagle Plugin Center（待发布）

打开 Eagle → 插件中心 → 搜索 `Clipboard Watcher` → 安装。

### 开发模式 / 本地安装

1. 克隆本仓库
2. 打开 Eagle → 菜单 → 插件 → 开发插件 → 选择克隆下来的目录
3. 在面板里选择目标文件夹 → 打开监听开关

## 开发

完整开发规范见 [AGENTS.md](AGENTS.md)，需求文档见 [docs/prd.md](docs/prd.md)，架构说明见 [docs/architecture.md](docs/architecture.md)。

## License

**[PolyForm Noncommercial License 1.0.0](LICENSE)** © 2026 [lc4t](mailto:lc4t0.0@gmail.com)

源代码可见（source-available），允许个人、教育、研究、非营利组织使用与修改，**禁止任何商业用途**。引用、二次发布需保留 LICENSE 中的 `Required Notice` 行（作者署名与项目地址）。

如需商业授权，请通过邮件联系作者。
