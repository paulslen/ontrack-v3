import type {
  AssistantChatFile,
  AssistantTranscriptItem,
  StoredAssistantMessage,
} from "@tasktrove/types/assistant"
import { parseStoredAction } from "./tools"

/**
 * The last assistant turn, when it ended by calling tools that have no results yet.
 * That happens only while proposals wait for the user's decision.
 */
export function getPendingTurn(chat: AssistantChatFile): StoredAssistantMessage | undefined {
  const last = chat.messages[chat.messages.length - 1]
  if (last?.role !== "assistant") return undefined
  return last.content.some((block) => block.type === "tool_use") ? last : undefined
}

/** Turns the stored API conversation into what the chat panel shows */
export function buildTranscript(chat: AssistantChatFile): AssistantTranscriptItem[] {
  const pendingTurn = getPendingTurn(chat)
  const items: AssistantTranscriptItem[] = []

  for (const message of chat.messages) {
    if (message.role === "user") {
      for (const block of message.content) {
        if (block.type === "text") items.push({ kind: "user", text: block.text })
      }
      continue
    }

    for (const block of message.content) {
      if (block.type === "text" && block.text.trim()) {
        items.push({ kind: "assistant", text: block.text })
      }
      if (block.type !== "tool_use") continue

      const action = parseStoredAction(block.name, block.input)
      if (!action) continue

      const decided = chat.actionStatuses[block.id]
      if (decided) {
        items.push({ kind: "action", toolUseId: block.id, action, status: decided })
      } else if (message === pendingTurn && !(block.id in chat.pendingResults)) {
        items.push({ kind: "action", toolUseId: block.id, action, status: "pending" })
      }
      // Otherwise the proposal failed validation and Claude was told why; nothing to show
    }
  }

  return items
}
