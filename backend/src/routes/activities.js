const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')

const router = express.Router()

// 获取活动列表
router.get('/', async (req, res) => {
  try {
    const { isApproved, isActive, baseId, search, type } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);

    const where = {};
    if (isApproved !== undefined) where.isApproved = (isApproved === 'true' || isApproved === '1');
    if (isActive !== undefined) where.isActive = (isActive === 'true' || isActive === '1');
    if (baseId) where.baseId = parseInt(baseId);
    if (type) where.type = { contains: type };
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { type: { contains: search } }
      ];
    }

    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
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
    const { search } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const where = {};

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
      take: limit,
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
    const { status } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const where = { userId: req.user.id };

    if (status) {
      where.status = status
    }

    const registrations = await prisma.userActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
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
        status: { in: ['PENDING', 'PAID', 'REFUNDING', 'REFUNDED'] }
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
    const { search, status } = req.query;
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const skip = (page - 1) * limit;

    // 构建查询条件 - 获取用户提交的活动（排除管理员创建的活动）
    const where = {};

    // 状态过滤
    if (status) {
      if (status === 'pending') {
        where.isApproved = false;
        where.rejectReason = null;
      } else if (status === 'approved') {
        where.isApproved = true;
      } else if (status === 'rejected') {
        where.rejectReason = { not: null };
      }
    }

    // 搜索条件
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { type: { contains: search } },
        { location: { contains: search } },
        { creator: { name: { contains: search } } }
      ];
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip,
        take: limit,
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

