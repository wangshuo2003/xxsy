const prisma = require('./src/config/database')

async function testConnection() {
  try {
    await prisma.user.findMany({ take: 1 })
    console.log('数据库连接成功')
  } catch (error) {
    console.error('数据库连接失败:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
