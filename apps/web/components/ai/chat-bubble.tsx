"use client"

import { MarkdownRenderer } from "@/components/ui/custom/markdown-renderer"

interface ChatBubbleProps {
  role: "user" | "assistant"
  content: string
}

/** One chat message: user messages as a right-aligned bubble, replies as markdown */
export function ChatBubble({ role, content }: ChatBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
    )
  }
  return (
    <MarkdownRenderer className="text-sm text-foreground break-words">{content}</MarkdownRenderer>
  )
}

/** Pulsing indicator shown while waiting for the first words of a reply */
export function ThinkingIndicator({ label = "Thinking..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
      {label}
    </div>
  )
}
