/**
 * Direct Google Gen AI SDK (`@google/genai` / `googleapis/js-genai`) streaming adapter.
 *
 * Implements direct streaming, tool-calling, multimodal input, and thinking tokens
 * using the official Google Gen AI SDK for Gemini 3.7 Flash and Gemini 3.1 Pro Preview.
 *
 * @module dsh-llm-pi-ai/google-genai
 */

import { GoogleGenAI, ThinkingLevel } from '@google/genai'
import type { Content, GenerateContentConfig, Part, Tool } from '@google/genai'
import {
  CallId,
  LlmError,
  type GenerateOptions,
  type Message,
  type StreamChunk,
  type TokenUsage,
  type ToolSchema,
} from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'

export interface GoogleGenAIOptions {
  apiKey?: string | undefined
  project?: string | undefined
  location?: string | undefined
  resolveAttachments?: (() => AttachmentStore | undefined) | undefined
}

function sanitizeSurrogates(text: string): string {
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
}

function convertTools(tools: readonly ToolSchema[]): Tool[] {
  return [
    {
      functionDeclarations: tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ]
}

async function convertMessages(
  messages: readonly Message[],
  resolveAttachments?: (() => AttachmentStore | undefined) | undefined,
): Promise<{ contents: Content[]; systemInstruction?: string }> {
  let systemInstruction = ''
  const contents: Content[] = []

  for (const message of messages) {
    if (message.source.kind === 'plugin') {
      const text = message.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('\n\n')
      if (text) {
        systemInstruction = systemInstruction ? `${systemInstruction}\n\n${text}` : text
      }
      continue
    }

    if (message.source.kind === 'user') {
      const parts: Part[] = []
      for (const block of message.content) {
        if (block.type === 'text') {
          if (block.text) parts.push({ text: sanitizeSurrogates(block.text) })
        } else if (block.type === 'image') {
          const store = resolveAttachments?.()
          if (store && block.attachment) {
            const stored = await store.readImage(block.attachment)
            const base64 = Buffer.from(stored.data).toString('base64')
            parts.push({
              inlineData: {
                mimeType: stored.ref.mediaType,
                data: base64,
              },
            })
          }
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'user', parts })
      }
      continue
    }

    if (message.source.kind === 'model') {
      const parts: Part[] = []
      for (const block of message.content) {
        if (block.type === 'text') {
          if (block.text) parts.push({ text: sanitizeSurrogates(block.text) })
        } else if (block.type === 'tool-call') {
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(block.arguments) as Record<string, unknown>
          } catch {
            args = { raw: block.arguments }
          }
          parts.push({
            functionCall: {
              name: block.name,
              args,
            },
          })
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts })
      }
      continue
    }

    if (message.source.kind === 'tool') {
      for (const block of message.content) {
        if (block.type === 'tool-result') {
          const outputText = block.content
            .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
            .map(b => b.text)
            .join('\n')
          let responsePayload: Record<string, unknown>
          try {
            responsePayload = JSON.parse(outputText) as Record<string, unknown>
          } catch {
            responsePayload = { output: outputText }
          }
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: String(message.source.callId || 'unknown_tool'),
                  response: responsePayload,
                },
              },
            ],
          })
        }
      }
    }
  }

  return {
    contents,
    ...(systemInstruction ? { systemInstruction: sanitizeSurrogates(systemInstruction) } : {}),
  }
}

