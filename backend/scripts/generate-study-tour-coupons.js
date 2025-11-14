const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

async function main() {
  try {
    console.log('开始创建研学活动优惠券...')

    const coupons = []
    for (let i = 0; i < 10; i++) {
      const code = generateCode()
      const coupon = await prisma.giftCard.create({
        data: {
          cardCode: code,
          amount: 100
        }
      })
      coupons.push(coupon)
      console.log('✓ 已创建优惠券:', coupon.cardCode, '金额: ¥' + coupon.amount)
    }

    console.log(`\n共创建 ${coupons.length} 张100元优惠券`)
  } catch (error) {
    console.error('创建优惠券失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
