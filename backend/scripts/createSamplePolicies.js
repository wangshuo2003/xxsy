const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const samplePolicies = [
  {
    title: '关于开展2025年冬季公益实践活动的通知',
    tags: '公益,实践,寒假',
    content: '为丰富学生寒假生活，决定在全市范围内组织冬季公益实践活动。请各学校积极发动学生报名，活动内容涵盖敬老助残、社区服务、环保宣传等。'
  },
  {
    title: '青少年科创节报名指南',
    tags: '科技,创新,赛事',
    content: '2025年青少年科创节现已启动，设立人工智能、机器人、生命科学等专题展区。请各单位于11月30日前完成学生报名。'
  },
  {
    title: '关于加强研学旅行安全管理的通知',
    tags: '研学,安全,管理',
    content: '为确保研学旅行安全有序开展，各学校需严格执行备案制度、风险评估和应急预案，强化带队教师培训。'
  },
  {
    title: '教育实践平台系统升级公告',
    tags: '系统,升级,公告',
    content: '平台将于11月20日0:00-6:00进行功能升级，届时暂停登录、报名等操作。请合理安排使用时间。'
  },
  {
    title: '2025年春季营地教育项目征集',
    tags: '营地教育,项目征集',
    content: '现向各基地征集2025年春季营地教育项目，内容需突出劳动教育、国防教育或科学探索主题。'
  },
  {
    title: '关于推进劳育课程与基地实践深度融合的通知',
    tags: '劳动教育,基地实践',
    content: '提出“课堂+基地”的劳育模式，鼓励学校与基地共建劳动课程，提升学生劳动素养。'
  },
  {
    title: '志愿服务时长认定新规',
    tags: '志愿服务,时长认定',
    content: '自2025年起，志愿时长需通过平台活动签到、照片上传等方式核验，方可计入个人档案。'
  },
  {
    title: '关于举办“传统文化月”活动的通知',
    tags: '传统文化,活动',
    content: '12月将举办为期一个月的传统文化系列活动，包含非遗体验、民俗讲堂、国学朗诵等内容，欢迎各学校组织学生参加。'
  },
  {
    title: '学生信息安全管理提醒',
    tags: '信息安全,隐私',
    content: '请各单位妥善保管学生账号，活动报名、资料上传等敏感操作需严格控制权限，防止信息泄露。'
  },
  {
    title: '关于开通“家长旁听”功能的通知',
    tags: '家校共育,功能上线',
    content: '平台新增家长旁听入口，家长可查看学生活动报名信息、实践报告等，共同关注成长。'
  },
  {
    title: '寒假社会调查项目发布',
    tags: '社会调查,寒假',
    content: '围绕“城市公共服务体验”“社区环保观察”等主题开展社会调查，学生可自由组队报名。'
  },
  {
    title: '基地星级评定实施方案',
    tags: '基地管理,评定',
    content: '将从安全保障、课程质量、服务评价等方面对实践基地进行星级评定，结果纳入年度考核。'
  },
  {
    title: '关于开展心理健康主题活动的通知',
    tags: '心理健康,活动',
    content: '拟在12月组织“阳光成长”心理健康系列活动，包括团辅课程、减压工作坊和主题讲座等。'
  },
  {
    title: '教师实践课程培训安排',
    tags: '教师培训,课程设计',
    content: '12月上旬将举办实践课程设计培训班，邀请专家分享项目化学习、跨学科融合案例，每校限报2人。'
  },
  {
    title: '关于加强活动过程性评价的通知',
    tags: '评价体系,过程记录',
    content: '要求各活动记录学生参与过程，注重过程性评价结果的采集与反馈，丰富成长档案。'
  },
  {
    title: '平台实名认证规则更新',
    tags: '实名认证,规则更新',
    content: '学生需通过学校统一导入或上传身份证明进行实名认证，未认证账号将限制报名高等级活动。'
  },
  {
    title: '关于征集优秀实践案例的通知',
    tags: '案例征集,经验分享',
    content: '面向各学校征集2024年度优秀实践教育案例，入选案例将纳入市级资源库并在平台展示。'
  },
  {
    title: '校外实践交通安全提示',
    tags: '交通安全,提示',
    content: '近期天气寒冷，道路结冰，请活动组织者做好交通安全研判，加强出行安排和家长告知。'
  },
  {
    title: '新春公益义卖活动计划',
    tags: '公益,义卖',
    content: '鼓励学生利用手工、绘画等作品参与公益义卖，所得款项全部捐赠至青少年发展基金。'
  },
  {
    title: '劳动技能达标考核方案',
    tags: '劳动技能,考核',
    content: '发布劳动技能达标内容，包括整理收纳、烹饪基础、植物养护等，学生可在基地完成考核。'
  }
]

async function main() {
  try {
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' }
    })

    if (!superAdmin) {
      console.error('未找到超级管理员账号，请先初始化用户')
      return
    }

    let createdCount = 0

    for (const [index, policy] of samplePolicies.entries()) {
      const existing = await prisma.policy.findFirst({
        where: { title: policy.title }
      })

      if (existing) {
        await prisma.policy.update({
          where: { id: existing.id },
          data: {
            content: policy.content,
            tags: policy.tags,
            isDraft: false,
            sortOrder: index + 1,
            createdBy: superAdmin.id
          }
        })
        console.log(`✓ 已更新通知：${policy.title}`)
      } else {
        await prisma.policy.create({
          data: {
            title: policy.title,
            content: policy.content,
            tags: policy.tags,
            isDraft: false,
            sortOrder: index + 1,
            createdBy: superAdmin.id
          }
        })
        console.log(`✓ 已创建通知：${policy.title}`)
      }

      createdCount += 1
    }

    console.log(`\n示例通知已就绪，共 ${createdCount} 条`)
  } catch (error) {
    console.error('创建示例通知失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
