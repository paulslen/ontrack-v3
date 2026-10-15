import path from "path"
import { DEFAULT_DATA_DIR } from "@tasktrove/constants"
import { AssistantChatFileSchema, type AssistantChatFile } from "@tasktrove/types/assistant"
import { safeReadJsonFile, safeWriteJsonFile } from "@/lib/utils/safe-file-operations"

/** Lives next to data.json so it persists on the same mounted data volume */
const ASSISTANT_CHAT_FILE_PATH = path.join(DEFAULT_DATA_DIR, "assistant-chat.json")

export function createEmptyChat(): AssistantChatFile {
  return { messages: [], actionStatuses: {}, pendingResults: {} }
}

export async function loadAssistantChat(): Promise<AssistantChatFile | undefined> {
  return safeReadJsonFile({
    filePath: ASSISTANT_CHAT_FILE_PATH,
    schema: AssistantChatFileSchema,
    defaultValue: createEmptyChat(),
  })
}

export async function saveAssistantChat(chat: AssistantChatFile): Promise<boolean> {
  return safeWriteJsonFile({
    filePath: ASSISTANT_CHAT_FILE_PATH,
    data: chat,
    serializationSchema: AssistantChatFileSchema,
  })
}
