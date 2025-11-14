const express = require('express')
const { body, validationResult } = require('express-validator')
const router = express.Router()
const prisma = require('../config/database')
const { authMiddleware } = require('../middleware/auth')

// 获取用户余额和交易记录
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query

    const transactions = await prisma.balanceTransaction.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: parseInt(limit)
    })

    const total = await prisma.balanceTransaction.count({
      where: { userId: req.user.id }
    })

    res.json({
      data: transactions,
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

// 获取用户当前余额
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { balance: true }
    })

    res.json({ balance: user.balance })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 余额充值
router.post('/recharge', authMiddleware, [
  body('amount').isFloat({ min: 0.01 }).withMessage('充值金额必须大于0'),
  body('paymentMethod').notEmpty().withMessage('支付方式不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { amount, paymentMethod } = req.body
    const rechargeAmount = parseFloat(amount)

    // 更新用户余额
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        balance: {
          increment: rechargeAmount
        }
      }
    })

    // 创建余额交易记录
    const transaction = await prisma.balanceTransaction.create({
      data: {
        userId: req.user.id,
        type: 'RECHARGE',
        amount: rechargeAmount,
        balance: updatedUser.balance,
        description: `${paymentMethod}充值`
      }
    })

    res.status(201).json({
      message: '充值成功',
      data: {
        balance: updatedUser.balance,
        transaction
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 礼品卡充值
router.post('/recharge/gift-card', authMiddleware, [
  body('cardCode').notEmpty().withMessage('礼品卡码不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })

    const { cardCode } = req.body

    // 查找礼品卡
    const giftCard = await prisma.giftCard.findUnique({
      where: { cardCode: cardCode.trim().toUpperCase() }
    })

    if (!giftCard) {
      return res.status(404).json({ error: '礼品卡不存在' })
    }

    if (!giftCard.isActive) {
      return res.status(400).json({ error: '礼品卡已被禁用' })
    }

    const remainingUses = (giftCard.totalUses ?? 1) - (giftCard.usedCount ?? 0)
    if (remainingUses <= 0) {
      const usedTime = giftCard.usedAt ? new Date(giftCard.usedAt).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }) : '未知时间'

      return res.status(400).json({
        error: '礼品卡可用次数已用完',
        usedTime
      })
    }

    // 使用事务处理礼品卡充值
    const result = await prisma.$transaction(async (tx) => {
      // 标记礼品卡使用次数+1
      const updatedGiftCard = await tx.giftCard.update({
        where: { id: giftCard.id },
        data: {
          usedCount: {
            increment: 1
          },
          isUsed: (giftCard.usedCount + 1) >= giftCard.totalUses,
          usedBy: req.user.id,
          usedAt: new Date()
        }
      })

      // 更新用户余额
      const updatedUser = await tx.user.update({
        where: { id: req.user.id },
        data: {
          balance: {
            increment: giftCard.amount
          }
        }
      })

      // 创建余额交易记录
      const transaction = await tx.balanceTransaction.create({
        data: {
          userId: req.user.id,
          type: 'GIFT_CARD',
          amount: giftCard.amount,
          balance: updatedUser.balance,
          description: `礼品卡充值 (${giftCard.cardCode})`
        }
      })

      return {
        updatedUser,
        updatedGiftCard,
        transaction,
        amount: giftCard.amount
      }
    })

    res.status(201).json({
      message: '礼品卡充值成功',
      amount: result.amount,
      balance: result.updatedUser.balance,
      transaction: result.transaction
    })
  } catch (error) {
    console.error('礼品卡充值失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 余额支付（内部使用，由orders路由调用）
const deductBalance = async (userId, amount, orderId, description) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 检查余额是否充足
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true }
      })

      if (user.balance < amount) {
        throw new Error('余额不足')
      }

      // 扣除余额
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            decrement: amount
          }
        }
      })

      // 创建交易记录
      const transaction = await tx.balanceTransaction.create({
        data: {
          userId,
          type: 'PAYMENT',
          amount: -amount, // 负数表示支出
          balance: updatedUser.balance,
          description,
          orderId
        }
      })

      return { balance: updatedUser.balance, transaction }
    })

    return result
  } catch (error) {
    throw error
  }
}

// 余额退款（内部使用，由orders路由调用）
const refundToBalance = async (userId, amount, orderId, description) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 增加余额
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: amount
          }
        }
      })

      // 创建交易记录
      const transaction = await tx.balanceTransaction.create({
        data: {
          userId,
          type: 'REFUND',
          amount: amount, // 正数表示收入
          balance: updatedUser.balance,
          description,
          orderId
        }
      })

      return { balance: updatedUser.balance, transaction }
    })

    return result
  } catch (error) {
    throw error
  }
}

module.exports = {
  router,
  deductBalance,
  refundToBalance
}
