/**
 * Subagent execution lifecycle for Antigravity CLI.
 *
 * @module @deepseek-ai/dsh-subagent-antigravity-cli/run
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { SessionId } from '@deepseek-ai/dsh-session'
import type {
  ResolvedSubagentStartRequest,
  SubagentResult,
  SubagentRun,
} from '@deepseek-ai/dsh-subagent'
import { buildAntigravityEnv, resolveAntigravityBinary } from './process.ts'
import type { AntigravityCliConfig } from './types.ts'

export interface AntigravityRunSpec {
  cwd: string
  prompt: string
  model?: string
  config: AntigravityCliConfig
  signal: AbortSignal
}

function extractPromptText(blocks: readonly ContentBlock[]): string {
  return blocks
    .filter(b => b.type === 'text')
    .map(b => (b as { text: string }).text)
    .join('\n')
}

export function startAntigravitySubagentRun(
  request: ResolvedSubagentStartRequest,
  config: AntigravityCliConfig,
): SubagentRun {
  const runId = SessionId(`antigravity-${randomUUID()}`)
  const promptText = extractPromptText(request.prompt)
  const cwd = request.parent.session.header.cwd || process.cwd()

  const binary = resolveAntigravityBinary(config.binaryPath)
  const args = [
    'new-conversation',
    ...(config.defaultModel ? [`--model=${config.defaultModel}`] : []),
    promptText,
  ]

  const env = buildAntigravityEnv(
    process.env,
    config.env,
    config.gcpProject,
    config.gcpLocation,
  )

  let settled = false
  let childProcess: ChildProcess | null = null

  const resultPromise = new Promise<SubagentResult>((resolve) => {
    try {
      childProcess = spawn(binary, args, {
        cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      childProcess.stdout?.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })

      childProcess.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      const onAbort = () => {
        if (!settled && childProcess) {
          settled = true
          childProcess.kill('SIGTERM')
          resolve({
            output: [{ type: 'text', text: stdout || 'Antigravity CLI task aborted by signal.' }],
            stopReason: 'aborted',
          })
        }
      }

      if (request.signal.aborted) {
        onAbort()
        return
      }

      request.signal.addEventListener('abort', onAbort, { once: true })

      childProcess.on('error', (err: Error) => {
        if (settled) return
        settled = true
        resolve({
          output: [{ type: 'text', text: `Failed to spawn Antigravity CLI (${binary}): ${err.message}` }],
          stopReason: 'error',
        })
      })

      childProcess.on('close', (code: number | null) => {
        if (settled) return
        settled = true
        const outputText = stdout.trim() || (code === 0 ? 'Antigravity task completed successfully.' : `Error: ${stderr.trim() || `Exit code ${code}`}`)
        resolve({
          output: [{ type: 'text', text: outputText }],
          stopReason: code === 0 ? 'completed' : 'error',
        })
      })
    } catch (err: unknown) {
      if (!settled) {
        settled = true
        const message = err instanceof Error ? err.message : String(err)
        resolve({
          output: [{ type: 'text', text: `Antigravity CLI execution failure: ${message}` }],
          stopReason: 'error',
        })
      }
    }
  })

  return {
    id: runId,
    localAgent: undefined,
    result: resultPromise,
    dispose: async () => {
      if (childProcess && !childProcess.killed) {
        childProcess.kill('SIGTERM')
      }
    },
  }
}
