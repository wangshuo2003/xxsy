const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')
const multer = require('multer')
const path = require('path')

const router = express.Router()

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'coverImage') {
      cb(null, 'uploads/services/')
    } else if (file.fieldname === 'video') {
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
    const { page = 1, limit = 10, isActive, isHot, search, tags, eventType } = req.query
    const where = {}

    if (isActive !== undefined) where.isActive = isActive === 'true'
    if (isHot !== undefined) where.isHot = isHot === 'true'
    if (eventType) where.eventType = eventType
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { tags: { contains: search } },
        { location: { contains: search } }
      ]
    }
    if (tags) where.tags = { contains: tags }

    const services = await prisma.service.findMany({
      where,
      orderBy: [{ isHot: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        creator: { select: { name: true } },
        _count: { select: { orders: true } }
      }
    })

    const total = await prisma.service.count({ where })
    res.json({
      data: services,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 赛事活动专用接口
router.get('/events', async (req, res) => {
  try {
    const { page = 1, limit = 10, eventType, search, tags } = req.query
    const where = {
      isActive: true,
      eventType: { in: ['COMPETITION', 'STUDY_TOUR', 'SOCIAL_PRACTICE', 'PUBLIC_WELFARE'] }
    }

    if (eventType) where.eventType = eventType
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { tags: { contains: search } },
        { location: { contains: search } }
      ]
    }
    if (tags) where.tags = { contains: tags }

    const events = await prisma.service.findMany({
      where,
      orderBy: [{ isHot: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        creator: { select: { name: true } },
        _count: { select: { orders: true } }
      }
    })

    const total = await prisma.service.count({ where })
    res.json({
      data: events,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const service = await prisma.service.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        creator: { select: { name: true } },
        _count: { select: { orders: true } }
      }
    })
    if (!service) return res.status(404).json({ error: '服务项目不存在' })
    res.json({ data: service })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), [
  body('title').notEmpty().withMessage('标题不能为空'),
  body('description').notEmpty().withMessage('描述不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const {
      title,
      description,
      tags,
      price,
      maxPeople,
      endTime,
      isHot = false,
      eventType = 'SPECIAL_SERVICE',
      location,
      registerDeadline,
      eventRules,
      eventResults
    } = req.body

    const service = await prisma.service.create({
      data: {
        title,
        description,
        tags,
        coverImage: req.files.coverImage ? `/uploads/services/${req.files.coverImage[0].filename}` : null,
        videoUrl: req.files.video ? `/uploads/videos/${req.files.video[0].filename}` : null,
        fileUrl: req.files.file ? `/uploads/files/${req.files.file[0].filename}` : null,
        price: price ? parseFloat(price) : null,
        maxPeople: maxPeople ? parseInt(maxPeople) : null,
        endTime: endTime ? new Date(endTime) : null,
        isHot: isHot === 'true',
        eventType,
        location,
        registerDeadline: registerDeadline ? new Date(registerDeadline) : null,
        eventRules,
        eventResults,
        createdBy: req.user.id
      },
      include: {
        creator: { select: { name: true } },
        _count: { select: { orders: true } }
      }
    })
    res.status(201).json({ message: '服务项目创建成功', data: service })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), upload.fields([
  { name: 'coverImage', maxCount: 1 },
  { name: 'video', maxCount: 1 },
  { name: 'file', maxCount: 1 }
]), async (req, res) => {
  try {
    const service = await prisma.service.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!service) return res.status(404).json({ error: '服务项目不存在' })

    const {
      title,
      description,
      tags,
      price,
      maxPeople,
      endTime,
      isActive,
      isHot,
      eventType,
      location,
      registerDeadline,
      eventRules,
      eventResults
    } = req.body
    const updateData = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (tags !== undefined) updateData.tags = tags
    if (price !== undefined) updateData.price = parseFloat(price)
    if (maxPeople !== undefined) updateData.maxPeople = parseInt(maxPeople)
    if (endTime !== undefined) updateData.endTime = new Date(endTime)
    if (isActive !== undefined) updateData.isActive = isActive === 'true'
    if (isHot !== undefined) updateData.isHot = isHot === 'true'
    if (eventType !== undefined) updateData.eventType = eventType
    if (location !== undefined) updateData.location = location
    if (registerDeadline !== undefined) updateData.registerDeadline = new Date(registerDeadline)
    if (eventRules !== undefined) updateData.eventRules = eventRules
    if (eventResults !== undefined) updateData.eventResults = eventResults

    if (req.files.coverImage) updateData.coverImage = `/uploads/services/${req.files.coverImage[0].filename}`
    if (req.files.video) updateData.videoUrl = `/uploads/videos/${req.files.video[0].filename}`
    if (req.files.file) updateData.fileUrl = `/uploads/files/${req.files.file[0].filename}`

    const updatedService = await prisma.service.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        creator: { select: { name: true } },
        _count: { select: { orders: true } }
      }
    })
    res.json({ message: '服务项目更新成功', data: updatedService })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const service = await prisma.service.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!service) return res.status(404).json({ error: '服务项目不存在' })

    await prisma.service.update({
      where: { id: parseInt(req.params.id) },
      data: { isActive: false }
    })
    res.json({ message: '服务项目下架成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router