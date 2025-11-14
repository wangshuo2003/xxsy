#!/usr/bin/env bash
# 双击运行时自动调用同目录下的 start-macos.sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec /bin/bash "$SCRIPT_DIR/start-macos.sh" "$@"
