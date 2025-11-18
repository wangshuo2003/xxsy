# AI 编码助手指南 - 教育实践平台

## 项目概览

教育实践平台（XXSY）是一个综合素质评价成果服务平台，采用 **Node.js + Vue3** 全栈架构，支持三角色权限系统（超级管理员、活动管理员、学生）。

### 核心技术栈
- **后端**: Node.js + Express + Prisma ORM + MySQL 8.4
- **前端**: Vue 3 + Vite + Element Plus + Pinia
- **部署**: Docker Compose（3 个服务：MySQL、后端、两个前端）
- **认证**: JWT Token（7天过期）+ 密码加密（bcryptjs）

### 项目结构
```
backend/          # Express API 服务 (28964 端口)
frontend/admin/   # 管理端 - 管理员用 (18964 端口)
frontend/user/    # 用户端 - 学生用 (8964 端口)
prisma/          # 数据库 schema 和 seed 脚本
```

---

## 核心架构模式

### 1. 权限系统 (三层角色)

在 `backend/prisma/schema.prisma` 中定义的角色：

```prisma
enum Role {
  SUPER_ADMIN      # 系统管理员 - 全部权限
  ACTIVITY_ADMIN   # 活动管理员 - 仅管理学生和活动
  STUDENT          # 学生用户 - 默认角色
}
```

**权限控制模式**：在路由层用中间件检查
```javascript
// 从 backend/src/middleware/auth.js
const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' })
    }
    next()
  }
}

// 使用示例（backend/src/routes/users.js）
router.get('/', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), ...)
```

活动管理员可用查询过滤权限（见 `backend/src/routes/users.js` 第 32-36 行）。

### 2. 数据库设计关键实体

**核心资源关系**：
- `User` ← → `Activity`（多对多通过 `UserActivity`，带状态）
- `Base`（基地）← → `Activity`（一对多）
- `Service`（服务/赛事项目）
- `Order`（订单，关联 Service 或 Activity）
- `Certificate`（学生证书）
- `Favorite`（用户收藏）

**重点字段**：
- `Order.status`: PENDING → PAID → REFUNDING → REFUNDED
- `Activity.isApproved`: 管理员审核标志（影响前端展示）
- `UserActivity.status`: REGISTERED / APPROVED / REJECTED

### 3. API 响应约定

**成功响应**：
```json
{
  "message": "操作成功",
  "data": { ... },
  "user": { ... }
}
```

**错误响应**：
```json
{ "error": "错误信息" }
```

**Axios 拦截器处理**（`frontend/admin/src/api/request.js`）：
- 401: 清除 token，重定向登录
- 403: 权限不足提示
- 400: 显示具体错误
- 自动在 Authorization header 中添加 Bearer token

---

## 关键开发工作流

### 启动服务
```bash
# 推荐：Docker Compose（一键启动）
./start-macos.sh          # macOS
./start-linux.sh          # Linux
./start-windows.ps1       # Windows

# 手动启动（开发模式）
cd backend && npm run dev  # 28964
cd frontend/admin && npm run dev  # 18964
cd frontend/user && npm run dev   # 8964
```

### 初始化数据和测试账号
```bash
cd backend
node create-admin.js           # 创建超级管理员(admin/123456)和管理员(baseadmin/123456)
node init-test-data.js         # 创建 31 个测试基地和活动
node create-test-events.js     # 创建测试事件
```

### 数据库操作
```bash
npx prisma db push           # 同步 schema 到数据库
npx prisma migrate dev       # 创建新迁移
npx prisma generate         # 重新生成客户端
```

---

## 常见模式和最佳实践

### 文件上传处理

所有上传通过 Multer 配置（见 `backend/src/routes/carousels.js` 第 36-58 行）：
- 限制：5MB 单个文件，仅允许图片
- 存储位置：`backend/uploads/{resourceType}/`
- 文件 URL 构建：使用 `buildFileUrl()` 确保支持相对路径和完整 URL

```javascript
// 模板：添加新上传路由时
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/type'))
  },
  filename: (req, file, cb) => {
    const suffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + suffix + path.extname(file.originalname))
  }
})
```

### 查询分页模式

所有列表端点支持分页（见 `backend/src/routes/carousels.js` 第 68-75 行）：
```javascript
const { page = 1, limit = 10 } = req.query
const skip = (page - 1) * limit
const items = await prisma.model.findMany({ skip, take: parseInt(limit), ... })
const total = await prisma.model.count({ where })
```

### 前端状态管理

使用 Pinia store（`frontend/admin/src/stores/user.js`）：
- 存储 user 对象、token、登录状态
- 自动持久化 token 到 localStorage
- 提供 getter：`isLoggedIn`, `userRole`, `userName`

### 用户历史记录

关键操作（如用户编辑）自动记录到 `UserHistory` 表（见 `backend/src/routes/users.js` 第 10-27 行）：
```javascript
await recordUserHistory(userSnapshot, changedById)
```

---

## 常见陷阱和注意事项

1. **角色检查顺序**：活动管理员权限限制需在查询时施加（见 users.js），不能只依赖中间件
2. **Token 过期处理**：前端拦截器自动清除过期 token，但避免硬编码 7 天假设
3. **文件 URL 格式**：Docker 环境中需设置 `FILE_PUBLIC_BASE_URL=http://localhost:28964`，否则文件无法访问
4. **CORS 配置**：多个端口需白名单（见 `backend/src/index.js` 第 11-18 行），开发新前端应添加到列表
5. **Draft 模式**：Policy / Achievement 有 `isDraft` 字段，查询时需主动过滤
6. **数据库连接重试**：Prisma 配置 5 次重试机制（见 `backend/src/config/database.js`），超时前会等待

---

## 文件位置速查表

| 功能 | 位置 |
|------|------|
| 路由定义 | `backend/src/routes/*.js` |
| 认证中间件 | `backend/src/middleware/auth.js` |
| 数据模型 | `backend/prisma/schema.prisma` |
| Pinia 状态 | `frontend/admin/src/stores/user.js` |
| API 请求 | `frontend/admin/src/api/request.js` |
| 初始化脚本 | `backend/*.js` (create-admin, init-test-data 等) |
| Docker 配置 | `docker-compose.yml` + `backend/Dockerfile` |

---

## 添加新功能检查清单

- [ ] 在 `schema.prisma` 中定义数据模型
- [ ] 在 `backend/src/routes/` 中创建路由（CRUD）
- [ ] 在路由中应用 `authMiddleware` 和 `roleMiddleware`
- [ ] 在 `frontend/admin/src/api/` 中添加 API 调用函数
- [ ] 在 Pinia store 中添加状态管理（如需要）
- [ ] 测试权限检查和错误处理
- [ ] 为上传功能配置 Multer 存储
- [ ] 更新 docker-compose.yml 的 CORS 白名单（如新前端）
