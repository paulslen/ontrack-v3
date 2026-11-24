"use client"

import type { ReactNode } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { addDays, isToday, isTomorrow } from "date-fns"
import { Sun, Sunrise, Flag, Tag, CheckSquare, MessageSquare, AlignLeft } from "lucide-react"
import { useTranslation } from "@tasktrove/i18n"
import { cn } from "@/lib/utils"
import { getPriorityTextColor } from "@/lib/color-utils"
import { MarkdownEditableDiv } from "@/components/ui/custom/markdown-editable-div"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { settingsAtom } from "@tasktrove/atoms/data/base/atoms"
import { labelsFromIdsAtom } from "@tasktrove/atoms/core/labels"
import { updateTaskAtom } from "@tasktrove/atoms/core/tasks"
import type { Task } from "@tasktrove/types/core"
import type { LabelId } from "@tasktrove/types/id"
import { TaskSchedulePopover } from "./task-schedule-popover"
import { TaskScheduleTrigger } from "./task-schedule-trigger"
import { PriorityPopover } from "./priority-popover"
import { LabelManagementPopover } from "./label-management-popover"
import { SubtaskPopover } from "./subtask-popover"
import { CommentManagementPopover } from "./comment-management-popover"
import { MobileTaskAiChat } from "./mobile-task-ai-chat"

const ICON_BUTTON_CLASS =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full px-3 text-[0.8125rem] font-medium text-foreground/70 bg-foreground/[0.06] dark:bg-foreground/10 transition-all active:scale-95"
const ACTIVE_ICON_BUTTON_CLASS = "bg-foreground text-background dark:bg-foreground"
const ICON_CLASS = "size-[1.125rem] shrink-0"

interface MobileTaskPanelContentProps {
  task: Task
  autoSave: (updates: Partial<Task>) => void
  onAddComment: (content: string) => void
  onAddLabel: (labelName?: string) => void
  onRemoveLabel: (labelId: LabelId) => void
  markdownEnabled: boolean
}

/**
 * Mobile drawer body built around the per-task AI chat: one row of small icon buttons
 * (Today, Tomorrow, date, priority, labels, subtasks, comments, description - each opening its
 * existing editor), then the chat filling the rest with its composer pinned to the bottom.
 */
