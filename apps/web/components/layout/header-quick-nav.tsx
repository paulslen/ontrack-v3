"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useAtomValue } from "jotai"
import { labelsAtom } from "@tasktrove/atoms/data/base/atoms"
import { taskCountsAtom, labelTaskCountsAtom } from "@tasktrove/atoms/ui/task-counts"
import { pathnameAtom } from "@tasktrove/atoms/ui/navigation"
import { createLabelSlug } from "@tasktrove/utils/routing"
import { useTranslation } from "@tasktrove/i18n"

/**
 * Pill row of the most-used destinations (Today + every label) other than the current page,
 * shown beside the page title while the sidebar is collapsed so navigation doesn't require
 * reopening it.
 */
export function HeaderQuickNav() {
  const { t } = useTranslation("layout")
  const labels = useAtomValue(labelsAtom)
  const taskCounts = useAtomValue(taskCountsAtom)
  const labelTaskCounts = useAtomValue(labelTaskCountsAtom)
  const pathname = useAtomValue(pathnameAtom)

  return (
    <nav
      aria-label={t("header.quickNav", "Quick navigation")}
      className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
      data-testid="header-quick-nav"
    >
      {pathname !== "/today" && (
        <QuickNavPill href="/today" count={taskCounts.today}>
          {t("header.today", "Today")}
        </QuickNavPill>
      )}
      {labels.map((label) => {
        const href = `/labels/${createLabelSlug(label)}`
        if (pathname === href) return null
        return (
          <QuickNavPill
            key={label.id}
            href={href}
            count={labelTaskCounts[label.id]}
            dotColor={label.color}
          >
            {label.name}
          </QuickNavPill>
        )
      })}
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
