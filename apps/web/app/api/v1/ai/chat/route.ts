import { NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { format } from "date-fns"
import { z } from "zod"
import { AiChatMessageSchema, type Task } from "@tasktrove/types/core"
import type { DataFile } from "@tasktrove/types/data-file"
import { TaskIdSchema } from "@tasktrove/types/id"
import { ApiErrorCode } from "@tasktrove/types/api-errors"
import type { ErrorResponse } from "@tasktrove/types/api-responses"
import { validateRequestBody, createErrorResponse } from "@/lib/utils/validation"
import { safeReadDataFile } from "@/lib/utils/safe-file-operations"
import { withApiLogging, type EnhancedRequest } from "@/lib/middleware/api-logger"
import { withAuthentication } from "@/lib/middleware/auth"
import { withApiVersion } from "@/lib/middleware/api-version"

const ChatRequestSchema = z.object({
  taskId: TaskIdSchema,
  messages: z
    .array(AiChatMessageSchema)
    .min(1)
    .refine((messages) => messages[messages.length - 1]?.role === "user", {
      message: "Last message must be from the user",
    }),
})

const BASE_INSTRUCTIONS = `You are an assistant built into TaskTrove, a personal task manager. The user is chatting with you about one specific task, shown below.

Help them get the task done: clarify what it involves, break it into concrete steps, suggest an approach, point to useful resources, and answer follow-up questions. Be direct and practical. Keep answers short enough to read in a narrow side panel, and use markdown lists and headings only when they make the answer easier to follow.`

const PRIORITY_LABELS: Record<Task["priority"], string> = {
  1: "P1 (highest)",
  2: "P2",
  3: "P3",
  4: "P4 (none)",
}

function describeTask(task: Task, fileData: DataFile): string {
  const lines: string[] = [`Title: ${task.title}`]
  lines.push(`Status: ${task.completed ? "completed" : "open"}`)
  lines.push(`Priority: ${PRIORITY_LABELS[task.priority]}`)

  if (task.dueDate) {
    const due = format(task.dueDate, "EEEE, MMMM d, yyyy")
    lines.push(`Due: ${task.dueTime ? `${due} at ${format(task.dueTime, "HH:mm")}` : due}`)
  }
  if (task.recurring) lines.push(`Recurring: ${task.recurring}`)

  const project = fileData.projects.find((p) => p.id === task.projectId)
  if (project) lines.push(`Project: ${project.name}`)

  const labelNames = task.labels
    .map((id) => fileData.labels.find((l) => l.id === id)?.name)
    .filter((name): name is string => name !== undefined)
  if (labelNames.length > 0) lines.push(`Labels: ${labelNames.join(", ")}`)

  if (task.subtasks.length > 0) {
    lines.push("Subtasks:")
    for (const subtask of task.subtasks) {
      lines.push(`- [${subtask.completed ? "x" : " "}] ${subtask.title}`)
    }
  }

  if (task.description?.trim()) {
    lines.push(`Description:\n${task.description.trim()}`)
  }

  if (task.comments.length > 0) {
    lines.push("Comments:")
    for (const comment of task.comments) {
      lines.push(`- ${comment.content}`)
    }
  }

  return lines.join("\n")
}

/**
 * POST /api/v1/ai/chat
 *
 * Streams Claude's reply in a per-task chat. The client sends the whole
 * conversation; task details are read from the data file so the model always
 * sees the task's current state.
 */
async function chat(request: EnhancedRequest): Promise<NextResponse<unknown | ErrorResponse>> {
  const validation = await validateRequestBody(request, ChatRequestSchema)
  if (!validation.success) {
    return validation.error
  }
  const { taskId, messages } = validation.data

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

  const task = fileData.tasks.find((t) => t.id === taskId)
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 })
  }

  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: BASE_INSTRUCTIONS }]
  const contextFile = aiSettings.contextFile.trim()
  if (contextFile) {
    system.push({ type: "text", text: `About the user:\n${contextFile}` })
  }
  system.push({
    type: "text",
    text: `Today is ${format(new Date(), "EEEE, MMMM d, yyyy")}.\n\nThe task:\n${describeTask(task, fileData)}`,
  })

  const client = new Anthropic({ apiKey: aiSettings.apiKey })
  const stream = client.messages.stream({
    model: aiSettings.model,
    max_tokens: 16000,
    // Caches the conversation prefix so each follow-up only pays for new tokens
    cache_control: { type: "ephemeral" },
    system,
    messages,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        controller.enqueue(encoder.encode(`\n\n[Error: ${message}]`))
      } finally {
        controller.close()
      }
    },
    cancel() {
      stream.abort()
    },
  })

  return new NextResponse(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export const POST = withApiVersion(
  withAuthentication(
    withApiLogging(chat, {
      endpoint: "/api/v1/ai/chat",
      module: "api-v1-ai-chat",
    }),
  ),
)
