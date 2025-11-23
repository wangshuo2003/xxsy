const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const activityTypes = ['赛事', '研学', '实践', '公益'];

const randomPrice = () => Math.floor(Math.random() * 200 + 80);
const randomCapacity = () => Math.floor(Math.random() * 25 + 25);
const randomFutureDate = (offsetDays) => {
  const base = new Date();
  base.setDate(base.getDate() + offsetDays);
  base.setHours(9, 0, 0, 0);
  return base;
};

async function createActivitiesForBases() {
  try {
    console.log('开始为基地创建活动...');

    const bases = await prisma.base.findMany({
      where: { isApproved: true, isActive: true },
      select: { id: true, name: true, address: true },
    });

    if (bases.length === 0) {
      throw new Error('未找到任何可用基地，请先创建基地。');
    }

    const creator = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    if (!creator) {
      throw new Error('未找到超级管理员账号，请先创建用户。');
    }

    let activityCount = 0;
    let dateOffset = 10; // Starting offset for activity dates

    for (const base of bases) {
      for (const type of activityTypes) {
        const activityName = `${base.name} - ${type}活动${activityCount + 1}`;
        const description = `这是一个在${base.name}举办的${type}活动。`;

        try {
          // Check if an activity with the same name already exists to prevent duplicates
          const existingActivity = await prisma.activity.findFirst({
            where: { name: activityName },
          });

          if (existingActivity) {
            console.log(`⚠️  活动《${activityName}》已存在，跳过创建。`);
            continue;
          }

          await prisma.activity.create({
            data: {
              name: activityName,
              description: description,
              type: type,
              price: randomPrice(),
              time: randomFutureDate(dateOffset),
              location: base.address,
              maxPeople: randomCapacity(),
              baseId: base.id,
              createdBy: creator.id,
              isApproved: true,
              isActive: true,
            },
          });
          console.log(`✅ 已为基地【${base.name}】创建活动：《${activityName}》`);
          activityCount++;
          dateOffset += 1; // Increment date offset for next activity
        } catch (error) {
          console.error(`❌ 为基地【${base.name}】创建活动《${activityName}》失败:`, error);
        }
      }
    }

    console.log(`\n🎉 共创建 ${activityCount} 个新活动。`);
  } catch (error) {
    console.error('❌ 创建活动失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createActivitiesForBases();
