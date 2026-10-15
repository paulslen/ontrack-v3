"use client"

import { useState, useEffect, useRef } from "react"
import { useSetAtom } from "jotai"
import { Bot, ArrowUp, Trash2, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChatBubble, ThinkingIndicator } from "@/components/ai/chat-bubble"
import { cn } from "@/lib/utils"
import { useMasterAssistant } from "@/hooks/use-master-assistant"
import { showAssistantPanelAtom } from "@tasktrove/atoms/ui/assistant"
import { ActionProposalCard } from "./action-proposal-card"

const STARTER_PROMPTS = [
  "What should I focus on today?",
  "Give me an overview of my workload this week",
  "Help me set up a recurring task",
]

interface MasterAssistantPanelProps {
  className?: string
}

export function MasterAssistantPanel({ className }: MasterAssistantPanelProps) {
  const {
    items,
    isLoading,
    isBusy,
    live,
    error,
    decisions,
    pendingActions,
    sendMessage,
    decide,
    clear,
    dismissError,
  } = useMasterAssistant()
  const setShowAssistant = useSetAtom(showAssistantPanelAtom)
  const [draft, setDraft] = useState("")
  const [confirmingClear, setConfirmingClear] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const liveText = live?.text ?? ""
  const lastPendingId = pendingActions[pendingActions.length - 1]?.toolUseId

  // Keep the newest message in view as replies stream in
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [items.length, live?.userText, liveText, live?.activity, error])

  const submit = (text: string): void => {
    const trimmed = text.trim()
    if (!trimmed || isBusy) return
    setDraft("")
    void sendMessage(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Keep app-wide shortcuts from firing while typing
    e.stopPropagation()
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit(draft)
    }
  }

  const isEmpty = !isLoading && items.length === 0 && !live

  return (
    <div
      className={cn("h-full flex flex-col bg-background/95 border-l border-border/50", className)}
      data-testid="master-assistant-panel"
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 px-3 py-3 flex items-center gap-2">
        <Bot className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground flex-1">Assistant</h2>
        {items.length > 0 &&
          !isBusy &&
          (confirmingClear ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive"
                onClick={() => {
                  setConfirmingClear(false)
                  void clear()
                }}
              >
                Clear chat
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setConfirmingClear(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setConfirmingClear(true)}
              title="Clear chat"
            >
              <Trash2 className="size-3.5" />
              <span className="sr-only">Clear chat</span>
            </Button>
          ))}
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => setShowAssistant(false)}
          title="Hide assistant"
        >
          <X className="size-4" />
          <span className="sr-only">Hide assistant</span>
        </Button>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
        {isLoading && <ThinkingIndicator label="Loading..." />}

        {isEmpty && (
          <div className="space-y-3 pt-4">
            <p className="text-sm text-muted-foreground">
              Ask about your tasks, plan your day, or have me create and update tasks for you.
              I&apos;ll show each change for you to approve first.
            </p>
            <div className="flex flex-col items-start gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <Button
                  key={prompt}
                  size="sm"
                  variant="outline"
                  className="h-auto py-1.5 text-xs font-normal text-left whitespace-normal"
                  onClick={() => submit(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </div>
        )}

        {items.map((item, index) => {
          if (item.kind !== "action") {
            return <ChatBubble key={index} role={item.kind} content={item.text} />
          }
          return (
            <div key={item.toolUseId} className="space-y-2">
              <ActionProposalCard
                item={item}
                decision={decisions[item.toolUseId]}
                disabled={isBusy}
                onDecide={(decision) => decide([item.toolUseId], decision)}
              />
              {item.toolUseId === lastPendingId && pendingActions.length > 1 && (
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    disabled={isBusy}
                    onClick={() =>
                      decide(
                        pendingActions.map((action) => action.toolUseId),
                        "approved",
                      )
                    }
                  >
                    <Check className="size-3" />
                    Approve all {pendingActions.length}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={isBusy}
                    onClick={() =>
                      decide(
                        pendingActions.map((action) => action.toolUseId),
                        "rejected",
                      )
                    }
                  >
                    Reject all
                  </Button>
                </div>
              )}
            </div>
          )
        })}

        {live?.userText && <ChatBubble role="user" content={live.userText} />}
        {liveText && <ChatBubble role="assistant" content={liveText} />}
        {live && (live.activity || !liveText) && (
          <ThinkingIndicator label={live.activity ? `${live.activity}...` : undefined} />
        )}

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
            <p className="flex-1 break-words">{error}</p>
            <button type="button" onClick={dismissError} className="flex-shrink-0">
              <X className="size-3" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-border/50 p-3 space-y-1.5">
        {pendingActions.length > 0 && !isBusy && (
          <p className="text-xs text-muted-foreground">
            Sending a message instead of deciding will skip the proposed changes.
          </p>
        )}
        <div className="flex items-end gap-2 rounded-lg border border-border bg-muted/20 p-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask the assistant..."
            className="min-h-[36px] max-h-[200px] text-sm resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 px-1 py-1.5"
            rows={1}
            disabled={isBusy}
          />
          <Button
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={() => submit(draft)}
            disabled={!draft.trim() || isBusy}
            title="Send"
          >
            <ArrowUp className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
