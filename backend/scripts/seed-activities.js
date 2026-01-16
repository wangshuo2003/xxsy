const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

// 示例活动数据模板
const researchActivities = [
  { name: "航天科技研学营", desc: "深入了解中国航天发展历程，体验模拟航天器操作，学习航天科技知识。" },
  { name: "古建筑文化研学", desc: "探访古建筑群，学习传统建筑工艺，体验古代文化智慧。" },
  { name: "海洋生态科学考察", desc: "出海进行海洋生物观察，学习海洋生态系统，参与环保实践。" },
  { name: "机器人编程研学", desc: "学习机器人原理和编程技术，参与机器人设计制作和比赛。" },
  { name: "中医药文化探秘", desc: "参观中医药博物馆，学习中药知识，体验传统针灸文化。" },
  { name: "现代农业科技研学", desc: "参观现代化农场，学习智能农业技术，体验农业科技应用。" },
  { name: "人工智能实验室", desc: "进入AI实验室，学习机器学习原理，开发AI应用项目。" },
  { name: "地质科考探险", desc: "进行地质勘探，学习矿物知识，参与化石挖掘工作。" },
  { name: "非物质文化遗产研学", desc: "学习传统手工艺，参观非遗作坊，体验文化传承。" },
  { name: "天文学观测研学", desc: "使用专业天文设备，观测星空，学习天体物理知识。" },
  { name: "生物基因科学研学", desc: "进入生物实验室，学习基因技术，参与科学实验。" },
  { name: "纳米材料科学考察", desc: "参观纳米材料研究所，学习新材料技术，参与实验。" },
  { name: "新能源技术研学", desc: "参观新能源企业，学习太阳能、风能技术，体验清洁能源。" },
  { name: "考古发掘体验", desc: "参与真实考古现场，学习文物修复，体验历史挖掘。" },
  { name: "虚拟现实科技研学", desc: "学习VR/AR技术，开发虚拟现实应用，体验未来科技。" },
  { name: "森林探索研学", desc: "深入自然探索生态系统，学习森林动植物知识。" },
  { name: "智能交通研学营", desc: "体验智能驾驶、无人车技术，了解未来交通。" },
  { name: "海岛生存挑战", desc: "在海岛进行野外生存训练，提升应急与团队能力。" }
]

const practicalActivities = [
  { name: "创新创业实践项目", desc: "参与创业孵化，学习商业模式设计，实践项目开发。" },
  { name: "社区志愿服务实践", desc: "参与社区建设，提供志愿服务，学习社会工作技能。" },
  { name: "工业生产实践", desc: "参观工厂生产线，学习制造工艺，参与产品制作。" },
  { name: "电商运营实践", desc: "学习电商平台运营，参与网络营销，实践销售技巧。" },
  { name: "环保项目实践", desc: "参与环保项目，学习垃圾分类，实践环保宣传。" },
  { name: "农村支教实践", desc: "前往农村学校支教，体验教育工作，实践教学方法。" },
  { name: "企业实习实践", desc: "进入企业实习，学习职场技能，实践工作流程。" },
  { name: "创新创业大赛", desc: "参与创业比赛，学习商业计划书，展示创新项目。" },
  { name: "社会工作实践", desc: "参与社会工作项目，学习社区管理，实践民生服务。" },
  { name: "农业生产实践", desc: "参与农业生产，学习农业技术，体验农耕文化。" },
  { name: "科技创新实践", desc: "参与科技研发项目，学习科研方法，实践技术创新。" },
  { name: "文化艺术实践", desc: "参与文艺创作，学习表演艺术，举办文化演出。" },
  { name: "体育竞技实践", desc: "参与体育训练，学习运动技能，参加体育比赛。" },
  { name: "国际贸易实践", desc: "学习跨境电商，参与国际贸易，实践商务谈判。" },
  { name: "金融理财实践", desc: "学习投资理财，参与金融项目，实践财富管理。" }
]

const volunteerActivities = [
  { name: "敬老院志愿服务", desc: "陪伴老人，帮助日常起居，组织娱乐活动，关爱老年人。" },
  { name: "儿童福利院支教", desc: "为孤儿辅导学业，组织游戏活动，提供心理辅导。" },
  { name: "环保宣传行动", desc: "宣传环保理念，组织清洁活动，倡导绿色生活方式。" },
  { name: "社区医疗服务", desc: "为社区居民提供义诊，健康咨询，普及医疗知识。" },
  { name: "助残帮扶活动", desc: "帮助残障人士，提供生活照料，组织康复训练。" },
  { name: "文物保护志愿", desc: "参与文物保护，学习修复技术，宣传文化遗产。" },
  { name: "应急救援演练", desc: "学习应急知识，参与救援演练，提升安全意识。" },
  { name: "扶贫助农活动", desc: "帮助农村发展，提供技术指导，促进农产品销售。" },
  { name: "动物保护志愿", desc: "参与动物救助，学习保护知识，倡导生态平衡。" },
  { name: "文化传承志愿", desc: "学习传统文化，参与非遗传承，组织文化展示。" },
  { name: "心理健康服务", desc: "提供心理咨询，组织心理活动，促进心理健康。" },
  { name: "法律援助志愿", desc: "提供法律咨询，协助法律程序，普及法律知识。" },
  { name: "教育支援项目", desc: "支教偏远地区，培训教师，改善教育条件。" },
  { name: "公共卫生志愿", desc: "参与疾病防控，宣传健康知识，提升公众意识。" },
  { name: "社区建设志愿", desc: "参与社区规划，改善居住环境，促进邻里和谐。" }
]

