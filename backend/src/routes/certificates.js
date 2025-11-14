const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// 获取当前用户的证书列表
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query
    const userId = req.user.id

    const certificates = await prisma.certificate.findMany({
      where: { userId },
      orderBy: { issueDate: 'desc' },
      skip: (page - 1) * parseInt(limit),
      take: parseInt(limit)
    })

    const total = await prisma.certificate.count({ where: { userId } })

    res.json({
      data: certificates,
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

// 获取单个证书详情
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const certificate = await prisma.certificate.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!certificate) {
      return res.status(404).json({ error: '证书不存在' })
    }

    // 确保用户只能查看自己的证书
    if (certificate.userId !== req.user.id && req.user.role === 'STUDENT') {
      return res.status(403).json({ error: '无权访问此证书' })
    }

    res.json({ data: certificate })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 创建证书（学生用户上传自己的证书）
router.post('/', authMiddleware, [
  body('title').notEmpty().withMessage('证书标题不能为空'),
  body('issuer').optional(),
  body('issueDate').optional().isISO8601().withMessage('日期格式不正确'),
  body('description').optional(),
  body('fileUrl').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const { title, issuer, issueDate, description, fileUrl } = req.body
    const userId = req.user.id

    const certificate = await prisma.certificate.create({
      data: {
        title,
        issuer,
        issueDate: issueDate ? new Date(issueDate) : null,
        description,
        fileUrl,
        userId
      }
    })

    res.status(201).json({ message: '证书创建成功', data: certificate })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 更新证书
router.put('/:id', authMiddleware, [
  body('title').optional().notEmpty().withMessage('证书标题不能为空'),
  body('issuer').optional(),
  body('issueDate').optional().isISO8601().withMessage('日期格式不正确'),
  body('description').optional(),
  body('fileUrl').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() })
    }

    const certificate = await prisma.certificate.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!certificate) {
      return res.status(404).json({ error: '证书不存在' })
    }

    // 确保用户只能编辑自己的证书
    if (certificate.userId !== req.user.id && req.user.role === 'STUDENT') {
      return res.status(403).json({ error: '无权修改此证书' })
    }

    const { title, issuer, issueDate, description, fileUrl } = req.body
    const updateData = {}

    if (title !== undefined) updateData.title = title
    if (issuer !== undefined) updateData.issuer = issuer
    if (issueDate !== undefined) updateData.issueDate = new Date(issueDate)
    if (description !== undefined) updateData.description = description
    if (fileUrl !== undefined) updateData.fileUrl = fileUrl

    const updatedCertificate = await prisma.certificate.update({
      where: { id: parseInt(req.params.id) },
      data: updateData
    })

    res.json({ message: '证书更新成功', data: updatedCertificate })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 删除证书
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const certificate = await prisma.certificate.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!certificate) {
      return res.status(404).json({ error: '证书不存在' })
    }

    // 确保用户只能删除自己的证书
    if (certificate.userId !== req.user.id && req.user.role === 'STUDENT') {
      return res.status(403).json({ error: '无权删除此证书' })
    }

    await prisma.certificate.delete({
      where: { id: parseInt(req.params.id) }
    })

    res.json({ message: '证书删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router
