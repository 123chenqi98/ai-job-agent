# 给 TraeCode CN 的实现提示词

请帮我一步步实现一个 `AI 求职 Agent` 前端原型项目，要求如下：

## 项目目标

这不是自动海投工具，而是一个“岗位筛选、匹配评分、简历定制、投递跟进”的 AI 求职决策工作台。

当前真实背景：

- 我已经有投递记录表
- 已有官网网申入口和牛客插件承担投递执行
- 目前只有一份通用简历
- 我最缺的是岗位筛选、匹配度判断、简历按岗位定制

所以这个项目第一版只做“决策层”，不做自动投递。

## 技术要求

1. 使用 `React + Vite + TypeScript`
2. 先只做前端原型，不接真实后端
3. 使用 `mock data`
4. 页面风格要像“分析工作台”，专业、清晰、克制，不要营销官网风
5. 组件化开发，方便后续扩展

## 页面要求

请先实现以下 4 个页面，并做好路由：

1. `岗位池`
2. `岗位详情`
3. `简历建议`
4. `投递看板`

### 页面 1：岗位池

要有：

- 顶部筛选栏
- 岗位列表表格
- 匹配分
- 推荐等级
- 当前状态
- 是否需要改简历
- 下一步动作

### 页面 2：岗位详情

要有：

- 岗位基础信息
- JD 摘要
- 匹配总分
- 评分拆解
- 风险提示
- 建议动作

### 页面 3：简历建议

要有：

- 当前岗位需求摘要
- 当前简历覆盖度
- 建议强化的经历
- 建议改写的 bullet
- 推荐关键词
- 可切换版本建议

### 页面 4：投递看板

要有：

- 不同投递状态分组或看板
- 智能字段：匹配分、推荐等级、风险标签、简历版本
- 跟进记录

## 评分逻辑展示

前端需要静态展示以下评分结构：

- `hard_gate_score`
- `skill_match_score`
- `experience_relevance_score`
- `growth_value_score`
- `application_cost_score`
- `final_match_score`

请把每个分数的解释也展示出来，让页面有“可解释 AI”感觉。

## 数据结构建议

请在项目中先定义 mock types / mock data，至少包括：

- `Job`
- `CandidateProfile`
- `ExperienceItem`
- `MatchResult`
- `ResumeSuggestion`
- `ApplicationRecord`

## UI 组件建议

优先抽这些公共组件：

- `FilterBar`
- `JobTable`
- `ScoreBreakdown`
- `RiskTagList`
- `ActionRecommendationCard`
- `ResumeSuggestionPanel`
- `StatusBoard`

## 实现方式

请按下面步骤带我做：

1. 先初始化项目结构
2. 规划目录结构
3. 生成路由和页面骨架
4. 定义类型与 mock 数据
5. 先完成岗位池页面
6. 再完成岗位详情页
7. 再完成简历建议页
8. 再完成投递看板页
9. 最后统一样式和组件抽象

## 目录结构倾向

请优先采用类似结构：

```text
src/
  components/
  pages/
  mock/
  types/
  data/
  layouts/
  routes/
  styles/
```

## 额外要求

- 不要一次性生成过多无关功能
- 每一步先说明要做什么，再给出代码
- 优先保证信息结构清晰，而不是视觉炫技
- 代码注释和页面文案使用中文

如果你理解了，请先输出：

1. 目录结构方案
2. 页面路由方案
3. 第一步初始化建议

然后再开始逐步实现。
