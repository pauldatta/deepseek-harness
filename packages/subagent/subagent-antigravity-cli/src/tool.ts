/**
 * Model-facing tool for direct Antigravity CLI and Agent API execution.
 *
 * @module @deepseek-ai/dsh-subagent-antigravity-cli/tool
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildAntigravityEnv, resolveAntigravityBinary } from './process.ts'
import type { AntigravityCliConfig } from './types.ts'

const execFileAsync = promisify(execFile)

export function createAntigravityTool(config: AntigravityCliConfig) {
  return defineTool({
    name: 'antigravity_cli',
    description:
      'Execute commands and workflows with Google Antigravity CLI / Agent API. ' +
      'Allows starting new agent conversations, sending messages to ongoing sessions, ' +
      'querying conversation metadata, or delegating tasks to Antigravity CLI.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['new_conversation', 'send_message', 'get_metadata', 'raw_command'],
        description: 'Antigravity CLI action to perform',
      },
      prompt: {
        type: 'string',
        description: 'Prompt or instruction for new conversation or message',
      },
      conversation_id: {
        type: 'string',
        description: 'Conversation ID for send_message or get_metadata actions',
      },
      model: {
        type: 'string',
        description: 'Target Gemini model tier (e.g. "flash", "flash_lite", "pro")',
      },
      title: {
        type: 'string',
        description: 'Optional title for new conversation or message',
      },
      command_args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Raw arguments when action is "raw_command"',
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          action: { type: 'string' },
          output: { type: 'string' },
          conversation_id: { type: 'string' },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: (typeof value === 'object' && value !== null && 'output' in value && typeof (value as { output?: unknown }).output === 'string')
            ? (value as { output: string }).output
            : JSON.stringify(value),
        },
      ],
    },
    async execute(args, exec) {
      const binary = resolveAntigravityBinary(config.binaryPath)
      const env = buildAntigravityEnv(
        process.env,
        config.env,
        config.gcpProject,
        config.gcpLocation,
      )
      const cwd = exec.agent?.session?.header?.cwd || process.cwd()

      let cliArgs: string[] = []

      switch (args.action) {
        case 'new_conversation': {
          cliArgs = ['new-conversation']
          if (args.model) cliArgs.push(`--model=${args.model}`)
          if (args.title) cliArgs.push(`--title=${args.title}`)
          if (args.prompt) cliArgs.push(args.prompt)
          break
        }
        case 'send_message': {
          if (!args.conversation_id) throw new Error('conversation_id is required for send_message')
          cliArgs = ['send-message']
          if (args.title) cliArgs.push(`--title=${args.title}`)
          cliArgs.push(args.conversation_id)
          if (args.prompt) cliArgs.push(args.prompt)
          break
        }
        case 'get_metadata': {
          if (!args.conversation_id) throw new Error('conversation_id is required for get_metadata')
          cliArgs = ['get-conversation-metadata', args.conversation_id]
          break
        }
        case 'raw_command': {
          cliArgs = args.command_args || []
          break
        }
        default:
          throw new Error(`Unsupported action "${args.action}"`)
      }

      try {
        const { stdout, stderr } = await execFileAsync(binary, cliArgs, {
          cwd,
          env,
          signal: exec.signal,
          timeout: 120_000,
        })
        const out = stdout.trim() || stderr.trim() || 'Command completed.'
        return {
          success: true,
          action: args.action,
          output: out,
          ...args.conversation_id ? { conversation_id: args.conversation_id } : {},
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          success: false,
          action: args.action,
          output: `Antigravity CLI execution error: ${message}`,
          ...args.conversation_id ? { conversation_id: args.conversation_id } : {},
        }
      }
    },
  })
}
