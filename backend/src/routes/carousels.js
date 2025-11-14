const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const router = express.Router()

const carouselUploadDir = path.join(__dirname, '../../uploads/carousels')
const publicFileBaseUrl = process.env.FILE_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || ''

if (!fs.existsSync(carouselUploadDir)) {
  fs.mkdirSync(carouselUploadDir, { recursive: true })
}

const buildFileUrl = (req, filePath) => {
  if (!filePath) return ''
  if (/^https?:\/\//i.test(filePath)) {
    return filePath
  }

  const baseUrl = publicFileBaseUrl || `${req.protocol}://${req.get('host')}`
  const normalizedPath = filePath.startsWith('/') ? filePath : `/${filePath}`
  return `${baseUrl}${normalizedPath}`
}

const formatCarouselResponse = (req, carousel) => {
  if (!carousel) return carousel
  return {
    ...carousel,
    imageUrl: buildFileUrl(req, carousel.imageUrl)
  }
}

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(carouselUploadDir)) {
      fs.mkdirSync(carouselUploadDir, { recursive: true })
    }
    cb(null, carouselUploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('只允许上传图片文件'))
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
})

// 获取轮播图列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive } = req.query

    const where = {}
    if (isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    const carousels = await prisma.carousel.findMany({
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

    const total = await prisma.carousel.count({ where })

    const formattedCarousels = carousels.map((carousel) => formatCarouselResponse(req, carousel))

    res.json({
      data: formattedCarousels,
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

// 获取单个轮播图
router.get('/:id', async (req, res) => {
  try {
    const carousel = await prisma.carousel.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        creator: {
          select: { name: true }
        }
      }
    })

    if (!carousel) {
      return res.status(404).json({ error: '轮播图不存在' })
    }

    res.json({ data: formatCarouselResponse(req, carousel) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 创建轮播图
router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), upload.single('image'), [
  body('title').notEmpty().withMessage('标题不能为空'),
  body('linkUrl').optional({ checkFalsy: true }).isURL().withMessage('链接格式不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    if (!req.file) {
      return res.status(400).json({ error: '请上传图片' })
    }

    const { title, linkUrl, isActive = true } = req.body

    const carousel = await prisma.carousel.create({
      data: {
        title,
        imageUrl: `/uploads/carousels/${req.file.filename}`,
        linkUrl,
        isActive: isActive === 'true',
        createdBy: req.user.id
      },
      include: {
        creator: {
          select: { name: true }
        }
      }
    })

    const formattedCarousel = formatCarouselResponse(req, carousel)

    res.status(201).json({
      message: '轮播图创建成功',
      data: formattedCarousel
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 更新轮播图
router.put('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), upload.single('image'), [
  body('title').optional().notEmpty().withMessage('标题不能为空'),
  body('linkUrl').optional({ checkFalsy: true }).isURL().withMessage('链接格式不正确')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const carousel = await prisma.carousel.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!carousel) {
      return res.status(404).json({ error: '轮播图不存在' })
    }

    const { title, linkUrl, isActive } = req.body
    const updateData = {
      ...(title && { title }),
      ...(linkUrl !== undefined && { linkUrl }),
      ...(isActive !== undefined && { isActive: isActive === 'true' })
    }

    if (req.file) {
      updateData.imageUrl = `/uploads/carousels/${req.file.filename}`
    }

    const updatedCarousel = await prisma.carousel.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        creator: {
          select: { name: true }
        }
      }
    })

    const formattedCarousel = formatCarouselResponse(req, updatedCarousel)

    res.json({
      message: '轮播图更新成功',
      data: formattedCarousel
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 删除轮播图
router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), async (req, res) => {
  try {
    const carousel = await prisma.carousel.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!carousel) {
      return res.status(404).json({ error: '轮播图不存在' })
    }

    await prisma.carousel.delete({
      where: { id: parseInt(req.params.id) }
    })

    res.json({ message: '轮播图删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})


module.exports = router
