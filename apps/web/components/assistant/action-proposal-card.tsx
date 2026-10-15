"use client"

import { useAtomValue } from "jotai"
import { format, parse } from "date-fns"
import { Check, X, Plus, Pencil, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { labelsAtom, projectsAtom, taskByIdAtom } from "@tasktrove/atoms/data/base/atoms"
import type { AssistantAction, AssistantTranscriptItem } from "@tasktrove/types/assistant"
import type { TaskId } from "@tasktrove/types/id"
import type { ActionDecision } from "@/hooks/use-master-assistant"

type ActionItem = Extract<AssistantTranscriptItem, { kind: "action" }>

const WEEKDAYS: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
}

const FREQUENCY_UNITS: Record<string, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
}

/** "RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO" -> "every 2 weeks on Mon" */
function describeRecurrence(rrule: string): string {
  const parts = new Map(
    rrule
      .replace(/^RRULE:/, "")
      .split(";")
      .map((part): [string, string] => {
        const [key = "", value = ""] = part.split("=")
        return [key, value]
      }),
  )
  const unit = FREQUENCY_UNITS[parts.get("FREQ") ?? ""]
  if (!unit) return rrule
  const interval = Number(parts.get("INTERVAL") ?? "1")
  let text = interval > 1 ? `every ${interval} ${unit}s` : `every ${unit}`
  const days = parts.get("BYDAY")
  if (days) {
    text += ` on ${days
      .split(",")
      .map((day) => WEEKDAYS[day.slice(-2)] ?? day)
      .join(", ")}`
  }
  const monthDay = parts.get("BYMONTHDAY")
  if (monthDay) text += ` on day ${monthDay}`
  return text
}

function formatDate(value: string): string {
  return format(parse(value, "yyyy-MM-dd", new Date()), "EEE, MMM d, yyyy")
}

function formatTime(value: string): string {
  return format(parse(value, "HH:mm", new Date()), "h:mm a")
}

function useActionSummary(action: AssistantAction): { title: string; details: string[] } {
  const taskById = useAtomValue(taskByIdAtom)
  const projects = useAtomValue(projectsAtom)
  const labels = useAtomValue(labelsAtom)
  const projectName = (id: string): string => projects.find((p) => p.id === id)?.name ?? "a project"

  if (action.name === "create_task") {
    const { input } = action
    const details: string[] = []
    if (input.dueDate) {
      details.push(
        `Due ${formatDate(input.dueDate)}${input.dueTime ? ` at ${formatTime(input.dueTime)}` : ""}`,
      )
    }
    if (input.recurring) details.push(`Repeats ${describeRecurrence(input.recurring)}`)
    if (input.priority && input.priority < 4) details.push(`Priority P${input.priority}`)
    details.push(`In ${input.projectId ? projectName(input.projectId) : "Inbox"}`)
    if (input.labelIds?.length) {
      const names = input.labelIds.map((id) => labels.find((l) => l.id === id)?.name ?? "label")
      details.push(`Labels: ${names.join(", ")}`)
    }
    if (input.description) details.push(`Description: ${input.description}`)
    return { title: input.title, details }
  }

  const { input } = action
  const taskId: TaskId = input.taskId
  const currentTitle = taskById.get(taskId)?.title ?? "a task"
  const details: string[] = []
  if (input.title !== undefined) details.push(`Rename to "${input.title}"`)
  if (input.completed !== undefined) {
    details.push(input.completed ? "Mark as completed" : "Mark as not completed")
  }
  if (input.priority !== undefined) {
    details.push(input.priority < 4 ? `Priority P${input.priority}` : "Remove priority")
  }
  if (input.dueDate !== undefined) {
    details.push(input.dueDate === null ? "Remove due date" : `Due ${formatDate(input.dueDate)}`)
  }
  if (input.dueTime !== undefined) {
    details.push(input.dueTime === null ? "Remove due time" : `At ${formatTime(input.dueTime)}`)
  }
  if (input.recurring !== undefined) {
    details.push(
      input.recurring === null
        ? "Stop repeating"
        : `Repeats ${describeRecurrence(input.recurring)}`,
    )
  }
  if (input.projectId !== undefined) {
    details.push(`Move to ${input.projectId === null ? "Inbox" : projectName(input.projectId)}`)
  }
  if (input.description !== undefined) details.push(`New description: ${input.description}`)
  return { title: currentTitle, details }
}

const STATUS_LABELS: Record<Exclude<ActionItem["status"], "pending">, string> = {
  approved: "Applied",
  rejected: "Rejected",
  failed: "Failed",
}

interface ActionProposalCardProps {
  item: ActionItem
  decision?: ActionDecision
  disabled: boolean
  onDecide: (decision: ActionDecision) => void
}

export function ActionProposalCard({
  item,
  decision,
  disabled,
  onDecide,
}: ActionProposalCardProps) {
  const { title, details } = useActionSummary(item.action)
  const isCreate = item.action.name === "create_task"
  const Icon = isCreate ? Plus : Pencil

  return (
    <div
      className={cn(
        "rounded-lg border bg-background px-3 py-2.5 space-y-2",
        item.status === "pending" ? "border-primary/40" : "border-border/60 opacity-80",
      )}
      data-testid="assistant-action-card"
    >
      <div className="flex items-start gap-2">
        <Icon className="size-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">
            {isCreate ? "Create task" : "Update task"}
          </p>
          <p className="text-sm font-medium text-foreground break-words">{title}</p>
        </div>
        {item.status !== "pending" && (
          <span
            className={cn(
              "flex items-center gap-1 text-xs flex-shrink-0",
              item.status === "approved" && "text-green-600 dark:text-green-500",
              item.status === "rejected" && "text-muted-foreground",
              item.status === "failed" && "text-destructive",
            )}
          >
            {item.status === "approved" && <Check className="size-3" />}
            {item.status === "failed" && <AlertCircle className="size-3" />}
            {STATUS_LABELS[item.status]}
          </span>
        )}
      </div>

      {details.length > 0 && (
        <ul className="space-y-0.5 pl-5.5 text-xs text-muted-foreground">
          {details.map((detail) => (
            <li key={detail} className="break-words line-clamp-3">
              {detail}
            </li>
          ))}
        </ul>
      )}

      {item.status === "pending" && (
        <div className="flex gap-1.5 pl-5.5">
          <Button
            size="sm"
            variant={decision === "approved" ? "default" : "outline"}
            className="h-7 gap-1 text-xs"
            disabled={disabled}
            onClick={() => onDecide("approved")}
          >
            <Check className="size-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant={decision === "rejected" ? "secondary" : "ghost"}
            className="h-7 gap-1 text-xs"
            disabled={disabled}
            onClick={() => onDecide("rejected")}
          >
            <X className="size-3" />
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}
