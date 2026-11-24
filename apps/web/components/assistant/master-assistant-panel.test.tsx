import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MasterAssistantPanel } from "./master-assistant-panel"
import type { useMasterAssistant } from "@/hooks/use-master-assistant"

type AssistantState = ReturnType<typeof useMasterAssistant>

const sendMessage = vi.fn<AssistantState["sendMessage"]>()
const clear = vi.fn<AssistantState["clear"]>()

let state: Pick<
  AssistantState,
  "items" | "isLoading" | "isBusy" | "live" | "error" | "decisions" | "pendingActions"
>

vi.mock("@/hooks/use-master-assistant", () => ({
  useMasterAssistant: () => ({
    ...state,
    sendMessage,
    decide: vi.fn(),
    clear,
    dismissError: vi.fn(),
  }),
}))

const setAssistantOpen = vi.fn<(open: boolean) => void>()
let isMobile = false

vi.mock("@/hooks/use-assistant-panel", () => ({
  ASSISTANT_INPUT_ID: "master-assistant-input",
  useAssistantPanel: () => ({ isMobile, setAssistantOpen }),
}))

describe("MasterAssistantPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isMobile = false
    state = {
      items: [],
      isLoading: false,
      isBusy: false,
      live: null,
      error: null,
      decisions: {},
      pendingActions: [],
    }
  })

  it("shows the empty state with suggestion chips that send on click", () => {
    render(<MasterAssistantPanel />)

    expect(screen.getByText("How can I help?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Plan my day/ }))

    expect(sendMessage).toHaveBeenCalledWith(
      "Help me plan my day: what should I focus on today, and in what order?",
    )
  })

  it("focuses the message box when it opens", () => {
    render(<MasterAssistantPanel />)

    expect(screen.getByLabelText("Message the assistant")).toHaveFocus()
  })

  it("doesn't focus the message box on mobile, so the keyboard doesn't cover the chips", () => {
    isMobile = true
    render(<MasterAssistantPanel />)

    expect(screen.getByLabelText("Message the assistant")).not.toHaveFocus()
  })

  it("closes through the shared assistant panel state", () => {
    render(<MasterAssistantPanel />)

    fireEvent.click(screen.getByRole("button", { name: "Hide assistant" }))

    expect(setAssistantOpen).toHaveBeenCalledWith(false)
  })

  it("sends on Enter and keeps a newline on Shift+Enter", () => {
    render(<MasterAssistantPanel />)
    const input = screen.getByLabelText("Message the assistant")

    fireEvent.change(input, { target: { value: "hello" } })
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true })
    expect(sendMessage).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: "Enter" })
    expect(sendMessage).toHaveBeenCalledWith("hello")
    expect(input).toHaveValue("")
  })

  it("disables send for an empty draft and while a reply is in progress", () => {
    const { rerender } = render(<MasterAssistantPanel />)
    const send = screen.getByRole("button", { name: "Send" })
    expect(send).toBeDisabled()

    fireEvent.change(screen.getByLabelText("Message the assistant"), {
      target: { value: "hi" },
    })
    expect(send).toBeEnabled()

    state = { ...state, isBusy: true }
    rerender(<MasterAssistantPanel />)
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
    // Typing stays possible while the assistant replies
    expect(screen.getByLabelText("Message the assistant")).toBeEnabled()
  })

  it("renders the conversation instead of the empty state", () => {
    state = {
      ...state,
      items: [
        { kind: "user", text: "What is due?" },
        { kind: "assistant", text: "Two tasks are due today." },
      ],
    }
    render(<MasterAssistantPanel />)

    expect(screen.queryByText("How can I help?")).not.toBeInTheDocument()
    expect(screen.getByText("What is due?")).toBeInTheDocument()
    expect(screen.getByText("Two tasks are due today.")).toBeInTheDocument()
  })

  it("asks for confirmation before clearing the chat", () => {
    state = { ...state, items: [{ kind: "user", text: "Hi" }] }
    render(<MasterAssistantPanel />)

    fireEvent.click(screen.getByRole("button", { name: "Clear chat" }))
    expect(clear).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Clear chat" }))
    expect(clear).toHaveBeenCalled()
  })
})
