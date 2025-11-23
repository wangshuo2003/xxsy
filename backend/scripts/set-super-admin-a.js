const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function setSuperAdminA() {
  const username = 'a'
  const password = '1'
  const hashedPassword = await bcrypt.hash(password, 10)

  try {
    let user = await prisma.user.findUnique({
      where: { username: username }
    })

    if (user) {
      // Update existing user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          name: user.name || '超级管理员A', // Keep existing name or set a default
          phone: user.phone || '10000000000' // Keep existing phone or set a default
        }
      })
      console.log(`✅ 已更新用户 ${username} 为超级管理员，密码已设置为 ${password}`)
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          username: username,
          password: hashedPassword,
          name: '超级管理员A',
          phone: '10000000000', // Default phone number
          role: 'SUPER_ADMIN',
          school: '系统管理'
        }
      })
      console.log(`✅ 已创建超级管理员账户 ${username}，密码为 ${password}`)
    }
    console.log('\n🎉 超级管理员账户信息:')
    console.log(`用户名: ${username}, 密码: ${password}`)
    console.log('\n📝 使用此账户登录管理端: http://localhost:5173')

  } catch (error) {
    console.error('❌ 操作失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setSuperAdminA()
