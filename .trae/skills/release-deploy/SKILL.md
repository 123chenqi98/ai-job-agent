---
name: release-deploy
description: 将本地改动提交推送并部署到生产服务器，再核对线上产物。当用户说发布、部署上线、提交并部署、一键发布、上线时使用。不用于只改本地、不发布的场景。
---

# 发布上线（ai-job-agent）

把已确认的本地改动发布到生产环境。整个链路为「核对范围 → 提交推送 → 服务器部署 → 核对线上产物」。

## 环境事实（直接使用，无需重新询问）

- 服务器 `8.133.193.224`，部署目录 `/opt/ai-job-agent`，PM2 进程 `ai-job-api`
- 线上域名 `https://ai-job.chenqi2005.xin`
- 远程部署脚本 `/opt/ai-job-agent/scripts/deploy.sh`，会自动拉取代码、装依赖、构建前端、重启 PM2 并做健康检查
- 生产数据在服务器本地 SQLite `server/data/accounts.db`，`server/data/` 不入库 Git

## 步骤

1. **核对改动范围**：执行 `git status --short`，确认只有本次要发布的文件。
   - 只暂存本次相关文件，使用明确路径的 `git add <file...>`；禁止 `git add -A` / `git add .`，避免无关文件（文档、临时脚本、统计文件）混入。
   - 若出现与本次任务无关的改动，先向用户说明并确认如何处理，不要擅自提交。

2. **确认已构建通过**：若改动尚未构建，执行 `npm run build`（含 `tsc --noEmit`）。
   - 记住本次构建产物文件名（`dist/assets/index-*.js`），最后一步核对要用。

3. **提交并推送**：
   - `git commit` 使用贴合改动的 message（中文，`feat/fix/chore` 等 conventional 前缀），多行用 heredoc。
   - `git push origin main`。不要加 `--no-verify`、不要 force push。

4. **服务器部署**：
   ```bash
   ssh -o ConnectTimeout=15 root@8.133.193.224 'bash /opt/ai-job-agent/scripts/deploy.sh'
   ```
   - 成功标志：输出包含 `[ OK ] 部署完成`，且健康检查返回 `{"ok":true,...}`，PM2 进程状态 online。
   - 若部署失败，读取输出定位，不要谎称成功；修复后从对应步骤重试。

5. **核对线上产物确实生效**：
   ```bash
   curl -s https://ai-job.chenqi2005.xin/ | grep -o 'index-[A-Za-z0-9_-]*\.js'
   ```
   - 返回的文件名必须与第 2 步本地构建产物一致。不一致则说明 CDN/缓存或部署未更新，需排查后再下结论。

6. **汇报**：用中文给出 commit 短 hash、涉及文件、部署与健康检查结果、线上产物名；并提示需要用户在浏览器端验证的事项。

## 边界

- 用户说「发布/部署」即视为已授权上述标准链路；但范围异常（无关文件）时必须先确认。
- 不代填用户密码；需要登录验证的环节交还给用户。
- 不创建提交以外的额外提交、不主动扩展功能；只完成发布这一件事。
