# 教育实践平台启动说明

## 项目结构
```
project/
├── backend/           # 后端项目 (Node.js + Express + Prisma)
├── frontend/
│   └── admin/         # 管理端 (Vue3 + Vite + Element Plus)
├── docker-compose.yml # Docker配置
└── START.md          # 本说明文件
```

## 环境要求
- Node.js 18+
- MySQL 8.4
- npm 或 yarn

## 端口配置

### 服务端口分布
- **MySQL 数据库**: 3306 (Docker 配置)
- **后端 API 服务**: 28964 (开发环境)
- **管理端前端**: 18964 (Vite 开发服务器)
- **用户端前端**: 8964 (Vite 开发服务器)

### Docker 端口映射
- **MySQL**: 3306:3306
- **后端服务**: 28964:28964
- **管理端**: 18964:18964
- **用户端**: 8964:8964

## 推荐启动方式：Docker Compose（推荐）

项目附带了三个系统对应的一键脚本，它们都会在项目根目录下调用 Docker Compose 来编排数据库、后端以及两个前端服务：

| 系统 | 启动命令 |
| --- | --- |
| macOS | 双击 `start-macos.command` 或在终端执行 `./start-macos.sh`（首次或需要强制重新构建可加 `--rebuild`） |
| Linux | `./start-linux.sh` （如当前用户不在 docker 组可使用 `sudo ./start-linux.sh`） |
| Windows | `powershell -ExecutionPolicy Bypass -File .\start-windows.ps1 [-Rebuild]` |

停止服务可使用对应脚本：

| 系统 | 停止命令 |
| --- | --- |
| macOS | 双击 `stop-macos.command` 或执行 `./stop-macos.sh`（加 `--volumes` 可顺带删除卷） |
| Linux | `./stop-linux.sh`（必要时 `sudo ./stop-linux.sh`，加 `--volumes` 删除卷） |
| Windows | `powershell -ExecutionPolicy Bypass -File .\stop-windows.ps1 [-RemoveVolumes]` |

脚本会自动检测 `docker compose` 或 `docker-compose`，默认执行 `up -d` 并给出访问地址。需要停止服务时运行 `docker compose down`（或 `docker-compose down`）。如果希望不用脚本，等效命令是：

```bash
docker compose up -d --build   # 首次运行或依赖变更时建议带 --build
```

## 手动启动（开发模式）

### 1. 启动后端服务
```bash
cd backend
npm install
npm run dev
```
后端服务将运行在 http://localhost:28964

### 2. 启动前端管理端
```bash
cd frontend/admin
npm install
npm run dev
```
前端管理端将运行在 http://localhost:18964

### 3. 启动前端用户端 (可选)
```bash
cd frontend/user
npm install
npm run dev
```
前端用户端将运行在 http://localhost:8964

## 演示账号

### 超级管理员
- 用户名: a
- 密码: 1

### 管理员
- 用户名: b1
- 密码: 1

### 学生用户
- 用户名: studenta
- 密码: 1

## 主要功能

### 已实现功能
1. 用户认证系统（登录、权限管理）
2. 轮播图管理（增删改查、排序）
3. 数据库设计（完整的表结构和关系）
4. API接口（RESTful风格）
5. 前端界面（管理端布局和基础页面）

### 待完善功能
- 政策通知管理
- 成果展示管理
- 基地管理
- 活动管理
- 服务项目管理
- 订单管理
- 用户管理
- 用户端界面

## 技术栈

### 后端
- Node.js
- Express.js
- Prisma ORM
- MySQL
- JWT认证
- Multer文件上传

### 前端
- Vue 3
- Vite
- Element Plus
- Vue Router
- Pinia状态管理
- Axios

## 数据库配置
数据库名称: education_platform
端口: 3306
用户名: root
密码: 9

### 环境变量配置
后端服务配置文件: `backend/.env`
```
DATABASE_URL="mysql://root:9@localhost:3306/education_platform"
JWT_SECRET="your-jwt-secret-key-change-in-production"
NODE_ENV="development"
PORT=28964
UPLOAD_PATH="./uploads"
```