// 获取用户活动成果展示
router.get('/my-achievements', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取用户参与的所有活动及其成绩、奖项信息
    const userActivities = await prisma.userActivity.findMany({
      where: {
        userId,
        status: 'APPROVED' // 只显示已通过审核的报名
      },
      include: {
        activity: {
          select: {
            id: true,
            name: true,
            type: true,
            time: true,
            location: true,
            isActive: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // 获取这些活动的成绩信息
    const activityIds = userActivities.map(ua => ua.activityId);
    const userScores = await prisma.userActivityScore.findMany({
      where: {
        userId,
        activityId: {
          in: activityIds
        }
      }
    });

    // 获取用户的奖项记录
    const awardRecords = await prisma.awardRecord.findMany({
      where: { userId },
      include: {
        award: {
          select: {
            id: true,
            name: true,
            description: true,
            priority: true
          }
        },
        activity: {
          select: {
            id: true,
            name: true,
            type: true,
            time: true,
            isActive: true
          }
        }
      },
      orderBy: {
        issuedAt: 'desc'
      }
    });

    // 构建响应数据
    const achievements = userActivities.map(userActivity => {
      const scoreRecord = userScores.find(score => score.activityId === userActivity.activity.id);
      const scores = scoreRecord || { score: 0, rank: null, isFinal: false };
      const activityAwards = awardRecords.filter(record => record.activityId === userActivity.activity.id);

      // 判断活动状态
      let awardStatus = 'pending';
      if (!userActivity.activity.isActive) {
        // 活动已结束
        if (activityAwards.length > 0) {
          awardStatus = 'issued';
        } else if (scores.isFinal) {
          awardStatus = 'settled';
        } else {
          awardStatus = 'pending_settlement';
        }
      }

      return {
        activity: {
          id: userActivity.activity.id,
          name: userActivity.activity.name,
          type: userActivity.activity.type,
          time: userActivity.activity.time,
          location: userActivity.activity.location,
          isActive: userActivity.activity.isActive
        },
        score: scores.score,
        rank: scores.rank,
        awards: activityAwards.map(record => ({
          id: record.award.id,
          name: record.award.name,
          description: record.award.description,
          priority: record.award.priority,
          type: record.awardType,
          issuedAt: record.issuedAt
        })),
        awardStatus,
        isFinal: scores.isFinal
      };
    });

    res.json({
      data: achievements,
      total: achievements.length
    });
  } catch (error) {
    console.error('获取用户活动成果失败:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: '服务器错误', details: error.message });
  }
});

// 获取单个活动详情
router.get('/:id', async (req, res) => {
  try {
    console.log('获取单个活动详情, id:', req.params.id);
    if (!req.params.id) {
      return res.status(400).json({ error: '活动ID不能为空' });
    }
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
    if (existingRegistration) {
      // 允许已退款或已取消的订单重新报名：删除旧报名记录
      const latestOrder = await prisma.order.findFirst({
        where: {
          userId: req.user.id,
          activityId: parseInt(req.params.id)
        },
        orderBy: { createdAt: 'desc' }
      })

      if (latestOrder && ['REFUNDED', 'CANCELLED'].includes(latestOrder.status)) {
        await prisma.userActivity.delete({
          where: {
            userId_activityId: {
              userId: req.user.id,
              activityId: parseInt(req.params.id)
            }
          }
        })
      } else {
        return res.status(400).json({ error: '已报名该活动' })
      }
    }

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
        base: { 
          select: { 
            createdBy: true,
            admins: { select: { id: true } }
          } 
        }
      }
    })

    if (!activity) return res.status(404).json({ error: '活动不存在' })

    const allowedRoles = ['SUPER_ADMIN', 'ACTIVITY_ADMIN']
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' })
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

// 获取单个活动成果详情
router.get('/:id/achievement', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const activityId = parseInt(req.params.id);

    // 检查用户是否参与了该活动
    const userActivity = await prisma.userActivity.findUnique({
      where: {
        userId_activityId: {
          userId,
          activityId
        }
      },
      include: {
        activity: {
          select: {
            id: true,
            name: true,
            type: true,
            time: true,
            location: true,
            isActive: true,
            description: true
          }
        }
      }
    });

    // 获取用户的成绩信息
    const userScore = await prisma.userActivityScore.findUnique({
      where: {
        userId_activityId: {
          userId,
          activityId
        }
      }
    });

    if (!userActivity) {
      return res.status(404).json({ error: '未找到该活动的参与记录' });
    }

    // 获取该活动的所有奖项记录
    const awardRecords = await prisma.awardRecord.findMany({
      where: {
        userId,
        activityId
      },
      include: {
        award: {
          select: {
            id: true,
            name: true,
            description: true,
            priority: true
          }
        },
        issuer: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        issuedAt: 'desc'
      }
    });

    const scores = userScore || { score: 0, rank: null, isFinal: false };

    // 判断活动状态
    let awardStatus = 'pending';
    if (!userActivity.activity.isActive) {
      // 活动已结束
      if (awardRecords.length > 0) {
        awardStatus = 'issued';
      } else if (scores.isFinal) {
        awardStatus = 'pending_settlement';
      } else {
        awardStatus = 'pending_settlement';
      }
    }

    res.json({
      data: {
        activity: {
          id: userActivity.activity.id,
          name: userActivity.activity.name,
          type: userActivity.activity.type,
          time: userActivity.activity.time,
          location: userActivity.activity.location,
          description: userActivity.activity.description,
          isActive: userActivity.activity.isActive
        },
        participation: {
          status: userActivity.status,
          createdAt: userActivity.createdAt
        },
        score: scores.score,
        rank: scores.rank,
        awards: awardRecords.map(record => ({
          id: record.award.id,
          name: record.award.name,
          description: record.award.description,
          priority: record.award.priority,
          type: record.awardType,
          issuedAt: record.issuedAt,
          issuedBy: record.issuer?.name || null
        })),
        awardStatus,
        isFinal: scores.isFinal
      }
    });
  } catch (error) {
    console.error('获取活动成果详情失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取活动奖项列表
router.get('/:id/awards', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);

    // 检查活动是否存在
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, name: true }
    });

    if (!activity) {
      return res.status(404).json({ error: '活动不存在' });
    }

    const awards = await prisma.activityAward.findMany({
      where: {
        activityId,
        isActive: true
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' }
      ]
    });

    res.json({ data: awards });
  } catch (error) {
    console.error('获取活动奖项失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建活动奖项
router.post('/:id/awards', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const { name, description, priority = 0 } = req.body;

    // 验证输入
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '奖项名称不能为空' });
    }

    if (name.length > 50) {
      return res.status(400).json({ error: '奖项名称不能超过50个字符' });
    }

    if (description && description.length > 200) {
      return res.status(400).json({ error: '奖项描述不能超过200个字符' });
    }

    // 检查活动是否存在
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, name: true }
    });

    if (!activity) {
      return res.status(404).json({ error: '活动不存在' });
    }

    // 创建奖项
    const award = await prisma.activityAward.create({
      data: {
        activityId,
        name: name.trim(),
        description: description?.trim() || null,
        priority: parseInt(priority) || 0,
        isActive: true
      }
    });

    res.status(201).json({
      message: '奖项创建成功',
      data: award
    });
  } catch (error) {
    console.error('创建活动奖项失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新活动奖项
router.put('/:id/awards/:awardId', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const awardId = parseInt(req.params.awardId);
    const { name, description, priority = 0, isActive } = req.body;

    // 验证输入
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '奖项名称不能为空' });
    }

    if (name.length > 50) {
      return res.status(400).json({ error: '奖项名称不能超过50个字符' });
    }

    if (description && description.length > 200) {
      return res.status(400).json({ error: '奖项描述不能超过200个字符' });
    }

    // 检查奖项是否存在
    const existingAward = await prisma.activityAward.findFirst({
      where: {
        id: awardId,
        activityId
      }
    });

    if (!existingAward) {
      return res.status(404).json({ error: '奖项不存在' });
    }

    // 更新奖项
    const award = await prisma.activityAward.update({
      where: { id: awardId },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        priority: parseInt(priority) || 0,
        isActive: isActive !== undefined ? Boolean(isActive) : existingAward.isActive
      }
    });

    res.json({
      message: '奖项更新成功',
      data: award
    });
  } catch (error) {
    console.error('更新活动奖项失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除活动奖项
router.delete('/:id/awards/:awardId', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const awardId = parseInt(req.params.awardId);

    // 检查奖项是否存在
    const existingAward = await prisma.activityAward.findFirst({
      where: {
        id: awardId,
        activityId
      }
    });

    if (!existingAward) {
      return res.status(404).json({ error: '奖项不存在' });
    }

    // 删除奖项（软删除，将isActive设为false）
    await prisma.activityAward.update({
      where: { id: awardId },
      data: { isActive: false }
    });

    res.json({ message: '奖项删除成功' });
  } catch (error) {
    console.error('删除活动奖项失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取活动发奖规则列表
router.get('/:id/award-rules', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);

    // 检查活动是否存在
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, name: true }
    });

    if (!activity) {
      return res.status(404).json({ error: '活动不存在' });
    }

    const rules = await prisma.awardRule.findMany({
      where: {
        award: {
          activityId,
          isActive: true
        },
        isActive: true
      },
      include: {
        award: {
          select: {
            id: true,
            name: true,
            priority: true
          }
        }
      },
      orderBy: [
        { award: { priority: 'desc' } },
        { createdAt: 'asc' }
      ]
    });

    res.json({ data: rules });
  } catch (error) {
    console.error('获取发奖规则失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建发奖规则
router.post('/:id/award-rules', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const { awardId, ruleType, minScore, maxScore, minRank, maxRank } = req.body;

    // 验证输入
    if (!awardId) {
      return res.status(400).json({ error: '奖项ID不能为空' });
    }

    if (!ruleType || !['SCORE_RANGE', 'RANK_RANGE'].includes(ruleType)) {
      return res.status(400).json({ error: '规则类型无效' });
    }

    // 检查奖项是否属于该活动且有效
    const award = await prisma.activityAward.findFirst({
      where: {
        id: awardId,
        activityId,
        isActive: true
      }
    });

    if (!award) {
      return res.status(404).json({ error: '奖项不存在或已禁用' });
    }

    // 验证规则参数
    if (ruleType === 'SCORE_RANGE') {
      if (minScore === undefined || maxScore === undefined) {
        return res.status(400).json({ error: '分数范围规则需要指定最小和最大分数' });
      }
      if (minScore > maxScore) {
        return res.status(400).json({ error: '最小分数不能大于最大分数' });
      }
      if (minScore < 0 || maxScore < 0) {
        return res.status(400).json({ error: '分数不能为负数' });
      }
    } else if (ruleType === 'RANK_RANGE') {
      if (minRank === undefined || maxRank === undefined) {
        return res.status(400).json({ error: '排名范围规则需要指定最小和最大排名' });
      }
      if (minRank > maxRank) {
        return res.status(400).json({ error: '最小排名不能大于最大排名' });
      }
      if (minRank < 1 || maxRank < 1) {
        return res.status(400).json({ error: '排名必须为正整数' });
      }
    }

    // 创建规则
    const rule = await prisma.awardRule.create({
      data: {
        awardId,
        ruleType,
        minScore: ruleType === 'SCORE_RANGE' ? parseInt(minScore) : null,
        maxScore: ruleType === 'SCORE_RANGE' ? parseInt(maxScore) : null,
        minRank: ruleType === 'RANK_RANGE' ? parseInt(minRank) : null,
        maxRank: ruleType === 'RANK_RANGE' ? parseInt(maxRank) : null,
        isActive: true
      },
      include: {
        award: {
          select: {
            id: true,
            name: true,
            priority: true
          }
        }
      }
    });

    res.status(201).json({
      message: '发奖规则创建成功',
      data: rule
    });
  } catch (error) {
    console.error('创建发奖规则失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新发奖规则
router.put('/:id/award-rules/:ruleId', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const ruleId = parseInt(req.params.ruleId);
    const { awardId, ruleType, minScore, maxScore, minRank, maxRank, isActive } = req.body;

    // 检查规则是否存在且属于该活动
    const existingRule = await prisma.awardRule.findFirst({
      where: {
        id: ruleId,
        award: {
          activityId
        }
      },
      include: {
        award: true
      }
    });

    if (!existingRule) {
      return res.status(404).json({ error: '发奖规则不存在' });
    }

    // 如果更换了奖项，检查新奖项是否有效
    if (awardId && awardId !== existingRule.awardId) {
      const newAward = await prisma.activityAward.findFirst({
        where: {
          id: awardId,
          activityId,
          isActive: true
        }
      });

      if (!newAward) {
        return res.status(404).json({ error: '新奖项不存在或已禁用' });
      }
    }

    // 验证规则参数
    const finalRuleType = ruleType || existingRule.ruleType;

    if (finalRuleType === 'SCORE_RANGE') {
      const finalMinScore = minScore !== undefined ? parseInt(minScore) : existingRule.minScore;
      const finalMaxScore = maxScore !== undefined ? parseInt(maxScore) : existingRule.maxScore;

      if (finalMinScore > finalMaxScore) {
        return res.status(400).json({ error: '最小分数不能大于最大分数' });
      }
      if (finalMinScore < 0 || finalMaxScore < 0) {
        return res.status(400).json({ error: '分数不能为负数' });
      }
    } else if (finalRuleType === 'RANK_RANGE') {
      const finalMinRank = minRank !== undefined ? parseInt(minRank) : existingRule.minRank;
      const finalMaxRank = maxRank !== undefined ? parseInt(maxRank) : existingRule.maxRank;

      if (finalMinRank > finalMaxRank) {
        return res.status(400).json({ error: '最小排名不能大于最大排名' });
      }
      if (finalMinRank < 1 || finalMaxRank < 1) {
        return res.status(400).json({ error: '排名必须为正整数' });
      }
    }

    // 更新规则
    const rule = await prisma.awardRule.update({
      where: { id: ruleId },
      data: {
        awardId: awardId || existingRule.awardId,
        ruleType: finalRuleType,
        minScore: finalRuleType === 'SCORE_RANGE' ? (minScore !== undefined ? parseInt(minScore) : existingRule.minScore) : null,
        maxScore: finalRuleType === 'SCORE_RANGE' ? (maxScore !== undefined ? parseInt(maxScore) : existingRule.maxScore) : null,
        minRank: finalRuleType === 'RANK_RANGE' ? (minRank !== undefined ? parseInt(minRank) : existingRule.minRank) : null,
        maxRank: finalRuleType === 'RANK_RANGE' ? (maxRank !== undefined ? parseInt(maxRank) : existingRule.maxRank) : null,
        isActive: isActive !== undefined ? Boolean(isActive) : existingRule.isActive
      },
      include: {
        award: {
          select: {
            id: true,
            name: true,
            priority: true
          }
        }
      }
    });

    res.json({
      message: '发奖规则更新成功',
      data: rule
    });
  } catch (error) {
    console.error('更新发奖规则失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除发奖规则
router.delete('/:id/award-rules/:ruleId', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const ruleId = parseInt(req.params.ruleId);

    // 检查规则是否存在且属于该活动
    const existingRule = await prisma.awardRule.findFirst({
      where: {
        id: ruleId,
        award: {
          activityId
        }
      }
    });

    if (!existingRule) {
      return res.status(404).json({ error: '发奖规则不存在' });
    }

    // 软删除规则（将isActive设为false）
    await prisma.awardRule.update({
      where: { id: ruleId },
      data: { isActive: false }
    });

    res.json({ message: '发奖规则删除成功' });
  } catch (error) {
    console.error('删除发奖规则失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 自动发奖
router.post('/:id/auto-award', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);

    // 检查活动是否存在
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        name: true,
        isActive: true,
        _count: {
          select: {
            users: {
              where: { status: 'APPROVED' }
            }
          }
        }
      }
    });

    if (!activity) {
      return res.status(404).json({ error: '活动不存在' });
    }

    if (activity.isActive) {
      return res.status(400).json({ error: '活动还未结束，不能发奖' });
    }

    const participantCount = activity._count.users;
    if (participantCount === 0) {
      return res.status(400).json({ error: '该活动没有参与者' });
    }

    // 获取所有已批准的参与者
    const participants = await prisma.userActivity.findMany({
      where: {
        activityId,
        status: 'APPROVED'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // 获取所有参与者的成绩
    const participantUserIds = participants.map(p => p.userId);
    const userScores = await prisma.userActivityScore.findMany({
      where: {
        activityId,
        userId: { in: participantUserIds }
      },
      select: {
        userId: true,
        score: true,
        rank: true,
        isFinal: true
      }
    });
    
    // 创建成绩映射
    const scoreMap = new Map();
    for (const score of userScores) {
      scoreMap.set(score.userId, score);
    }

    // 获取活动的所有发奖规则
    const rules = await prisma.awardRule.findMany({
      where: {
        award: {
          activityId,
          isActive: true
        },
        isActive: true
      },
      include: {
        award: {
          select: {
            id: true,
            name: true,
            priority: true
          }
        }
      },
      orderBy: [
        { award: { priority: 'desc' } },
        { createdAt: 'asc' }
      ]
    });

    if (rules.length === 0) {
      return res.status(400).json({ error: '该活动没有配置发奖规则' });
    }

    // 获取已存在的获奖记录，避免重复发奖
    const existingAwardRecords = await prisma.awardRecord.findMany({
      where: {
        activityId,
        awardType: 'AUTOMATIC'
      },
      select: {
        userId: true,
        awardId: true
      }
    });

    const existingAwardsSet = new Set(
      existingAwardRecords.map(record => `${record.userId}-${record.awardId}`)
    );

    let awardCount = 0;
    const awardRecords = [];

    // 为每个参与者匹配奖项
    for (const participant of participants) {
      const userScore = scoreMap.get(participant.userId);
      const score = userScore?.score || 0;
      const rank = userScore?.rank;

      for (const rule of rules) {
        let shouldAward = false;

        if (rule.ruleType === 'SCORE_RANGE') {
          shouldAward = score >= rule.minScore && score <= rule.maxScore;
        } else if (rule.ruleType === 'RANK_RANGE' && rank) {
          shouldAward = rank >= rule.minRank && rank <= rule.maxRank;
        }

        if (shouldAward) {
          const awardKey = `${participant.userId}-${rule.awardId}`;

          // 检查是否已经获得该奖项
          if (!existingAwardsSet.has(awardKey)) {
            awardRecords.push({
              userId: participant.userId,
              activityId,
              awardId: rule.awardId,
              awardType: 'AUTOMATIC',
              issuedBy: req.user.id,
              issuedAt: new Date()
            });

            existingAwardsSet.add(awardKey);
            awardCount++;
          }

          // 由于奖项按优先级排序，只匹配最高优先级的奖项
          break;
        }
      }
    }

    // 批量创建获奖记录
    if (awardRecords.length > 0) {
      await prisma.awardRecord.createMany({
        data: awardRecords
      });
    }

    res.json({
      message: '自动发奖完成',
      data: {
        totalParticipants: participants.length,
        awardedCount: awardCount,
        rulesCount: rules.length
      }
    });
  } catch (error) {
    console.error('自动发奖失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 管理员手动发奖
router.post('/:id/manual-award', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const { userId, awardId, reason } = req.body;

    // 验证输入
    if (!userId || !awardId) {
      return res.status(400).json({ error: '用户ID和奖项ID不能为空' });
    }

    // 检查用户是否参与了该活动且状态为已批准
    const userActivity = await prisma.userActivity.findUnique({
      where: {
        userId_activityId: {
          userId: parseInt(userId),
          activityId
        }
      },
      select: {
        status: true,
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!userActivity) {
      return res.status(404).json({ error: '该用户未参与此活动' });
    }

    if (userActivity.status !== 'APPROVED') {
      return res.status(400).json({ error: '该用户的活动报名未通过审核' });
    }

    // 检查奖项是否属于该活动且有效
    const award = await prisma.activityAward.findFirst({
      where: {
        id: parseInt(awardId),
        activityId,
        isActive: true
      }
    });

    if (!award) {
      return res.status(404).json({ error: '奖项不存在或已禁用' });
    }

    // 检查是否已经获得过该奖项
    const existingRecord = await prisma.awardRecord.findUnique({
      where: {
        userId_activityId_awardId: {
          userId: parseInt(userId),
          activityId,
          awardId: parseInt(awardId)
        }
      }
    });

    if (existingRecord) {
      return res.status(400).json({ error: '该用户已经获得过此奖项' });
    }

    // 创建手动获奖记录
    const awardRecord = await prisma.awardRecord.create({
      data: {
        userId: parseInt(userId),
        activityId,
        awardId: parseInt(awardId),
        awardType: 'MANUAL',
        issuedBy: req.user.id,
        issuedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            school: true
          }
        },
        award: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        issuer: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      message: '手动发奖成功',
      data: awardRecord
    });
  } catch (error) {
    console.error('手动发奖失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取活动的获奖记录列表
router.get('/:id/award-records', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);

    // 检查活动是否存在
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { id: true, name: true }
    });

    if (!activity) {
      return res.status(404).json({ error: '活动不存在' });
    }

    const { page = 1, limit = 20, awardType } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      activityId
    };

    if (awardType) {
      where.awardType = awardType;
    }

    const [records, total] = await Promise.all([
      prisma.awardRecord.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              school: true,
              phone: true
            }
          },
          award: {
            select: {
              id: true,
              name: true,
              description: true
            }
          },
          issuer: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: {
          issuedAt: 'desc'
        },
        skip,
        take: parseInt(limit)
      }),
      prisma.awardRecord.count({ where })
    ]);

    res.json({
      data: records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('获取获奖记录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除获奖记录
router.delete('/:id/award-records/:recordId', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN']), async (req, res) => {
  try {
    const activityId = parseInt(req.params.id);
    const recordId = parseInt(req.params.recordId);

    // 检查获奖记录是否存在且属于该活动
    const existingRecord = await prisma.awardRecord.findFirst({
      where: {
        id: recordId,
        activityId
      },
      include: {
        award: true,
        user: true
      }
    });

    if (!existingRecord) {
      return res.status(404).json({ error: '获奖记录不存在' });
    }

    // 只有手动颁发的奖项可以被删除
    if (existingRecord.awardType !== 'MANUAL') {
      return res.status(400).json({ error: '只能删除手动颁发的奖项' });
    }

    // 删除获奖记录
    await prisma.awardRecord.delete({
      where: { id: recordId }
    });

    res.json({
      message: '获奖记录删除成功',
      data: {
        userName: existingRecord.user.name,
        awardName: existingRecord.award.name
      }
    });
  } catch (error) {
    console.error('删除获奖记录失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
