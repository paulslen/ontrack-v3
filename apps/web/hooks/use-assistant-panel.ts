"use client"

import { useAtomValue } from "jotai"
import { settingsAtom } from "@tasktrove/atoms/data/base/atoms"
import { showAssistantPanelAtom } from "@tasktrove/atoms/ui/assistant"
import { selectedTaskAtom } from "@tasktrove/atoms/ui/selection"
import { currentViewStateAtom } from "@tasktrove/atoms/ui/views"
import { useIsMobile } from "@/hooks/use-mobile"

/** DOM id of the assistant's message box, so the shortcut can focus it */
export const ASSISTANT_INPUT_ID = "master-assistant-input"

/** Moves focus into the assistant's message box, if it is rendered */
export function focusAssistantInput(): void {
  const input = document.getElementById(ASSISTANT_INPUT_ID)
  if (input instanceof HTMLTextAreaElement) input.focus()
}

/**
 * Which right-hand panel a task view shows. An open task takes precedence;
 * otherwise the master assistant shows, unless the user hid it.
 */
export function useAssistantPanel() {
  const settings = useAtomValue(settingsAtom)
  const showAssistant = useAtomValue(showAssistantPanelAtom)
  const { showSidePanel } = useAtomValue(currentViewStateAtom)
  const selectedTask = useAtomValue(selectedTaskAtom)
  const isMobile = useIsMobile()

  const isTaskPanelOpen = showSidePanel && Boolean(selectedTask)
  // Desktop only for now: a half-screen panel doesn't fit on a phone
  const isAvailable = settings.ai.enabled && Boolean(settings.ai.apiKey) && !isMobile
  const isAssistantOpen = isAvailable && showAssistant && !isTaskPanelOpen

  return { isAvailable, isAssistantOpen, isTaskPanelOpen }
}