export async function* streamGoogleGenAI(
  options: GenerateOptions,
  googleOptions: GoogleGenAIOptions,
): AsyncGenerator<StreamChunk> {
  const trimmedKey = googleOptions.apiKey?.trim()
  const isApiKeyAuth = typeof trimmedKey === 'string' && trimmedKey.length > 0
  const project = googleOptions.project || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT
  const location = googleOptions.location || process.env.GOOGLE_CLOUD_LOCATION || process.env.GCLOUD_LOCATION || 'global'

  const ai = isApiKeyAuth
    ? new GoogleGenAI({ vertexai: false, apiKey: trimmedKey })
    : new GoogleGenAI({
      vertexai: true,
      ...(project ? { project } : {}),
      ...(location ? { location } : {}),
    })

  const { contents, systemInstruction } = await convertMessages(
    options.messages,
    googleOptions.resolveAttachments,
  )

  const config: GenerateContentConfig = {}
  if (systemInstruction) {
    config.systemInstruction = systemInstruction
  }
  if (options.system) {
    config.systemInstruction = typeof config.systemInstruction === 'string'
      ? `${config.systemInstruction}\n\n${sanitizeSurrogates(options.system)}`
      : sanitizeSurrogates(options.system)
  }
  if (options.tools && options.tools.length > 0) {
    config.tools = convertTools(options.tools)
  }
  if (options.temperature !== undefined) {
    config.temperature = options.temperature
  }
  if (options.maxTokens !== undefined) {
    config.maxOutputTokens = options.maxTokens
  }
  if (options.signal) {
    config.abortSignal = options.signal
  }

  // Configure thinking for Gemini 3 models
  const modelLower = options.model.toLowerCase()
  const isGemini3 = modelLower.includes('gemini-3') || modelLower.includes('3.7') || modelLower.includes('3.1')
  if (isGemini3) {
    const thinkingConfig: { includeThoughts: boolean; thinkingLevel?: ThinkingLevel } = { includeThoughts: true }
    if (options.reasoningEffort === 'high' || options.reasoningEffort === 'max') {
      thinkingConfig.thinkingLevel = ThinkingLevel.HIGH
    } else if (options.reasoningEffort === 'low' || options.reasoningEffort === 'minimal') {
      thinkingConfig.thinkingLevel = ThinkingLevel.LOW
    } else if (options.reasoningEffort === 'medium') {
      thinkingConfig.thinkingLevel = ThinkingLevel.MEDIUM
    }
    config.thinkingConfig = thinkingConfig
  }

  let stream: AsyncIterable<{
    candidates?: Array<{ content?: { parts?: Part[]; role?: string } }>
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
  }>
  try {
    stream = await ai.models.generateContentStream({
      model: options.model,
      contents,
      config,
    })
  } catch (err: unknown) {
    const errObj = err as { status?: unknown; code?: unknown; message?: unknown } | null
    const statusNum = typeof errObj?.status === 'number'
      ? errObj.status
      : typeof errObj?.code === 'number'
        ? errObj.code
        : undefined
    const message = typeof errObj?.message === 'string' ? errObj.message : 'Google Gen AI error'
    throw new LlmError(
      message,
      statusNum === 401 || statusNum === 403 ? 'AUTH' : statusNum === 429 ? 'RATE_LIMIT' : 'SERVER',
      {
        ...(statusNum !== undefined && statusNum >= 100 && statusNum <= 599 ? { status: statusNum } : {}),
        cause: err,
      },
    )
  }

  let textBlockActive = false
  let thinkingBlockActive = false
  let currentBlockIndex = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for await (const chunk of stream) {
    if (options.signal?.aborted) {
      throw new LlmError('Request aborted by caller', 'ABORTED')
    }

    if (chunk.usageMetadata) {
      totalInputTokens = chunk.usageMetadata.promptTokenCount ?? totalInputTokens
      totalOutputTokens = chunk.usageMetadata.candidatesTokenCount ?? totalOutputTokens
    }

    const candidate = chunk.candidates?.[0]
    if (!candidate?.content?.parts) continue

    for (const part of candidate.content.parts) {
      // 1. Thinking / Thought parts
      if (part.thought || (part.text && candidate.content.role === 'model' && part.thoughtSignature)) {
        if (!thinkingBlockActive) {
          if (textBlockActive) {
            yield { type: 'block-end', index: currentBlockIndex, block: { type: 'text', text: '' } }
            textBlockActive = false
            currentBlockIndex++
          }
          yield { type: 'block-start', index: currentBlockIndex, blockType: 'reasoning' }
          thinkingBlockActive = true
        }
        yield { type: 'reasoning-delta', index: currentBlockIndex, text: part.text || '' }
        continue
      }

      // 2. Text parts
      if (typeof part.text === 'string' && part.text.length > 0) {
        if (thinkingBlockActive) {
          yield { type: 'block-end', index: currentBlockIndex, block: { type: 'reasoning', text: '' } }
          thinkingBlockActive = false
          currentBlockIndex++
        }
        if (!textBlockActive) {
          yield { type: 'block-start', index: currentBlockIndex, blockType: 'text' }
          textBlockActive = true
        }
        yield { type: 'text-delta', index: currentBlockIndex, text: part.text }
        continue
      }

      // 3. Tool call / Function call parts
      if (part.functionCall) {
        if (textBlockActive) {
          yield { type: 'block-end', index: currentBlockIndex, block: { type: 'text', text: '' } }
          textBlockActive = false
          currentBlockIndex++
        }
        if (thinkingBlockActive) {
          yield { type: 'block-end', index: currentBlockIndex, block: { type: 'reasoning', text: '' } }
          thinkingBlockActive = false
          currentBlockIndex++
        }
        const callId = `call_${Math.random().toString(36).slice(2, 10)}`
        const toolName = part.functionCall.name || 'unknown_tool'
        const argsStr = JSON.stringify(part.functionCall.args ?? {})
        yield { type: 'block-start', index: currentBlockIndex, blockType: 'tool-call' }
        yield {
          type: 'tool-call-delta',
          index: currentBlockIndex,
          id: CallId(callId),
          name: toolName,
          argumentsDelta: argsStr,
        }
        yield {
          type: 'block-end',
          index: currentBlockIndex,
          block: {
            type: 'tool-call',
            id: CallId(callId),
            name: toolName,
            arguments: argsStr,
          },
        }
        currentBlockIndex++
      }
    }
  }

  if (textBlockActive) {
    yield { type: 'block-end', index: currentBlockIndex, block: { type: 'text', text: '' } }
  }
  if (thinkingBlockActive) {
    yield { type: 'block-end', index: currentBlockIndex, block: { type: 'reasoning', text: '' } }
  }

  const usage: TokenUsage = {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  }
  yield { type: 'usage', usage }
  yield { type: 'finish', reason: { kind: 'stop' } }
}
