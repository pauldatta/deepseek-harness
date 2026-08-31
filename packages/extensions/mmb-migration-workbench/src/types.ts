/**
 * Types and interfaces for the MMB Migration Workbench.
 * @module @deepseek-ai/dsh-mmb-migration-workbench/types
 */

export type MmbDomain = 'migrate' | 'modernize' | 'build'

export type AssetStatus = 'top-tier' | 'promising' | 'utility' | 'demo' | 'archived'

/** Metadata and calibrated assessment for one of the 46 cloud-solutions projects. */
export interface MmbAsset {
  readonly id: string
  readonly name: string
  readonly domain: MmbDomain
  readonly rank: number
  readonly codeFiles: number
  readonly hasTests: boolean
  readonly score: number
  readonly realityCheck: string
  readonly marketFit2026: string
  readonly antigravityRecommendation: string
  readonly targetGcpServices: readonly string[]
  readonly tags: readonly string[]
  readonly status: AssetStatus
}

export type WorkloadType = 'database' | 'kubernetes' | 'data-pipeline' | 'application' | 'general'
export type CloudSource = 'aws' | 'azure' | 'on-prem' | 'gcp' | 'other'

export interface WorkloadAssessmentRequest {
  readonly workloadType: WorkloadType
  readonly sourcePlatform: CloudSource
  readonly sourceTechnology: string
  readonly workloadScale?: 'small' | 'medium' | 'large' | 'enterprise' | undefined
  readonly hasTests?: boolean | undefined
  readonly automatedVerificationDesired?: boolean | undefined
  readonly notes?: string | undefined
}

export interface DimensionScores {
  readonly codeMaturity: number
  readonly marketFit: number
  readonly architecturalInnovation: number
}

export interface PenaltyDeduction {
  readonly reason: string
  readonly deduction: number
}

export interface WorkloadAssessmentResult {
  readonly workloadType: WorkloadType
  readonly sourcePlatform: CloudSource
  readonly sourceTechnology: string
  readonly rawScore: number
  readonly calibratedScore: number
  readonly dimensionScores: DimensionScores
  readonly penaltiesApplied: readonly PenaltyDeduction[]
  readonly complexity: 'Low' | 'Moderate' | 'High' | 'Critical'
  readonly recommendedTarget: string
  readonly recommendedBlueprints: readonly string[]
  readonly recommendedSkills: readonly string[]
  readonly actionPlan: readonly string[]
  readonly riskFactors: readonly string[]
}

export interface IngressTranslateRequest {
  readonly manifest: string
  readonly gatewayName?: string | undefined
  readonly gatewayNamespace?: string | undefined
}

export interface IngressTranslateResult {
  readonly gatewayYaml: string
  readonly httpRouteYaml: string
  readonly referenceGrantYaml?: string | undefined
  readonly combinedYaml: string
  readonly summary: {
    readonly routesConverted: number
    readonly tlsHosts: readonly string[]
    readonly backendServices: readonly string[]
    readonly annotationsHandled: readonly string[]
    readonly crossNamespaceGrantGenerated?: boolean | undefined
  }
}

export interface ModernizationRecipe {
  readonly id: string
  readonly title: string
  readonly category: 'java' | 'dotnet' | 'data' | 'k8s' | 'database'
  readonly description: string
  readonly sourcePattern: string
  readonly targetPattern: string
  readonly verificationCommand: string
}

export interface RecipeRunResult {
  readonly recipeId: string
  readonly title: string
  readonly status: 'applied' | 'dry-run' | 'failed'
  readonly changesCount: number
  readonly description: string
  readonly verificationSteps: readonly string[]
}
