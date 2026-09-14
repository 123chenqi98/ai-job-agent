import type { CandidateProfile, ExperienceItem } from '@/types'

/** 当前求职者画像（单人原型） */
export const candidateProfile: CandidateProfile = {
  candidate_id: 'cand-001',
  target_direction: '数据分析 / 智能商业分析（BI Agent）',
  preferred_cities: ['北京', '上海'],
  available_days_per_week: 5,
  available_months: 6,
  degree_level: '硕士在读',
  graduation_year: 2027,
  core_skills: [
    'SQL',
    'Python',
    'Excel',
    '统计学',
    'A/B Test',
    '指标体系',
    '用户分析',
    '数据可视化',
  ],
  tool_skills: [
    'MySQL',
    'Tableau（基础）',
    'FineBI',
    'Pandas',
    'LLM Prompt',
    'Agent 工作流',
  ],
  industry_interest: ['互联网', '电商', '本地生活', '内容社区'],
  must_avoid_conditions: ['每周出勤少于 4 天', '要求长期出差', '纯线下外地且无远程可能'],
  resume_master_id: 'resume-master-001',
}

/** 经历素材库：多版本简历的素材来源 */
export const experienceLibrary: ExperienceItem[] = [
  {
    experience_id: 'exp-001',
    experience_type: 'internship',
    title: '数据分析实习生',
    organization: '某本地生活互联网公司 · 增长分析团队',
    time_range: '2026.03 - 2026.07',
    summary:
      '负责商家端补贴活动的效果分析与用户分层运营，独立完成取数、归因与策略建议闭环。',
    tags: ['SQL', 'A/B Test', '用户分层', '活动分析', '业务闭环'],
    metrics: ['推动补贴 ROI 提升 12%', '输出 8 份周度分析报告', '支撑 3 次运营策略调整'],
    related_skills: ['SQL', 'A/B Test', '指标体系', '用户分析'],
    related_domains: ['本地生活', '增长', '商家运营'],
    proof_level: 'strong',
    resume_ready_bullets: [
      '搭建补贴活动 A/B 实验评估框架，基于双重差分归因，推动补贴 ROI 提升 12%。',
      '设计商家价值分层模型并落地运营策略，使高价值商家周活跃率提升 8.5%。',
      '沉淀补贴监控指标看板，将异常定位耗时从半天缩短至 30 分钟。',
    ],
  },
  {
    experience_id: 'exp-002',
    experience_type: 'project',
    title: '电商用户复购预测与流失分析',
    organization: '课程实战项目（公开数据集）',
    time_range: '2025.11 - 2026.01',
    summary:
      '基于电商交易数据构建复购预测模型，输出用户流失原因拆解与召回策略建议。',
    tags: ['Python', 'Pandas', '特征工程', '逻辑回归', 'XGBoost', '漏斗分析'],
    metrics: ['复购预测 AUC 0.83', '覆盖 12 万用户样本', '输出 3 类召回策略'],
    related_skills: ['Python', '统计学', '用户分析', '数据可视化'],
    related_domains: ['电商', '用户增长'],
    proof_level: 'medium',
    resume_ready_bullets: [
      '使用 Python（Pandas / XGBoost）完成 12 万用户的复购预测，模型 AUC 达 0.83。',
      '通过漏斗与 cohort 分析定位流失关键节点，提出 3 类召回策略并给出预期收益。',
    ],
  },
  {
    experience_id: 'exp-003',
    experience_type: 'project',
    title: '业务经营分析 BI 看板',
    organization: '个人项目',
    time_range: '2026.01 - 2026.02',
    summary:
      '面向业务负责人设计经营分析看板，覆盖收入、转化、留存核心指标，支持自助下钻。',
    tags: ['FineBI', 'Tableau', '指标体系', '可视化', '看板设计'],
    metrics: ['整合 6 张业务表', '搭建 3 个主题看板', '指标口径文档 1 份'],
    related_skills: ['指标体系', '数据可视化', 'SQL'],
    related_domains: ['经营分析', 'BI'],
    proof_level: 'medium',
    resume_ready_bullets: [
      '基于 FineBI 搭建经营分析看板，统一收入 / 转化 / 留存指标口径，支持业务自助下钻。',
      '梳理 6 张业务表的指标血缘并输出口径文档，减少跨团队口径争议。',
    ],
  },
  {
    experience_id: 'exp-004',
    experience_type: 'project',
    title: '基于 LLM 的自动化分析 Agent 工作流',
    organization: '个人探索项目',
    time_range: '2026.05 - 2026.08',
    summary:
      '设计「自然语言取数 + 自动归因」的分析 Agent，用 Prompt 编排 SQL 生成、校验与结论撰写。',
    tags: ['LLM', 'Prompt Engineering', 'Agent', '自动化', 'SQL 生成'],
    metrics: ['常规取数耗时下降 70%', '内置 20+ 分析口径模板', 'SQL 一次通过率 80%'],
    related_skills: ['LLM Prompt', 'Agent 工作流', 'SQL', '自动化'],
    related_domains: ['智能商业分析', 'AIGC'],
    proof_level: 'medium',
    resume_ready_bullets: [
      '设计自然语言取数 Agent 工作流，编排 SQL 生成、规则校验与结论撰写，常规取数耗时下降 70%。',
      '沉淀 20+ 分析口径 Prompt 模板，将 SQL 一次通过率提升至 80%。',
    ],
  },
  {
    experience_id: 'exp-005',
    experience_type: 'competition',
    title: '市场调研与商业分析大赛',
    organization: '校级商业分析竞赛',
    time_range: '2025.05 - 2025.07',
    summary:
      '围绕新消费品牌进入下沉市场做商业分析，负责市场规模测算与用户需求拆解，获校级二等奖。',
    tags: ['市场测算', '问卷分析', '商业洞察', '报告呈现'],
    metrics: ['校级二等奖', '有效问卷 600+ 份', '团队 4 人'],
    related_skills: ['Excel', '统计学', '数据可视化'],
    related_domains: ['商业分析', '消费'],
    proof_level: 'weak',
    resume_ready_bullets: [
      '基于 600+ 问卷与二手数据完成市场规模测算，输出下沉市场进入策略，获校级二等奖。',
    ],
  },
]
