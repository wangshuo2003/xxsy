const express = require('express')
const { body, validationResult } = require('express-validator')
const router = express.Router()
const prisma = require('../config/database')
const { authMiddleware, roleMiddleware } = require('../middleware/auth')

// 获取所有礼品卡（超级管理员）
router.get('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, cardCode } = req.query
    const skip = (page - 1) * limit

    const where = {}
    if (status === 'used') {
      where.isUsed = true
    } else if (status === 'unused') {
      where.isUsed = false
    }
    if (cardCode) {
      where.cardCode = {
        contains: cardCode.toUpperCase()
      }
    }

    const [giftCards, total] = await Promise.all([
      prisma.giftCard.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              phone: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: parseInt(skip),
        take: parseInt(limit)
      }),
      prisma.giftCard.count({ where })
    ])

    const normalizedGiftCards = giftCards.map((card) => {
      const totalUses = card.totalUses ?? 1
      const usedCount = card.usedCount ?? 0
      const normalizedUsedCount = (card.isUsed && usedCount < totalUses)
        ? totalUses
        : usedCount

      return {
        ...card,
        totalUses,
        usedCount: normalizedUsedCount
      }
    })

    res.json({
      data: normalizedGiftCards,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('获取礼品卡列表失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 创建礼品卡（超级管理员）
router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), [
  body('amount')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('充值金额必须在0.01-10000元之间'),
  body('quantity')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('生成数量必须在1-100之间')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      })
    }

    const { amount, quantity = 1 } = req.body

    const giftCards = []
    for (let i = 0; i < quantity; i++) {
      const cardCode = generateGiftCardCode()
      giftCards.push({
        cardCode,
        amount: parseFloat(amount),
        isUsed: false,
        isActive: true,
        expiresAt: null,
        totalUses: 1,
        usedCount: 0
      })
    }

    const createdGiftCards = await prisma.giftCard.createMany({
      data: giftCards
    })

    // 获取刚创建的礼品卡详情
    const detailedGiftCards = await prisma.giftCard.findMany({
      where: {
        cardCode: {
          in: giftCards.map(gc => gc.cardCode)
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    res.status(201).json({
      message: `成功创建 ${quantity} 张礼品卡`,
      data: detailedGiftCards
    })
  } catch (error) {
    console.error('创建礼品卡失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 删除礼品卡（超级管理员）
router.delete('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { id } = req.params

    // 检查礼品卡是否存在
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: parseInt(id) }
    })

    if (!giftCard) {
      return res.status(404).json({ error: '礼品卡不存在' })
    }

    // 检查礼品卡是否已使用
    if (giftCard.isUsed) {
      return res.status(400).json({ error: '已使用的礼品卡不能删除' })
    }

    await prisma.giftCard.delete({
      where: { id: parseInt(id) }
    })

    res.json({ message: '礼品卡删除成功' })
  } catch (error) {
    console.error('删除礼品卡失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 更新礼品卡（超级管理员）
router.put('/:id', authMiddleware, roleMiddleware(['SUPER_ADMIN']), [
  body('amount')
    .optional()
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('充值金额必须在0.01-10000元之间'),
  body('cardCode')
    .optional()
    .isLength({ min: 8, max: 32 })
    .withMessage('礼品卡码长度需在8-32位之间'),
  body('expiresAt')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === '') return true
      return !isNaN(Date.parse(value))
    })
    .withMessage('有效期格式不正确'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('启用状态必须为布尔值')
  ,
  body('totalUses')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('可用次数必须是 1-100 的整数')
], async (req, res) => {
  try {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: '参数验证失败',
        details: errors.array()
      })
    }

    const { id } = req.params
    const { amount, cardCode, expiresAt, isActive, totalUses } = req.body

    // 检查礼品卡是否存在
    const giftCard = await prisma.giftCard.findUnique({
      where: { id: parseInt(id) }
    })

    if (!giftCard) {
      return res.status(404).json({ error: '礼品卡不存在' })
    }

    const updateData = {}
    if (amount !== undefined) {
      updateData.amount = parseFloat(amount)
    }
    if (cardCode) {
      updateData.cardCode = cardCode.toUpperCase()
    }
    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt ? new Date(expiresAt) : null
    }
    if (isActive !== undefined) {
      if (typeof isActive === 'string') {
        updateData.isActive = isActive === 'true'
      } else {
        updateData.isActive = Boolean(isActive)
      }
    }
    if (totalUses !== undefined) {
      const parsedTotalUses = parseInt(totalUses)
      if (parsedTotalUses < giftCard.usedCount) {
        return res.status(400).json({ error: '总可用次数不能小于已使用次数' })
      }
      updateData.totalUses = parsedTotalUses
      updateData.isUsed = giftCard.usedCount >= parsedTotalUses
    }

    const updatedGiftCard = await prisma.giftCard.update({
      where: { id: parseInt(id) },
      data: updateData
    })

    res.json({
      message: '礼品卡更新成功',
      data: updatedGiftCard
    })
  } catch (error) {
    console.error('更新礼品卡失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 获取礼品卡统计信息（超级管理员）
router.get('/statistics', authMiddleware, roleMiddleware(['SUPER_ADMIN']), async (req, res) => {
  try {
    const [total, used, unused, totalAmount, usedAmount] = await Promise.all([
      prisma.giftCard.count(),
      prisma.giftCard.count({ where: { isUsed: true } }),
      prisma.giftCard.count({ where: { isUsed: false } }),
      prisma.giftCard.aggregate({ _sum: { amount: true } }),
      prisma.giftCard.aggregate({
        where: { isUsed: true },
        _sum: { amount: true }
      })
    ])

    res.json({
      total,
      used,
      unused,
      totalAmount: totalAmount._sum.amount || 0,
      usedAmount: usedAmount._sum.amount || 0,
      unusedAmount: (totalAmount._sum.amount || 0) - (usedAmount._sum.amount || 0)
    })
  } catch (error) {
    console.error('获取礼品卡统计失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 礼品卡使用记录
router.get('/:identifier/usages', authMiddleware, roleMiddleware(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { identifier } = req.params
    const isNumericId = /^\d+$/.test(identifier)

    const giftCard = await prisma.giftCard.findFirst({
      where: isNumericId
        ? { id: parseInt(identifier, 10) }
        : { cardCode: identifier.toUpperCase() }
    })

    if (!giftCard) {
      return res.status(404).json({ error: '礼品卡不存在' })
    }

    const usages = await prisma.balanceTransaction.findMany({
      where: {
        type: 'GIFT_CARD',
        description: {
          contains: giftCard.cardCode
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            school: true,
            grade: true,
            className: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const mapped = usages.map((usage) => ({
      id: usage.id,
      name: usage.user?.name || '-',
      username: usage.user?.username || '-',
      userId: usage.userId,
      school: usage.user?.school || '-',
      grade: usage.user?.grade || '-',
      className: usage.user?.className || '-',
      usedAt: usage.createdAt,
      amount: usage.amount
    }))

    res.json({ data: mapped })
  } catch (error) {
    console.error('获取礼品卡使用记录失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

// 生成礼品卡码的函数
function generateGiftCardCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

module.exports = router
