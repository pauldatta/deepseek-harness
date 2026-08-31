/**
 * MMB Migration Center Workbench Plugin for DeepSeek Harness (Host Half).
 * Registers MMB tools, baked-in mature migration skills, system prompt guidance,
 * and REST API routes for migration assessments and manifest translations.
 *
 * @module @deepseek-ai/dsh-mmb-migration-workbench
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import type { SkillRegistry } from '@deepseek-ai/dsh-skill'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import { MMB_ASSETS } from './catalog-data.ts'
import { assessWorkload } from './assessment-engine.ts'
import { translateIngressToGatewayApi } from './ingress-translator.ts'
import { MODERNIZATION_RECIPES, runModernizationRecipe } from './recipes.ts'
import { MMB_RUNTIME_SKILLS } from './skills.ts'
import type { CloudSource, WorkloadAssessmentRequest, WorkloadType } from './types.ts'

export * from './types.ts'
export * from './catalog-data.ts'
export * from './assessment-engine.ts'
export * from './ingress-translator.ts'
export * from './recipes.ts'
export * from './skills.ts'

export const name = 'mmb-migration-workbench'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** Enable registering the 6 baked-in MMB runtime skills. */
  enableRuntimeSkills?: boolean
  /** Enable registering HTTP endpoints under /api/mmb on webServer. */
  enableHttpRoutes?: boolean
}

export const Config: z<Config> = z.object({
  enableRuntimeSkills: z.boolean().default(true),
  enableHttpRoutes: z.boolean().default(true),
})

const MMB_SYSTEM_PROMPT = `You have access to the Google Cloud MMB Migration Workbench via tools:
- \`mmb_catalog\`: Query the 46 evaluated cloud-solutions projects across Migrate, Modernize, and Build.
- \`mmb_assess_workload\`: Perform automated migration feasibility assessments using the 2026 calibrated rubric.
- \`mmb_ingress_translate\`: Translate Kubernetes Ingress manifests into GKE Gateway API (Gateway + HTTPRoute).
- \`mmb_generate_migration_plan\`: Generate end-to-end phased migration execution plans.
- \`mmb_recipe_run\`: Execute code and architecture modernization recipes (Spring Boot 3, .NET 8 Linux, BigLake, etc.).
Use these tools to help enterprise customers migrate, modernize, and build workloads on Google Cloud.`

export function apply(ctx: Context, config: Config): void {
  // 1. System Prompt Section
  ctx.systemPrompt.section({
    name: 'tool:mmb',
    order: 115,
    text: MMB_SYSTEM_PROMPT,
  })

  // 2. Register Runtime Skills if skills service is available
  const skills = ctx.get('skills') as SkillRegistry | undefined
  if (config.enableRuntimeSkills !== false && skills) {
    ctx.effect(() => {
      const disposers = MMB_RUNTIME_SKILLS.map(skill => skills.register(skill))
      return () => {
        for (const dispose of disposers) {
          dispose?.()
        }
      }
    }, 'mmb: runtime skills')
  }

  // 3. Register HTTP Routes on webServer if available
  const webServer = ctx.get('webServer') as WebServer | undefined
  if (config.enableHttpRoutes !== false && webServer) {
    ctx.effect(() => registerMmbHttpRoutes(webServer), 'mmb: http routes')
  }

  // 4. Register Backend Tools
  registerTools(ctx)
}

