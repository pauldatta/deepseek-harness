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
  type ContentBlock,
  type GenerateOptions,
  type Message,
  type StreamChunk,
  type TokenUsage,
  type ToolSchema,
} from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import type { PiAiReplayBlock, PiAiReplayState } from './replay.ts'

export interface GoogleGenAIOptions {
  apiKey?: string | undefined
  project?: string | undefined
  location?: string | undefined
  resolveAttachments?: (() => AttachmentStore | undefined) | undefined
}

/**
 * Standard Google/Beyond dummy function-call thought signature.
 * Recognized by Vertex AI Beyond service to bypass signature verification
 * during model switching, imported sessions, or synthetic turns.
 */
export const GOOGLE_FAKE_FC_SIGNATURE = 'e24830a7-5cd6-42fe-998b-ee539e72b9c3'

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

function extractToolResultText(blocks: readonly ContentBlock[]): string {
  return blocks
    .map(b => (b.type === 'text' ? b.text : b.type === 'tool-result' ? extractToolResultText(b.content) : ''))
    .join('\n')
}

async function convertMessages(
  messages: readonly Message[],
  resolveAttachments?: (() => AttachmentStore | undefined) | undefined,
): Promise<{ contents: Content[]; systemInstruction?: string }> {
  let systemInstruction = ''
  const contents: Content[] = []

  // Map tool call IDs to declared tool names
  const toolCallNames = new Map<string, string>()
  for (const message of messages) {
    if (message.role === 'assistant') {
      for (const block of message.content) {
        if (block.type === 'tool-call') {
          toolCallNames.set(String(block.id), block.name)
        }
      }
    }
  }

  for (const message of messages) {
    if (message.role === 'system') {
      const text = message.content
        .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
        .map(b => b.text)
        .join('\n\n')
      if (text) {
        systemInstruction = systemInstruction ? `${systemInstruction}\n\n${text}` : text
      }
      continue
    }

    if (message.role === 'assistant') {
      const parts: Part[] = []
      const replayState = message.source.kind === 'model'
        ? (message.source.replayState as PiAiReplayState | undefined)
        : undefined
      for (const [i, block] of message.content.entries()) {
        if (!block) continue
        if (block.type === 'reasoning') {
          if (block.text) {
            parts.push({
              text: sanitizeSurrogates(block.text),
              thought: true,
            })
          }
        } else if (block.type === 'text') {
          if (block.text) {
            parts.push({ text: sanitizeSurrogates(block.text) })
          }
        } else if (block.type === 'tool-call') {
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(block.arguments) as Record<string, unknown>
          } catch {
            args = { raw: block.arguments }
          }
          const replayBlock = replayState?.blocks?.[i]
          let storedSig = replayBlock?.type === 'tool-call' ? replayBlock.thoughtSignature : undefined
          // Gemini requires a valid thoughtSignature for all functionCall parts in multi-turn history.
          // When a real signature was not captured or was synthetic, use the official Google dummy signature.
          if (!storedSig || storedSig.startsWith('dGhvdWdodF9zaWdf') || storedSig.includes('thought_sig_')) {
            storedSig = GOOGLE_FAKE_FC_SIGNATURE
          }
          const thoughtSignature = storedSig
          parts.push({
            functionCall: {
              name: block.name,
              args,
            },
            thoughtSignature,
          })
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'model', parts })
      }
      continue
    }

    if (message.role === 'user') {
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
        } else if (block.type === 'tool-result') {
          const outputText = extractToolResultText(block.content)
          let responsePayload: Record<string, unknown>
          try {
            const parsed: unknown = JSON.parse(outputText)
            if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
              responsePayload = parsed as Record<string, unknown>
            } else {
              responsePayload = { output: parsed }
            }
          } catch {
            responsePayload = { output: outputText }
          }
          const callIdStr = String(block.toolCallId || 'unknown')
          const toolName = toolCallNames.get(callIdStr) || 'unknown_tool'
          parts.push({
            functionResponse: {
              name: toolName,
              response: responsePayload,
            },
          })
        }
      }
      if (parts.length > 0) {
        contents.push({ role: 'user', parts })
      }
      continue
    }
  }

  // Merge consecutive entries with the same role (e.g. parallel tool responses) into single turn
  const mergedContents: Content[] = []
  for (const entry of contents) {
    const prev = mergedContents[mergedContents.length - 1]
    if (prev && prev.role === entry.role && Array.isArray(prev.parts) && Array.isArray(entry.parts)) {
      prev.parts.push(...entry.parts)
    } else {
      mergedContents.push({
        ...(entry.role ? { role: entry.role } : {}),
        parts: [...(entry.parts || [])],
      })
    }
  }

  // Vertex AI rejects requests ending with a model turn ("Requests ending with a model turn are not supported").
  // Drop trailing model turns (e.g. if the previous turn was interrupted before tool execution or text completion).
  while (mergedContents.length > 0 && mergedContents[mergedContents.length - 1]?.role === 'model') {
    mergedContents.pop()
  }

  // Ensure request does not start with a model turn
  while (mergedContents.length > 0 && mergedContents[0]?.role === 'model') {
    mergedContents.shift()
  }

  // If contents became empty, provide a fallback user turn
  if (mergedContents.length === 0) {
    mergedContents.push({ role: 'user', parts: [{ text: 'Continue' }] })
  }

  return {
    contents: mergedContents,
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
  let accumulatedText = ''
  let accumulatedReasoning = ''
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let turnThoughtSignature: string | undefined
  let toolCallCount = 0
  const replayBlocks: PiAiReplayBlock[] = []

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
      const partWithSig = part as Part & { thought_signature?: string }
      const sig = part.thoughtSignature || partWithSig.thought_signature
      if (sig) {
        turnThoughtSignature = sig
      }

      // 1. Thinking / Thought parts
      if (part.thought === true) {
        if (!thinkingBlockActive) {
          if (textBlockActive) {
            yield { type: 'block-end', index: currentBlockIndex, block: { type: 'text', text: accumulatedText } }
            textBlockActive = false
            accumulatedText = ''
            replayBlocks.push({ type: 'text' })
            currentBlockIndex++
          }
          yield { type: 'block-start', index: currentBlockIndex, blockType: 'reasoning' }
          thinkingBlockActive = true
          accumulatedReasoning = ''
        }
        const t = part.text || ''
        accumulatedReasoning += t
        yield { type: 'reasoning-delta', index: currentBlockIndex, text: t }
        continue
      }

      // 2. Text parts
      if (typeof part.text === 'string' && part.text.length > 0) {
        if (thinkingBlockActive) {
          yield { type: 'block-end', index: currentBlockIndex, block: { type: 'reasoning', text: accumulatedReasoning } }
          thinkingBlockActive = false
          accumulatedReasoning = ''
          replayBlocks.push({
            type: 'reasoning',
            ...(turnThoughtSignature ? { thinkingSignature: turnThoughtSignature } : {}),
          })
          currentBlockIndex++
        }
        if (!textBlockActive) {
          yield { type: 'block-start', index: currentBlockIndex, blockType: 'text' }
          textBlockActive = true
          accumulatedText = ''
        }
        accumulatedText += part.text
        yield { type: 'text-delta', index: currentBlockIndex, text: part.text }
        continue
      }

      // 3. Tool call / Function call parts
      if (part.functionCall) {
        if (textBlockActive) {
          yield { type: 'block-end', index: currentBlockIndex, block: { type: 'text', text: accumulatedText } }
          textBlockActive = false
          accumulatedText = ''
          replayBlocks.push({ type: 'text' })
          currentBlockIndex++
        }
        if (thinkingBlockActive) {
          yield { type: 'block-end', index: currentBlockIndex, block: { type: 'reasoning', text: accumulatedReasoning } }
          thinkingBlockActive = false
          accumulatedReasoning = ''
          replayBlocks.push({
            type: 'reasoning',
            ...(turnThoughtSignature ? { thinkingSignature: turnThoughtSignature } : {}),
          })
          currentBlockIndex++
        }
        toolCallCount++
        const callId = `call_${Math.random().toString(36).slice(2, 10)}`
        const toolName = part.functionCall.name || 'unknown_tool'
        const argsStr = JSON.stringify(part.functionCall.args ?? {})
        const fcSig = sig || turnThoughtSignature || GOOGLE_FAKE_FC_SIGNATURE
        replayBlocks.push({
          type: 'tool-call',
          thoughtSignature: fcSig,
        })
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
    yield { type: 'block-end', index: currentBlockIndex, block: { type: 'text', text: accumulatedText } }
    replayBlocks.push({ type: 'text' })
    currentBlockIndex++
  }
  if (thinkingBlockActive) {
    yield { type: 'block-end', index: currentBlockIndex, block: { type: 'reasoning', text: accumulatedReasoning } }
    replayBlocks.push({
      type: 'reasoning',
      ...(turnThoughtSignature ? { thinkingSignature: turnThoughtSignature } : {}),
    })
    currentBlockIndex++
  }

  const usage: TokenUsage = {
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  }
  yield { type: 'usage', usage }

  const replayState: PiAiReplayState = {
    kind: 'pi-ai',
    version: 1,
    api: 'google-genai' as unknown as never,
    provider: options.provider,
    model: options.model,
    stopReason: toolCallCount > 0 ? 'toolUse' : 'stop',
    blocks: replayBlocks,
  }
  yield {
    type: 'finish',
    reason: toolCallCount > 0 ? { kind: 'tool-calls' } : { kind: 'stop' },
    replayState,
  }
}
