const { PrismaClient } = require('@prisma/client')
const crypto = require('crypto')

const prisma = new PrismaClient()

// 生成12位随机礼品卡码
function generateGiftCardCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// 生成指定范围内的随机金额
function generateRandomAmount(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function generateGiftCards() {
  try {
    console.log('开始生成礼品卡...')

    const giftCards = []
    const amounts = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]

    for (let i = 0; i < 10; i++) {
      const cardCode = generateGiftCardCode()
      const amount = amounts[i] || generateRandomAmount(100, 1000)

      const giftCard = await prisma.giftCard.create({
        data: {
          cardCode,
          amount
        }
      })

      giftCards.push(giftCard)
      console.log(`生成礼品卡 ${i + 1}: ${cardCode} - ¥${amount}`)
    }

    console.log(`\n成功生成 ${giftCards.length} 张礼品卡！`)
    console.log('\n礼品卡列表：')
    giftCards.forEach((card, index) => {
      console.log(`${index + 1}. ${card.cardCode} - ¥${card.amount}`)
    })

  } catch (error) {
    console.error('生成礼品卡失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

generateGiftCards()