function registerTools(ctx: Context): void {
  // ── Tool 1: mmb_catalog ──────────────────────────────────────────────────
  ctx.tools.register(
    defineTool({
      name: 'mmb_catalog',
      description: 'Query and filter the catalog of 46 evaluated Google Cloud migration, modernization, and build assets.',
      parameters: {
        domain: {
          type: 'string',
          enum: ['migrate', 'modernize', 'build'],
          description: 'Filter by solution domain: migrate (7), modernize (18), or build (21).',
        },
        status: {
          type: 'string',
          enum: ['top-tier', 'promising', 'utility', 'demo', 'archived'],
          description: 'Filter by asset status classification.',
        },
        min_score: {
          type: 'number',
          description: 'Minimum calibrated score (1.0 to 5.0).',
        },
        query: {
          type: 'string',
          description: 'Keyword search across asset name, reality check, tags, and recommended services.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            total: { type: 'number' },
            assets: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  domain: { type: 'string' },
                  score: { type: 'number' },
                  hasTests: { type: 'boolean' },
                  codeFiles: { type: 'number' },
                  realityCheck: { type: 'string' },
                  antigravityRecommendation: { type: 'string' },
                  targetGcpServices: { type: 'array', items: { type: 'string' } },
                  tags: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string' },
                },
              },
            },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `Found ${value.total ?? 0} MMB assets:\n` +
            (value.assets?.map(a => `- **[${a.score?.toFixed(1) ?? '?'}/5] ${a.name ?? ''}** (${a.domain ?? ''}, ${a.status ?? ''})\n  *Target GCP:* ${a.targetGcpServices?.join(', ') ?? ''}\n  *Recommendation:* ${a.antigravityRecommendation ?? ''}`).join('\n\n') ?? ''),
        }],
      },
      async execute(args) {
        let list = [...MMB_ASSETS]
        if (args.domain) {
          list = list.filter(a => a.domain === args.domain)
        }
        if (args.status) {
          list = list.filter(a => a.status === args.status)
        }
        const minScore = args.min_score
        if (minScore !== undefined) {
          list = list.filter(a => a.score >= minScore)
        }
        if (args.query) {
          const q = args.query.toLowerCase()
          list = list.filter(a =>
            a.name.toLowerCase().includes(q) ||
            a.realityCheck.toLowerCase().includes(q) ||
            a.tags.some(t => t.toLowerCase().includes(q)) ||
            a.targetGcpServices.some(s => s.toLowerCase().includes(q)),
          )
        }
        return {
          total: list.length,
          assets: list.map(a => ({
            id: a.id,
            name: a.name,
            domain: a.domain,
            score: a.score,
            hasTests: a.hasTests,
            codeFiles: a.codeFiles,
            realityCheck: a.realityCheck,
            antigravityRecommendation: a.antigravityRecommendation,
            targetGcpServices: [...a.targetGcpServices],
            tags: [...a.tags],
            status: a.status,
          })),
        }
      },
    }),
  )

  // ── Tool 2: mmb_assess_workload ──────────────────────────────────────────
  ctx.tools.register(
    defineTool({
      name: 'mmb_assess_workload',
      description: 'Run automated migration readiness assessment on a target workload using the 2026 MMB calibrated rubric.',
      parameters: {
        workload_type: {
          type: 'string',
          enum: ['database', 'kubernetes', 'data-pipeline', 'application', 'general'],
          required: true,
          description: 'Type of workload to assess.',
        },
        source_platform: {
          type: 'string',
          enum: ['aws', 'azure', 'on-prem', 'gcp', 'other'],
          required: true,
          description: 'Source environment or hosting platform.',
        },
        source_technology: {
          type: 'string',
          required: true,
          description: 'Specific source technology (e.g. "Oracle 19c", "K8s Ingress NGINX", "PySpark 2.4", "Spring Boot 2.7", ".NET Framework 4.8").',
        },
        workload_scale: {
          type: 'string',
          enum: ['small', 'medium', 'large', 'enterprise'],
          description: 'Scale or data volume of the workload.',
        },
        has_tests: {
          type: 'boolean',
          description: 'Whether the workload has automated test coverage.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            workloadType: { type: 'string' },
            sourcePlatform: { type: 'string' },
            sourceTechnology: { type: 'string' },
            calibratedScore: { type: 'number' },
            rawScore: { type: 'number' },
            complexity: { type: 'string' },
            recommendedTarget: { type: 'string' },
            recommendedBlueprints: { type: 'array', items: { type: 'string' } },
            recommendedSkills: { type: 'array', items: { type: 'string' } },
            actionPlan: { type: 'array', items: { type: 'string' } },
            riskFactors: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `### MMB Migration Assessment Result: ${value.sourceTechnology ?? ''} (${value.sourcePlatform?.toUpperCase() ?? ''})\n` +
            `- **Calibrated Feasibility Score:** ${value.calibratedScore?.toFixed(1) ?? '?'}/5.0\n` +
            `- **Complexity Level:** ${value.complexity ?? ''}\n` +
            `- **Target GCP Architecture:** ${value.recommendedTarget ?? ''}\n\n` +
            '#### Recommended Blueprints & Skills\n' +
            `- Blueprints: ${value.recommendedBlueprints?.join(', ') ?? ''}\n` +
            `- Skills: ${value.recommendedSkills?.join(', ') ?? ''}\n\n` +
            '#### Execution Action Plan\n' +
            (value.actionPlan?.map(s => `- ${s}`).join('\n') ?? '') + '\n\n' +
            '#### Identified Risk Factors\n' +
            (value.riskFactors?.map(r => `⚠️ ${r}`).join('\n') ?? ''),
        }],
      },
      async execute(args) {
        const req: WorkloadAssessmentRequest = {
          workloadType: args.workload_type as WorkloadType,
          sourcePlatform: args.source_platform as CloudSource,
          sourceTechnology: args.source_technology,
          workloadScale: args.workload_scale as 'small' | 'medium' | 'large' | 'enterprise' | undefined,
          hasTests: args.has_tests,
        }
        const result = assessWorkload(req)
        return {
          workloadType: result.workloadType,
          sourcePlatform: result.sourcePlatform,
          sourceTechnology: result.sourceTechnology,
          calibratedScore: result.calibratedScore,
          rawScore: result.rawScore,
          complexity: result.complexity,
          recommendedTarget: result.recommendedTarget,
          recommendedBlueprints: [...result.recommendedBlueprints],
          recommendedSkills: [...result.recommendedSkills],
          actionPlan: [...result.actionPlan],
          riskFactors: [...result.riskFactors],
        }
      },
    }),
  )

  // ── Tool 3: mmb_ingress_translate ────────────────────────────────────────
  ctx.tools.register(
    defineTool({
      name: 'mmb_ingress_translate',
      description: 'Translate Kubernetes Ingress YAML manifests into GKE Gateway API (Gateway + HTTPRoute) resources.',
      parameters: {
        manifest: {
          type: 'string',
          required: true,
          description: 'Kubernetes networking.k8s.io/v1 Ingress YAML manifest string.',
        },
        gateway_name: {
          type: 'string',
          description: 'Optional name for generated Gateway resource.',
        },
        namespace: {
          type: 'string',
          description: 'Target Kubernetes namespace (defaults to manifest namespace or default).',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            combinedYaml: { type: 'string' },
            routesConverted: { type: 'number' },
            backendServices: { type: 'array', items: { type: 'string' } },
            tlsHosts: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: '### Ingress to Gateway API Translation\n' +
            `Converted **${value.routesConverted ?? 0}** routes for services: ${value.backendServices?.join(', ') ?? ''}\n\n` +
            '```yaml\n' + (value.combinedYaml ?? '') + '\n```',
        }],
      },
      async execute(args) {
        const res = translateIngressToGatewayApi({
          manifest: args.manifest,
          gatewayName: args.gateway_name,
          gatewayNamespace: args.namespace,
        })
        return {
          combinedYaml: res.combinedYaml,
          routesConverted: res.summary.routesConverted,
          backendServices: [...res.summary.backendServices],
          tlsHosts: [...res.summary.tlsHosts],
        }
      },
    }),
  )

  // ── Tool 4: mmb_generate_migration_plan ──────────────────────────────────
  ctx.tools.register(
    defineTool({
      name: 'mmb_generate_migration_plan',
      description: 'Generate an end-to-end phased migration plan for moving workloads to Google Cloud.',
      parameters: {
        workload_type: {
          type: 'string',
          enum: ['database', 'kubernetes', 'data-pipeline', 'application', 'general'],
          required: true,
          description: 'Type of workload.',
        },
        source_technology: {
          type: 'string',
          required: true,
          description: 'Source technology (e.g. Oracle 19c, Cloudera Hadoop, Ingress NGINX).',
        },
        target_gcp_service: {
          type: 'string',
          required: true,
          description: 'Target Google Cloud service (e.g. BigQuery, GKE Gateway API, Dataproc, Cloud Run).',
        },
        timeline_weeks: {
          type: 'number',
          description: 'Target timeline duration in weeks (default: 8).',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            timelineWeeks: { type: 'number' },
            phases: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  phase: { type: 'string' },
                  durationWeeks: { type: 'number' },
                  deliverables: { type: 'array', items: { type: 'string' } },
                  verificationGate: { type: 'string' },
                },
              },
            },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `### Migration Blueprint: ${value.title ?? ''} (${value.timelineWeeks ?? 0} Weeks)\n\n` +
            (value.phases?.map(p =>
              `#### ${p.phase ?? ''} (${p.durationWeeks ?? 0} weeks)\n` +
              '**Deliverables:**\n' + (p.deliverables?.map(d => `- ${d}`).join('\n') ?? '') + '\n' +
              `**Verification Gate:** ${p.verificationGate ?? ''}`,
            ).join('\n\n') ?? ''),
        }],
      },
      async execute(args) {
        const weeks = args.timeline_weeks ?? 8
        const p1Weeks = Math.max(1, Math.round(weeks * 0.2))
        const p2Weeks = Math.max(1, Math.round(weeks * 0.3))
        const p3Weeks = Math.max(1, Math.round(weeks * 0.3))
        const p4Weeks = Math.max(1, weeks - (p1Weeks + p2Weeks + p3Weeks))

        return {
          title: `${args.source_technology} -> ${args.target_gcp_service}`,
          timelineWeeks: weeks,
          phases: [
            {
              phase: 'Phase 1: Discovery & Architecture Baseline',
              durationWeeks: p1Weeks,
              deliverables: [
                'Automated schema/manifest extraction via MMB discovery tools.',
                'Data volume, network bandwidth, and IOPS requirements document.',
                'Target Google Cloud landing zone architecture and IAM Workload Identity plan.',
              ],
              verificationGate: 'Stakeholder sign-off on discovery metrics and security compliance.',
            },
            {
              phase: 'Phase 2: Target Infrastructure & Ingestion Pipeline',
              durationWeeks: p2Weeks,
              deliverables: [
                `Terraform automation provisioning ${args.target_gcp_service} environment.`,
                'High-speed network interconnect and private VPC peering.',
                'Initial historical data backfill or base container image registry configuration.',
              ],
              verificationGate: 'Target infrastructure online with zero Terraform drift.',
            },
            {
              phase: 'Phase 3: Automated Code/Schema Modernization & Continuous Sync',
              durationWeeks: p3Weeks,
              deliverables: [
                'AST-driven manifest/code transformations and automated recipes.',
                'Continuous CDC replication or canary deployment routing.',
                'End-to-end integration test execution.',
              ],
              verificationGate: 'Data/traffic parity validation and zero regression on automated tests.',
            },
            {
              phase: 'Phase 4: Cutover, Observability & In-Database AI',
              durationWeeks: p4Weeks,
              deliverables: [
                'Production DNS / client traffic cutover.',
                'Cloud Monitoring alerts, Cloud Logging dashboards, and SLO tracking.',
                'Enable advanced AI capabilities (BQML ARIMA_PLUS, ScaNN Vector Search, or Cloud Run scaling).',
              ],
              verificationGate: 'Successful production sign-off with 24-hour error rate < 0.01%.',
            },
          ],
        }
      },
    }),
  )

  // ── Tool 5: mmb_recipe_run ───────────────────────────────────────────────
  ctx.tools.register(
    defineTool({
      name: 'mmb_recipe_run',
      description: 'Run an automated MMB code modernization recipe (e.g. Spring Boot 3, .NET 8 Linux, BigLake, Oracle PL/SQL).',
      parameters: {
        recipe_id: {
          type: 'string',
          required: true,
          description: 'Id of the modernization recipe (e.g. "java-spring-boot-3", "dotnet-core-cloud-run", "oracle-plsql-to-bigquery", "k8s-ingress-to-gateway-api").',
        },
        dry_run: {
          type: 'boolean',
          description: 'Whether to simulate without making filesystem changes (default: true).',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            recipeId: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string' },
            changesCount: { type: 'number' },
            description: { type: 'string' },
            verificationSteps: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) => [{
          type: 'text',
          text: `### Modernization Recipe: ${value.title ?? ''} (${value.status?.toUpperCase() ?? ''})\n` +
            `${value.description ?? ''}\n\n` +
            '**Verification Steps:**\n' +
            (value.verificationSteps?.map(s => `- ${s}`).join('\n') ?? ''),
        }],
      },
      async execute(args) {
        const dryRun = args.dry_run !== false
        const res = runModernizationRecipe(args.recipe_id, dryRun)
        return {
          recipeId: res.recipeId,
          title: res.title,
          status: res.status,
          changesCount: res.changesCount,
          description: res.description,
          verificationSteps: [...res.verificationSteps],
        }
      },
    }),
  )
}

