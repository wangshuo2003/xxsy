
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const activities = await prisma.activity.groupBy({
    by: ['type'],
    _count: {
      type: true
    }
  })
  console.log('Activity types in DB:', JSON.stringify(activities, null, 2))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
