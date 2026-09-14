# AI 求职 Agent 产品方案

## 项目定位

这个项目不是自动海投机器人，而是一个围绕“岗位筛选、匹配判断、简历定制、投递优先级”构建的 AI 求职决策工作台。

当前已有基础：

- 已有投递记录表，用于管理岗位和状态
- 已有官网网申入口与牛客插件，具备执行投递能力
- 当前只有一份通用简历，缺少针对岗位的定制能力

所以产品目标应定义为：

1. 把非结构化 JD 转成结构化岗位画像
2. 评估“我是否适合投这个岗位”
3. 给出“要不要投、先改什么、优先级如何”的建议
4. 在投递后沉淀反馈，用于后续优化评分

## 目标用户

当前版本的核心用户就是单个求职者本人，特征如下：

- 同时投递大量实习或校招岗位
- 有明确方向，但投递过程仍然偏海投
- 已有投递执行工具，但缺少岗位理解与决策能力
- 简历素材不足，无法快速做岗位定制

## 核心问题

当前痛点可概括为 4 个：

1. 岗位多，但不清楚哪些值得优先投
2. JD 很长，但缺少统一的结构化判断标准
3. 只有一份通用简历，不知道该怎么按岗位快速改
4. 投递结果与面试反馈没有反哺到下一轮岗位选择

## 产品目标

第一版 MVP 只解决以下三件事：

1. 岗位解析
2. 匹配评分
3. 简历改写建议

暂不做：

- 全自动投递
- 多平台账号统一登录
- 自动跑官网表单
- 自主学习的复杂权重训练
- 真正的实时爬虫采集

## 页面结构

### 页面 1：岗位池

用途：承接所有待评估和已评估岗位，作为求职机会池主页。

主要模块：

- 顶部筛选区
  - 关键词搜索
  - 公司筛选
  - 岗位方向筛选
  - 城市筛选
  - 投递状态筛选
  - 匹配分区间筛选
- 核心列表区
  - 岗位卡片或表格列表
  - 支持按匹配分、发布时间、投递状态排序
- 快捷洞察区
  - 高匹配待投岗位数
  - 需要改简历岗位数
  - 已投未跟进岗位数

岗位池每一项建议展示字段：

- 公司名
- 岗位名称
- 城市
- 岗位方向标签
- 匹配总分
- 推荐等级
- 当前状态
- 是否需要定制简历
- 下一步动作

主要交互：

- 点击进入岗位详情
- 一键标记“建议投 / 暂缓 / 放弃”
- 一键加入“待改简历”

### 页面 2：岗位详情页

用途：展示单个岗位的结构化分析结果，是整套产品的核心决策页。

主要模块：

- 基础信息卡
  - 公司
  - 岗位名称
  - 部门
  - 城市
  - 实习时长/到岗时间
  - 来源链接
- JD 摘要卡
  - 岗位职责摘要
  - 任职要求摘要
  - 关键词提取
- 匹配评分卡
  - 总分
  - 5 个子分
  - 每个子分解释
- 风险提示卡
  - 年级风险
  - 时间风险
  - 技术缺口
  - 城市/出勤风险
- 建议动作卡
  - 直接投递
  - 先改简历再投
  - 暂缓
  - 放弃

主要交互：

- 展开查看评分依据
- 一键生成简历建议
- 一键同步到投递看板

### 页面 3：简历建议页

用途：把岗位要求映射到简历素材，生成针对岗位的简历调整建议。

主要模块：

- 当前岗位需求摘要
- 当前简历覆盖度
- 建议强化的经历
- 建议改写的 bullet
- 必补关键词
- 推荐版本方案

建议分为 4 块输出：

1. 应保留内容
2. 应强化内容
3. 应替换表达
4. 可补充的关键词

页面交互建议：

- 左侧展示岗位需求
- 中间展示当前简历内容
- 右侧展示改写建议
- 支持“生成版本 A / 版本 B”

### 页面 4：投递看板页

用途：把已有投递表升级成智能看板，承接后续跟进与反馈。

主要模块：

- 状态列：待评估、待投递、已投递、笔试、面试、结束
- 智能字段区
  - 匹配总分
  - 推荐等级
  - 是否定制简历
  - 风险标签
  - 下一步动作
- 跟进记录区
  - 投递时间
  - 笔试时间
  - 面试记录
  - 结果反馈

主要交互：

- 快速更新投递状态
- 记录面试反馈
- 根据反馈回写评分修正建议

## 核心字段设计

### 1. 岗位主表 `jobs`

建议字段如下：

