const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, isApproved, search, createdBy } = req.query
    const where = {}

    // 修复：确保where对象不为空
    if (isApproved !== undefined) {
      where.isApproved = isApproved === 'true'
    }
    if (createdBy !== undefined) {
      where.createdBy = parseInt(createdBy)
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { type: { contains: search } }
      ]
    }

    console.log('Bases API - where条件:', where)
    console.log('Bases API - 查询参数:', req.query)

    const bases = await prisma.base.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        admins: { select: { id: true, name: true, phone: true, username: true } },
        User_creator: { select: { name: true } }
      }
    })
    console.log('Bases API - 返回基地数据:', bases)

    const processedBases = bases.map(base => {
      return { ...base, admins: base.admins || [] }
    })

    const total = await prisma.base.count({ where })
    res.json({
      data: processedBases,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const base = await prisma.base.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        User_creator: { select: { name: true } },
        activities: {
          where: { isApproved: true },
          orderBy: { time: 'desc' },
          take: 10
        }
      }
    })
    if (!base) return res.status(404).json({ error: '基地不存在' })
    res.json({ data: base })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), [
  body('name').notEmpty().withMessage('基地名称不能为空'),
  body('type').notEmpty().withMessage('基地类型不能为空'),
  body('address').notEmpty().withMessage('地址不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { name, type, address, contact, description, isActive = true } = req.body

    // 根据用户角色设置不同的审批状态
    let isApproved = true
    let message = '基地创建成功'

    if (req.user.role === 'ACTIVITY_ADMIN') {
      // 活动管理员创建的基地自动设置为该基地的管理员，无需审核
      isApproved = true
      message = '基地创建成功'
    }

    const base = await prisma.base.create({
      data: {
        name, type, address, contact, description,
        isActive: isActive === 'true',
        isApproved: isApproved,
        createdBy: req.user.id,
        admins: {
          connect: [
            ...(req.body.managerIds || []).map(id => ({ id })),
            ...(req.user.role === 'ACTIVITY_ADMIN' ? [{ id: req.user.id }] : [])
          ]
        }
      },
      include: {
        admins: { select: { id: true, name: true, phone: true, username: true } },
        User_creator: { select: { name: true } }
      }
    })
    res.status(201).json({ message, data: base })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.post('/apply', authMiddleware, [
  body('name').notEmpty().withMessage('基地名称不能为空'),
  body('type').notEmpty().withMessage('基地类型不能为空'),
  body('address').notEmpty().withMessage('地址不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { name, type, address, contact, description } = req.body
    const base = await prisma.base.create({
      data: {
        name, type, address, contact, description,
        isActive: false,
        isApproved: false,
        createdBy: req.user.id
      },
      include: { User_creator: { select: { name: true } } }
    })
    res.status(201).json({ message: '基地申请提交成功', data: base })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/approve', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), [
  body('approved').isBoolean().withMessage('approved字段必须是布尔值'),
  body('rejectReason').optional()
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { approved, rejectReason } = req.body
    const base = await prisma.base.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!base) return res.status(404).json({ error: '基地不存在' })

    // 任何管理员都可以审核所有基地

    const updateData = { isApproved: approved }
    if (approved) {
      updateData.isActive = true
      updateData.rejectReason = null
    } else {
      updateData.rejectReason = rejectReason || '审核不通过'
    }

    const updatedBase = await prisma.base.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        User_creator: { select: { name: true } }
      }
    })

    const message = approved ? '基地审核通过' : '基地审核不通过'
    res.json({ message, data: updatedBase })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/manager', authMiddleware, roleMiddleware(['SUPER_ADMIN']), [
  body('managerIds').isArray().withMessage('管理员ID必须是数组')
], async (req, res) => {
  try {
    const { managerIds } = req.body
    console.log(`PUT /:id/manager - Received managerIds:`, managerIds)
    const base = await prisma.base.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!base) return res.status(404).json({ error: '基地不存在' })

    // 验证所有用户存在
    // 这里简化处理，直接尝试更新

    const updatedBase = await prisma.base.update({
      where: { id: parseInt(req.params.id) },
      data: {
        admins: {
          set: managerIds.map(id => ({ id: parseInt(id) }))
        }
      },
      include: {
        admins: { select: { id: true, name: true, phone: true, username: true } },
        User_creator: { select: { name: true } }
      }
    })
    res.json({ message: '基地管理员设置成功', data: updatedBase })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const base = await prisma.base.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!base) return res.status(404).json({ error: '基地不存在' })

    // 重新设计权限逻辑：所有管理员都可以编辑所有已通过基地
    if (!['SUPER_ADMIN', 'ACTIVITY_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' })
    }

    const { name, type, address, contact, description, isActive } = req.body
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type
    if (address !== undefined) updateData.address = address
    if (contact !== undefined) updateData.contact = contact
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    if (req.body.managerIds) {
      updateData.admins = {
        set: req.body.managerIds.map(id => ({ id: parseInt(id) }))
      }
    }

    const updatedBase = await prisma.base.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        admins: { select: { id: true, name: true, phone: true, username: true } },
        User_creator: { select: { name: true } }
      }
    })
    res.json({ message: '基地更新成功', data: updatedBase })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), async (req, res) => {
  try {
    const base = await prisma.base.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!base) return res.status(404).json({ error: '基地不存在' })

    await prisma.base.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: '基地删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router