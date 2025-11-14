const jwt = require('jsonwebtoken')
const prisma = require('../config/database')

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: '访问被拒绝，没有提供token' })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, username: true, role: true, name: true }
    })

    if (!user) {
      return res.status(401).json({ error: '无效的token' })
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ error: '无效的token' })
  }
}

const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未认证' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' })
    }

    next()
  }
}

module.exports = { authMiddleware, roleMiddleware }