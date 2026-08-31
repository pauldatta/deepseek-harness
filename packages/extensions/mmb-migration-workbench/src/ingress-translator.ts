/**
 * Ingress to Gateway API Translator.
 * Translates networking.k8s.io/v1 Ingress manifests into modern GKE
 * gateway.networking.k8s.io/v1 Gateway and HTTPRoute manifests.
 * @module @deepseek-ai/dsh-mmb-migration-workbench/ingress-translator
 */

import type { IngressTranslateRequest, IngressTranslateResult } from './types.ts'

interface ParsedRulePath {
  path: string
  pathType: 'Prefix' | 'Exact' | 'ImplementationSpecific'
  serviceName: string
  servicePort: number
}

interface ParsedRule {
  host?: string | undefined
  paths: ParsedRulePath[]
}

interface ParsedTls {
  hosts: string[]
  secretName: string
}

interface ParsedIngress {
  name: string
  namespace: string
  ingressClassName?: string | undefined
  annotations: Record<string, string>
  rules: ParsedRule[]
  tls: ParsedTls[]
}

/**
 * Lightweight deterministic YAML-to-Ingress parser and Gateway API generator.
 */
export function translateIngressToGatewayApi(request: IngressTranslateRequest): IngressTranslateResult {
  const parsed = parseIngressYaml(request.manifest)
  const routeNamespace = parsed.namespace || 'default'
  const isCrossNamespace = Boolean(request.gatewayNamespace && request.gatewayNamespace !== routeNamespace)
  const gatewayNamespace = request.gatewayNamespace ?? routeNamespace
  const gatewayName = request.gatewayName ?? `${parsed.name}-gateway`

  // Determine GatewayClass based on ingress class or annotations
  let gatewayClass = 'gke-l7-global-external-managed'
  const isInternal = parsed.annotations['kubernetes.io/ingress.class'] === 'gke-internal'
    || parsed.ingressClassName === 'gke-internal'
    || parsed.annotations['networking.gke.io/v1.Ingress/load-balancer-type'] === 'Internal'
  if (isInternal) {
    gatewayClass = 'gke-l7-rilb'
  }

  // Generate Gateway YAML
  const listeners: string[] = []
  const tlsHosts: string[] = []
  const fromNamespace = isCrossNamespace ? 'All' : 'Same'

  // Default HTTP listener
  listeners.push(`    - name: http
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: ${fromNamespace}`)

  // TLS listeners if present
  for (let i = 0; i < parsed.tls.length; i++) {
    const tls = parsed.tls[i]
    if (!tls) continue
    for (const host of tls.hosts) {
      tlsHosts.push(host)
      const listenerName = `https-${host.replace(/[^a-z0-9-]/gi, '-').toLowerCase()}`
      listeners.push(`    - name: ${listenerName}
      protocol: HTTPS
      port: 443
      hostname: ${host}
      tls:
        mode: Terminate
        certificateRefs:
          - kind: Secret
            group: ""
            name: ${tls.secretName}
      allowedRoutes:
        namespaces:
          from: ${fromNamespace}`)
    }
  }

  const gatewayYaml = `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: ${gatewayName}
  namespace: ${gatewayNamespace}
  labels:
    app.kubernetes.io/managed-by: dsh-mmb-migration-workbench
spec:
  gatewayClassName: ${gatewayClass}
  listeners:
${listeners.join('\n')}`

  // Generate HTTPRoute YAML
  const httpRouteRules: string[] = []
  const backendServices: Set<string> = new Set()
  let routesCount = 0

  for (const rule of parsed.rules) {
    const ruleBlocks: string[] = []

    for (const p of rule.paths) {
      routesCount++
      backendServices.add(p.serviceName)
      const matchType = p.pathType === 'Exact' ? 'Exact' : 'PathPrefix'
      ruleBlocks.push(`    - matches:
        - path:
            type: ${matchType}
            value: "${p.path}"
      backendRefs:
        - name: ${p.serviceName}
          port: ${p.servicePort}
          weight: 1`)
    }

    if (ruleBlocks.length > 0) {
      httpRouteRules.push(ruleBlocks.join('\n'))
    }
  }

  const uniqueHosts = Array.from(
    new Set(parsed.rules.map(r => r.host).filter((h): h is string => Boolean(h && h.trim()))),
  )

  const hostnamesBlock = uniqueHosts.length > 0
    ? `  hostnames:\n${uniqueHosts.map(h => `    - "${h}"`).join('\n')}\n`
    : ''

  const httpRouteYaml = `apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: ${parsed.name}-route
  namespace: ${routeNamespace}
  labels:
    app.kubernetes.io/managed-by: dsh-mmb-migration-workbench
spec:
  parentRefs:
    - name: ${gatewayName}
      namespace: ${gatewayNamespace}
${hostnamesBlock}${httpRouteRules.length > 0 ? `  rules:\n${httpRouteRules.join('\n')}` : '  rules: []'}`

  let referenceGrantYaml: string | undefined
  if (isCrossNamespace) {
    referenceGrantYaml = `apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: ${gatewayName}-grant
  namespace: ${routeNamespace}
  labels:
    app.kubernetes.io/managed-by: dsh-mmb-migration-workbench
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: Gateway
      namespace: ${gatewayNamespace}
  to:
    - group: ""
      kind: Service`
  }

  const combinedYamlParts = [
    '# ══════════════════════════════════════════════════════════════════════════════',
    '# GKE Gateway API Generated by MMB Migration Workbench',
    `# Source Ingress: ${parsed.name} (Namespace: ${routeNamespace})`,
    `# Target Gateway: ${gatewayName} (Namespace: ${gatewayNamespace})`,
    `# Target GatewayClass: ${gatewayClass}`,
    '# ══════════════════════════════════════════════════════════════════════════════',
    '',
    gatewayYaml,
    '---',
    httpRouteYaml,
  ]

  if (referenceGrantYaml) {
    combinedYamlParts.push('---', referenceGrantYaml)
  }

  const combinedYaml = combinedYamlParts.join('\n') + '\n'

  return {
    gatewayYaml,
    httpRouteYaml,
    referenceGrantYaml,
    combinedYaml,
    summary: {
      routesConverted: routesCount,
      tlsHosts,
      backendServices: Array.from(backendServices),
      annotationsHandled: Object.keys(parsed.annotations),
      crossNamespaceGrantGenerated: isCrossNamespace,
    },
  }
}

