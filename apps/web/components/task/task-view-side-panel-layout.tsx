"use client"

import { useCallback, useEffect, useRef, type ReactNode } from "react"
import { useSetAtom } from "jotai"
import { TaskSidePanel } from "@/components/task/task-side-panel"
import { MasterAssistantPanel } from "@/components/assistant/master-assistant-panel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  type ResizablePanelGroupHandle,
} from "@/components/ui/resizable"
import { useIsMobile } from "@/hooks/use-mobile"
import { useAssistantPanel } from "@/hooks/use-assistant-panel"
import { cn } from "@/lib/utils"
import { setViewOptionsAtom } from "@tasktrove/atoms/ui/views"
import {
  SIDE_PANEL_OPEN_WIDTH,
  SIDE_PANEL_WIDTH_MAX,
  SIDE_PANEL_WIDTH_MIN,
} from "@tasktrove/constants"

type SidePanelLayoutProps = {
  children: ReactNode
  /** Optional class applied to the root container */
  rootClassName?: string
  /** Optional class applied to the scrollable content wrapper */
  contentWrapperClassName?: string
  /** When true, applies default horizontal padding to the content wrapper */
  applyContentPadding?: boolean
}

/**
 * Shared layout wrapper that adds the resizable side panel to any task-centric view.
 * The panel shows the open task's details, or the master assistant when no task is open.
 * Centralizing this logic ensures consistent interactions across list, calendar, and kanban views.
 */
export function TaskViewSidePanelLayout({
  children,
  rootClassName,
  contentWrapperClassName,
  applyContentPadding = false,
}: SidePanelLayoutProps) {
  const { isTaskPanelOpen, isAssistantOpen } = useAssistantPanel()
  const setViewOptions = useSetAtom(setViewOptionsAtom)
  const isMobile = useIsMobile()
  const panelGroupRef = useRef<ResizablePanelGroupHandle | null>(null)

  const isPanelOpen = isTaskPanelOpen || isAssistantOpen
  // The panel always opens at a fixed split (list and panel equal); drag-resizing lasts until it closes
  const sidePanelWidth = SIDE_PANEL_OPEN_WIDTH

  // Update panel layout when panel state or width changes (desktop only)
  useEffect(() => {
    if (isMobile) return undefined

    let frame: number | null = null
    const group = panelGroupRef.current
    const hasSetLayout = (group: unknown): group is { setLayout: (sizes: number[]) => void } =>
      group !== null &&
      typeof group === "object" &&
      "setLayout" in group &&
      typeof Reflect.get(group, "setLayout") === "function"

    const groupWithLayout = hasSetLayout(group) ? group : null

    if (!groupWithLayout) {
      return undefined
    }

    frame = window.requestAnimationFrame(() => {
      const mainSize = isPanelOpen ? 100 - sidePanelWidth : 100
      const panelSize = isPanelOpen ? sidePanelWidth : 0
      try {
        groupWithLayout.setLayout([mainSize, panelSize])
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to update side panel layout", error)
        }
      }
    })

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
    }
  }, [isPanelOpen, sidePanelWidth, isMobile])

  const handleClosePanel = useCallback(() => {
    setViewOptions({ showSidePanel: false })
  }, [setViewOptions])

  const renderSidePanel = (variant?: "resizable") => (
    <TaskSidePanel isOpen={isTaskPanelOpen} onClose={handleClosePanel} variant={variant} />
  )

  const contentClasses = cn(
    "flex-1 min-h-0",
    applyContentPadding && "px-2",
    contentWrapperClassName,
  )

  if (isMobile) {
    return (
      <div className={cn("flex flex-1 relative h-full", rootClassName)}>
        <div className={contentClasses}>{children}</div>
        {renderSidePanel()}
      </div>
    )
  }

  const desktopLayout = (
    <div className={cn("flex flex-col h-full overflow-hidden", rootClassName)}>
      <ResizablePanelGroup ref={panelGroupRef} direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel
          defaultSize={isPanelOpen ? 100 - sidePanelWidth : 100}
          minSize={SIDE_PANEL_WIDTH_MIN}
          maxSize={isPanelOpen ? SIDE_PANEL_WIDTH_MAX : 100}
        >
          <div className={cn("h-full", contentClasses)}>{children}</div>
        </ResizablePanel>
        <ResizableHandle withHandle={false} className={cn(!isPanelOpen && "hidden")} />
        <ResizablePanel
          defaultSize={isPanelOpen ? sidePanelWidth : 0}
          minSize={isPanelOpen ? SIDE_PANEL_WIDTH_MIN : 0}
          maxSize={isPanelOpen ? SIDE_PANEL_WIDTH_MAX : 0}
          className={cn(!isPanelOpen && "max-w-0 min-w-0 overflow-hidden")}
        >
          <div className="h-full">
            {isAssistantOpen ? (
              <MasterAssistantPanel />
            ) : isPanelOpen ? (
              renderSidePanel("resizable")
            ) : (
              renderSidePanel()
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )

  return desktopLayout
}
