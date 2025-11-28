#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
USER_DIR="$ROOT_DIR/frontend/user"

cd "$USER_DIR"

DC="docker compose"

echo "[1/6] 构建前端 dist..."
npm run build

echo "[2/6] 无缓存重建 user-frontend 镜像..."
$DC build --no-cache user-frontend

echo "[3/6] 启动/重建 user-frontend 容器..."
$DC up -d user-frontend

echo "[4/6] 清空容器内 dist..."
$DC exec user-frontend sh -c "rm -rf /app/dist && mkdir -p /app/dist"

echo "[5/6] 覆盖新的 dist..."
$DC cp dist/. user-frontend:/app/dist

echo "[6/6] 强制重启容器以清缓存..."
$DC restart user-frontend

echo "✓ 完成：前端已构建刷新，并强制清缓存。请浏览器用无痕模式打开页面查看效果。"