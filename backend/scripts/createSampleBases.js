const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createSampleBases() {
  try {
    console.log('开始创建示例基地...')

    const admin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })

    if (!admin) {
      throw new Error('未发现超级管理员账号，请先初始化用户')
    }

    const baseAdmin = await prisma.user.findFirst({
      where: { username: 'baseadmin' }
    })

    const managerId = baseAdmin ? baseAdmin.id : admin.id

    const templates = [
      {
        name: '未来科技实践基地',
        type: '科技创新',
        address: '北京市朝阳区未来路1号',
        contact: '010-10000001',
        description: '聚焦人工智能、机器人等科技前沿的综合实践场所'
      },
      {
        name: '红色文化传承基地',
        type: '文化实践',
        address: '北京市昌平区红色街道5号',
        contact: '010-10000002',
        description: '以红色文化为主题，开展青少年国史教育与实践'
      },
      {
        name: '生态农业体验基地',
        type: '农业实践',
        address: '河北省廊坊市生态园区8号',
        contact: '0316-8888001',
        description: '依托现代农业园，体验生态种植与农业科技'
      },
      {
        name: '海洋探索实践基地',
        type: '科技研学',
        address: '山东省青岛市海洋路10号',
        contact: '0532-8888002',
        description: '结合海洋馆与海洋学院资源，开展探索型研学'
      },
      {
        name: '数字艺术创作基地',
        type: '艺术实践',
        address: '广州市天河区创意园12号',
        contact: '020-8888003',
        description: '以数字媒体与创意实践为特色的艺术实验空间'
      },
      {
        name: '国际交流实践基地',
        type: '国际实践',
        address: '上海市浦东新区世纪大道18号',
        contact: '021-8888004',
        description: '引入国际合作项目，培养跨文化视野的青少年'
      },
      {
        name: '传统工艺体验基地',
        type: '文化实践',
        address: '苏州市姑苏区民艺路3号',
        contact: '0512-8888005',
        description: '融合非遗手工艺展示与实践工作坊'
      },
      {
        name: '绿色能源体验基地',
        type: '科技实践',
        address: '浙江省杭州市未来科技城7号',
        contact: '0571-8888006',
        description: '以清洁能源为主题的科技探索与研学活动'
      },
      {
        name: '城市规划模拟基地',
        type: '社会实践',
        address: '重庆市渝北区规划大道21号',
        contact: '023-8888007',
        description: '通过模拟城市规划与公共管理体验，培养治理能力'
      },
      {
        name: '生命科学探索基地',
        type: '科技研学',
        address: '湖北省武汉市光谷大道22号',
        contact: '027-8888008',
        description: '依托科研机构，让学生亲历生物科技前沿项目'
      }
    ]

    for (const template of templates) {
      const existing = await prisma.base.findFirst({
        where: { name: template.name }
      })

      if (existing) {
        await prisma.base.update({
          where: { id: existing.id },
          data: {
            ...template,
            isApproved: true,
            isActive: true,
            managerId,
            createdBy: admin.id
          }
        })
        console.log('🔄 已更新基地信息：', template.name)
      } else {
        await prisma.base.create({
          data: {
            ...template,
            isApproved: true,
            isActive: true,
            managerId,
            createdBy: admin.id
          }
        })
        console.log('✅ 已创建示例基地：', template.name)
      }
    }

    const count = await prisma.base.count()
    console.log(`\n🎉 目标基地创建完毕/存在，共 ${count} 个基地`)
  } catch (error) {
    console.error('❌ 创建示例基地失败：', error)
  } finally {
    await prisma.$disconnect()
  }
}

createSampleBases()
