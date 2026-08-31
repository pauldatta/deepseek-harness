/**
 * MMB Assessment Engine: implements the 2026 Calibrated Scoring Rubric
 * and provides automated workload readiness assessments.
 * @module @deepseek-ai/dsh-mmb-migration-workbench/assessment-engine
 */

import type {
  DimensionScores,
  PenaltyDeduction,
  WorkloadAssessmentRequest,
  WorkloadAssessmentResult,
} from './types.ts'

export interface RubricEvaluation {
  readonly rawScore: number
  readonly calibratedScore: number
  readonly dimensionScores: DimensionScores
  readonly penalties: readonly PenaltyDeduction[]
}

/**
 * Calculates calibrated assessment score based on 3-dimension formula:
 * Raw Score = (0.35 * Maturity) + (0.35 * MarketFit) + (0.30 * Innovation)
 * Calibrated Score = min(Raw Score - Penalties, HardCap)
 */
export function evaluateRubric(
  maturity: number,
  marketFit: number,
  innovation: number,
  options?: {
    isArchivedStub?: boolean | undefined
    isDocOnly?: boolean | undefined
    isHollowSkeleton?: boolean | undefined
    isCopiedThirdParty?: boolean | undefined
    isNotebookOnly?: boolean | undefined
    hasTests?: boolean | undefined
  },
): RubricEvaluation {
  let codeMaturity = Math.max(0, Math.min(5, maturity))
  if (options?.hasTests === true) {
    codeMaturity = Math.min(5, codeMaturity + 0.2)
  }
  const fit = Math.max(0, Math.min(5, marketFit))
  const archInnovation = Math.max(0, Math.min(5, innovation))

  const rawScore = Number((0.35 * codeMaturity + 0.35 * fit + 0.30 * archInnovation).toFixed(2))
  const penalties: PenaltyDeduction[] = []
  let deduction = 0
  let hardCap = 5.0

  if (options?.isArchivedStub) {
    hardCap = Math.min(hardCap, 0.6)
    penalties.push({ reason: 'Archived Stub (zero active code files)', deduction: 2.0 })
  }
  if (options?.isDocOnly) {
    hardCap = Math.min(hardCap, 1.3)
    penalties.push({ reason: 'Documentation-only (lacks runnable automation or CLI)', deduction: 1.5 })
  }
  if (options?.isHollowSkeleton) {
    penalties.push({ reason: 'Hollow skeleton (<100 LOC of actual agentic logic)', deduction: 2.0 })
    deduction += 2.0
  }
  if (options?.isCopiedThirdParty) {
    penalties.push({ reason: 'Third-party copied sample without transformation tooling', deduction: 1.5 })
    deduction += 1.5
  }
  if (options?.isNotebookOnly) {
    penalties.push({ reason: 'Notebook-only / unhardened POC logic', deduction: 1.5 })
    deduction += 1.5
  }
  if (options?.hasTests === false) {
    penalties.push({ reason: 'Untested Workload (zero automated regression tests)', deduction: 0.5 })
    deduction += 0.5
  }

  const scoreAfterDeductions = Math.max(0.6, rawScore - deduction)
  const calibratedScore = Number(Math.min(scoreAfterDeductions, hardCap).toFixed(1))

  return {
    rawScore,
    calibratedScore,
    dimensionScores: { codeMaturity, marketFit: fit, architecturalInnovation: archInnovation },
    penalties,
  }
}


/**
 * Assesses an enterprise customer workload across Migrate, Modernize, and Build pillars.
 */
export function assessWorkload(request: WorkloadAssessmentRequest): WorkloadAssessmentResult {
  const techLower = request.sourceTechnology.toLowerCase()
  let detectedType = request.workloadType

  if (detectedType === 'general') {
    if (techLower.includes('oracle') || techLower.includes('sql') || techLower.includes('postgres')) {
      detectedType = 'database'
    } else if (techLower.includes('ingress') || techLower.includes('k8s') || techLower.includes('kubernetes')) {
      detectedType = 'kubernetes'
    } else if (techLower.includes('spark') || techLower.includes('hadoop') || techLower.includes('hive')) {
      detectedType = 'data-pipeline'
    } else {
      detectedType = 'application'
    }
  }

  switch (detectedType) {
    case 'database':
      return assessDatabaseWorkload(request)
    case 'kubernetes':
      return assessKubernetesWorkload(request)
    case 'data-pipeline':
      return assessDataPipelineWorkload(request)
    case 'application':
    default:
      return assessApplicationWorkload(request)
  }
}

function computeComplexity(
  baseComplexity: 'Low' | 'Moderate' | 'High' | 'Critical',
  scale: 'small' | 'medium' | 'large' | 'enterprise' | undefined,
): 'Low' | 'Moderate' | 'High' | 'Critical' {
  if (scale === 'enterprise') return 'Critical'
  if (scale === 'small' && baseComplexity !== 'Critical') return 'Low'
  return baseComplexity
}

