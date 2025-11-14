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
    const bases = await prisma.base.findMany({ select: { id: true, name: true } })
    if (!bases.length) {
      console.log('未找到基地，请先创建基地数据')
      return
    }

    console.log('开始为每个基地生成优惠码...')

    for (const base of bases) {
      const coupon = await prisma.baseCoupon.create({
        data: {
          couponCode: generateCode(),
          amount: 100,
          baseId: base.id
        }
      })
      console.log(`✓ ${base.name}: ${coupon.couponCode} - ¥${coupon.amount}`)
    }

    console.log('\n所有基地优惠码生成完成')
  } catch (error) {
    console.error('生成基地优惠码失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
