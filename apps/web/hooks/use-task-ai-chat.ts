"use client"

import { useState, useCallback, useRef } from "react"
import { useSetAtom } from "jotai"
import { updateTaskAtom } from "@tasktrove/atoms/core/tasks"
import type { AiChatMessage } from "@tasktrove/types/core"
import type { TaskId } from "@tasktrove/types/id"

export type TaskAiChatState =
  | { status: "idle" }
  | { status: "streaming"; pending: AiChatMessage; output: string }
  | { status: "error"; pending: AiChatMessage; message: string }

async function readErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  if (body !== null && typeof body === "object" && "error" in body) {
    return String(body.error)
  }
  return `Request failed (${response.status})`
}

/**
 * Per-task AI chat. The saved conversation lives on the task (`task.aiChat`);
 * this hook holds only the in-flight exchange and saves it once the reply ends.
 */
export function useTaskAiChat(taskId: TaskId, history: readonly AiChatMessage[]) {
  const updateTask = useSetAtom(updateTaskAtom)
  const [state, setState] = useState<TaskAiChatState>({ status: "idle" })
  const abortRef = useRef<AbortController | null>(null)

  const saveChat = useCallback(
    (aiChat: AiChatMessage[]): void => {
      void updateTask({ updateRequest: { id: taskId, aiChat } })
    },
    [taskId, updateTask],
  )

  const send = useCallback(
    async (content: string): Promise<void> => {
      const userMessage: AiChatMessage = { role: "user", content }
      const messages: AiChatMessage[] = [...history, userMessage]

      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setState({ status: "streaming", pending: userMessage, output: "" })
      let output = ""

      try {
        const response = await fetch("/api/v1/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, messages }),
          signal: controller.signal,
        })

        if (!response.ok) {
          setState({
            status: "error",
            pending: userMessage,
            message: await readErrorMessage(response),
          })
          return
        }

        const reader = response.body?.getReader()
        if (!reader) {
          setState({ status: "error", pending: userMessage, message: "No response body" })
          return
        }

        const decoder = new TextDecoder()
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          output += decoder.decode(chunk.value, { stream: true })
          setState({ status: "streaming", pending: userMessage, output })
        }

        saveChat([...messages, { role: "assistant", content: output }])
        setState({ status: "idle" })
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Keep whatever arrived before the user pressed stop
          if (output) saveChat([...messages, { role: "assistant", content: output }])
          setState({ status: "idle" })
          return
        }
        const message = err instanceof Error ? err.message : "Unknown error"
        setState({ status: "error", pending: userMessage, message })
      } finally {
        if (abortRef.current === controller) abortRef.current = null
      }
    },
    [history, taskId, saveChat],
  )

  const stop = useCallback((): void => {
    abortRef.current?.abort()
  }, [])

  const dismissError = useCallback((): void => {
    setState({ status: "idle" })
  }, [])

  // Only offered while idle: aborting here would save the partial reply over the cleared chat
  const clear = useCallback((): void => {
    saveChat([])
    setState({ status: "idle" })
  }, [saveChat])

  return { state, send, stop, dismissError, clear }
}
