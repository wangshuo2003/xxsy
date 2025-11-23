const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function initUsers() {
  try {
    console.log('开始初始化用户数据...');

    const accounts = [
      {
        username: 'a',
        password: '1',
        name: '超级管理员',
        phone: '13800138000',
        role: 'SUPER_ADMIN'
      },
      {
        username: 'b',
        password: '1',
        name: '基地管理员',
        phone: '13800138001',
        role: 'ACTIVITY_ADMIN'
      },
      {
        username: 's',
        password: '1',
        name: '学生用户',
        phone: '13800138002',
        role: 'STUDENT',
        school: '测试学校',
        grade: '三年级'
      }
    ];

    for (const account of accounts) {
      const existingUser = await prisma.user.findUnique({
        where: { username: account.username }
      });

      if (existingUser) {
        console.log(`ℹ️ 用户已存在: ${account.username}`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(account.password, 10);
      const user = await prisma.user.create({
        data: {
          ...account,
          password: hashedPassword
        }
      });
      console.log('✅ 创建用户成功:', user.username);
    }

    console.log('\n🎉 用户初始化完成！');
    console.log('\n可用的测试账户：');
    accounts.forEach((account) => {
      console.log(`${account.name} (${account.role}): ${account.username} / ${account.password}`);
    });

  } catch (error) {
    console.error('❌ 初始化用户失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initUsers();
