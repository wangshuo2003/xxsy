const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const testLogin = async () => {
  try {
    // 查找用户1
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: '1' },
          { phone: '1' }
        ]
      }
    })

    if (user) {
      console.log('找到用户:', {
        id: user.id,
        username: user.username,
        phone: user.phone,
        name: user.name,
        role: user.role,
        school: user.school
      })

      // 检查密码是否正确（简单测试，因为密码可能没有加密）
      if (user.password === '1') {
        console.log('✅ 密码确实重置为1')
      } else {
        console.log('❌ 密码不是1，当前密码:', user.password)
      }
    } else {
      console.log('❌ 没有找到用户1或手机号为1的用户')
    }

  } catch (error) {
    console.error('❌ 查询用户失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testLogin()