export function MobileTaskPanelContent({
  task,
  autoSave,
  onAddComment,
  onAddLabel,
  onRemoveLabel,
  markdownEnabled,
}: MobileTaskPanelContentProps) {
  const { t } = useTranslation("task")
  const updateTask = useSetAtom(updateTaskAtom)
  const settings = useAtomValue(settingsAtom)
  const getLabelsFromIds = useAtomValue(labelsFromIdsAtom)

  const aiEnabled = settings.ai.enabled && Boolean(settings.ai.apiKey)
  const taskLabels = getLabelsFromIds(task.labels)
  const completedSubtasks = task.subtasks.filter((subtask) => subtask.completed).length
  const dueToday = task.dueDate ? isToday(task.dueDate) : false
  const dueTomorrow = task.dueDate ? isTomorrow(task.dueDate) : false
  const hasDescription = Boolean(task.description?.trim())

  const descriptionEditor = (
    <MarkdownEditableDiv
      data-testid="editable-div"
      value={task.description || ""}
      onChange={(value: string) => autoSave({ description: value })}
      className="min-h-[44px] rounded-xl text-[0.9375rem] leading-relaxed text-muted-foreground"
      placeholder={t("sidePanel.description.placeholder", "Add description...")}
      multiline={true}
      markdownEnabled={markdownEnabled}
    />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="mobile-task-panel-content">
      {/* Quick actions: one row of small icon buttons */}
      <div
        className="flex shrink-0 items-center gap-1.5 overflow-x-auto px-5 pb-3 [scrollbar-width:none]"
        role="toolbar"
        aria-label={t("sidePanel.quickActions", "Task actions")}
      >
        {!task.completed && (
          <>
            <QuickButton
              label={t("actions.setDueToday", "Set due date to today")}
              active={dueToday}
              onClick={() => updateTask({ updateRequest: { id: task.id, dueDate: new Date() } })}
            >
              <Sun className={ICON_CLASS} />
              {t("actions.today", "Today")}
            </QuickButton>
            <QuickButton
              label={t("actions.setDueTomorrow", "Defer due date to tomorrow")}
              active={dueTomorrow}
              onClick={() =>
                updateTask({ updateRequest: { id: task.id, dueDate: addDays(new Date(), 1) } })
              }
            >
              <Sunrise className={ICON_CLASS} />
              {t("actions.tomorrowShort", "Tmrw")}
            </QuickButton>
            <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />
          </>
        )}

        <TaskSchedulePopover taskId={task.id}>
          <TaskScheduleTrigger
            dueDate={task.dueDate}
            dueTime={task.dueTime}
            recurring={task.recurring}
            recurringMode={task.recurringMode}
            completed={task.completed}
            variant="button"
            className={ICON_BUTTON_CLASS}
            fallbackLabel={
              <span className="sr-only">{t("sidePanel.dueDate.placeholder", "Due Date")}</span>
            }
          />
        </TaskSchedulePopover>

        <PriorityPopover task={task}>
          <span
            role="button"
            aria-label={t("sidePanel.category.priority", "Priority")}
            className={cn(
              ICON_BUTTON_CLASS,
              task.priority < 4 && getPriorityTextColor(task.priority),
            )}
          >
            <Flag className={ICON_CLASS} />
            {task.priority < 4 && `P${task.priority}`}
          </span>
        </PriorityPopover>

        <LabelManagementPopover task={task} onAddLabel={onAddLabel} onRemoveLabel={onRemoveLabel}>
          <span
            role="button"
            aria-label={t("sidePanel.labels.title", "Labels")}
            className={ICON_BUTTON_CLASS}
          >
            {taskLabels.length === 0 ? (
              <Tag className={ICON_CLASS} />
            ) : (
              taskLabels.map((label) => (
                <span
                  key={label.id}
                  className="size-3 rounded-full"
                  style={{ backgroundColor: label.color }}
                  title={label.name}
                />
              ))
            )}
          </span>
        </LabelManagementPopover>

        <SubtaskPopover taskId={task.id}>
          <span
            role="button"
            aria-label={t("sidePanel.subtasks.title", "Subtasks")}
            className={ICON_BUTTON_CLASS}
          >
            <CheckSquare className={ICON_CLASS} />
            {task.subtasks.length > 0 && (
              <span className="tabular-nums">
                {completedSubtasks}/{task.subtasks.length}
              </span>
            )}
          </span>
        </SubtaskPopover>

        <CommentManagementPopover taskId={task.id} onAddComment={onAddComment}>
          <span
            role="button"
            aria-label={t("sidePanel.comments.title", "Comments")}
            className={ICON_BUTTON_CLASS}
          >
            <MessageSquare className={ICON_CLASS} />
            {task.comments.length > 0 && (
              <span className="tabular-nums">{task.comments.length}</span>
            )}
          </span>
        </CommentManagementPopover>

        {/* Description moves into a popover only when the chat owns the body */}
        {aiEnabled && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={t("sidePanel.description.title", "Description")}
                className={ICON_BUTTON_CLASS}
              >
                <AlignLeft className={ICON_CLASS} />
                {hasDescription && <span className="size-1.5 rounded-full bg-current" />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-3" align="end">
              {descriptionEditor}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Main body: the AI chat (or the description when AI is off) */}
      {aiEnabled ? (
        <MobileTaskAiChat key={task.id} task={task} className="flex-1 border-t border-border/60" />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto border-t border-border/60 px-5 py-4">
          {descriptionEditor}
        </div>
      )}
    </div>
  )
}

interface QuickButtonProps {
  label: string
  active: boolean
  onClick: () => void
  children: ReactNode
}

/** Reschedule button; does nothing when the task is already due that day */
function QuickButton({ label, active, onClick, children }: QuickButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={() => {
        if (!active) onClick()
      }}
      className={cn(ICON_BUTTON_CLASS, active && ACTIVE_ICON_BUTTON_CLASS)}
    >
      {children}
    </button>
  )
}
