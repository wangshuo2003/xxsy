const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createStudent() {
  try {
    const hashedPassword = await bcrypt.hash('123456', 10);

    const existingStudent = await prisma.user.findUnique({
      where: { username: 'student' }
    });

    if (!existingStudent) {
      await prisma.user.create({
        data: {
          username: 'student',
          password: hashedPassword,
          name: '学生用户',
          phone: '13800000002',
          role: 'STUDENT',
          school: '测试学校',
          grade: '高三年级'
        }
      });
      console.log('✅ 已创建student学生用户账户');
    }

    console.log('\n📚 学生账户信息:');
    console.log('学生用户 - 用户名: student, 密码: 123456');

  } catch (error) {
    console.error('❌ 创建失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createStudent();