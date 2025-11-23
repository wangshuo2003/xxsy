const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createSampleBases() {
  try {
    console.log('开始创建示例基地...')

    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })

    if (!superAdmin) {
      throw new Error('未发现超级管理员账号，请先创建用户')
    }

    const activityAdmin = await prisma.user.findFirst({
      where: { role: 'ACTIVITY_ADMIN' }
    })

    if (!activityAdmin) {
      throw new Error('未发现活动管理员账号，请先创建用户')
    }

    const createdById = superAdmin.id
    const managerId = activityAdmin.id

    const numberOfBasesToCreate = 40;

    for (let i = 1; i <= numberOfBasesToCreate; i++) {
      const baseName = `基地${i}`;
              const baseData = {
                name: baseName,
                type: `类型${i % 5}`, // Cycle through 5 types
                address: `地址${i}`,
                contact: `139${String(i).padStart(8, '0')}`, // Unique contact number
                description: `这是关于${baseName}的描述。`,
                isApproved: true,
                isActive: true,
                createdBy: createdById
              };
      try {
        const existing = await prisma.base.findFirst({
          where: { name: baseName }
        });

        if (existing) {
          await prisma.base.update({
            where: { id: existing.id },
            data: {
              ...baseData,
              admins: {
                set: [{ id: managerId }]
              }
            }
          });
          console.log('🔄 已更新基地信息：', baseName);
        } else {
          await prisma.base.create({
            data: {
              ...baseData,
              admins: {
                connect: { id: managerId }
              }
            }
          });
          console.log('✅ 已创建示例基地：', baseName);
        }
      } catch (error) {
        console.error(`❌ 创建基地 ${baseName} 失败：`, error);
      }
    }

    const count = await prisma.base.count()
    console.log(`\n🎉 目标基地创建完毕/存在，共 ${count} 个基地`)
  } catch (error) {
    console.error('❌ 创建示例基地失败：', error)
  } finally {
    await prisma.$disconnect()
  }
}

createSampleBases()
