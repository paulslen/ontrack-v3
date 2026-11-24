import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RescheduleToggle } from "./reschedule-toggle"

const renderToggle = (overrides: Partial<React.ComponentProps<typeof RescheduleToggle>> = {}) => {
  const onToday = vi.fn()
  const onTomorrow = vi.fn()
  const onParentClick = vi.fn()
  render(
    <div onClick={onParentClick}>
      <RescheduleToggle
        dueToday={false}
        dueTomorrow={false}
        onToday={onToday}
        onTomorrow={onTomorrow}
        todayLabel="Today"
        tomorrowLabel="Tomorrow"
        tomorrowShortLabel="Tmrw"
        todayAriaLabel="Set due date to today"
        tomorrowAriaLabel="Defer due date to tomorrow"
        {...overrides}
      />
    </div>,
  )
  return { onToday, onTomorrow, onParentClick }
}

describe("RescheduleToggle", () => {
  it("renders both segments as a group", () => {
    renderToggle()

    expect(screen.getByRole("group")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Set due date to today" })).toHaveTextContent("Today")
    expect(screen.getByRole("button", { name: "Defer due date to tomorrow" })).toHaveTextContent(
      "Tomorrow",
    )
  })

  it("renders the short Tomorrow label for small screens alongside the full one", () => {
    renderToggle()

    const tomorrow = screen.getByRole("button", { name: "Defer due date to tomorrow" })
    expect(screen.getByText("Tmrw")).toHaveClass("sm:hidden")
    expect(tomorrow).toContainElement(screen.getByText("Tmrw"))
    expect(screen.getByText("Tomorrow")).toHaveClass("hidden", "sm:inline")
  })

  it("calls the matching handler without triggering the row click", async () => {
    const user = userEvent.setup()
    const { onToday, onTomorrow, onParentClick } = renderToggle()

    await user.click(screen.getByRole("button", { name: "Set due date to today" }))
    await user.click(screen.getByRole("button", { name: "Defer due date to tomorrow" }))

    expect(onToday).toHaveBeenCalledTimes(1)
    expect(onTomorrow).toHaveBeenCalledTimes(1)
    expect(onParentClick).not.toHaveBeenCalled()
  })

  it("marks the current day as pressed and ignores clicks on it", async () => {
    const user = userEvent.setup()
    const { onTomorrow } = renderToggle({ dueTomorrow: true })

    const tomorrow = screen.getByRole("button", { name: "Defer due date to tomorrow" })
    expect(tomorrow).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: "Set due date to today" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )

    await user.click(tomorrow)
    expect(onTomorrow).not.toHaveBeenCalled()
  })
})
