const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const competitions = [
  {
    name: '全国青少年科技创新大赛',
    description: '面向全国中小学生的综合性科技竞赛，旨在培养青少年的创新精神和实践能力。参赛者需提交创新项目，经过初赛、复赛和决赛三个阶段的评选。',
    time: new Date('2025-11-15T09:00:00'),
    location: '北京国家会议中心',
    maxPeople: 500
  },
  {
    name: '数学奥林匹克竞赛',
    description: '国际数学奥林匹克中国区选拔赛，考察学生的数学思维能力和解题技巧。竞赛分为初中组和高中组，题目涵盖代数、几何、数论等多个领域。',
    time: new Date('2025-10-20T14:00:00'),
    location: '上海交通大学',
    maxPeople: 300
  },
  {
    name: '英语演讲比赛',
    description: '提升学生英语口语表达能力和演讲技巧的专业比赛。参赛者需进行命题演讲和即兴演讲两个环节，由专业评委现场打分。',
    time: new Date('2025-11-05T10:00:00'),
    location: '广州外国语学校',
    maxPeople: 150
  },
  {
    name: '机器人编程挑战赛',
    description: '基于Arduino和Scratch的机器人编程竞赛，参赛队伍需要在规定时间内完成机器人的组装和编程，完成指定任务。培养学生的编程思维和团队协作能力。',
    time: new Date('2025-11-25T09:30:00'),
    location: '深圳科技馆',
    maxPeople: 200
  },
  {
    name: '中华传统文化知识竞赛',
    description: '以中国传统文化为主题的知识竞赛，内容涵盖古诗词、历史、书法、国画等方面。通过竞赛形式弘扬中华优秀传统文化。',
    time: new Date('2025-12-01T14:00:00'),
    location: '杭州文化艺术中心',
    maxPeople: 250
  },
  {
    name: '青少年足球联赛',
    description: '城市级青少年足球比赛，分为U12、U15两个年龄组。采用小组赛+淘汰赛制，培养学生的体育精神和团队合作意识。',
    time: new Date('2025-10-28T08:00:00'),
    location: '成都体育中心',
    maxPeople: 400
  },
  {
    name: '化学实验技能大赛',
    description: '考察学生化学实验操作能力和安全意识的专业竞赛。参赛者需完成指定实验，包括物质鉴定、定量分析等项目。',
    time: new Date('2025-11-18T13:00:00'),
    location: '武汉大学化学学院',
    maxPeople: 120
  },
  {
    name: '创意写作大赛',
    description: '激发学生文学创作热情的写作竞赛，分为小说、散文、诗歌三个类别。优秀作品将有机会在知名文学刊物上发表。',
    time: new Date('2025-12-10T10:00:00'),
    location: '南京师范大学',
    maxPeople: 300
  },
  {
    name: '物理实验创新赛',
    description: '鼓励学生设计和完成创新性物理实验的竞赛。参赛者需提交实验方案、完成实验并进行现场展示和答辩。',
    time: new Date('2025-11-22T09:00:00'),
    location: '西安交通大学',
    maxPeople: 180
  },
  {
    name: '环保主题绘画比赛',
    description: '以环境保护为主题的绘画创作比赛，旨在提高学生的环保意识。作品形式不限，包括水彩、素描、漫画等。',
    time: new Date('2025-12-05T14:00:00'),
    location: '重庆美术馆',
    maxPeople: 200
  },
  {
    name: '历史情景剧表演赛',
    description: '通过情景剧表演再现历史场景的创意比赛。参赛团队需自选历史主题，编写剧本并进行舞台表演，寓教于乐。',
    time: new Date('2025-11-28T15:00:00'),
    location: '天津大剧院',
    maxPeople: 150
  },
  {
    name: '地理知识竞答赛',
    description: '测试学生地理知识储备的竞赛活动，内容包括中国地理、世界地理、地理科学等。采用个人赛和团体赛相结合的形式。',
    time: new Date('2025-12-08T10:00:00'),
    location: '长沙理工大学',
    maxPeople: 220
  },
  {
    name: '3D打印设计大赛',
    description: '运用3D建模软件进行创意设计的科技竞赛。参赛者需完成作品设计并使用3D打印机制作实物，展示创新思维。',
    time: new Date('2025-11-12T09:00:00'),
    location: '苏州工业园区',
    maxPeople: 160
  },
  {
    name: '生物标本制作大赛',
    description: '考察学生生物学知识和动手能力的专业竞赛。参赛者需制作植物标本或昆虫标本，并进行科学分类和标注。',
    time: new Date('2025-12-15T13:30:00'),
    location: '厦门大学生命科学学院',
    maxPeople: 100
  },
  {
    name: '校园歌手大赛',
    description: '展示学生音乐才华的歌唱比赛，分为独唱、合唱、组合等多个类别。通过海选、复赛、决赛层层选拔优秀选手。',
    time: new Date('2025-11-08T18:00:00'),
    location: '郑州大学音乐厅',
    maxPeople: 300
  },
  {
    name: '网络安全技能挑战赛',
    description: 'CTF（Capture The Flag）形式的网络安全竞赛，考察学生的计算机安全技能。题目涵盖Web安全、密码学、逆向工程等领域。',
    time: new Date('2025-12-20T09:00:00'),
    location: '哈尔滨工业大学',
    maxPeople: 250
  },
  {
    name: '传统手工艺制作赛',
    description: '传承和弘扬传统手工艺的比赛活动，包括剪纸、编织、陶艺等项目。参赛者现场制作作品，展示传统技艺。',
    time: new Date('2025-11-30T10:00:00'),
    location: '济南文化宫',
    maxPeople: 180
  },
  {
    name: '篮球技能挑战赛',
    description: '测试篮球基本功和技术的单项比赛，包括投篮、运球、传球等项目。适合各水平学生参加，提升篮球技能。',
    time: new Date('2025-10-25T14:00:00'),
    location: '青岛体育馆',
    maxPeople: 200
  },
  {
    name: '无人机竞速大赛',
    description: '操控无人机进行竞速飞行的科技竞赛。参赛者需在设定赛道上以最快速度完成飞行，考验操控技术和反应能力。',
    time: new Date('2025-12-12T09:30:00'),
    location: '大连高新技术园区',
    maxPeople: 150
  },
  {
    name: '辩论赛总决赛',
    description: '高水平的学生辩论赛事，辩题涵盖社会、科技、教育等热点话题。培养学生的逻辑思维、语言表达和团队协作能力。',
    time: new Date('2025-12-18T15:00:00'),
    location: '南昌大学',
    maxPeople: 120
  }
]

