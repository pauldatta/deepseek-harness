import type { ReactElement } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ToolCallViewProps } from '@deepseek-ai/dsh-client-ui-tool/client'
import { MigrationCenterIcon } from './MigrationCenterIcon.tsx'
import { workbenchStore } from './workbench-state.ts'

export type MigrationToolViewProps = ToolCallViewProps & PropsLocale<'mmb'>

export function MigrationToolView({
  callId,
  toolName,
  block,
  inspect,
}: MigrationToolViewProps): ReactElement {
  const args = (block as unknown as { args?: Record<string, unknown> })?.args ?? {}
  const rawResult = (block as unknown as { result?: unknown })?.result
  const textOutput = typeof rawResult === 'string' ? rawResult : JSON.stringify(rawResult ?? args, null, 2)

  let title = 'MMB Migration Action'
  let targetTab: 'portfolio' | 'assessment' | 'ingress' | 'skills' | 'recipes' = 'portfolio'
  let previewText = callId

  if (toolName === 'mmb_assess_workload') {
    title = `MMB Assessment: ${String(args.source_technology ?? 'Workload')}`
    targetTab = 'assessment'
    previewText = `Platform: ${String(args.source_platform ?? 'cloud').toUpperCase()}`
  } else if (toolName === 'mmb_ingress_translate') {
    title = 'MMB Ingress -> Gateway API'
    targetTab = 'ingress'
    previewText = 'GKE Gateway API translation'
  } else if (toolName === 'mmb_catalog') {
    title = 'MMB 46 Assets Catalog Query'
    targetTab = 'portfolio'
    previewText = `Domain: ${String(args.domain ?? 'all')}`
  } else if (toolName === 'mmb_generate_migration_plan') {
    title = `MMB Migration Plan: ${String(args.source_technology ?? '')} -> ${String(args.target_gcp_service ?? '')}`
    targetTab = 'assessment'
    previewText = 'Phased Roadmap'
  }

  return (
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid rgba(66, 133, 244, 0.25)',
        background: 'rgba(66, 133, 244, 0.05)',
        padding: '10px 14px',
        margin: '6px 0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MigrationCenterIcon size={16} />
          <span style={{ fontWeight: 600, fontSize: '13px', color: '#8ab4f8' }}>{title}</span>
          <span style={{ fontSize: '11px', color: '#9aa0a6' }}>({previewText})</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => { workbenchStore.setActiveTab(targetTab) }}
            style={{
              background: '#4285F4',
              border: 'none',
              borderRadius: '4px',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              cursor: 'pointer',
            }}
          >
            Open in Workbench ↗
          </button>
          {inspect !== undefined && (
            <button
              type="button"
              onClick={inspect}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '4px',
                color: '#e8eaed',
                fontSize: '11px',
                padding: '3px 8px',
                cursor: 'pointer',
              }}
            >
              Inspect
            </button>
          )}
        </div>
      </div>
      {textOutput && (
        <pre
          style={{
            margin: '6px 0 0',
            padding: '8px',
            borderRadius: '6px',
            background: 'rgba(0, 0, 0, 0.3)',
            fontSize: '11px',
            maxHeight: '160px',
            overflowY: 'auto',
            color: '#e8eaed',
            whiteSpace: 'pre-wrap',
          }}
        >
          {textOutput.slice(0, 1000)}
        </pre>
      )}
    </div>
  )
}
