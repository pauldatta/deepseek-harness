import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { MigrationCenterIcon } from './MigrationCenterIcon.tsx'
import { workbenchStore } from './workbench-state.ts'

export type MigrationCenterSidebarActionProps =
  PropsRuntime<'sidebar.footer.action'> & PropsLocale<'mmb'>

export function MigrationCenterSidebarAction({
  wide,
  t,
}: MigrationCenterSidebarActionProps): ReactElement {
  const state = useSyncExternalStore(
    workbenchStore.subscribe,
    workbenchStore.getSnapshot,
  )

  const handleClick = (): void => {
    workbenchStore.toggleOpen()
  }

  const label = t('trigger.title')
  const badgeText = t('trigger.badge')

  if (!wide) {
    return (
      <Tooltip label={`${label} (${badgeText})`} side="right">
        <button
          type="button"
          onClick={handleClick}
          aria-label={label}
          aria-expanded={state.isOpen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            border: state.isOpen ? '1px solid var(--dsw-brand-500, #4285F4)' : '1px solid transparent',
            background: state.isOpen ? 'var(--dsw-brand-alpha-12, rgba(66, 133, 244, 0.12))' : 'transparent',
            color: state.isOpen ? 'var(--dsw-brand-500, #4285F4)' : 'var(--dsw-text-secondary, #9aa0a6)',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <MigrationCenterIcon size={16} />
        </button>
      </Tooltip>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      aria-expanded={state.isOpen}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '6px 10px',
        borderRadius: '6px',
        border: state.isOpen ? '1px solid var(--dsw-brand-500, #4285F4)' : '1px solid var(--dsw-border-subtle, rgba(255,255,255,0.08))',
        background: state.isOpen ? 'var(--dsw-brand-alpha-12, rgba(66, 133, 244, 0.12))' : 'var(--dsw-surface-base, rgba(255,255,255,0.03))',
        color: state.isOpen ? 'var(--dsw-text-primary, #fff)' : 'var(--dsw-text-secondary, #bdc1c6)',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
      }}
    >
      <MigrationCenterIcon size={16} />
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: '10px',
          padding: '2px 6px',
          borderRadius: '10px',
          background: 'var(--dsw-brand-alpha-20, rgba(66, 133, 244, 0.2))',
          color: 'var(--dsw-brand-400, #669df6)',
          fontWeight: 600,
        }}
      >
        {badgeText}
      </span>
    </button>
  )
}
