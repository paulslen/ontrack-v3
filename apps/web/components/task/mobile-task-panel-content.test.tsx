import React from "react"
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { addDays } from "date-fns"
import { atom, Provider } from "jotai"
import type { Task } from "@tasktrove/types/core"
import {
  TEST_TASK_ID_1,
  TEST_LABEL_ID_1,
  TEST_SUBTASK_ID_1,
  TEST_SUBTASK_ID_2,
} from "@tasktrove/types/test-constants"

const mocks = vi.hoisted(() => ({
  updateTask: vi.fn(),
  aiEnabled: false,
}))

vi.mock("@tasktrove/atoms/core/tasks", () => ({
  updateTaskAtom: atom(null, (_get, _set, update: unknown) => mocks.updateTask(update)),
}))

vi.mock("@tasktrove/atoms/data/base/atoms", () => ({
  settingsAtom: atom(() => ({ ai: { enabled: mocks.aiEnabled, apiKey: "key" } })),
}))

vi.mock("@tasktrove/atoms/core/labels", () => ({
  labelsFromIdsAtom: atom(
    () => (ids: string[]) => ids.map((id) => ({ id, name: "Work", color: "#ff0000" })),
  ),
}))

vi.mock("@tasktrove/i18n", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}))

// Children with their own state/popovers are covered by their own tests
vi.mock("./task-schedule-popover", () => ({
  TaskSchedulePopover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("./task-schedule-trigger", () => ({
  TaskScheduleTrigger: () => <span>date-chip</span>,
}))
vi.mock("./priority-popover", () => ({
  PriorityPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("./label-management-popover", () => ({
  LabelManagementPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("./subtask-popover", () => ({
  SubtaskPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("./comment-management-popover", () => ({
  CommentManagementPopover: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("./mobile-task-ai-chat", () => ({
  MobileTaskAiChat: () => <div>ai-chat</div>,
}))
vi.mock("@/components/ui/custom/markdown-editable-div", () => ({
  MarkdownEditableDiv: ({ value }: { value: string }) => <p>{value}</p>,
}))

import { MobileTaskPanelContent } from "./mobile-task-panel-content"

const baseTask: Task = {
  id: TEST_TASK_ID_1,
  title: "Write report",
  description: "Quarterly numbers",
  completed: false,
  archived: false,
  priority: 1,
  labels: [TEST_LABEL_ID_1],
  comments: [],
  subtasks: [
    { id: TEST_SUBTASK_ID_1, title: "Draft", completed: true },
    { id: TEST_SUBTASK_ID_2, title: "Review", completed: false },
  ],
  recurring: undefined,
  dueDate: undefined,
  projectId: undefined,
  createdAt: new Date("2024-01-01"),
  recurringMode: "dueDate",
}

const renderContent = (task: Task = baseTask) =>
  render(
    <Provider>
      <MobileTaskPanelContent
        task={task}
        autoSave={vi.fn()}
        onAddComment={vi.fn()}
        onAddLabel={vi.fn()}
        onRemoveLabel={vi.fn()}
        markdownEnabled={false}
      />
    </Provider>,
  )

describe("MobileTaskPanelContent", () => {
  beforeEach(() => {
    mocks.updateTask.mockClear()
    mocks.aiEnabled = true
  })

  afterEach(cleanup)

  it("puts every action in one row of icon buttons with values", () => {
    renderContent()

    const toolbar = screen.getByRole("toolbar", { name: "Task actions" })
    expect(toolbar).toHaveTextContent("Today")
    expect(toolbar).toHaveTextContent("Tmrw")
    expect(screen.getByText("date-chip")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Priority" })).toHaveTextContent("P1")
    expect(screen.getByRole("button", { name: "Labels" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Subtasks" })).toHaveTextContent("1/2")
    expect(screen.getByRole("button", { name: "Comments" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Description" })).toBeInTheDocument()
  })

  it("makes the AI chat the main body when AI is enabled", () => {
    renderContent()

    expect(screen.getByText("ai-chat")).toBeInTheDocument()
    // Description is tucked into its popover, not shown in the body
    expect(screen.queryByText("Quarterly numbers")).not.toBeInTheDocument()
  })

  it("shows the description in the body when AI is off", () => {
    mocks.aiEnabled = false
    renderContent()

    expect(screen.queryByText("ai-chat")).not.toBeInTheDocument()
    expect(screen.getByText("Quarterly numbers")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Description" })).not.toBeInTheDocument()
  })

  it("reschedules to tomorrow", async () => {
    const user = userEvent.setup()
    renderContent()

    await user.click(screen.getByRole("button", { name: "Defer due date to tomorrow" }))

    expect(mocks.updateTask).toHaveBeenCalledTimes(1)
    const [update] = mocks.updateTask.mock.calls[0] ?? []
    expect(update).toMatchObject({ updateRequest: { id: TEST_TASK_ID_1 } })
    const dueDate: unknown = Reflect.get(Reflect.get(update, "updateRequest"), "dueDate")
    expect(dueDate instanceof Date && dueDate.getDate()).toBe(addDays(new Date(), 1).getDate())
  })

  it("marks the current due day as pressed and doesn't re-save it", async () => {
    const user = userEvent.setup()
    renderContent({ ...baseTask, dueDate: new Date() })

    const today = screen.getByRole("button", { name: "Set due date to today" })
    expect(today).toHaveAttribute("aria-pressed", "true")
    await user.click(today)
    expect(mocks.updateTask).not.toHaveBeenCalled()
  })

  it("hides the reschedule buttons for completed tasks", () => {
    renderContent({ ...baseTask, completed: true })

    expect(screen.queryByRole("button", { name: "Set due date to today" })).not.toBeInTheDocument()
  })
})
