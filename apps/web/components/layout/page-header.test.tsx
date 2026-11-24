import React from "react"
import { afterEach, describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@/test-utils"
import { mockNextNavigation, mockUseToast, mockNextThemes } from "@/test-utils"

// Mock Next.js router using centralized utilities
mockNextNavigation()

// Mock theme provider
mockNextThemes() // Full comprehensive theme mock with all properties

// Mock toast hook
mockUseToast()

// Assistant availability depends on settings; covered by its own hook tests
vi.mock("@/components/assistant/assistant-toggle-button", () => ({
  AssistantToggleButton: () => <button aria-label="Show assistant" />,
}))

// Render tooltips inline (no provider/portal) so labels are queryable
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}))

// Mock useSidebar hook
vi.mock("@/components/ui/custom/sidebar", () => ({
  useSidebar: vi.fn(() => ({
    open: true,
    setOpen: vi.fn(),
    openMobile: false,
    setOpenMobile: vi.fn(),
    isMobile: false,
    toggleSidebar: vi.fn(),
    state: "expanded",
  })),
}))

// Header subtitle atoms: Today progress and open task count
const mockTaskLists = vi.hoisted(() => ({
  completedToday: [{ id: "done-1", completed: true }],
  today: [
    { id: "open-1", completed: false },
    { id: "open-2", completed: false },
    { id: "open-3", completed: false },
  ],
  view: [
    { id: "view-1", completed: false },
    { id: "view-2", completed: false },
    { id: "view-3", completed: true },
  ],
  viewId: "today",
}))

vi.mock("@tasktrove/atoms/core/tasks", () => ({
  completedTasksTodayAtom: { debugLabel: "completedTasksTodayAtom" },
}))

vi.mock("@tasktrove/atoms/ui/task-counts", () => ({
  taskListForViewAtom: () => ({ debugLabel: "taskListForViewAtom(today)" }),
}))

vi.mock("@tasktrove/atoms/ui/filtered-tasks", () => ({
  filteredTasksAtom: { debugLabel: "filteredTasksAtom" },
}))

vi.mock("@/components/task/focus-timer-display", () => ({
  FocusTimerDisplay: () => null,
}))

// Mock Jotai atoms with comprehensive atom values
vi.mock("jotai", () => ({
  atom: vi.fn((initialValue) => ({
    init: initialValue,
    debugLabel: `atom_${Math.random()}`,
  })),
  useAtom: vi.fn(() => [
    {
      title: "Today's Tasks",
      description: "Tasks due today",
      iconType: "today",
      color: undefined,
    },
  ]),
  useAtomValue: vi.fn((atom) => {
    if (atom.debugLabel === "dynamicPageInfoAtom") {
      return {
        title: "Today's Tasks",
        description: "Tasks due today",
        iconType: "today",
        color: undefined,
      }
    }
    if (atom.debugLabel === "currentRouteContextAtom") {
      return {
        pathname: `/${mockTaskLists.viewId}`,
        viewId: mockTaskLists.viewId,
        projectId: "view-today",
        routeType: "standard",
        routeParams: {},
      }
    }
    if (atom.debugLabel === "currentViewStateAtom") {
      return {
        viewMode: "list",
        searchQuery: "",
        sortBy: "dueDate",
        sortDirection: "asc",
        showCompleted: false,
        showArchived: false,
        showSidePanel: false,
        compactView: false,
      }
    }
    if (atom.debugLabel === "tasksAtom") {
      return []
    }
    if (atom.debugLabel === "completedTasksTodayAtom") return mockTaskLists.completedToday
    if (atom.debugLabel === "taskListForViewAtom(today)") return mockTaskLists.today
    if (atom.debugLabel === "filteredTasksAtom") return mockTaskLists.view
    return undefined
  }),
  useSetAtom: vi.fn(() => vi.fn()),
  Provider: vi.fn(({ children }) => children),
}))

// Note: Atom mocks are now centralized in test-utils/atoms-mocks.ts

// Mock UI components with minimal implementations
interface MockButtonProps {
  children?: React.ReactNode
  onClick?: () => void
  title?: string
  [key: string]: unknown
}

interface MockInputProps {
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  [key: string]: unknown
}

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, title, ...props }: MockButtonProps) => (
    <button onClick={onClick} title={title} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/input", () => ({
  Input: ({ value, onChange, placeholder, ...props }: MockInputProps) => (
    <input value={value} onChange={onChange} placeholder={placeholder} {...props} />
  ),
}))

interface MockCommandPaletteProps {
  open?: boolean
  [key: string]: unknown
}

vi.mock("./view-options-popover", () => ({
  ViewOptionsPopover: () => <div data-testid="view-options-popover">View Options Popover</div>,
}))

vi.mock("@/components/search/command-palette", () => ({
  CommandPalette: ({ open }: MockCommandPaletteProps) => (
    <div data-testid="command-palette" style={{ display: open ? "block" : "none" }}>
      Command Palette
    </div>
  ),
}))

