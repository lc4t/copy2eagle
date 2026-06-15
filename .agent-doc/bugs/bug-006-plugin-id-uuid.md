# Bug 006 — Plugin Center Requires UUID Plugin ID

## Intent

修复 Plugin Center 拒绝 v1.5.3 包的问题，使 manifest ID 满足提交后台的 UUID 格式校验。

## Constraints

- 不覆盖或重写已发布的 v1.5.3 tag 和 Release。
- 新 ID 一旦提交商店必须保持稳定。
- 必须明确披露更换 ID 对旧安装和 localStorage 的影响。

## Decision

1. 版本升为 v1.5.4。
2. Plugin ID 固定为 UUID v4 `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`。
3. 自动测试校验固定值与 UUID v4 格式。
4. 升级说明要求卸载旧 ID 插件、重新安装并选择目标文件夹。

## Evidence

- [x] Plugin Center 后台报错：插件 ID 格式不正确，要求有效 UUID
- [x] manifest / package / UI / runtime 版本同步为 1.5.4
- [x] UUID v4 自动检查
- [x] `npm test`：13 checks passed
- [x] `npm run pack`：6 个审核文件，163,812 bytes
- [x] 包内 manifest：ID `06343a32-d63f-4a04-bdcc-a0ca1e6f12aa`，version `1.5.4`，`devTools: false`
- [x] SHA-256：`c28af42b3fb0777b9fe4f9dbf7e96792532bda6eea08a027866c2aeef6092904`
- [x] GitHub v1.5.4 Release 与附件已发布
- [ ] 重新上传 Plugin Center

## Impact

- 商店提交阻塞解除。
- 旧 GitHub 安装不能依赖原地升级或配置自动继承。
- 若旧新插件同时存在，因 Plugin ID 不同，lease 不保证互斥，必须卸载旧实例。

## Learnings

- Eagle 公开 manifest 文档只说明 `id` 是 Plugin ID；最终格式规则必须以提交后台校验为准。
- 首次公开发布前应使用 UUID，不能把可读占位 ID 当作正式商店身份。
