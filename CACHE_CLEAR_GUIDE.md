# 清除浏览器缓存指南

## 问题描述
如果您访问 http://localhost:8964/home 时轮播图不显示或显示异常，可能是浏览器缓存了旧数据导致的。

## 解决方案

### 方法一：强制刷新页面（推荐）
1. 打开 http://localhost:8964/home
2. 按以下快捷键强制刷新：
   - **Mac**: `Command + Shift + R` 或 `Command + Option + R`
   - **Windows/Linux**: `Ctrl + Shift + R` 或 `Ctrl + F5`

### 方法二：清除浏览器的 LocalStorage
1. 打开 http://localhost:8964/home
2. 按 `F12` 打开开发者工具
3. 切换到 "Application"（应用程序）或 "Storage"（存储）标签
4. 在左侧找到 "Local Storage" → `http://localhost:8964`
5. 删除以下键：
   - `bingWallpaperToday`
   - `bingWallpaperCarousel`
6. 刷新页面（`F5` 或 `Command/Ctrl + R`）

### 方法三：完全清除浏览器缓存
1. 打开浏览器设置
2. 找到"隐私与安全"或"清除浏览数据"
3. 选择：
   - 缓存的图片和文件
   - Cookie 和其他网站数据（可选）
4. 时间范围选择"全部时间"
5. 点击"清除数据"
6. 重新访问 http://localhost:8964/home

## 验证修复

清除缓存后，您应该能看到：
1. 首页轮播图显示 Bing 每日壁纸
2. 轮播图自动切换（每3秒一张）
3. 共有 4 张壁纸（今日+前3天）

## 技术说明

### 修复内容
1. 修复了 `frontend/user/vite.config.js` 中的代理配置，将端口从 28965 改为 28964
2. 重新构建了用户端 Docker 容器以应用配置更改

### API 端点
- Bing 壁纸 API: `http://localhost:8964/api/external/bing-cache`
- 自定义轮播图 API: `http://localhost:8964/api/carousels`

### 轮播图显示逻辑
1. 优先显示数据库中的自定义轮播图（如果存在）
2. 如果没有自定义轮播图，则显示 Bing 每日壁纸
3. Bing 壁纸会自动缓存到 `backend/uploads/bing/` 目录
4. 前端会缓存轮播图数据到 LocalStorage 以提升性能

## 故障排查

如果清除缓存后仍然不显示，请检查：

### 1. 检查服务是否运行
```bash
docker ps
```
应该看到 3 个运行中的容器：
- `xxsy-mysql-1`
- `xxsy-backend-1`
- `xxsy-user-frontend-1`

### 2. 检查后端 API
```bash
curl http://localhost:28964/api/external/bing-cache?fast=1
```
应该返回包含 `today` 和 `data` 字段的 JSON

### 3. 检查图片文件
```bash
ls -lh backend/uploads/bing/
```
应该能看到形如 `20251201.jpg` 的文件

### 4. 查看容器日志
```bash
docker logs xxsy-user-frontend-1
docker logs xxsy-backend-1
```

### 5. 浏览器开发者工具
1. 按 `F12` 打开开发者工具
2. 切换到 "Network"（网络）标签
3. 刷新页面
4. 检查以下请求：
   - `/api/external/bing-cache` - 应该返回 200
   - `/api/uploads/bing/XXXXXXXX.jpg` - 应该返回 200

如果看到 404 或 500 错误，请检查对应的 API 端点和后端日志。

## 联系支持

如果以上方法都无法解决问题，请提供以下信息：
1. 浏览器控制台的错误信息（按 `F12` 查看 Console 标签）
2. 网络请求的状态（Network 标签中的失败请求）
3. 后端容器日志（`docker logs xxsy-backend-1`）
