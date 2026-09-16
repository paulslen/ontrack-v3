import React from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { FlickerText } from "./flicker-text"

interface TaskTroveLogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  badge?: React.ReactNode
}

const LOGO_WIDTH_BY_SIZE = {
  sm: 120,
  md: 150,
  lg: 180,
} as const

const LOGO_ASPECT_RATIO = 45 / 180

export const getLogoUnderlineStyle = () =>
  cn(
    "relative inline-block pb-1",
    "after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[1px]",
    "after:bg-sidebar-foreground/30 after:transition-all after:duration-300",
    "hover:after:bg-primary hover:after:h-[2px]",
  )

export function TaskTroveLogo({ className, size = "md", badge }: TaskTroveLogoProps) {
  const width = LOGO_WIDTH_BY_SIZE[size]
  const height = Math.round(width * LOGO_ASPECT_RATIO)

  return (
    <h1 className={cn("cursor-default flex flex-col items-center gap-2", className)}>
      <FlickerText className={getLogoUnderlineStyle()}>
        <Image src="/progress_180x45.png" alt="TaskTrove" width={width} height={height} priority />
      </FlickerText>
      {badge}
    </h1>
  )
}
