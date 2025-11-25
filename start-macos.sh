#!/usr/bin/env bash
set -euo pipefail

PLATFORM_NAME="macOS"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAX_RETRIES=5
RETRY_INTERVAL=5
PROJECT_NAME="xxsy"

if ! command -v docker >/dev/null 2>&1; then
  echo "[$PLATFORM_NAME] 未检测到 Docker，请先安装 Docker Desktop。" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker 未运行，正在尝试启动 Docker Desktop..."
  open -a Docker

  echo "正在等待 Docker 守护进程启动，请稍候... (最多等待 60 秒)"
  for i in {1..12}; do
    if docker info >/dev/null 2>&1; then
      echo "Docker 已成功启动。"
      break
    fi
    sleep 5
  done

  if ! docker info >/dev/null 2>&1; then
    echo "启动 Docker 失败。请确保 Docker Desktop 已正确安装并手动启动一次。" >&2
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
