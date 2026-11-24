"use client"

import React, { useState } from "react"
import { useSetAtom, useAtomValue } from "jotai"
import { useContextMenuVisibility } from "@/hooks/use-context-menu-visibility"
import { TaskCheckbox } from "@/components/ui/custom/task-checkbox"
import { Badge } from "@/components/ui/badge"
import { LinkifiedText } from "@/components/ui/custom/linkified-text"
import { LinkifiedEditableDiv } from "@/components/ui/custom/linkified-editable-div"
import { MarkdownEditableDiv } from "@/components/ui/custom/markdown-editable-div"
import { MaterialCard } from "@/components/ui/custom/material-card"
import { TimeEstimationPopover } from "./time-estimation-popover"
import { FocusTimerPopover } from "./focus-timer-popover"
import { LabelManagementPopover } from "./label-management-popover"
import { TruncatedMetadataText } from "./truncated-metadata-text"
import {
  MessageSquare,
  Flag,
  CheckSquare,
  Folder,
  Tag,
  ClockFading,
  Play,
  Pause,
  Square,
  GripVertical,
  X,
} from "lucide-react"
import { addDays, isToday, isTomorrow } from "date-fns"
import { cn, getContrastColor } from "@/lib/utils"
import { formatTime, getEffectiveEstimation } from "@/lib/utils/time-estimation"
import { getPriorityColor } from "@/lib/color-utils"
import { isPro } from "@/lib/utils/env"
import { useIsMobile } from "@/hooks/use-mobile"
import { TaskSchedulePopover } from "./task-schedule-popover"
import { TaskScheduleTrigger } from "./task-schedule-trigger"
import { CommentManagementPopover } from "./comment-management-popover"
import { SubtaskPopover } from "./subtask-popover"
import { PriorityPopover } from "./priority-popover"
import { ProjectPopover } from "./project-popover"
import { TaskActionsMenu } from "./task-actions-menu"
import { AssigneeManagementPopover } from "@/components/task/assignee-management-popover"
import { AssigneeBadges } from "@/components/task/assignee-badges"
import { deleteTaskAtom, updateTaskAtom, toggleTaskAtom } from "@tasktrove/atoms/core/tasks"
import { tasksAtom, labelsAtom, projectsAtom, settingsAtom } from "@tasktrove/atoms/data/base/atoms"
import { DEFAULT_COLOR_PALETTE } from "@tasktrove/constants"
import {
  startFocusTimerAtom,
  pauseFocusTimerAtom,
  stopFocusTimerAtom,
  isTaskTimerActiveAtom,
} from "@tasktrove/atoms/ui/focus-timer"
import {
  toggleTaskSelectionAtom,
  selectedTasksAtom,
  selectedTaskIdAtom,
  hoveredTaskIdAtom,
} from "@tasktrove/atoms/ui/selection"
import { addCommentAtom } from "@tasktrove/atoms/core/tasks"
import { focusTimerStatusAtom, activeFocusTimerAtom } from "@tasktrove/atoms/ui/focus-timer"
import { addLabelAndWaitForRealIdAtom, labelsFromIdsAtom } from "@tasktrove/atoms/core/labels"
import {
  quickAddTaskAtom,
  updateQuickAddTaskAtom,
  showQuickAddAtom,
} from "@tasktrove/atoms/ui/dialogs"
import { toggleTaskPanelWithViewStateAtom } from "@tasktrove/atoms/ui/views"
import type { Task, Subtask } from "@tasktrove/types/core"
import type { TaskPriority } from "@tasktrove/types/constants"
import type { CreateTaskRequest } from "@tasktrove/types/api-requests"
import type { TaskId, LabelId } from "@tasktrove/types/id"
import { INBOX_PROJECT_ID } from "@tasktrove/types/constants"
import { createTaskId } from "@tasktrove/types/id"
import { TimeEstimationPicker } from "../ui/custom/time-estimation-picker"
import { useTranslation } from "@tasktrove/i18n"
import { useTaskMetadataFlash } from "@/hooks/use-flash-on-change"
import { useTaskMultiSelectClick } from "@/hooks/use-task-multi-select"
import { DeleteConfirmDialog } from "@/components/dialogs/delete-confirm-dialog"
import { RescheduleToggle } from "./reschedule-toggle"
// Helper component for time estimation trigger button
function TimeEstimationTrigger({ task, className }: { task: Task; className?: string }) {
  const { estimation, isFromSubtasks } = getEffectiveEstimation(task)
  const timeText = formatTime(estimation)
  const hasTime = estimation > 0

  return (
    <span
      className={cn(
        "flex items-center gap-1 cursor-pointer hover:bg-accent transition-colors",
        hasTime
          ? "hover:opacity-100 text-foreground"
          : "text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100",
        className,
      )}
    >
      <ClockFading className="h-3 w-3" />
      {hasTime && (
        <span
          className={cn(
            "text-xs font-medium leading-none",
            isFromSubtasks && "border-b border-dotted border-current",
          )}
        >
          {timeText}
        </span>
      )}
    </span>
  )
}

// Helper function to check if focus timer should be shown for a task
function shouldShowFocusTimer(taskId: TaskId, activeTimer: { taskId: TaskId } | null) {
  return !activeTimer || activeTimer.taskId === taskId
}

// Helper component for focus timer trigger button
function FocusTimerTrigger({ taskId, className }: { taskId: TaskId; className?: string }) {
  // Translation setup
  const { t } = useTranslation("task")

  const isTaskTimerActive = useAtomValue(isTaskTimerActiveAtom)
  const timerStatus = useAtomValue(focusTimerStatusAtom)
  const startTimer = useSetAtom(startFocusTimerAtom)
  const pauseTimer = useSetAtom(pauseFocusTimerAtom)
  const stopTimer = useSetAtom(stopFocusTimerAtom)

  const isThisTaskActive = isTaskTimerActive(taskId)
  const isThisTaskRunning = isThisTaskActive && timerStatus === "running"
  const isThisTaskPaused = isThisTaskActive && timerStatus === "paused"

  const handleStartClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    startTimer(taskId)
  }

  const handlePauseResumeClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (isThisTaskRunning) {
      pauseTimer(taskId)
    } else if (isThisTaskPaused) {
      startTimer(taskId)
    }
  }

  const handleStopClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    stopTimer(taskId)
  }

  if (!isThisTaskActive) {
    // Show single start button when not active
    return (
      <span
        onClick={handleStartClick}
        className={cn(
          "flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-70 hover:opacity-100",
          className,
        )}
        title={t("focusTimer.start", "Start focus timer")}
      >
        <Play className="h-3 w-3" />
      </span>
    )
  }

  // Show both stop and play/pause buttons when active
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <span
        onClick={handlePauseResumeClick}
        className={cn(
          "cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
        )}
        title={
          isThisTaskRunning
            ? t("focusTimer.pause", "Pause timer")
            : t("focusTimer.resume", "Resume timer")
        }
      >
        {isThisTaskRunning ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      </span>
      <span
        onClick={handleStopClick}
        className="cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-red-500"
        title={t("focusTimer.stop", "Stop timer")}
      >
        <Square className="h-3 w-3" />
      </span>
    </div>
  )
}

