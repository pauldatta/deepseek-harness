/**
 * Wrapper utilities for interacting with the Antigravity (agy) CLI.
 *
 * @module @deepseek-ai/dsh-tool-antigravity/agy
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { AgyAgent, AgyModel, AgyRunOptions, AgyRunResult } from './types.ts'

const KNOWN_AGY_PATHS = [
  join(homedir(), '.local/bin/agy'),
  join(homedir(), '.local/bin/agentapi'),
  join(homedir(), '.gemini/antigravity-cli/bin/agentapi'),
  join(homedir(), '.gemini/antigravity-cli/bin/agy'),
  join(homedir(), 'bin/agy'),
  join(homedir(), 'bin/agentapi'),
  '/usr/local/bin/agy',
  '/usr/bin/agy',
  '/usr/local/bin/agentapi',
  '/usr/bin/agentapi',
]

/**
 * Locate the Antigravity (agy / agentapi) CLI binary.
 * @param explicitPath - Optional explicit path configured for the plugin.
 * @returns Path to the agy or agentapi executable.
 */
export function findAgyBinary(explicitPath?: string): string {
  if (explicitPath !== undefined && existsSync(explicitPath)) {
    return explicitPath
  }
  if (process.env.AGY_PATH !== undefined && existsSync(process.env.AGY_PATH)) {
    return process.env.AGY_PATH
  }
  if (process.env.AGENTAPI_PATH !== undefined && existsSync(process.env.AGENTAPI_PATH)) {
    return process.env.AGENTAPI_PATH
  }
  if (process.env.ANTIGRAVITY_PATH !== undefined && existsSync(process.env.ANTIGRAVITY_PATH)) {
    return process.env.ANTIGRAVITY_PATH
  }
  for (const candidate of KNOWN_AGY_PATHS) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return 'agy'
}

/**
 * Run a prompt through agy CLI in non-interactive print mode.
 * @param options - Run parameters.
 * @param binaryPath - Resolved agy binary path.
 * @returns Text response and execution details.
 */
export function runAgy(
  options: AgyRunOptions,
  binaryPath = findAgyBinary(),
): Promise<AgyRunResult> {
  return new Promise((resolve, reject) => {
    const args: string[] = ['-p', options.prompt]

    if (options.model !== undefined && options.model.length > 0) {
      args.push('--model', options.model)
    }
    if (options.effort !== undefined) {
      args.push('--effort', options.effort)
    }
    if (options.mode !== undefined) {
      args.push('--mode', options.mode)
    }
    if (options.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions')
    }

    const timeout = options.timeoutMs ?? 300_000
    const child = spawn(binaryPath, args, {
      cwd: options.workdir ?? process.cwd(),
      signal: options.signal,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeout)

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (timedOut) {
        reject(new Error(`Antigravity CLI command timed out after ${timeout}ms`))
        return
      }
      if (code !== 0 && stdout.trim().length === 0) {
        reject(new Error(`Antigravity CLI failed (exit code ${code}): ${stderr.trim() || 'unknown error'}`))
        return
      }
      resolve({
        text: stdout.trim(),
        ...options.model ? { model: options.model } : {},
        exitCode: code ?? 0,
      })
    })
  })
}

/**
 * List Gemini models supported by the agy CLI.
 * @param binaryPath - Resolved agy binary path.
 * @param signal - Optional abort signal.
 * @returns Discovered models with ID and descriptive name.
 */
export function listAgyModels(
  binaryPath = findAgyBinary(),
  signal?: AbortSignal,
): Promise<AgyModel[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, ['models'], {
      signal,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`agy models failed (exit code ${code}): ${stderr.trim()}`))
        return
      }
      const lines = stdout.split('\n').filter(line => line.trim().length > 0)
      const models: AgyModel[] = []
      for (const line of lines) {
        const cleaned = line.replace(/^[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏\s]+Fetching available models\.{3}/, '').trim()
        if (cleaned.length === 0) continue
        const match = /^([a-zA-Z0-9.-]+)\s+(.+)$/.exec(cleaned)
        if (match && match[1] && match[2]) {
          models.push({ id: match[1], name: match[2].trim() })
        } else {
          models.push({ id: cleaned, name: cleaned })
        }
      }
      resolve(models)
    })
  })
}

/**
 * List agents supported by the agy CLI.
 * @param binaryPath - Resolved agy binary path.
 * @param signal - Optional abort signal.
 * @returns Available agent presets.
 */
export function listAgyAgents(
  binaryPath = findAgyBinary(),
  signal?: AbortSignal,
): Promise<AgyAgent[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, ['agents'], {
      signal,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`agy agents failed (exit code ${code}): ${stderr.trim()}`))
        return
      }
      const lines = stdout.split('\n').filter(line => line.trim().length > 0)
      const agents: AgyAgent[] = []
      for (const line of lines) {
        const cleaned = line.trim()
        if (cleaned.length === 0) continue
        const match = /^([a-zA-Z0-9_-]+)\s*(?:-\s*(.+))?$/.exec(cleaned)
        if (match && match[1]) {
          const name = match[1]
          const desc = match[2]?.trim()
          agents.push({
            name,
            ...desc ? { description: desc } : {},
          })
        } else {
          agents.push({ name: cleaned })
        }
      }
      resolve(agents)
    })
  })
}
