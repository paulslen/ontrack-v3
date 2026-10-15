import type Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import type {
  ActionResult,
  AssistantChatFile,
  AssistantStreamEvent,
  PrecomputedToolResult,
  StoredAssistantMessage,
  StoredUserMessage,
} from "@tasktrove/types/assistant"
import type { DataFile } from "@tasktrove/types/data-file"
import { safeReadDataFile } from "@/lib/utils/safe-file-operations"
import { saveAssistantChat } from "./chat-store"
import { ASSISTANT_TOOLS, getToolActivityLabel, handleToolUse, isWriteTool } from "./tools"
import { getPendingTurn } from "./transcript"

/** Upper bound on model calls per user turn, so a confused loop can't run up costs */
const MAX_STEPS = 12

type ToolResultBlock = Extract<StoredUserMessage["content"][number], { type: "tool_result" }>

function toToolResult(toolUseId: string, result: PrecomputedToolResult): ToolResultBlock {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: result.content,
    ...(result.isError ? { is_error: true } : {}),
  }
}

function describeDecision(result: ActionResult): PrecomputedToolResult {
  switch (result.status) {
    case "approved":
      return {
        content: `The user approved this and it was applied. ${result.message}`,
        isError: false,
      }
    case "rejected":
      return { content: "The user rejected this change.", isError: false }
    case "failed":
      return {
        content: `The user approved this, but applying it failed: ${result.message}`,
        isError: true,
      }
  }
}

type ResolveResult = { ok: true; results: ToolResultBlock[] } | { ok: false; error: string }

/**
 * Builds the tool results that close the pending turn. Pass the user's decisions,
 * or "new-message" when they typed a reply instead of deciding (treated as a rejection).
 * Records each proposal's outcome on the chat.
 */
export function resolvePendingTurn(
  chat: AssistantChatFile,
  fileData: DataFile,
  decisions: ReadonlyMap<string, ActionResult> | "new-message",
): ResolveResult {
  const turn = getPendingTurn(chat)
  if (!turn) return { ok: true, results: [] }

  const results: ToolResultBlock[] = []
  for (const block of turn.content) {
    if (block.type !== "tool_use") continue

    const precomputed = chat.pendingResults[block.id]
    if (precomputed) {
      results.push(toToolResult(block.id, precomputed))
      continue
    }

    if (isWriteTool(block.name)) {
      if (decisions === "new-message") {
        chat.actionStatuses[block.id] = "rejected"
        results.push(
          toToolResult(block.id, {
            content: "The user didn't approve this; they sent a new message instead.",
            isError: false,
          }),
        )
        continue
      }
      const decision = decisions.get(block.id)
      if (!decision) return { ok: false, error: "Missing a decision for a pending proposal" }
      chat.actionStatuses[block.id] = decision.status
      results.push(toToolResult(block.id, describeDecision(decision)))
      continue
    }

    // Lookups are normally precomputed; run any that weren't
    const outcome = handleToolUse(block.name, block.input, fileData)
    results.push(
      toToolResult(
        block.id,
        outcome.kind === "result" ? outcome.result : { content: "Not run.", isError: true },
      ),
    )
  }

  chat.pendingResults = {}
  return { ok: true, results }
}

const ToolInputSchema = z.record(z.string(), z.unknown())

function toStoredContent(blocks: Anthropic.ContentBlock[]): StoredAssistantMessage["content"] {
  const stored: StoredAssistantMessage["content"] = []
  for (const block of blocks) {
    switch (block.type) {
      case "text":
        if (block.text) stored.push({ type: "text", text: block.text })
        break
      case "thinking":
        stored.push({ type: "thinking", thinking: block.thinking, signature: block.signature })
        break
      case "redacted_thinking":
        stored.push({ type: "redacted_thinking", data: block.data })
        break
      case "tool_use": {
        const input = ToolInputSchema.safeParse(block.input)
        stored.push({
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: input.success ? input.data : {},
        })
        break
      }
      default:
        break
    }
  }
  return stored
}

interface RunAssistantTurnOptions {
  client: Anthropic
  model: string
  system: string
  chat: AssistantChatFile
  emit: (event: AssistantStreamEvent) => void
  signal: AbortSignal
}

/**
 * Calls Claude until it finishes its reply, running lookups along the way.
 * Stops early when Claude proposes a change, which then waits for the user.
 * The chat is saved after every step.
 */
export async function runAssistantTurn({
  client,
  model,
  system,
  chat,
  emit,
  signal,
}: RunAssistantTurnOptions): Promise<void> {
  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.messages.stream(
      {
        model,
        max_tokens: 16000,
        // Caches tools, system prompt and history so follow-ups only pay for new tokens
        cache_control: { type: "ephemeral" },
        system,
        tools: ASSISTANT_TOOLS,
        messages: chat.messages,
      },
      { signal },
    )
    stream.on("text", (text) => emit({ type: "text", text }))
    const message = await stream.finalMessage()

    const content = toStoredContent(message.content)
    if (content.length > 0) {
      chat.messages.push({ role: "assistant", content })
      await saveAssistantChat(chat)
    }

    if (message.stop_reason === "refusal") {
      emit({ type: "error", message: "Claude declined to respond to that." })
      return
    }
    if (message.stop_reason === "max_tokens") {
      emit({ type: "error", message: "The reply was too long and got cut off." })
      return
    }
    if (message.stop_reason !== "tool_use") return

    const fileData = await safeReadDataFile()
    if (!fileData) {
      emit({ type: "error", message: "Couldn't read your tasks." })
      return
    }

    const results: Record<string, PrecomputedToolResult> = {}
    let hasProposal = false
    for (const block of content) {
      if (block.type !== "tool_use") continue
      const activity = getToolActivityLabel(block.name)
      if (activity) emit({ type: "activity", label: activity })
      const outcome = handleToolUse(block.name, block.input, fileData)
      if (outcome.kind === "result") {
        results[block.id] = outcome.result
      } else {
        hasProposal = true
      }
    }

    if (hasProposal) {
      chat.pendingResults = results
      await saveAssistantChat(chat)
      return
    }

    chat.messages.push({
      role: "user",
      content: Object.entries(results).map(([id, result]) => toToolResult(id, result)),
    })
    await saveAssistantChat(chat)
  }

  emit({ type: "error", message: "Stopped after too many steps. Try a narrower request." })
}
