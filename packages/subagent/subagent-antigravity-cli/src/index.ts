/**
 * Antigravity CLI subagent and tool plugin for DeepSeek Harness.
 * Registers the 'antigravity-cli' subagent provider and 'antigravity_cli' tool.
 *
 * @module @deepseek-ai/dsh-subagent-antigravity-cli
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import {
  NO_START_CAPABILITIES,
  type ResolvedSubagentStartRequest,
  type SubagentCapabilities,
  type SubagentProvider,
} from '@deepseek-ai/dsh-subagent'
import { startAntigravitySubagentRun } from './run.ts'
import { createAntigravityTool } from './tool.ts'
import type { AntigravityCliConfig } from './types.ts'

export { resolveAntigravityBinary } from './process.ts'
export type { AntigravityCliConfig } from './types.ts'

export const name = 'subagent-antigravity-cli'
export const inject = ['subagents', 'subprocess', 'tools']

export const Config: z<AntigravityCliConfig> = z.object({
  binaryPath: z.string().default(''),
  defaultModel: z.string().default('gemini-3.7-flash'),
  gcpProject: z.string().default(''),
  gcpLocation: z.string().default('global'),
  env: z.dict(z.string()).default({}),
  disposeGraceMs: z.number().default(3_000),
})

class AntigravityCliProvider implements SubagentProvider {
  readonly name = 'antigravity-cli'
  readonly capabilities: SubagentCapabilities = NO_START_CAPABILITIES
  readonly inheritsParentContext = false

  constructor(
    private readonly config: AntigravityCliConfig,
  ) {}

  async start(request: ResolvedSubagentStartRequest) {
    return startAntigravitySubagentRun(request, this.config)
  }
}

export function apply(ctx: Context, config: AntigravityCliConfig): void {
  // 1. Register Subagent Provider
  const provider = new AntigravityCliProvider(config)
  ctx.effect(() => {
    return ctx.subagents.registerProvider(provider)
  })

  // 2. Register Model-Facing Tool
  const tool = createAntigravityTool(config)
  ctx.effect(() => {
    return ctx.tools.register(tool)
  })
}
