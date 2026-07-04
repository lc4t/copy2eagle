# 设计 Brief — Eagle 剪贴板图片留存 v1.5.7

> 给你 / 设计师 / AI 生图工具用的清单。每项资产给多套 prompt 备选，选最顺手的工具跑。

---

## 1. Plugin Logo（至少 256×256 PNG，必做）

### 视觉概念

一个"剪贴板 → 文件夹"的隐喻图标，传达"从剪贴板自动归档"。
- 主体：一个剪贴板（clipboard）轮廓，上方有一张小图片正在"被吸进去"
- 辅助：可加一个隐约的 Eagle 鹰元素，但**别超过 logo 面积的 20%**（避免抄袭 Eagle 主 logo）
- 风格：扁平 / 现代 / 圆角友好（像 macOS Sonoma 的 app icon 风格）

### 色彩规范

- 主色：`#1677ff`（蓝色，与插件 UI 一致）
- 辅助：白色 / 浅灰 `#f0f2f5`
- 不用：渐变彩虹 / 霓虹 / 复杂阴影

### 必须满足

- 至少 256×256 PNG 透明背景；建议保留 512×512 主文件
- **缩到 32×32 仍清晰可辨**（不要细线条 / 复杂文字）
- 没有边框 / 没有底色方块（Eagle 自动加圆角容器）

### Prompt 备选

#### Midjourney v6+

```
A minimalist flat app icon, a clipboard with a small photo emerging from the top, soft rounded corners, primary color #1677ff blue, white background, modern macOS Sonoma style icon, clean vector, no text, 1:1 aspect ratio --style raw --v 6
```

#### Ideogram / DALL-E 3

```
Design a minimalist app icon for a clipboard-to-folder utility:
- A simple clipboard shape with a small image being absorbed into it from above
- Flat design, rounded corners, soft shadows
- Primary color: blue #1677ff, accent: white
- macOS Sonoma app icon style, 1024x1024, transparent background
- Must remain readable at 32x32 pixels
- No text, no logos of other brands
```

#### Recraft / Stable Diffusion

```
flat vector icon, clipboard with image flowing into it, blue #1677ff color palette, macOS app icon style, soft shadows, rounded corners, minimalist, white background, transparent, no text, centered composition, 4k
```

#### 通用文字描述（找设计师用）

> 一个扁平化的 app 图标。主体是一个轻微倾斜的剪贴板，上方有一张小图片（圆角矩形 + 山形线 + 小圆代表太阳）正在被剪贴板"吸进去"，可以用箭头或运动模糊表达方向。
> 配色：剪贴板和图片用 #1677ff 蓝色，背景透明。
> 风格：macOS Sonoma app icon 那种现代扁平 + 软阴影，**不要复杂渐变**。
> 缩小到 32×32 仍要看得清主体。

### 输出

- 命名：`logo.png`（建议 512×512，至少 256×256）
- 同时保留可编辑源文件，方便后续按官方模板调整留白
- 当前正式输出已放到仓库根 `logo.png`；后续调整时覆盖该文件

---

## 2. Plugin Center 首图 / 封面图（1800×1200，必做）

### 视觉概念

横版主视觉，传达"复制图片 → 自动出现在 Eagle"。
- 左侧 60%：插件面板真实截图（不是设计稿，要真跑出来的）
- 右侧 40%：一句标语 + 几个关键词
- 背景：淡蓝灰渐变（`#f0f2f5` → `#e6f0ff`）

### 文案

**主标语**（中文版）：
```
复制图片，自动出现在 Eagle
```

**主标语**（英文版）：
```
Copy an image. It's already in Eagle.
```

**副标语**（小字）：
```
截图 · 浏览器复制 · 多文件批量 · 全自动入库
```

### Prompt 备选

#### Midjourney v6+ — 用于做背景层

```
Soft pastel blue gradient background, abstract floating image cards drifting toward a folder, minimalist, ample empty space on the right for text overlay, macOS Sonoma aesthetic, 16:10 aspect ratio --v 6
```

> 之后用 Figma / Sketch / PS 把真实面板截图叠在左边，右边加文案。

#### 直接拼图工具（更推荐）

