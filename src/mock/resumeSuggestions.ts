import type { ResumeSuggestion } from '@/types'

/**
 * 简历定制建议 mock
 * 第一版先为示例岗位 job-001 提供完整建议（含 A/B 两个版本）
 * 其他岗位在详情页「生成简历建议」时可在后续阶段补充
 */
export const resumeSuggestions: ResumeSuggestion[] = [
  {
    suggestion_id: 'sug-001',
    job_id: 'job-001',
    resume_master_id: 'resume-master-001',
    coverage_score: 72,
    requirement_summary: [
      '核心：熟练 SQL 取数、Python 数据处理',
      '核心：A/B Test 与业务归因能力',
      '核心：商家/用户分层与指标体系建设',
      '加分：Tableau / FineBI 等 BI 可视化经验',
    ],
    keep_points: [
      '本地生活增长分析实习（与电商商家增长场景最接近，应置于首位）',
      '补贴 A/B 实验与 ROI 提升 12% 的量化成果',
      '复购预测项目中的 Python/Pandas 能力展示',
    ],
    strengthen_experiences: [
      {
        experience_id: 'exp-003',
        reason: '岗位把 BI 可视化列为优先项，应把 FineBI 看板项目上调并突出指标口径治理，弥补 Tableau 短板。',
      },
      {
        experience_id: 'exp-004',
        reason: 'Agent 取数工作流可体现 SQL 熟练度与自动化思维，建议压缩为 1 条 bullet 放在技能强化位。',
      },
      {
        experience_id: 'exp-001',
        reason: '把商家分层 bullet 显式对齐 JD 的「商家分层、指标体系」关键词，提高首轮筛选命中率。',
      },
    ],
    rewrite_bullets: [
      {
        bullet_id: 'rb-001',
        original: '负责商家数据分析，输出分析报告，支持运营决策。',
        suggested:
          '搭建补贴活动 A/B 实验评估框架，基于双重差分归因净收益，推动补贴 ROI 提升 12%，并沉淀为标准评估流程。',
        reason: '原文偏职责罗列，缺少方法与量化结果；改写后对齐 JD 的 A/B Test 与归因，并体现可复用方法论。',
        related_experience_id: 'exp-001',
      },
      {
        bullet_id: 'rb-002',
        original: '做过商家分层，帮助运营做精细化触达。',
        suggested:
          '构建商家价值-意愿二维分层模型并落地差异化运营策略，高价值商家周活跃率提升 8.5%，分层逻辑被团队复用。',
        reason: '对齐「商家分层」关键词，补充模型方法、业务动作与可量化结果。',
        related_experience_id: 'exp-001',
      },
      {
        bullet_id: 'rb-003',
        original: '使用 FineBI 制作了一些数据看板。',
        suggested:
          '基于 FineBI 搭建经营分析看板，统一收入/转化/留存 3 大主题、20+ 指标口径并支持自助下钻，异常定位耗时从半天降至 30 分钟。',
        reason: '补全指标体系与效率收益，把「做过看板」升级为「指标治理 + 业务提效」，直接回应 BI 优先项。',
        related_experience_id: 'exp-003',
      },
    ],
    priority_keywords: [
      'A/B Test',
      '归因分析',
      '商家分层',
      '指标体系',
      '补贴 ROI',
      'FineBI / Tableau',
      'SQL（复杂查询）',
    ],
    missing_points: [
      '缺少显性的 Tableau 作品（可在技能区如实标注 Tableau 基础，并用 FineBI 项目证明可迁移）',
      '缺少电商交易域（GMV/客单价/转化）指标的直接表述，可用近似指标补充',
    ],
    versions: [
      {
        version_key: 'A',
        version_name: '版本 A · 数据分析主版',
        positioning: '强化实验与归因，主打增长分析硬实力',
        summary:
          '以 exp-001 增长实习为核心，前置 A/B Test 与 ROI 成果，BI 项目作为能力补充；适合强调「能直接上手做实验评估」的筛选偏好。',
      },
      {
        version_key: 'B',
        version_name: '版本 B · 指标与 BI 主版',
        positioning: '强化指标体系与可视化，贴合 BI 优先项',
        summary:
          '上调 exp-003 看板与指标治理项目，并把 Agent 取数工作流作为工程化亮点；适合 JD 中 BI/指标平台色彩更重的团队。',
      },
    ],
    status: 'generated',
    generated_at: '2026-09-12',
  },
]
