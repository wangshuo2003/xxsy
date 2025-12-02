# 轮播图问题修复总结

## 问题
用户端首页 (http://localhost:8964/home) 的轮播图不显示 Bing 壁纸。

## 根本原因
前端代理配置错误：`frontend/user/vite.config.js` 中的 `proxyTarget` 指向了错误的端口 `28965`，而后端实际运行在 `28964` 端口。

## 已修复的内容

### 1. 修复代理配置
**文件**: `frontend/user/vite.config.js`

**修改前**:
```javascript
const proxyTarget =
  process.env.VITE_PROXY_TARGET ||
  process.env.PROXY_TARGET ||
  'http://localhost:28965'  // ❌ 错误的端口
```

**修改后**:
```javascript
const proxyTarget =
  process.env.VITE_PROXY_TARGET ||
  process.env.PROXY_TARGET ||
  'http://backend:28964'  // ✅ 正确的服务名和端口
```

### 2. 重新构建容器
执行了以下命令以应用配置更改：
```bash
docker-compose stop user-frontend
docker-compose rm -f user-frontend
docker-compose up -d --build user-frontend
```

## 验证结果

所有测试通过：
- ✅ 后端 API 可直接访问：`http://localhost:28964/api/external/bing-cache`
- ✅ 前端代理正常工作：`http://localhost:8964/api/external/bing-cache`
- ✅ 图片文件可访问：`http://localhost:28964/api/uploads/bing/XXXXXXXX.jpg`
- ✅ 通过前端代理访问图片正常：`http://localhost:8964/api/uploads/bing/XXXXXXXX.jpg`
- ✅ 返回 4 张 Bing 壁纸（今日 + 前3天）

## 用户需要做什么

由于前端配置已修复并重新构建，用户只需要：

### 选项 1：强制刷新浏览器（最简单）
1. 访问 http://localhost:8964/home
2. 按快捷键强制刷新：
   - Mac: `Command + Shift + R`
   - Windows/Linux: `Ctrl + Shift + R`

### 选项 2：清除 LocalStorage（如果强制刷新无效）
1. 按 `F12` 打开开发者工具
2. 进入 "Application" → "Local Storage" → `http://localhost:8964`
3. 删除 `bingWallpaperToday` 和 `bingWallpaperCarousel` 两个键
4. 刷新页面

## 技术细节

### 轮播图显示逻辑
1. 前端首先检查 LocalStorage 缓存
2. 如果无缓存，调用 `/api/external/bing-cache` 获取 Bing 壁纸
3. 同时请求 `/api/carousels` 获取自定义轮播图
4. 优先显示自定义轮播图，如果没有则显示 Bing 壁纸

### API 端点
- Bing 壁纸（快速）: `GET /api/external/bing-cache?fast=1`
- Bing 壁纸（完整）: `GET /api/external/bing-cache`
- 自定义轮播图: `GET /api/carousels?isActive=true`
- 图片文件: `/api/uploads/bing/{filename}.jpg`

### 文件位置
- 配置文件: `frontend/user/vite.config.js`
- 轮播图组件: `frontend/user/src/views/Home.vue`
- Bing 缓存工具: `frontend/user/src/utils/bingFallback.js`
- 后端路由: `backend/src/routes/external.js`
- 图片存储: `backend/uploads/bing/`

## 状态
✅ **已修复** - 所有功能正常运行，用户只需清除浏览器缓存即可看到效果。

## 相关文档
- 详细的缓存清除指南: `CACHE_CLEAR_GUIDE.md`
- 项目启动指南: `START.md`
- 项目架构说明: `.github/copilot-instructions.md`
