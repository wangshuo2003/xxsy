const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const sampleEvents = [
  {
    title: "全国青少年科技创新大赛",
    description: "面向全国中小学生的科技创新竞赛活动，鼓励学生发挥创新精神和实践能力，展示科技成果。",
    tags: "科技创新,省白名单赛事,竞赛",
    coverImage: "/uploads/events/tech-competition.jpg",
    price: 0,
    maxPeople: 200,
    endTime: new Date("2024-12-15T09:00:00Z"),
    videoUrl: null,
    fileUrl: null,
    isActive: true,
    isHot: true,
    sortOrder: 1,
    eventType: "COMPETITION",
    location: "北京国际会议中心",
    registerDeadline: new Date("2024-11-30T23:59:59Z"),
    eventRules: "1. 参赛对象：全国中小学生\n2. 参赛要求：提交科技创新作品\n3. 评审标准：创新性、实用性、科学性\n4. 奖项设置：一等奖、二等奖、三等奖",
    eventResults: "获奖作品将在官网公布，优秀作品推荐参加省级和国家级比赛。",
    createdBy: 1 // 假设管理员ID为1
  },
  {
    title: "人工智能编程体验营",
    description: "为期三天的AI编程体验活动，学习Python编程和机器学习基础知识，动手实践AI项目。",
    tags: "科技创新,人工智能,编程",
    coverImage: "/uploads/events/ai-camp.jpg",
    price: 299.00,
    maxPeople: 50,
    endTime: new Date("2024-11-25T18:00:00Z"),
    videoUrl: null,
    fileUrl: null,
    isActive: true,
    isHot: false,
    sortOrder: 2,
    eventType: "STUDY_TOUR",
    location: "上海市科技馆",
    registerDeadline: new Date("2024-11-20T23:59:59Z"),
    eventRules: "1. 参加年龄：12-18岁\n2. 需自带笔记本电脑\n3. 提供午餐和茶点\n4. 完成后颁发参与证书",
    eventResults: "参与者将完成AI小项目，获得编程实践经验和结业证书。",
    createdBy: 1
  },
  {
    title: "社区环保志愿服务活动",
    description: "组织学生参与社区环保志愿服务，包括垃圾分类宣传、植树活动、环保知识普及等。",
    tags: "公益活动,环保,志愿服务",
    coverImage: "/uploads/events/environmental-volunteer.jpg",
    price: 0,
    maxPeople: 100,
    endTime: new Date("2024-11-18T14:00:00Z"),
    videoUrl: null,
    fileUrl: null,
    isActive: true,
    isHot: false,
    sortOrder: 3,
    eventType: "PUBLIC_WELFARE",
    location: "中山公园",
    registerDeadline: new Date("2024-11-15T23:59:59Z"),
    eventRules: "1. 自愿参加\n2. 需家长同意\n3. 提供志愿服务时长证明\n4. 统一服装和工具",
    eventResults: "参与者获得志愿服务证书，表现优秀者将获得表彰。",
    createdBy: 1
  },
  {
    title: "农村教育调研实践",
    description: "深入农村学校开展教育调研活动，了解农村教育现状，参与支教帮扶，培养社会责任感。",
    tags: "社会实践,教育,调研",
    coverImage: "/uploads/events/rural-education.jpg",
    price: 0,
    maxPeople: 30,
    endTime: new Date("2024-12-08T17:00:00Z"),
    videoUrl: null,
    fileUrl: null,
    isActive: true,
    isHot: true,
    sortOrder: 4,
    eventType: "SOCIAL_PRACTICE",
    location: "安徽省金寨县",
    registerDeadline: new Date("2024-11-25T23:59:59Z"),
    eventRules: "1. 需要较强的适应能力\n2. 统一安排住宿\n3. 安全第一\n4. 需完成调研报告",
    eventResults: "形成农村教育调研报告，为教育改革提供参考，参与社会实践活动认证。",
    createdBy: 1
  },
  {
    title: "机器人大赛训练营",
    description: "专业的机器人大赛赛前培训，包括机器人组装、编程、调试等技能训练。",
    tags: "科技创新,机器人,竞赛培训",
    coverImage: "/uploads/events/robotics-training.jpg",
    price: 599.00,
    maxPeople: 40,
    endTime: new Date("2024-12-20T16:00:00Z"),
    videoUrl: null,
    fileUrl: null,
    isActive: true,
    isHot: true,
    sortOrder: 5,
    eventType: "COMPETITION",
    location: "深圳科技园",
    registerDeadline: new Date("2024-12-05T23:59:59Z"),
    eventRules: "1. 适合有一定编程基础的学生\n2. 提供机器人套件\n3. 专业导师指导\n4. 小组合作形式",
    eventResults: "学员组队参加省级机器人大赛，提升竞赛能力和团队合作精神。",
    createdBy: 1
  }
];

async function createSampleEvents() {
  try {
    console.log('开始创建示例赛事活动...');

    for (const event of sampleEvents) {
      const createdEvent = await prisma.service.create({
        data: event
      });
      console.log(`创建活动: ${createdEvent.title} (ID: ${createdEvent.id})`);
    }

    console.log('所有示例赛事活动创建完成！');

  } catch (error) {
    console.error('创建示例活动时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSampleEvents();