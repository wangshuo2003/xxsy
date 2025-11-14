const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

const MAX_RETRIES = parseInt(process.env.DB_MAX_RETRIES || '5', 10)
const RETRY_DELAY = parseInt(process.env.DB_RETRY_DELAY || '2000', 10)

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const connectDB = async () => {
  let attempt = 0
  while (attempt < MAX_RETRIES) {
    try {
      await prisma.$connect()
      console.log('数据库连接成功')
      return
    } catch (error) {
      attempt++
      console.error(`数据库连接失败 (第${attempt}次):`, error.message)
      if (attempt >= MAX_RETRIES) {
        console.error('超过最大重试次数，退出进程')
        process.exit(1)
      }
      console.log(`等待 ${RETRY_DELAY}ms 后重试...`)
      await delay(RETRY_DELAY)
    }
  }
}

connectDB()

module.exports = prisma
