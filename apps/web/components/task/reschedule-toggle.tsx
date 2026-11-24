"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface RescheduleToggleProps {
  /** Task is currently due today (Today segment shows as active) */
  dueToday: boolean
  /** Task is currently due tomorrow (Tomorrow segment shows as active) */
  dueTomorrow: boolean
  onToday: () => void
  onTomorrow: () => void
  todayLabel: string
  tomorrowLabel: string
  todayAriaLabel: string
  tomorrowAriaLabel: string
  className?: string
}

const SEGMENT_CLASS =
  "h-7 px-3.5 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
const ACTIVE_SEGMENT_CLASS = "bg-background text-foreground shadow-sm"
const IDLE_SEGMENT_CLASS =
  "text-foreground/60 hover:text-foreground hover:bg-background/70 active:scale-95"

/**
 * Always-visible Today | Tomorrow segmented control for one-click rescheduling.
 * The segment matching the task's current due date is shown as selected.
 */
export function RescheduleToggle({
  dueToday,
  dueTomorrow,
  onToday,
  onTomorrow,
  todayLabel,
  tomorrowLabel,
  todayAriaLabel,
  tomorrowAriaLabel,
  className,
}: RescheduleToggleProps) {
  const segments = [
    {
      key: "today",
      action: "set-due-today",
      label: todayLabel,
      ariaLabel: todayAriaLabel,
      active: dueToday,
      onSelect: onToday,
    },
    {
      key: "tomorrow",
      action: "set-due-tomorrow",
      label: tomorrowLabel,
      ariaLabel: tomorrowAriaLabel,
      active: dueTomorrow,
      onSelect: onTomorrow,
    },
  ]

  return (
    <div
      role="group"
      className={cn(
        "inline-flex h-9 items-center rounded-full bg-foreground/[0.06] p-1 dark:bg-foreground/10",
        className,
      )}
    >
      {segments.map((segment) => (
        <button
          key={segment.key}
          type="button"
          data-action={segment.action}
          aria-label={segment.ariaLabel}
          aria-pressed={segment.active}
          title={segment.ariaLabel}
          className={cn(SEGMENT_CLASS, segment.active ? ACTIVE_SEGMENT_CLASS : IDLE_SEGMENT_CLASS)}
          onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
            e.stopPropagation()
            // Already due on that day - nothing to change
            if (segment.active) return
            segment.onSelect()
          }}
        >
          {segment.label}
        </button>
      ))}
    </div>
  )
}
