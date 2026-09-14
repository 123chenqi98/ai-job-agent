#!/usr/bin/env bash
#
# AI 求职助手 —— 一键部署 / 运维脚本（在 ECS 上以 root 运行）
#
# 用法:
#   ./deploy.sh            一键更新：拉代码 -> 装依赖 -> 构建 -> 重启 -> 健康检查
#   ./deploy.sh setup      首次装机：Node/PM2/Nginx 环境 + 站点配置 + 启动（幂等，可重复执行）
#   ./deploy.sh status     查看进程 / 端口 / 健康检查 / Nginx 配置状态
#   ./deploy.sh restart    仅重启后端并做健康检查
#   ./deploy.sh logs       跟踪后端日志（Ctrl+C 退出）
#
# 说明:
#   - server/.env（密钥）与 server/data/resume.pdf（简历）不通过 Git 分发，
#     本脚本只检查其是否存在，绝不生成或覆盖。
#   - 仅操作本项目自己的目录与 Nginx 配置文件，不影响同机其他站点。

set -euo pipefail

# ============================== 固定常量 ==============================
APP_NAME="ai-job-agent"
APP_DIR="/opt/ai-job-agent"
PM2_NAME="ai-job-api"
PORT="8787"
DOMAIN="ai-job.chenqi2005.xin"
REPO_URL="https://github.com/123chenqi98/ai-job-agent.git"
NODE_MAJOR="24"
NPM_REGISTRY="https://registry.npmmirror.com"
NGINX_CONF="/etc/nginx/conf.d/ai-job-agent.conf"
CERT_FULLCHAIN="/etc/nginx/ssl/chenqi2005.xin/fullchain.pem"
CERT_KEY="/etc/nginx/ssl/chenqi2005.xin/privkey.pem"
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
TSX_ENTRY="node_modules/tsx/dist/cli.mjs"

