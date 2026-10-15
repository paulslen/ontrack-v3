/**
 * Master Assistant types
 *
 * The master assistant is an app-wide Claude chat that can read all tasks and
 * propose creating or editing them. Proposals are applied only after the user
 * approves them in the chat.
 */

import { z } from "zod";
import { LabelIdSchema, ProjectIdSchema, TaskIdSchema } from "./id";

// =============================================================================
// TOOL INPUTS (shared by the server, which validates proposals, and the
// client, which applies approved ones)
// =============================================================================

const DueDateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Date as YYYY-MM-DD");

const DueTimeInputSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .describe("24-hour time as HH:MM");

const RecurringInputSchema = z
  .string()
  .startsWith("RRULE:")
  .describe(
    'RFC 5545 recurrence rule starting with "RRULE:", e.g. "RRULE:FREQ=DAILY", "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR", "RRULE:FREQ=MONTHLY;BYMONTHDAY=1". Requires a due date for the first occurrence.',
  );

const PriorityInputSchema = z
  .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
  .describe("1 = highest, 4 = no priority");

export const CreateTaskToolInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: PriorityInputSchema.optional(),
  dueDate: DueDateInputSchema.optional(),
  dueTime: DueTimeInputSchema.optional(),
  projectId: ProjectIdSchema.optional().describe(
    "Omit to put the task in the Inbox",
  ),
  labelIds: z.array(LabelIdSchema).optional(),
  recurring: RecurringInputSchema.optional(),
});

export const UpdateTaskToolInputSchema = z.object({
  taskId: TaskIdSchema,
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: PriorityInputSchema.optional(),
  completed: z.boolean().optional(),
  dueDate: DueDateInputSchema.nullable()
    .optional()
    .describe("YYYY-MM-DD, or null to remove the due date"),
  dueTime: DueTimeInputSchema.nullable()
    .optional()
    .describe("HH:MM, or null to remove the due time"),
  recurring: RecurringInputSchema.nullable()
    .optional()
    .describe("RRULE string, or null to stop the task repeating"),
  projectId: ProjectIdSchema.nullable()
    .optional()
    .describe("Project to move the task to, or null to move it to the Inbox"),
});

export type CreateTaskToolInput = z.infer<typeof CreateTaskToolInputSchema>;
export type UpdateTaskToolInput = z.infer<typeof UpdateTaskToolInputSchema>;

/** A change the assistant wants to make, awaiting or past the user's decision */
export const AssistantActionSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("create_task"),
    input: CreateTaskToolInputSchema,
  }),
  z.object({
    name: z.literal("update_task"),
    input: UpdateTaskToolInputSchema,
  }),
]);
export type AssistantAction = z.infer<typeof AssistantActionSchema>;

// =============================================================================
// STORED CONVERSATION (data/assistant-chat.json)
// Mirrors the Claude Messages API content blocks the assistant uses, so the
// history can be sent back to the API unchanged.
// =============================================================================

const StoredTextBlockSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const StoredThinkingBlockSchema = z.object({
  type: z.literal("thinking"),
  thinking: z.string(),
  signature: z.string(),
});

const StoredRedactedThinkingBlockSchema = z.object({
  type: z.literal("redacted_thinking"),
  data: z.string(),
});

const StoredToolUseBlockSchema = z.object({
  type: z.literal("tool_use"),
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

const StoredToolResultBlockSchema = z.object({
  type: z.literal("tool_result"),
  tool_use_id: z.string(),
  content: z.string(),
  is_error: z.boolean().optional(),
});

export const StoredUserMessageSchema = z.object({
  role: z.literal("user"),
  content: z.array(
    z.discriminatedUnion("type", [
      StoredTextBlockSchema,
      StoredToolResultBlockSchema,
    ]),
  ),
});

export const StoredAssistantMessageSchema = z.object({
  role: z.literal("assistant"),
  content: z.array(
    z.discriminatedUnion("type", [
      StoredTextBlockSchema,
      StoredThinkingBlockSchema,
      StoredRedactedThinkingBlockSchema,
      StoredToolUseBlockSchema,
    ]),
  ),
});

export const StoredMessageSchema = z.discriminatedUnion("role", [
  StoredUserMessageSchema,
  StoredAssistantMessageSchema,
]);

export const ActionDecisionStatusSchema = z.enum([
  "approved",
  "rejected",
  "failed",
]);

export const PrecomputedToolResultSchema = z.object({
  content: z.string(),
  isError: z.boolean(),
});

export const AssistantChatFileSchema = z.object({
  messages: z.array(StoredMessageSchema),
  /** Outcome of each proposed action, keyed by tool_use id */
  actionStatuses: z.record(z.string(), ActionDecisionStatusSchema),
  /**
   * Results already computed for the last assistant turn while it waits on the
   * user's decision (lookups, invalid proposals), keyed by tool_use id. All of
   * a turn's results must be sent back together, so they wait here.
   */
  pendingResults: z.record(z.string(), PrecomputedToolResultSchema),
});

export type StoredUserMessage = z.infer<typeof StoredUserMessageSchema>;
export type StoredAssistantMessage = z.infer<
  typeof StoredAssistantMessageSchema
>;
export type StoredMessage = z.infer<typeof StoredMessageSchema>;
export type ActionDecisionStatus = z.infer<typeof ActionDecisionStatusSchema>;
export type PrecomputedToolResult = z.infer<typeof PrecomputedToolResultSchema>;
export type AssistantChatFile = z.infer<typeof AssistantChatFileSchema>;

// =============================================================================
// API CONTRACT (/api/v1/ai/assistant)
// =============================================================================

/** What the chat panel renders; built by the server from the stored conversation */
export const AssistantTranscriptItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), text: z.string() }),
  z.object({ kind: z.literal("assistant"), text: z.string() }),
  z.object({
    kind: z.literal("action"),
    toolUseId: z.string(),
    action: AssistantActionSchema,
    status: z.union([z.literal("pending"), ActionDecisionStatusSchema]),
  }),
]);
export type AssistantTranscriptItem = z.infer<
  typeof AssistantTranscriptItemSchema
>;

export const AssistantTranscriptResponseSchema = z.object({
  items: z.array(AssistantTranscriptItemSchema),
});
export type AssistantTranscriptResponse = z.infer<
  typeof AssistantTranscriptResponseSchema
>;

/** The user's local time, so "today" means the user's today, not the server's */
export const AssistantClientContextSchema = z.object({
  /** YYYY-MM-DD in the user's time zone */
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeZone: z.string(),
});
export type AssistantClientContext = z.infer<
  typeof AssistantClientContextSchema
>;

export const ActionResultSchema = z.object({
  toolUseId: z.string(),
  status: ActionDecisionStatusSchema,
  /** Shown to the model, e.g. the new task's id or the error */
  message: z.string(),
});
export type ActionResult = z.infer<typeof ActionResultSchema>;

export const AssistantRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    text: z.string().trim().min(1),
    context: AssistantClientContextSchema,
  }),
  z.object({
    kind: z.literal("decisions"),
    results: z.array(ActionResultSchema).min(1),
    context: AssistantClientContextSchema,
  }),
]);
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

/** Newline-delimited JSON events streamed back while the assistant works */
export const AssistantStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("activity"), label: z.string() }),
  z.object({ type: z.literal("error"), message: z.string() }),
  z.object({ type: z.literal("done") }),
]);
export type AssistantStreamEvent = z.infer<typeof AssistantStreamEventSchema>;
