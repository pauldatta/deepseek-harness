import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import {
  apply,
  Config,
  MMB_ASSETS,
  evaluateRubric,
  assessWorkload,
  translateIngressToGatewayApi,
  MODERNIZATION_RECIPES,
  runModernizationRecipe,
  MMB_RUNTIME_SKILLS,
  name,
  inject,
} from '../src/index.ts'

describe('MMB Migration Workbench', () => {
  describe('Plugin Definition', () => {
    it('exports correct name and default config', () => {
      expect(name).toBe('mmb-migration-workbench')
      const cfg = Config({})
      expect(cfg.enableRuntimeSkills).toBe(true)
      expect(cfg.enableHttpRoutes).toBe(true)
    })
  })

  describe('46 Assets Assessment Catalog', () => {
    it('contains exactly 46 evaluated projects from GoogleCloudPlatform/cloud-solutions', () => {
      expect(MMB_ASSETS).toHaveLength(46)
    })

    it('has accurate domain distribution: 7 Migrate, 18 Modernize, 21 Build', () => {
      const migrate = MMB_ASSETS.filter(a => a.domain === 'migrate')
      const modernize = MMB_ASSETS.filter(a => a.domain === 'modernize')
      const build = MMB_ASSETS.filter(a => a.domain === 'build')

      expect(migrate).toHaveLength(7)
      expect(modernize).toHaveLength(18)
      expect(build).toHaveLength(21)
    })

    it('calibrated top-scoring assets match document facts', () => {
      const oracle = MMB_ASSETS.find(a => a.id === 'oracle-bigquery-mcp-agent')
      expect(oracle).toBeDefined()
      expect(oracle?.score).toBe(3.5)
      expect(oracle?.status).toBe('top-tier')
      expect(oracle?.targetGcpServices).toContain('BigQuery')
      expect(oracle?.targetGcpServices).toContain('Datastream')

      const hybridNeg = MMB_ASSETS.find(a => a.id === 'k8s-hybrid-neg-controller')
      expect(hybridNeg).toBeDefined()
      expect(hybridNeg?.score).toBe(3.2)

      const confAi = MMB_ASSETS.find(a => a.id === 'confidential-ai-model-serving')
      expect(confAi).toBeDefined()
      expect(confAi?.score).toBe(3.4)

      const operationalAi = MMB_ASSETS.find(a => a.id === 'operational-ai-leap')
      expect(operationalAi).toBeDefined()
      expect(operationalAi?.score).toBe(3.0)

      const ingress2gw = MMB_ASSETS.find(a => a.id === 'gke-migration-agent')
      expect(ingress2gw).toBeDefined()
      expect(ingress2gw?.score).toBe(2.7)
    })

    it('accurately identifies 19 archived stubs capped at 0.6', () => {
      const stubs = MMB_ASSETS.filter(a => a.score === 0.6)
      expect(stubs).toHaveLength(19)
      expect(stubs.every(s => s.status === 'archived')).toBe(true)
    })
  })

  describe('Calibrated Rubric Engine', () => {
    it('calculates weighted score according to (0.35 * Maturity + 0.35 * MarketFit + 0.30 * Innovation)', () => {
      // 0.35 * 4.0 + 0.35 * 4.0 + 0.30 * 4.0 = 4.0
      const eval1 = evaluateRubric(4.0, 4.0, 4.0)
      expect(eval1.rawScore).toBe(4.0)
      expect(eval1.calibratedScore).toBe(4.0)

      // 0.35 * 3.5 + 0.35 * 4.5 + 0.30 * 4.0 = 1.225 + 1.575 + 1.2 = 4.0
      const eval2 = evaluateRubric(3.5, 4.5, 4.0)
      expect(eval2.rawScore).toBe(4.0)
    })

    it('enforces hard caps and penalty deductions', () => {
      // Archived stub capped at 0.6
      const stubEval = evaluateRubric(3.0, 3.0, 3.0, { isArchivedStub: true })
      expect(stubEval.calibratedScore).toBe(0.6)

      // Documentation only capped at 1.3
      const docEval = evaluateRubric(3.5, 4.0, 3.5, { isDocOnly: true })
      expect(docEval.calibratedScore).toBe(1.3)

      // Hollow skeleton deducts 2.0
      const hollowEval = evaluateRubric(3.0, 3.0, 3.0, { isHollowSkeleton: true })
      expect(hollowEval.calibratedScore).toBe(1.0)
    })

    it('assesses database workload for Oracle exit to BigQuery', () => {
      const result = assessWorkload({
        workloadType: 'database',
        sourcePlatform: 'aws',
        sourceTechnology: 'Oracle 19c Enterprise',
        workloadScale: 'large',
      })

      expect(result.workloadType).toBe('database')
      expect(result.calibratedScore).toBeGreaterThanOrEqual(3.5)
      expect(result.recommendedTarget).toContain('BigQuery')
      expect(result.recommendedBlueprints).toContain('oracle-bigquery-mcp-agent')
      expect(result.recommendedSkills).toContain('mmb-oracle-bigquery')
      expect(result.actionPlan.length).toBeGreaterThanOrEqual(4)
      expect(result.riskFactors.length).toBeGreaterThanOrEqual(2)
    })

    it('assesses Kubernetes Ingress modernization to Gateway API', () => {
      const result = assessWorkload({
        workloadType: 'kubernetes',
        sourcePlatform: 'on-prem',
        sourceTechnology: 'Kubernetes Ingress NGINX',
      })

      expect(result.workloadType).toBe('kubernetes')
      expect(result.recommendedTarget).toContain('Gateway API')
      expect(result.recommendedBlueprints).toContain('gke-migration-agent')
      expect(result.recommendedSkills).toContain('mmb-ingress2gateway')
    })

    it('applies penalty and risk factor when hasTests is false', () => {
      const result = assessWorkload({
        workloadType: 'application',
        sourcePlatform: 'aws',
        sourceTechnology: 'Spring Boot 2.7',
        hasTests: false,
      })

      expect(result.penaltiesApplied.some(p => p.reason.includes('Untested Workload'))).toBe(true)
      expect(result.riskFactors.some(r => r.includes('lacks automated test coverage'))).toBe(true)
      expect(result.actionPlan.some(a => a.includes('Automated Test Baseline'))).toBe(true)
    })

    it('escalates complexity and plans for enterprise workload scale', () => {
      const result = assessWorkload({
        workloadType: 'data-pipeline',
        sourcePlatform: 'on-prem',
        sourceTechnology: 'Hadoop Spark',
        workloadScale: 'enterprise',
      })

      expect(result.complexity).toBe('Critical')
      expect(result.riskFactors.some(r => r.includes('Enterprise scale'))).toBe(true)
      expect(result.actionPlan.some(a => a.includes('Enterprise Resilience'))).toBe(true)
    })
  })


  describe('Ingress to Gateway API AST Translator', () => {
    const sampleIngress = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: test-ns
  annotations:
    kubernetes.io/ingress.class: "gke-external"
spec:
  tls:
    - hosts:
        - api.test.com
      secretName: api-tls
  rules:
    - host: api.test.com
      http:
        paths:
          - path: /users
            pathType: Prefix
            backend:
              service:
                name: user-service
                port:
                  number: 8080
          - path: /healthz
            pathType: Exact
            backend:
              service:
                name: health-service
                port:
                  number: 8081`

    it('translates Ingress to valid Gateway and HTTPRoute YAML', () => {
      const result = translateIngressToGatewayApi({ manifest: sampleIngress })

      expect(result.summary.routesConverted).toBe(2)
      expect(result.summary.backendServices).toContain('user-service')
      expect(result.summary.backendServices).toContain('health-service')
      expect(result.summary.tlsHosts).toContain('api.test.com')

      expect(result.gatewayYaml).toContain('kind: Gateway')
      expect(result.gatewayYaml).toContain('gatewayClassName: gke-l7-global-external-managed')
      expect(result.gatewayYaml).toContain('name: api-ingress-gateway')

      expect(result.httpRouteYaml).toContain('kind: HTTPRoute')
      expect(result.httpRouteYaml).toContain('hostnames:')
      expect(result.httpRouteYaml).toContain('"api.test.com"')
      expect(result.httpRouteYaml).toContain('value: "/users"')
      expect(result.httpRouteYaml).toContain('type: PathPrefix')
      expect(result.httpRouteYaml).toContain('value: "/healthz"')
      expect(result.httpRouteYaml).toContain('type: Exact')
      expect(result.httpRouteYaml).toContain('name: user-service')
    })

    it('supports internal GKE load balancer classification', () => {
      const internalIngress = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: internal-app
  annotations:
    networking.gke.io/v1.Ingress/load-balancer-type: "Internal"
spec:
  rules:
    - http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: int-svc
                port:
                  number: 80`

      const result = translateIngressToGatewayApi({ manifest: internalIngress })
      expect(result.gatewayYaml).toContain('gatewayClassName: gke-l7-rilb')
    })

    it('generates ReferenceGrant and allows cross-namespace routing when gatewayNamespace differs', () => {
      const result = translateIngressToGatewayApi({
        manifest: sampleIngress,
        gatewayNamespace: 'gateway-infra',
      })

      expect(result.referenceGrantYaml).toBeDefined()
      expect(result.referenceGrantYaml).toContain('kind: ReferenceGrant')
      expect(result.referenceGrantYaml).toContain('namespace: test-ns')
      expect(result.referenceGrantYaml).toContain('namespace: gateway-infra')
      expect(result.combinedYaml).toContain('kind: ReferenceGrant')
      expect(result.gatewayYaml).toContain('namespace: gateway-infra')
      expect(result.gatewayYaml).toContain('from: All')
      expect(result.httpRouteYaml).toContain('namespace: test-ns')
      expect(result.summary.crossNamespaceGrantGenerated).toBe(true)
    })

    it('correctly maps defaultBackend when no rules are specified', () => {
      const defaultBackendIngress = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fallback-ingress
  namespace: prod
spec:
  defaultBackend:
    service:
      name: custom-fallback-svc
      port:
        number: 9000`

      const result = translateIngressToGatewayApi({ manifest: defaultBackendIngress })
      expect(result.httpRouteYaml).toContain('name: custom-fallback-svc')
      expect(result.httpRouteYaml).toContain('port: 9000')
      expect(result.summary.backendServices).toContain('custom-fallback-svc')
    })

    it('resiliently parses 2-space indented TLS configurations', () => {
      const twoSpaceTlsIngress = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: two-space-tls
spec:
  tls:
  - hosts:
    - store.twospace.com
    secretName: twospace-secret
  rules:
  - host: store.twospace.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: store-svc
            port:
              number: 80`

      const result = translateIngressToGatewayApi({ manifest: twoSpaceTlsIngress })
      expect(result.summary.tlsHosts).toContain('store.twospace.com')
      expect(result.gatewayYaml).toContain('hostname: store.twospace.com')
      expect(result.gatewayYaml).toContain('name: twospace-secret')
    })

  })

  describe('Modernization Recipes', () => {
    it('provides 6 standard modernization recipes', () => {
      expect(MODERNIZATION_RECIPES).toHaveLength(6)
      expect(MODERNIZATION_RECIPES.some(r => r.id === 'java-spring-boot-3')).toBe(true)
      expect(MODERNIZATION_RECIPES.some(r => r.id === 'dotnet-core-cloud-run')).toBe(true)
      expect(MODERNIZATION_RECIPES.some(r => r.id === 'pyspark-to-dataproc-serverless')).toBe(true)
      expect(MODERNIZATION_RECIPES.some(r => r.id === 'oracle-plsql-to-bigquery')).toBe(true)
    })

    it('executes recipe simulation with dry run output', () => {
      const res = runModernizationRecipe('java-spring-boot-3', true)
      expect(res.status).toBe('dry-run')
      expect(res.recipeId).toBe('java-spring-boot-3')
      expect(res.verificationSteps.length).toBeGreaterThan(0)
    })
  })

  describe('Mature Runtime Skills', () => {
    it('provides 6 verified runtime skills', () => {
      expect(MMB_RUNTIME_SKILLS).toHaveLength(6)
      const names = MMB_RUNTIME_SKILLS.map(s => s.name)
      expect(names).toContain('mmb-migration-discovery')
      expect(names).toContain('mmb-oracle-bigquery')
      expect(names).toContain('mmb-ingress2gateway')
      expect(names).toContain('mmb-legacy-detox')
      expect(names).toContain('mmb-app-modernization')
      expect(names).toContain('mmb-alloydb-vector')
    })

    it('skills have valid markdown instruction bodies', () => {
      for (const skill of MMB_RUNTIME_SKILLS) {
        expect(skill.content).toContain('# ')
        expect(skill.description.length).toBeGreaterThan(20)
      }
    })
  })

  describe('Cordis Context Integration', () => {
    it('registers tools, systemPrompt section, and skills into Cordis context', async () => {
      const ctx = new Context()
      const registeredTools: Record<string, unknown> = {}
      const registeredSections: string[] = []
      const registeredSkills: string[] = []

      ctx.provide('tools')
      ;(ctx as unknown as { tools: { register: (t: { name: string }) => void } }).tools = {
        register: (tool) => {
          registeredTools[tool.name] = tool
        },
      }

      ctx.provide('systemPrompt')
      ;(ctx as unknown as { systemPrompt: { section: (s: { name: string }) => void } }).systemPrompt = {
        section: (sec) => {
          registeredSections.push(sec.name)
        },
      }

      ctx.provide('skills')
      ;(ctx as unknown as { skills: { register: (s: { name: string }) => void } }).skills = {
        register: (skill) => {
          registeredSkills.push(skill.name)
        },
      }

      apply(ctx, Config({}))

      expect(registeredSections).toContain('tool:mmb')

      expect(registeredTools).toHaveProperty('mmb_catalog')
      expect(registeredTools).toHaveProperty('mmb_assess_workload')
      expect(registeredTools).toHaveProperty('mmb_ingress_translate')
      expect(registeredTools).toHaveProperty('mmb_generate_migration_plan')
      expect(registeredTools).toHaveProperty('mmb_recipe_run')

      expect(registeredSkills).toHaveLength(6)
      expect(registeredSkills).toContain('mmb-oracle-bigquery')

      // Execute mmb_catalog tool
      const catalogTool = registeredTools.mmb_catalog as {
        execute: (args: Record<string, unknown>) => Promise<{ total: number; assets: unknown[] }>
      }
      const catalogRes = await catalogTool.execute({ domain: 'modernize' })
      expect(catalogRes.total).toBe(18)

      // Execute mmb_assess_workload tool
      const assessTool = registeredTools.mmb_assess_workload as {
        execute: (args: Record<string, unknown>) => Promise<{ calibratedScore: number; recommendedTarget: string }>
      }
      const assessRes = await assessTool.execute({
        workload_type: 'database',
        source_platform: 'aws',
        source_technology: 'Oracle 19c',
      })
      expect(assessRes.calibratedScore).toBeGreaterThanOrEqual(3.5)
      expect(assessRes.recommendedTarget).toContain('BigQuery')

      // Execute mmb_recipe_run tool
      const recipeTool = registeredTools.mmb_recipe_run as {
        execute: (args: Record<string, unknown>) => Promise<{ status: string }>
      }
      const recipeRes = await recipeTool.execute({ recipe_id: 'java-spring-boot-3', dry_run: true })
      expect(recipeRes.status).toBe('dry-run')
    })
  })

  describe('HTTP REST Routes', () => {
    it('registers /api/mmb routes and handles requests', async () => {
      const ctx = new Context()
      ctx.provide('tools')
      ;(ctx as unknown as { tools: { register: () => void } }).tools = { register: () => {} }
      ctx.provide('systemPrompt')
      ;(ctx as unknown as { systemPrompt: { section: () => void } }).systemPrompt = { section: () => {} }

      interface MockRoute {
        kind: string
        path: string
        handler: (req: unknown, res: unknown) => Promise<void>
      }

      let registeredRoute: MockRoute | undefined
      ctx.provide('webServer')
      ;(ctx as unknown as { webServer: { register: (r: MockRoute) => void } }).webServer = {
        register: (route) => {
          registeredRoute = route
        },
      }

      apply(ctx, Config({}))
      expect(registeredRoute).toBeDefined()
      expect(registeredRoute?.path).toBe('/api/mmb')

      // Mock req & res for GET /api/mmb/stats
      const mockReq = { method: 'GET', url: '/api/mmb/stats' }
      let statusCode = 0
      let responseData = ''
      const mockRes = {
        setHeader: () => {},
        writeHead: (code: number) => { statusCode = code },
        end: (data: string) => { responseData = data },
      }

      await registeredRoute?.handler(mockReq, mockRes)
      expect(statusCode).toBe(200)
      const stats = JSON.parse(responseData)
      expect(stats.totalProjects).toBe(46)
      expect(stats.migrateCount).toBe(7)
      expect(stats.modernizeCount).toBe(18)
      expect(stats.buildCount).toBe(21)
      expect(stats.topTierCount).toBe(4)
      expect(stats.averageScore).toBe(Number((MMB_ASSETS.reduce((sum, a) => sum + a.score, 0) / MMB_ASSETS.length).toFixed(2)))
      expect(stats.peakScore).toBe(Math.max(...MMB_ASSETS.map(a => a.score)))


      // Mock req & res for GET /api/mmb/projects?domain=migrate
      let projData = ''
      await registeredRoute?.handler(
        { method: 'GET', url: '/api/mmb/projects?domain=migrate' },
        { setHeader: () => {}, writeHead: (code: number) => { statusCode = code }, end: (d: string) => { projData = d } },
      )
      expect(statusCode).toBe(200)
      const projResult = JSON.parse(projData)
      expect(projResult.total).toBe(7)
      expect(projResult.projects[0].domain).toBe('migrate')

      // Mock req & res for GET /api/mmb/recipes
      let recipeData = ''
      await registeredRoute?.handler(
        { method: 'GET', url: '/api/mmb/recipes' },
        { setHeader: () => {}, writeHead: (code: number) => { statusCode = code }, end: (d: string) => { recipeData = d } },
      )
      expect(statusCode).toBe(200)
      const recipesResult = JSON.parse(recipeData)
      expect(recipesResult.total).toBe(6)

      // Mock EventEmitter for POST /api/mmb/assess
      let assessData = ''
      const assessReq = {
        method: 'POST',
        url: '/api/mmb/assess',
        on: (event: string, cb: (arg?: unknown) => void) => {
          if (event === 'data') cb(JSON.stringify({ workloadType: 'database', sourcePlatform: 'aws', sourceTechnology: 'Oracle' }))
          if (event === 'end') cb()
        },
      }
      await registeredRoute?.handler(
        assessReq,
        { setHeader: () => {}, writeHead: (code: number) => { statusCode = code }, end: (d: string) => { assessData = d } },
      )
      expect(statusCode).toBe(200)
      const assessParsed = JSON.parse(assessData)
      expect(assessParsed.recommendedTarget).toContain('BigQuery')

      // Mock EventEmitter for POST /api/mmb/translate-ingress
      let translateData = ''
      const translateReq = {
        method: 'POST',
        url: '/api/mmb/translate-ingress',
        on: (event: string, cb: (arg?: unknown) => void) => {
          if (event === 'data') cb(JSON.stringify({ manifest: 'apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: x\nspec:\n  rules: []' }))
          if (event === 'end') cb()
        },
      }
      await registeredRoute?.handler(
        translateReq,
        { setHeader: () => {}, writeHead: (code: number) => { statusCode = code }, end: (d: string) => { translateData = d } },
      )
      expect(statusCode).toBe(200)
      const translateParsed = JSON.parse(translateData)
      expect(translateParsed.gatewayYaml).toContain('kind: Gateway')

      // Test OPTIONS CORS preflight
      await registeredRoute?.handler(
        { method: 'OPTIONS', url: '/api/mmb/stats' },
        { setHeader: () => {}, writeHead: (code: number) => { statusCode = code }, end: () => {} },
      )
      expect(statusCode).toBe(204)

      // Test stream error handling on POST /api/mmb/assess
      const errorReq = {
        method: 'POST',
        url: '/api/mmb/assess',
        on: (event: string, cb: (arg?: unknown) => void) => {
          if (event === 'error') cb(new Error('abort'))
        },
      }
      let streamErrorCode = 0
      let streamErrorData = ''
      await registeredRoute?.handler(
        errorReq,
        {
          headersSent: false,
          setHeader: () => {},
          writeHead: (code: number) => { streamErrorCode = code },
          end: (d: string) => { streamErrorData = d },
        },
      )
      expect(streamErrorCode).toBe(400)
      expect(JSON.parse(streamErrorData).error).toBe('Request stream error')

      // Test 404 for unknown route
      let notFoundData = ''
      await registeredRoute?.handler(
        { method: 'GET', url: '/api/mmb/nonexistent' },
        { setHeader: () => {}, writeHead: (code: number) => { statusCode = code }, end: (d: string) => { notFoundData = d } },
      )
      expect(statusCode).toBe(404)
      expect(JSON.parse(notFoundData).error).toBe('Not found')
    })
  })

  describe('Plugin Mounting and Cordis Injection Isolation', () => {
    it('boots cleanly as a registered plugin without optional skills or webServer provided', async () => {
      const ctx = new Context()
      ctx.provide('tools', { register: () => {} })
      ctx.provide('systemPrompt', { section: () => {} })

      const fiber = await ctx.plugin({ apply, inject, Config, name }, {})
      expect(fiber).toBeDefined()
    })

    it('boots cleanly as a registered plugin with optional skills and webServer provided without inject violation', async () => {
      const ctx = new Context()
      ctx.provide('tools', { register: () => {} })
      ctx.provide('systemPrompt', { section: () => {} })
      const registeredSkills: string[] = []
      ctx.provide('skills', { register: (s: { name: string }) => registeredSkills.push(s.name) })
      let registeredRoute: { path: string } | undefined
      ctx.provide('webServer', { register: (r: { path: string }) => { registeredRoute = r } })

      const fiber = await ctx.plugin({ apply, inject, Config, name }, {})
      expect(fiber).toBeDefined()
      expect(registeredSkills).toHaveLength(6)
      expect(registeredRoute?.path).toBe('/api/mmb')
    })

    it('supports disposal and remounting without duplicate route or skill registration leaks', async () => {
      const ctx = new Context()
      ctx.provide('tools', { register: () => () => {} })
      ctx.provide('systemPrompt', { section: () => () => {} })
      let registeredRoute: { path: string } | undefined
      let routeDisposed = false
      const registeredSkills = new Set<string>()
      ctx.provide('skills', {
        register: (s: { name: string }) => {
          registeredSkills.add(s.name)
          return () => { registeredSkills.delete(s.name) }
        },
      })
      ctx.provide('webServer', {
        register: (r: { path: string }) => {
          registeredRoute = r
          return () => {
            routeDisposed = true
            registeredRoute = undefined
          }
        },
      })

      const fiber1 = await ctx.plugin({ apply, inject, Config, name }, {})
      expect(registeredRoute?.path).toBe('/api/mmb')
      expect(registeredSkills.size).toBe(6)

      await fiber1.dispose()
      expect(routeDisposed).toBe(true)
      expect(registeredRoute).toBeUndefined()
      expect(registeredSkills.size).toBe(0)

      // Remounting succeeds cleanly with fresh registrations
      const fiber2 = await ctx.plugin({ apply, inject, Config, name }, {})
      expect(fiber2).toBeDefined()
      expect(registeredRoute?.path).toBe('/api/mmb')
      expect(registeredSkills.size).toBe(6)
    })
  })
})
