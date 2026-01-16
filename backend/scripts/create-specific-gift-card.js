const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createSpecificGiftCard() {
  const cardCode = '1';
  const amount = 500;
  const totalUses = 100;
  const expiresAt = new Date('2027-12-31T23:59:59Z'); // End of day 2027.12.31

  console.log('开始创建指定礼品卡...');

  try {
    const existingGiftCard = await prisma.giftCard.findUnique({
      where: { cardCode },
    });

    if (existingGiftCard) {
      console.log(`⚠️ 礼品卡 ${cardCode} 已存在，跳过创建。`);
      // Optionally update if it exists
      await prisma.giftCard.update({
        where: { cardCode },
        data: {
          amount,
          totalUses,
          expiresAt,
          isUsed: false, // Reset if it was used
          usedCount: 0,
          usedBy: null,
          usedAt: null,
        },
      });
      console.log(`🔄 礼品卡 ${cardCode} 已更新。`);
    } else {
      await prisma.giftCard.create({
        data: {
          cardCode,
          amount,
          totalUses,
          expiresAt,
          isUsed: false,
          usedCount: 0,
        },
      });
      console.log(`✅ 成功创建礼品卡: ${cardCode}, 金额: ${amount}, 可用次数: ${totalUses}, 到期日: ${expiresAt.toISOString()}`);
    }
  } catch (error) {
    console.error(`❌ 创建/更新礼品卡 ${cardCode} 失败:`, error);
  } finally {
    await prisma.$disconnect();
  }
}

createSpecificGiftCard();
