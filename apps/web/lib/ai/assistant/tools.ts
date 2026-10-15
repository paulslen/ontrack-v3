import type Anthropic from "@anthropic-ai/sdk"
import { format } from "date-fns"
import { z } from "zod"
import { TaskSchema, type Task } from "@tasktrove/types/core"
import type { DataFile } from "@tasktrove/types/data-file"
import { ProjectIdSchema, TaskIdSchema } from "@tasktrove/types/id"
import {
  AssistantActionSchema,
  CreateTaskToolInputSchema,
  UpdateTaskToolInputSchema,
  type AssistantAction,
  type PrecomputedToolResult,
} from "@tasktrove/types/assistant"

const ListTasksInputSchema = z.object({
  status: z
    .enum(["open", "completed", "all"])
    .optional()
    .describe('Which tasks to include. Defaults to "open".'),
  search: z.string().optional().describe("Case-insensitive text to match in titles"),
  projectId: ProjectIdSchema.optional().describe("Only tasks in this project"),
})

const GetTaskInputSchema = z.object({
  taskId: TaskIdSchema,
})

const ListProjectsAndLabelsInputSchema = z.object({})

/** Maximum tasks returned by one list_tasks call, to keep tool results small */
const LIST_TASKS_LIMIT = 200

function toInputSchema(schema: z.ZodObject): Anthropic.Tool.InputSchema {
  const json = z.toJSONSchema(schema)
  return {
    type: "object",
    properties: json.properties,
    required: json.required,
    additionalProperties: false,
  }
}

const READ_TOOLS = {
  list_tasks: {
    description: `List the user's tasks, one per line with id, title, priority, due date, recurrence, project and labels. Returns at most ${LIST_TASKS_LIMIT} tasks.`,
    schema: ListTasksInputSchema,
    activity: "Looking through your tasks",
  },
  get_task: {
    description: "Get one task's full details, including description, subtasks and comments.",
    schema: GetTaskInputSchema,
    activity: "Reading a task",
  },
  list_projects_and_labels: {
    description: "List all projects and labels with their ids.",
    schema: ListProjectsAndLabelsInputSchema,
    activity: "Checking your projects and labels",
  },
} as const

const WRITE_TOOLS = {
  create_task: {
    description:
      "Propose creating a new task. The user sees it as a proposal and must approve it before it is created.",
    schema: CreateTaskToolInputSchema,
  },
  update_task: {
    description:
      "Propose changes to an existing task. Only include the fields that should change. The user must approve before anything changes.",
    schema: UpdateTaskToolInputSchema,
  },
} as const

type ReadToolName = keyof typeof READ_TOOLS
type WriteToolName = keyof typeof WRITE_TOOLS

function isReadTool(name: string): name is ReadToolName {
  return Object.hasOwn(READ_TOOLS, name)
}

export function isWriteTool(name: string): name is WriteToolName {
  return Object.hasOwn(WRITE_TOOLS, name)
}

export const ASSISTANT_TOOLS: Anthropic.Tool[] = [
  ...Object.entries(READ_TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    input_schema: toInputSchema(tool.schema),
  })),
  ...Object.entries(WRITE_TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    input_schema: toInputSchema(tool.schema),
  })),
]

export function getToolActivityLabel(name: string): string | undefined {
  return isReadTool(name) ? READ_TOOLS[name].activity : undefined
}

// =============================================================================
// FORMATTING
// =============================================================================

const PRIORITY_LABELS: Record<Task["priority"], string> = { 1: "P1", 2: "P2", 3: "P3", 4: "P4" }

function projectName(task: Task, fileData: DataFile): string {
  return fileData.projects.find((p) => p.id === task.projectId)?.name ?? "Inbox"
}

function formatTaskLine(task: Task, fileData: DataFile): string {
  const parts = [`[${task.id}] ${task.title}`, PRIORITY_LABELS[task.priority]]
  if (task.dueDate) {
    const date = format(task.dueDate, "yyyy-MM-dd")
    parts.push(`due ${task.dueTime ? `${date} ${format(task.dueTime, "HH:mm")}` : date}`)
  }
  if (task.recurring) parts.push(`repeats ${task.recurring}`)
  parts.push(`project: ${projectName(task, fileData)}`)
  const labels = task.labels
    .map((id) => fileData.labels.find((l) => l.id === id)?.name)
    .filter((name): name is string => name !== undefined)
  if (labels.length > 0) parts.push(`labels: ${labels.join(", ")}`)
  if (task.completed) parts.push("completed")
  return parts.join(" | ")
}

function formatTaskDetails(task: Task, fileData: DataFile): string {
  const lines = [formatTaskLine(task, fileData)]
  if (task.description?.trim()) lines.push(`Description:\n${task.description.trim()}`)
  if (task.subtasks.length > 0) {
    lines.push("Subtasks:")
    for (const subtask of task.subtasks) {
      lines.push(`- [${subtask.completed ? "x" : " "}] ${subtask.title}`)
    }
  }
  if (task.comments.length > 0) {
    lines.push("Comments:")
    for (const comment of task.comments) lines.push(`- ${comment.content}`)
  }
  if (task.aiChat && task.aiChat.length > 0) {
    lines.push(`(This task has its own AI chat with ${task.aiChat.length} messages.)`)
  }
  return lines.join("\n")
}

