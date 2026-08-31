/**
 * Locale dictionaries for MMB Migration Center UI.
 * @module @deepseek-ai/dsh-mmb-migration-workbench/client/locales
 */

export const NS = 'mmb'

export const en = {
  'trigger.title': 'Migration Center',
  'trigger.badge': '46 Assets',
  'workbench.title': 'MMB Migration Center Workbench',
  'workbench.subtitle': 'Workload Assessment, Modernization Blueprints, and AST Translation Studio',
  'tab.portfolio': 'Portfolio & 46 Assets',
  'tab.assessment': 'Workload Assessment',
  'tab.ingress': 'Ingress -> Gateway API',
  'tab.skills': 'Mature Skills',
  'tab.recipes': 'Modernization Recipes',
  'stats.total': 'Total Assets',
  'stats.migrate': 'Migrate',
  'stats.modernize': 'Modernize',
  'stats.build': 'Build',
  'stats.topTier': 'Top-Tier (3.0+)',
  'filter.all': 'All Domains',
  'filter.search': 'Search 46 assets by name, tag, or GCP service...',
  'card.score': 'Score',
  'card.reality': 'Reality Check',
  'card.recommendation': 'Antigravity Roadmap',
  'card.services': 'Target GCP Services',
  'assess.title': 'Automated Workload Readiness Assessment',
  'assess.workloadType': 'Workload Type',
  'assess.sourcePlatform': 'Source Platform',
  'assess.sourceTech': 'Source Technology',
  'assess.run': 'Run Assessment',
  'assess.resultScore': 'Calibrated Feasibility Score',
  'assess.target': 'Recommended Target Architecture',
  'assess.actionPlan': 'Phased Execution Plan',
  'assess.risks': 'Identified Risk Factors',
  'ingress.title': 'Kubernetes Ingress to GKE Gateway API AST Translator',
  'ingress.loadSample': 'Load Sample Ingress',
  'ingress.translate': 'Translate to Gateway API',
  'ingress.copy': 'Copy Manifest',
  'ingress.copied': 'Copied!',
}

export type MmbKey = keyof typeof en

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    mmb: MmbKey
  }
}

export const zh: Record<MmbKey, string> = {
  'trigger.title': '迁移中心',
  'trigger.badge': '46个资产',
  'workbench.title': 'MMB 迁移工作台',
  'workbench.subtitle': '工作负载评估、现代化蓝图与 AST 转换工作室',
  'tab.portfolio': '资产库 (46个项目)',
  'tab.assessment': '工作负载评估',
  'tab.ingress': 'Ingress 转 Gateway API',
  'tab.skills': '成熟技能库',
  'tab.recipes': '现代化配方',
  'stats.total': '总资产数',
  'stats.migrate': '迁移 (Migrate)',
  'stats.modernize': '现代化 (Modernize)',
  'stats.build': '构建 (Build)',
  'stats.topTier': '顶级资产 (3.0+)',
  'filter.all': '所有领域',
  'filter.search': '按名称、标签或 GCP 服务搜索 46 个资产...',
  'card.score': '校准评分',
  'card.reality': '实测评估',
  'card.recommendation': 'Antigravity 演进建议',
  'card.services': '目标 GCP 服务',
  'assess.title': '自动化工作负载迁移就绪评估',
  'assess.workloadType': '工作负载类型',
  'assess.sourcePlatform': '源平台',
  'assess.sourceTech': '源技术栈',
  'assess.run': '运行评估',
  'assess.resultScore': '校准可行性评分',
  'assess.target': '推荐目标架构',
  'assess.actionPlan': '分阶段执行计划',
  'assess.risks': '识别的风险要素',
  'ingress.title': 'Kubernetes Ingress 转 GKE Gateway API 转换器',
  'ingress.loadSample': '载入示例 Ingress',
  'ingress.translate': '转换为 Gateway API',
  'ingress.copy': '复制配置清单',
  'ingress.copied': '已复制！',
}
