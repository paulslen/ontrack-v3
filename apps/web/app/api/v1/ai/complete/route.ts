import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { safeReadDataFile } from "@/lib/utils/safe-file-operations"

const RequestSchema = z.object({
  description: z.string().min(1),
  taskTitle: z.string().optional(),
  projectName: z.string().optional(),
  dueDateStr: z.string().optional(),
  labelNames: z.array(z.string()).optional(),
})

/**
 * POST /api/v1/ai/complete
 *
 * Streams an AI-expanded version of a task description.
 * Uses the user's configured Anthropic API key and context file from settings.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const body: unknown = await request.json().catch(() => null)
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { description, taskTitle, projectName, dueDateStr, labelNames } = parsed.data

  const fileData = await safeReadDataFile()
  if (!fileData) {
    return NextResponse.json({ error: "Failed to read settings" }, { status: 500 })
  }

  const aiSettings = fileData.settings.ai
  if (!aiSettings.enabled) {
    return NextResponse.json({ error: "AI is not enabled" }, { status: 403 })
  }
  if (!aiSettings.apiKey) {
    return NextResponse.json({ error: "No API key configured" }, { status: 403 })
  }

  const client = new Anthropic({ apiKey: aiSettings.apiKey })

  const contextFile = aiSettings.contextFile?.trim()
  const taskContextParts: string[] = []
  if (taskTitle) taskContextParts.push(`Task: ${taskTitle}`)
  if (projectName) taskContextParts.push(`Project: ${projectName}`)
  if (dueDateStr) taskContextParts.push(`Due: ${dueDateStr}`)
  if (labelNames?.length) taskContextParts.push(`Labels: ${labelNames.join(", ")}`)
  const taskContext = taskContextParts.join("\n")

  const systemBlocks: Anthropic.TextBlockParam[] = []
  if (contextFile) {
    systemBlocks.push({
      type: "text",
      text: contextFile,
      cache_control: { type: "ephemeral" },
    })
  }
  if (taskContext) {
    systemBlocks.push({ type: "text", text: `Task context:\n${taskContext}` })
  }
  if (systemBlocks.length === 0) {
    systemBlocks.push({
      type: "text",
      text: "You are a helpful productivity assistant. Expand the user's task instruction into a complete, actionable output.",
    })
  }

  const stream = client.messages.stream({
    model: aiSettings.model ?? "claude-haiku-4-5",
    max_tokens: 2048,
    system: systemBlocks,
    messages: [
      {
        role: "user",
        content: description,
      },
    ],
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === "content_block_delta" && chunk.delta.type === "text_delta") {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        controller.enqueue(new TextEncoder().encode(`\n\n[Error: ${message}]`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
