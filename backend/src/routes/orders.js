const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')
const { deductBalance, refundToBalance } = require('./balance')

const router = express.Router()

const normalizeCouponCode = (code = '') => code.trim().toUpperCase()

const couponError = (status, message) => {
  const error = new Error(message)
  error.status = status
  return error
}

const calculateActivityPrice = (activity, fallbackAmount) => {
  if (typeof activity.price === 'number') return activity.price
  const parsed = parseFloat(fallbackAmount)
  if (!Number.isNaN(parsed)) return parsed
  return 0
}

const validateBaseCoupon = async (couponCode, activity) => {
  if (!couponCode) return null

  if (!activity.baseId) {
    throw couponError(400, '该活动未关联基地，无法使用优惠码')
  }

  const coupon = await prisma.baseCoupon.findFirst({
    where: {
      couponCode: normalizeCouponCode(couponCode),
      baseId: activity.baseId
    }
  })

  if (!coupon) throw couponError(404, '优惠码不存在')
  if (coupon.baseId !== activity.baseId) throw couponError(400, '该优惠码仅可用于对应基地的活动')
  if (coupon.usedCount >= coupon.usageLimit) throw couponError(400, '优惠码已被使用完')

  return coupon
}

const markCouponUsed = async (couponId, userId) => {
  await prisma.$transaction(async (tx) => {
    const coupon = await tx.baseCoupon.findUnique({
      where: { id: couponId },
      select: { usedCount: true, usageLimit: true }
    })

    if (!coupon) throw couponError(404, '优惠码不存在')
    if (coupon.usedCount >= coupon.usageLimit) {
      throw couponError(400, '优惠码已被使用完')
    }

    await tx.baseCoupon.update({
      where: { id: couponId },
      data: {
        usedCount: { increment: 1 },
        isUsed: coupon.usedCount + 1 >= coupon.usageLimit,
        usedBy: userId,
        usedAt: new Date()
      }
    })
  })
}

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10, orderStatus, serviceId, search, baseId, activityId, refundStatus } = req.query;
    const where = {};

    if (req.user.role === 'STUDENT') {
      where.userId = req.user.id;
    }

    if (orderStatus) {
      where.status = orderStatus;
    }
    
    if (serviceId) {
      where.serviceId = parseInt(serviceId);
    }

    if (search) {
      where.OR = [
        { orderNo: { contains: search, mode: 'insensitive' } },
        { activity: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (activityId) {
      where.activityId = parseInt(activityId);
    } else if (baseId) {
      where.activity = {
        ...where.activity,
        baseId: parseInt(baseId),
      };
    }
    
    if (refundStatus && refundStatus !== 'ALL') {
        where.refunds = {
            some: {
                status: refundStatus
            }
        };
    }


    const orders = await prisma.order.findMany({
      where,
      orderBy: req.query.sortBy === 'updatedAt' ? { updatedAt: 'desc' } : { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit),
      include: {
        user: { select: { name: true, phone: true, school: true } },
        service: { select: { title: true, coverImage: true } },
        activity: { 
            select: { id: true, name: true, type: true, base: true }
        },
        refunds: { orderBy: { createdAt: 'desc' }, take: 1 } // Include the latest refund
      }
    });

    const total = await prisma.order.count({ where });

    // Attach the single refund object directly to the order
    const ordersWithRefund = orders.map(order => {
        const { refunds, ...rest } = order;
        return { ...rest, refund: refunds.length > 0 ? refunds[0] : null };
    });


    res.json({
      data: ordersWithRefund,
      pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        user: { select: { name: true, phone: true, school: true } },
        service: true,
        activity: true
      }
    })

    if (!order) return res.status(404).json({ error: '订单不存在' })

    if (req.user.role === 'STUDENT' && order.userId !== req.user.id) {
      return res.status(403).json({ error: '权限不足' })
    }
    // 管理员和超级管理员可以查看所有订单

    res.json({ data: order })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 服务订单创建
router.post('/', authMiddleware, [
  body('serviceId').notEmpty().withMessage('服务ID不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { serviceId, note, orderId } = req.body
    const userNote = typeof note === 'string' && note.trim() ? note.trim() : null

    const service = await prisma.service.findUnique({
      where: { id: parseInt(serviceId) }
    })

    if (!service) return res.status(404).json({ error: '服务项目不存在' })
    if (!service.isActive) return res.status(400).json({ error: '服务项目已下架' })

    let existingOrder = null
    if (orderId) {
      existingOrder = await prisma.order.findUnique({
        where: { id: parseInt(orderId) }
      })

      if (!existingOrder) return res.status(404).json({ error: '订单不存在' })
      if (existingOrder.userId !== req.user.id) return res.status(403).json({ error: '无权操作该订单' })
      if (existingOrder.serviceId !== parseInt(serviceId)) return res.status(400).json({ error: '订单信息不匹配' })

      if (!['PENDING', 'PAID'].includes(existingOrder.status)) {
        return res.status(400).json({ error: '订单状态已变更，无法继续操作' })
      }
    } else {
      const pendingOrder = await prisma.order.findFirst({
        where: {
          userId: req.user.id,
          serviceId: parseInt(serviceId),
          status: 'PENDING'
        }
      })

      if (pendingOrder) {
        return res.status(400).json({ error: '存在待支付订单，请前往订单列表进行支付' })
      }

      const paidOrder = await prisma.order.findFirst({
        where: {
          userId: req.user.id,
          serviceId: parseInt(serviceId),
          status: 'PAID'
        }
      })

      if (paidOrder) {
        existingOrder = paidOrder
      }
    }

    if (existingOrder) return res.status(400).json({ error: '您已报名该服务项目' })

    const servicePrice = typeof service.price === 'number' ? service.price : 0
    const orderNo = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 9)

    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: req.user.id,
        serviceId: parseInt(serviceId),
        amount: servicePrice,
        originalAmount: servicePrice,
        status: 'PENDING',
        userNote
      },
      include: {
        service: { select: { title: true } }
      }
    })

    res.status(201).json({ message: '订单创建成功', data: order })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 活动订单创建
router.post('/activity', authMiddleware, [
  body('activityId').notEmpty().withMessage('活动ID不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { activityId, amount, couponCode, note, orderId } = req.body
    const userNote = typeof note === 'string' && note.trim() ? note.trim() : null

    const activity = await prisma.activity.findUnique({
      where: { id: parseInt(activityId) }
    })

    if (!activity) return res.status(404).json({ error: '活动不存在' })
    if (!activity.isApproved) return res.status(400).json({ error: '活动未通过审核' })
    if (!activity.isActive) return res.status(400).json({ error: '活动已下架' })

    const basePrice = calculateActivityPrice(activity, amount)
    let coupon = null
    let discountAmount = 0

    try {
      coupon = couponCode ? await validateBaseCoupon(couponCode, activity) : null
      discountAmount = coupon ? coupon.amount : 0
    } catch (couponErr) {
      if (couponErr.status) {
        return res.status(couponErr.status).json({ error: couponErr.message })
      }
      throw couponErr
    }

    let existingRegistration = await prisma.userActivity.findFirst({
      where: {
        userId: req.user.id,
        activityId: parseInt(activityId)
      }
    })

    if (!existingRegistration) {
      existingRegistration = await prisma.userActivity.create({
        data: {
          userId: req.user.id,
          activityId: parseInt(activityId),
          status: 'REGISTERED'
        }
      })
    }

    let existingOrder = null
    if (orderId) {
      existingOrder = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: {
          activity: { select: { id: true, name: true, type: true, baseId: true } }
        }
      })

      if (!existingOrder) return res.status(404).json({ error: '订单不存在' })
      if (existingOrder.userId !== req.user.id) return res.status(403).json({ error: '无权操作该订单' })
      if (existingOrder.activityId !== parseInt(activityId)) return res.status(400).json({ error: '订单信息不匹配' })

      // 如果指定了订单ID，但状态不是待支付或已支付（例如已取消），则不允许操作
      if (!['PENDING', 'PAID'].includes(existingOrder.status)) {
        return res.status(400).json({ error: '订单状态已变更，无法继续操作' })
      }
    } else {
      // 如果未指定订单ID，检查是否存在待支付订单
      // 如果存在待支付订单，必须要求前端传递明确的订单ID，防止误操作
      const pendingOrder = await prisma.order.findFirst({
        where: {
          userId: req.user.id,
          activityId: parseInt(activityId),
          status: 'PENDING'
        }
      })

      if (pendingOrder) {
        return res.status(400).json({ error: '存在待支付订单，请前往订单列表进行支付' })
      }

      // 只有在没有待支付订单的情况下，才允许不传ID（视为创建新订单）
      // 但前面已经检查了 existingRegistration，所以这里通常不会走到创建新订单的逻辑，除非是重复支付已支付订单？
      // 检查已支付订单
      const paidOrder = await prisma.order.findFirst({
        where: {
          userId: req.user.id,
          activityId: parseInt(activityId),
          status: 'PAID'
        },
        include: {
          activity: { select: { id: true, name: true, type: true, baseId: true } }
        }
      })

      if (paidOrder) {
        existingOrder = paidOrder
      }
    }

    const finalAmount = Math.max(basePrice - discountAmount, 0)

    if (existingOrder) {
      if (existingOrder.status === 'PAID') {
        return res.json({
          message: '订单已支付',
          data: existingOrder,
          existingOrder: true
        })
      }

      let orderToPay = existingOrder

      if (coupon) {
        if (existingOrder.baseCouponId && existingOrder.couponCode !== coupon.couponCode) {
          return res.status(400).json({ error: '订单已使用其他优惠码' })
        }

        if (!existingOrder.baseCouponId) {
          orderToPay = await prisma.order.update({
            where: { id: existingOrder.id },
            data: {
              originalAmount: basePrice,
              discountAmount,
              amount: finalAmount,
              couponCode: coupon.couponCode,
              baseCouponId: coupon.id
            },
            include: {
              activity: { select: { id: true, name: true, type: true, baseId: true } }
            }
          })
        }

        if (orderToPay.amount === 0) {
          await prisma.order.update({
            where: { id: orderToPay.id },
            data: {
              status: 'PAID',
              paymentMethod: 'coupon'
            }
          })

          await markCouponUsed(orderToPay.baseCouponId, req.user.id)

          return res.json({
            message: '订单已支付',
            data: { ...orderToPay, status: 'PAID', paymentMethod: 'coupon' },
            existingOrder: true
          })
        }
      }

      if (userNote !== null && orderToPay.userNote !== userNote) {
        orderToPay = await prisma.order.update({
          where: { id: orderToPay.id },
          data: { userNote },
          include: {
            activity: { select: { id: true, name: true, type: true, baseId: true } }
          }
        })
      }

      const paymentMethod = req.body.paymentMethod || 'balance'
      const paymentAmount = orderToPay.amount

      if (paymentMethod === 'balance') {
        try {
          await deductBalance(
            req.user.id,
            paymentAmount,
            orderToPay.id,
            `购买活动：${activity.name}`
          )

          const updatedOrder = await prisma.order.update({
            where: { id: orderToPay.id },
            data: {
              status: 'PAID',
              paymentMethod: 'balance'
            },
            include: {
              activity: { select: { id: true, name: true, type: true } }
            }
          })

          if (orderToPay.baseCouponId) {
            await markCouponUsed(orderToPay.baseCouponId, req.user.id)
          }

          return res.json({
            message: '支付成功',
            data: updatedOrder,
            existingOrder: true
          })
        } catch (error) {
          console.error('余额支付失败:', error)
          return res.status(400).json({ error: error.message || '余额支付失败' })
        }
      }

      return res.status(400).json({ error: '暂不支持该支付方式' })
    }

    const orderNo = 'ORD' + Date.now() + Math.random().toString(36).substr(2, 9)

    let order = await prisma.order.create({
      data: {
        orderNo,
        userId: req.user.id,
        activityId: parseInt(activityId),
        amount: finalAmount,
        originalAmount: basePrice,
        discountAmount,
        couponCode: coupon ? coupon.couponCode : null,
        baseCouponId: coupon ? coupon.id : null,
        status: finalAmount === 0 ? 'PAID' : 'PENDING',
        paymentMethod: finalAmount === 0 ? 'coupon' : null,
        userNote
      },
      include: {
        activity: { select: { id: true, name: true, type: true } }
      }
    })

    if (finalAmount === 0 && coupon) {
      await markCouponUsed(coupon.id, req.user.id)
    }

    return res.status(201).json({
      message: finalAmount === 0 ? '订单创建并支付成功' : '订单创建成功',
      data: order,
      existingOrder: false
    })

  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message })
    }
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/pay', authMiddleware, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) }
    })

    if (!order) return res.status(404).json({ error: '订单不存在' })
    if (order.userId !== req.user.id) return res.status(403).json({ error: '权限不足' })
    if (order.status !== 'PENDING') return res.status(400).json({ error: '订单状态不正确' })

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'PAID' },
      include: {
        service: { select: { title: true } }
      }
    })

    res.json({ message: '支付成功', data: updatedOrder })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        service: { select: { title: true } },
        activity: { select: { id: true, name: true, type: true } }
      }
    })

    if (!order) return res.status(404).json({ error: '订单不存在' })
    if (order.userId !== req.user.id) return res.status(403).json({ error: '权限不足' })
    if (order.status === 'CANCELLED') return res.status(400).json({ error: '订单已取消' })

    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(req.params.id) },
      data: { status: 'CANCELLED' },
      include: {
        service: { select: { title: true } },
        activity: { select: { id: true, name: true } }
      }
    })

    // 如果是活动订单，同时删除活动报名记录

    if (order.activityId) {
      await prisma.userActivity.deleteMany({
        where: {
          userId: req.user.id,
          activityId: order.activityId
        }
      })
    }

    res.json({ message: '订单取消成功', data: updatedOrder })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put('/:id/admin-note', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'ACTIVITY_ADMIN', 'BASE_ADMIN']), async (req, res) => {
  try {
    const { adminNote } = req.body
    const trimmedNote = adminNote && adminNote.trim ? adminNote.trim() : ''

    const order = await prisma.order.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        activity: {
          select: {
            id: true,
            base: { select: { managerId: true } }
          }
        }
      }
    })

    if (!order) return res.status(404).json({ error: '订单不存在' })

    if (req.user.role === 'BASE_ADMIN') {
      const managerId = order.activity?.base?.managerId
      if (managerId && managerId !== req.user.id) {
        return res.status(403).json({ error: '您无权操作该订单' })
      }
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        adminNote: trimmedNote || null
      }
    })

    res.json({ message: '管理员备注已更新', data: updatedOrder })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 申请退款