用 [Picsmart](https://picsmart.app/) / [SVGator](https://www.svgator.com/) / 或 Figma 模板：
1. 1800×1200 画布，3:2 比例，背景渐变 `#f0f2f5 → #e6f0ff`（斜向 135°）。后台要求首图必须大于 1560×1040 px，并且审核反馈指出错误比例会被退回。
2. 左侧粘真实面板截图（带 macOS 窗口圆角阴影）
3. 右侧打字 + Inter / SF Pro 字体
4. 不需要 AI 生图，纯排版即可

---

## 3. Plugin Center / README 产品截图（5 张，不能 AI 生）

**这些必须是真实 Eagle 里跑出来的截图**，AI 生图替代不了。

### 隐私准备

- 新建专用演示文件夹 `演示素材`，只放可公开示例图片
- 插件标签临时改为 `clipboard-demo`，避免自动 hostname 暴露设备名
- 不展示真实同步路径、用户名、主机名、annotation 或私人历史缩略图
- 截图前逐项检查插件面板、Eagle 资源网格、桌面和其他窗口
- 含个人信息的原图不得通过裁切或打码继续作为商店素材，应重新截图

按以下顺序拍：

### 截图 1 — 主面板正常运行（封面图也会用）

**准备**：
- Eagle 开着，至少 1 个文件夹
- 插件加载，选好"我的截图"文件夹
- 打开"自动保存复制的图片"开关
- 复制一张测试图，让"今日已保存"显示 ≥1，"最近保存"显示 1 条
- macOS Light Mode

**拍摄**：插件面板截屏（含 macOS 窗口装饰）

**命名**：`docs/assets/screenshot-1-main-panel.png`

---

### 截图 2 — 截图按钮触发

**准备**：
- 主面板上点完「立即截图」之后
- 已经有 Screenshot 命名的 item 入库
- "最近保存"显示 `Screenshot 1920x1080 ...`

**拍摄**：面板 + 旁边可选叠一个剪头指到截图按钮

**命名**：`docs/assets/screenshot-2-screenshot-button.png`

---

### 截图 3 — 多文件批量入库后

**准备**：
- 高级设置里勾选"同时选中多张图片复制时也一并保存"
- 在 Finder 选 4-5 张图 Cmd+C
- 等待入库
- 面板"最近保存"里能看到这批文件名

**拍摄**：面板 + 旁边显示 Eagle 文件夹缩略图列表（可截两张拼图）

**命名**：`docs/assets/screenshot-3-multi-file.png`

---

### 截图 4 — 高级设置展开

**准备**：
- 面板里点"高级设置"展开
- 所有选项都可见

**拍摄**：完整面板（高度可能要 540+）

**命名**：`docs/assets/screenshot-4-advanced-settings.png`

---

### 截图 5 — 暗色模式

**准备**：
- macOS 切到 Dark Mode
- Eagle 主题跟随 → 插件面板自动 dark
- 与截图 1 同样的场景

**拍摄**：面板截屏

**命名**：`docs/assets/screenshot-5-dark-mode.png`

---

## 4. 输出与归档

```
copy2eagle/
├── logo.png                       # ← M7.1 第 1 项替换
├── logo@4x.png                    # 512×512 可选
└── docs/
    └── assets/                    # 新建
        ├── cover-1800x1200.png    # ← M7.1 第 2 项，Plugin Center 首图
        ├── screenshot-1-main-panel.png
        ├── screenshot-2-screenshot-button.png
        ├── screenshot-3-multi-file.png
        ├── screenshot-4-advanced-settings.png
        └── screenshot-5-dark-mode.png
```

`docs/assets/` 不在 `.gitignore` 里，可入库；体积控制在每张 < 500KB（用 [tinypng.com](https://tinypng.com/) 或 `pngquant` 压一下）。

---

## 5. 风格参考（不抄）

- macOS Sonoma 系统 app icons：圆角统一、阴影柔和、配色克制
- Raycast、Linear、Arc 的产品截图：留白多、字体克制、不堆砌特效
- **避免**：用 Eagle 主 logo / 鹰头大特写、霓虹光 / 玻璃质感 / AI 风格痕迹明显的图

---

## 6. 提交前 checklist

- [x] `logo.png` 已替换（512×512 PNG、透明背景，32×32 可读）
- [ ] `assets/plugin-center/cover-1800x1200.png`
- [ ] 5 张 `docs/assets/screenshot-*.png`，每张 < 500KB
- [ ] README 截图引用更新（M7.3 会处理）
- [ ] Plugin Center 提交时上传以上资产
