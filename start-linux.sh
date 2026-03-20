#!/usr/bin/env bash
set -euo pipefail

PLATFORM_NAME="Linux"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAX_RETRIES=5
RETRY_INTERVAL=5
PROJECT_NAME="xxsy"

if ! command -v docker >/dev/null 2>&1; then
  echo "[$PLATFORM_NAME] 未检测到 Docker，请先安装 Docker Engine。" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker 守护进程未运行，正在尝试启动..."
  # Best-effort attempt to start Docker. This may require root privileges.
  if command -v systemctl >/dev/null 2>&1; then
    systemctl start docker &>/dev/null || true
  fi

  echo "正在等待 Docker 守护进程响应... (最多等待 15 秒)"
  for i in {1..3}; do
    if docker info >/dev/null 2>&1; then
      echo "Docker 已成功启动。"
      break
    fi
    sleep 5
  done

  if ! docker info >/dev/null 2>&1; then
    echo "启动 Docker 失败。请尝试使用 'sudo systemctl start docker' 手动启动，并确保当前用户位于 'docker' 用户组中。" >&2
    exit 1
  fi
fi

compose_cmd=(docker compose)
compose_display="docker compose"
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    compose_cmd=(docker-compose)
    compose_display="docker-compose"
  else
    echo "[$PLATFORM_NAME] 未检测到 Docker Compose，请安装后再试。" >&2
    exit 1
  fi
fi

compose_run() {
  (cd "$ROOT_DIR" && COMPOSE_PROJECT_NAME="$PROJECT_NAME" "${compose_cmd[@]}" "$@")
}

ensure_mysql_image() {
  if docker image inspect mysql:8.4 >/dev/null 2>&1; then
    echo "[$PLATFORM_NAME] 已检测到本地 MySQL 镜像 mysql:8.4，优先使用本地镜像。"
    return
  fi

  echo "[$PLATFORM_NAME] 本地未找到 MySQL 镜像 mysql:8.4，开始拉取最新镜像..."
  docker pull mysql:8.4
}

echo "[$PLATFORM_NAME] 清理前端构建产物..."
rm -rf "$ROOT_DIR/frontend/user/dist" "$ROOT_DIR/frontend/admin/dist" || true

ensure_mysql_image

compose_args=(up -d)
if [[ "${1:-}" == "--rebuild" ]]; then
  compose_args=(up -d --build)
fi

echo "[$PLATFORM_NAME] 使用 ${compose_display} 启动教育实践平台..."
compose_run "${compose_args[@]}"

attempt=1
while (( attempt <= MAX_RETRIES )); do
  echo "[$PLATFORM_NAME] 确保 backend 容器就绪（尝试 ${attempt}/${MAX_RETRIES}）..."
  if compose_run up -d backend; then
    echo "[$PLATFORM_NAME] backend 已成功启动。"
    break
  fi

  if (( attempt == MAX_RETRIES )); then
    echo "[$PLATFORM_NAME] backend 重试 ${MAX_RETRIES} 次仍失败，请检查数据库或后端日志。" >&2
    exit 1
  fi

  echo "[$PLATFORM_NAME] backend 启动失败，${RETRY_INTERVAL}s 后重试..."
  sleep "$RETRY_INTERVAL"
  ((attempt++))
done

cat <<MSG
服务已启动：
- MySQL:      3306 (容器内部访问)
- 后端 API:   http://localhost:28964
- 管理端：    http://localhost:18964
- 用户端：    http://localhost:8964

使用 \`${compose_display} logs -f backend\` 查看后端日志，
使用 \`${compose_display} down\` 停止所有服务。
MSG
