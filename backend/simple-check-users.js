const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function simpleCheckUsers() {
  try {
    console.log('=== 检查数据库用户信息 ===\n');

    const users = await prisma.user.findMany({
      where: {},
      select: {
        id: true,
        username: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`找到 ${users.length} 个用户:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. 用户名: '${user.username || 'NULL'}', 手机: '${user.phone || 'NULL'}', 角色: '${user.role || 'NULL'}', 姓名: '${user.name || 'NULL'}`);
    });

    // 特意查看管理员用户
    const adminUsers = users.filter(user => ['SUPER_ADMIN', 'ADMIN'].includes(user.role));
    console.log(`\n管理员用户 (${adminUsers.length} 个):`);
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. 用户名: '${user.username || 'NULL'}', 手机: '${user.phone || 'NULL'}', 角色: '${user.role || 'NULL'}', 姓名: '${user.name || 'NULL'}`);
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('检查用户失败:', error);
  }
}

simpleCheckUsers().catch(console.error);