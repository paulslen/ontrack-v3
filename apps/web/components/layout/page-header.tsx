"use client"

import { useState, type ReactNode } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { dynamicPageInfoAtom, currentRouteContextAtom } from "@tasktrove/atoms/ui/navigation"
import { tasksAtom } from "@tasktrove/atoms/data/base/atoms"
import { completedTasksTodayAtom } from "@tasktrove/atoms/core/tasks"
import { taskListForViewAtom } from "@tasktrove/atoms/ui/task-counts"
import { filteredTasksAtom } from "@tasktrove/atoms/ui/filtered-tasks"
import { openQuickAddAtom, openProjectDialogAtom } from "@tasktrove/atoms/ui/navigation"
import { openSettingsDialogAtom } from "@tasktrove/atoms/ui/dialogs"
import { STANDARD_VIEW_METADATA } from "@tasktrove/constants"

import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/custom/sidebar"
import { Search, PanelRightClose, PanelRightOpen } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { ViewOptionsPopover } from "./view-options-popover"
import { HeaderQuickNav } from "./header-quick-nav"
import { AssistantToggleButton } from "@/components/assistant/assistant-toggle-button"
import { CommandPalette } from "@/components/search/command-palette"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useTranslation } from "@tasktrove/i18n"
import { OnlineStatus } from "@/components/layout/online-status"
import { RewardsBadge } from "@/components/layout/rewards-badge"
import { NotificationsBadge } from "@/components/layout/notifications-badge"
import { FocusTimerDisplay } from "@/components/task/focus-timer-display"

interface PageHeaderProps {
  // Legacy props - to be removed in final cleanup
  onAdvancedSearch?: () => void
  actions?: Array<{
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: "default" | "outline" | "ghost"
  }>
  className?: string
}

export function PageHeader({
  // Legacy props - to be removed in final cleanup
  onAdvancedSearch,
  actions = [],
  className,
}: PageHeaderProps) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)

  // Translation setup
  const { t } = useTranslation("layout")

  // Atom state and actions
  const routeContext = useAtomValue(currentRouteContextAtom)
  const { open: sidebarOpen, toggleSidebar, isMobile } = useSidebar()
  const tasks = useAtomValue(tasksAtom)
  const openQuickAdd = useSetAtom(openQuickAddAtom)
  const openProjectDialog = useSetAtom(openProjectDialogAtom)
  const openSettingsDialog = useSetAtom(openSettingsDialogAtom)

  // Get dynamic page info from atom
  const pageInfo = useAtomValue(dynamicPageInfoAtom)

  // Type guard to check if viewId is a valid standard view key
  const isValidStandardViewId = (viewId: string): viewId is keyof typeof STANDARD_VIEW_METADATA => {
    return viewId in STANDARD_VIEW_METADATA
  }

  // Helper function to get translated page info for standard views
  const getTranslatedPageInfo = () => {
    if (routeContext.routeType === "standard" && routeContext.viewId) {
      const viewIdString = String(routeContext.viewId)
      if (isValidStandardViewId(viewIdString)) {
        const metadata = STANDARD_VIEW_METADATA[viewIdString]
        return {
          title: t(`standardViews.${viewIdString}.title`, metadata.title),
          description: t(`standardViews.${viewIdString}.description`, metadata.description),
        }
      }
    }

    return {
      title: pageInfo.title,
      description: pageInfo.description,
    }
  }

  const translatedPageInfo = getTranslatedPageInfo()

  // Subtitle data: Today shows date + progress, other views show open task count
  const isTodayView = routeContext.routeType === "standard" && routeContext.viewId === "today"
  const completedToday = useAtomValue(completedTasksTodayAtom)
  const todayTasks = useAtomValue(taskListForViewAtom("today"))
  const viewTasks = useAtomValue(filteredTasksAtom)
  const remainingToday = todayTasks.filter((task) => !task.completed).length
  const todayProgress = {
    done: completedToday.length,
    total: completedToday.length + remainingToday,
  }
  const openTaskCount = viewTasks.filter((task) => !task.completed).length

  const subtitle = isTodayView
    ? `${format(new Date(), isMobile ? "EEE, MMM d" : "EEEE, MMMM d")} · ${t("header.progress", "{{done}} of {{total}} done", { done: todayProgress.done, total: todayProgress.total })}`
    : openTaskCount === 1
      ? t("header.taskCountOne", "1 task")
      : t("header.taskCount", "{{count}} tasks", { count: openTaskCount })

  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-primary-soft/85 backdrop-blur-md px-2 sm:px-6 pt-5 pb-3",
        className,
      )}
      data-testid="page-header"
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left Section */}
        <div
          className="flex flex-1 items-start gap-2 sm:gap-3 min-w-0"
          data-testid="page-header-left-section"
        >
          <HeaderIconButton
            label={
              sidebarOpen
                ? t("header.collapseSidebar", "Collapse sidebar")
                : t("header.openSidebar", "Open sidebar")
            }
            onClick={toggleSidebar}
          >
            {sidebarOpen ? <PanelRightOpen /> : <PanelRightClose />}
          </HeaderIconButton>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-4 min-w-0">
              <h1 className="flex shrink-0 items-center gap-2.5 text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight truncate">
                {pageInfo.color && (
                  <span
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: pageInfo.color }}
                    aria-hidden="true"
                  />
                )}
                {translatedPageInfo.title}
              </h1>
              {/* Sidebar collapsed on desktop: the other destinations (Today + labels) sit beside the title */}
              {!sidebarOpen && !isMobile && <HeaderQuickNav />}
            </div>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="truncate" data-testid="page-header-subtitle">
                {subtitle}
              </span>
              {isTodayView && todayProgress.total > 0 && (
                <div
                  className="hidden sm:block h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-foreground/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={todayProgress.total}
                  aria-valuenow={todayProgress.done}
                  aria-label={t("header.progressLabel", "Today's progress")}
                >
                  <div
                    className="h-full rounded-full bg-foreground transition-[width] duration-500"
                    style={{ width: `${(todayProgress.done / todayProgress.total) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Custom Actions */}
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || "outline"}
              size="sm"
              onClick={action.onClick}
            >
              {action.icon}
              {action.label}
            </Button>
          ))}

          <OnlineStatus />
          <RewardsBadge />
          <NotificationsBadge />
          <FocusTimerDisplay />

          <HeaderIconButton
            label={t("header.search", "Search")}
            onClick={() => onAdvancedSearch?.()}
          >
            <Search />
          </HeaderIconButton>

          <ViewOptionsPopover onAdvancedSearch={onAdvancedSearch} />

          <AssistantToggleButton />
        </div>
      </div>

      {/* Mobile: one-tap switch between Today and labels, full header width */}
      {isMobile && <HeaderQuickNav variant="dots" />}

      {/* Command Palette */}
      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        tasks={tasks}
        onQuickAdd={openQuickAdd}
        onAdvancedSearch={onAdvancedSearch}
        onCreateProject={openProjectDialog}
        onSettings={openSettingsDialog}
      />
    </header>
  )
}

interface HeaderIconButtonProps {
  label: string
  onClick: () => void
  children: ReactNode
}

/** Ghost icon button with a tooltip label, sized for the page header */
function HeaderIconButton({ label, onClick, children }: HeaderIconButtonProps) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClick}
          className="cursor-pointer [&_svg]:size-5"
          aria-label={label}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
