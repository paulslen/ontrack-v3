import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AssistantToggleButton } from "./assistant-toggle-button"

const renderButton = (extra?: React.ReactNode) =>
  render(
    <TooltipProvider>
      <AssistantToggleButton />
      {extra}
    </TooltipProvider>,
  )

const setShowAssistant = vi.fn<(value: boolean) => void>()
const closeTaskPanel = vi.fn<() => void>()
const focusAssistantInput = vi.fn<() => void>()

const DEFAULT_PANEL = {
  isAvailable: true,
  isAssistantOpen: false,
  isTaskPanelOpen: false,
  isMobile: false,
  setAssistantOpen: (value: boolean) => setShowAssistant(value),
}
let panel = { ...DEFAULT_PANEL }

vi.mock("@/hooks/use-assistant-panel", () => ({
  ASSISTANT_INPUT_ID: "master-assistant-input",
  focusAssistantInput: () => focusAssistantInput(),
  useAssistantPanel: () => panel,
}))

vi.mock("@tasktrove/atoms/ui/views", () => ({
  resetSidePanelStateAtom: { debugLabel: "resetSidePanelStateAtom" },
}))

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>()
  return {
    ...actual,
    useSetAtom: () => closeTaskPanel,
  }
})

const pressCmdJ = (): void => {
  fireEvent.keyDown(window, { key: "j", metaKey: true })
}

describe("AssistantToggleButton", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    panel = { ...DEFAULT_PANEL }
  })

  it("on mobile, shows an icon-only sparkle button that opens the assistant sheet", () => {
    panel = { ...panel, isMobile: true }
    renderButton()

    const button = screen.getByRole("button", { name: "Ask AI" })
    expect(button).not.toHaveTextContent("Ask AI")
    fireEvent.click(button)

    expect(setShowAssistant).toHaveBeenCalledWith(true)
  })

  it("renders nothing when AI is unavailable", () => {
    panel = { ...panel, isAvailable: false }
    renderButton()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("shows an Ask AI pill that opens the assistant", () => {
    renderButton()

    const pill = screen.getByRole("button", { name: "Ask AI" })
    expect(pill).toHaveTextContent("Ask AI")
    fireEvent.click(pill)

    expect(setShowAssistant).toHaveBeenCalledWith(true)
  })

  it("closes the task panel to make room for the assistant", () => {
    panel = { ...panel, isTaskPanelOpen: true }
    renderButton()

    fireEvent.click(screen.getByRole("button", { name: "Ask AI" }))

    expect(closeTaskPanel).toHaveBeenCalled()
  })

  it("hides the assistant when clicked while open", () => {
    panel = { ...panel, isAssistantOpen: true }
    renderButton()

    fireEvent.click(screen.getByRole("button", { name: "Hide assistant" }))

    expect(setShowAssistant).toHaveBeenCalledWith(false)
  })

  it("opens the assistant with Cmd+J", () => {
    renderButton()
    pressCmdJ()
    expect(setShowAssistant).toHaveBeenCalledWith(true)
  })

  it("focuses the message box with Cmd+J when already open", () => {
    panel = { ...panel, isAssistantOpen: true }
    renderButton()
    pressCmdJ()
    expect(focusAssistantInput).toHaveBeenCalled()
    expect(setShowAssistant).not.toHaveBeenCalled()
  })

  it("closes with Cmd+J from inside the message box", () => {
    panel = { ...panel, isAssistantOpen: true }
    renderButton(<textarea id="master-assistant-input" />)
    const input = document.getElementById("master-assistant-input")
    if (!(input instanceof HTMLTextAreaElement)) throw new Error("input missing")
    input.focus()

    pressCmdJ()

    expect(setShowAssistant).toHaveBeenCalledWith(false)
  })

  it("ignores J without a modifier", () => {
    renderButton()
    fireEvent.keyDown(window, { key: "j" })
    expect(setShowAssistant).not.toHaveBeenCalled()
  })
})
