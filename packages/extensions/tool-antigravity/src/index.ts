/**
 * Antigravity (agy) CLI tool plugin for DeepSeek Harness.
 * Exposes Gemini model execution and agent workflows via the agy CLI.
 *
 * @module @deepseek-ai/dsh-tool-antigravity
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { findAgyBinary, listAgyAgents, listAgyModels, runAgy } from './agy.ts'
import type { AgyRunOptions } from './types.ts'

export * from './types.ts'
export * from './agy.ts'

export const name = 'tool-antigravity'
export const inject = ['tools', 'systemPrompt']

export interface Config {
  /** Optional explicit path to the agy binary. */
  binaryPath?: string
  /** Default Gemini model to use for agy executions. */
  defaultModel?: string
  /** Timeout in milliseconds for agy invocations. */
  timeoutMs?: number
}

export const Config: z<Config> = z.object({
  binaryPath: z.string(),
  defaultModel: z.string().default('gemini-3.7-flash-high'),
  timeoutMs: z.number().default(300_000),
})

const ANTIGRAVITY_SYSTEM_PROMPT = `You have access to the Antigravity (agy) CLI tool via \`antigravity_run\`, \`antigravity_models\`, and \`antigravity_agents\`.
Use \`antigravity_run\` to delegate complex subtasks, execute prompts against the Gemini model family (such as Gemini 3.7 Flash, Gemini 3.6 Flash, Gemini 3.1 Pro), or run standalone AI agent tasks.`

export function apply(ctx: Context, config: Config): void {
  const binary = findAgyBinary(config.binaryPath)

  ctx.systemPrompt.section({
    name: 'tool:antigravity',
    order: 120,
    text: ANTIGRAVITY_SYSTEM_PROMPT,
  })

  ctx.tools.register(
    defineTool({
      name: 'antigravity_run',
      description:
        'Execute a prompt or subtask through the Antigravity (agy) CLI powered by Gemini models. Supports model selection (e.g. gemini-3.7-flash-high, gemini-3.7-flash-medium, gemini-3.7-flash-low, gemini-3.1-pro-high) and reasoning effort levels.',
      parameters: {
        prompt: {
          type: 'string',
          required: true,
          description: 'The prompt or task instructions for the Antigravity agent.',
        },
        model: {
          type: 'string',
          description: 'Target model id (e.g. gemini-3.7-flash-high, gemini-3.7-flash-medium, gemini-3.7-flash-low, gemini-3.6-flash-high, gemini-3.1-pro-high). Defaults to configured defaultModel.',
        },
        effort: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Reasoning effort level for Gemini thinking models.',
        },
        mode: {
          type: 'string',
          enum: ['accept-edits', 'plan'],
          description: 'Agent execution mode.',
        },
        dangerously_skip_permissions: {
          type: 'boolean',
          description: 'Auto-approve all tool permission requests during the agy execution.',
        },
        timeout_ms: {
          type: 'number',
          description: 'Timeout in milliseconds for this invocation.',
        },
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            text: { type: 'string' },
            model: { type: 'string' },
            exitCode: { type: 'number' },
          },
        },
        render: (_args, value) => [{ type: 'text', text: value.text ?? '' }],
      },
      async execute(args, exec) {
        const timeoutMs = args.timeout_ms ?? config.timeoutMs
        const options: AgyRunOptions = {
          prompt: args.prompt,
          model: args.model ?? config.defaultModel ?? 'gemini-3.7-flash-high',
          ...args.effort !== undefined ? { effort: args.effort as 'low' | 'medium' | 'high' } : {},
          ...args.mode !== undefined ? { mode: args.mode as 'accept-edits' | 'plan' } : {},
          ...args.dangerously_skip_permissions !== undefined ? { dangerouslySkipPermissions: args.dangerously_skip_permissions } : {},
          ...timeoutMs !== undefined ? { timeoutMs } : {},
          ...exec.signal !== undefined ? { signal: exec.signal } : {},
        }
        const res = await runAgy(options, binary)
        return {
          text: res.text,
          ...res.model !== undefined ? { model: res.model } : {},
          exitCode: res.exitCode,
        }
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'antigravity_models',
      description: 'List all Gemini models available through the Antigravity (agy) CLI.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            models: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(_args, exec) {
        const models = await listAgyModels(binary, exec.signal)
        return {
          models: models.map(m => ({ id: m.id, name: m.name })),
        }
      },
    }),
  )

  ctx.tools.register(
    defineTool({
      name: 'antigravity_agents',
      description: 'List available agents supported by the Antigravity (agy) CLI.',
      parameters: {},
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            agents: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      async execute(_args, exec) {
        const agents = await listAgyAgents(binary, exec.signal)
        return {
          agents: agents.map(a => ({
            name: a.name,
            ...a.description ? { description: a.description } : {},
          })),
        }
      },
    }),
  )
}
