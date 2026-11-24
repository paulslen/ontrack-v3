import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@/test-utils"
import userEvent from "@testing-library/user-event"
import { INBOX_PROJECT_ID } from "@tasktrove/types/constants"
import type { RouteContext } from "@tasktrove/atoms/ui/navigation"
import { TEST_LABEL_ID_1, TEST_PROJECT_ID_1 } from "@tasktrove/types/test-constants"
import {
  InlineTaskComposer,
  focusInlineTaskComposer,
  getComposerDefaults,
} from "./inline-task-composer"

interface MockLabel {
  id: string
  name: string
  color: string
}

const mocks = vi.hoisted(() => {
  const labels: MockLabel[] = []
  return {
    addTask: vi.fn(),
    updateQuickAddTask: vi.fn(),
    openQuickAdd: vi.fn(),
    routeContext: { pathname: "/today", viewId: "today", routeType: "standard" },
    labels,
  }
})

vi.mock("jotai", () => ({
  atom: vi.fn(),
  Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAtomValue: vi.fn((atom: { debugLabel?: string }) => {
    if (atom.debugLabel === "currentRouteContextAtom") return mocks.routeContext
    if (atom.debugLabel === "labelsAtom") return mocks.labels
    return undefined
  }),
  useSetAtom: vi.fn((atom: { debugLabel?: string }) => {
    if (atom.debugLabel === "addTaskAtom") return mocks.addTask
    if (atom.debugLabel === "updateQuickAddTaskAtom") return mocks.updateQuickAddTask
    if (atom.debugLabel === "openQuickAddAtom") return mocks.openQuickAdd
    return vi.fn()
  }),
}))

vi.mock("@tasktrove/atoms/core/tasks", () => ({ addTaskAtom: { debugLabel: "addTaskAtom" } }))
vi.mock("@tasktrove/atoms/data/base/atoms", () => ({ labelsAtom: { debugLabel: "labelsAtom" } }))
vi.mock("@tasktrove/atoms/ui/dialogs", () => ({
  updateQuickAddTaskAtom: { debugLabel: "updateQuickAddTaskAtom" },
}))
vi.mock("@tasktrove/atoms/ui/navigation", () => ({
  currentRouteContextAtom: { debugLabel: "currentRouteContextAtom" },
  openQuickAddAtom: { debugLabel: "openQuickAddAtom" },
}))

function standardRoute(viewId: string): RouteContext {
  return { pathname: `/${viewId}`, viewId, routeType: "standard" }
}

describe("getComposerDefaults", () => {
  it("dates tasks typed in Today to today, in the inbox project", () => {
    const defaults = getComposerDefaults(standardRoute("today"))

    expect(defaults.projectId).toBe(INBOX_PROJECT_ID)
    expect(defaults.labels).toEqual([])
    expect(defaults.dueDate?.toDateString()).toBe(new Date().toDateString())
  })

  it("adds no due date in Inbox", () => {
    expect(getComposerDefaults(standardRoute("inbox")).dueDate).toBeUndefined()
  })

  it("tags tasks typed in a label view with that label", () => {
    const defaults = getComposerDefaults({
      pathname: "/labels/work",
      viewId: TEST_LABEL_ID_1,
      routeType: "label",
    })

    expect(defaults.labels).toEqual([TEST_LABEL_ID_1])
  })

  it("assigns tasks typed in a project view to that project", () => {
    const defaults = getComposerDefaults({
      pathname: "/projects/p",
      viewId: TEST_PROJECT_ID_1,
      routeType: "project",
    })

    expect(defaults.projectId).toBe(TEST_PROJECT_ID_1)
  })

  it("makes habits daily recurring", () => {
    const defaults = getComposerDefaults(standardRoute("habits"))

    expect(defaults.recurring).toBe("RRULE:FREQ=DAILY")
    expect(defaults.recurringMode).toBe("autoRollover")
  })
})

describe("InlineTaskComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.routeContext = { pathname: "/today", viewId: "today", routeType: "standard" }
    mocks.labels = []
  })

  it("adds a task with the view defaults on Enter and clears the field", async () => {
    const user = userEvent.setup()
    render(<InlineTaskComposer />)

    const input = screen.getByPlaceholderText("What needs doing?")
    await user.type(input, "  Buy milk  {Enter}")

    expect(mocks.addTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Buy milk", projectId: INBOX_PROJECT_ID }),
    )
    expect(input).toHaveValue("")
  })

  it("ignores Enter on an empty field", async () => {
    const user = userEvent.setup()
    render(<InlineTaskComposer />)

    await user.type(screen.getByPlaceholderText("What needs doing?"), "   {Enter}")

    expect(mocks.addTask).not.toHaveBeenCalled()
  })

  it("clears the field on Escape", async () => {
    const user = userEvent.setup()
    render(<InlineTaskComposer />)

    const input = screen.getByPlaceholderText("What needs doing?")
    await user.type(input, "Draft{Escape}")

    expect(input).toHaveValue("")
    expect(mocks.addTask).not.toHaveBeenCalled()
  })

  it("opens full quick add with the typed title on Shift+Enter", async () => {
    const user = userEvent.setup()
    render(<InlineTaskComposer />)

    await user.type(
      screen.getByPlaceholderText("What needs doing?"),
      "Plan trip{Shift>}{Enter}{/Shift}",
    )

    expect(mocks.updateQuickAddTask).toHaveBeenCalledWith({ updateRequest: { title: "Plan trip" } })
    expect(mocks.openQuickAdd).toHaveBeenCalled()
    expect(mocks.addTask).not.toHaveBeenCalled()
  })

  it("opens full quick add from the more-options button", async () => {
    const user = userEvent.setup()
    render(<InlineTaskComposer />)

    await user.click(screen.getByRole("button", { name: "More options" }))

    expect(mocks.openQuickAdd).toHaveBeenCalled()
  })

  it("shows a Today chip in the Today view", () => {
    render(<InlineTaskComposer />)

    expect(screen.getByText("Today")).toBeInTheDocument()
  })

  it("shows the label chip in a label view", () => {
    mocks.routeContext = { pathname: "/labels/work", viewId: TEST_LABEL_ID_1, routeType: "label" }
    mocks.labels = [{ id: TEST_LABEL_ID_1, name: "Work", color: "#ff0000" }]
    render(<InlineTaskComposer />)

    expect(screen.getByText("Work")).toBeInTheDocument()
    expect(screen.queryByText("Today")).not.toBeInTheDocument()
  })
})

describe("focusInlineTaskComposer", () => {
  it("returns false when no composer is mounted", () => {
    expect(focusInlineTaskComposer()).toBe(false)
  })

  it("focuses the mounted composer", () => {
    render(<InlineTaskComposer />)

    expect(focusInlineTaskComposer()).toBe(true)
    expect(screen.getByPlaceholderText("What needs doing?")).toHaveFocus()
  })
})
