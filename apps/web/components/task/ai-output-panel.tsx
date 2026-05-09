"use client"

import { Check, X, RefreshCw, Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AiOutputPanelProps {
  output: string
  isStreaming: boolean
  onAccept: (output: string) => void
  onDismiss: () => void
  onRegenerate: () => void
  className?: string
}

export function AiOutputPanel({
  output,
  isStreaming,
  onAccept,
  onDismiss,
  onRegenerate,
  className,
}: AiOutputPanelProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50 bg-muted/30">
        <Bot className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">AI Output</span>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
            Generating
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2.5 text-sm text-foreground whitespace-pre-wrap min-h-[60px] max-h-[320px] overflow-y-auto">
        {output || <span className="text-muted-foreground">…</span>}
      </div>

      {/* Actions */}
      {!isStreaming && output && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50 bg-muted/10">
          <Button
            size="sm"
            variant="default"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onAccept(output)}
          >
            <Check className="size-3" />
            Use this
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={onRegenerate}>
            <RefreshCw className="size-3" />
            Regenerate
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto" onClick={onDismiss}>
            <X className="size-3" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      )}
    </div>
  )
}
