import { describe, expect, it, vi } from 'vitest'
import { ThinkingLevel } from '@google/genai'
import { AttachmentId, ImageVariantId, type AttachmentStore, type ImageAttachmentRef } from '@deepseek-ai/dsh-attachment'
import {
  createAssistantMessage,
  createDeveloperMessage,
  createSystemMessage,
  createToolResultMessage,
  createUserMessage,
  ReasoningEffortId,
  ToolCallId,
  type StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { convertMessages, GOOGLE_FAKE_FC_SIGNATURE, streamGoogleGenAI } from '../src/google-genai.ts'

const generateContentStreamMock = vi.fn()
const googleGenAIConstructorCalls: unknown[] = []

vi.mock('@google/genai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@google/genai')>()
  return {
    ...actual,
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContentStream: (...args: unknown[]) => generateContentStreamMock(...args),
      }

      constructor(opts: unknown) {
        googleGenAIConstructorCalls.push(opts)
      }
    },
  }
})

const SAMPLE_IMAGE_REF: ImageAttachmentRef = {
  attachmentId: AttachmentId(`sha256:${'b'.repeat(64)}`),
  mediaType: 'image/png',
  bytes: 4,
  width: 10,
  height: 10,
}

function createFakeStore(readSpy = vi.fn()): AttachmentStore {
  return {
    readImage: async (ref: ImageAttachmentRef) => {
      readSpy(ref)
      return {
        ref,
        data: new Uint8Array([1, 2, 3, 4]),
      }
    },
    readImageRequest: async (ref: ImageAttachmentRef) => ({
      attachmentId: ref.attachmentId,
      variantId: ImageVariantId('orig'),
      mediaType: ref.mediaType,
      bytes: ref.bytes,
      width: ref.width,
      height: ref.height,
      data: new Uint8Array([1, 2, 3, 4]),
    }),
    saveImage: async () => SAMPLE_IMAGE_REF,
    hostObjectPath: () => '/tmp/fake',
  } as unknown as AttachmentStore
}

describe('google-genai adapter', () => {
  it('converts system, developer, assistant tool-calls, tool results, and offloaded images', async () => {
    const readSpy = vi.fn()
    const store = createFakeStore(readSpy)
    const callId = ToolCallId('call_abc123')

    const messages = [
      createSystemMessage('System rule 1'),
      createUserMessage({
        content: [
          { type: 'text', text: 'Inspect these images' },
          { type: 'image', attachment: SAMPLE_IMAGE_REF, offloaded: true },
          { type: 'image', attachment: SAMPLE_IMAGE_REF },
        ],
        source: { kind: 'user' },
      }),
      createDeveloperMessage({
        content: [{ type: 'text', text: 'Mid-conversation developer reminder' }],
        source: { kind: 'system' },
      }),
      createAssistantMessage({
        content: [
          { type: 'reasoning', text: 'Thinking about tool' },
          { type: 'tool-call', id: callId, name: 'read_file', arguments: '{"path":"foo.ts"}' },
        ],
        source: {
          provider: 'google',
          model: 'gemini-3.8-flash',
        },
      }),
      createToolResultMessage({
        callId,
        isError: false,
        content: [
          { type: 'text', text: '{"content":"hello"}' },
          { type: 'image', attachment: SAMPLE_IMAGE_REF },
        ],
      }),
    ]

    const { contents, systemInstruction } = await convertMessages(messages, () => store)
    expect(systemInstruction).toBe('System rule 1')
    expect(readSpy).toHaveBeenCalledTimes(2)
    expect(contents).toHaveLength(3)

    // Turn 1: merged user message + developer reminder
    expect(contents[0]?.role).toBe('user')
    expect(contents[0]?.parts).toHaveLength(4)
    expect(contents[0]?.parts?.[0]).toEqual({ text: 'Inspect these images' })
    expect((contents[0]?.parts?.[1] as { text?: string }).text).toContain(String(SAMPLE_IMAGE_REF.attachmentId))
    expect(contents[0]?.parts?.[2]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: Buffer.from([1, 2, 3, 4]).toString('base64'),
      },
    })
    expect(contents[0]?.parts?.[3]).toEqual({
      text: '<system-reminder>\nMid-conversation developer reminder\n</system-reminder>',
    })

    // Turn 2: model tool-call with fallback signature
    expect(contents[1]?.role).toBe('model')
    expect(contents[1]?.parts).toEqual([
      { text: 'Thinking about tool', thought: true },
      {
        functionCall: { name: 'read_file', args: { path: 'foo.ts' } },
        thoughtSignature: GOOGLE_FAKE_FC_SIGNATURE,
      },
    ])

    // Turn 3: tool functionResponse + inline image
    expect(contents[2]?.role).toBe('user')
    expect(contents[2]?.parts).toEqual([
      {
        functionResponse: {
          name: 'read_file',
          response: { content: 'hello' },
        },
      },
      {
        inlineData: {
          mimeType: 'image/png',
          data: Buffer.from([1, 2, 3, 4]).toString('base64'),
        },
      },
    ])
  })

  it('maps xhigh reasoningEffort to ThinkingLevel.HIGH and falls back on 404 model errors', async () => {
    generateContentStreamMock.mockReset()
    googleGenAIConstructorCalls.length = 0

    let capturedConfig: Record<string, unknown> | undefined
    const attemptedModels: string[] = []
    generateContentStreamMock.mockImplementation(async (req: { model: string; config: Record<string, unknown> }) => {
      attemptedModels.push(req.model)
      if (req.model === 'gemini-3.8-flash') {
        capturedConfig = req.config
        const err = new Error('Model gemini-3.8-flash not found') as Error & { status?: number }
        err.status = 404
        throw err
      }
      return (async function* () {
        yield {
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  { text: 'Let me think', thought: true, thoughtSignature: 'real-sig-123' },
                  { text: 'Final answer' },
                ],
              },
            },
          ],
          usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8 },
        }
      })()
    })

    const chunks: StreamChunk[] = []
    for await (const chunk of streamGoogleGenAI(
      {
        provider: 'google',
        model: 'gemini-3.8-flash',
        reasoningEffort: ReasoningEffortId('xhigh'),
        messages: [
          createUserMessage({
            content: [{ type: 'text', text: 'Hello' }],
            source: { kind: 'user' },
          }),
        ],
      },
      { apiKey: 'test-api-key' },
    )) {
      chunks.push(chunk)
    }

    expect(attemptedModels).toEqual(['gemini-3.8-flash', 'gemini-3.7-flash'])
    expect(capturedConfig?.thinkingConfig).toEqual({
      includeThoughts: true,
      thinkingLevel: ThinkingLevel.HIGH,
    })
    expect(chunks.some(c => c.type === 'reasoning-delta' && c.text === 'Let me think')).toBe(true)
    expect(chunks.some(c => c.type === 'text-delta' && c.text === 'Final answer')).toBe(true)
    const finish = chunks.find(c => c.type === 'finish')
    expect(finish).toMatchObject({
      type: 'finish',
      reason: { kind: 'stop' },
    })
  })
})
