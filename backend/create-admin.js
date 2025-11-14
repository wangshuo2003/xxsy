const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('123456', 10)

    // 检查并更新admin用户为超级管理员
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' }
    })

    if (existingAdmin) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          role: 'SUPER_ADMIN',
          password: hashedPassword,
          name: '超级管理员'
        }
      })
      console.log('✅ 已更新admin用户为超级管理员')
    } else {
      // 如果不存在则创建
      await prisma.user.create({
        data: {
          username: 'admin',
          password: hashedPassword,
          name: '超级管理员',
          phone: '13800000000',
          role: 'SUPER_ADMIN',
          school: '系统管理'
        }
      })
      console.log('✅ 已创建admin超级管理员账户')
    }

    // 检查并创建基地管理员账户
    const existingBaseAdmin = await prisma.user.findUnique({
      where: { username: 'baseadmin' }
    })

    if (!existingBaseAdmin) {
      await prisma.user.create({
        data: {
          username: 'baseadmin',
          password: hashedPassword,
          name: '基地管理员',
          phone: '13800000001',
          role: 'ADMIN',
          school: '管理'
        }
      })
      console.log('✅ 已创建baseadmin管理员账户')
    }

    console.log('\n🎉 管理员账户信息:')
    console.log('超级管理员 - 用户名: admin, 密码: 123456')
    console.log('管理员 - 用户名: baseadmin, 密码: 123456')
    console.log('\n📝 使用超级管理员账户登录管理端: http://localhost:5173')

  } catch (error) {
    console.error('❌ 操作失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()