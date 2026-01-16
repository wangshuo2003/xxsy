const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('开始种子数据初始化...')

  // 创建超级管理员
  const adminPassword = await bcrypt.hash('1', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: adminPassword
    },
    create: {
      username: 'admin',
      password: adminPassword,
      name: '超级管理员',
      phone: '13800138000',
      role: 'SUPER_ADMIN'
    }
  })
  console.log('超级管理员创建成功:', admin)
  console.log('超级管理员ID:', admin.id)

  // 创建示例基地管理员
  const baseAdminPassword = await bcrypt.hash('1', 10)
  const baseAdmin = await prisma.user.upsert({
    where: { username: 'baseadmin' },
    update: {
      password: baseAdminPassword
    },
    create: {
      username: 'baseadmin',
      password: baseAdminPassword,
      name: '基地管理员',
      phone: '13800138001',
      role: 'ACTIVITY_ADMIN'
    }
  })
  console.log('基地管理员创建成功:', baseAdmin)
  console.log('基地管理员ID:', baseAdmin.id)

  // 创建示例学生用户
  const studentPassword = await bcrypt.hash('1', 10)
  const student = await prisma.user.upsert({
    where: { username: 'student' },
    update: {
      password: studentPassword
    },
    create: {
      username: 'student',
      password: studentPassword,
      name: '张三',
      phone: '13800138002',
      school: '示例小学',
      grade: '六年级',
      role: 'STUDENT'
    }
  })
  console.log('学生用户创建成功:', student)

  // 创建额外示例学生用户: s, s1, s2
  const extraStudents = ['s', 's1', 's2']
  for (const username of extraStudents) {
    const pwd = await bcrypt.hash('1', 10)
    const user = await prisma.user.upsert({
      where: { username },
      update: {
        password: pwd
      },
      create: {
        username,
        password: pwd,
        name: `学生${username}`,
        phone: `138001380${username === 's' ? '03' : (username === 's1' ? '04' : '05')}`,
        school: '示例小学',
        grade: '六年级',
        role: 'STUDENT'
      }
    })
    console.log(`学生用户 ${username} 创建成功:`, user)
  }

  // 创建示例基地
  let base1 = await prisma.base.findFirst({ where: { name: '科技创新基地' } })
  if (!base1) {
    base1 = await prisma.base.create({
      data: {
        name: '科技创新基地',
        type: '科技创新',
        address: '北京市朝阳区科技路1号',
        contact: '010-12345678',
        description: '专注于青少年科技创新教育',
        isApproved: true,
              isActive: true,
              User_creator: {
                connect: { id: admin.id }
              },
              admins: {
                connect: { id: baseAdmin.id }
              }
            }
          })
    console.log('示例基地创建成功:', base1)
  } else {
    console.log('示例基地已存在:', base1.name)
  }
  console.log('示例基地ID:', base1.id)

  // 创建示例轮播图
  let carousel1 = await prisma.carousel.findFirst({ where: { title: '欢迎来到教育实践平台' } })
  if (!carousel1) {
    carousel1 = await prisma.carousel.create({
      data: {
        title: '欢迎来到教育实践平台',
        imageUrl: '/uploads/carousels/default1.jpg',
        linkUrl: '#',
        isActive: true,
        sortOrder: 1,
        createdBy: admin.id
      }
    })
    console.log('示例轮播图创建成功:', carousel1)
  }

  // 创建示例政策通知
  let policy1 = await prisma.policy.findFirst({ where: { title: '关于加强青少年实践教育的通知' } })
  if (!policy1) {
    policy1 = await prisma.policy.create({
      data: {
        title: '关于加强青少年实践教育的通知',
        content: '为贯彻落实教育部门关于加强青少年实践教育的相关要求...',
        tags: '教育政策,实践教育',
        isDraft: false,
        sortOrder: 1,
        createdBy: admin.id
      }
    })
    console.log('示例政策通知创建成功:', policy1)
  }

  // 创建示例服务项目
  let service1 = await prisma.service.findFirst({ where: { title: '编程思维训练营' } })
  if (!service1) {
    service1 = await prisma.service.create({
      data: {
        title: '编程思维训练营',
        description: '通过趣味编程学习，培养孩子们的逻辑思维能力',
        tags: '编程,科技创新',
        price: 299.00,
        maxPeople: 20,
        endTime: new Date('2024-12-31'),
        isHot: true,
        isActive: true,
        sortOrder: 1,
        createdBy: admin.id
      }
    })
    console.log('示例服务项目创建成功:', service1)
  }

  // 创建更多示例政策通知
  let policy2 = await prisma.policy.findFirst({ where: { title: '2024年寒假研学活动安全指南' } })
  if (!policy2) {
    policy2 = await prisma.policy.create({
      data: {
        title: '2024年寒假研学活动安全指南',
        content: '为了确保寒假期间研学活动的顺利进行，保障师生安全，请各单位严格遵守以下规定...',
        tags: '安全指南,寒假',
        isDraft: false,
        sortOrder: 2,
        createdBy: admin.id
      }
    })
    console.log('示例政策通知2创建成功:', policy2)
  }

  let policy3 = await prisma.policy.findFirst({ where: { title: '关于开展"小小科学家"评选活动的通知' } })
  if (!policy3) {
    policy3 = await prisma.policy.create({
      data: {
        title: '关于开展"小小科学家"评选活动的通知',
        content: '本年度"小小科学家"评选活动即将开始，请各基地积极推荐优秀学员参加...',
        tags: '评选活动,科技',
        isDraft: false,
        sortOrder: 3,
        createdBy: admin.id
      }
    })
    console.log('示例政策通知3创建成功:', policy3)
  }

  // 创建示例活动
  let activity1 = await prisma.activity.findFirst({ where: { name: '人工智能初体验' } })
  if (!activity1) {
    activity1 = await prisma.activity.create({
      data: {
        name: '人工智能初体验',
        type: '研学活动',
        description: '适合零基础的小学生，体验AI的乐趣，学习基础编程概念。',
        time: new Date('2024-07-15'),
        location: '科技创新基地A区',
        maxPeople: 30,
        baseId: base1.id,
        createdBy: admin.id,
        isApproved: true,
        isActive: true
      }
    })
    console.log('示例活动1创建成功:', activity1)
  }

  let activity2 = await prisma.activity.findFirst({ where: { name: '小小植物学家' } })
  if (!activity2) {
    activity2 = await prisma.activity.create({
      data: {
        name: '小小植物学家',
        type: '实践活动',
        description: '探索植物的奥秘，制作植物标本，学习生态保护知识。',
        time: new Date('2024-07-20'),
        location: '科技创新基地植物园',
        maxPeople: 25,
        baseId: base1.id,
        createdBy: admin.id,
        isApproved: true,
        isActive: true
      }
    })
    console.log('示例活动2创建成功:', activity2)
  }

  let activity3 = await prisma.activity.findFirst({ where: { name: '非遗文化手工坊' } })
  if (!activity3) {
    activity3 = await prisma.activity.create({
      data: {
        name: '非遗文化手工坊',
        type: '公益活动',
        description: '学习传统剪纸艺术，感受非物质文化遗产的魅力。',
        time: new Date('2024-08-05'),
        location: '科技创新基地文化教室',
        maxPeople: 20,
        baseId: base1.id,
        createdBy: admin.id,
        isApproved: true,
        isActive: true
      }
    })
    console.log('示例活动3创建成功:', activity3)
  }

  console.log('种子数据初始化完成!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