async function main() {
  try {
    // 查找第一个已批准的基地
    const approvedBase = await prisma.base.findFirst({
      where: { isApproved: true }
    })

    if (!approvedBase) {
      console.log('没有找到已批准的基地，正在创建示例基地...')

      // 查找超级管理员
      const superAdmin = await prisma.user.findFirst({
        where: { role: 'SUPER_ADMIN' }
      })

      if (!superAdmin) {
        console.error('错误：未找到超级管理员用户')
        return
      }

      // 创建一个基地
      const newBase = await prisma.base.create({
        data: {
          name: '青少年活动中心',
          type: '综合实践基地',
          address: '北京市海淀区中关村大街1号',
          contact: '010-12345678',
          description: '提供各类青少年教育实践活动的综合性基地',
          isActive: true,
          isApproved: true,
          createdBy: superAdmin.id
        }
      })

      console.log('已创建示例基地:', newBase.name)

      // 使用新创建的基地
      return createActivities(newBase, superAdmin)
    }

    // 查找创建者
    const creator = await prisma.user.findFirst({
      where: {
        OR: [
          { role: 'SUPER_ADMIN' },
          { role: 'ACTIVITY_ADMIN' }
        ]
      }
    })

    if (!creator) {
      console.error('错误：未找到管理员用户')
      return
    }

    return createActivities(approvedBase, creator)
  } catch (error) {
    console.error('发生错误:', error)
    throw error
  }
}

async function createActivities(base, creator) {
  console.log(`使用基地: ${base.name} (ID: ${base.id})`)
  console.log(`创建者: ${creator.name} (ID: ${creator.id})`)

  let createdCount = 0

  for (const comp of competitions) {
    try {
      const activity = await prisma.activity.create({
        data: {
          ...comp,
          type: '赛事活动',
          isActive: true,
          isApproved: true,
          baseId: base.id,
          createdBy: creator.id
        }
      })

      createdCount++
      console.log(`✓ 已创建: ${activity.name}`)
    } catch (error) {
      console.error(`✗ 创建失败 "${comp.name}":`, error.message)
    }
  }

  console.log(`\n成功创建 ${createdCount}/${competitions.length} 个赛事活动`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
