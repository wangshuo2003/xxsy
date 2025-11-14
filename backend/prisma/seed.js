const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('开始种子数据初始化...')

  // 创建超级管理员
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: adminPassword,
      name: '超级管理员',
      phone: '13800138000',
      role: 'SUPER_ADMIN'
    }
  })
  console.log('超级管理员创建成功:', admin)

  // 创建示例基地管理员
  const baseAdminPassword = await bcrypt.hash('base123', 10)
  const baseAdmin = await prisma.user.upsert({
    where: { username: 'baseadmin' },
    update: {},
    create: {
      username: 'baseadmin',
      password: baseAdminPassword,
      name: '基地管理员',
      phone: '13800138001',
      role: 'BASE_ADMIN'
    }
  })
  console.log('基地管理员创建成功:', baseAdmin)

  // 创建示例学生用户
  const studentPassword = await bcrypt.hash('student123', 10)
  const student = await prisma.user.upsert({
    where: { username: 'student' },
    update: {},
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

  // 创建示例基地
  const base1 = await prisma.base.create({
    data: {
      name: '科技创新基地',
      type: '科技创新',
      address: '北京市朝阳区科技路1号',
      contact: '010-12345678',
      description: '专注于青少年科技创新教育',
      isApproved: true,
      isActive: true,
      managerId: baseAdmin.id
    }
  })
  console.log('示例基地创建成功:', base1)

  // 创建示例轮播图
  const carousel1 = await prisma.carousel.create({
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

  // 创建示例政策通知
  const policy1 = await prisma.policy.create({
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

  // 创建示例服务项目
  const service1 = await prisma.service.create({
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