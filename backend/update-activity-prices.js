const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function updateActivityPrices() {
  try {
    console.log('开始更新活动价格...')

    // 获取所有研学活动和实践活动
    const activities = await prisma.activity.findMany({
      where: {
        type: {
          in: ['研学活动', '实践活动']
        }
      }
    })

    console.log(`找到 ${activities.length} 个需要更新的活动`)

    // 更新每个活动的价格
    for (const activity of activities) {
      const randomPrice = Math.floor(Math.random() * 1000) + 1 // 1-1000之间的随机价格

      await prisma.activity.update({
        where: { id: activity.id },
        data: { price: randomPrice }
      })

      console.log(`已更新活动 "${activity.name}" 的价格为: ${randomPrice}元`)
    }

    console.log('所有活动价格更新完成！')
  } catch (error) {
    console.error('更新活动价格时出错:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateActivityPrices()