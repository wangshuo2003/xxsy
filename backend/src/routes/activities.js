const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')

const router = express.Router()

// 获取活动列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, isApproved, baseId, search, type } = req.query
    const where = {}
    if (isApproved !== undefined) where.isApproved = isApproved === 'true'
    if (baseId) where.baseId = parseInt(baseId)
    if (type) where.type = type
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { type: { contains: search } }
      ]
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        base: { select: { name: true } },
        _count: {
          select: {
            users: true
          }
        }
      }
    })

    const total = await prisma.activity.count({ where })
    res.json({
      data: activities,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取我的活动（管理员） - 必须放在 /:id 路由之前
router.get('/my-activities', authMiddleware, roleMiddleware(['ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query
    const where = {}

    // 管理员可以看到所有已通过的活动
    // 因为他们可以为任何基地创建活动
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { type: { contains: search } }
      ]
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        base: { select: { name: true } }
      }
    })

    const total = await prisma.activity.count({ where })
    res.json({
      data: activities,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取用户报名的活动 - 必须放在 /:id 路由之前
router.get('/my-registrations', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query
    const where = { userId: req.user.id }

    if (status) {
      where.status = status
    }

    const registrations = await prisma.userActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        activity: {
          include: {
            base: { select: { name: true } },
            _count: {
              select: {
                users: true
              }
            }
          }
        }
      }
    })

    // 获取相关的订单信息
    const activityIds = registrations.map(reg => reg.activityId)
    const orders = await prisma.order.findMany({
      where: {
        userId: req.user.id,
        activityId: { in: activityIds },
        status: { in: ['PENDING', 'PAID'] }
      },
      select: {
        id: true,
        activityId: true,
        status: true,
        amount: true,
        createdAt: true
      }
    })

    // 创建订单映射，方便查找
    const orderMap = {}
    orders.forEach(order => {
      orderMap[order.activityId] = order
    })

    const total = await prisma.userActivity.count({ where })

    // 转换数据格式，将活动信息提取出来并添加报名状态和订单信息
    const data = registrations.map(reg => {
      const order = orderMap[reg.activityId]
      return {
        ...reg.activity,
        registrationStatus: reg.status,
        registrationId: reg.id,
        registeredAt: reg.createdAt,
        order: order || null
      }
    })

    res.json({
      data,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取用户提交的活动（非管理员创建的活动） - 必须放在 /:id 路由之前
router.get('/user-submitted', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query
    const skip = (page - 1) * limit

    // 构建查询条件 - 获取用户提交的活动（排除管理员创建的活动）
    const where = {}

    // 状态过滤
    if (status) {
      if (status === 'pending') {
        where.isApproved = false
        where.rejectReason = null
      } else if (status === 'approved') {
        where.isApproved = true
      } else if (status === 'rejected') {
        where.rejectReason = { not: null }
      }
    }

    // 搜索条件
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { type: { contains: search } },
        { location: { contains: search } },
        { creator: { name: { contains: search } } }
      ]
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: parseInt(limit),
        include: {
          base: { select: { name: true } },
          creator: { select: { name: true, phone: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.activity.count({ where })
    ])

    res.json({
      data: activities,
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

// 获取活动统计信息 - 必须放在 /:id 路由之前
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    let where = {}

    // 基地管理员可以看到所有活动的统计信息
    // 因为他们可以为任何基地创建活动

    const total = await prisma.activity.count({ where })
    const approved = await prisma.activity.count({ where: { ...where, isApproved: true } })
    const pending = await prisma.activity.count({ where: { ...where, isApproved: false, rejectReason: null } })
    const rejected = await prisma.activity.count({ where: { ...where, rejectReason: { not: null } } })
    const active = await prisma.activity.count({ where: { ...where, isApproved: true, isActive: true } })

    res.json({
      data: {
        total,
        approved,
        pending,
        rejected,
        active
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取单个活动详情
router.get('/:id', async (req, res) => {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        base: { select: { name: true, address: true } },
        _count: {
          select: {
            users: {
              where: {
                status: 'APPROVED'
              }
            }
          }
        }
      }
    })
    if (!activity) return res.status(404).json({ error: '活动不存在' })
    res.json({ data: activity })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 创建活动
router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), [
  body('name').notEmpty().withMessage('活动名称不能为空'),
  body('type').notEmpty().withMessage('活动类型不能为空'),
  body('time').notEmpty().withMessage('活动时间不能为空'),
  body('location').notEmpty().withMessage('活动地点不能为空'),
  body('baseId').notEmpty().withMessage('基地ID不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { name, type, description, time, location, maxPeople, baseId, price } = req.body

    // 任何管理员都可以为任何已通过的基地创建活动
    // 不再限制基地管理员只能为自己管理的基地创建活动

    const activity = await prisma.activity.create({
      data: {
        name, type, description,
        time: new Date(time),
        location,
        maxPeople: maxPeople ? parseInt(maxPeople) : null,
        baseId: parseInt(baseId),
        price: price ? parseFloat(price) : 0, // 设置价格，默认为0
        isApproved: true, // 所有管理员创建的活动都自动通过审核
        isActive: true,
        createdBy: req.user.id
      },
      include: {
        base: { select: { name: true } }
      }
    })
    res.status(201).json({ message: '活动创建成功', data: activity })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 更新活动
router.put('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), [
  body('name').optional().notEmpty().withMessage('活动名称不能为空'),
  body('type').optional().notEmpty().withMessage('活动类型不能为空'),
  body('time').optional().notEmpty().withMessage('活动时间不能为空'),
  body('location').optional().notEmpty().withMessage('活动地点不能为空'),
  body('baseId').optional().notEmpty().withMessage('基地ID不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const activity = await prisma.activity.findUnique({
      where: { id: parseInt(req.params.id) }
    })
    if (!activity) return res.status(404).json({ error: '活动不存在' })

    const { name, type, description, time, location, maxPeople, baseId, isActive, price } = req.body

    // 任何管理员都可以更新任何活动
    // 不再限制基地管理员只能更新自己创建的活动

    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (type !== undefined) updateData.type = type
    if (description !== undefined) updateData.description = description
    if (time !== undefined) updateData.time = new Date(time)
    if (location !== undefined) updateData.location = location
    if (maxPeople !== undefined) updateData.maxPeople = maxPeople ? parseInt(maxPeople) : null
    if (baseId !== undefined) updateData.baseId = parseInt(baseId)
    if (isActive !== undefined) updateData.isActive = isActive
    if (price !== undefined) updateData.price = parseFloat(price)

    const updatedActivity = await prisma.activity.update({
      where: { id: parseInt(req.params.id) },
      data: updateData,
      include: {
        base: { select: { name: true } }
      }
    })

    res.json({ message: '活动更新成功', data: updatedActivity })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 删除活动
router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id)
    const activity = await prisma.activity.findUnique({ where: { id: activityId } })
    if (!activity) return res.status(404).json({ error: '活动不存在' })

    await prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: { activityId },
        select: { id: true }
      })
      const orderIds = orders.map(order => order.id)

      if (orderIds.length > 0) {
        await tx.balanceTransaction.deleteMany({
          where: { orderId: { in: orderIds } }
        })
        await tx.refund.deleteMany({
          where: { orderId: { in: orderIds } }
        })
        await tx.order.deleteMany({
          where: { id: { in: orderIds } }
        })
      }

      await tx.userActivity.deleteMany({
        where: { activityId }
      })

      await tx.activity.delete({
        where: { id: activityId }
      })
    })

    res.json({ message: '活动删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 审核活动
router.put('/:id/approve', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activity = await prisma.activity.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!activity) return res.status(404).json({ error: '活动不存在' })

    const { approved, rejectReason } = req.body
    const updatedActivity = await prisma.activity.update({
      where: { id: parseInt(req.params.id) },
      data: {
        isApproved: approved,
        rejectReason: approved ? null : rejectReason
      },
      include: {
        base: { select: { name: true } }
      }
    })
    res.json({ message: approved ? '活动审核通过' : '活动审核拒绝', data: updatedActivity })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 活动报名
router.post('/:id/register', authMiddleware, async (req, res) => {
  try {
    const activity = await prisma.activity.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!activity) return res.status(404).json({ error: '活动不存在' })
    if (!activity.isApproved) return res.status(400).json({ error: '活动未通过审核' })

    const existingRegistration = await prisma.userActivity.findUnique({
      where: {
        userId_activityId: {
          userId: req.user.id,
          activityId: parseInt(req.params.id)
        }
      }
    })
    if (existingRegistration) return res.status(400).json({ error: '已报名该活动' })

    if (activity.maxPeople) {
      const currentCount = await prisma.userActivity.count({
        where: { activityId: parseInt(req.params.id), status: 'APPROVED' }
      })
      if (currentCount >= activity.maxPeople) {
        return res.status(400).json({ error: '活动人数已满' })
      }
    }

    const registration = await prisma.userActivity.create({
      data: {
        userId: req.user.id,
        activityId: parseInt(req.params.id),
        status: activity.price && activity.price > 0 ? 'REGISTERED' : 'APPROVED' // 免费活动自动通过
      }
    })

    // 为活动创建对应的订单
    const orderNo = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 9)
    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: req.user.id,
        activityId: parseInt(req.params.id),
        amount: activity.price || 0, // 使用活动价格，默认为0
        status: activity.price && activity.price > 0 ? 'PENDING' : 'PAID' // 如果有费用且大于0，设为待支付；否则直接设为已支付
      },
      include: {
        activity: { select: { id: true, name: true, price: true } }
      }
    })

    res.status(201).json({
      message: '报名成功',
      data: { registration, order },
      needsPayment: order.status === 'PENDING'
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 取消活动报名
router.delete('/:id/register', authMiddleware, async (req, res) => {
  try {
    const activity = await prisma.activity.findUnique({ where: { id: parseInt(req.params.id) } })
    if (!activity) return res.status(404).json({ error: '活动不存在' })

    const existingRegistration = await prisma.userActivity.findUnique({
      where: {
        userId_activityId: {
          userId: req.user.id,
          activityId: parseInt(req.params.id)
        }
      }
    })

    if (!existingRegistration) {
      return res.status(400).json({ error: '未报名该活动' })
    }

    // 如果报名已经通过审核，可能不允许取消
    // 这里根据需求决定是否允许取消已通过的报名
    // if (existingRegistration.status === 'APPROVED') {
    //   return res.status(400).json({ error: '已通过审核的报名无法取消' })
    // }

    // 删除对应的订单（如果存在）
    await prisma.order.deleteMany({
      where: {
        userId: req.user.id,
        activityId: parseInt(req.params.id)
      }
    })

    await prisma.userActivity.delete({
      where: {
        userId_activityId: {
          userId: req.user.id,
          activityId: parseInt(req.params.id)
        }
      }
    })

    res.json({ message: '取消报名成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 提交审核
router.put('/:id/submit', authMiddleware, roleMiddleware(['ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { base: true }
    })

    if (!activity) return res.status(404).json({ error: '活动不存在' })
    if (activity.isApproved) return res.status(400).json({ error: '活动已通过审核' })
    // 任何管理员都可以查看任何活动的报名列表

    const updatedActivity = await prisma.activity.update({
      where: { id: parseInt(req.params.id) },
      data: { isApproved: false, rejectReason: null },
      include: {
        base: { select: { name: true } }
      }
    })

    res.json({ message: '提交审核成功', data: updatedActivity })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取活动报名列表
router.get('/:id/registrations', authMiddleware, async (req, res) => {
  try {
    const activityId = parseInt(req.params.id)
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        base: { select: { managerId: true } }
      }
    })

    if (!activity) return res.status(404).json({ error: '活动不存在' })

    const allowedRoles = ['SUPER_ADMIN', 'ADMIN', 'BASE_ADMIN']
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' })
    }

    if (req.user.role === 'BASE_ADMIN') {
      const managerId = activity.base?.managerId
      if (managerId && managerId !== req.user.id) {
        return res.status(403).json({ error: '您无权查看该活动报名信息' })
      }
    }

    const registrations = await prisma.userActivity.findMany({
      where: { activityId },
      include: {
        user: {
          select: { id: true, username: true, name: true, phone: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const userIds = registrations.map(reg => reg.userId)
    const orderMap = new Map()

    if (userIds.length) {
      const orders = await prisma.order.findMany({
        where: {
          activityId,
          userId: { in: userIds }
        },
        orderBy: { createdAt: 'desc' }
      })

      for (const order of orders) {
        if (!orderMap.has(order.userId)) {
          orderMap.set(order.userId, order)
        }
      }
    }

    const data = registrations.map(registration => {
      const order = orderMap.get(registration.userId)
      return {
        id: registration.id,
        status: registration.status,
        adminNote: registration.adminNote,
        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt,
        user: registration.user,
        order: order
          ? {
              id: order.id,
              orderNo: order.orderNo,
              amount: order.amount,
              status: order.status,
              paymentMethod: order.paymentMethod,
              couponCode: order.couponCode,
              baseCouponId: order.baseCouponId,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              paymentTime: order.status === 'PAID' ? order.updatedAt : null,
              userNote: order.userNote,
              adminNote: order.adminNote
            }
          : null
      }
    })

    res.json({ data })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 审核通过报名
router.put('/activity-registrations/:id/approve', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const { adminNote } = req.body

    const registration = await prisma.userActivity.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: 'APPROVED',
        adminNote: adminNote || '审核通过'
      },
      include: {
        user: { select: { name: true, school: true, phone: true } },
        activity: { select: { name: true } }
      }
    })

    res.json({ message: '审核通过成功', registration })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 审核拒绝报名
router.put('/activity-registrations/:id/reject', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const { adminNote } = req.body

    if (!adminNote || adminNote.trim() === '') {
      return res.status(400).json({ error: '拒绝原因不能为空' })
    }

    const registration = await prisma.userActivity.update({
      where: { id: parseInt(req.params.id) },
      data: {
        status: 'REJECTED',
        adminNote: adminNote.trim()
      },
      include: {
        user: { select: { name: true, school: true, phone: true } },
        activity: { select: { name: true } }
      }
    })

    res.json({ message: '审核拒绝成功', registration })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 添加备注
router.put('/activity-registrations/:id/note', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const { adminNote } = req.body

    if (!adminNote || adminNote.trim() === '') {
      return res.status(400).json({ error: '备注内容不能为空' })
    }

    const registration = await prisma.userActivity.update({
      where: { id: parseInt(req.params.id) },
      data: {
        adminNote: adminNote.trim()
      },
      include: {
        user: { select: { name: true, school: true, phone: true } },
        activity: { select: { name: true } }
      }
    })

    res.json({ message: '备注添加成功', registration })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 删除活动
router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activity = await prisma.activity.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { base: true }
    })

    if (!activity) return res.status(404).json({ error: '活动不存在' })

    // 任何管理员都可以删除任何活动
    // 不再限制已通过审核的活动不能删除

    await prisma.activity.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ message: '活动删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router
