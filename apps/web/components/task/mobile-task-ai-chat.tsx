"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowUp, Square, Sparkles, RotateCcw, X, Trash2 } from "lucide-react"
import { useTranslation } from "@tasktrove/i18n"
import { Textarea } from "@/components/ui/textarea"
import { ChatBubble, ThinkingIndicator } from "@/components/ai/chat-bubble"
import { cn } from "@/lib/utils"
import { useTaskAiChat } from "@/hooks/use-task-ai-chat"
import type { Task } from "@tasktrove/types/core"

interface MobileTaskAiChatProps {
  task: Task
  className?: string
}

/**
 * Full-height per-task AI chat for the mobile task drawer, styled like the master assistant:
 * messages fill the space and the composer stays pinned to the bottom.
 */
export function MobileTaskAiChat({ task, className }: MobileTaskAiChatProps) {
  const { t } = useTranslation("task")
  const history = task.aiChat ?? []
  const { state, send, stop, dismissError, clear } = useTaskAiChat(task.id, history)
  const [draft, setDraft] = useState("")
  const [confirmingClear, setConfirmingClear] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const isStreaming = state.status === "streaming"
  const hasMessages = history.length > 0 || state.status !== "idle"
  const streamedOutput = state.status === "streaming" ? state.output : ""
  const canSend = draft.trim().length > 0 && !isStreaming && state.status !== "error"

  const suggestions = [
    t("aiChat.suggestions.start", "Help me get started"),
    t("aiChat.suggestions.steps", "Break this into steps"),
  ]

  // Keep the newest message in view as the reply streams in
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [history.length, state.status, streamedOutput])

  const submit = (text: string): void => {
    const content = text.trim()
    if (!content || isStreaming) return
    setDraft("")
    void send(content)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Stop propagation so panel shortcuts (Space, Esc) don't fire while typing
    e.stopPropagation()
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit(draft)
    }
  }

  const handleDismissError = (): void => {
    if (state.status === "error") setDraft(state.pending.content)
    dismissError()
  }

  return (
    <div className={cn("flex min-h-0 flex-col", className)} data-testid="mobile-task-ai-chat">
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"
        data-testid="ai-chat-messages"
      >
        {!hasMessages ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-foreground text-background">
              <Sparkles className="size-6" />
            </div>
            <p className="mt-3 text-lg font-semibold tracking-tight">
              {t("aiChat.emptyTitle", "Ask about this task")}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => submit(suggestion)}
                  className="h-9 rounded-full border border-border bg-card px-4 text-sm font-medium active:scale-95 transition-transform"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
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
              <div className="space-y-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <p>{state.message}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium active:bg-destructive/10"
                    onClick={() => void send(state.pending.content)}
                  >
                    <RotateCcw className="size-3.5" />
                    {t("aiChat.retry", "Retry")}
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-medium active:bg-destructive/10"
                    onClick={handleDismissError}
                  >
                    <X className="size-3.5" />
                    {t("aiChat.dismiss", "Dismiss")}
                  </button>
                </div>
              </div>
            )}

            {/* Clear chat lives at the end of the conversation, out of the way */}
            {!isStreaming && history.length > 0 && (
              <div className="flex justify-center pt-1">
                {confirmingClear ? (
                  <div className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      className="h-7 rounded-full px-3 font-medium text-destructive"
                      onClick={() => {
                        clear()
                        setConfirmingClear(false)
                      }}
                    >
                      {t("aiChat.clear", "Clear chat")}
                    </button>
                    <button
                      type="button"
                      className="h-7 rounded-full px-3 text-muted-foreground"
                      onClick={() => setConfirmingClear(false)}
                    >
                      {t("aiChat.cancel", "Cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs text-muted-foreground"
                    onClick={() => setConfirmingClear(true)}
                  >
                    <Trash2 className="size-3.5" />
                    {t("aiChat.clear", "Clear chat")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Composer pinned to the bottom */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-card p-1.5 pl-4 shadow-sm focus-within:border-foreground/20 focus-within:shadow-md">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("aiChat.placeholder", "Ask about this task…")}
            aria-label={t("aiChat.inputLabel", "Message the AI about this task")}
            className="min-h-10 max-h-36 resize-none border-0 bg-transparent px-0 py-2 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
            rows={1}
            disabled={state.status === "error"}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stop}
              title={t("aiChat.stop", "Stop")}
              className="flex size-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-foreground active:scale-95"
            >
              <Square className="size-4" />
              <span className="sr-only">{t("aiChat.stop", "Stop")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => submit(draft)}
              disabled={!canSend}
              title={t("aiChat.send", "Send")}
              className={cn(
                "flex size-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200",
                canSend
                  ? "bg-foreground text-background active:scale-95"
                  : "bg-muted text-muted-foreground/60",
              )}
            >
              <ArrowUp className="size-5" />
              <span className="sr-only">{t("aiChat.send", "Send")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
