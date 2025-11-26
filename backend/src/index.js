const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const dotenv = require('dotenv')
const path = require('path')
const { authMiddleware } = require('./middleware/auth')

// 重新启动后端服务

dotenv.config()

const app = express()
const PORT = parseInt(process.env.PORT) || 38964

const parseOrigins = (value) => {
  return (value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

const defaultOrigins = [
  'http://localhost:18964',
  'http://localhost:8964',
  'http://localhost:8965',
  'http://localhost:8966',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:5176',
  'http://localhost:5177',
  'http://localhost:5178',
  'http://localhost:38964',
  'http://localhost:48965'
]

const corsOrigins = parseOrigins(process.env.CORS_ALLOWED_ORIGINS)
const allowedOrigins = corsOrigins.length ? corsOrigins : defaultOrigins
const allowedOriginsSet = new Set(allowedOrigins)

const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'
const rateLimitWindowMinutes = Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100

app.set('trust proxy', 1)

// CORS配置
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOriginsSet.has(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS Not Allowed'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

if (rateLimitEnabled) {
  app.use(rateLimit({
    windowMs: rateLimitWindowMinutes * 60 * 1000,
    max: rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false
  }))
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

// 解析请求体
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// 静态文件服务（同时暴露 /uploads 与 /api/uploads，便于前端同域访问）
const uploadsPath = path.join(__dirname, '../uploads')
app.use('/uploads', express.static(uploadsPath))
app.use('/api/uploads', express.static(uploadsPath))

// 路由
app.use('/api/auth', require('./routes/auth'))
app.use('/api/carousels', require('./routes/carousels'))
app.use('/api/policies', require('./routes/policies'))
app.use('/api/achievements', require('./routes/achievements'))
app.use('/api/bases', require('./routes/bases'))
app.use('/api/activities', require('./routes/activities'))
app.use('/api/services', require('./routes/services'))
app.use('/api/orders', require('./routes/orders'))
app.use('/api/users', require('./routes/users'))
app.use('/api/certificates', require('./routes/certificates'))
app.use('/api/favorites', authMiddleware, require('./routes/favorites'))
app.use('/api/balance', require('./routes/balance').router)
app.use('/api/gift-cards', require('./routes/giftCards'))
app.use('/api/base-coupons', require('./routes/baseCoupons'))
app.use('/api/refunds', require('./routes/refunds'))
app.use('/api/external', require('./routes/external'))

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})


// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: '接口不存在' })
})

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ error: '服务器内部错误' })
})

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
})
