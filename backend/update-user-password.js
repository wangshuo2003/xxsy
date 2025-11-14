const bcrypt = require('bcryptjs')
const prisma = require('./src/config/database')

async function updateUserPassword() {
  try {
    console.log('查找用户ID为1的用户...')

    // 查找用户ID为1的用户
    const user = await prisma.user.findUnique({
      where: { id: 1 }
    })

    if (!user) {
      console.log('未找到用户ID为1的用户')
      return
    }

    console.log('找到用户:', user.username, user.name)

    // 将密码 "1" 加密
    const hashedPassword = await bcrypt.hash('1', 10)

    // 更新密码
    await prisma.user.update({
      where: { id: 1 },
      data: { password: hashedPassword }
    })

    console.log('用户1的密码已成功更新为 "1"')

  } catch (error) {
    console.error('更新密码失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateUserPassword()