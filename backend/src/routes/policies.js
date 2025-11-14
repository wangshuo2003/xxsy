const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')
const multer = require('multer')
const path = require('path')

const router = express.Router()

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs')

    // 确保上传目录存在
    const uploadDir = file.mimetype.startsWith('video/') ? 'uploads/videos' : 'uploads/files'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    cb(null, uploadDir + '/')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
})

// 文件上传路由
router.post('/upload', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' })
    }

    const uploadDir = req.file.mimetype.startsWith('video/') ? 'uploads/videos' : 'uploads/files'
    const fileUrl = `/${uploadDir}/${req.file.filename}`

    res.json({
      message: '文件上传成功',
      fileUrl: fileUrl
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '文件上传失败' })
  }
})

// 获取政策通知列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, isDraft, search } = req.query

    const where = {}
    // 检查是否有认证信息和角色信息
    const authHeader = req.headers.authorization
    let isAdmin = false

    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1]
        const jwt = require('jsonwebtoken')
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
        const user = await prisma.user.findUnique({
          where: { id: decoded.userId },
          select: { role: true }
        })
        isAdmin = user && (user.role === 'ACTIVITY_ADMIN' || user.role === 'SUPER_ADMIN')
      } catch (error) {
        // Token无效或过期，按普通用户处理
      }
    }

    // 如果没有明确指定isDraft参数，根据用户角色决定默认行为
    if (isDraft === undefined) {
      if (isAdmin) {
        // 管理员可以看到所有政策（包括草稿）
        // 不设置where.isDraft条件
      } else {
        // 普通用户只能看到已发布的政策
        where.isDraft = false
      }
    } else {
      // 明确指定了isDraft参数，按参数过滤
      where.isDraft = isDraft === 'true'
    }
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { tags: { contains: search } }
      ]
    }

    const policies = await prisma.policy.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        creator: {
          select: { name: true }
        }
      }
    })

    const total = await prisma.policy.count({ where })

    res.json({
      data: policies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取单个政策通知
router.get('/:id', async (req, res) => {
  try {
    const policy = await prisma.policy.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        creator: {
          select: { name: true }
        }
      }
    })

    if (!policy) {
      return res.status(404).json({ error: '政策通知不存在' })
    }

    res.json({ data: policy })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 创建政策通知
router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), [
  body('title').notEmpty().withMessage('标题不能为空'),
  body('content').notEmpty().withMessage('内容不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { title, content, tags, isDraft = false } = req.body

    const policy = await prisma.policy.create({
      data: {
        title,
        content,
        tags,
        videoUrl: req.files && req.files.video && req.files.video[0] ? `/uploads/videos/${req.files.video[0].filename}` : null,
        fileUrl: req.files && req.files.file && req.files.file[0] ? `/uploads/files/${req.files.file[0].filename}` : null,
        isDraft: Boolean(isDraft),
        createdBy: req.user.id
      },
      include: {
        creator: {
          select: { name: true }
        }
      }
    })

    res.status(201).json({
      message: '政策通知创建成功',
      data: policy
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 更新政策通知
router.put('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), [
  body('title').optional().notEmpty().withMessage('标题不能为空'),
  body('content').optional().notEmpty().withMessage('内容不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const policy = await prisma.policy.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!policy) {
      return res.status(404).json({ error: '政策通知不存在' })
    }

    const { title, content, tags, isDraft } = req.body
    const updateData = {}

    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (tags !== undefined) updateData.tags = tags
    if (isDraft !== undefined) updateData.isDraft = Boolean(isDraft)

    if (req.files && req.files.video && req.files.video[0]) {
      updateData.videoUrl = `/uploads/videos/${req.files.video[0].filename}`
    }
    if (req.files && req.files.file && req.files.file[0]) {
      updateData.fileUrl = `/uploads/files/${req.files.file[0].filename}`
    }

    const updatedPolicy = await prisma.policy.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        creator: {
          select: { name: true }
        }
      }
    })

    res.json({
      message: '政策通知更新成功',
      data: updatedPolicy
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 删除政策通知
router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const policy = await prisma.policy.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!policy) {
      return res.status(404).json({ error: '政策通知不存在' })
    }

    await prisma.policy.delete({
      where: { id: parseInt(req.params.id) }
    })

    res.json({ message: '政策通知删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})


module.exports = router