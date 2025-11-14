require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('./src/config/database');

async function debugLogin() {
  try {
    console.log('=== 登录调试信息 ===');
    console.log('环境变量:');
    console.log('DATABASE_URL:', process.env.DATABASE_URL);
    console.log('JWT_SECRET:', process.env.JWT_SECRET);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('');

    // 查找admin用户
    console.log('查找admin用户...');
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: 'admin' },
          { phone: 'admin' }
        ]
      }
    });

    if (!user) {
      console.log('用户不存在');
      return;
    }

    console.log('找到用户:', {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    });

    // 验证密码
    console.log('\n验证密码...');
    const isValidPassword = await bcrypt.compare('admin', user.password);
    console.log('密码验证结果:', isValidPassword);

    if (!isValidPassword) {
      // 尝试其他常见密码
      const testPasswords = ['123456', 'password', 'admin123'];
      for (const pwd of testPasswords) {
        const valid = await bcrypt.compare(pwd, user.password);
        if (valid) {
          console.log(`找到正确密码: ${pwd}`);
          break;
        }
      }
    }

    // 生成JWT token
    console.log('\n生成JWT token...');
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET 未设置');
      return;
    }

    const token = jwt.sign(
      { userId: user.id },
      jwtSecret,
      { expiresIn: '7d' }
    );

    console.log('Token生成成功:', token.substring(0, 50) + '...');

    // 验证token
    console.log('\n验证token...');
    const decoded = jwt.verify(token, jwtSecret);
    console.log('Token验证成功:', decoded);

  } catch (error) {
    console.error('调试过程中出错:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

debugLogin();