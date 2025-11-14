const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const activityPresets = {
  '赛事': [
    {
      name: '赛事免费体验营A',
      location: '市青少年体育中心',
      description: '0元赛事体验，重点培养团队协作与竞赛规则意识。'
    },
    {
      name: '赛事免费体验营B',
      location: '市体育馆副馆',
      description: '零基础也能参加的趣味赛事体验课程。'
    }
  ],
  '研学': [
    {
      name: '研学免费探索营A',
      location: '未来科技实验室',
      description: '通过研学任务体验跨学科探究，免费开放体验。'
    },
    {
      name: '研学免费探索营B',
      location: '科学教育示范基地',
      description: '项目制研学体验，完成任务即可获得电子证书。'
    }
  ],
  '实践': [
    {
      name: '实践免费成长营A',
      location: '城市公共实践基地',
      description: '围绕社区议题开展的0元实践课程。'
    },
    {
      name: '实践免费成长营B',
      location: '综合素养实践中心',
      description: '聚焦动手能力与项目协作的实践体验。'
    }
  ],
  '公益': [
    {
      name: '公益免费志愿营A',
      location: '公益服务站',
      description: '面向青少年的公益志愿体验活动。'
    },
    {
      name: '公益免费志愿营B',
      location: '社区志愿服务中心',
      description: '通过公益行动培养责任意识与沟通能力。'
    }
  ]
}

async function getBaseForActivity(type) {
  const matchedBase = await prisma.base.findFirst({
    where: {
      isApproved: true,
      isActive: true,
      OR: [
        { type: { contains: type } },
        { name: { contains: type } }
      ]
    }
  })

  if (matchedBase) return matchedBase

  const fallbackBase = await prisma.base.findFirst({
    where: { isApproved: true, isActive: true },
    orderBy: { id: 'asc' }
  })

  if (!fallbackBase) {
    throw new Error('未找到可用基地，请先创建并审核至少一个基地。')
  }

  return fallbackBase
}

async function main() {
  const adminUser = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
    orderBy: { id: 'asc' }
  })

  const creatorId = adminUser?.id ?? null

  for (const [type, activities] of Object.entries(activityPresets)) {
    const base = await getBaseForActivity(type)

    for (let index = 0; index < activities.length; index++) {
      const preset = activities[index]
      const existing = await prisma.activity.findFirst({
        where: { name: preset.name }
      })

      if (existing) {
        console.log(`[跳过] ${preset.name} 已存在（ID: ${existing.id}）`)
        continue
      }

      const activityDate = new Date()
      activityDate.setDate(activityDate.getDate() + (index + 1) * 7)
      activityDate.setHours(10, 0, 0, 0)

      const created = await prisma.activity.create({
        data: {
          name: preset.name,
          type,
          description: preset.description,
          time: activityDate,
          location: preset.location,
          maxPeople: 30,
          price: 0,
          isActive: true,
          isApproved: true,
          baseId: base.id,
          createdBy: creatorId
        }
      })

      console.log(`[创建成功] ${created.name} -> 基地: ${base.name} (#${base.id})`)
    }
  }

  console.log('✅ 所有免费活动创建完成')
}

main()
  .catch((error) => {
    console.error('❌ 创建免费活动失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
