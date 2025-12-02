const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('1', 10)

    // 检查并更新admin用户为超级管理员
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'a' }
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
      console.log('✅ 已更新a用户为超级管理员')
    } else {
      // 如果不存在则创建
      await prisma.user.create({
        data: {
          username: 'a',
          password: hashedPassword,
          name: '超级管理员',
          phone: '13800000000',
          role: 'SUPER_ADMIN',
          school: '系统管理'
        }
      })
      console.log('✅ 已创建a超级管理员账户')
    }

    // 检查并创建基地管理员账户
    const existingBaseAdmin = await prisma.user.findUnique({
      where: { username: 'b' }
    })

    if (!existingBaseAdmin) {
      await prisma.user.create({
        data: {
          username: 'b',
          password: hashedPassword,
          name: '基地管理员',
          phone: '13800000001',
          role: 'ACTIVITY_ADMIN',
          school: '管理'
        }
      })
      console.log('✅ 已创建b管理员账户')
    }

    // 检查并创建学生用户
    const existingStudent = await prisma.user.findUnique({
      where: { username: 's' }
    })

    if (!existingStudent) {
      await prisma.user.create({
        data: {
          username: 's',
          password: hashedPassword,
          name: '学生用户',
          phone: '13800000002',
          role: 'STUDENT',
          school: '学生管理'
        }
      })
      console.log('✅ 已创建s学生用户')
    }

    console.log('\n🎉 管理员账户信息:')
    console.log('超级管理员 - 用户名: a, 密码: 1')
    console.log('管理员 - 用户名: b, 密码: 1')
    console.log('学生用户 - 用户名: s, 密码: 1')
    console.log('\n📝 使用超级管理员账户登录管理端: http://localhost:5173')

  } catch (error) {
    console.error('❌ 操作失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()