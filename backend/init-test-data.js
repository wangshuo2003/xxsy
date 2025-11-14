const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function initTestData() {
  try {
    console.log('🚀 开始初始化测试数据...');

    // 获取管理员用户
    const admin = await prisma.user.findUnique({ where: { username: 'baseadmin' } });
    const superAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });

    if (!admin || !superAdmin) {
      console.error('❌ 缺少管理员账户，请先运行 create-admin.js');
      return;
    }

    console.log('📍 创建测试基地...');

    // 创建多个测试基地
    const bases = [];
    for (let i = 1; i <= 31; i++) {
      const base = await prisma.base.create({
        data: {
          name: `测试基地${i}`,
          type: ['教育实践基地', '研学基地', '实训基地', '创业基地'][i % 4],
          address: `测试地址${i}号街道`,
          contact: `联系电话${i}`,
          description: `这是第${i}个测试基地的详细描述信息。该基地提供丰富的实践教学资源，为学生提供优质的教育服务。`,
          isActive: i <= 25, // 前25个启用，后6个禁用
          isApproved: i <= 28, // 前28个已通过，后3个待审核
          createdBy: superAdmin.id,
          managerId: i <= 5 ? admin.id : null // 前5个设置管理员
        }
      });
      bases.push(base);
    }

    console.log(`✅ 已创建 ${bases.length} 个测试基地`);

    console.log('📍 创建测试活动...');

    // 为前20个基地创建活动
    for (let i = 0; i < Math.min(20, bases.length); i++) {
      const base = bases[i];
      const activityCount = Math.floor(Math.random() * 3) + 2; // 每个基地2-4个活动

      for (let j = 0; j < activityCount; j++) {
        const activity = await prisma.activity.create({
          data: {
            name: `${base.name}-活动${j + 1}`,
            type: ['研学活动', '实践活动', '公益活动', '特色活动'][j % 4],
            description: `${base.name}的${j + 1}号活动，包含丰富的实践内容和教育意义。`,
            time: new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000), // 未来30天内随机时间
            location: `${base.address}-活动场地${j + 1}`,
            maxPeople: Math.floor(Math.random() * 50) + 20, // 20-70人
            isActive: Math.random() > 0.3, // 70%概率启用
            isApproved: Math.random() > 0.2, // 80%概率通过
            baseId: base.id,
            createdBy: admin.id
          }
        });
        console.log(`  ✅ 创建活动: ${activity.name}`);
      }
    }

    console.log('📍 创建轮播图...');

    // 创建轮播图
    const carouselImages = [
      'https://picsum.photos/800/400?random=1',
      'https://picsum.photos/800/400?random=2',
      'https://picsum.photos/800/400?random=3',
      'https://picsum.photos/800/400?random=4',
      'https://picsum.photos/800/400?random=5'
    ];

    for (let i = 0; i < carouselImages.length; i++) {
      await prisma.carousel.create({
        data: {
          title: `轮播图标题${i + 1}`,
          imageUrl: carouselImages[i],
          linkUrl: i % 2 === 0 ? `https://example.com/carousel${i + 1}` : null,
          isActive: true,
          sortOrder: i,
          createdBy: superAdmin.id
        }
      });
    }

    console.log(`✅ 已创建 ${carouselImages.length} 个轮播图`);

    console.log('📍 创建政策通知...');

    // 创建政策通知
    const policies = [
      {
        title: '教育实践基地管理办法',
        content: '为规范教育实践基地的建设和管理，提高实践教学质量，特制定本管理办法。各教育实践基地应严格按照本办法执行，确保实践教学活动有序开展。',
        tags: '政策法规',
        isDraft: false,
        sortOrder: 1
      },
      {
        title: '研学旅行安全指南',
        content: '为确保研学旅行活动安全有序开展，保障学生人身安全，各相关单位应严格遵守以下安全指南。活动组织方需制定详细的安全预案，确保活动全过程的安全可控。',
        tags: '安全指导',
        isDraft: false,
        sortOrder: 2
      },
      {
        title: '实践教育成果展示要求',
        content: '为充分展示实践教育成果，促进各基地间的经验交流，特制定本成果展示要求。各单位应按要求准备相关材料，确保成果展示的质量和效果。',
        tags: '成果展示',
        isDraft: false,
        sortOrder: 3
      }
    ];

    for (let i = 0; i < policies.length; i++) {
      await prisma.policy.create({
        data: {
          ...policies[i],
          createdBy: superAdmin.id
        }
      });
    }

    console.log(`✅ 已创建 ${policies.length} 个政策通知`);

    console.log('📍 创建成果展示...');

    // 创建成果展示
    const achievements = [
      {
        title: '优秀学生实践成果展',
        content: '本次展示的优秀学生实践成果，充分体现了学生在实践教育活动中的收获和成长。通过实践活动，学生们不仅掌握了专业知识，还培养了团队协作能力和创新思维。',
        tags: '学生成果',
        isDraft: false
      },
      {
        title: '校企合作创新项目',
        content: '该项目展示了学校与企业合作的创新成果，通过产教融合的模式，为学生提供了更贴近实际需求的学习环境。项目成果已在实际应用中取得良好效果。',
        tags: '校企合作',
        isDraft: false
      }
    ];

    for (let i = 0; i < achievements.length; i++) {
      await prisma.achievement.create({
        data: {
          ...achievements[i],
          createdBy: superAdmin.id
        }
      });
    }

    console.log(`✅ 已创建 ${achievements.length} 个成果展示`);

    console.log('📍 创建服务项目...');

    // 创建服务项目
    const services = [
      {
        title: '省白名单赛事培训',
        description: '专门针对省白名单赛事的专业培训课程，帮助学生更好地准备和参加各类重要赛事。',
        tags: '省白名单赛事',
        coverImage: 'https://picsum.photos/400/300?random=1',
        price: 299.00,
        maxPeople: 50,
        endTime: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60天后
        isActive: true,
        isHot: true,
        sortOrder: 1
      },
      {
        title: '社会实践项目',
        description: '提供丰富的社会实践机会，让学生在真实环境中学习和成长，培养社会责任感和实践能力。',
        tags: '社会实践',
        coverImage: 'https://picsum.photos/400/300?random=2',
        price: 199.00,
        maxPeople: 30,
        endTime: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), // 45天后
        isActive: true,
        isHot: false,
        sortOrder: 2
      },
      {
        title: '特色研学营',
        description: '结合本地特色的研学活动，让学生在实践中学习传统文化和现代科技的融合发展。',
        tags: '研学活动',
        coverImage: 'https://picsum.photos/400/300?random=3',
        price: 399.00,
        maxPeople: 25,
        endTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
        isActive: true,
        isHot: true,
        sortOrder: 3
      }
    ];

    for (let i = 0; i < services.length; i++) {
      await prisma.service.create({
        data: {
          ...services[i],
          createdBy: superAdmin.id
        }
      });
    }

    console.log(`✅ 已创建 ${services.length} 个服务项目`);

    // 最终统计
    const finalStats = await prisma.$transaction([
      prisma.base.count(),
      prisma.activity.count(),
      prisma.carousel.count(),
      prisma.policy.count(),
      prisma.achievement.count(),
      prisma.service.count()
    ]);

    console.log('\n🎉 测试数据初始化完成！');
    console.log('📊 数据统计:');
    console.log(`  基地数量: ${finalStats[0]}`);
    console.log(`  活动数量: ${finalStats[1]}`);
    console.log(`  轮播图数量: ${finalStats[2]}`);
    console.log(`  政策通知数量: ${finalStats[3]}`);
    console.log(`  成果展示数量: ${finalStats[4]}`);
    console.log(`  服务项目数量: ${finalStats[5]}`);

  } catch (error) {
    console.error('❌ 初始化失败:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

initTestData();