- `job_id`
- `source_type`
- `source_url`
- `company_name`
- `department_name`
- `job_title`
- `job_category`
- `city`
- `intern_days_per_week`
- `intern_months`
- `degree_requirement`
- `graduation_requirement`
- `jd_raw_text`
- `jd_summary`
- `responsibility_summary`
- `requirement_summary`
- `must_have_skills`
- `nice_to_have_skills`
- `business_keywords`
- `tool_keywords`
- `risk_flags`
- `status`
- `created_at`
- `updated_at`

### 2. 候选人画像表 `candidate_profile`

- `candidate_id`
- `target_direction`
- `preferred_cities`
- `available_days_per_week`
- `available_months`
- `degree_level`
- `graduation_year`
- `core_skills`
- `tool_skills`
- `industry_interest`
- `must_avoid_conditions`
- `resume_master_id`

### 3. 经历素材库 `experience_library`

这是后面支持多版本简历的关键层。

建议字段：

- `experience_id`
- `experience_type`
- `title`
- `organization`
- `time_range`
- `summary`
- `tags`
- `metrics`
- `related_skills`
- `related_domains`
- `proof_level`
- `resume_ready_bullets`

### 4. 匹配结果表 `job_match_results`

- `match_id`
- `job_id`
- `candidate_id`
- `hard_gate_score`
- `skill_match_score`
- `experience_relevance_score`
- `growth_value_score`
- `application_cost_score`
- `final_match_score`
- `match_level`
- `decision`
- `decision_reason`
- `improvement_suggestions`
- `generated_at`

### 5. 简历建议表 `resume_customization_suggestions`

- `suggestion_id`
- `job_id`
- `resume_master_id`
- `priority_keywords`
- `recommended_experiences`
- `rewrite_bullets`
- `missing_points`
- `version_name`
- `status`

### 6. 投递跟进表 `application_tracking`

- `tracking_id`
- `job_id`
- `apply_channel`
- `apply_status`
- `resume_version_used`
- `apply_time`
- `written_test_time`
- `interview_round`
- `latest_feedback`
- `result`
- `follow_up_action`

## 字段口径建议

为了后续评分稳定，建议统一口径：

- `must_have_skills`：JD 中明确要求，缺失会显著影响投递价值
- `nice_to_have_skills`：加分项，不作为强门槛
- `risk_flags`：如时间不满足、地点不满足、学历不满足、语言不满足
- `decision`：`apply_now` / `revise_then_apply` / `wait` / `drop`
- `match_level`：`high` / `medium` / `low`
- `apply_status`：`todo` / `ready` / `applied` / `written_test` / `interview` / `offer` / `rejected`

## 评分规则设计

第一版建议做 5 维评分，总分 100。

### 评分维度

1. `hard_gate_score`：硬门槛分，权重 35
2. `skill_match_score`：技能匹配分，权重 25
3. `experience_relevance_score`：经历相关分，权重 20
4. `growth_value_score`：成长收益分，权重 15
5. `application_cost_score`：投递成本分，权重 5，作为扣分项

### 总分公式

```text
final_match_score =
0.35 * hard_gate_score +
0.25 * skill_match_score +
0.20 * experience_relevance_score +
0.15 * growth_value_score -
0.05 * application_cost_score
```

为了让结果稳定，建议所有子项先规范到 0 到 100，再做加权。

### 1. 硬门槛分 `hard_gate_score`

判断项：

- 学历是否满足
- 毕业年份是否满足
- 每周出勤是否满足
- 实习时长是否满足
- 城市是否可接受
- 基础工具门槛是否满足

评分建议：

- 全部满足：90 到 100
- 只有轻微不匹配：70 到 85
- 存在明显硬伤：40 到 65
- 核心门槛不满足：0 到 30

规则建议：

- 若学历或毕业时间明确不满足，可直接触发强惩罚
- 若仅是城市不匹配但可远程/可迁移，则只做轻惩罚

### 2. 技能匹配分 `skill_match_score`

把技能拆成三类：

- 分析能力：SQL、Python、Excel、统计、A/B Test、指标体系
- 工具能力：Tableau、Power BI、FineBI、可视化、埋点、数据平台
- AI/工程能力：LLM、Prompt、Agent、自动化、脚本、工作流

评分思路：

- `must_have_skills` 覆盖率占大头
- `nice_to_have_skills` 作为加分
- 工具名称完全一致权重低于能力本质一致

建议公式：

```text
skill_match_score =
0.7 * must_have_coverage +
0.3 * nice_to_have_coverage
```

其中：

- `must_have_coverage`：JD 强要求技能中已覆盖比例
- `nice_to_have_coverage`：加分项技能中已覆盖比例

### 3. 经历相关分 `experience_relevance_score`