/**
 * Line-based Ingress manifest parser resilient to formatting variations.
 */
function parseIngressYaml(yaml: string): ParsedIngress {
  const lines = yaml.split(/\r?\n/)
  let name = 'migrated-ingress'
  let namespace = 'default'
  let ingressClassName: string | undefined
  const annotations: Record<string, string> = {}
  const rules: ParsedRule[] = []
  const tls: ParsedTls[] = []

  let inMetadata = false
  let inAnnotations = false
  let inSpec = false
  let inRules = false
  let inTls = false
  let inDefaultBackend = false
  let defaultBackend: { serviceName: string; servicePort: number } | null = null
  let currentRule: ParsedRule | null = null
  let currentPath: Partial<ParsedRulePath> | null = null
  let currentTls: Partial<ParsedTls> | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.search(/\S/)

    if (indent === 0) {
      inMetadata = trimmed.startsWith('metadata:')
      inSpec = trimmed.startsWith('spec:')
      inAnnotations = false
      inRules = false
      inTls = false
      inDefaultBackend = false
      continue
    }

    if (inMetadata) {
      if (indent === 2 && trimmed.startsWith('name:')) {
        name = trimmed.slice(5).trim().replace(/^['"]|['"]$/g, '')
      } else if (indent === 2 && trimmed.startsWith('namespace:')) {
        namespace = trimmed.slice(10).trim().replace(/^['"]|['"]$/g, '')
      } else if (indent === 2 && trimmed.startsWith('annotations:')) {
        inAnnotations = true
      } else if (inAnnotations && indent >= 4 && trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':')
        const key = trimmed.slice(0, colonIdx).trim().replace(/^['"]|['"]$/g, '')
        const val = trimmed.slice(colonIdx + 1).trim().replace(/^['"]|['"]$/g, '')
        annotations[key] = val
      }
    }

    if (inSpec) {
      if (indent === 2 && trimmed.startsWith('ingressClassName:')) {
        ingressClassName = trimmed.slice(17).trim().replace(/^['"]|['"]$/g, '')
      } else if (indent === 2 && (trimmed.startsWith('defaultBackend:') || trimmed.startsWith('backend:'))) {
        inDefaultBackend = true
        inRules = false
        inTls = false
        defaultBackend = { serviceName: 'default-backend', servicePort: 80 }
      } else if (indent === 2 && trimmed.startsWith('rules:')) {
        inRules = true
        inTls = false
        inDefaultBackend = false
      } else if (indent === 2 && trimmed.startsWith('tls:')) {
        inTls = true
        inRules = false
        inDefaultBackend = false
      }

      if (inDefaultBackend) {
        if (trimmed.startsWith('name:') || trimmed.startsWith('serviceName:')) {
          const svcName = trimmed.replace(/^(name|serviceName):\s*/, '').trim().replace(/^['"]|['"]$/g, '')
          if (defaultBackend) defaultBackend.serviceName = svcName
        } else if (trimmed.startsWith('number:') || trimmed.startsWith('servicePort:')) {
          const portStr = trimmed.replace(/^(number|servicePort):\s*/, '').trim()
          if (defaultBackend) defaultBackend.servicePort = Number.parseInt(portStr, 10) || 80
        }
      }

      if (inRules) {
        if (trimmed.startsWith('- host:') || (indent === 4 && trimmed.startsWith('host:'))) {
          const hostVal = trimmed.replace(/^-\s*host:\s*|^host:\s*/, '').trim().replace(/^['"]|['"]$/g, '')
          currentRule = { host: hostVal, paths: [] }
          rules.push(currentRule)
        } else if (trimmed.startsWith('- http:') || trimmed.startsWith('http:')) {
          if (!currentRule) {
            currentRule = { paths: [] }
            rules.push(currentRule)
          }
        } else if (trimmed.startsWith('- path:')) {
          const pathVal = trimmed.slice(7).trim().replace(/^['"]|['"]$/g, '')
          currentPath = {
            path: pathVal || '/',
            pathType: 'Prefix',
            serviceName: 'backend-svc',
            servicePort: 80,
          }
          if (currentRule) currentRule.paths.push(currentPath as ParsedRulePath)
        } else if (currentPath && trimmed.startsWith('pathType:')) {
          const pType = trimmed.slice(9).trim().replace(/^['"]|['"]$/g, '')
          currentPath.pathType = pType === 'Exact' ? 'Exact' : 'Prefix'
        } else if (currentPath && (trimmed.startsWith('name:') || trimmed.startsWith('serviceName:'))) {
          const svcName = trimmed.replace(/^(name|serviceName):\s*/, '').trim().replace(/^['"]|['"]$/g, '')
          currentPath.serviceName = svcName
        } else if (currentPath && (trimmed.startsWith('number:') || trimmed.startsWith('servicePort:'))) {
          const portStr = trimmed.replace(/^(number|servicePort):\s*/, '').trim()
          currentPath.servicePort = Number.parseInt(portStr, 10) || 80
        }
      }

      if (inTls) {
        if (trimmed.startsWith('- hosts:') || trimmed.startsWith('hosts:')) {
          currentTls = { hosts: [], secretName: 'tls-secret' }
          tls.push(currentTls as ParsedTls)
          const inlineMatch = trimmed.match(/hosts:\s*\[(.*)\]/)
          if (inlineMatch && inlineMatch[1] && currentTls.hosts) {
            const splitHosts = inlineMatch[1].split(',').map(h => h.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
            currentTls.hosts.push(...splitHosts)
          }

        } else if (currentTls && trimmed.startsWith('-') && !trimmed.startsWith('- hosts:')) {
          const host = trimmed.slice(1).trim().replace(/^['"]|['"]$/g, '')
          if (host && !trimmed.startsWith('- secretName:')) {
            if (currentTls.hosts) currentTls.hosts.push(host)
          }
        } else if (currentTls && (trimmed.startsWith('secretName:') || trimmed.startsWith('- secretName:'))) {
          currentTls.secretName = trimmed.replace(/^-?\s*secretName:\s*/, '').trim().replace(/^['"]|['"]$/g, '')
        }
      }
    }
  }

  // Fallback if no paths were parsed
  if (rules.length === 0 || rules.every(r => r.paths.length === 0)) {
    rules.push({
      paths: [
        {
          path: '/',
          pathType: 'Prefix',
          serviceName: defaultBackend?.serviceName ?? 'default-backend',
          servicePort: defaultBackend?.servicePort ?? 80,
        },
      ],
    })
  }

  return { name, namespace, ingressClassName, annotations, rules, tls }
}
