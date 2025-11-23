const express = require('express')
const { body, validationResult } = require('express-validator')
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')
const { refundToBalance } = require('./balance')

const router = express.Router()
const ADMIN_ROLES = ['SUPER_ADMIN', 'ACTIVITY_ADMIN']

router.get('/', authMiddleware, roleMiddleware(ADMIN_ROLES), async (req, res) => {
  try {
    const { page = 1, limit = 10, status = 'PENDING' } = req.query
    const parsedPage = Math.max(parseInt(page), 1)
    const parsedLimit = Math.max(parseInt(limit), 1)

    const where = {}
    if (status && status !== 'ALL') {
      where.status = status
    }

    const [refunds, total] = await Promise.all([
      prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
        include: {
          order: {
            include: {
              user: { select: { id: true, name: true, phone: true, school: true } },
              activity: { select: { id: true, name: true, type: true } },
              service: { select: { id: true, title: true } }
            }
          }
        }
      }),
      prisma.refund.count({ where })
    ])

    res.json({
      data: refunds,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit) || 1
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

router.put(
  '/:id/decision',
  authMiddleware,
  roleMiddleware(ADMIN_ROLES),
  [
    body('action').isIn(['APPROVED', 'REJECTED']).withMessage('无效的操作类型'),
    body('note').optional().isString().withMessage('备注必须是字符串')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
      }

      const refundId = parseInt(req.params.id)
      const { action, note } = req.body
      const trimmedNote = typeof note === 'string' ? note.trim() : ''

      const refund = await prisma.refund.findUnique({
        where: { id: refundId },
        include: {
          order: {
            include: {
              activity: { select: { id: true, name: true, type: true } },
              service: { select: { id: true, title: true } }
            }
          }
        }
      })

      if (!refund) {
        return res.status(404).json({ error: '退款申请不存在' })
      }

      if (refund.status !== 'PENDING') {
        return res.status(400).json({ error: '该退款申请已处理' })
      }

      const order = await prisma.order.findUnique({ where: { id: refund.orderId } })
      if (!order) {
        return res.status(404).json({ error: '关联订单不存在' })
      }

      if (action === 'REJECTED') {
        if (!trimmedNote) {
          return res.status(400).json({ error: '请填写拒绝原因' })
        }

        await prisma.$transaction(async (tx) => {
          await tx.refund.update({
            where: { id: refundId },
            data: {
              status: 'REJECTED',
              processedBy: req.user.id,
              processedAt: new Date(),
              decisionNote: trimmedNote
            }
          })

          await tx.order.update({
            where: { id: order.id },
            data: { status: 'PAID' }
          })
        })

        return res.json({ message: '已拒绝该退款申请' })
      }

      const description = `活动退款：${refund.order.activity?.name || refund.order.service?.title || '订单'
        }`

      const balanceResult = await refundToBalance(
        order.userId,
        refund.amount,
        refund.orderId,
        description
      )

      const updatedRefund = await prisma.refund.update({
        where: { id: refundId },
        data: {
          status: 'APPROVED',
          processedBy: req.user.id,
          processedAt: new Date(),
          decisionNote: trimmedNote || null
        }
      })

      const updatedOrder = await prisma.order.update({
        where: { id: order.id },
        data: {
          isRefunded: true,
          refundedAmount: refund.amount,
          status: 'REFUNDED'
        }
      })

      // 如果是活动订单，删除报名记录以便用户重新报名
      if (order.activityId) {
        await prisma.userActivity.deleteMany({
          where: {
            userId: order.userId,
            activityId: order.activityId
          }
        })
      }

      res.json({
        message: '退款已同意并完成退款操作',
        data: {
          refund: updatedRefund,
          order: updatedOrder,
          balance: balanceResult.balance
        }
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: '服务器错误' })
    }
  }
)

module.exports = router