function augmentRisksAndPlans(
  request: WorkloadAssessmentRequest,
  baseActionPlan: readonly string[],
  baseRiskFactors: readonly string[],
): { actionPlan: string[]; riskFactors: string[] } {
  const actionPlan = [...baseActionPlan]
  const riskFactors = [...baseRiskFactors]

  if (request.hasTests === false) {
    riskFactors.unshift('Workload lacks automated test coverage; regression risk during migration is elevated.')
    actionPlan.splice(1, 0, '1b. Automated Test Baseline: Establish smoke and contract test suite prior to cutover.')
  }

  if (request.workloadScale === 'enterprise') {
    riskFactors.push('Enterprise scale (>50 TB / high QPS) requires dedicated interconnect bandwidth and multi-region failover.')
    actionPlan.push('Enterprise Resilience: Validate multi-region failover and partitioned cutover strategy.')
  }

  return { actionPlan, riskFactors }
}

function assessDatabaseWorkload(request: WorkloadAssessmentRequest): WorkloadAssessmentResult {
  const techLower = request.sourceTechnology.toLowerCase()
  const isOracle = techLower.includes('oracle')
  const isSqlServer = techLower.includes('sql server') || techLower.includes('mssql')
  const isPostgres = techLower.includes('postgres')

  const maturity = 3.5
  let marketFit = 4.5
  let innovation = 4.0
  let recommendedTarget = 'BigQuery + Datastream CDC'
  const blueprints = ['oracle-bigquery-mcp-agent', 'operational-ai-leap', 'mmb-datacloud']
  const skills = ['mmb-oracle-bigquery', 'mmb-alloydb-vector']

  if (isOracle) {
    recommendedTarget = 'BigQuery (Analytics & BQML) + AlloyDB for PostgreSQL (OLTP)'
    marketFit = 4.8
    innovation = 4.2
  } else if (isSqlServer) {
    recommendedTarget = 'Cloud SQL for SQL Server / AlloyDB with DMS Schema Conversion'
    marketFit = 3.8
    innovation = 3.0
  } else if (isPostgres) {
    recommendedTarget = 'AlloyDB with ScaNN pgvector & BigQuery Federation'
    marketFit = 4.2
    innovation = 4.5
  }

  const evalResult = evaluateRubric(maturity, marketFit, innovation, {
    isHollowSkeleton: false,
    isNotebookOnly: false,
    hasTests: request.hasTests,
  })

  const baseComplexity = isOracle ? 'Critical' : 'Moderate'
  const complexity = computeComplexity(baseComplexity, request.workloadScale)
  const { actionPlan, riskFactors } = augmentRisksAndPlans(
    request,
    [
      '1. Discovery & Schema Inspection: Run automated Oracle/DB dictionary assessment for unsupported data types & stored procedures.',
      '2. CDC Pipeline Provisioning: Deploy Datastream private connection & BigQuery dataset with merge deduplication.',
      '3. Backfill & Catch-up: Execute initial historical snapshot load via Cloud Storage staging bucket.',
      '4. Validation: Verify checksums, row counts, and data types between source and target tables.',
      '5. Cutover & In-Database AI: Switch application traffic and enable BigQuery ML ARIMA_PLUS / vector search.',
    ],
    [
      'PL/SQL proprietary stored procedures requiring automated SQL translation.',
      'Network bandwidth bottlenecks during initial multiterabyte data backfill.',
      'CDC latency spikes under high concurrent OLTP update volumes.',
    ],
  )

  return {
    workloadType: 'database',
    sourcePlatform: request.sourcePlatform,
    sourceTechnology: request.sourceTechnology,
    rawScore: evalResult.rawScore,
    calibratedScore: evalResult.calibratedScore,
    dimensionScores: evalResult.dimensionScores,
    penaltiesApplied: evalResult.penalties,
    complexity,
    recommendedTarget,
    recommendedBlueprints: blueprints,
    recommendedSkills: skills,
    actionPlan,
    riskFactors,
  }
}

function assessKubernetesWorkload(request: WorkloadAssessmentRequest): WorkloadAssessmentResult {
  const evalResult = evaluateRubric(3.0, 4.5, 3.8, { hasTests: request.hasTests })
  const complexity = computeComplexity('Moderate', request.workloadScale)
  const { actionPlan, riskFactors } = augmentRisksAndPlans(
    request,
    [
      '1. Cluster Ingress Audit: Scan active networking.k8s.io/v1 Ingress manifests across all namespaces.',
      '2. Annotation Translation: Map cloud load balancing & cert-manager annotations to Gateway parameters.',
      '3. HTTPRoute Generation: Run AST translator to generate gateway.networking.k8s.io/v1 HTTPRoute resources.',
      '4. Staged Rollout: Deploy Gateway alongside existing Ingress using weighted DNS or canary routing.',
      '5. Decommission: Verify zero 5xx errors on HTTPRoute, then decommission legacy Ingress controller.',
    ],
    [
      'Custom ingress controller plugin annotations (NGINX snippets / lua scripts) require custom HTTPRoute filters.',
      'Multi-cluster service routing requires GKE Multi-Cluster Ingress / GatewayClass.',
    ],
  )

  return {
    workloadType: 'kubernetes',
    sourcePlatform: request.sourcePlatform,
    sourceTechnology: request.sourceTechnology,
    rawScore: evalResult.rawScore,
    calibratedScore: evalResult.calibratedScore,
    dimensionScores: evalResult.dimensionScores,
    penaltiesApplied: evalResult.penalties,
    complexity,
    recommendedTarget: 'GKE Gateway API (GatewayClass gke-l7-global-external-managed + HTTPRoute)',
    recommendedBlueprints: ['gke-migration-agent', 'k8s-hybrid-neg-controller'],
    recommendedSkills: ['mmb-ingress2gateway'],
    actionPlan,
    riskFactors,
  }
}

