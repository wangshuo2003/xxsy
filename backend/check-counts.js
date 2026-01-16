
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const types = ['赛事', '研学', '实践', '公益'];
  
  console.log('Checking activity counts by type (isApproved=true):');
  for (const type of types) {
    const count = await prisma.activity.count({
      where: {
        type: type,
        isApproved: true
      }
    });
    console.log(`${type}: ${count}`);
  }
  
  console.log('\nChecking all activities (isApproved=true):');
  const allApproved = await prisma.activity.count({
    where: { isApproved: true }
  });
  console.log(`Total Approved: ${allApproved}`);

  console.log('\nChecking first 5 approved activities:');
  const activities = await prisma.activity.findMany({
    where: { isApproved: true },
    take: 5,
    select: { id: true, name: true, type: true, isApproved: true }
  });
  console.log(JSON.stringify(activities, null, 2));
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
