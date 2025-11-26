#!/bin/sh
set -e

# 切到仓库根目录
cd "$(dirname "$0")"

echo "Cleaning dist artifacts..."
rm -rf frontend/user/dist frontend/admin/dist

echo "Rebuilding containers with fresh assets..."
docker compose down
docker compose up -d --build

echo "Done. Containers are up with the latest build."