# ============================== 工具函数 ==============================
if [[ -t 1 ]]; then
  C_BLUE=$'\033[36m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_OFF=$'\033[0m'
else
  C_BLUE=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_OFF=""
fi
log()  { printf '%s==>%s %s\n' "$C_BLUE" "$C_OFF" "$*"; }
ok()   { printf '%s[ OK ]%s %s\n' "$C_GREEN" "$C_OFF" "$*"; }
warn() { printf '%s[WARN]%s %s\n' "$C_YELLOW" "$C_OFF" "$*"; }
die()  { printf '%s[FAIL]%s %s\n' "$C_RED" "$C_OFF" "$*" >&2; exit 1; }

require_root() {
  [[ $EUID -eq 0 ]] || die "请用 root 运行（当前 $(id -un)）。"
}

# ============================== 环境检查 ==============================
ensure_node() {
  if command -v node >/dev/null 2>&1; then
    local cur
    cur=$(node -p "process.versions.node.split('.')[0]")
    if [[ "$cur" == "$NODE_MAJOR" ]]; then
      ok "Node $(node -v) 已满足要求"
      return 0
    fi
    warn "当前 Node 大版本为 v$cur，本项目需要 v$NODE_MAJOR（pdfjs 在 v20 无法启动），开始安装……"
  else
    log "未检测到 Node，开始安装 v$NODE_MAJOR ……"
  fi

  command -v curl >/dev/null 2>&1 || die "缺少 curl，请先安装：dnf install -y curl"
  local ver url dir
  ver=$(curl -fsSL "${NPM_REGISTRY}/-/binary/node/index.json" \
        | grep -oE "\"version\":\"v${NODE_MAJOR}\.[0-9]+\.[0-9]+\"" \
        | cut -d'"' -f4 | sort -V | tail -1)
  [[ -n "$ver" ]] || die "无法解析 Node v$NODE_MAJOR 最新版本号"
  url="${NPM_REGISTRY}/-/binary/node/${ver}/node-${ver}-linux-x64.tar.gz"
  log "下载安装 Node ${ver} ……"
  local tmp; tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/node.tar.gz" "$url"
  rm -rf /usr/local/lib/nodejs/node-v*-linux-x64
  mkdir -p /usr/local/lib/nodejs
  tar -xzf "$tmp/node.tar.gz" -C /usr/local/lib/nodejs
  dir="/usr/local/lib/nodejs/node-${ver}-linux-x64"
  for b in node npm npx; do ln -sf "$dir/bin/$b" "/usr/local/bin/$b"; done
  rm -rf "$tmp"
  ok "Node 已安装：$(node -v)"
}

ensure_pm2() {
  npm config set registry "$NPM_REGISTRY" >/dev/null
  if ! command -v pm2 >/dev/null 2>&1; then
    log "安装 PM2 ……"
    npm install -g pm2 --no-audit --no-fund
    local pm2bin; pm2bin=$(dirname "$(readlink -f /usr/local/bin/node)")/pm2
    [[ -x "$pm2bin" ]] && ln -sf "$pm2bin" /usr/local/bin/pm2
  fi
  command -v pm2 >/dev/null 2>&1 || die "PM2 安装失败"
  ok "PM2 $(pm2 -v)"
}

ensure_git() {
  if ! command -v git >/dev/null 2>&1; then
    log "安装 git ……"
    dnf install -y git >/dev/null
  fi
}

check_secrets() {
  if [[ ! -f "$APP_DIR/server/.env" ]]; then
    die "缺少 $APP_DIR/server/.env（密钥不通过 Git 分发）。
  请在你本机执行（不会进入仓库）：
    scp server/.env root@<服务器IP>:$APP_DIR/server/.env"
  fi
  if [[ ! -f "$APP_DIR/server/data/resume.pdf" ]]; then
    warn "缺少 server/data/resume.pdf：岗位池/看板可用，但简历与 AI 功能会返回 404。
    需要时执行：scp server/data/resume.pdf root@<服务器IP>:$APP_DIR/server/data/resume.pdf"
  fi
}

# ============================== 代码与构建 ==============================
sync_code() {
  ensure_git
  if [[ -d "$APP_DIR/.git" ]]; then
    log "拉取最新代码 ……"
    git -C "$APP_DIR" pull --ff-only
  else
    log "首次克隆仓库到 $APP_DIR ……"
    mkdir -p "$(dirname "$APP_DIR")"
    git clone --depth 1 "$REPO_URL" "$APP_DIR"
  fi
  ok "代码已是最新（$(git -C "$APP_DIR" rev-parse --short HEAD)）"
}

install_deps() {
  cd "$APP_DIR"
  log "安装依赖 ……"
  npm config set registry "$NPM_REGISTRY" >/dev/null
  if [[ -f package-lock.json ]]; then
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  else
    npm install --no-audit --no-fund
  fi
  ok "依赖安装完成"
}

build_frontend() {
  cd "$APP_DIR"
  log "构建前端 ……"
  npm run build
  [[ -f dist/index.html ]] || die "构建失败：未生成 dist/index.html"
  ls dist/assets/*.js >/dev/null 2>&1 || die "构建失败：dist/assets 中未找到 JS 产物"
  ok "前端构建完成：$(ls dist/assets | tr '\n' ' ')"
}

# ============================== 进程与健康 ==============================
start_app() {
  cd "$APP_DIR"
  [[ -f "$TSX_ENTRY" ]] || die "未找到 $TSX_ENTRY，请先安装依赖"
  if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
    log "重启后端进程 ……"
    pm2 restart "$PM2_NAME" --update-env
  else
    log "首次启动后端进程 ……"
    pm2 start "$TSX_ENTRY" --name "$PM2_NAME" --cwd "$APP_DIR" -- server/src/index.ts
  fi
  pm2 save >/dev/null
}

health_check() {
  log "健康检查（最多等待 60s）……"
  local i
  for i in $(seq 1 30); do
    if curl -fsS -m 5 "$HEALTH_URL" >/dev/null 2>&1; then
      ok "后端健康：$(curl -fsS -m 5 "$HEALTH_URL")"
      return 0
    fi
    sleep 2
  done
  pm2 logs "$PM2_NAME" --nostream --lines 20 || true
  die "后端健康检查失败，请查看上方日志：pm2 logs $PM2_NAME"
}

# ============================== Nginx ==============================
setup_nginx() {
  [[ -f "$CERT_FULLCHAIN" && -f "$CERT_KEY" ]] \
    || die "未找到泛域名证书：$CERT_FULLCHAIN / $CERT_KEY，请先准备证书。"

  if [[ -f "$NGINX_CONF" ]]; then
    ok "Nginx 配置已存在：$NGINX_CONF（如需重写请加 --force）"
    return 0
  fi

  log "写入 Nginx 配置 $NGINX_CONF ……"
  cat > "$NGINX_CONF" <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name ai-job.chenqi2005.xin;
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ai-job.chenqi2005.xin;

    ssl_certificate     /etc/nginx/ssl/chenqi2005.xin/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/chenqi2005.xin/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    root /opt/ai-job-agent/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 180s;
        proxy_send_timeout 180s;
    }

    location / { try_files $uri $uri/ /index.html; }
}
NGINX

  if nginx -t; then
    systemctl reload nginx
    ok "Nginx 配置生效"
  else
    rm -f "$NGINX_CONF"
    die "nginx -t 校验失败，已回滚（删除新配置），原有站点不受影响。"
  fi
}

ensure_startup() {
  pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
  pm2 save >/dev/null
  ok "已配置开机自启"
}

# ============================== 子命令 ==============================
cmd_update() {
  require_root
  check_secrets
  sync_code
  install_deps
  build_frontend
  start_app
  health_check
  echo
  ok "部署完成：https://${DOMAIN}"
}

cmd_setup() {
  require_root
  ensure_node
  ensure_pm2
  sync_code
  check_secrets
  install_deps
  build_frontend
  setup_nginx
  start_app
  ensure_startup
  health_check
  echo
  ok "首次部署完成：https://${DOMAIN}"
}

cmd_status() {
  require_root
  pm2 list || true
  echo
  if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    ok "端口 ${PORT} 正在监听"
  else
    warn "端口 ${PORT} 未监听"
  fi
  if curl -fsS -m 5 "$HEALTH_URL" >/dev/null 2>&1; then
    ok "健康检查通过：$(curl -fsS -m 5 "$HEALTH_URL")"
  else
    warn "健康检查失败"
  fi
  [[ -f "$NGINX_CONF" ]] && ok "Nginx 配置存在" || warn "Nginx 配置缺失（可执行 $0 setup）"
  nginx -t 2>&1
}

cmd_restart() {
  require_root
  start_app
  health_check
}

cmd_logs() {
  exec pm2 logs "$PM2_NAME"
}

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

main() {
  case "${1:-update}" in
    update|"")  cmd_update ;;
    setup)      cmd_setup ;;
    status)     cmd_status ;;
    restart)    cmd_restart ;;
    logs)       cmd_logs ;;
    -h|--help|help) usage ;;
    *) echo "未知子命令：$1" >&2; usage; exit 1 ;;
  esac
}

main "$@"
