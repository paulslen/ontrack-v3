"use client"

import { useEffect, useRef } from "react"
import { useSetAtom } from "jotai"
import { Sparkles } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  ASSISTANT_INPUT_ID,
  focusAssistantInput,
  useAssistantPanel,
} from "@/hooks/use-assistant-panel"
import { showAssistantPanelAtom } from "@tasktrove/atoms/ui/assistant"
import { resetSidePanelStateAtom } from "@tasktrove/atoms/ui/views"

/** Header "Ask AI" pill that shows or hides the master assistant panel (also ⌘J / Ctrl+J) */
export function AssistantToggleButton() {
  const { isAvailable, isAssistantOpen, isTaskPanelOpen } = useAssistantPanel()
  const setShowAssistant = useSetAtom(showAssistantPanelAtom)
  const closeTaskPanel = useSetAtom(resetSidePanelStateAtom)

  const open = (): void => {
    setShowAssistant(true)
    // The assistant shares the side panel with task details, so make room for it
    if (isTaskPanelOpen) closeTaskPanel()
  }

  const handleClick = (): void => {
    if (isAssistantOpen) setShowAssistant(false)
    else open()
  }

  // ⌘J: open and focus the assistant; from inside the message box it closes it again
  const shortcutRef = useRef<() => void>(() => {})
  shortcutRef.current = (): void => {
    if (!isAssistantOpen) {
      open()
      return
    }
    if (document.activeElement?.id === ASSISTANT_INPUT_ID) setShowAssistant(false)
    else focusAssistantInput()
  }

  useEffect(() => {
    if (!isAvailable) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (e.key.toLowerCase() !== "j") return
      e.preventDefault()
      shortcutRef.current()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isAvailable])

  if (!isAvailable) return null

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold cursor-pointer",
            "transition-all duration-200 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50 outline-none",
            isAssistantOpen
              ? "bg-muted text-foreground hover:bg-muted/70"
              : "bg-foreground text-background shadow-sm hover:shadow-md hover:bg-foreground/90",
          )}
          aria-label={isAssistantOpen ? "Hide assistant" : "Ask AI"}
          aria-pressed={isAssistantOpen}
        >
          <Sparkles className="size-4" />
          Ask AI
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {isAssistantOpen ? "Hide assistant" : "Ask AI"}
        <kbd className="ml-2 font-sans opacity-60">⌘J</kbd>
      </TooltipContent>
    </Tooltip>
  )
}
