# Windows Debug Workflow

> Windows support is paused for the Plugin Center release. Use this workflow for test/fix builds only.

## Goal

Debug Eagle Clipboard Watcher on a real Windows machine without consuming official patch versions for each attempt.

Official macOS releases use semantic versions such as `v1.5.8`.
Windows experiments use prerelease/tag names such as:

- `win-debug-clipboard-event-a`
- `win-fix-20260705-a`
- `win-test-readimage-heartbeat-a`

Only bump `manifest.version` after a Windows fix is confirmed and ready for a real release.

## One-Time Setup On Windows

1. Install Eagle for Windows and sign in to the same Eagle account/library you want to test.
2. Install Git for Windows.
3. Install Node.js LTS.
4. Install Codex from the official Codex page:
   - https://chatgpt.com/codex/
5. Clone the repo:

```powershell
git clone https://github.com/lc4t/copy2eagle.git
cd copy2eagle
npm install
npm test
```

## Load The Plugin From Source

1. Open Eagle.
2. Open `Plugin` / `Development Plugin`.
3. Select the cloned `copy2eagle` directory.
4. Press `P` in Eagle and open `剪贴板图片留存`.
5. Choose a target folder and enable auto-save.

## Reproduce The Current Windows Bug

1. Keep Eagle running. Do not restart it during the test.
2. Press `Win + Shift + S`.
3. Select a region.
4. Wait 1-5 seconds.
5. Record whether:
   - the panel shows any status change,
   - the target folder receives an item,
   - restarting Eagle imports the last screenshot,
   - browser copied images or copied image files behave differently.

## Ask Codex To Debug Locally

Suggested prompt:

```text
请按 AGENTS.md 执行本次任务。

Windows 真机复现：Eagle 插件「剪贴板图片留存」运行中，Win+Shift+S 截图不会自动导入；重启 Eagle 后会导入最后一次截图。

请不要 bump 正式 patch 版本。请在本地做 win-debug / win-fix 测试改动，优先增加诊断日志或可见状态，找出 Eagle Windows 运行时是否没有轮询、readImage 是否为空、或 addFromPath 是否失败。
```

## Useful Commands

```powershell
npm test
npm run build
npm run pack
git status --short
git diff -- js/lib/poll.js js/lib/clipboard.js js/plugin.js
```

## What To Send Back

Send these back to the main macOS release thread:

- exact test build/tag name,
- Eagle version on Windows,
- Windows version,
- whether `Win+Shift+S` imports while Eagle stays running,
- whether restart imports the last screenshot,
- whether browser right-click copied images import,
- any Eagle plugin log lines added by the debug build,
- the commit diff or branch name if Codex made code changes.

## Release Rule

Do not create official `v1.x.y` releases for Windows experiments.

Use:

```text
win-debug-<topic>-<letter>
win-fix-<date>-<letter>
```

Promote to an official version only after:

1. `Win+Shift+S` imports while Eagle remains running.
2. Browser copied images import.
3. Explorer copied image files either work or are explicitly disabled in UI/docs.
4. Restarting Eagle does not create confusing delayed imports.
5. macOS regression tests still pass.
