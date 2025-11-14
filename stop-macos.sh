#!/usr/bin/env bash
set -euo pipefail

PLATFORM_NAME="macOS"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v docker >/dev/null 2>&1; then
  echo "[$PLATFORM_NAME] 未检测到 Docker，请先安装 Docker Desktop。" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "[$PLATFORM_NAME] Docker 未运行，请先启动 Docker Desktop。" >&2
  exit 1
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

compose_args=(down)
if [[ "${1:-}" == "--volumes" ]]; then
  compose_args=(down -v)
fi

echo "[$PLATFORM_NAME] 正在停止教育实践平台..."
(cd "$ROOT_DIR" && "${compose_cmd[@]}" "${compose_args[@]}")

echo "所有容器和网络已停止。"
if [[ "${compose_args[*]}" == *"-v"* ]]; then
  echo "提示：已同时移除持久化卷。"
fi
echo "如需重新启动，请运行 ${compose_display} up -d 或使用 start 脚本。"
