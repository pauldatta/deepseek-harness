import { useMemo, useState, useSyncExternalStore } from 'react'
import type { CSSProperties, ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { MMB_ASSETS } from '../catalog-data.ts'
import { assessWorkload } from '../assessment-engine.ts'
import { translateIngressToGatewayApi } from '../ingress-translator.ts'
import { MODERNIZATION_RECIPES, runModernizationRecipe } from '../recipes.ts'
import { MMB_RUNTIME_SKILLS } from '../skills.ts'
import type { CloudSource, MmbAsset, RecipeRunResult, WorkloadAssessmentResult, WorkloadType } from '../types.ts'
import { MigrationCenterIcon } from './MigrationCenterIcon.tsx'
import { workbenchStore } from './workbench-state.ts'

export type MigrationCenterWorkbenchProps =
  PropsRuntime<'shell.overlay'> & PropsLocale<'mmb'>

const SAMPLE_INGRESS_YAML = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: store-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: "gke-external"
    networking.gke.io/v1.Ingress/load-balancer-type: "External"
spec:
  tls:
    - hosts:
        - store.example.com
      secretName: store-tls-secret
  rules:
    - host: store.example.com
      http:
        paths:
          - path: /api/v1/orders
            pathType: Prefix
            backend:
              service:
                name: orders-service
                port:
                  number: 8080
          - path: /api/v1/catalog
            pathType: Prefix
            backend:
              service:
                name: catalog-service
                port:
                  number: 8080
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-web
                port:
                  number: 80`

export function MigrationCenterWorkbench({ t }: MigrationCenterWorkbenchProps): ReactElement | null {
  const state = useSyncExternalStore(
    workbenchStore.subscribe,
    workbenchStore.getSnapshot,
  )

  // Local state for assessment tab
  const [assessType, setAssessType] = useState<WorkloadType>('database')
  const [assessSource, setAssessSource] = useState<CloudSource>('aws')
  const [assessTech, setAssessTech] = useState('Oracle 19c')
  const [assessScale, setAssessScale] = useState<'small' | 'medium' | 'large' | 'enterprise'>('large')
  const [assessResult, setAssessResult] = useState<WorkloadAssessmentResult | null>(() =>
    assessWorkload({ workloadType: 'database', sourcePlatform: 'aws', sourceTechnology: 'Oracle 19c' }),
  )

  // Local state for Ingress translator tab
  const [ingressInput, setIngressInput] = useState(SAMPLE_INGRESS_YAML)
  const [translatedOutput, setTranslatedOutput] = useState(() => translateIngressToGatewayApi({ manifest: SAMPLE_INGRESS_YAML }))
  const [copied, setCopied] = useState(false)

  // Local state for recipes tab
  const [selectedRecipe, setSelectedRecipe] = useState<string>('oracle-plsql-to-bigquery')
  const [recipeResult, setRecipeResult] = useState<RecipeRunResult | null>(() => runModernizationRecipe('oracle-plsql-to-bigquery', true))

  // Filtered assets for Portfolio tab
  const [domainFilter, setDomainFilter] = useState<'all' | 'migrate' | 'modernize' | 'build' | 'top-tier'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredAssets = useMemo(() => {
    let list = [...MMB_ASSETS]
    if (domainFilter === 'top-tier') {
      list = list.filter(a => a.score >= 3.0)
    } else if (domainFilter !== 'all') {
      list = list.filter(a => a.domain === domainFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.realityCheck.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q)) ||
        a.targetGcpServices.some(s => s.toLowerCase().includes(q)),
      )
    }
    return list
  }, [domainFilter, searchQuery])

  if (!state.isOpen) return null

  const handleRunAssessment = (): void => {
    const result = assessWorkload({
      workloadType: assessType,
      sourcePlatform: assessSource,
      sourceTechnology: assessTech,
      workloadScale: assessScale,
    })
    setAssessResult(result)
  }

  const handleTranslateIngress = (): void => {
    const res = translateIngressToGatewayApi({ manifest: ingressInput })
    setTranslatedOutput(res)
  }

  const handleCopyTranslated = (): void => {
    navigator.clipboard?.writeText(translatedOutput.combinedYaml)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }

  const handleSimulateRecipe = (id: string): void => {
    setSelectedRecipe(id)
    const res = runModernizationRecipe(id, true)
    setRecipeResult(res)
  }

  return (
    <div style={styles.overlayBackdrop}>
      <div style={styles.modalContainer}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitleRow}>
            <div style={styles.headerIconWrap}>
              <MigrationCenterIcon size={24} />
            </div>
            <div>
              <h2 style={styles.headerTitle}>{t('workbench.title')}</h2>
              <p style={styles.headerSubtitle}>{t('workbench.subtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { workbenchStore.setOpen(false) }}
            style={styles.closeButton}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabBar}>
          <button
            type="button"
            onClick={() => { workbenchStore.setActiveTab('portfolio') }}
            style={state.activeTab === 'portfolio' ? styles.tabActive : styles.tab}
          >
            📊 {t('tab.portfolio')}
          </button>
          <button
            type="button"
            onClick={() => { workbenchStore.setActiveTab('assessment') }}
            style={state.activeTab === 'assessment' ? styles.tabActive : styles.tab}
          >
            ⚡ {t('tab.assessment')}
          </button>
          <button
            type="button"
            onClick={() => { workbenchStore.setActiveTab('ingress') }}
            style={state.activeTab === 'ingress' ? styles.tabActive : styles.tab}
          >
            🔄 {t('tab.ingress')}
          </button>
          <button
            type="button"
            onClick={() => { workbenchStore.setActiveTab('skills') }}
            style={state.activeTab === 'skills' ? styles.tabActive : styles.tab}
          >
            🧠 {t('tab.skills')} ({MMB_RUNTIME_SKILLS.length})
          </button>
          <button
            type="button"
            onClick={() => { workbenchStore.setActiveTab('recipes') }}
            style={state.activeTab === 'recipes' ? styles.tabActive : styles.tab}
          >
            🛠️ {t('tab.recipes')} ({MODERNIZATION_RECIPES.length})
          </button>
        </div>

        {/* Tab Content */}
        <div style={styles.contentArea}>
          {/* TAB 1: PORTFOLIO & 46 ASSETS */}
          {state.activeTab === 'portfolio' && (
            <div>
              {/* Stats Strip */}
              <div style={styles.statsStrip}>
                <div style={styles.statCard}>
                  <div style={styles.statNumber}>46</div>
                  <div style={styles.statLabel}>{t('stats.total')}</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ ...styles.statNumber, color: '#34A853' }}>7</div>
                  <div style={styles.statLabel}>{t('stats.migrate')}</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ ...styles.statNumber, color: '#4285F4' }}>18</div>
                  <div style={styles.statLabel}>{t('stats.modernize')}</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ ...styles.statNumber, color: '#FBBC04' }}>21</div>
                  <div style={styles.statLabel}>{t('stats.build')}</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ ...styles.statNumber, color: '#EA4335' }}>4</div>
                  <div style={styles.statLabel}>{t('stats.topTier')}</div>
                </div>
                <div style={styles.statCard}>
                  <div style={{ ...styles.statNumber, color: '#A142F4' }}>3.5 / 5</div>
                  <div style={styles.statLabel}>Peak (Oracle MCP)</div>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div style={styles.filterRow}>
                <div style={styles.filterButtonGroup}>
                  {(['all', 'migrate', 'modernize', 'build', 'top-tier'] as const).map(dom => (
                    <button
                      key={dom}
                      type="button"
                      onClick={() => { setDomainFilter(dom) }}
                      style={domainFilter === dom ? styles.filterBtnActive : styles.filterBtn}
                    >
                      {dom === 'all' ? t('filter.all') :
                        dom === 'top-tier' ? '⭐ Top-Tier (3.0+)' :
                          dom.charAt(0).toUpperCase() + dom.slice(1)}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder={t('filter.search')}
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value) }}
                  style={styles.searchInput}
                />
              </div>

              {/* Asset Grid */}
              <div style={styles.assetGrid}>
                {filteredAssets.map((asset: MmbAsset) => (
                  <div key={asset.id} style={styles.assetCard}>
                    <div style={styles.assetCardHeader}>
                      <div style={styles.assetCardTitleWrap}>
                        <span style={styles.assetCardName}>{asset.name}</span>
                        <span style={{
                          ...styles.domainTag,
                          background: asset.domain === 'migrate' ? 'rgba(52,168,83,0.15)' :
                            asset.domain === 'modernize' ? 'rgba(66,133,244,0.15)' : 'rgba(251,188,4,0.15)',
                          color: asset.domain === 'migrate' ? '#34A853' :
                            asset.domain === 'modernize' ? '#669df6' : '#fdd663',
                        }}>
                          {asset.domain.toUpperCase()}
                        </span>
                      </div>
                      <div style={{
                        ...styles.scoreBadge,
                        background: asset.score >= 3.0 ? 'rgba(52,168,83,0.2)' :
                          asset.score >= 2.0 ? 'rgba(66,133,244,0.2)' : 'rgba(255,255,255,0.08)',
                        color: asset.score >= 3.0 ? '#81c995' :
                          asset.score >= 2.0 ? '#8ab4f8' : '#9aa0a6',
                      }}>
                        ★ {asset.score.toFixed(1)} / 5.0
                      </div>
                    </div>

                    <p style={styles.assetRealityText}>{asset.realityCheck}</p>

                    <div style={styles.servicesRow}>
                      <span style={styles.servicesLabel}>{t('card.services')}:</span>
                      {asset.targetGcpServices.map((s: string) => (
                        <span key={s} style={styles.serviceChip}>{s}</span>
                      ))}
                    </div>

                    <div style={styles.recommendationBox}>
                      <strong style={{ color: '#8ab4f8' }}>Roadmap:</strong> {asset.antigravityRecommendation}
                    </div>

                    <div style={styles.cardFooter}>
                      <span style={styles.filesText}>
                        {asset.codeFiles} files {asset.hasTests ? '• Automated Tests ✓' : '• No Tests'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAssessTech(asset.name)
                          let nextType: WorkloadType = 'application'
                          if (asset.domain === 'migrate' && asset.id.includes('lakehouse')) nextType = 'data-pipeline'
                          else if (asset.id.includes('oracle') || asset.id.includes('data')) nextType = 'database'
                          else if (asset.id.includes('k8s') || asset.id.includes('gke')) nextType = 'kubernetes'
                          setAssessType(nextType)
                          const updated = assessWorkload({
                            workloadType: nextType,
                            sourcePlatform: assessSource,
                            sourceTechnology: asset.name,
                            workloadScale: assessScale,
                            hasTests: asset.hasTests,
                          })
                          setAssessResult(updated)
                          workbenchStore.setActiveTab('assessment')
                        }}

                        style={styles.cardActionBtn}
                      >
                        Assess Workload →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: WORKLOAD ASSESSMENT */}
          {state.activeTab === 'assessment' && (
            <div style={styles.splitLayout}>
              {/* Left Column: Form */}
              <div style={styles.formPanel}>
                <h3 style={styles.sectionHeading}>🎯 {t('assess.title')}</h3>
                <p style={styles.sectionDesc}>
                  Evaluates target customer architecture against 2026 enterprise compete landscape
                  (Oracle exit, Zero-ETL AI, Gateway API, .NET/Java to Cloud Run).
                </p>

                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>{t('assess.workloadType')}</label>
                  <select
                    value={assessType}
                    onChange={(e) => { setAssessType(e.target.value as WorkloadType) }}
                    style={styles.selectInput}
                  >
                    <option value="database">Database (Oracle, SQL Server, Postgres)</option>
                    <option value="kubernetes">Kubernetes (Ingress, Microservices, Gateway API)</option>
                    <option value="data-pipeline">Data Lake & Pipeline (Hadoop, Spark, Iceberg)</option>
                    <option value="application">Application Monolith (Java Spring Boot, .NET Framework)</option>
                  </select>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>{t('assess.sourcePlatform')}</label>
                  <select
                    value={assessSource}
                    onChange={(e) => { setAssessSource(e.target.value as CloudSource) }}
                    style={styles.selectInput}
                  >
                    <option value="aws">Amazon Web Services (AWS)</option>
                    <option value="azure">Microsoft Azure</option>
                    <option value="on-prem">On-Premises Data Center</option>
                    <option value="gcp">Google Cloud Platform (In-place Modernization)</option>
                  </select>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>{t('assess.sourceTech')}</label>
                  <input
                    type="text"
                    value={assessTech}
                    onChange={(e) => { setAssessTech(e.target.value) }}
                    placeholder="e.g. Oracle 19c, K8s Ingress NGINX, PySpark 2.4, Spring Boot 2.7"
                    style={styles.textInput}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>Workload Scale</label>
                  <select
                    value={assessScale}
                    onChange={(e) => { setAssessScale(e.target.value as 'small' | 'medium' | 'large' | 'enterprise') }}
                    style={styles.selectInput}
                  >
                    <option value="small">Small (&lt; 500 GB, &lt; 100 QPS)</option>
                    <option value="medium">Medium (500 GB - 5 TB, &lt; 1,000 QPS)</option>
                    <option value="large">Large (5 TB - 50 TB, &lt; 10,000 QPS)</option>
                    <option value="enterprise">Enterprise (&gt; 50 TB, High Concurrency)</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleRunAssessment}
                  style={styles.primaryButton}
                >
                  🚀 {t('assess.run')}
                </button>
              </div>

              {/* Right Column: Assessment Output */}
              <div style={styles.resultPanel}>
                {assessResult ? (
                  <div>
                    <div style={styles.resultHeader}>
                      <div>
                        <span style={styles.resultTitle}>{assessResult.sourceTechnology}</span>
                        <span style={styles.resultSourceTag}>Source: {assessResult.sourcePlatform.toUpperCase()}</span>
                      </div>
                      <div style={styles.scoreGaugeBox}>
                        <div style={styles.scoreGaugeValue}>
                          {assessResult.calibratedScore.toFixed(1)}
                        </div>
                        <div style={styles.scoreGaugeLabel}>Calibrated Feasibility / 5.0</div>
                      </div>
                    </div>

                    <div style={styles.dimensionStrip}>
                      <div style={styles.dimensionItem}>
                        <span style={styles.dimensionVal}>{assessResult.dimensionScores.codeMaturity.toFixed(1)}</span>
                        <span style={styles.dimensionLbl}>Code Maturity (35%)</span>
                      </div>
                      <div style={styles.dimensionItem}>
                        <span style={styles.dimensionVal}>{assessResult.dimensionScores.marketFit.toFixed(1)}</span>
                        <span style={styles.dimensionLbl}>Market Fit (35%)</span>
                      </div>
                      <div style={styles.dimensionItem}>
                        <span style={styles.dimensionVal}>{assessResult.dimensionScores.architecturalInnovation.toFixed(1)}</span>
                        <span style={styles.dimensionLbl}>Innovation (30%)</span>
                      </div>
                      <div style={styles.dimensionItem}>
                        <span style={{ ...styles.dimensionVal, color: '#f28b82' }}>{assessResult.complexity}</span>
                        <span style={styles.dimensionLbl}>Complexity</span>
                      </div>
                    </div>

                    <div style={styles.resultCard}>
                      <h4 style={styles.resultCardTitle}>🎯 {t('assess.target')}</h4>
                      <p style={styles.resultTargetText}>{assessResult.recommendedTarget}</p>
                    </div>

                    <div style={styles.resultCard}>
                      <h4 style={styles.resultCardTitle}>📦 Recommended Blueprints & Mature Skills</h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        {assessResult.recommendedBlueprints.map((bp: string) => (
                          <span key={bp} style={styles.blueprintChip}>Blueprint: {bp}</span>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {assessResult.recommendedSkills.map((sk: string) => (
                          <span key={sk} style={styles.skillChip}>Skill: {sk}</span>
                        ))}
                      </div>
                    </div>

                    <div style={styles.resultCard}>
                      <h4 style={styles.resultCardTitle}>📋 {t('assess.actionPlan')}</h4>
                      <ol style={styles.actionPlanList}>
                        {assessResult.actionPlan.map((step: string) => (
                          <li key={step} style={styles.actionPlanItem}>{step}</li>
                        ))}
                      </ol>
                    </div>

                    <div style={styles.resultCard}>
                      <h4 style={styles.resultCardTitle}>⚠️ {t('assess.risks')}</h4>
                      <ul style={styles.riskList}>
                        {assessResult.riskFactors.map((rf: string) => (
                          <li key={rf} style={styles.riskItem}>{rf}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: 'var(--dsw-text-secondary, #9aa0a6)' }}>Run an assessment to view recommendations.</p>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: INGRESS TO GATEWAY API TRANSLATOR */}
          {state.activeTab === 'ingress' && (
            <div>
              <div style={styles.ingressTopBar}>
                <div>
                  <h3 style={styles.sectionHeading}>🔄 {t('ingress.title')}</h3>
                  <p style={styles.sectionDesc}>
                    Converts standard Kubernetes networking.k8s.io/v1 Ingress manifests into GKE
                    GatewayClass (gke-l7-global-external-managed) &amp; HTTPRoute definitions.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => { setIngressInput(SAMPLE_INGRESS_YAML) }}
                    style={styles.secondaryButton}
                  >
                    📄 {t('ingress.loadSample')}
                  </button>
                  <button
                    type="button"
                    onClick={handleTranslateIngress}
                    style={styles.primaryButton}
                  >
                    ⚡ {t('ingress.translate')}
                  </button>
                </div>
              </div>

              <div style={styles.translatorPanes}>
                {/* Left: Input Ingress */}
                <div style={styles.paneHalf}>
                  <div style={styles.paneHeader}>Source Ingress Manifest (YAML)</div>
                  <textarea
                    value={ingressInput}
                    onChange={(e) => { setIngressInput(e.target.value) }}
                    style={styles.codeTextarea}
                    spellCheck={false}
                  />
                </div>

                {/* Right: Output Gateway API */}
                <div style={styles.paneHalf}>
                  <div style={styles.paneHeaderWithAction}>
                    <span>Target GKE Gateway API Manifest (YAML)</span>
                    <button
                      type="button"
                      onClick={handleCopyTranslated}
                      style={styles.copyButton}
                    >
                      {copied ? '✓ ' + t('ingress.copied') : '📋 ' + t('ingress.copy')}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={translatedOutput.combinedYaml}
                    style={{ ...styles.codeTextarea, background: 'rgba(0,0,0,0.4)', color: '#81c995' }}
                    spellCheck={false}
                  />
                </div>
              </div>

              {/* Translation Summary Strip */}
              <div style={styles.translationSummary}>
                <span>✓ Converted <strong>{translatedOutput.summary.routesConverted}</strong> Route Rules</span>
                <span>• Backend Services: <strong>{translatedOutput.summary.backendServices.join(', ') || 'none'}</strong></span>
                <span>• TLS Hosts: <strong>{translatedOutput.summary.tlsHosts.join(', ') || 'None (HTTP only)'}</strong></span>
                {translatedOutput.summary.crossNamespaceGrantGenerated && (
                  <span>• ReferenceGrant: <strong style={{ color: '#81c995' }}>Generated ✓</strong></span>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: MATURE SKILLS */}
          {state.activeTab === 'skills' && (
            <div>
              <h3 style={styles.sectionHeading}>🧠 Mature MMB Runtime Skills</h3>
              <p style={styles.sectionDesc}>
                Baked-in skills registered directly into the DeepSeek Harness runtime (<code style={{ color: '#8ab4f8' }}>ctx.skills</code>) available to agents via <code style={{ color: '#8ab4f8' }}>tool-skill</code>.
              </p>

              <div style={styles.skillsGrid}>
                {MMB_RUNTIME_SKILLS.map(skill => (
                  <div key={skill.name} style={styles.skillCard}>
                    <div style={styles.skillCardHeader}>
                      <span style={styles.skillName}>/{skill.name}</span>
                      <span style={styles.skillSourceBadge}>Runtime In-Box</span>
                    </div>
                    <p style={styles.skillDesc}>{skill.description}</p>
                    <div style={styles.skillContentPreview}>
                      <pre style={styles.skillPre}>{skill.content.slice(0, 300)}...</pre>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(skill.content)
                      }}
                      style={styles.skillCopyBtn}
                    >
                      📋 Copy Full Skill Instructions
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: MODERNIZATION RECIPES */}
          {state.activeTab === 'recipes' && (
            <div style={styles.splitLayout}>
              {/* Left Column: Recipes List */}
              <div style={styles.formPanel}>
                <h3 style={styles.sectionHeading}>🛠️ Automated Modernization Recipes</h3>
                <p style={styles.sectionDesc}>
                  Lossless AST refactoring recipes inspired by OpenRewrite and Moderne for enterprise codebases.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {MODERNIZATION_RECIPES.map(recipe => (
                    <button
                      key={recipe.id}
                      type="button"
                      onClick={() => { handleSimulateRecipe(recipe.id) }}
                      style={selectedRecipe === recipe.id ? styles.recipeSelectBtnActive : styles.recipeSelectBtn}
                    >
                      <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                        {recipe.title}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--dsw-text-secondary, #9aa0a6)' }}>
                        Category: {recipe.category.toUpperCase()}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Execution details */}
              <div style={styles.resultPanel}>
                {recipeResult && (
                  <div>
                    <h3 style={{ ...styles.sectionHeading, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{recipeResult.title}</span>
                      <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', background: 'rgba(52,168,83,0.2)', color: '#81c995' }}>
                        STATUS: {recipeResult.status.toUpperCase()}
                      </span>
                    </h3>
                    <p style={{ ...styles.sectionDesc, marginBottom: '16px' }}>{recipeResult.description}</p>

                    <div style={styles.resultCard}>
                      <h4 style={styles.resultCardTitle}>Automated Verification Steps</h4>
                      <ul style={styles.actionPlanList}>
                        {recipeResult.verificationSteps.map((step: string) => (
                          <li key={step} style={styles.actionPlanItem}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, CSSProperties> = {
  overlayBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.75)',
    backdropFilter: 'blur(8px)',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  modalContainer: {
    width: '94vw',
    maxWidth: '1280px',
    height: '88vh',
    maxHeight: '900px',
    background: '#1a1b1e',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    color: '#e8eaed',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    background: '#202124',
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  headerIconWrap: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    background: 'rgba(66, 133, 244, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4285F4',
  },
  headerTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#ffffff',
  },
  headerSubtitle: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: '#9aa0a6',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#9aa0a6',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '6px 10px',
    borderRadius: '6px',
  },
  tabBar: {
    display: 'flex',
    gap: '4px',
    padding: '8px 24px',
    background: '#1e1f22',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '6px',
    background: 'transparent',
    border: 'none',
    color: '#9aa0a6',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  tabActive: {
    padding: '8px 16px',
    borderRadius: '6px',
    background: 'rgba(66, 133, 244, 0.15)',
    border: '1px solid rgba(66, 133, 244, 0.3)',
    color: '#8ab4f8',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  contentArea: {
    flex: 1,
    padding: '20px 24px',
    overflowY: 'auto',
  },
  statsStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px',
    marginBottom: '16px',
  },
  statCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    padding: '12px 16px',
    textAlign: 'center',
  },
  statNumber: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#ffffff',
  },
  statLabel: {
    fontSize: '11px',
    color: '#9aa0a6',
    marginTop: '2px',
    textTransform: 'uppercase',
  },
  filterRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  filterButtonGroup: {
    display: 'flex',
    gap: '6px',
  },
  filterBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    color: '#9aa0a6',
    fontSize: '12px',
    cursor: 'pointer',
  },
  filterBtnActive: {
    padding: '6px 12px',
    borderRadius: '6px',
    background: '#4285F4',
    border: '1px solid #4285F4',
    color: '#ffffff',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  searchInput: {
    flex: 1,
    minWidth: '240px',
    padding: '8px 12px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#ffffff',
    fontSize: '13px',
    outline: 'none',
  },
  assetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: '16px',
  },
  assetCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  assetCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  assetCardTitleWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  assetCardName: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
  },
  domainTag: {
    alignSelf: 'flex-start',
    fontSize: '10px',
    fontWeight: 700,
    padding: '2px 6px',
    borderRadius: '4px',
  },
  scoreBadge: {
    fontSize: '12px',
    fontWeight: 700,
    padding: '4px 8px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
  },
  assetRealityText: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '1.45',
    color: '#bdc1c6',
  },
  servicesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'center',
  },
  servicesLabel: {
    fontSize: '11px',
    color: '#9aa0a6',
    marginRight: '2px',
  },
  serviceChip: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(66, 133, 244, 0.1)',
    color: '#8ab4f8',
  },
  recommendationBox: {
    fontSize: '11px',
    lineHeight: '1.4',
    padding: '8px 10px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderLeft: '3px solid #8ab4f8',
    color: '#e8eaed',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  },
  filesText: {
    fontSize: '11px',
    color: '#80868b',
  },
  cardActionBtn: {
    background: 'transparent',
    border: 'none',
    color: '#8ab4f8',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 8px',
  },
  splitLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 380px) 1fr',
    gap: '24px',
    height: '100%',
  },
  formPanel: {
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '10px',
    padding: '16px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
  },
  resultPanel: {
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '10px',
    padding: '20px',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    overflowY: 'auto',
  },
  sectionHeading: {
    margin: '0 0 4px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  sectionDesc: {
    margin: '0 0 16px',
    fontSize: '12px',
    color: '#9aa0a6',
    lineHeight: '1.4',
  },
  fieldGroup: {
    marginBottom: '14px',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 500,
    color: '#bdc1c6',
    marginBottom: '6px',
  },
  selectInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    fontSize: '13px',
  },
  textInput: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    fontSize: '13px',
    boxSizing: 'border-box',
  },
  primaryButton: {
    width: '100%',
    padding: '10px 16px',
    borderRadius: '6px',
    background: '#4285F4',
    border: 'none',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  secondaryButton: {
    padding: '8px 14px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#ffffff',
    fontSize: '12px',
    cursor: 'pointer',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  resultTitle: {
    display: 'block',
    fontSize: '18px',
    fontWeight: 700,
    color: '#ffffff',
  },
  resultSourceTag: {
    fontSize: '12px',
    color: '#8ab4f8',
  },
  scoreGaugeBox: {
    textAlign: 'right',
  },
  scoreGaugeValue: {
    fontSize: '28px',
    fontWeight: 800,
    color: '#81c995',
  },
  scoreGaugeLabel: {
    fontSize: '10px',
    color: '#9aa0a6',
    textTransform: 'uppercase',
  },
  dimensionStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
    marginBottom: '16px',
  },
  dimensionItem: {
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '6px',
    padding: '8px',
    textAlign: 'center',
  },
  dimensionVal: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 700,
    color: '#ffffff',
  },
  dimensionLbl: {
    fontSize: '10px',
    color: '#9aa0a6',
  },
  resultCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    padding: '14px',
    marginBottom: '12px',
  },
  resultCardTitle: {
    margin: '0 0 8px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#8ab4f8',
  },
  resultTargetText: {
    margin: 0,
    fontSize: '13px',
    fontWeight: 600,
    color: '#ffffff',
  },
  blueprintChip: {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
    background: 'rgba(66, 133, 244, 0.15)',
    color: '#8ab4f8',
  },
  skillChip: {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
    background: 'rgba(52, 168, 83, 0.15)',
    color: '#81c995',
  },
  actionPlanList: {
    margin: 0,
    paddingLeft: '18px',
  },
  actionPlanItem: {
    fontSize: '12px',
    lineHeight: '1.5',
    color: '#e8eaed',
    marginBottom: '6px',
  },
  riskList: {
    margin: 0,
    paddingLeft: '18px',
  },
  riskItem: {
    fontSize: '12px',
    lineHeight: '1.45',
    color: '#f28b82',
    marginBottom: '4px',
  },
  ingressTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  translatorPanes: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    height: '420px',
  },
  paneHalf: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  paneHeader: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#bdc1c6',
    marginBottom: '6px',
  },
  paneHeaderWithAction: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px',
    fontWeight: 600,
    color: '#bdc1c6',
    marginBottom: '6px',
  },
  codeTextarea: {
    flex: 1,
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    background: '#121316',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#e8eaed',
    fontFamily: 'monospace',
    fontSize: '12px',
    lineHeight: '1.4',
    resize: 'none',
    boxSizing: 'border-box',
    outline: 'none',
  },
  copyButton: {
    background: 'rgba(66, 133, 244, 0.2)',
    border: '1px solid rgba(66, 133, 244, 0.4)',
    color: '#8ab4f8',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  translationSummary: {
    marginTop: '12px',
    padding: '10px 14px',
    borderRadius: '6px',
    background: 'rgba(52, 168, 83, 0.1)',
    border: '1px solid rgba(52, 168, 83, 0.2)',
    fontSize: '12px',
    color: '#81c995',
    display: 'flex',
    gap: '16px',
  },
  skillsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '16px',
  },
  skillCard: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '8px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  skillCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skillName: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#81c995',
  },
  skillSourceBadge: {
    fontSize: '10px',
    padding: '2px 6px',
    borderRadius: '4px',
    background: 'rgba(255, 255, 255, 0.08)',
    color: '#bdc1c6',
  },
  skillDesc: {
    margin: 0,
    fontSize: '12px',
    color: '#bdc1c6',
    lineHeight: '1.4',
  },
  skillContentPreview: {
    background: '#121316',
    borderRadius: '6px',
    padding: '8px',
    maxHeight: '100px',
    overflow: 'hidden',
  },
  skillPre: {
    margin: 0,
    fontSize: '10px',
    color: '#9aa0a6',
    whiteSpace: 'pre-wrap',
  },
  skillCopyBtn: {
    background: 'rgba(255, 255, 255, 0.04)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#8ab4f8',
    padding: '6px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 'auto',
  },
  recipeSelectBtn: {
    textAlign: 'left',
    padding: '12px',
    borderRadius: '8px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#ffffff',
    cursor: 'pointer',
  },
  recipeSelectBtnActive: {
    textAlign: 'left',
    padding: '12px',
    borderRadius: '8px',
    background: 'rgba(66, 133, 244, 0.15)',
    border: '1px solid #4285F4',
    color: '#ffffff',
    cursor: 'pointer',
  },
}
