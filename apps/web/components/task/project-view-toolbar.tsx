"use client"

import type { ReactNode } from "react"
import { useSetAtom, useAtomValue } from "jotai"
import { Button } from "@/components/ui/button"
import { FolderPlus } from "lucide-react"
import { useTranslation } from "@tasktrove/i18n"
import { TaskFilterBadges } from "./task-filter-badges"
import { InlineTaskComposer } from "./inline-task-composer"
import { openSectionDialogAtom, currentRouteContextAtom } from "@tasktrove/atoms/ui/navigation"
import { selectedTasksAtom } from "@tasktrove/atoms/ui/selection"
import { isValidProjectId } from "@/lib/utils/routing"
import { createProjectId } from "@tasktrove/types/id"
import { cn } from "@/lib/utils"

export type ProjectViewToolbarExtraActions =
  | ReactNode
  | {
      left?: ReactNode
      right?: ReactNode
    }

export interface ProjectViewToolbarProps {
  className?: string
  extraActions?: ProjectViewToolbarExtraActions
}

const isExtraActionsConfig = (
  value: ProjectViewToolbarExtraActions | undefined,
): value is { left?: ReactNode; right?: ReactNode } => {
  return Boolean(value && typeof value === "object" && ("left" in value || "right" in value))
}

/**
 * Unified toolbar for list views: the always-open task composer, add-section (projects only)
 * and active filter badges. Filter and sort live in the View Options popover.
 * Used across different view types (kanban, project sections, etc.) for consistent UI.
 */
export function ProjectViewToolbar({ className, extraActions }: ProjectViewToolbarProps) {
  const { t } = useTranslation("task")
  const openSectionDialog = useSetAtom(openSectionDialogAtom)
  const routeContext = useAtomValue(currentRouteContextAtom)
  const selectedTaskIds = useAtomValue(selectedTasksAtom)

  const isProjectContext =
    routeContext.routeType === "project" && isValidProjectId(routeContext.viewId)
  const projectId = isProjectContext ? createProjectId(routeContext.viewId) : undefined
  const hasSelection = selectedTaskIds.length > 0
  const leftExtraActions = isExtraActionsConfig(extraActions) ? extraActions.left : extraActions
  const rightExtraActions = isExtraActionsConfig(extraActions) ? extraActions.right : null

  const handleAddSection = () => {
    if (projectId) {
      openSectionDialog({ projectId })
    }
  }

  return (
    <div className={cn("sticky z-10 px-2 pt-2 pb-3", hasSelection ? "top-14" : "top-0", className)}>
      <div className="flex items-center gap-2">
        <InlineTaskComposer className="min-w-0 flex-1" />
        {isProjectContext && (
          <Button
            onClick={handleAddSection}
            variant="ghost"
            size="icon"
            className="size-14 rounded-2xl shrink-0 text-muted-foreground"
            aria-label={t("actions.addSection", "Add Section")}
            title={t("actions.addSection", "Add Section")}
          >
            <FolderPlus className="size-5" />
          </Button>
        )}
        {leftExtraActions}
        {rightExtraActions}
      </div>
      <TaskFilterBadges />
    </div>
  )
}