const competitionActivities = [
  { name: "青少年机器人挑战赛", desc: "展示机器人设计与编程能力，角逐科技之星。" },
  { name: "少儿编程创意大赛", desc: "发挥想象力，用代码创造趣味应用与游戏。" },
  { name: "数学思维能力竞赛", desc: "挑战数学难题，锻炼逻辑思维，提升解题能力。" },
  { name: "英语口语风采大赛", desc: "展示英语演讲才华，提升跨文化交流能力。" },
  { name: "科学实验操作比赛", desc: "动手进行科学实验，展示实验技能与科学素养。" },
  { name: "绘画书法艺术大赛", desc: "挥洒笔墨，描绘美好生活，传承中华艺术。" },
  { name: "小小演说家比赛", desc: "讲述中国故事，传递正能量，展现语言魅力。" },
  { name: "校园足球联赛", desc: "绿茵场上挥洒汗水，培养团队合作与拼搏精神。" },
  { name: "青少年合唱比赛", desc: "用歌声传递情感，感受音乐魅力，培养艺术修养。" },
  { name: "科技创新发明大赛", desc: "展示小发明小制作，激发创新灵感，解决实际问题。" }
]

// 随机生成更多变体
function generateVariants(baseData, count) {
  const result = []
  const timeSuffixes = ['春季', '夏季', '秋季', '冬季', '第一期', '第二期', '第三期', '进阶版', '基础班', '高级班']
  const locations = ['科技园区', '文化中心', '实践基地', '培训中心', '博物馆', '研究所', '实验室', '户外基地', '社区中心', '学校']

  for (let i = 0; i < count; i++) {
    const base = baseData[i % baseData.length]
    const suffix = timeSuffixes[Math.floor(Math.random() * timeSuffixes.length)]
    const location = locations[Math.floor(Math.random() * locations.length)]

    result.push({
      name: base.name,
      description: base.desc,
      location: `${location}${Math.floor(Math.random() * 100) + 1}号`,
      maxPeople: Math.floor(Math.random() * 50) + 20,
      daysFromNow: Math.floor(Math.random() * 60) + 1
    })
  }

  return result
}

async function seedActivities() {
  try {
    // console.log('开始清理现有活动数据...')

    // 删除所有现有活动
    // const deleteCount = await prisma.activity.deleteMany({})
    // console.log(`已删除 ${deleteCount.count} 个现有活动`)

    console.log('开始生成新的活动数据...')

    // 创建管理员用户（如果不存在）
    let admin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })

    if (!admin) {
      console.log('创建管理员用户...')
      const hashedPassword = await bcrypt.hash('1', 10)
      admin = await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@example.com',
          password: hashedPassword,
          name: '系统管理员',
          role: 'SUPER_ADMIN',
          phone: '13800138000',
          isActive: true
        }
      })
    }

    // 获取所有基地
    let bases = await prisma.base.findMany({
      select: { id: true, name: true }
    })

    if (bases.length === 0) {
      console.log('没有找到基地数据，正在创建示例基地...')

      await prisma.base.create({
        data: {
          name: '新时代综合实践基地',
          type: '综合实践',
          address: '示例街道 1 号',
          description: '用于展示系统功能的综合实践基地',
          isActive: true,
          isApproved: true,
          createdBy: admin.id
        }
      })

      bases = await prisma.base.findMany({
        select: { id: true, name: true }
      })

      console.log(`已创建 ${bases.length} 个示例基地`)
    }

    // 生成活动数据
    const researchActivities20 = generateVariants(researchActivities, 30)
    const practicalActivities20 = generateVariants(practicalActivities, 30)
    const volunteerActivities20 = generateVariants(volunteerActivities, 30)
    const competitionActivities20 = generateVariants(competitionActivities, 30)

    const allActivities = [
      ...researchActivities20.map(a => ({ ...a, type: '研学' })),
      ...practicalActivities20.map(a => ({ ...a, type: '实践' })),
      ...volunteerActivities20.map(a => ({ ...a, type: '公益' })),
      ...competitionActivities20.map(a => ({ ...a, type: '赛事' }))
    ]

    console.log(`准备创建 ${allActivities.length} 个活动...`)

    // 创建活动
    for (let i = 0; i < allActivities.length; i++) {
      const activity = allActivities[i]
      const base = bases[Math.floor(Math.random() * bases.length)]

      const time = new Date()
      time.setDate(time.getDate() + activity.daysFromNow)

      await prisma.activity.create({
        data: {
          name: activity.name,
          type: activity.type,
          description: activity.description,
          time: time,
          location: activity.location,
          maxPeople: activity.maxPeople,
          price: Math.floor(Math.random() * 200) + 1, // 随机价格 1-200
          baseId: base.id,
          createdBy: admin.id,
          isApproved: true,
          isActive: true
        }
      })

      if ((i + 1) % 10 === 0) {
        console.log(`已创建 ${i + 1}/${allActivities.length} 个活动...`)
      }
    }

    console.log('✅ 活动数据创建完成！')

    // 统计结果
    const stats = await prisma.activity.groupBy({
      by: ['type'],
      _count: { id: true }
    })

    console.log('\n📊 创建统计：')
    stats.forEach(stat => {
      console.log(`${stat.type}: ${stat._count.id} 个`)
    })

  } catch (error) {
    console.error('❌ 创建活动数据失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedActivities()
