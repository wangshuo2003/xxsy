const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const categoryDefinitions = [
  {
    type: '科技研学',
    activities: [
      { name: '量子未来探索营', description: '体验量子计算可视化实验，理解量子叠加与纠缠在真实世界的应用。' },
      { name: '星链卫星通信站', description: '搭建微型卫星通信模型，了解低轨卫星网络原理并完成地面站调试。' },
      { name: '仿生机械实验室', description: '以昆虫仿生为灵感设计机械结构，完成一个可行动力装置。' },
      { name: '新能源无人农场', description: '操控光伏、风能驱动的无人农具，探索智能农业全流程。' },
      { name: 'XR 沉浸交互工坊', description: '利用 VR/AR 工具制作一段互动式科普体验，输出沉浸式展示成果。' }
    ]
  },
  {
    type: '社会实践',
    activities: [
      { name: '夜间经济观察派', description: '调研夜市与文旅综合体，形成夜间经济活力提升建议。' },
      { name: '零碳社区行动组', description: '对社区碳排进行评估，设计零碳生活倡议并落地试点。' },
      { name: '少年议事会·公共交通', description: '模拟人大提案流程，围绕公交线路优化提交调查报告。' },
      { name: '智慧养老体验营', description: '走访智慧养老中心，设计适老化科技解决方案。' },
      { name: '韧性城市防灾营', description: '参与社区防灾地图绘制与物资仓储排查，提升公共安全意识。' }
    ]
  },
  {
    type: '公益服务',
    activities: [
      { name: '山野护林志愿季', description: '参与山地防火巡护、动植物记录并建立护林日记。' },
      { name: '无障碍城市微改造', description: '协助测绘盲道、坡道等设施现状，提出优化方案并推动改造。' },
      { name: '水源地净滩行动', description: '在城市水库或河畔实施净滩计划，制作水质监测简报。' },
      { name: '青少年心理守护站', description: '与社工一起设计心理关怀活动，输出情绪支持手册。' },
      { name: '流动书屋点亮计划', description: '筹建流动阅读角，为乡村儿童策划主题阅读活动。' }
    ]
  },
  {
    type: '文化体验',
    activities: [
      { name: '丝路器乐共创营', description: '学习丝路民族乐器，与乐团合作完成跨文化演奏。' },
      { name: '古城数字修复所', description: '利用 3D 扫描与建模技术，对古城遗迹进行数字化还原。' },
      { name: '青瓷釉色实验室', description: '探索传统青瓷配方，调试专属釉色并烧制纪念作品。' },
      { name: '方志故事影像课', description: '查阅地方方志，编写家乡故事脚本并拍摄微纪录片。' },
      { name: '书法与汉字美学周', description: '跟随书法名师研习碑帖，设计一份现代汉字视觉海报。' }
    ]
  }
]

const randomPrice = () => Math.floor(Math.random() * 200 + 80)
const randomCapacity = () => Math.floor(Math.random() * 25 + 25)
const randomFutureDate = (offsetDays) => {
  const base = new Date()
  base.setDate(base.getDate() + offsetDays)
  base.setHours(9, 0, 0, 0)
  return base
}

async function main () {
  try {
    const bases = await prisma.base.findMany({
      where: { isApproved: true, isActive: true },
      orderBy: { id: 'asc' },
      select: { id: true, name: true }
    })

    if (bases.length < 4) {
      console.error('❌ 可用基地不足 4 个，请先运行 createSampleBases 或自行添加基地。')
      return
    }

    const creator = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true }
    })

    if (!creator) {
      console.error('❌ 未找到超级管理员账号，请先初始化用户。')
      return
    }

    let baseIndex = 0
    let offset = 5
    const createdActivities = []

    for (const category of categoryDefinitions) {
      for (const activityTemplate of category.activities) {
        const base = bases[baseIndex % bases.length]
        baseIndex += 1

        const existing = await prisma.activity.findFirst({
          where: { name: activityTemplate.name }
        })

        if (existing) {
          console.log(`⚠️  已存在同名活动《${activityTemplate.name}》，跳过创建。`)
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

        offset += 3
        createdActivities.push({ name: activity.name, category: category.type, base: base.name })
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
