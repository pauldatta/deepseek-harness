import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, Config, findAgyBinary, name } from '../src/index.ts'

describe('tool-antigravity', () => {
  it('exports name and valid config defaults', () => {
    expect(name).toBe('tool-antigravity')
    const cfg = Config({})
    expect(cfg.defaultModel).toBe('gemini-3.7-flash-high')
    expect(cfg.timeoutMs).toBe(300_000)
  })

  it('finds agy binary with explicit path', () => {
    expect(findAgyBinary()).toBeDefined()
  })

  it('registers tools into Cordis context', () => {
    const ctx = new Context()
    const registeredTools: string[] = []
    const registeredSections: string[] = []

    interface MockToolsService {
      register: (tool: { name: string }) => void
    }

    interface MockSystemPromptService {
      section: (sec: { name: string }) => void
    }

    ctx.provide('tools')
    ;(ctx as unknown as { tools: MockToolsService }).tools = {
      register: (tool: { name: string }) => {
        registeredTools.push(tool.name)
      },
    }

    ctx.provide('systemPrompt')
    ;(ctx as unknown as { systemPrompt: MockSystemPromptService }).systemPrompt = {
      section: (sec: { name: string }) => {
        registeredSections.push(sec.name)
      },
    }

    apply(ctx, Config({}))

    expect(registeredSections).toContain('tool:antigravity')
    expect(registeredTools).toContain('antigravity_run')
    expect(registeredTools).toContain('antigravity_models')
    expect(registeredTools).toContain('antigravity_agents')
  })
})
