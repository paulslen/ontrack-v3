"use client"

import { useState, useEffect, useRef } from "react"
import { Bot, ArrowUp, Square, Trash2, RotateCcw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChatBubble, ThinkingIndicator } from "@/components/ai/chat-bubble"
import { cn } from "@/lib/utils"
import { useTaskAiChat } from "@/hooks/use-task-ai-chat"
import type { Task } from "@tasktrove/types/core"

const DEFAULT_START_PROMPT = "Help me get started on this task."

interface TaskAiChatProps {
  task: Task
  className?: string
}

export function TaskAiChat({ task, className }: TaskAiChatProps) {
  const history = task.aiChat ?? []
  const { state, send, stop, dismissError, clear } = useTaskAiChat(task.id, history)
  const [draft, setDraft] = useState("")
  const [confirmingClear, setConfirmingClear] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isStreaming = state.status === "streaming"
  const hasStarted = history.length > 0 || state.status !== "idle"
  const streamedOutput = state.status === "streaming" ? state.output : ""

  // Keep the newest message in view as the reply streams in
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history.length, state.status, streamedOutput])

  const submit = (): void => {
    if (isStreaming) return
    const text = draft.trim()
    if (!text && hasStarted) return
    setDraft("")
    void send(text || DEFAULT_START_PROMPT)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Stop propagation so panel shortcuts (Space, Esc) don't fire while typing
    e.stopPropagation()
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  const handleDismissError = (): void => {
    if (state.status === "error") setDraft(state.pending.content)
    dismissError()
  }

  if (!hasStarted) {
    return (
      <div className={cn("space-y-2", className)}>
        <h3 className="text-sm text-foreground font-bold">AI Chat</h3>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add context for the AI (optional)..."
          className="min-h-[60px] text-sm bg-muted/30 resize-none"
          rows={2}
        />
        <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={submit}>
          <Bot className="size-3.5" />
          Ask AI
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm text-foreground font-bold">AI Chat</h3>
        {!isStreaming &&
          (confirmingClear ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-destructive"
                onClick={() => {
                  clear()
                  setConfirmingClear(false)
                }}
              >
                Clear chat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => setConfirmingClear(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground"
              onClick={() => setConfirmingClear(true)}
              title="Clear chat"
            >
              <Trash2 className="size-3.5" />
              <span className="sr-only">Clear chat</span>
            </Button>
          ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
        <div
          ref={scrollRef}
          className="max-h-[420px] overflow-y-auto px-3 py-3 space-y-3"
          data-testid="ai-chat-messages"
        >
          {history.map((message, index) => (
            <ChatBubble key={index} role={message.role} content={message.content} />
          ))}

          {state.status !== "idle" && (
            <ChatBubble role={state.pending.role} content={state.pending.content} />
          )}

          {state.status === "streaming" &&
            (state.output ? (
              <ChatBubble role="assistant" content={state.output} />
            ) : (
              <ThinkingIndicator />
            ))}

          {state.status === "error" && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive space-y-2">
              <p>{state.message}</p>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-xs"
                  onClick={() => void send(state.pending.content)}
                >
                  <RotateCcw className="size-3" />
                  Retry
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 gap-1 px-2 text-xs"
                  onClick={handleDismissError}
                >
                  <X className="size-3" />
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-end gap-2 border-t border-border/50 bg-background/50 p-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Reply..."
            className="min-h-[36px] max-h-[160px] text-sm resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 py-1.5"
            rows={1}
            disabled={state.status === "error"}
          />
          {isStreaming ? (
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 flex-shrink-0"
              onClick={stop}
              title="Stop"
            >
              <Square className="size-3.5" />
              <span className="sr-only">Stop</span>
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={submit}
              disabled={!draft.trim() || state.status === "error"}
              title="Send"
            >
              <ArrowUp className="size-4" />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
