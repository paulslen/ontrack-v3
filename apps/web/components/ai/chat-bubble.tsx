"use client"

import { MarkdownRenderer } from "@/components/ui/custom/markdown-renderer"

interface ChatBubbleProps {
  role: "user" | "assistant"
  content: string
}

/** One chat message: user messages as a right-aligned bubble, replies as open markdown text */
export function ChatBubble({ role, content }: ChatBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-200">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-4 py-2.5 text-[0.9375rem] leading-relaxed text-background whitespace-pre-wrap break-words">
          {content}
        </div>
      </div>
    )
  }
  return (
    <MarkdownRenderer className="text-[0.9375rem] leading-relaxed text-foreground break-words animate-in fade-in duration-300">
      {content}
    </MarkdownRenderer>
  )
}

/** Three bouncing dots shown while waiting for the first words of a reply */
export function ThinkingIndicator({ label = "Thinking..." }: { label?: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-muted-foreground" role="status">
      <span className="flex items-center gap-1" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="inline-block size-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  )
}
