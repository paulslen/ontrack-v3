"use client"

import { useSetAtom } from "jotai"
import { Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAssistantPanel } from "@/hooks/use-assistant-panel"
import { showAssistantPanelAtom } from "@tasktrove/atoms/ui/assistant"
import { resetSidePanelStateAtom } from "@tasktrove/atoms/ui/views"

/** Header button that shows or hides the master assistant panel */
export function AssistantToggleButton() {
  const { isAvailable, isAssistantOpen, isTaskPanelOpen } = useAssistantPanel()
  const setShowAssistant = useSetAtom(showAssistantPanelAtom)
  const closeTaskPanel = useSetAtom(resetSidePanelStateAtom)

  if (!isAvailable) return null

  const handleClick = (): void => {
    if (isAssistantOpen) {
      setShowAssistant(false)
      return
    }
    setShowAssistant(true)
    // The assistant shares the side panel with task details, so make room for it
    if (isTaskPanelOpen) closeTaskPanel()
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      className={cn("cursor-pointer", isAssistantOpen && "bg-accent")}
      title={isAssistantOpen ? "Hide assistant" : "Show assistant"}
      aria-pressed={isAssistantOpen}
    >
      <Bot className="h-4 w-4" />
    </Button>
  )
}
