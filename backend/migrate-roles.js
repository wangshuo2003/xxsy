const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function migrateRoles() {
  try {
    console.log('开始迁移用户角色...')

    // 更新所有BASE_ADMIN用户为ADMIN
    const updateResult = await prisma.user.updateMany({
      where: {
        role: 'BASE_ADMIN'
      },
      data: {
        role: 'ADMIN'
      }
    })

    console.log(`已将 ${updateResult.count} 个用户的角色从 BASE_ADMIN 更新为 ADMIN`)

    console.log('角色迁移完成！')
  } catch (error) {
    console.error('角色迁移失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

migrateRoles()