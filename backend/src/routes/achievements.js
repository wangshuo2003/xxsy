const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')
const multer = require('multer')
const path = require('path')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'video') {
      cb(null, 'uploads/videos/')
    } else if (file.fieldname === 'file') {
      cb(null, 'uploads/files/')
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } })

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, isDraft, search } = req.query
    const where = {}
    if (isDraft !== undefined) where.isDraft = isDraft === 'true'
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { tags: { contains: search } }
      ]
    }

    const achievements = await prisma.achievement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        creator: { select: { name: true } }
      }
    })

    const total = await prisma.achievement.count({ where })
    res.json({
      data: achievements,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const achievement = await prisma.achievement.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { creator: { select: { name: true } } }
    })
    if (!achievement) return res.status(404).json({ error: '成果展示不存在' })
    res.json({ data: achievement })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), [
  body('title').notEmpty().withMessage('标题不能为空'),
  body('content').notEmpty().withMessage('内容不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { title, content, tags, isDraft = false } = req.body
    const achievement = await prisma.achievement.create({
      data: {
        title, content, tags,
        videoUrl: req.files.video ? `/uploads/videos/${req.files.video[0].filename}` : null,
        fileUrl: req.files.file ? `/uploads/files/${req.files.file[0].filename}` : null,
        isDraft: isDraft === 'true',
        createdBy: req.user.id
      },
      include: { creator: { select: { name: true } } }
    })
    res.status(201).json({ message: '成果展示创建成功', data: achievement })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), async (req, res) => {
  try {
    const achievement = await prisma.achievement.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!achievement) return res.status(404).json({ error: '成果展示不存在' })

    const { title, content, tags, isDraft } = req.body
    const updateData = {}
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (tags !== undefined) updateData.tags = tags
    if (isDraft !== undefined) updateData.isDraft = isDraft === 'true'

    if (req.files.video) updateData.videoUrl = `/uploads/videos/${req.files.video[0].filename}`
    if (req.files.file) updateData.fileUrl = `/uploads/files/${req.files.file[0].filename}`

    const updatedAchievement = await prisma.achievement.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: { creator: { select: { name: true } } }
    })
    res.json({ message: '成果展示更新成功', data: updatedAchievement })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), async (req, res) => {
  try {
    const achievement = await prisma.achievement.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!achievement) return res.status(404).json({ error: '成果展示不存在' })

    await prisma.achievement.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: '成果展示删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router