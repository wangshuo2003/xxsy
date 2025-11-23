const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createMultipleUsers() {
  const password = '1';
  const hashedPassword = await bcrypt.hash(password, 10);

  const rolesToCreate = [
    { role: 'SUPER_ADMIN', count: 10, prefix: 'superadmin' },
    { role: 'ACTIVITY_ADMIN', count: 10, prefix: 'activityadmin' },
    { role: 'STUDENT', count: 10, prefix: 'student' },
  ];

  console.log('开始创建多用户...');

  for (const { role, count, prefix } of rolesToCreate) {
    for (let i = 1; i <= count; i++) {
      const username = `${prefix}${i}`;
      const name = `${role === 'SUPER_ADMIN' ? '超级管理员' : role === 'ACTIVITY_ADMIN' ? '活动管理员' : '学生'}${i}`;
      const phone = `13${String(Math.floor(Math.random() * 1000000000)).padStart(9, '0')}`; // Generate a random 11-digit phone number

      try {
        const existingUser = await prisma.user.findUnique({
          where: { username },
        });

        if (!existingUser) {
          await prisma.user.create({
            data: {
              username,
              password: hashedPassword,
              name,
              phone,
              role,
              school: '测试学校',
              grade: '测试年级',
              className: '测试班级',
            },
          });
          console.log(`✅ 成功创建 ${role} 用户: ${username}`);
        } else {
          console.log(`⚠️ 用户 ${username} 已存在，跳过创建。`);
        }
      } catch (error) {
        console.error(`❌ 创建 ${role} 用户 ${username} 失败:`, error);
      }
    }
  }

  console.log('\n🎉 多用户创建完成。');
  console.log(`所有用户密码均为: ${password}`);

  await prisma.$disconnect();
}

createMultipleUsers();
