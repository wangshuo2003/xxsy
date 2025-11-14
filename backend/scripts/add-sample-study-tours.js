const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const studyTours = [
  {
    name: '智能交通研学营',
    description: '体验无人驾驶、智能地铁等现代交通技术，了解未来城市交通发展。',
    price: 35,
    type: '研学活动'
  },
  {
    name: '森林生态探索营',
    description: '深入森林学习生态系统知识，开展自然观察和户外生存训练。',
    price: 83,
    type: '研学活动'
  },
  {
    name: '海岛生存挑战营',
    description: '在海岛环境学习野外生存技能，提升团队协作与应急能力。',
    price: 72,
    type: '研学活动'
  }
]

async function main() {
  try {
    const base = await prisma.base.findFirst({ where: { isApproved: true } })
    if (!base) {
      console.error('未找到已批准的基地，请先执行createSampleBases脚本')
      return
    }

    const creator = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })

    if (!creator) {
      console.error('未找到超级管理员账号，请先初始化用户')
      return
    }

    for (const tour of studyTours) {
      const activity = await prisma.activity.create({
        data: {
          name: tour.name,
          description: tour.description,
          price: tour.price,
          type: tour.type,
          time: new Date(Date.now() + Math.floor(Math.random() * 20 + 5) * 24 * 3600 * 1000),
          location: `研学基地${Math.floor(Math.random() * 80) + 1}号`,
          maxPeople: Math.floor(Math.random() * 20) + 20,
          baseId: base.id,
          createdBy: creator.id,
          isApproved: true,
          isActive: true
        }
      })
      console.log('✓ 已创建研学活动:', activity.name, '价格: ¥' + activity.price)
    }
  } catch (error) {
    console.error('创建研学活动失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
