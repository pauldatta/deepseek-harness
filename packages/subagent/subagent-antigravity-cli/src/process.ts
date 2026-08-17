/**
 * Binary discovery and execution configuration for Antigravity CLI.
 *
 * @module @deepseek-ai/dsh-subagent-antigravity-cli/process
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const KNOWN_AGENTAPI_PATHS = [
  join(homedir(), '.gemini/antigravity-cli/bin/agentapi'),
  join(homedir(), '.gemini/antigravity-cli/bin/agy'),
  join(homedir(), '.local/bin/agentapi'),
  join(homedir(), '.local/bin/agy'),
  join(homedir(), 'bin/agentapi'),
  join(homedir(), 'bin/agy'),
  '/usr/local/bin/agentapi',
  '/usr/local/bin/agy',
  '/usr/bin/agentapi',
  '/usr/bin/agy',
]

/**
 * Resolve the Antigravity CLI binary path (agentapi or agy).
 */
export function resolveAntigravityBinary(configuredPath?: string): string {
  if (configuredPath && existsSync(configuredPath)) {
    return configuredPath
  }
  if (process.env.AGENTAPI_PATH && existsSync(process.env.AGENTAPI_PATH)) {
    return process.env.AGENTAPI_PATH
  }
  if (process.env.AGY_PATH && existsSync(process.env.AGY_PATH)) {
    return process.env.AGY_PATH
  }
  if (process.env.ANTIGRAVITY_PATH && existsSync(process.env.ANTIGRAVITY_PATH)) {
    return process.env.ANTIGRAVITY_PATH
  }

  for (const candidate of KNOWN_AGENTAPI_PATHS) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  // Fall back to PATH command name
  return 'agentapi'
}

/**
 * Build environment variables for Antigravity CLI processes.
 */
export function buildAntigravityEnv(
  baseEnv: NodeJS.ProcessEnv,
  customEnv?: Record<string, string>,
  gcpProject?: string,
  gcpLocation?: string,
): Record<string, string> {
  const result: Record<string, string> = {
    ...baseEnv as Record<string, string>,
    PATH: `${join(homedir(), '.gemini/antigravity-cli/bin')}:${join(homedir(), '.local/bin')}:${baseEnv.PATH || ''}`,
    ...(gcpProject ? { GOOGLE_CLOUD_PROJECT: gcpProject } : {}),
    ...(gcpLocation ? { GOOGLE_CLOUD_LOCATION: gcpLocation } : {}),
    ...customEnv,
  }
  return result
}
