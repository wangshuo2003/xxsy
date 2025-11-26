const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const crypto = require('crypto')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// 简单的内存验证码存储（生产环境建议改为缓存/持久化/图形验证码服务）
const captchaStore = new Map()
const CAPTCHA_EXPIRE_MS = 5 * 60 * 1000

const createCaptcha = () => {
  const code = String(Math.floor(Math.random() * 10000)).padStart(4, '0')
  const id = crypto.randomUUID()
  const expiresAt = Date.now() + CAPTCHA_EXPIRE_MS
  captchaStore.set(id, { code, expiresAt })
  // 自动过期清理
  setTimeout(() => captchaStore.delete(id), CAPTCHA_EXPIRE_MS + 1000)
  return { id, code, expiresIn: CAPTCHA_EXPIRE_MS }
}

// 获取验证码元信息，返回图片访问路径，前端无需接触明文
router.get('/captcha', (req, res) => {
  try {
    const captcha = createCaptcha()
    res.json({
      id: captcha.id,
      imageUrl: `/api/auth/captcha/image/${captcha.id}`,
      expiresIn: CAPTCHA_EXPIRE_MS
    })
  } catch (e) {
    console.error('生成验证码失败:', e)
    res.status(500).json({ error: '生成验证码失败' })
  }
})

// 根据 ID 返回验证码图片
router.get('/captcha/image/:id', (req, res) => {
  try {
    const id = req.params.id
    const record = captchaStore.get(id)
    if (!record || record.expiresAt < Date.now()) {
      return res.status(404).send('captcha expired')
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
      <rect width="120" height="40" fill="#f7f8fa" />
      <text x="12" y="28" font-size="24" font-family="Arial" fill="#333">${record.code}</text>
    </svg>`
    res.setHeader('Content-Type', 'image/svg+xml')
    res.setHeader('Cache-Control', 'no-store')
    res.send(svg)
  } catch (e) {
    console.error('获取验证码图片失败:', e)
    res.status(500).send('error')
  }
})

// 注册
router.post('/register', [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  body('name').notEmpty().withMessage('姓名不能为空'),
  body('phone').notEmpty().withMessage('手机号不能为空')
    .isLength({ min: 3, max: 20 }).withMessage('手机号长度应在3-20个字符之间')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, password, name, phone, school, grade, className } = req.body

    // 检查用户是否已存在
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { phone }
        ]
      }
    })

    if (existingUser) {
      return res.status(400).json({ error: '用户名或手机号已存在' })
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name,
        phone,
        school,
        grade,
        className,
        role: 'STUDENT'
      },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        school: true,
        grade: true,
        className: true,
        role: true,
        createdAt: true
      }
    })

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      message: '注册成功',
      user,
      token
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 登录
router.post('/login', [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  body('captchaId').optional().isString(),
  body('captchaCode').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, password, captchaId, captchaCode } = req.body

    // 如果传递了验证码，则进行校验
    if (captchaId || captchaCode) {
      const record = captchaStore.get(captchaId)
      if (!record || record.expiresAt < Date.now() || !captchaCode || record.code.toLowerCase() !== captchaCode.toLowerCase()) {
        return res.status(400).json({ error: '验证码错误或已过期' })
      }
      captchaStore.delete(captchaId)
    }

    // 仅按用户名查找（不再允许手机号登录）
    const user = await prisma.user.findUnique({
      where: { username }
    })

    if (!user) {
      return res.status(400).json({ error: '用户名或密码错误' })
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(400).json({ error: '用户名或密码错误' })
    }

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        phone: user.phone,
        school: user.school,
        grade: user.grade,
        className: user.className,
        role: user.role
      },
      token
    })
  } catch (error) {
    console.error('登录错误:', error.message)
    console.error('错误堆栈:', error.stack)
    res.status(500).json({ error: '服务器错误', details: error.message })
  }
})

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        school: true,
        grade: true,
        className: true,
        role: true,
        avatar: true,
        createdAt: true
      }
    })

    res.json({ user })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 修改密码
router.put('/password', authMiddleware, [
  body('oldPassword').notEmpty().withMessage('原密码不能为空'),
  body('newPassword').notEmpty().withMessage('新密码不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { oldPassword, newPassword } = req.body

    // 获取用户完整信息
    const user = await prisma.user.findUnique({
      where: { id: req.user.id }
    })

    // 验证原密码
    const isValidPassword = await bcrypt.compare(oldPassword, user.password)
    if (!isValidPassword) {
      return res.status(400).json({ error: '原密码错误' })
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // 更新密码
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword }
    })

    res.json({ message: '密码修改成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 编辑用户资料
router.put('/profile', authMiddleware, [
  body('name').notEmpty().withMessage('姓名不能为空'),
  body('phone').notEmpty().withMessage('手机号不能为空')
    .isLength({ min: 3, max: 20 }).withMessage('手机号长度应在3-20个字符之间'),
  body('school').optional().isLength({ max: 128 }).withMessage('学校名称不能超过128个字符'),
  body('grade').optional().isLength({ max: 64 }).withMessage('年级信息不能超过64个字符'),
  body('className').optional().isLength({ max: 64 }).withMessage('班级信息不能超过64个字符')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { name, phone, school, grade, className } = req.body

    // 检查手机号是否已被其他用户使用
    const existingUser = await prisma.user.findFirst({
      where: {
        AND: [
          { phone },
          { NOT: { id: req.user.id } }
        ]
      }
    })

    if (existingUser) {
      return res.status(400).json({ error: '手机号已被其他用户使用' })
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name,
        phone,
        school: school?.trim() || null,
        grade: grade?.trim() || null,
        className: className?.trim() || null
      },
      select: {
        id: true,
        username: true,
        name: true,
        phone: true,
        school: true,
        grade: true,
        className: true,
        role: true,
        avatar: true,
        createdAt: true
      }
    })

    try {
      await prisma.userHistory.create({
        data: {
          userId: updatedUser.id,
          changedBy: req.user.id,
          username: updatedUser.username,
          name: updatedUser.name,
          phone: updatedUser.phone,
          school: updatedUser.school,
          grade: updatedUser.grade,
          className: updatedUser.className,
          role: updatedUser.role,
          isDisabled: false
        }
      })
    } catch (historyError) {
      console.error('记录用户历史失败:', historyError)
    }

    res.json({ message: '资料修改成功', user: updatedUser })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router
