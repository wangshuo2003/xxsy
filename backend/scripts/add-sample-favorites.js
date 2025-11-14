const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function addSampleFavorites() {
  try {
    console.log('开始添加示例收藏...')

    const user = await prisma.user.findUnique({
      where: { username: 'studenta' }
    })

    if (!user) {
      console.log('未找到账号 studenta，先初始化用户后再运行')
      return
    }

    const policy = await prisma.policy.findFirst()
    const activity = await prisma.activity.findFirst()

    if (!policy && !activity) {
      console.log('当前数据库没有政策或活动，先执行种子脚本再运行')
      return
    }

    const favorites = []

    if (policy) {
      favorites.push({
        targetType: 'policy',
        targetId: policy.id
      })
    }

    if (activity) {
      favorites.push({
        targetType: 'activity',
        targetId: activity.id
      })
    }

    for (const favorite of favorites) {
      await prisma.favorite.upsert({
        where: {
          userId_targetType_targetId: {
            userId: user.id,
            targetType: favorite.targetType,
            targetId: favorite.targetId
          }
        },
        update: {},
        create: {
          userId: user.id,
          targetType: favorite.targetType,
          targetId: favorite.targetId
        }
      })
      console.log('确保收藏存在：', favorite.targetType, favorite.targetId)
    }

    console.log('示例收藏已经准备好')
  } catch (error) {
    console.error('添加示例收藏失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addSampleFavorites()
