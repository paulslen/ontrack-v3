import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@/test-utils"
import userEvent from "@testing-library/user-event"
import { ProjectViewToolbar } from "./project-view-toolbar"
import { isValidProjectId } from "@/lib/utils/routing"

const mockJotai = vi.hoisted(() => ({
  useSetAtom: vi.fn(),
  useAtomValue: vi.fn(),
  atom: vi.fn(),
  Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("jotai", () => mockJotai)

vi.mock("./inline-task-composer", () => ({
  InlineTaskComposer: ({ className }: { className?: string }) => (
    <div data-testid="inline-task-composer" className={className} />
  ),
}))

vi.mock("./task-filter-badges", () => ({
  TaskFilterBadges: () => <div data-testid="task-filter-badges" />,
}))

vi.mock("@/lib/utils/routing", () => ({
  isValidProjectId: vi.fn(),
}))

vi.mock("@tasktrove/types/id", async () => {
  const actual = await vi.importActual<typeof import("@tasktrove/types/id")>("@tasktrove/types/id")
  return {
    ...actual,
    createProjectId: vi.fn((id: string) => id),
  }
})

describe("ProjectViewToolbar", () => {
  const mockOpenSectionDialog = vi.fn()
  let selectedTasks: string[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    selectedTasks = []
    vi.mocked(isValidProjectId).mockReturnValue(false)

    mockJotai.useSetAtom.mockImplementation((atom: { debugLabel?: string } | undefined) => {
      if (atom?.debugLabel === "openSectionDialogAtom") return mockOpenSectionDialog
      return vi.fn()
    })

    mockJotai.useAtomValue.mockImplementation((atom: { debugLabel?: string } | undefined) => {
      if (atom?.debugLabel === "currentRouteContextAtom") {
        return { viewId: "project-123", routeType: "project" }
      }
      if (atom?.debugLabel === "selectedTasksAtom") return selectedTasks
      return undefined
    })
  })

  it("renders the inline composer and filter badges", () => {
    render(<ProjectViewToolbar />)

    expect(screen.getByTestId("inline-task-composer")).toBeInTheDocument()
    expect(screen.getByTestId("task-filter-badges")).toBeInTheDocument()
  })

  it("no longer renders an Add Task button or filter/sort icons", () => {
    render(<ProjectViewToolbar />)

    expect(screen.queryByText("Add Task")).not.toBeInTheDocument()
    expect(screen.queryByTestId("task-filter-controls")).not.toBeInTheDocument()
    expect(screen.queryByTestId("task-sort-controls")).not.toBeInTheDocument()
  })

  it("hides Add Section outside project context", () => {
    render(<ProjectViewToolbar />)

    expect(screen.queryByRole("button", { name: "Add Section" })).not.toBeInTheDocument()
  })

  it("shows Add Section in project context and opens the section dialog", async () => {
    vi.mocked(isValidProjectId).mockReturnValue(true)
    const user = userEvent.setup()
    render(<ProjectViewToolbar />)

    await user.click(screen.getByRole("button", { name: "Add Section" }))

    expect(mockOpenSectionDialog).toHaveBeenCalledWith({ projectId: "project-123" })
  })

  it("renders extra actions passed as a node", () => {
    render(<ProjectViewToolbar extraActions={<span>Extra</span>} />)

    expect(screen.getByText("Extra")).toBeInTheDocument()
  })

  it("renders left and right extra actions", () => {
    render(
      <ProjectViewToolbar extraActions={{ left: <span>Left</span>, right: <span>Right</span> }} />,
    )

    expect(screen.getByText("Left")).toBeInTheDocument()
    expect(screen.getByText("Right")).toBeInTheDocument()
  })

  it("applies custom className", () => {
    render(<ProjectViewToolbar className="custom-class" />)

    expect(screen.getByTestId("inline-task-composer").closest(".sticky")).toHaveClass(
      "custom-class",
    )
  })

  it("sits below the selection toolbar when tasks are selected", () => {
    selectedTasks = ["task-1"]
    render(<ProjectViewToolbar />)

    expect(screen.getByTestId("inline-task-composer").closest(".sticky")).toHaveClass("top-14")
  })
})
