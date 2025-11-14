const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const COUPON_CODE = '1'
const DISCOUNT_AMOUNT = 1000
const USAGE_LIMIT = 100

async function createCouponsForAllBases() {
  const bases = await prisma.base.findMany()

  if (!bases.length) {
    console.log('❌ 未找到任何基地，无法创建示例优惠券')
    return
  }

  for (const base of bases) {
    await prisma.baseCoupon.upsert({
      where: {
        baseId_couponCode: {
          baseId: base.id,
          couponCode: COUPON_CODE
        }
      },
      create: {
        baseId: base.id,
        couponCode: COUPON_CODE,
        amount: DISCOUNT_AMOUNT,
        usageLimit: USAGE_LIMIT,
        usedCount: 0,
        isUsed: false
      },
      update: {
        amount: DISCOUNT_AMOUNT,
        usageLimit: USAGE_LIMIT,
        usedCount: 0,
        isUsed: false,
        usedBy: null,
        usedAt: null
      }
    })

    console.log(`✅ 基地【${base.name}】示例优惠券已设置（代码: ${COUPON_CODE}，减免 ¥${DISCOUNT_AMOUNT}，可用 ${USAGE_LIMIT} 次）`)
  }

  console.log('🎉 所有基地的示例优惠券已创建/重置完成')
}

createCouponsForAllBases()
  .catch((error) => {
    console.error('❌ 创建示例优惠券失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
