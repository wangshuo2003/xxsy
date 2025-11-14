const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function fixPasswords() {
  try {
    // 修改admin密码为 "admin"
    const adminPassword = await bcrypt.hash('1', 10)
    await prisma.user.update({
      where: { username: 'admin' },
      data: { password: adminPassword }
    })
    console.log('Admin密码已修改为: admin')

    // 修改baseadmin密码为 "baseadmin"
    const baseAdminPassword = await bcrypt.hash('1', 10)
    await prisma.user.update({
      where: { username: 'baseadmin' },
      data: { password: baseAdminPassword }
    })
    console.log('BaseAdmin密码已修改为: baseadmin')

    // 修改student密码为 "student"
    const studentPassword = await bcrypt.hash('1', 10)
    await prisma.user.update({
      where: { username: 'student' },
      data: { password: studentPassword }
    })
    console.log('Student密码已修改为: student')

    console.log('所有密码修改完成!')
  } catch (error) {
    console.error('修改密码失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixPasswords()