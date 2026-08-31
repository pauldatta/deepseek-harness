/**
 * Client half of MMB Migration Center Workbench plugin.
 * Registers sidebar action button, full Migration Center overlay,
 * and inline tool views for chat turns.
 *
 * @module @deepseek-ai/dsh-mmb-migration-workbench/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-tool/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { en, NS, zh } from './locales.ts'
import { MigrationCenterSidebarAction } from './MigrationCenterSidebarAction.tsx'
import { MigrationCenterWorkbench } from './MigrationCenterWorkbench.tsx'
import { MigrationToolView } from './MigrationToolView.tsx'

export { workbenchStore } from './workbench-state.ts'
export { MigrationCenterSidebarAction } from './MigrationCenterSidebarAction.tsx'
export { MigrationCenterWorkbench } from './MigrationCenterWorkbench.tsx'
export { MigrationToolView } from './MigrationToolView.tsx'

export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  // 1. Locale dictionary registration
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mmb: dictionaries')

  // 2. Sidebar footer action registration (next to Settings at foot of sidebar)
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'mmb-migration-center-action',
    locale: NS,
  }, MigrationCenterSidebarAction))

  // 3. Shell overlay registration (full-screen Migration Center Workbench)
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'mmb-migration-workbench-overlay',
    locale: NS,
  }, MigrationCenterWorkbench))

  // 4. Inline Tool view registrations in conversation turn
  ctx.slots.inject('tool.call.toolview', function* () {
    yield ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'mmb_assess_workload',
      locale: NS,
    }, MigrationToolView)
    yield ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'mmb_ingress_translate',
      locale: NS,
    }, MigrationToolView)
    yield ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'mmb_catalog',
      locale: NS,
    }, MigrationToolView)
    yield ctx.slots.register({
      name: 'tool.call.toolview',
      key: 'mmb_generate_migration_plan',
      locale: NS,
    }, MigrationToolView)
  })
}
