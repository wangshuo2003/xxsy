const express = require('express')
const prisma = require('../config/database')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

const normalizeCode = (code = '') => code.trim().toUpperCase()

router.post('/validate', authMiddleware, async (req, res) => {
  try {
    const { couponCode, activityId } = req.body

    if (!couponCode || !activityId) {
      return res.status(400).json({ error: '优惠码和活动ID不能为空' })
    }

    const activity = await prisma.activity.findUnique({
      where: { id: parseInt(activityId) },
      select: { id: true, name: true, baseId: true, price: true }
    })

    if (!activity) {
      return res.status(404).json({ error: '活动不存在' })
    }

    if (!activity.baseId) {
      return res.status(400).json({ error: '该活动未关联基地，无法使用优惠码' })
    }

    const coupon = await prisma.baseCoupon.findFirst({
      where: {
        couponCode: normalizeCode(couponCode),
        baseId: activity.baseId
      }
    })

    if (!coupon) {
      return res.status(404).json({ error: '优惠码不存在' })
    }

    if (coupon.baseId !== activity.baseId) {
      return res.status(400).json({ error: '该优惠码仅可用于对应基地的活动' })
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ error: '优惠码已被使用完' })
    }

    res.json({
      coupon: {
        couponCode: coupon.couponCode,
        amount: coupon.amount,
        baseId: coupon.baseId,
        activityId: activity.id,
        usageLimit: coupon.usageLimit,
        usedCount: coupon.usedCount,
        remainingUses: Math.max(coupon.usageLimit - coupon.usedCount, 0)
      }
    })
  } catch (error) {
    console.error('验证优惠码失败:', error)
    res.status(500).json({ error: '服务器错误' })
  }
})

module.exports = router
