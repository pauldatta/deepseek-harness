import { describe, expect, it } from 'vitest'
import { resolveAntigravityBinary, buildAntigravityEnv } from '../src/process.ts'
import { createAntigravityTool } from '../src/tool.ts'

describe('subagent-antigravity-cli', () => {
  it('resolves binary candidate or fallback', () => {
    const bin = resolveAntigravityBinary()
    expect(typeof bin).toBe('string')
    expect(bin.length).toBeGreaterThan(0)
  })

  it('builds environment variables including GCP project and location', () => {
    const env = buildAntigravityEnv(
      { PATH: '/usr/bin' },
      { CUSTOM_VAR: 'val' },
      'test-gcp-project',
      'global',
    )
    expect(env.GOOGLE_CLOUD_PROJECT).toBe('test-gcp-project')
    expect(env.GOOGLE_CLOUD_LOCATION).toBe('global')
    expect(env.CUSTOM_VAR).toBe('val')
    expect(env.PATH).toContain('.local/bin')
  })

  it('creates the antigravity_cli tool with valid schema and parameters', () => {
    const tool = createAntigravityTool({
      binaryPath: '',
      defaultModel: 'gemini-3.7-flash',
      gcpProject: 'demo-project',
      gcpLocation: 'global',
      env: {},
      disposeGraceMs: 3000,
    })

    expect(tool.name).toBe('antigravity_cli')
    const properties = (tool.parameters as { properties?: Record<string, unknown> }).properties
    expect(properties?.action).toBeDefined()
    expect(tool.description).toContain('Antigravity CLI')
  })
})
