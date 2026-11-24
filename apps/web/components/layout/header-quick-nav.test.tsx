import React from "react"
import { afterEach, describe, it, expect, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { atom, Provider } from "jotai"

interface MockLabel {
  id: string
  name: string
  slug: string
  color: string
}

const LABEL_ID_1 = "11111111-1111-4111-8111-111111111111"
const LABEL_ID_2 = "22222222-2222-4222-8222-222222222222"

const mockAtoms = vi.hoisted(() => {
  const labels: MockLabel[] = []
  return { labels, pathname: "/today" }
})

vi.mock("@tasktrove/atoms/data/base/atoms", () => ({
  labelsAtom: atom(() => mockAtoms.labels),
}))

vi.mock("@tasktrove/atoms/ui/task-counts", () => ({
  taskCountsAtom: atom(() => ({ today: 4 })),
  labelTaskCountsAtom: atom(() => ({ "11111111-1111-4111-8111-111111111111": 2 })),
}))

vi.mock("@tasktrove/atoms/ui/navigation", () => ({
  pathnameAtom: atom(() => mockAtoms.pathname),
}))

vi.mock("@tasktrove/utils/routing", () => ({
  createLabelSlug: (label: { slug: string }) => label.slug,
}))

vi.mock("@tasktrove/i18n", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}))

import { HeaderQuickNav } from "./header-quick-nav"

// Fresh store per render so the mocked atoms re-read the current mock values
const renderNav = (variant?: "pills" | "dots") =>
  render(
    <Provider>
      <HeaderQuickNav variant={variant} />
    </Provider>,
  )

afterEach(cleanup)

describe("HeaderQuickNav", () => {
  it("on Today, links to every label with counts and not to Today itself", () => {
    mockAtoms.labels = [
      { id: LABEL_ID_1, name: "Work", slug: "work", color: "#ff0000" },
      { id: LABEL_ID_2, name: "Home", slug: "home", color: "#00ff00" },
    ]
    mockAtoms.pathname = "/today"
    renderNav()

    expect(screen.queryByRole("link", { name: /Today/ })).not.toBeInTheDocument()

    expect(screen.getByRole("link", { name: /Work/ })).toHaveAttribute("href", "/labels/work")
    expect(screen.getByRole("link", { name: /Work/ })).toHaveTextContent("2")
    // Labels without open tasks show no count
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/labels/home")
  })

  it("leaves out the current page and links back to Today from a label", () => {
    mockAtoms.labels = [
      { id: LABEL_ID_1, name: "Work", slug: "work", color: "#ff0000" },
      { id: LABEL_ID_2, name: "Home", slug: "home", color: "#00ff00" },
    ]
    mockAtoms.pathname = "/labels/work"
    renderNav()

    expect(screen.queryByRole("link", { name: /Work/ })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Today/ })).toHaveAttribute("href", "/today")
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
  })

  it("shows only Today when on a page outside the nav and there are no labels", () => {
    mockAtoms.labels = []
    mockAtoms.pathname = "/inbox"
    renderNav()

    expect(screen.getAllByRole("link")).toHaveLength(1)
  })

  describe("dots variant (mobile)", () => {
    it("shows Today and every label, including the current page, named for screen readers", () => {
      mockAtoms.labels = [
        { id: LABEL_ID_1, name: "Work", slug: "work", color: "#ff0000" },
        { id: LABEL_ID_2, name: "Home", slug: "home", color: "#00ff00" },
      ]
      mockAtoms.pathname = "/today"
      renderNav("dots")

      expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute("href", "/today")
      expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("href", "/labels/work")
      expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/labels/home")
    })

    it("marks the current page", () => {
      mockAtoms.labels = [{ id: LABEL_ID_1, name: "Work", slug: "work", color: "#ff0000" }]
      mockAtoms.pathname = "/labels/work"
      renderNav("dots")

      expect(screen.getByRole("link", { name: "Work" })).toHaveAttribute("aria-current", "page")
      expect(screen.getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current")
    })
  })
})
