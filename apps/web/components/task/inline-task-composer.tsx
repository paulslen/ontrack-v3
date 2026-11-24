"use client"

import { useRef, useState, type KeyboardEvent } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { CalendarDays, Maximize2, Plus, Tag } from "lucide-react"
import { useTranslation } from "@tasktrove/i18n"
import { addTaskAtom } from "@tasktrove/atoms/core/tasks"
import { labelsAtom } from "@tasktrove/atoms/data/base/atoms"
import { updateQuickAddTaskAtom } from "@tasktrove/atoms/ui/dialogs"
import {
  currentRouteContextAtom,
  openQuickAddAtom,
  type RouteContext,
} from "@tasktrove/atoms/ui/navigation"
import type { CreateTaskRequest } from "@tasktrove/types/api-requests"
import { INBOX_PROJECT_ID } from "@tasktrove/types/constants"
import { LabelIdSchema, ProjectIdSchema } from "@tasktrove/types/id"
import { cn } from "@/lib/utils"

/** Selector used by the global `n` shortcut to focus the composer */
export const INLINE_TASK_COMPOSER_SELECTOR = "[data-inline-task-composer]"

/**
 * Focuses the inline composer if one is mounted.
 * Returns false when no composer is on screen, so callers can fall back to the quick-add dialog.
 */
export function focusInlineTaskComposer(): boolean {
  const input = document.querySelector<HTMLInputElement>(INLINE_TASK_COMPOSER_SELECTOR)
  if (!input) return false
  input.focus()
  return true
}

function startOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

/** Defaults a new task inherits from the view it is typed into (mirrors quick add) */
export function getComposerDefaults(routeContext: RouteContext): Omit<CreateTaskRequest, "title"> {
  const label =
    routeContext.routeType === "label" ? LabelIdSchema.safeParse(routeContext.viewId) : null
  const project =
    routeContext.routeType === "project" ? ProjectIdSchema.safeParse(routeContext.viewId) : null

  const defaults: Omit<CreateTaskRequest, "title"> = {
    priority: 4,
    projectId: project?.success ? project.data : INBOX_PROJECT_ID,
    labels: label?.success ? [label.data] : [],
  }

  if (routeContext.viewId === "today") {
    defaults.dueDate = startOfToday()
  }

  if (routeContext.viewId === "habits") {
    defaults.dueDate = startOfToday()
    defaults.recurring = "RRULE:FREQ=DAILY"
    defaults.recurringMode = "autoRollover"
  }

  return defaults
}

interface InlineTaskComposerProps {
  className?: string
}

/**
 * Always-open "What needs doing?" field. Type a title, press Enter, the task is added
 * with the current view's context, and focus stays put for the next one.
 */
export function InlineTaskComposer({ className }: InlineTaskComposerProps) {
  const { t } = useTranslation("task")
  const routeContext = useAtomValue(currentRouteContextAtom)
  const labels = useAtomValue(labelsAtom)
  const addTask = useSetAtom(addTaskAtom)
  const updateQuickAddTask = useSetAtom(updateQuickAddTaskAtom)
  const openQuickAdd = useSetAtom(openQuickAddAtom)
  const [title, setTitle] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const defaults = getComposerDefaults(routeContext)
  const contextLabel = defaults.labels?.[0]
    ? labels.find((label) => label.id === defaults.labels?.[0])
    : undefined
  const isToday = routeContext.viewId === "today"

  const submit = async (): Promise<void> => {
    const trimmed = title.trim()
    if (!trimmed) return
    setTitle("")
    await addTask({ ...defaults, title: trimmed })
    inputRef.current?.focus()
  }

  const openFullQuickAdd = (): void => {
    const trimmed = title.trim()
    if (trimmed) {
      updateQuickAddTask({ updateRequest: { title: trimmed } })
    }
    setTitle("")
    openQuickAdd()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (event.shiftKey) {
        openFullQuickAdd()
      } else {
        void submit()
      }
    }
    if (event.key === "Escape") {
      setTitle("")
      event.currentTarget.blur()
    }
  }

  const hasText = title.trim().length > 0

  return (
    <div
      className={cn(
        "group/composer flex h-14 items-center gap-3 rounded-2xl border bg-card pl-3 pr-2 shadow-sm transition-all",
        "focus-within:border-foreground/30 focus-within:shadow-md",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => (hasText ? void submit() : inputRef.current?.focus())}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors cursor-pointer",
          hasText
            ? "bg-foreground text-background"
            : "bg-muted text-muted-foreground group-focus-within/composer:text-foreground",
        )}
        aria-label={t("composer.add", "Add task")}
      >
        <Plus className="size-5" />
      </button>
      <input
        ref={inputRef}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("composer.placeholder", "What needs doing?")}
        aria-label={t("composer.placeholder", "What needs doing?")}
        className="h-full min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground/70"
        data-inline-task-composer=""
        autoComplete="off"
      />
      {isToday && (
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
          <CalendarDays className="size-4" />
          {t("composer.today", "Today")}
        </span>
      )}
      {contextLabel && (
        <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
          <Tag className="size-4" style={{ color: contextLabel.color }} />
          {contextLabel.name}
        </span>
      )}
      <button
        type="button"
        onClick={openFullQuickAdd}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
        aria-label={t("composer.moreOptions", "More options")}
        title={t("composer.moreOptionsHint", "More options (Shift+Enter)")}
      >
        <Maximize2 className="size-4" />
      </button>
    </div>
  )
}