function registerMmbHttpRoutes(webServer: WebServer): () => void {
  return webServer.register({
    kind: 'prefix',
    path: '/api/mmb',
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      const pathname = url.pathname

      // CORS and JSON headers
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      // Route 1: GET /api/mmb/projects
      if (req.method === 'GET' && pathname === '/api/mmb/projects') {
        const domain = url.searchParams.get('domain')
        const minScore = url.searchParams.get('minScore')
        let results = [...MMB_ASSETS]
        if (domain) results = results.filter(a => a.domain === domain)
        if (minScore) results = results.filter(a => a.score >= parseFloat(minScore))

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ total: results.length, projects: results }))
        return
      }

      // Route 2: GET /api/mmb/stats
      if (req.method === 'GET' && pathname === '/api/mmb/stats') {
        const migrateCount = MMB_ASSETS.filter(a => a.domain === 'migrate').length
        const modernizeCount = MMB_ASSETS.filter(a => a.domain === 'modernize').length
        const buildCount = MMB_ASSETS.filter(a => a.domain === 'build').length
        const topTier = MMB_ASSETS.filter(a => a.score >= 3.0).length
        const averageScore = Number((MMB_ASSETS.reduce((sum, a) => sum + a.score, 0) / MMB_ASSETS.length).toFixed(2))
        const peakScore = Math.max(...MMB_ASSETS.map(a => a.score))

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          totalProjects: MMB_ASSETS.length,
          migrateCount,
          modernizeCount,
          buildCount,
          topTierCount: topTier,
          averageScore,
          peakScore,
        }))
        return
      }

      // Route 3: GET /api/mmb/recipes
      if (req.method === 'GET' && pathname === '/api/mmb/recipes') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ total: MODERNIZATION_RECIPES.length, recipes: MODERNIZATION_RECIPES }))
        return
      }

      // Route 4: POST /api/mmb/assess
      if (req.method === 'POST' && pathname === '/api/mmb/assess') {
        let body = ''
        req.on('data', (chunk: unknown) => { body += String(chunk) })
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}')
            const result = assessWorkload(data)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(result))
          } catch (_err) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }))
          }
        })
        req.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Request stream error' }))
          }
        })
        return
      }

      // Route 5: POST /api/mmb/translate-ingress
      if (req.method === 'POST' && pathname === '/api/mmb/translate-ingress') {
        let body = ''
        req.on('data', (chunk: unknown) => { body += String(chunk) })
        req.on('end', () => {
          try {
            const data = JSON.parse(body || '{}')
            const result = translateIngressToGatewayApi(data)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(result))
          } catch (_err) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Invalid JSON payload' }))
          }
        })
        req.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Request stream error' }))
          }
        })
        return
      }

      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found', path: pathname }))
    },
  })
}
