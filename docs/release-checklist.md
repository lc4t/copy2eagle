# v1.5.8 Plugin Center 复审清单

> 本清单列出代码完成后仍需 GUI、设计资产或账户权限的步骤。

## 0. 前置确认

- [x] 仓库当前为 **public**
- [ ] 最终发布渠道：
  - [x] Eagle Plugin Center（首要）
  - [x] GitHub Release
  - [ ] 直接分发 `.eagleplugin` 文件给特定用户（备用）

## 1. 设计资产（必须）

| 资产 | 规格 | 当前 | 来源建议 |
|---|---|---|---|
| Plugin Logo | 至少 256×256 PNG，透明背景，按官方模板留白 | ✅ `logo.png` 为 512×512 RGBA，32×32 可读 | F1：蓝色剪贴板图片流入归档盒 |
| Plugin Center 首图 / 封面图 | 必须大于 1560×1040 px，按 3:2 比例 | ✅ `assets/plugin-center/cover-1800x1200.png` | 蓝色归档背景 + 真实插件面板 |
| 功能截图（README + Plugin Center） | 1280×800 以上，建议 3–5 张 | ✅ 3 张 1280×800 脱敏成品 | 主面板 / Eagle 导入结果 / 高级设置 |

**建议风格**：
- 主色调用 `#1677ff`（当前 UI 蓝），避免视觉杂乱
- 封面图突出一句话价值主张："复制图片自动出现在 Eagle"
- 截图保持系统默认装饰（窗口圆角阴影），不要裁切干净

**发布截图隐私门禁**：
- 使用新建的演示文件夹，例如 `演示素材`，不得出现个人同步目录或真实项目名
- 标签改为通用值，例如 `clipboard-demo`，不得出现主机名、用户名或设备名
- Eagle 中仅展示可公开的示例图片，不得出现私人截图、文档或历史缩略图
- 截图前检查文件名、路径、annotation、时间、桌面背景和其他窗口
- 原始截图若含个人信息，只允许当场验收；不得留存、裁切、打码后复用或上传

## 2. Plugin ID

- [x] Plugin Center 后台明确要求 UUID 格式
- [x] 新 ID：`06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`（UUID v4）
- [x] 自动测试锁定 UUID v4 格式与固定 ID
- [ ] 安装商店候选前卸载旧 ID 插件，避免两个 serviceMode 实例并存

## 3. License

- [x] 使用 MIT License
- [x] `package.json` metadata 已同步为 `MIT`
- [x] 审核包根目录包含 `LICENSE`

## 4. CHANGELOG / Release Notes

- [x] `docs/CHANGELOG.md` 已记录 v1.0.0–v1.5.8
- [x] Release notes 摘要：

> v1.5.8 是 macOS-only Plugin Center 发布候选：暂时移除 Windows 正式支持声明，manifest 显式设置 `platform: "mac"`，以保证 macOS 已验证功能先通过审核。Windows 问题后续用独立 test/fix 构建继续排查。

## 5. GitHub Release

- [x] `v1.5.8` tag 已推送
- [x] [GitHub Release v1.5.8](https://github.com/lc4t/copy2eagle/releases/tag/v1.5.8) 已发布
- [x] `eagle-clipboard-watcher.eagleplugin` 已上传（164,053 bytes）
- [x] SHA-256：`8d697ce83227e18f7dfda76b42f0e042ab2bd19f0fb8e5cdc07988b2bdf3d21b`

## 6. Plugin Center 提交

按 Eagle 官方[发布流程](https://developer.eagle.cool/plugin-api/distribution/publish)走：

1. 确认 `manifest.json.id` 为 `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`
2. 确认 `manifest.json.platform` 为 `mac`，并在 reviewer notes 中说明 Windows 已暂缓支持
3. `npm run pack` 完成自动检查并产候选包
4. 在真实 Eagle 中右键插件执行官方「Pack Plugin」，用官方导出的包做最终上传
5. 在 [Plugin Center 提交页](https://community-en.eagle.cool/my/plugin/publish)填表：
   - 名称 / 描述 / 关键词 / 分类 → 用 `docs/plugin-center-submission.md` 已写好的文案
   - Logo / 封面 / 截图 → 见 §1
   - License → MIT
6. 上传 `.eagleplugin`
7. 等待审核

## 7. 提交后立即做

- [x] Plugin Center 的 UUID 格式报错已处理
- [x] `docs/CHANGELOG.md` 同步 v1.5.8 release 链接
- [ ] `.agent-doc/progress.md` 标 M7 Done

## 8. 用户验证清单（你最后做）

按 `.agent-doc/progress.md` 内 M3 / M4 / M5 各 Session 的「本地验证清单」依次过：

- [x] Eagle 4.0.0 安装、服务启动、130 项回填、剪贴板 PNG 导入、短窗口去重、测试项清理
- [x] 按 `P` 可找到中文插件名，面板正常打开且基础使用正常
- [x] 截图按钮触发后被监听并成功导入 Eagle
- [x] 面板 `maxHeight: 960` 纵向拉伸真机复验
- [ ] 非阻塞：路由切换、allow 超过 30 秒、双实例和错误恢复
- M3 A–H：基础回归、剪贴板监听、skip/allow 去重、截图按钮、切文件夹/改间隔、错误恢复、横幅观察
- M4 A–G：删后再复制、命名增强、混排开关、多文件复制、回归、节流、错误回归
- M5 A–D：adaptive polling、重试倒计时、最近导入列表、回归

发现任何 bug → 记录到 `.agent-doc/bugs/`，修复后重新执行本清单。