// =============================================================================
// EXECUTION
// =============================================================================

function ok(content: string): PrecomputedToolResult {
  return { content, isError: false }
}

function fail(content: string): PrecomputedToolResult {
  return { content, isError: true }
}

function formatZodError(error: z.ZodError): string {
  return `Invalid input: ${z.prettifyError(error)}`
}

function runReadTool(
  name: ReadToolName,
  input: unknown,
  fileData: DataFile,
): PrecomputedToolResult {
  const activeTasks = fileData.tasks.filter((t) => !t.archived)

  switch (name) {
    case "list_tasks": {
      const parsed = ListTasksInputSchema.safeParse(input)
      if (!parsed.success) return fail(formatZodError(parsed.error))
      const { status = "open", search, projectId } = parsed.data
      const query = search?.trim().toLowerCase()
      const matches = activeTasks.filter(
        (t) =>
          (status === "all" || t.completed === (status === "completed")) &&
          (!query || t.title.toLowerCase().includes(query)) &&
          (!projectId || t.projectId === projectId),
      )
      if (matches.length === 0) return ok("No matching tasks.")
      const lines = matches.slice(0, LIST_TASKS_LIMIT).map((t) => formatTaskLine(t, fileData))
      if (matches.length > LIST_TASKS_LIMIT) {
        lines.push(`(${matches.length - LIST_TASKS_LIMIT} more not shown; narrow the search.)`)
      }
      return ok(lines.join("\n"))
    }
    case "get_task": {
      const parsed = GetTaskInputSchema.safeParse(input)
      if (!parsed.success) return fail(formatZodError(parsed.error))
      const task = fileData.tasks.find((t) => t.id === parsed.data.taskId)
      return task ? ok(formatTaskDetails(task, fileData)) : fail("No task with that id.")
    }
    case "list_projects_and_labels": {
      const projects = fileData.projects.map((p) => `- [${p.id}] ${p.name}`)
      const labels = fileData.labels.map((l) => `- [${l.id}] ${l.name}`)
      return ok(
        [
          "Projects (tasks with no project are in the Inbox):",
          ...(projects.length > 0 ? projects : ["(none)"]),
          "Labels:",
          ...(labels.length > 0 ? labels : ["(none)"]),
        ].join("\n"),
      )
    }
  }
}

type ProposalCheck = { ok: true; action: AssistantAction } | { ok: false; error: string }

/** Checks a create/update proposal against the current data before showing it to the user */
function checkProposal(name: WriteToolName, input: unknown, fileData: DataFile): ProposalCheck {
  const parsed = AssistantActionSchema.safeParse({ name, input })
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) }
  const action = parsed.data

  const { projectId, recurring } = action.input
  if (projectId && !fileData.projects.some((p) => p.id === projectId)) {
    return { ok: false, error: "Unknown projectId. Use list_projects_and_labels." }
  }
  if (recurring) {
    const rrule = TaskSchema.shape.recurring.safeParse(recurring)
    if (!rrule.success) return { ok: false, error: formatZodError(rrule.error) }
  }

  if (action.name === "create_task") {
    const unknownLabel = action.input.labelIds?.find(
      (id) => !fileData.labels.some((l) => l.id === id),
    )
    if (unknownLabel) {
      return { ok: false, error: "Unknown labelId. Use list_projects_and_labels." }
    }
    if (recurring && !action.input.dueDate) {
      return { ok: false, error: "Recurring tasks need a dueDate for the first occurrence." }
    }
    return { ok: true, action }
  }

  const task = fileData.tasks.find((t) => t.id === action.input.taskId)
  if (!task) return { ok: false, error: "No task with that id. Use list_tasks." }
  if (Object.keys(action.input).every((key) => key === "taskId")) {
    return { ok: false, error: "No changes given." }
  }
  const willHaveDueDate =
    action.input.dueDate === undefined ? Boolean(task.dueDate) : action.input.dueDate !== null
  if (recurring && !willHaveDueDate) {
    return { ok: false, error: "Recurring tasks need a dueDate for the first occurrence." }
  }
  return { ok: true, action }
}

export type ToolUseOutcome =
  | { kind: "result"; result: PrecomputedToolResult }
  | { kind: "proposal"; action: AssistantAction }

/** Runs a lookup, or checks a proposal that must wait for the user's approval */
export function handleToolUse(name: string, input: unknown, fileData: DataFile): ToolUseOutcome {
  if (isReadTool(name)) return { kind: "result", result: runReadTool(name, input, fileData) }
  if (isWriteTool(name)) {
    const check = checkProposal(name, input, fileData)
    return check.ok
      ? { kind: "proposal", action: check.action }
      : { kind: "result", result: fail(check.error) }
  }
  return { kind: "result", result: fail(`Unknown tool: ${name}`) }
}

/** Parses a stored proposal for display; undefined if it never was a valid proposal */
export function parseStoredAction(name: string, input: unknown): AssistantAction | undefined {
  if (!isWriteTool(name)) return undefined
  const parsed = AssistantActionSchema.safeParse({ name, input })
  return parsed.success ? parsed.data : undefined
}
