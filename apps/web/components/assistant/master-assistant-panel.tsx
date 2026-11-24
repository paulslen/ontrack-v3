"use client"

import { useState, useEffect, useRef } from "react"
import { useSetAtom } from "jotai"
import { ArrowUp, Trash2, X, Check, Sparkles, Sun, AlarmClock, ArrowRight } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChatBubble, ThinkingIndicator } from "@/components/ai/chat-bubble"
import { cn } from "@/lib/utils"
import { useMasterAssistant } from "@/hooks/use-master-assistant"
import { ASSISTANT_INPUT_ID } from "@/hooks/use-assistant-panel"
import { showAssistantPanelAtom } from "@tasktrove/atoms/ui/assistant"
import { ActionProposalCard } from "./action-proposal-card"

interface StarterPrompt {
  label: string
  message: string
  icon: LucideIcon
}

const STARTER_PROMPTS: readonly StarterPrompt[] = [
  {
    label: "Plan my day",
    message: "Help me plan my day: what should I focus on today, and in what order?",
    icon: Sun,
  },
  {
    label: "What's overdue?",
    message: "What's overdue? List my overdue tasks.",
    icon: AlarmClock,
  },
  {
    label: "Move everything to tomorrow",
    message: "Move all of today's unfinished tasks to tomorrow.",
    icon: ArrowRight,
  },
]

const ROUND_ICON_BUTTON = "size-9 rounded-full text-muted-foreground hover:text-foreground"

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
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const liveText = live?.text ?? ""
  const lastPendingId = pendingActions[pendingActions.length - 1]?.toolUseId

  // Ready to type the moment the panel opens
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    // Keep app-wide shortcuts from firing while typing; ⌘J still toggles the panel
    if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j")) e.stopPropagation()
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit(draft)
    }
  }

  const isEmpty = !isLoading && items.length === 0 && !live
  const canSend = Boolean(draft.trim()) && !isBusy

  return (
    <div
      className={cn("h-full flex flex-col bg-background border-l border-border/50", className)}
      data-testid="master-assistant-panel"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3.5 flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-foreground text-background">
          <Sparkles className="size-4" />
        </span>
        <h2 className="text-base font-semibold tracking-tight text-foreground flex-1">Assistant</h2>
        {items.length > 0 &&
          !isBusy &&
          (confirmingClear ? (
            <div className="flex items-center gap-1 animate-in fade-in duration-150">
              <Button
                size="sm"
                variant="ghost"
                className="h-9 rounded-full px-3 text-destructive hover:text-destructive"
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
                className="h-9 rounded-full px-3"
                onClick={() => setConfirmingClear(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className={ROUND_ICON_BUTTON}
              onClick={() => setConfirmingClear(true)}
              title="Clear chat"
            >
              <Trash2 className="size-4" />
              <span className="sr-only">Clear chat</span>
            </Button>
          ))}
        <Button
          size="icon"
          variant="ghost"
          className={ROUND_ICON_BUTTON}
          onClick={() => setShowAssistant(false)}
          title="Hide assistant"
        >
          <X className="size-5" />
          <span className="sr-only">Hide assistant</span>
        </Button>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-6 space-y-6">
          {isLoading && <ThinkingIndicator label="Loading..." />}

          {isEmpty && (
            <div className="flex flex-col items-center text-center pt-[12vh] animate-in fade-in slide-in-from-bottom-2 duration-500">
              <span className="flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg">
                <Sparkles className="size-6" />
              </span>
              <h3 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
                How can I help?
              </h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                Plan your day or let me move tasks around. You approve every change.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-2">
                {STARTER_PROMPTS.map(({ label, message, icon: Icon }) => (
                  <button
                    key={label}
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-xs transition-all hover:bg-accent hover:shadow-sm active:scale-[0.97] cursor-pointer"
                    onClick={() => submit(message)}
                  >
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {items.map((item, index) => {
            if (item.kind !== "action") {
              return <ChatBubble key={index} role={item.kind} content={item.text} />
            }
            return (
              <div key={item.toolUseId} className="space-y-3">
                <ActionProposalCard
                  item={item}
                  decision={decisions[item.toolUseId]}
                  disabled={isBusy}
                  onDecide={(decision) => decide([item.toolUseId], decision)}
                />
                {item.toolUseId === lastPendingId && pendingActions.length > 1 && (
                  <div className="flex gap-2">
                    <Button
                      className="h-10 gap-1.5 rounded-full px-5"
                      disabled={isBusy}
                      onClick={() =>
                        decide(
                          pendingActions.map((action) => action.toolUseId),
                          "approved",
                        )
                      }
                    >
                      <Check className="size-4" />
                      Approve all {pendingActions.length}
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-10 rounded-full px-5"
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
            <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-start gap-3">
              <p className="flex-1 break-words">{error}</p>
              <button type="button" onClick={dismissError} className="flex-shrink-0 cursor-pointer">
                <X className="size-4" />
                <span className="sr-only">Dismiss</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 px-4 pb-4 pt-2">
        <div className="mx-auto max-w-2xl space-y-2">
          {pendingActions.length > 0 && !isBusy && (
            <p className="px-2 text-xs text-muted-foreground">
              Sending a message instead of deciding will skip the proposed changes.
            </p>
          )}
          <div className="flex items-end gap-2 rounded-[1.75rem] border border-border bg-card p-2 pl-5 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-foreground/20">
            <Textarea
              id={ASSISTANT_INPUT_ID}
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything…"
              aria-label="Message the assistant"
              className="min-h-10 max-h-48 resize-none border-0 bg-transparent dark:bg-transparent px-0 py-2 text-base md:text-base shadow-none focus-visible:ring-0"
              rows={1}
            />
            <button
              type="button"
              onClick={() => submit(draft)}
              disabled={!canSend}
              title="Send"
              className={cn(
                "flex size-10 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200",
                canSend
                  ? "bg-foreground text-background hover:bg-foreground/85 active:scale-95 cursor-pointer"
                  : "bg-muted text-muted-foreground/60",
              )}
            >
              <ArrowUp className="size-5" />
              <span className="sr-only">Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
