#!/usr/bin/env bash
# 双击运行此文件以停止 Docker Compose 服务
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec /bin/bash "$SCRIPT_DIR/stop-macos.sh" "$@"
