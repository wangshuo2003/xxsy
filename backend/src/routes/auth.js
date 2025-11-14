const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

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
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { username, password } = req.body

    // 查找用户
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { phone: username }
        ]
      }
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
