"use client"

import { useState, useCallback, useRef } from "react"

interface AiCompleteParams {
  description: string
  taskTitle?: string
  projectName?: string
  dueDateStr?: string
  labelNames?: string[]
}

type AiCompleteState =
  | { status: "idle" }
  | { status: "streaming"; output: string }
  | { status: "done"; output: string }
  | { status: "error"; message: string }

export function useAiComplete() {
  const [state, setState] = useState<AiCompleteState>({ status: "idle" })
  const abortRef = useRef<AbortController | null>(null)

  const generate = useCallback(async (params: AiCompleteParams) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState({ status: "streaming", output: "" })

    try {
      const response = await fetch("/api/v1/ai/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err: unknown = await response.json().catch(() => ({ error: "Request failed" }))
        const message =
          err !== null && typeof err === "object" && "error" in err
            ? String((err as { error: unknown }).error)
            : "Request failed"
        setState({ status: "error", message })
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        setState({ status: "error", message: "No response body" })
        return
      }

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setState({ status: "streaming", output: accumulated })
      }

      setState({ status: "done", output: accumulated })
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setState({ status: "idle" })
        return
      }
      const message = err instanceof Error ? err.message : "Unknown error"
      setState({ status: "error", message })
    }
  }, [])

  const dismiss = useCallback(() => {
    abortRef.current?.abort()
    setState({ status: "idle" })
  }, [])

  return { state, generate, dismiss }
}
