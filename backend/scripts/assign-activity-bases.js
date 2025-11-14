const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function assignBasesToActivities() {
  try {
    const bases = await prisma.base.findMany({
      where: { isActive: true, isApproved: true },
      select: { id: true },
      orderBy: { id: 'asc' }
    })

    if (!bases.length) {
      throw new Error('当前没有可用的基地，请先创建或激活基础数据。')
    }

    const activities = await prisma.activity.findMany({
      select: { id: true },
      orderBy: { id: 'asc' }
    })

    if (!activities.length) {
      console.log('未找到任何活动，无需调整。')
      return
    }

    const updates = []
    let baseIndex = 0

    for (const activity of activities) {
      const targetBase = bases[baseIndex % bases.length]
      updates.push(
        prisma.activity.update({
          where: { id: activity.id },
          data: { baseId: targetBase.id }
        })
      )
      baseIndex += 1
    }

    await Promise.all(updates)
    console.log(`✅ 已将 ${activities.length} 个活动重新关联到 ${bases.length} 个基地。`)
  } catch (error) {
    console.error('❌ 调整活动基地信息失败：', error)
  } finally {
    await prisma.$disconnect()
  }
}

assignBasesToActivities()
