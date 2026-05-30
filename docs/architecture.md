# Architecture

> 模块边界、数据流、关键时序。代码落地后随时更新。

## 1. 模块划分（v1.1 修订：剪贴板单路径）

```
┌──────────────────────────────────────────────────────────────┐
│ Eagle Plugin Runtime (Electron + Node.js)                    │
│                                                              │
│  ┌─────────────────┐         ┌───────────────────────────┐  │
│  │   index.html    │ ◀────── │  eagle.app.theme          │  │
│  │   js/ui.js      │ ◀────── │  eagle.onThemeChanged     │  │
│  │   (Panel UI)    │                                         │
│  └────────┬────────┘                                         │
│           │ snapshot / saveConfig(patch)                     │
│           ▼                                                  │
│  ┌─────────────────┐         ┌───────────────────────────┐  │
│  │   js/plugin.js  │ ──────▶ │ eagle.item.addFromPath    │  │
│  │                 │         │ eagle.folder.getAll       │  │
│  │                 │ ──────▶ │ localStorage (config)     │  │
│  │                 │ ──────▶ │ eagle.notification        │  │
│  │  ┌───────────┐  │         │ eagle.log                 │  │
│  │  │ Clipboard │  │         └───────────────────────────┘  │
│  │  │  Poller   │  │                                         │
│  │  └─────┬─────┘  │         ┌───────────────────────────┐  │
│  │        │        │ ──────▶ │ electron.clipboard        │  │
│  │        │        │         │   .readImage()            │  │
│  │  ┌─────┴─────┐  │         └───────────────────────────┘  │
│  │  │ Screenshot│  │         ┌───────────────────────────┐  │
│  │  │  Trigger  │  │ ──────▶ │ child_process.execFile    │  │
│  │  │ (darwin)  │  │         │   screencapture -ic       │  │
│  │  └─────┬─────┘  │         │   （结果进剪贴板，由       │  │
│  │        │        │         │    Clipboard Poller 接力） │  │
│  │  ┌─────┴─────┐  │         └───────────────────────────┘  │
│  │  │ Import    │  │         ┌───────────────────────────┐  │
│  │  │ Pipeline  │  │ ──────▶ │ os.tmpdir() / fs.writeFile│  │
│  │  └───────────┘  │         └───────────────────────────┘  │
│  └─────────────────┘                                         │
└──────────────────────────────────────────────────────────────┘
```

## 2. 关键数据流

### 2.1 剪贴板触发的导入

```
setInterval(intervalMs)
  → clipboard.readImage()
  → 计算 hash
  → 去重判定（见 §2.4）
      ├─ skip 命中 → 短路退出
      └─ 允许导入
            → 写 os.tmpdir()/eagle-cw/{ts}.png
            → eagle.item.addFromPath(tmpPath, { name, folders:[folderId], tags, annotation })
            → 删除 tmpPath
            → 写入 hashSetByFolder[folderId]
            → lastImportAt 更新 / 今日计数 +1
            → eagle.notification.show（若用户开启）
            → UI 状态推送（最近导入卡片）
```

### 2.2 截图按钮触发的导入（v1.1 修订）

```
用户点击「立即截图」按钮（macOS 限定）
  → child_process.execFile('screencapture', ['-ic'])
  → 用户选择截图区域
  → 系统将结果写入剪贴板（不落盘）
  → §2.1 剪贴板轮询 1s 内捕获 → 走标准导入流程
（Windows：按钮置灰，提示用户用 Win+Shift+S，效果等价）
```

### 2.4 去重判定（F4 / ADR-009）

```
state:
  duplicateStrategy: 'skip' | 'allow'   # 用户配置，默认 skip
  hashSetByFolder: Map<folderId, Set<hash>>   # 进程内，非持久
  lastClipboardHash + lastClipboardAt   # 仅用于 allow 模式的 30s 防抖

启动 / 切换 folderId 时：
  → eagle.item.get({ folders: [folderId] }) 拉取该文件夹现有 item
  → 逐个读 item 文件路径 → 计算 hash → 加入 hashSetByFolder[folderId]
  → item 数 > 1000 时 UI 显示「索引中…」

import 前判定：
  if (strategy === 'skip'):
      if hashSetByFolder[folderId].has(hash) → 短路退出
  if (strategy === 'allow'):
      if lastClipboardHash === hash AND now - lastClipboardAt < 30_000 → 短路退出（防抖）
      （allow 模式不查 hashSet，允许同图多次入库）

import 成功后：
  hashSetByFolder[folderId].add(hash)
  lastClipboardHash / lastClipboardAt 更新
```

### 2.3 配置读写（v1.1 修订）

```
启动：localStorage.getItem('clipboardWatcher') → JSON.parse → normalizeConfig
变更：UI 触发 → saveConfig(patch) → normalizeConfig → localStorage.setItem
（PRD 原写的 eagle.extraData 在 Eagle 公开 API 中不存在；改用 webview 原生 localStorage，详见 ADR-010）
```

## 3. 模块职责

| 文件 | 职责 | 不做 |
|---|---|---|
| `index.html` | 静态结构、CSS 变量、加载 ui.js | 任何业务逻辑 |
| `js/ui.js` | 渲染、用户交互、与 plugin.js 通信 | 直接调 Eagle 业务 API（除 folder.getAll 等只读 API） |
| `js/plugin.js` | 监听、hash、导入、配置持久化、错误处理 | DOM 操作 |

## 4. 关键状态机

### 4.1 监听开关

```
[DISABLED] ──user toggle on──▶ [ENABLED]
[ENABLED]  ──user toggle off──▶ [DISABLED]
[ENABLED]  ──fatal error──▶ [ERROR]
[ERROR]    ──5s retry success──▶ [ENABLED]
[ERROR]    ──user toggle off──▶ [DISABLED]
```

### 4.2 单次导入

```
detect → dedupe → write-tmp → addFromPath → cleanup
        │                   │              │
        └ skip(dup/window)  └ rollback     └ on success: notify+count
```

## 5. 错误边界

| 来源 | 处理 |
|---|---|
| Eagle API 不可用 | 捕获 → ERROR 状态 → 5s 重试 |
| 临时文件写入失败 | 跳过本次 → 错误计入 UI |
| `addFromPath` 抛错 | 删除已写 tmp → 错误计入 UI，不崩溃 |
| `screencapture` 调用失败 | UI 错误状态 + 提示，不阻塞其他功能 |
| 配置反序列化失败 | 重置为默认 → 警告日志 + UI 提示 |
| 启动期回填读取 item 文件失败（部分 item）| 跳过失败 item，记录到日志，不阻塞其他 item 入索引 |

## 6. 隐私边界

- 所有逻辑本地完成，**禁止任何网络请求**
- `eagle.extraData` 中只存配置，不存图片内容/hash 历史明文
- `tmpdir/eagle-cw/` 在每次导入完成后立即删除（成功或失败都清）

## 7. 演进点

- v1.1：多文件夹路由（按来源区分截图/复制）→ 新增 `routingRules` 配置
- v1.2：OCR 关键词触发标签 → 依赖 Eagle AI SDK，需评估隐私边界变化
