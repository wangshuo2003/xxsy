const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function updatePasswords() {
  try {
    // 更新admin密码
    const adminHash = await bcrypt.hash('admin', 10)
    await prisma.user.update({
      where: { username: 'admin' },
      data: { password: adminHash }
    })
    console.log('admin密码已更新为: admin')

    // 更新baseadmin密码
    const baseAdminHash = await bcrypt.hash('baseadmin', 10)
    await prisma.user.update({
      where: { username: 'baseadmin' },
      data: { password: baseAdminHash }
    })
    console.log('baseadmin密码已更新为: baseadmin')

    // 更新student密码
    const studentHash = await bcrypt.hash('student', 10)
    await prisma.user.update({
      where: { username: 'student' },
      data: { password: studentHash }
    })
    console.log('student密码已更新为: student')

    console.log('所有密码更新完成！')
  } catch (error) {
    console.error('密码更新失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updatePasswords()