router.post('/:id/refund', authMiddleware, [
  body('reason').optional().isString().withMessage('退款原因必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { reason } = req.body
    const orderId = parseInt(req.params.id)

    // 获取订单信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { name: true } },
        activity: { select: { id: true, name: true, type: true } },
        service: { select: { title: true } }
      }
    })

    if (!order) return res.status(404).json({ error: '订单不存在' })
    if (order.userId !== req.user.id) return res.status(403).json({ error: '权限不足' })
    if (order.status !== 'PAID') return res.status(400).json({ error: '只能退款已支付的订单' })
    if (order.isRefunded) return res.status(400).json({ error: '订单已退款' })

    // 检查是否已有退款申请
    const existingRefund = await prisma.refund.findFirst({
      where: {
        orderId,
        status: { in: ['PENDING', 'APPROVED'] }
      }
    })

    if (existingRefund) {
      return res.status(400).json({ error: '该订单已有退款申请' })
    }

    // 创建退款申请
    const refund = await prisma.refund.create({
      data: {
        orderId,
        amount: order.amount,
        reason: reason || '用户申请退款'
      }
    })

    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'REFUNDING' }
    })

    res.status(201).json({
      message: '退款申请已提交，请等待审核',
      data: refund
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 自动退款（用户操作，直接退款到余额）
router.post('/:id/auto-refund', authMiddleware, async (req, res) => {
  try {
    const orderId = parseInt(req.params.id)

    // 获取订单信息
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        activity: { select: { id: true, name: true, type: true } },
        service: { select: { title: true } }
      }
    })

    if (!order) return res.status(404).json({ error: '订单不存在' })
    if (order.userId !== req.user.id) return res.status(403).json({ error: '权限不足' })
    if (order.status !== 'PAID') return res.status(400).json({ error: '只能退款已支付的订单' })
    if (order.isRefunded) return res.status(400).json({ error: '订单已退款' })

    // 只有余额支付的订单才能自动退款
    if (order.paymentMethod !== 'balance') {
      return res.status(400).json({ error: '只有余额支付的订单才能自动退款' })
    }

    // 使用事务处理退款
    const result = await prisma.$transaction(async (tx) => {
      // 退款到余额
      const balanceResult = await refundToBalance(
        req.user.id,
        order.amount,
        order.id,
        `活动退款：${order.activity?.name || order.service?.title || '订单'}`
      )

      // 更新订单状态
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          isRefunded: true,
          refundedAmount: order.amount,
          status: 'REFUNDED'
        }
      })

      // 创建退款记录
      const refund = await tx.refund.create({
        data: {
          orderId,
          amount: order.amount,
          reason: '用户自动退款',
          status: 'APPROVED',
          processedBy: req.user.id,
          processedAt: new Date()
        }
      })

      // 如果是活动订单，删除报名记录以便用户重新报名
      if (order.activityId) {
        await tx.userActivity.deleteMany({
          where: {
            userId: req.user.id,
            activityId: order.activityId
          }
        })
      }

      return { updatedOrder, refund, balance: balanceResult.balance }
    })

    res.json({
      message: '退款成功，金额已返还到账户余额',
      data: {
        order: result.updatedOrder,
        refund: result.refund,
        balance: result.balance
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router
