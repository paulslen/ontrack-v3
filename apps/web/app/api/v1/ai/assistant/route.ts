import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import {
  AssistantRequestSchema,
  type AssistantStreamEvent,
  type AssistantTranscriptResponse,
} from "@tasktrove/types/assistant"
import { ApiErrorCode } from "@tasktrove/types/api-errors"
import type { ErrorResponse } from "@tasktrove/types/api-responses"
import { validateRequestBody, createErrorResponse } from "@/lib/utils/validation"
import { safeReadDataFile } from "@/lib/utils/safe-file-operations"
import { withApiLogging, type EnhancedRequest } from "@/lib/middleware/api-logger"
import { withAuthentication } from "@/lib/middleware/auth"
import { withApiVersion } from "@/lib/middleware/api-version"
import {
  createEmptyChat,
  loadAssistantChat,
  saveAssistantChat,
} from "@/lib/ai/assistant/chat-store"
import { buildSystemPrompt } from "@/lib/ai/assistant/prompt"
import { resolvePendingTurn, runAssistantTurn } from "@/lib/ai/assistant/run-turn"
import { buildTranscript, getPendingTurn } from "@/lib/ai/assistant/transcript"

/**
 * One conversation, one writer: requests that would change it while a reply is
 * still running are turned away rather than interleaved.
 */
let isBusy = false

function busyResponse(): NextResponse<ErrorResponse> {
  return createErrorResponse(
    "Assistant is busy",
    "The assistant is still working on the previous message",
    409,
    ApiErrorCode.RESOURCE_CONFLICT,
  )
}

function chatReadError(): NextResponse<ErrorResponse> {
  return createErrorResponse(
    "Failed to read assistant chat",
    "File reading or validation failed",
    500,
    ApiErrorCode.DATA_FILE_READ_ERROR,
  )
}

/**
 * GET /api/v1/ai/assistant
 *
 * Returns the master assistant conversation as display items.
 */
async function getTranscript(): Promise<NextResponse<AssistantTranscriptResponse | ErrorResponse>> {
  const chat = await loadAssistantChat()
  if (!chat) return chatReadError()
  return NextResponse.json<AssistantTranscriptResponse>({ items: buildTranscript(chat) })
}

/**
 * POST /api/v1/ai/assistant
 *
 * Sends a user message, or the user's decisions on pending proposals, and streams
 * the assistant's work back as newline-delimited JSON events.
 */
async function postToAssistant(
  request: EnhancedRequest,
): Promise<NextResponse<unknown | ErrorResponse>> {
  const validation = await validateRequestBody(request, AssistantRequestSchema)
  if (!validation.success) return validation.error
  const body = validation.data

  if (isBusy) return busyResponse()
  isBusy = true
  let streamStarted = false

  try {
    const fileData = await safeReadDataFile()
    if (!fileData) {
      return createErrorResponse(
        "Failed to read data file",
        "File reading or validation failed",
        500,
        ApiErrorCode.DATA_FILE_READ_ERROR,
      )
    }

    const aiSettings = fileData.settings.ai
    if (!aiSettings.enabled || !aiSettings.apiKey) {
      return NextResponse.json(
        { error: "AI is not enabled or no API key is configured" },
        { status: 403 },
      )
    }

    const chat = await loadAssistantChat()
    if (!chat) return chatReadError()

    if (body.kind === "message") {
      const resolved = resolvePendingTurn(chat, fileData, "new-message")
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })
      chat.messages.push({
        role: "user",
        content: [...resolved.results, { type: "text", text: body.text }],
      })
    } else {
      if (!getPendingTurn(chat)) {
        return NextResponse.json({ error: "No proposals are waiting" }, { status: 409 })
      }
      const decisions = new Map(body.results.map((result) => [result.toolUseId, result]))
      const resolved = resolvePendingTurn(chat, fileData, decisions)
      if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 })
      chat.messages.push({ role: "user", content: resolved.results })
    }

    if (!(await saveAssistantChat(chat))) {
      return createErrorResponse(
        "Failed to save assistant chat",
        "File writing failed",
        500,
        ApiErrorCode.DATA_FILE_WRITE_ERROR,
      )
    }

    const client = new Anthropic({ apiKey: aiSettings.apiKey })
    const system = buildSystemPrompt(body.context, aiSettings.contextFile)
    const abortController = new AbortController()
    const encoder = new TextEncoder()

    const readable = new ReadableStream<Uint8Array>({
      async start(controller) {
        const emit = (event: AssistantStreamEvent): void => {
          // The client went away; enqueueing on a cancelled stream would throw
          if (abortController.signal.aborted) return
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        }
        try {
          await runAssistantTurn({
            client,
            model: aiSettings.model,
            system,
            chat,
            emit,
            signal: abortController.signal,
          })
        } catch (err) {
          if (!abortController.signal.aborted) {
            emit({ type: "error", message: err instanceof Error ? err.message : "Unknown error" })
          }
        } finally {
          isBusy = false
          if (!abortController.signal.aborted) {
            emit({ type: "done" })
            controller.close()
          }
        }
      },
      cancel() {
        abortController.abort()
      },
    })

    streamStarted = true
    return new NextResponse(readable, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } finally {
    if (!streamStarted) isBusy = false
  }
}

/**
 * DELETE /api/v1/ai/assistant
 *
 * Clears the master assistant conversation.
 */
async function clearConversation(): Promise<NextResponse<{ success: true } | ErrorResponse>> {
  if (isBusy) return busyResponse()
  if (!(await saveAssistantChat(createEmptyChat()))) {
    return createErrorResponse(
      "Failed to clear assistant chat",
      "File writing failed",
      500,
      ApiErrorCode.DATA_FILE_WRITE_ERROR,
    )
  }
  return NextResponse.json({ success: true })
}

export const GET = withApiVersion(
  withAuthentication(
    withApiLogging(getTranscript, {
      endpoint: "/api/v1/ai/assistant",
      module: "api-v1-ai-assistant",
    }),
  ),
)

export const POST = withApiVersion(
  withAuthentication(
    withApiLogging(postToAssistant, {
      endpoint: "/api/v1/ai/assistant",
      module: "api-v1-ai-assistant",
    }),
  ),
)

export const DELETE = withApiVersion(
  withAuthentication(
    withApiLogging(clearConversation, {
      endpoint: "/api/v1/ai/assistant",
      module: "api-v1-ai-assistant",
    }),
  ),
)