function assessDataPipelineWorkload(request: WorkloadAssessmentRequest): WorkloadAssessmentResult {
  const evalResult = evaluateRubric(3.2, 4.4, 3.6, { hasTests: request.hasTests })
  const complexity = computeComplexity('High', request.workloadScale)
  const { actionPlan, riskFactors } = augmentRisksAndPlans(
    request,
    [
      '1. HDFS & Hive Metastore Discovery: Catalog existing partitions, file formats (ORC/Parquet), and DAG workflows.',
      '2. Dual-Write Lakehouse Setup: Establish BigLake Iceberg tables over Cloud Storage buckets.',
      '3. PySpark Job Modernization: Refactor Hadoop HDFS path references to gs:// with Dataproc Serverless runtime.',
      '4. AST Verification: Validate Spark SQL queries against BigQuery dialect to avoid translation hallucinations.',
      '5. Orchestration Cutover: Transition scheduled Oozie/Airflow DAGs to Google Cloud Composer / Workflows.',
    ],
    [
      'UDFs (User-Defined Functions) written in Java/Scala requiring recompilation or Python rewrite.',
      'Small files problem on HDFS requiring compaction before Cloud Storage migration.',
    ],
  )

  return {
    workloadType: 'data-pipeline',
    sourcePlatform: request.sourcePlatform,
    sourceTechnology: request.sourceTechnology,
    rawScore: evalResult.rawScore,
    calibratedScore: evalResult.calibratedScore,
    dimensionScores: evalResult.dimensionScores,
    penaltiesApplied: evalResult.penalties,
    complexity,
    recommendedTarget: 'Dataproc Serverless + BigLake (Apache Iceberg) + Dataplex Governance',
    recommendedBlueprints: ['hadoop-to-lakehouse-migration-demo', 'legacy-detox-demo', 'dataflow-bigquery-change-data-capture'],
    recommendedSkills: ['mmb-legacy-detox'],
    actionPlan,
    riskFactors,
  }
}

function assessApplicationWorkload(request: WorkloadAssessmentRequest): WorkloadAssessmentResult {
  const techLower = request.sourceTechnology.toLowerCase()
  const isJava = techLower.includes('java') || techLower.includes('spring')
  const isDotnet = techLower.includes('dotnet') || techLower.includes('.net') || techLower.includes('c#')

  const evalResult = evaluateRubric(2.8, 4.3, 3.2, { hasTests: request.hasTests })
  const complexity = computeComplexity('Moderate', request.workloadScale)
  const { actionPlan, riskFactors } = augmentRisksAndPlans(
    request,
    [
      '1. Codebase Scan: Parse dependencies (pom.xml / *.csproj) and flag deprecated framework APIs.',
      '2. Modernization Recipe: Apply automated AST refactoring (Spring Boot 2->3 or .NET Core 8 Linux containerization).',
      '3. Dockerfile Generation: Generate multi-stage distroless container builds optimized for Cloud Run.',
      '4. Build & Test Verification: Run hermetic test verification (mvn test / dotnet test) to guarantee zero regression.',
      '5. Cloud Run Deployment: Deploy container with IAM service account and Cloud SQL Auth Proxy.',
    ],
    [
      'Hardcoded filesystem paths or Windows registry dependencies in legacy .NET/Java apps.',
      'In-memory session state requiring externalization to Memorystore for Redis.',
    ],
  )

  return {
    workloadType: 'application',
    sourcePlatform: request.sourcePlatform,
    sourceTechnology: request.sourceTechnology,
    rawScore: evalResult.rawScore,
    calibratedScore: evalResult.calibratedScore,
    dimensionScores: evalResult.dimensionScores,
    penaltiesApplied: evalResult.penalties,
    complexity,
    recommendedTarget: 'Cloud Run (Serverless Containers) + Artifact Registry + Cloud SQL',
    recommendedBlueprints: isJava
      ? ['java-modernization-demo', 'build-with-gemini-demo']
      : isDotnet
        ? ['dotnet-modernization-demo']
        : ['java-modernization-demo', 'dotnet-modernization-demo'],
    recommendedSkills: ['mmb-app-modernization'],
    actionPlan,
    riskFactors,
  }
}
