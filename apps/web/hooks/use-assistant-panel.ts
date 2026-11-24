"use client"

import { useAtom, useAtomValue } from "jotai"
import { settingsAtom } from "@tasktrove/atoms/data/base/atoms"
import { mobileAssistantOpenAtom, showAssistantPanelAtom } from "@tasktrove/atoms/ui/assistant"
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
 * Which panel a task view shows. An open task takes precedence; otherwise the master
 * assistant shows, unless the user hid it. Desktop shows it as a side panel (remembered
 * across visits); mobile as a bottom sheet that only opens on request.
 */
export function useAssistantPanel() {
  const settings = useAtomValue(settingsAtom)
  const [showAssistant, setShowAssistant] = useAtom(showAssistantPanelAtom)
  const [mobileAssistantOpen, setMobileAssistantOpen] = useAtom(mobileAssistantOpenAtom)
  const { showSidePanel } = useAtomValue(currentViewStateAtom)
  const selectedTask = useAtomValue(selectedTaskAtom)
  const isMobile = useIsMobile()

  const isTaskPanelOpen = showSidePanel && Boolean(selectedTask)
  const isAvailable = settings.ai.enabled && Boolean(settings.ai.apiKey)
  const wantsAssistant = isMobile ? mobileAssistantOpen : showAssistant
  const isAssistantOpen = isAvailable && wantsAssistant && !isTaskPanelOpen
  const setAssistantOpen = isMobile ? setMobileAssistantOpen : setShowAssistant

  return { isAvailable, isAssistantOpen, isTaskPanelOpen, isMobile, setAssistantOpen }
}
