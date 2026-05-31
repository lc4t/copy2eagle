# v1.0.0 发布前清单

> 本清单列出**只能你本人完成**的步骤（GUI 操作 / 设计资产 / 账户权限）。
> 文档级 / 代码级的工作已在 M1–M6 完成；本清单服务 M7。

## 0. 前置确认

- [ ] 仓库当前保持 **private**（你的决定，不切 public）
- [ ] 最终发布渠道：
  - [x] Eagle Plugin Center（首要）
  - [ ] GitHub Release（可选，因仓库 private 可能仅自用）
  - [ ] 直接分发 `.eagleplugin` 文件给特定用户（备用）

## 1. 设计资产（必须）

| 资产 | 规格 | 当前 | 来源建议 |
|---|---|---|---|
| Plugin Logo | 128×128 PNG，透明背景，圆角内嵌 | ⚠️ 占位 `logo.png` 是程序生成的纯色方块 | 自己画 / 找设计师 / 用 AI 生图（Recraft / Ideogram 等） |
| Plugin Center 封面图 | 1280×800 PNG/JPG | ❌ 没做 | 截一张面板 + 加文案 |
| 功能截图（README + Plugin Center） | 1280×800 以上，建议 3–5 张 | ❌ 没做 | Eagle 实跑场景：① 主面板已运行 ② 截图入库后 ③ 多文件批量入库 ④ 暗色模式 ⑤ 高级设置展开 |

**建议风格**：
- 主色调用 `#1677ff`（当前 UI 蓝），避免视觉杂乱
- 封面图突出一句话价值主张："复制图片自动出现在 Eagle"
- 截图保持系统默认装饰（窗口圆角阴影），不要裁切干净

## 2. Eagle 开发者工具：生成正式 Plugin ID

当前 `manifest.json.id = "CLIPBOARD_WATCHER_001"` 是占位符，**Plugin Center 提交前必须换成 Eagle 官方分发的 ID**。

步骤：
1. 打开 Eagle → 菜单 → 插件 → **开发者工具**（或在偏好设置里启用开发者模式）
2. 走 Eagle 官方文档的「申请插件 ID」流程：<https://developer.eagle.cool/plugin-api/start-development>
3. 拿到形如 `KXXXXXXXX` 的 ID
4. 修改 `manifest.json`：
   ```json
   "id": "<新生成的 ID>",
   ```
5. 重新 `npm run pack` 出新的 `.eagleplugin`

## 3. License 接受度风险点（⚠️ 提前确认）

**已知风险**：本项目用 PolyForm Noncommercial 1.0.0 — Eagle Plugin Center 历史上接受的多为 MIT/Apache 等宽松 license（OSI 定义的 open source）。PolyForm 是 source-available（非商用），属于"灰区"。

**建议动作**：
1. 提交前直接邮件 Eagle 官方 (`support@eagle.cool` 或 plugin 提交时的联系入口) 询问：
   > Hi, my Eagle plugin uses PolyForm Noncommercial License 1.0.0 (source-available, non-commercial). Does Plugin Center accept this kind of license?
2. 若拒：回到 [ADR-006](decisions.md#adr-006license-选-polyform-noncommercial-10非商用--署名) 重新决策，备选：
   - 改 MIT 但配 README 显著的 "Commercial use discouraged" 声明（弱约束）
   - 改 BUSL（Business Source License）— 到期自动转 open source
   - 维持 PolyForm 但放弃 Plugin Center，走 GitHub Release / 直发渠道

## 4. CHANGELOG / Release Notes

- [x] `docs/CHANGELOG.md` 已切到 `[1.0.0] — 2026-05-31`（M7.1 完成）
- [ ] 你来定 release notes 摘要（拷给 Plugin Center 用），建议 ≤ 300 字

## 5. GitHub Release（可选）

仓库 private，若要发 Release：
1. `git tag v1.0.0 -m "v1.0.0 — first stable release"`
2. `git push origin v1.0.0`
3. GitHub UI → Releases → Draft a new release → 选 tag `v1.0.0`
4. 上传 `eagle-clipboard-watcher.eagleplugin` 作为附件
5. Release notes 粘 CHANGELOG 的 `[1.0.0]` 段

> 仓库 private = Release 也对外不可见。若希望特定人能下载，可以邀请进 collaborator。

## 6. Plugin Center 提交

按 Eagle 官方流程 <https://developer.eagle.cool/plugin-api/start-development> 走：

1. 用 §2 步骤拿到的 Plugin ID 已替换进 `manifest.json`
2. `npm run pack` 出最终 `.eagleplugin`
3. 在 Plugin Center 后台填表：
   - 名称 / 描述 / 关键词 / 分类 → 用 `docs/plugin-center-submission.md` 已写好的文案
   - Logo / 封面 / 截图 → 见 §1
   - License → 选 Other / Custom，备注 PolyForm-NC-1.0.0
4. 上传 `.eagleplugin`
5. 等待审核（通常 1–7 天）

## 7. 提交后立即做

- [ ] 把 Plugin Center 给的最终 plugin id 也回写到 `manifest.json`（如果跟开发者工具生成的不一样）
- [ ] `docs/CHANGELOG.md` 同步 release 链接（如有）
- [ ] `.agent-doc/progress.md` 标 M7 Done

## 8. 用户验证清单（你最后做）

按 `.agent-doc/progress.md` 内 M3 / M4 / M5 各 Session 的「本地验证清单」依次过：

- M3 A–H：基础回归、剪贴板监听、skip/allow 去重、截图按钮、切文件夹/改间隔、错误恢复、横幅观察
- M4 A–G：删后再复制、命名增强、混排开关、多文件复制、回归、节流、错误回归
- M5 A–D：adaptive polling、重试倒计时、最近导入列表、回归

发现任何 bug → 反馈，我修 → 起 M7.1 / v1.0.1。
