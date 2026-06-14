# Architecture

> 模块边界、数据流、关键时序。代码落地后随时更新。

## 1. 模块划分（v1.5.3：13 个 lib 模块）

```
js/
├── plugin.js          # 入口编排（~150 行）：lifecycle hooks + window.ClipboardWatcher 暴露
├── ui.js              # DOM 渲染 + 事件分发；不持状态
└── lib/
    ├── constants.js   # 全局常量 / 错误码 ERROR_CODES / format 候选 / 文件 ext 白名单
    ├── utils.js       # 纯函数：pad / nowStamp / tmpFileStamp / sleep / computeHash / getHostname / parseTags
    ├── state.js       # state 对象 + 受控 mutator（setRuntimeStatus / pushRecentImport / scheduleRender ...）
    ├── config.js      # schema / buildDefaults / normalizeConfig / loadConfig / saveConfig（localStorage）
    ├── i18n.js        # messages.zh 表 + t(path, fallback, ...args) + detectLocale / setLocale
    ├── theme.js       # DARK_THEMES Set + isDarkTheme + refreshTheme + bindThemeListener
    ├── folders.js     # eagle.folder.getAll → flattenFolders / backfillFolder / resetFolderIndex
    ├── clipboard.js   # eagle.clipboard.has 多 format 探测 / readClipboardFilePaths（macOS osascript）
    ├── import.js      # importImage / importFileBatch / buildItemName / buildAnnotation / openItem
    ├── screenshot.js  # macOS screencapture -ic → 设 state.lastScreenshotAt → 由轮询接力
    ├── notification.js# maybeNotify / maybeNotifyError + 1.5s 节流
    ├── instance.js    # v2 单 owner lease + v1.5.2 legacy heartbeat guard
    └── poll.js        # 轮询状态机：setTimeout 链 + adaptive(idle/normal) + 5s 重试 + retry ticker
```

源码保持 CommonJS 模块化；`build/bundle.js` 在打包前生成可读的单文件 `js/bundle.js`，运行时 `index.html` 只加载 bundle，以避开 Eagle webview 的相对 `require()` 限制。

### 模块依赖（无循环）

```
ui ──→ i18n
       │
       ▼
plugin ──→ state ←── config / theme / folders / clipboard / import / screenshot / notification / instance / poll
                                    │           │             │            │           │
                                    └───────────┴─────────────┴────────────┴───────────┘
                                                       │
                                                       ▼
                                                  utils / constants / i18n
```

所有模块通过 `state.js` 共享状态，避免环依赖。

### 运行时数据流

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
│  │   plugin.js     │ ──────▶ │ eagle.item.addFromPath    │  │
│  │  + lib/*.js     │         │ eagle.folder.getAll       │  │
│  │                 │ ──────▶ │ localStorage (config)     │  │
│  │                 │ ──────▶ │ eagle.notification        │  │
│  │  ┌───────────┐  │         │ eagle.log                 │  │
│  │  │  poll.js  │  │         └───────────────────────────┘  │
│  │  └─────┬─────┘  │                                         │
│  │        │        │         ┌───────────────────────────┐  │
│  │        │        │ ──────▶ │ eagle.clipboard.has /     │  │
│  │        │        │         │   .readImage()            │  │
│  │ ┌──────┴──────┐ │         └───────────────────────────┘  │
│  │ │ screenshot  │ │         ┌───────────────────────────┐  │
│  │ │  .js (mac)  │ │ ──────▶ │ child_process.execFile    │  │
│  │ └──────┬──────┘ │         │   screencapture -ic       │  │
│  │        │        │         │   osascript               │  │
│  │ ┌──────┴──────┐ │         │                           │  │
│  │ │  import.js  │ │         └───────────────────────────┘  │
│  │ └─────────────┘ │         ┌───────────────────────────┐  │
│  │                 │ ──────▶ │ os.tmpdir() / fs.writeFile│  │
│  └─────────────────┘         └───────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## 2. 关键数据流

### 2.1 剪贴板触发的导入

```
setTimeout 链（intervalMs）
  → instance.acquireLease()
  → clipboard.has(format)
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
  → §2.1 按当前轮询间隔捕获 → 走标准导入流程
```

### 2.4 去重判定（F4 / ADR-009）

```
state:
  duplicateStrategy: 'skip' | 'allow'   # 用户配置，默认 skip
  hashSetByFolder: Map<folderId, Set<hash>>   # 进程内，非持久
  lastClipboardHash + lastClipboardAt   # 仅用于 allow 模式的 30s 防抖

启动 / 启用 / 切换 folderId / 修改来源路由时：
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
| `index.html` | 静态结构、CSS 变量、加载 `js/bundle.js` | 任何业务逻辑 |
| `js/ui.js` | 渲染、用户交互、与 plugin.js 通信 | 直接调 Eagle 业务 API |
| `js/plugin.js` | 生命周期、模块编排、向 UI 暴露动作与快照 | DOM 操作、具体导入实现 |

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
| 双实例 | v2 lease 只允许一个 owner 导入；非 owner 提示用户清理旧安装 |

## 6. 隐私边界

- 所有逻辑本地完成，**禁止任何网络请求**
- `localStorage` 只存配置、累计计数与实例 lease，不存图片内容/hash 历史明文
- `tmpdir/eagle-cw/` 在每次导入完成后立即删除（成功或失败都清）

## 7. 演进点

- Plugin Center：正式 ID、商店名称、License 和视觉资产
- Windows 支持：`platform: all`；Electron 负责普通图片剪贴板，PowerShell FileDropList 负责多文件，截图使用 `Win+Shift+S`
- Windows 残余风险：当前无真机覆盖，需通过首批用户反馈补齐生命周期和 Eagle API 兼容验证
- OCR 关键词触发标签：依赖 Eagle AI SDK，需重新评估隐私边界
