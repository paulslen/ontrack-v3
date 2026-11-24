"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useAtomValue } from "jotai"
import { Sun } from "lucide-react"
import { labelsAtom } from "@tasktrove/atoms/data/base/atoms"
import { taskCountsAtom, labelTaskCountsAtom } from "@tasktrove/atoms/ui/task-counts"
import { pathnameAtom } from "@tasktrove/atoms/ui/navigation"
import { createLabelSlug } from "@tasktrove/utils/routing"
import { useTranslation } from "@tasktrove/i18n"
import { cn } from "@/lib/utils"

interface HeaderQuickNavProps {
  /**
   * "pills": named pills for every destination except the current page (desktop, beside the title).
   * "dots": compact round buttons - Today plus one color dot per label, current one ringed (mobile).
   */
  variant?: "pills" | "dots"
}

/**
 * Quick navigation between the most-used destinations (Today + every label), shown in the page
 * header so switching views doesn't require opening the sidebar.
 */
export function HeaderQuickNav({ variant = "pills" }: HeaderQuickNavProps) {
  const { t } = useTranslation("layout")
  const labels = useAtomValue(labelsAtom)
  const taskCounts = useAtomValue(taskCountsAtom)
  const labelTaskCounts = useAtomValue(labelTaskCountsAtom)
  const pathname = useAtomValue(pathnameAtom)

  const todayLabel = t("header.today", "Today")
  const destinations = labels.map((label) => ({
    id: label.id,
    href: `/labels/${createLabelSlug(label)}`,
    name: label.name,
    color: label.color,
    count: labelTaskCounts[label.id],
  }))

  if (variant === "dots") {
    return (
      <nav
        aria-label={t("header.quickNav", "Quick navigation")}
        className="-ml-1.5 mt-2 flex items-center overflow-x-auto [scrollbar-width:none]"
        data-testid="header-quick-nav"
      >
        <QuickNavDot href="/today" name={todayLabel} isActive={pathname === "/today"}>
          <Sun className="size-[18px]" />
        </QuickNavDot>
        {destinations.map((destination) => (
          <QuickNavDot
            key={destination.id}
            href={destination.href}
            name={destination.name}
            isActive={pathname === destination.href}
          >
            <span
              className="size-4 rounded-full"
              style={{ backgroundColor: destination.color }}
              aria-hidden
            />
          </QuickNavDot>
        ))}
      </nav>
    )
  }

  return (
    <nav
      aria-label={t("header.quickNav", "Quick navigation")}
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      data-testid="header-quick-nav"
    >
      {pathname !== "/today" && (
        <QuickNavPill href="/today" count={taskCounts.today}>
          {todayLabel}
        </QuickNavPill>
      )}
      {destinations.map((destination) =>
        pathname === destination.href ? null : (
          <QuickNavPill
            key={destination.id}
            href={destination.href}
            count={destination.count}
            dotColor={destination.color}
          >
            {destination.name}
          </QuickNavPill>
        ),
      )}
    </nav>
  )
}

interface QuickNavPillProps {
  href: string
  count: number | undefined
  dotColor?: string
  children: ReactNode
}

function QuickNavPill({ href, count, dotColor, children }: QuickNavPillProps) {
  return (
    <Link
      href={href}
      className="flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
    >
      {dotColor && (
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
      )}
      <span className="whitespace-nowrap">{children}</span>
      {count !== undefined && count > 0 && (
        <span className="text-xs tabular-nums opacity-60">{count}</span>
      )}
    </Link>
  )
}

interface QuickNavDotProps {
  href: string
  /** Accessible name; the dot itself is purely visual */
  name: string
  isActive: boolean
  children: ReactNode
}

/** 44px tap target holding a small icon or color dot; the current page gets a ring */
function QuickNavDot({ href, name, isActive, children }: QuickNavDotProps) {
  return (
    <Link
      href={href}
      aria-label={name}
      title={name}
      aria-current={isActive ? "page" : undefined}
      className="flex size-11 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "flex size-8 items-center justify-center rounded-full transition-all active:scale-90",
          isActive ? "bg-background shadow-sm ring-2 ring-foreground" : "text-muted-foreground",
        )}
      >
        {children}
      </span>
    </Link>
  )
}
