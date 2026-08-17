/**
 * Type definitions for the Antigravity (agy) tool plugin.
 *
 * @module @deepseek-ai/dsh-tool-antigravity/types
 */

export interface AgyRunOptions {
  /** Prompt or task to send to agy CLI. */
  prompt: string
  /** Model to use (e.g. gemini-3.7-flash-high, gemini-3.7-flash-medium, gemini-3.1-pro-high). */
  model?: string
  /** Reasoning effort for thinking models (low | medium | high). */
  effort?: 'low' | 'medium' | 'high'
  /** Mode for execution (accept-edits | plan). */
  mode?: 'accept-edits' | 'plan'
  /** Whether to auto-approve tool permission requests. */
  dangerouslySkipPermissions?: boolean
  /** Custom working directory. */
  workdir?: string
  /** Timeout in milliseconds (defaults to 300,000ms). */
  timeoutMs?: number
  /** Abort signal. */
  signal?: AbortSignal
}

export interface AgyRunResult {
  text: string
  model?: string
  exitCode: number
}

export interface AgyModel {
  id: string
  name: string
}

export interface AgyAgent {
  name: string
  description?: string
}
