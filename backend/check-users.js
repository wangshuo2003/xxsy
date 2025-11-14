const { PrismaClient } = require('@prisma/client');

async function checkUsers() {
  try {
    const prisma = new PrismaClient();

    console.log('=== 检查数据库用户信息 ===\n');

    // 查看所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true
      }
    });

    console.log('数据库中的所有用户:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. 用户名: '${user.username || 'NULL'}', 手机: '${user.phone || 'NULL'}', 角色: '${user.role || 'NULL'}', 姓名: '${user.name || 'NULL'}`);
    });

    // 特意查看管理员用户
    const adminUsers = users.filter(user => ['SUPER_ADMIN', 'ADMIN'].includes(user.role));
    console.log('\n管理员用户:');
    adminUsers.forEach((user, index) => {
      console.log(`${index + 1}. 用户名: '${user.username || 'NULL'}', 手机: '${user.phone || 'NULL'}', 角色: '${user.role || 'NULL'}', 姓名: '${user.name || 'NULL'}`);
    });

    // 查看密码信息
    const usersWithPassword = await prisma.user.findMany({
      select: {
        username: true,
        phone: true,
        password: true // 只在开发环境中显示密码
      }
    });

    console.log('\n用户名和密码对应关系:');
    usersWithPassword.forEach((user, index) => {
      if (user.username) {
        console.log(`${index + 1}. 用户名: '${user.username}' -> 密码: '${user.password}' (明文显示，仅用于开发环境)`);
      }
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('检查用户失败:', error);
  }
}

checkUsers();