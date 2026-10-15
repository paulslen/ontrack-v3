"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useSetAtom } from "jotai"
import { format, parse } from "date-fns"
import { addTaskAtom, updateTaskAtom } from "@tasktrove/atoms/core/tasks"
import { INBOX_PROJECT_ID } from "@tasktrove/types/constants"
import type { UpdateTaskRequest } from "@tasktrove/types/api-requests"
import {
  AssistantStreamEventSchema,
  AssistantTranscriptResponseSchema,
  type ActionResult,
  type AssistantAction,
  type AssistantClientContext,
  type AssistantRequest,
  type AssistantTranscriptItem,
} from "@tasktrove/types/assistant"

const ASSISTANT_API = "/api/v1/ai/assistant"

export type ActionDecision = "approved" | "rejected"

/** What's on screen while a request is running, before the saved transcript reloads */
export interface LiveTurn {
  userText?: string
  text: string
  activity?: string
}

function getClientContext(): AssistantClientContext {
  return {
    today: format(new Date(), "yyyy-MM-dd"),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

async function readErrorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null)
  if (body !== null && typeof body === "object") {
    if ("message" in body && typeof body.message === "string") return body.message
    if ("error" in body && typeof body.error === "string") return body.error
  }
  return `Request failed (${response.status})`
}

function parseDueDate(value: string): Date {
  return parse(value, "yyyy-MM-dd", new Date())
}

function parseDueTime(value: string): Date {
  return parse(value, "HH:mm", new Date())
}

/**
 * The app-wide assistant chat. The server stores the conversation and runs Claude;
 * this hook streams replies and applies the changes the user approves through the
 * same task atoms the rest of the UI uses.
 */
export function useMasterAssistant() {
  const addTask = useSetAtom(addTaskAtom)
  const updateTask = useSetAtom(updateTaskAtom)

  const [items, setItems] = useState<AssistantTranscriptItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [live, setLive] = useState<LiveTurn | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Record<string, ActionDecision>>({})
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const reload = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(ASSISTANT_API)
      if (!response.ok) {
        setError(await readErrorMessage(response))
        return
      }
      const parsed = AssistantTranscriptResponseSchema.safeParse(await response.json())
      if (!parsed.success) {
        setError("Couldn't read the assistant conversation")
        return
      }
      setItems(parsed.data.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the assistant")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Posts to the assistant and renders its streamed events until it finishes */
  const run = useCallback(
    async (request: AssistantRequest, userText?: string): Promise<void> => {
      setError(null)
      let liveTurn: LiveTurn = { userText, text: "" }
      setLive(liveTurn)
      const update = (next: Partial<LiveTurn>): void => {
        liveTurn = { ...liveTurn, ...next }
        if (isMountedRef.current) setLive(liveTurn)
      }

      try {
        const response = await fetch(ASSISTANT_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        })
        if (!response.ok) {
          setError(await readErrorMessage(response))
          return
        }
        const reader = response.body?.getReader()
        if (!reader) {
          setError("No response from the assistant")
          return
        }

        const decoder = new TextDecoder()
        let buffer = ""
        for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
          buffer += decoder.decode(chunk.value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line.trim()) continue
            const event = AssistantStreamEventSchema.safeParse(JSON.parse(line))
            if (!event.success) continue
            switch (event.data.type) {
              case "text":
                update({ text: liveTurn.text + event.data.text, activity: undefined })
                break
              case "activity":
                update({ activity: event.data.label })
                break
              case "error":
                setError(event.data.message)
                break
              case "done":
                break
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Lost connection to the assistant")
      } finally {
        await reload()
        if (isMountedRef.current) setLive(null)
      }
    },
    [reload],
  )

  const sendMessage = useCallback(
    async (text: string): Promise<void> => {
      setDecisions({})
      await run({ kind: "message", text, context: getClientContext() }, text)
    },
    [run],
  )

  const applyAction = useCallback(
    async (action: AssistantAction): Promise<string> => {
      if (action.name === "create_task") {
        const { input } = action
        const created = await addTask({
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate ? parseDueDate(input.dueDate) : undefined,
          dueTime: input.dueTime ? parseDueTime(input.dueTime) : undefined,
          projectId: input.projectId,
          labels: input.labelIds,
          recurring: input.recurring,
        })
        return `Created task with id ${created.id}.`
      }

      const { taskId, dueDate, dueTime, projectId, ...rest } = action.input
      const updateRequest: UpdateTaskRequest = {
        id: taskId,
        ...rest,
        ...(dueDate !== undefined && { dueDate: dueDate === null ? null : parseDueDate(dueDate) }),
        ...(dueTime !== undefined && { dueTime: dueTime === null ? null : parseDueTime(dueTime) }),
        ...(projectId !== undefined && { projectId: projectId ?? INBOX_PROJECT_ID }),
      }
      await updateTask({ updateRequest })
      return "Task updated."
    },
    [addTask, updateTask],
  )

  /** Applies the approved proposals, then tells the assistant how each one went */
  const submitDecisions = useCallback(
    async (pending: AssistantTranscriptItem[], chosen: Record<string, ActionDecision>) => {
      setLive({ text: "", activity: "Applying your changes" })
      const results: ActionResult[] = []
      for (const item of pending) {
        if (item.kind !== "action") continue
        if (chosen[item.toolUseId] !== "approved") {
          results.push({ toolUseId: item.toolUseId, status: "rejected", message: "" })
          continue
        }
        try {
          const message = await applyAction(item.action)
          results.push({ toolUseId: item.toolUseId, status: "approved", message })
        } catch (err) {
          results.push({
            toolUseId: item.toolUseId,
            status: "failed",
            message: err instanceof Error ? err.message : "Unknown error",
          })
        }
      }
      setDecisions({})
      await run({ kind: "decisions", results, context: getClientContext() })
    },
    [applyAction, run],
  )

  const pendingActions = items.filter(
    (item): item is Extract<AssistantTranscriptItem, { kind: "action" }> =>
      item.kind === "action" && item.status === "pending",
  )

  /** Records a decision; once every pending proposal has one, they're submitted together */
  const decide = useCallback(
    (toolUseIds: string[], decision: ActionDecision): void => {
      const next = { ...decisions }
      for (const id of toolUseIds) next[id] = decision
      setDecisions(next)
      if (pendingActions.every((item) => next[item.toolUseId] !== undefined)) {
        void submitDecisions(pendingActions, next)
      }
    },
    [decisions, pendingActions, submitDecisions],
  )

  const clear = useCallback(async (): Promise<void> => {
    setError(null)
    const response = await fetch(ASSISTANT_API, { method: "DELETE" })
    if (!response.ok) setError(await readErrorMessage(response))
    setDecisions({})
    await reload()
  }, [reload])

  return {
    items,
    isLoading,
    isBusy: live !== null,
    live,
    error,
    decisions,
    pendingActions,
    sendMessage,
    decide,
    clear,
    dismissError: () => setError(null),
  }
}