核心不是关键词重合，而是你的经历是否真正解决过类似问题。

判断维度：

- 是否做过相似业务分析
- 是否有数据驱动决策经验
- 是否有完整项目闭环
- 是否有结果指标或量化成果
- 是否与岗位业务场景接近

评分建议：

- 高相关：80 到 100
- 中相关：60 到 79
- 低相关：30 到 59
- 几乎无关：0 到 29

评分时建议优先看：

1. 问题是否相似
2. 方法是否相似
3. 结果是否可迁移

### 4. 成长收益分 `growth_value_score`

这个分数体现“值不值得投”，不是“能不能投”。

判断维度：

- 是否贴近你的目标方向：数据分析 / BI Agent / 智能商业分析
- 是否能补齐你现在的短板
- 是否能形成更强的简历叙事
- 是否有头部平台、业务复杂度或方法论价值

评分建议：

- 强相关目标岗：80 到 100
- 可作为过渡岗：60 到 79
- 价值一般：40 到 59
- 明显偏航：0 到 39

### 5. 投递成本分 `application_cost_score`

这是扣分项，表示为了投这个岗位你需要付出的额外成本。

判断维度：

- 是否需要大改简历
- 是否需要补作品或补项目
- 网申流程是否很长
- 是否需要额外作品集或笔试准备

评分建议：

- 低成本：0 到 20
- 中成本：21 到 50
- 高成本：51 到 80
- 极高成本：81 到 100

## 决策映射规则

建议直接把分数映射成行动建议：

- `85+`：建议立即投递
- `70-84`：建议先小改简历后投
- `55-69`：建议观察，除非补齐关键信息
- `<55`：不建议优先投入时间

再叠加风险规则：

- 若存在严重硬门槛风险，则最多只能输出“谨慎投”
- 若总分高但成本高，输出“值得投，但先做简历定制”

## 页面中的 AI 输出格式建议

为了方便理解，每个岗位详情页建议固定输出以下 5 块：

1. 一句话结论
2. 匹配总分与等级
3. 优势点
4. 风险点
5. 下一步动作

示例：

```text
一句话结论：这是一个中高匹配的数据分析实习岗位，建议在补强 BI 与指标体系表述后尽快投递。
匹配总分：82 / 100（中高匹配）
优势点：SQL、Python、分析项目经历匹配较强
风险点：缺少 BI 工具和明确业务分析闭环表述
下一步动作：先生成岗位定制版简历，再进入官网投递
```

## MVP 实现顺序

### 阶段 1：高保真原型

目标：

- 不接真实后端
- 用 mock 数据跑通交互和信息结构
- 完成 4 个页面

建议页面：

- `岗位池`
- `岗位详情`
- `简历建议`
- `投递看板`

### 阶段 2：接入真实数据

目标：

- 读取投递表数据
- 能从已有记录生成岗位池
- 支持更新状态与备注

### 阶段 3：接入真实 AI 能力

目标：

- 输入 JD 自动解析字段
- 自动生成匹配评分
- 自动生成简历改写建议

## 给 TraeCode CN 的实现要求

如果要开始做原型，建议按以下要求实现：

1. 用 React + Vite + TypeScript 搭建项目
2. 使用假数据，不接真实后端
3. 使用单项目多页面或路由结构
4. 先完成桌面端工作台样式
5. 页面必须包含：
   - 岗位池
   - 岗位详情
   - 简历建议
   - 投递看板
6. 每个页面需要完整的假数据展示
7. 所有评分和标签都要可以在前端静态展示
8. UI 风格偏专业、清晰、分析工作台，不要做花哨营销风
9. 强调“数据来源、评分解释、下一步动作”的透明度
10. 第一版只做前端原型，不实现登录、数据库、真实抓取

## 推荐的首轮交付物

第一轮最合适的交付物：

- 一个可运行的前端原型项目
- 包含 4 个核心页面
- 内置 mock 数据
- 有基础路由
- 有组件化卡片、表格、标签、评分模块
- 预留未来接后端的数据接口位置

## 实现时的组件建议

可优先抽出这些组件：

- `JobTable`
- `JobCard`
- `ScoreBreakdown`
- `RiskTagList`
- `ActionRecommendationCard`
- `ResumeSuggestionPanel`
- `ApplicationStatusBoard`
- `FilterBar`

## 最后收口

这个项目的价值不在“自动帮我投很多岗位”，而在“把海投流程升级成有判断、有解释、有反馈的决策系统”。

对外展示时，建议把项目表述成：

“面向个人求职场景的 AI Agent 工作台，将岗位解析、匹配评分、简历定制与投递跟进整合为一个可解释的求职决策闭环。”
