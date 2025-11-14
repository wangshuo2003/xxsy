const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const categoryDefinitions = [
  {
    label: '科技研学',
    type: '研学',
    activities: [
      { name: '低空无人机测绘营', description: '学习无人机编程与航测流程，完成一次校园数字地图建模。' },
      { name: '量子视觉艺术实验', description: '用量子随机算法生成艺术作品，体验科技与美学融合。' },
      { name: '深海仿生机器人挑战', description: '基于海洋生物特性进行仿生结构设计，完成遥控机器人任务。' }
    ]
  },
  {
    label: '社会实践',
    type: '实践',
    activities: [
      { name: '城市更新观察手记', description: '实地记录旧城微更新案例，输出一份图文故事手册。' },
      { name: '可持续校园公约营', description: '通过调研制定环境友好约定，并在校园内试点推广。' },
      { name: '公共艺术共创实践', description: '联合社区完成一面“城市记忆墙”，展示多元文化。' }
    ]
  },
  {
    label: '公益服务',
    type: '公益',
    activities: [
      { name: '星火读书陪伴团', description: '为留守儿童策划阅读课堂并录制睡前故事音频。' },
      { name: '城市雨水守护行动', description: '巡检排水设施，宣传雨洪治理知识，绘制雨水地图。' },
      { name: '食物银行分拣志愿营', description: '参与食物捐赠分拣、保质检测与配送流程。' }
    ]
  },
  {
    label: '文化体验',
    type: '赛事',
    activities: [
      { name: '篆刻印章设计坊', description: '学习篆刻字体与刀法，完成一枚具有个人印记的印章。' },
      { name: '民族乐舞编创营', description: '体验多民族音乐舞蹈元素，编排一段跨文化作品。' },
      { name: '传统服饰图纹实验室', description: '研究各地服饰纹样，并进行现代图纹再设计。' }
    ]
  }
]

const randomPrice = () => Math.floor(Math.random() * 150 + 60)
const randomCapacity = () => Math.floor(Math.random() * 20 + 20)
const randomFutureDate = (offsetDays) => {
  const base = new Date()
  base.setDate(base.getDate() + offsetDays)
  base.setHours(10, 0, 0, 0)
  return base
}

async function main () {
  try {
    const bases = await prisma.base.findMany({
      where: { isApproved: true, isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, name: true }
    })

    if (!bases.length) {
      console.error('❌ 无可用基地，请先创建并审批基地。')
      return
    }

    const creator = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true }
    })

    if (!creator) {
      console.error('❌ 未找到超级管理员账号。')
      return
    }

    let baseIndex = 0
    let offset = 7
    const createdActivities = []

    for (const category of categoryDefinitions) {
      for (const activityTemplate of category.activities) {
        const base = bases[baseIndex % bases.length]
        baseIndex += 1

        const existing = await prisma.activity.findFirst({
          where: { name: activityTemplate.name }
        })

        if (existing) {
          console.log(`⚠️  活动《${activityTemplate.name}》已存在，跳过。`)
          continue
        }

        const activity = await prisma.activity.create({
          data: {
            name: activityTemplate.name,
            description: activityTemplate.description,
            type: category.type,
            price: randomPrice(),
            time: randomFutureDate(offset),
            location: `${base.name} · 主题馆`,
            maxPeople: randomCapacity(),
            baseId: base.id,
            createdBy: creator.id,
            isApproved: true,
            isActive: true
          }
        })

        offset += 4
        createdActivities.push({ name: activity.name, type: category.type, base: base.name })
        console.log(`✅ 已创建【${category.type}】活动：《${activity.name}》 -> 基地：${base.name}`)
      }
    }

    console.log(`\n🎉 共创建 ${createdActivities.length} 个新活动。`)
  } catch (error) {
    console.error('❌ 创建活动失败：', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