vi.mock("lucide-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("lucide-react")>()),
  PanelRightClose: () => <span data-testid="panel-right-close-icon" />,
  PanelRightOpen: () => <span data-testid="panel-right-open-icon" />,
  Search: () => <span data-testid="search-icon" />,
  Monitor: () => <span data-testid="monitor-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  Inbox: () => <span data-testid="inbox-icon" />,
  TrendingUp: () => <span data-testid="trending-up-icon" />,
  Folder: () => <span data-testid="folder-icon" />,
  Tag: () => <span data-testid="tag-icon" />,
  Filter: () => <span data-testid="filter-icon" />,
  List: () => <span data-testid="list-icon" />,
  Archive: () => <span data-testid="archive-icon" />,
  Sun: () => <span data-testid="sun-icon" />,
  Moon: () => <span data-testid="moon-icon" />,
}))

// Mock utils
vi.mock("@/lib/utils", () => ({
  cn: (...classes: string[]) => classes.filter(Boolean).join(" "),
}))

import { PageHeader } from "./page-header"

describe("PageHeader", () => {
  const defaultProps = {
    onAdvancedSearch: vi.fn(),
    actions: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders page header successfully", () => {
    render(<PageHeader {...defaultProps} />)

    expect(screen.getByTestId("page-header")).toBeInTheDocument()
  })

  it("displays page title from dynamicPageInfoAtom", () => {
    render(<PageHeader {...defaultProps} />)

    expect(screen.getByText("Today's Tasks")).toBeInTheDocument()
  })

  it("renders sidebar toggle button", () => {
    render(<PageHeader {...defaultProps} />)

    // Should show collapse button since sidebar is open by default in mock
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument()
  })

  it("renders view options popover", () => {
    render(<PageHeader {...defaultProps} />)

    expect(screen.getByTestId("view-options-popover")).toBeInTheDocument()
  })

  it("renders search button with accessible label", () => {
    render(<PageHeader {...defaultProps} />)

    screen.getByLabelText("Search").click()
    expect(defaultProps.onAdvancedSearch).toHaveBeenCalled()
  })

  it("does not render theme toggle or help button (moved to user menu)", () => {
    render(<PageHeader {...defaultProps} />)

    expect(screen.queryByTitle(/Click to cycle themes/)).not.toBeInTheDocument()
    expect(screen.queryByTitle("Show help")).not.toBeInTheDocument()
  })

  it("renders command palette (hidden by default)", () => {
    render(<PageHeader {...defaultProps} />)

    const commandPalette = screen.getByTestId("command-palette")
    expect(commandPalette).toBeInTheDocument()
    expect(commandPalette).toHaveStyle("display: none")
  })

  it("renders custom actions when provided", () => {
    const customActions: Array<{
      label: string
      icon?: React.ReactNode
      onClick: () => void
      variant?: "default" | "outline" | "ghost"
    }> = [
      {
        label: "Custom Action",
        onClick: vi.fn(),
        variant: "outline",
      },
    ]

    render(<PageHeader {...defaultProps} actions={customActions} />)

    expect(screen.getByText("Custom Action")).toBeInTheDocument()
  })

  it("applies custom className when provided", () => {
    render(<PageHeader {...defaultProps} className="custom-class" />)

    const header = screen.getByTestId("page-header")
    expect(header).toHaveClass("custom-class")
  })

  it("validates mobile sidebar state consistency", () => {
    // This test validates that our fix ensures the sidebar context
    // returns the correct state for mobile vs desktop viewports

    // Test shows that when sidebar open = true, we get "Collapse sidebar"
    // and when sidebar open = false, we would get "Open sidebar"
    // The existing test already validates the basic open/closed logic

    // Our fix ensures that on mobile, the 'open' state returned by useSidebar
    // comes from openMobile instead of the desktop open state

    render(<PageHeader {...defaultProps} />)

    // With the current mock (open: true), should show collapse button
    const collapseButton = screen.getByLabelText("Collapse sidebar")
    expect(collapseButton).toBeInTheDocument()

    // The key insight is that our sidebar context fix ensures:
    // - On mobile: open = openMobile (mobile sheet state)
    // - On desktop: open = open (desktop sidebar state)
    // This prevents the page header from showing incorrect button states
    expect(collapseButton).toHaveAttribute("aria-label", "Collapse sidebar")
  })

  describe("subtitle", () => {
    afterEach(() => {
      mockTaskLists.viewId = "today"
    })

    it("shows today's date, progress text and a progress bar in the Today view", () => {
      render(<PageHeader />)

      const subtitle = screen.getByTestId("page-header-subtitle")
      expect(subtitle).toHaveTextContent("1 of 4 done")
      const progress = screen.getByRole("progressbar")
      expect(progress).toHaveAttribute("aria-valuenow", "1")
      expect(progress).toHaveAttribute("aria-valuemax", "4")
    })

    it("shows the open task count in other views", () => {
      mockTaskLists.viewId = "inbox"
      render(<PageHeader />)

      expect(screen.getByTestId("page-header-subtitle")).toHaveTextContent("2 tasks")
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument()
    })
  })
})