interface TaskItemProps {
  taskId: TaskId
  className?: string
  showProjectBadge?: boolean
  variant?: "default" | "compact" | "minimal" | "kanban" | "narrow" | "calendar" | "subtask"
  compactTitleEditable?: boolean
  actions?: {
    menu?: "visible" | "context" | "none"
    deleteButton?: boolean
  }
  // Subtask-specific props
  parentTask?: Task | CreateTaskRequest // Parent task for subtask operations - can be CreateTaskRequest in quick-add
  // Range selection props
  sortedTaskIds?: TaskId[] // Array of task IDs in display order for range selection
}

export function TaskItem({
  taskId,
  className,
  showProjectBadge = true,
  variant = "default",
  compactTitleEditable = false,
  actions,
  // Subtask-specific props
  parentTask,
  sortedTaskIds,
}: TaskItemProps) {
  // Translation setup
  const { t } = useTranslation("task")

  const [isHovered, setIsHovered] = useState(false)
  // Compact variant specific state
  const [labelsExpanded, setLabelsExpanded] = useState(false)
  const [isDescriptionEditing, setIsDescriptionEditing] = useState(false)
  const [isTitleEditing, setIsTitleEditing] = useState(false)
  // Subtask estimation picker state
  const [showEstimationPicker, setShowEstimationPicker] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Mobile detection
  const isMobile = useIsMobile()

  // Get task data from atoms - MUST be called before any conditional returns
  const allTasks = useAtomValue(tasksAtom)
  const selectedTasks = useAtomValue(selectedTasksAtom)
  const allLabels = useAtomValue(labelsAtom)
  const getLabelsFromIds = useAtomValue(labelsFromIdsAtom)
  const allProjects = useAtomValue(projectsAtom)
  const selectedTaskId = useAtomValue(selectedTaskIdAtom)
  const hoveredTaskId = useAtomValue(hoveredTaskIdAtom)
  const activeFocusTimer = useAtomValue(activeFocusTimerAtom)
  const settings = useAtomValue(settingsAtom)

  // Atom actions
  const toggleTask = useSetAtom(toggleTaskAtom)
  const startFocusTimer = useSetAtom(startFocusTimerAtom)
  const deleteTask = useSetAtom(deleteTaskAtom)
  const updateTask = useSetAtom(updateTaskAtom)
  const addComment = useSetAtom(addCommentAtom)
  const toggleTaskPanel = useSetAtom(toggleTaskPanelWithViewStateAtom)
  const toggleTaskSelection = useSetAtom(toggleTaskSelectionAtom)
  const setHoveredTaskId = useSetAtom(hoveredTaskIdAtom)
  const handleMultiSelectClick = useTaskMultiSelectClick()
  const addLabelAndWaitForRealId = useSetAtom(addLabelAndWaitForRealIdAtom)

  // Quick-add atoms for subtask handling in new tasks
  const quickAddTask = useAtomValue(quickAddTaskAtom)
  const updateQuickAddTask = useSetAtom(updateQuickAddTaskAtom)
  const setShowQuickAdd = useSetAtom(showQuickAddAtom)

  // Find the task after getting all atoms
  let task = allTasks.find((t: Task) => t.id === taskId)

  // Special handling for subtasks - if not found in main tasks atom but variant is subtask
  if (!task && variant === "subtask") {
    // Get parent task from either prop or quick-add atom
    const parent = parentTask || quickAddTask
    const subtask = parent.subtasks?.find((s) => String(s.id) === String(taskId))
    if (subtask) {
      // Convert Subtask to Task-like object for rendering
      task = {
        id: createTaskId(String(subtask.id)), // Convert SubtaskId to TaskId for rendering
        title: subtask.title,
        completed: subtask.completed,
        description: "",
        priority: 4 satisfies TaskPriority,
        dueDate: undefined,
        projectId: INBOX_PROJECT_ID,
        labels: [],
        subtasks: [],
        comments: [],
        createdAt: new Date(),
        recurringMode: "dueDate",
        estimation: subtask.estimation, // Include estimation from subtask
      }
    }
  }

  // Derived state from atoms
  const isSelected = selectedTaskId === taskId
  const isInSelection = selectedTasks.includes(taskId)
  const shouldShowHoverHighlight = hoveredTaskId === taskId && !(isSelected || isInSelection)

  // Context menu visibility with flicker prevention
  const { isMenuOpen: actionsMenuOpen, handleMenuOpenChange: handleActionsMenuChange } =
    useContextMenuVisibility(isHovered, isSelected)

  // Flash metadata badges when values change
  const getFlashClass = useTaskMetadataFlash(task)

  // Early return if task not found - AFTER all hooks are called
  if (!task) {
    console.warn(`TaskItem: Task with id ${taskId} not found`)
    return null
  }

  const handleTaskMouseEnter = () => {
    setIsHovered(true)
    setHoveredTaskId(task.id)
  }

  const handleTaskMouseLeave = () => {
    setIsHovered(false)
    setHoveredTaskId(null)
  }

  // Get project information for this task
  const getTaskProject = () => {
    if (!task.projectId || !allProjects.length) return null
    return allProjects.find((project) => project.id === task.projectId) || null
  }

  const taskProject = getTaskProject()
  const isArchived = Boolean(task.archived)
  const isCompleted = task.completed
  const menuMode =
    actions?.menu ??
    (variant === "minimal" ? "context" : variant === "calendar" ? "none" : "visible")
  const shouldShowActionsMenu = menuMode !== "none"
  const hasEstimation = getEffectiveEstimation(task).estimation > 0
  const isThisTaskTimerActive = activeFocusTimer?.taskId === task.id
  const shouldShowDeleteButton = actions?.deleteButton ?? variant === "minimal"

  const handleArchiveToggle = (archived: boolean) => {
    updateTask({ updateRequest: { id: task.id, archived } })
  }

  // Helper function to update subtasks in the appropriate context (existing task vs quick-add)
  const updateSubtasks = (updatedSubtasks: Subtask[]) => {
    if (parentTask && "id" in parentTask) {
      // Existing task - update global state
      updateTask({ updateRequest: { id: parentTask.id, subtasks: updatedSubtasks } })
    } else {
      // Quick-add context - update quick-add atom
      updateQuickAddTask({ updateRequest: { subtasks: updatedSubtasks } })
    }
  }

  // Subtask handlers for isSubTask={true}
  const handleSubtaskToggle = () => {
    if (variant !== "subtask") return

    const parent = parentTask || quickAddTask
    if (!parent.subtasks) return

    const updatedSubtasks = parent.subtasks.map((subtask) =>
      String(subtask.id) === String(task.id)
        ? { ...subtask, completed: !subtask.completed }
        : subtask,
    )

    updateSubtasks(updatedSubtasks)
  }

  const handleSubtaskDelete = () => {
    if (variant !== "subtask") return

    const parent = parentTask || quickAddTask
    if (!parent.subtasks) return

    const updatedSubtasks = parent.subtasks.filter(
      (subtask) => String(subtask.id) !== String(task.id),
    )

    updateSubtasks(updatedSubtasks)
  }

  const handleSubtaskTitleUpdate = (newTitle: string) => {
    if (variant !== "subtask") return

    const parent = parentTask || quickAddTask
    if (!parent.subtasks) return

    const updatedSubtasks = parent.subtasks.map((subtask) =>
      String(subtask.id) === String(task.id) ? { ...subtask, title: newTitle.trim() } : subtask,
    )

    updateSubtasks(updatedSubtasks)
  }

  const handleSubtaskEstimationUpdate = (estimation: number | null) => {
    if (variant !== "subtask") return

    const parent = parentTask || quickAddTask
    if (!parent.subtasks) return

    const updatedSubtasks = parent.subtasks.map((subtask) =>
      String(subtask.id) === String(task.id)
        ? { ...subtask, estimation: estimation && estimation > 0 ? estimation : undefined }
        : subtask,
    )

    updateSubtasks(updatedSubtasks)
  }

  const handleEstimationMenuClick = () => {
    setShowEstimationPicker(true)
  }

  const handleConvertToTask = () => {
    if (variant !== "subtask") return

    // For subtasks, we need the parent task
    const parent = parentTask
    if (!parent) return

    // Only use parent task data if it's a real Task (not CreateTaskRequest)
    const realParentTask = "id" in parent ? parent : undefined

    // Update the quick add task atom with subtask conversion data
    const convertData: CreateTaskRequest = {
      title: task.title,
      priority: realParentTask?.priority,
      dueDate: realParentTask?.dueDate,
      dueTime: realParentTask?.dueTime,
      projectId: realParentTask?.projectId,
      labels: realParentTask?.labels ? [...realParentTask.labels] : [],
      recurring: realParentTask?.recurring,
      estimation: task.estimation, // Use subtask's estimation
    }

    updateQuickAddTask({ updateRequest: convertData })
    setShowQuickAdd(true)
  }

  const shouldShowPriority = variant === "compact" && task.priority < 4

  const handleTaskClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on buttons or interactive elements
    const target = e.target
    if (!(target instanceof HTMLElement)) {
      return
    }

    const currentTarget = e.currentTarget
    const roleButtonAncestor = target.closest('[role="button"]')
    const isInternalRoleButton = Boolean(
      roleButtonAncestor &&
        currentTarget.contains(roleButtonAncestor) &&
        roleButtonAncestor !== currentTarget,
    )

    const dialogAncestor = target.closest('[role="dialog"]')
    const popoverTrigger = target.closest('[data-slot="popover-trigger"]')

    if (
      target.closest("button") ||
      target.closest("[data-action]") ||
      isInternalRoleButton ||
      target.closest("input") ||
      target.closest("select") ||
      target.closest("textarea") ||
      // popover elements (allow minimal rows inside popovers)
      (variant !== "minimal" && dialogAncestor) ||
      popoverTrigger
    ) {
      return
    }

    if (variant === "minimal") {
      toggleTaskPanel(task)
      return
    }

    if (handleMultiSelectClick({ taskId, sortedTaskIds, event: e })) {
      return
    }

    // Regular click - open task panel
    toggleTaskPanel(task)
  }

  const handleAddLabel = async (labelName?: string) => {
    if (labelName) {
      // Check if label exists in the system
      const existingLabel = allLabels.find(
        (label) => label.name.toLowerCase() === labelName.toLowerCase(),
      )

      let labelId: LabelId | undefined
      if (!existingLabel) {
        // Create new label with a default color
        const randomColor =
          DEFAULT_COLOR_PALETTE[Math.floor(Math.random() * DEFAULT_COLOR_PALETTE.length)]

        // Wait for the real label ID from the server
        labelId = await addLabelAndWaitForRealId({
          name: labelName,
          color: randomColor,
        })
      } else {
        labelId = existingLabel.id
      }

      // Guard against undefined labelId
      if (!labelId) return

      // Add label ID to task if not already present
      if (!task.labels.includes(labelId)) {
        const updatedLabels = [...task.labels, labelId]
        updateTask({ updateRequest: { id: task.id, labels: updatedLabels } })
      }
    }
  }

  const handleRemoveLabel = (labelIdToRemove: LabelId) => {
    const updatedLabels = task.labels.filter((labelId: LabelId) => labelId !== labelIdToRemove)
    updateTask({ updateRequest: { id: task.id, labels: updatedLabels } })
  }

  const handleTaskContextMenu = (event: React.MouseEvent) => {
    if (!shouldShowActionsMenu) return
    if (isTitleEditing || isDescriptionEditing) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (target.closest("input, textarea, select, [contenteditable='true']")) return

    event.preventDefault()
    event.stopPropagation()
    handleActionsMenuChange(true)
  }

  if (variant === "minimal") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 py-2 rounded text-sm transition-all duration-200 cursor-pointer",
          "hover:bg-accent/50",
          shouldShowHoverHighlight && "bg-accent/50",
          isCompleted && "opacity-60",
          className,
        )}
        onClick={handleTaskClick}
        onContextMenu={handleTaskContextMenu}
        onMouseEnter={handleTaskMouseEnter}
        onMouseLeave={handleTaskMouseLeave}
        data-task-id={task.id}
      >
        <TaskCheckbox
          checked={task.completed}
          onCheckedChange={() => toggleTask(task.id)}
          priority={task.priority}
          data-action="toggle"
        />
        <span className={cn("truncate flex-1", task.completed && "line-through")}>
          {task.title}
        </span>
        <div className="ml-auto flex items-center gap-1 relative">
          {(task.dueDate || task.recurring) && (
            <TaskSchedulePopover taskId={task.id}>
              <TaskScheduleTrigger
                dueDate={task.dueDate}
                dueTime={task.dueTime}
                recurring={task.recurring}
                recurringMode={task.recurringMode}
                completed={task.completed}
                variant="compact"
                className="flex-shrink-0"
              />
            </TaskSchedulePopover>
          )}
          {shouldShowActionsMenu && (
            <TaskActionsMenu
              task={task}
              isVisible={menuMode === "visible"}
              hideTrigger={menuMode === "context"}
              onDeleteClick={() => deleteTask(task.id)}
              onSelectClick={() => toggleTaskSelection(taskId)}
              onArchiveToggle={handleArchiveToggle}
              isSubTask={false}
              open={actionsMenuOpen}
              onOpenChange={handleActionsMenuChange}
            />
          )}
          {shouldShowDeleteButton && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setShowDeleteConfirm(true)
                }}
                aria-label={t("actions.delete", "Delete")}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-destructive hover:text-destructive/90 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                data-action="delete"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <DeleteConfirmDialog
                open={showDeleteConfirm}
                onOpenChange={setShowDeleteConfirm}
                onConfirm={() => {
                  deleteTask(task.id)
                  setShowDeleteConfirm(false)
                }}
                entityType="task"
                entityName={task.title}
              />
            </>
          )}
        </div>
      </div>
    )
  }

  // Compact variant render - only on non-mobile devices
  if (variant === "compact" && !isMobile) {
    return (
      <MaterialCard
        variant="compact"
        selected={isSelected || isInSelection}
        completed={isCompleted}
        archived={isArchived}
        leftBorderColor={getPriorityColor(task.priority, "compact")}
        onClick={handleTaskClick}
        onContextMenu={handleTaskContextMenu}
        onMouseEnter={handleTaskMouseEnter}
        onMouseLeave={handleTaskMouseLeave}
        className={cn("group/task", shouldShowHoverHighlight && "bg-accent/50", className)}
        data-task-focused={isSelected}
        data-task-id={task.id}
      >
        <div className="p-2">
          {/* Single row layout - simplified for non-mobile only */}
          <div className="flex items-center gap-2 min-w-0">
            {/* Task Completion Checkbox */}
            <TaskCheckbox
              checked={task.completed}
              onCheckedChange={() => toggleTask(task.id)}
              data-action="toggle"
            />

            {/* Title */}
            <div className="flex-1 min-w-0 max-w-full">
              {compactTitleEditable ? (
                <LinkifiedEditableDiv
                  as="span"
                  value={task.title}
                  onChange={(newTitle) => {
                    if (newTitle.trim() && newTitle !== task.title) {
                      updateTask({ updateRequest: { id: task.id, title: newTitle.trim() } })
                    }
                  }}
                  onEditingChange={setIsTitleEditing}
                  className={cn(
                    "text-sm inline-block w-fit max-w-full min-w-0 break-all",
                    !isTitleEditing && "line-clamp-1",
                    cn(
                      isCompleted && "line-through text-muted-foreground",
                      !isCompleted && isArchived && "text-muted-foreground",
                      !isCompleted && !isArchived && "text-foreground",
                    ),
                  )}
                  data-action="edit"
                  allowEmpty={false}
                />
              ) : (
                <LinkifiedText
                  as="span"
                  className={cn(
                    "text-sm block w-full min-w-0 break-all line-clamp-1",
                    isCompleted && "line-through text-muted-foreground",
                    !isCompleted && isArchived && "text-muted-foreground",
                    !isArchived && !isCompleted && "text-foreground",
                  )}
                >
                  {task.title}
                </LinkifiedText>
              )}
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2 text-xs flex-shrink-0">
              <div className="flex items-center gap-1">
                {/* Due Date/Recurring */}
                <TaskSchedulePopover taskId={task.id}>
                  <TaskScheduleTrigger
                    dueDate={task.dueDate}
                    dueTime={task.dueTime}
                    recurring={task.recurring}
                    recurringMode={task.recurringMode}
                    completed={isCompleted}
                    variant="compact"
                  />
                </TaskSchedulePopover>

                {/* Priority Flag */}
                {shouldShowPriority ? (
                  <PriorityPopover task={task}>
                    <Flag
                      className={cn(
                        "h-3 w-3 flex-shrink-0 cursor-pointer hover:bg-accent transition-colors hover:opacity-100",
                        task.priority === 1
                          ? "text-red-500"
                          : task.priority === 2
                            ? "text-orange-500"
                            : "text-blue-500",
                      )}
                    />
                  </PriorityPopover>
                ) : (
                  <PriorityPopover task={task}>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0 cursor-pointer hover:text-foreground hover:bg-accent transition-colors opacity-70 hover:opacity-100">
                      <Flag className="h-3 w-3" />
                    </span>
                  </PriorityPopover>
                )}

                {/* Subtasks */}
                <SubtaskPopover task={task}>
                  <span className="flex items-center gap-1 cursor-pointer hover:text-foreground hover:bg-accent transition-colors">
                    <CheckSquare className="h-3 w-3" />
                    {task.subtasks.length > 0 && (
                      <>
                        {task.subtasks.filter((s: Subtask) => s.completed).length}/
                        {task.subtasks.length}
                      </>
                    )}
                  </span>
                </SubtaskPopover>

                {/* Comments */}
                <CommentManagementPopover
                  task={task}
                  onAddComment={(content) => addComment({ taskId: task.id, content })}
                >
                  <span className="flex items-center gap-1 cursor-pointer hover:text-foreground hover:bg-accent transition-colors">
                    <MessageSquare className="h-3 w-3" />
                    {task.comments.length > 0 && task.comments.length}
                  </span>
                </CommentManagementPopover>
              </div>

              <div className="flex items-center gap-1">
                {/* Labels */}
                {task.labels.length > 0 && (
                  <LabelManagementPopover
                    task={task}
                    onAddLabel={handleAddLabel}
                    onRemoveLabel={handleRemoveLabel}
                  >
                    <div className="flex items-center gap-1 cursor-pointer hover:bg-accent transition-colors">
                      {getLabelsFromIds(task.labels)
                        .slice(0, labelsExpanded ? task.labels.length : 1)
                        .map((label) => (
                          <Badge
                            key={label.id}
                            variant="secondary"
                            className="text-xs px-1 py-0 h-4 hover:opacity-100"
                            style={{
                              backgroundColor: label.color,
                              color: getContrastColor(label.color),
                              border: "none",
                            }}
                            title={label.name}
                          >
                            {label.name.slice(0, 2)}
                          </Badge>
                        ))}
                      {task.labels.length > 1 && !labelsExpanded && (
                        <Badge
                          variant="outline"
                          className="text-xs px-1 py-0 h-4 cursor-pointer hover:bg-accent transition-colors"
                          title={`+${task.labels.length - 1} more labels`}
                          data-action="labels"
                          onClick={(e) => {
                            e.stopPropagation()
                            setLabelsExpanded(true)
                          }}
                        >
                          +{task.labels.length - 1}
                        </Badge>
                      )}
                    </div>
                  </LabelManagementPopover>
                )}

                {task.labels.length === 0 && (
                  <LabelManagementPopover
                    task={task}
                    onAddLabel={handleAddLabel}
                    onRemoveLabel={handleRemoveLabel}
                  >
                    <span className="flex items-center gap-1 cursor-pointer hover:text-foreground hover:bg-accent transition-colors opacity-70 hover:opacity-100">
                      <Tag className="h-3 w-3" />
                    </span>
                  </LabelManagementPopover>
                )}

                {/* Project Badge */}
                {showProjectBadge && (taskProject || allProjects.length > 0) && (
                  <ProjectPopover task={task}>
                    <span
                      className={cn(
                        "flex items-center cursor-pointer hover:bg-accent transition-colors",
                        taskProject
                          ? "hover:opacity-100"
                          : "text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100",
                      )}
                      style={taskProject ? { color: taskProject.color } : undefined}
                    >
                      <Folder className="h-3 w-3" />
                    </span>
                  </ProjectPopover>
                )}

                {showProjectBadge && !taskProject && allProjects.length === 0 && (
                  <span className="invisible flex items-center">
                    <Folder className="h-3 w-3" />
                  </span>
                )}

                {/* Assignees */}
                {isPro() && (
                  <span className="flex items-center gap-1 cursor-pointer hover:text-foreground hover:bg-accent transition-colors opacity-70 hover:opacity-100">
                    <AssigneeManagementPopover task={task}>
                      <AssigneeBadges task={task} />
                    </AssigneeManagementPopover>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Timer */}
                <TimeEstimationPopover taskId={task.id}>
                  <TimeEstimationTrigger task={task} />
                </TimeEstimationPopover>

                {shouldShowFocusTimer(task.id, activeFocusTimer) && (
                  <FocusTimerPopover taskId={task.id}>
                    <FocusTimerTrigger taskId={task.id} />
                  </FocusTimerPopover>
                )}

                {/* Actions Menu */}
                {shouldShowActionsMenu && (
                  <TaskActionsMenu
                    task={task}
                    isVisible={true}
                    onDeleteClick={() => deleteTask(task.id)}
                    onSelectClick={() => toggleTaskSelection(taskId)}
                    onArchiveToggle={handleArchiveToggle}
                    isSubTask={false}
                    open={actionsMenuOpen}
                    onOpenChange={handleActionsMenuChange}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </MaterialCard>
    )
  }

  // Narrow variant render
  if (variant === "narrow") {
    const taskLabels = getLabelsFromIds(task.labels)

    return (
      <MaterialCard
        variant="narrow"
        selected={isSelected || isInSelection}
        completed={isCompleted}
        archived={isArchived}
        onClick={handleTaskClick}
        onContextMenu={handleTaskContextMenu}
        onMouseEnter={handleTaskMouseEnter}
        onMouseLeave={handleTaskMouseLeave}
        className={cn("group/task", shouldShowHoverHighlight && "bg-accent/50", className)}
        data-task-focused={isSelected}
        data-task-id={task.id}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <TaskCheckbox
              checked={task.completed}
              onCheckedChange={() => toggleTask(task.id)}
              className="mt-0.5"
              data-action="toggle"
              priority={task.priority}
            />
            <LinkifiedEditableDiv
              as="h4"
              value={task.title}
              onChange={(newTitle) =>
                updateTask({ updateRequest: { id: task.id, title: newTitle } })
              }
              className={cn(
                "font-medium text-sm text-foreground line-clamp-2 inline-block max-w-full",
                isCompleted && "line-through text-muted-foreground",
                !isCompleted && isArchived && "text-muted-foreground",
              )}
              placeholder={t("placeholders.taskTitle", "Enter task title...")}
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 text-xs text-muted-foreground">
            <TimeEstimationPopover taskId={task.id}>
              <TimeEstimationTrigger task={task} />
            </TimeEstimationPopover>
            {shouldShowFocusTimer(task.id, activeFocusTimer) && (
              <FocusTimerPopover taskId={task.id}>
                <FocusTimerTrigger taskId={task.id} />
              </FocusTimerPopover>
            )}
            {shouldShowActionsMenu && (
              <TaskActionsMenu
                task={task}
                isVisible={true}
                onDeleteClick={() => deleteTask(task.id)}
                onSelectClick={() => toggleTaskSelection(taskId)}
                onArchiveToggle={handleArchiveToggle}
                isSubTask={false}
                open={actionsMenuOpen}
                onOpenChange={handleActionsMenuChange}
              />
            )}
          </div>
        </div>

        <div className="mb-2">
          <MarkdownEditableDiv
            as="p"
            value={task.description || ""}
            onChange={(newDescription: string) => {
              updateTask({ updateRequest: { id: task.id, description: newDescription } })
            }}
            placeholder={t("placeholders.addDescription", "Add description...")}
            className={cn(
              "text-xs hover:bg-accent min-w-48 max-w-sm",
              task.description
                ? "text-muted-foreground"
                : !isDescriptionEditing
                  ? "text-muted-foreground/60 italic"
                  : "text-muted-foreground",
              !task.description && !isHovered && "invisible",
              task.description && !isDescriptionEditing && "line-clamp-2",
            )}
            editingClassName="max-h-20 overflow-y-auto"
            data-action="edit"
            multiline={true}
            allowEmpty={true}
            onEditingChange={setIsDescriptionEditing}
            markdownEnabled={settings.general.markdownEnabled}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex flex-wrap gap-3 flex-1 min-w-0 items-center">
            <TaskScheduleTrigger
              dueDate={task.dueDate}
              dueTime={task.dueTime}
              recurring={task.recurring}
              recurringMode={task.recurringMode}
              completed={isCompleted}
            />
            {task.priority < 4 ? (
              <Flag className={cn("h-3 w-3", getPriorityColor(task.priority))} />
            ) : (
              <Flag className="h-3 w-3 text-muted-foreground" />
            )}
            {task.subtasks.length > 0 ? (
              <span className="flex items-center gap-1 text-foreground">
                <CheckSquare className="h-3 w-3" />
                {task.subtasks.filter((s: Subtask) => s.completed).length}/{task.subtasks.length}
              </span>
            ) : (
              <span className="flex items-center text-muted-foreground">
                <CheckSquare className="h-3 w-3" />
              </span>
            )}
            {task.comments.length > 0 ? (
              <span className="flex items-center gap-1 text-foreground">
                <MessageSquare className="h-3 w-3" />
                {task.comments.length}
              </span>
            ) : (
              <span className="flex items-center text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-muted-foreground flex-shrink-0">
            {taskLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {taskLabels.map((label) => (
                  <span
                    key={label.id}
                    className="px-1.5 py-0.5 rounded text-xs flex items-center gap-1"
                    style={{
                      backgroundColor: label.color,
                      color: getContrastColor(label.color),
                    }}
                  >
                    <Tag className="h-3 w-3" />
                    {label.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
              </span>
            )}

            {showProjectBadge && (taskProject || allProjects.length > 0) && (
              <span
                className={cn("flex items-center", taskProject ? "text-foreground" : undefined)}
                style={taskProject ? { color: taskProject.color } : undefined}
              >
                <Folder className="h-3 w-3" />
              </span>
            )}

            {isPro() && <AssigneeBadges task={task} />}
          </div>
        </div>
      </MaterialCard>
    )
  }

  // Kanban variant render
  if (variant === "kanban") {
    const taskLabels = getLabelsFromIds(task.labels)
    const leftBorderColor = getPriorityColor(task.priority, "kanban")

    return (
      <MaterialCard
        variant={variant}
        selected={isSelected || isInSelection}
        completed={isCompleted}
        archived={isArchived}
        leftBorderColor={leftBorderColor}
        onClick={handleTaskClick}
        onContextMenu={handleTaskContextMenu}
        onMouseEnter={handleTaskMouseEnter}
        onMouseLeave={handleTaskMouseLeave}
        className={cn("group/task", shouldShowHoverHighlight && "bg-accent/50", className)}
        data-task-focused={isSelected}
        data-task-id={task.id}
      >
        {/* Header with title, priority, and key metadata */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {/* Task Completion Checkbox */}
            <TaskCheckbox
              checked={task.completed}
              onCheckedChange={() => toggleTask(task.id)}
              className="mt-0.5"
              data-action="toggle"
            />

            {/* Title (aligned with default variant behavior) */}
            <LinkifiedEditableDiv
              as="h3"
              value={task.title}
              onChange={(newTitle) => {
                if (newTitle.trim() && newTitle !== task.title) {
                  updateTask({ updateRequest: { id: task.id, title: newTitle.trim() } })
                }
              }}
              onEditingChange={setIsTitleEditing}
              className={cn(
                "font-medium text-sm sm:text-[15px] leading-5 w-fit",
                "max-w-full",
                !isTitleEditing && "line-clamp-2 break-all",
                cn(
                  isCompleted && "line-through text-muted-foreground",
                  !isCompleted && isArchived && "text-muted-foreground",
                  !isCompleted && !isArchived && "text-foreground",
                ),
              )}
              data-action="edit"
              allowEmpty={false}
              placeholder={t("placeholders.taskTitle", "Enter task title...")}
            />
          </div>

          {/* Right side metadata - timer and actions only */}
          <div className="flex items-center gap-2 flex-shrink-0 text-xs text-muted-foreground">
            {/* Timer and Actions */}
            <TimeEstimationPopover taskId={task.id}>
              <TimeEstimationTrigger task={task} />
            </TimeEstimationPopover>
            {shouldShowFocusTimer(task.id, activeFocusTimer) && (
              <FocusTimerPopover taskId={task.id}>
                <FocusTimerTrigger taskId={task.id} />
              </FocusTimerPopover>
            )}
            {shouldShowActionsMenu && (
              <TaskActionsMenu
                task={task}
                isVisible={true}
                onDeleteClick={() => deleteTask(task.id)}
                onSelectClick={() => toggleTaskSelection(taskId)}
                onArchiveToggle={handleArchiveToggle}
                isSubTask={false}
                open={actionsMenuOpen}
                onOpenChange={handleActionsMenuChange}
              />
            )}
          </div>
        </div>

        {/* Description - editable */}
        <div className="mb-2">
          <MarkdownEditableDiv
            as="p"
            value={task.description || ""}
            onChange={(newDescription: string) => {
              updateTask({ updateRequest: { id: task.id, description: newDescription } })
            }}
            placeholder={t("placeholders.addDescription", "Add description...")}
            className={cn(
              "text-xs hover:bg-accent min-w-48 max-w-sm",
              task.description
                ? "text-muted-foreground"
                : !isDescriptionEditing
                  ? "text-muted-foreground/60 italic"
                  : "text-muted-foreground",
              // Only show when there's content or when hovering
              !task.description && !isHovered && "invisible",
              // Apply line-clamp when description exists and not editing
              task.description && !isDescriptionEditing && "line-clamp-2",
            )}
            editingClassName="max-h-20 overflow-y-auto"
            data-action="edit"
            multiline={true}
            allowEmpty={true}
            onEditingChange={setIsDescriptionEditing}
            markdownEnabled={settings.general.markdownEnabled}
          />
        </div>

        {/* Bottom row with labels on left and metadata on right */}
        <div className="flex items-center justify-between">
          {/* Left side - Schedule, priority, labels and assignees */}
          <div className="flex flex-wrap gap-3 flex-1 min-w-0 items-center text-xs">
            {/* Due date/recurring - show if present */}
            <TaskSchedulePopover taskId={task.id}>
              <TaskScheduleTrigger
                dueDate={task.dueDate}
                dueTime={task.dueTime}
                recurring={task.recurring}
                recurringMode={task.recurringMode}
                completed={isCompleted}
              />
            </TaskSchedulePopover>

            {/* Priority flag */}
            {task.priority < 4 ? (
              <PriorityPopover task={task}>
                <Flag
                  className={cn(
                    "h-3 w-3 cursor-pointer hover:bg-accent transition-colors hover:opacity-100",
                    getPriorityColor(task.priority),
                  )}
                />
              </PriorityPopover>
            ) : (
              <PriorityPopover task={task}>
                <span className="flex items-center opacity-70 hover:opacity-100">
                  <Flag className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" />
                </span>
              </PriorityPopover>
            )}

            {/* Subtasks - show if present or on hover */}
            {task.subtasks.length > 0 ? (
              <SubtaskPopover task={task}>
                <span className="flex items-center gap-1 cursor-pointer hover:bg-accent transition-colors hover:opacity-100 text-foreground">
                  <CheckSquare className="h-3 w-3" />
                  {task.subtasks.filter((s: Subtask) => s.completed).length}/{task.subtasks.length}
                </span>
              </SubtaskPopover>
            ) : (
              <SubtaskPopover task={task}>
                <span className="flex items-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-70 hover:opacity-100">
                  <CheckSquare className="h-3 w-3" />
                </span>
              </SubtaskPopover>
            )}

            {/* Comments - show if present or on hover */}
            {task.comments.length > 0 ? (
              <CommentManagementPopover
                task={task}
                onAddComment={(content) => addComment({ taskId: task.id, content })}
              >
                <span className="flex items-center gap-1 cursor-pointer hover:opacity-100 text-foreground hover:bg-accent transition-colors">
                  <MessageSquare className="h-3 w-3" />
                  {task.comments.length}
                </span>
              </CommentManagementPopover>
            ) : (
              <CommentManagementPopover
                task={task}
                onAddComment={(content) => addComment({ taskId: task.id, content })}
              >
                <span className="flex items-center cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-70 hover:opacity-100">
                  <MessageSquare className="h-3 w-3" />
                </span>
              </CommentManagementPopover>
            )}

            {/* Attachments feature removed */}
          </div>

          {/* Right side - Labels, project, and assignees */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground flex-shrink-0">
            {taskLabels.length > 0 ? (
              <>
                {taskLabels.slice(0, 1).map((label) => (
                  <LabelManagementPopover
                    key={label.id}
                    task={task}
                    onAddLabel={handleAddLabel}
                    onRemoveLabel={handleRemoveLabel}
                    className="flex items-center"
                  >
                    <span
                      key={label.id}
                      className="px-1.5 py-0.5 rounded text-xs flex items-center gap-1 hover:bg-accent transition-colors hover:opacity-100 cursor-pointer"
                      style={{
                        backgroundColor: label.color,
                        color: getContrastColor(label.color),
                      }}
                    >
                      <Tag className="h-3 w-3" />
                      {label.name}
                    </span>
                  </LabelManagementPopover>
                ))}
                {taskLabels.length > 1 && (
                  <LabelManagementPopover
                    task={task}
                    onAddLabel={handleAddLabel}
                    onRemoveLabel={handleRemoveLabel}
                    className="flex items-center"
                  >
                    <Badge
                      variant="outline"
                      className="text-xs px-1.5 py-0.5 cursor-pointer hover:bg-accent transition-colors hover:opacity-100"
                    >
                      +{taskLabels.length - 1}
                    </Badge>
                  </LabelManagementPopover>
                )}
              </>
            ) : (
              <LabelManagementPopover
                task={task}
                onAddLabel={handleAddLabel}
                onRemoveLabel={handleRemoveLabel}
                className="flex items-center"
              >
                <span className="group flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-70 hover:opacity-100">
                  <Tag className="h-3 w-3" />
                </span>
              </LabelManagementPopover>
            )}

            {showProjectBadge && (taskProject || allProjects.length > 0) && (
              <ProjectPopover task={task}>
                <span
                  className={cn(
                    "flex items-center cursor-pointer hover:bg-accent transition-colors",
                    taskProject
                      ? "hover:opacity-100"
                      : "text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100",
                  )}
                  style={taskProject ? { color: taskProject.color } : undefined}
                >
                  <Folder className="h-3 w-3" />
                </span>
              </ProjectPopover>
            )}
            {showProjectBadge && !taskProject && allProjects.length === 0 && (
              <span className="invisible flex items-center">
                <Folder className="h-3 w-3" />
              </span>
            )}
            {isPro() && (
              <AssigneeManagementPopover
                task={task}
                className="group flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-70 hover:opacity-100"
              >
                <AssigneeBadges task={task} />
              </AssigneeManagementPopover>
            )}
          </div>
        </div>
      </MaterialCard>
    )
  }

  // Calendar variant render - minimal layout for calendar days
  if (variant === "calendar") {
    return (
      <MaterialCard
        variant="calendar"
        selected={isSelected || isInSelection}
        completed={isCompleted}
        archived={isArchived}
        leftBorderColor={getPriorityColor(task.priority, "calendar")}
        onClick={handleTaskClick}
        onContextMenu={handleTaskContextMenu}
        onMouseEnter={handleTaskMouseEnter}
        onMouseLeave={handleTaskMouseLeave}
        className={cn(
          "group/task text-xs py-0 px-0.5",
          shouldShowHoverHighlight && "bg-accent/50",
          className,
        )}
        data-task-id={task.id}
      >
        <div className="flex items-center gap-1 min-w-0">
          <LinkifiedText as="span" className="truncate text-xs flex-1">
            {task.title}
          </LinkifiedText>
          {isPro() && <AssigneeBadges task={task} className="flex-shrink-0" showOwner={false} />}
          {shouldShowActionsMenu && (
            <TaskActionsMenu
              task={task}
              isVisible={true}
              onDeleteClick={() => deleteTask(task.id)}
              onSelectClick={() => toggleTaskSelection(taskId)}
              onArchiveToggle={handleArchiveToggle}
              isSubTask={false}
              open={actionsMenuOpen}
              onOpenChange={handleActionsMenuChange}
            />
          )}
        </div>
      </MaterialCard>
    )
  }

  // Subtask variant render - minimal layout for subtasks (mobile and desktop)
  if (variant === "subtask") {
    // Get current subtask's estimation from parent
    const parent = parentTask || quickAddTask
    const currentSubtask = parent.subtasks?.find((s) => String(s.id) === String(taskId))
    const currentEstimation = currentSubtask?.estimation || 0

    return (
      <MaterialCard
        variant="subtask"
        completed={isCompleted}
        archived={isArchived}
        onContextMenu={handleTaskContextMenu}
        onMouseEnter={handleTaskMouseEnter}
        onMouseLeave={handleTaskMouseLeave}
        className={cn(
          "group/task flex items-center",
          shouldShowHoverHighlight && "bg-accent/50",
          className,
        )}
        data-task-id={task.id}
      >
        {/* Drag handle for subtasks */}
        <div className="flex items-center mr-2 cursor-grab active:cursor-grabbing">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
        <TaskCheckbox
          checked={task.completed}
          onCheckedChange={() => handleSubtaskToggle()}
          className="mr-3"
        />
        <LinkifiedEditableDiv
          as="span"
          value={task.title}
          onChange={(newTitle) => {
            if (newTitle.trim() && newTitle !== task.title) {
              handleSubtaskTitleUpdate(newTitle)
            }
          }}
          className={cn(
            "flex-1 text-sm leading-5 border border-transparent hover:border-accent mr-3",
            task.completed
              ? "line-through text-muted-foreground"
              : isArchived
                ? "text-muted-foreground"
                : "text-foreground",
          )}
          data-action="edit"
          allowEmpty={false}
        />
        <div className="h-6 flex items-center gap-1">
          {currentEstimation > 0 && (
            <TimeEstimationPopover
              value={currentEstimation}
              onChange={handleSubtaskEstimationUpdate}
            >
              <div
                className={cn(
                  "h-6 min-w-6 px-1 hover:no-underline flex items-center justify-center cursor-pointer rounded-md border border-transparent hover:bg-accent hover:border-border transition-colors text-foreground",
                )}
              >
                <div className="flex items-center gap-0.5">
                  <ClockFading className="h-2.5 w-2.5 opacity-70" />
                  <span className="text-xs font-medium leading-none">
                    {formatTime(currentEstimation)}
                  </span>
                </div>
              </div>
            </TimeEstimationPopover>
          )}
          {shouldShowActionsMenu && (
            <TaskActionsMenu
              task={task}
              isVisible={true}
              onDeleteClick={handleSubtaskDelete}
              onSelectClick={() => toggleTaskSelection(taskId)}
              onEstimationClick={handleEstimationMenuClick}
              onConvertToTaskClick={handleConvertToTask}
              isSubTask={true}
              open={actionsMenuOpen}
              onOpenChange={handleActionsMenuChange}
            />
          )}
        </div>

        {/* Hidden TimeEstimationPicker to be triggered programmatically from menu */}
        <TimeEstimationPicker
          value={currentEstimation}
          onChange={handleSubtaskEstimationUpdate}
          trigger={<button type="button" className="sr-only" aria-hidden="true" />}
          open={showEstimationPicker}
          setOpen={setShowEstimationPicker}
          triggerMode="click"
          disableOutsideInteraction={actionsMenuOpen}
        />
      </MaterialCard>
    )
  }

  // Default variant render - flat focus row: check · title (+ quiet meta) · Today|Tomorrow · …
  const dueToday = task.dueDate ? isToday(task.dueDate) : false
  const dueTomorrow = task.dueDate ? isTomorrow(task.dueDate) : false
  // Today/Tomorrow already show through the reschedule toggle; only other dates need a chip
  const showScheduleMeta =
    Boolean(task.recurring) || (Boolean(task.dueDate) && !dueToday && !dueTomorrow)
  const taskLabels = getLabelsFromIds(task.labels)
  const hasMeta =
    showScheduleMeta || taskLabels.length > 0 || hasEstimation || isThisTaskTimerActive

  return (
    <MaterialCard
      variant="flat"
      selected={isSelected || isInSelection}
      completed={isCompleted}
      archived={isArchived}
      onClick={handleTaskClick}
      onContextMenu={handleTaskContextMenu}
      onMouseEnter={handleTaskMouseEnter}
      onMouseLeave={handleTaskMouseLeave}
      className={cn("group/task", shouldShowHoverHighlight && "bg-accent/50", className)}
      data-task-focused={isSelected}
      data-task-id={task.id}
    >
      <div className="flex items-start gap-3 sm:items-center sm:gap-4">
        <TaskCheckbox
          checked={task.completed}
          onCheckedChange={() => toggleTask(task.id)}
          priority={task.priority}
          showHoverCheck
          className="size-7 flex items-center justify-center active:scale-90"
          indicatorClassName="[&_svg]:size-4"
          data-action="toggle"
        />

        {/* Phones: title on its own line, meta + compact Today|Tmrw below.
            sm+: title and meta on the left, actions centered on the right. */}
        <div
          className={cn(
            "flex-1 min-w-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4",
            "[grid-template-areas:'title_title'_'meta_actions']",
            "sm:[grid-template-areas:'title_actions'_'meta_actions']",
          )}
        >
          <LinkifiedEditableDiv
            as="h3"
            value={task.title}
            onChange={(newTitle) => {
              if (newTitle.trim() && newTitle !== task.title) {
                updateTask({ updateRequest: { id: task.id, title: newTitle.trim() } })
              }
            }}
            onEditingChange={setIsTitleEditing}
            className={cn(
              "[grid-area:title] self-end font-medium text-[1.0625rem] leading-snug w-fit max-w-full",
              !isTitleEditing && "line-clamp-2",
              task.completed
                ? "line-through text-muted-foreground"
                : isArchived
                  ? "text-muted-foreground"
                  : "text-foreground",
            )}
            data-action="edit"
            allowEmpty={false}
          />

          {/* Quiet meta line - only what carries information */}
          {hasMeta && (
            <div className="[grid-area:meta] self-center sm:self-start min-w-0 mt-1.5 sm:mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {showScheduleMeta && (
                <TaskSchedulePopover taskId={task.id}>
                  <TaskScheduleTrigger
                    dueDate={task.dueDate}
                    dueTime={task.dueTime}
                    recurring={task.recurring}
                    recurringMode={task.recurringMode}
                    completed={isCompleted}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md cursor-pointer hover:text-foreground transition-colors",
                      getFlashClass("schedule"),
                    )}
                  />
                </TaskSchedulePopover>
              )}
              {taskLabels.length > 0 && (
                <LabelManagementPopover
                  task={task}
                  onAddLabel={handleAddLabel}
                  onRemoveLabel={handleRemoveLabel}
                >
                  <span
                    className={cn(
                      "inline-flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer",
                      getFlashClass("labels"),
                    )}
                  >
                    {taskLabels.map((label) => (
                      <span
                        key={label.id}
                        className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors"
                      >
                        <span
                          aria-hidden="true"
                          className="size-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        <TruncatedMetadataText>{label.name}</TruncatedMetadataText>
                      </span>
                    ))}
                  </span>
                </LabelManagementPopover>
              )}
              {hasEstimation && (
                <TimeEstimationPopover taskId={task.id}>
                  <TimeEstimationTrigger task={task} />
                </TimeEstimationPopover>
              )}
              {isThisTaskTimerActive && (
                <FocusTimerPopover taskId={task.id}>
                  <FocusTimerTrigger taskId={task.id} />
                </FocusTimerPopover>
              )}
            </div>
          )}

          {/* Primary actions - always visible */}
          <div className="[grid-area:actions] mt-1.5 sm:mt-0 flex items-center justify-end gap-1.5 flex-shrink-0">
            {!isCompleted && (
              <RescheduleToggle
                dueToday={dueToday}
                dueTomorrow={dueTomorrow}
                onToday={() => updateTask({ updateRequest: { id: task.id, dueDate: new Date() } })}
                onTomorrow={() =>
                  updateTask({ updateRequest: { id: task.id, dueDate: addDays(new Date(), 1) } })
                }
                todayLabel={t("actions.today", "Today")}
                tomorrowLabel={t("actions.tomorrow", "Tomorrow")}
                tomorrowShortLabel={t("actions.tomorrowShort", "Tmrw")}
                todayAriaLabel={t("actions.setDueToday", "Set due date to today")}
                tomorrowAriaLabel={t("actions.setDueTomorrow", "Defer due date to tomorrow")}
              />
            )}
            {/* Phones open the task drawer by tapping the row instead */}
            {shouldShowActionsMenu && (
              <div className="hidden sm:flex">
                <TaskActionsMenu
                  task={task}
                  isVisible={true}
                  onDeleteClick={() => deleteTask(task.id)}
                  onSelectClick={() => toggleTaskSelection(taskId)}
                  onArchiveToggle={handleArchiveToggle}
                  onEstimationClick={hasEstimation ? undefined : handleEstimationMenuClick}
                  onStartFocusTimerClick={
                    activeFocusTimer ? undefined : () => startFocusTimer(task.id)
                  }
                  isSubTask={false}
                  open={actionsMenuOpen}
                  onOpenChange={handleActionsMenuChange}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden TimeEstimationPicker opened from the actions menu */}
      <TimeEstimationPicker
        taskId={task.id}
        trigger={<button type="button" className="sr-only" aria-hidden="true" />}
        open={showEstimationPicker}
        setOpen={setShowEstimationPicker}
        triggerMode="click"
        disableOutsideInteraction={actionsMenuOpen}
      />
    </MaterialCard>
  )
}
