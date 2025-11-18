const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createBaseAdmins() {
  try {
    console.log('🚀 开始为基地创建管理员账号...');

    const bases = await prisma.base.findMany();
    if (bases.length === 0) {
      console.log('🤷 没有找到任何基地，无需创建管理员。');
      return;
    }

    const hashedPassword = await bcrypt.hash('1', 10);

    for (const base of bases) {
      if (base.managerId) {
        const manager = await prisma.user.findUnique({ where: { id: base.managerId } });
        if (manager) {
          console.log(`ℹ️ 基地 "${base.name}" 已有关联的管理员: ${manager.username}`);
          continue;
        } else {
          console.log(`⚠️ 基地 "${base.name}" 的管理员ID ${base.managerId} 无效，将为其创建新管理员。`);
        }
      }

      const adminUsername = `base${base.id}_admin`;
      const adminName = `${base.name} 管理员`;
      const adminPhone = `199${String(base.id).padStart(8, '0')}`;

      let adminUser = await prisma.user.findUnique({
        where: { username: adminUsername },
      });

      if (!adminUser) {
        // To avoid unique constraint violation on phone, check if it exists
        const existingPhoneUser = await prisma.user.findUnique({ where: { phone: adminPhone } });
        if (existingPhoneUser) {
            console.error(`❌ 电话号码 ${adminPhone} 已被用户 ${existingPhoneUser.username} 使用，无法为基地 "${base.name}" 创建管理员。请手动处理。`);
            continue;
        }

        adminUser = await prisma.user.create({
          data: {
            username: adminUsername,
            password: hashedPassword,
            name: adminName,
            phone: adminPhone,
            role: 'ACTIVITY_ADMIN',
            school: base.name, // Using base name for school field
          },
        });
        console.log(`✅ 已为基地 "${base.name}" 创建新的管理员账号: ${adminUsername}，密码: 1`);
      } else {
        console.log(`ℹ️ 管理员账号 ${adminUsername} 已存在，将直接关联。`);
      }

      await prisma.base.update({
        where: { id: base.id },
        data: { managerId: adminUser.id },
      });
      console.log(`🔗 已将管理员 ${adminUsername} 关联到基地 "${base.name}"`);
    }

    console.log('\n🎉 所有基地均已配置管理员！');

  } catch (error) {
    console.error('❌ 操作失败:', error);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 数据库连接已断开');
  }
}

createBaseAdmins();
