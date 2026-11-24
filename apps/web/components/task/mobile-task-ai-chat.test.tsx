import React from "react"
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Task } from "@tasktrove/types/core"
import { TEST_TASK_ID_1 } from "@tasktrove/types/test-constants"

interface MockChatState {
  status: "idle" | "streaming" | "error"
}

const mocks = vi.hoisted(() => {
  const state: MockChatState = { status: "idle" }
  return {
    send: vi.fn(),
    stop: vi.fn(),
    clear: vi.fn(),
    dismissError: vi.fn(),
    state,
  }
})

vi.mock("@/hooks/use-task-ai-chat", () => ({
  useTaskAiChat: () => ({
    state: mocks.state,
    send: mocks.send,
    stop: mocks.stop,
    clear: mocks.clear,
    dismissError: mocks.dismissError,
  }),
}))

vi.mock("@tasktrove/i18n", () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string) => fallback }),
}))

vi.mock("@/components/ai/chat-bubble", () => ({
  ChatBubble: ({ content }: { content: string }) => <p>{content}</p>,
  ThinkingIndicator: () => <p>thinking</p>,
}))

import { MobileTaskAiChat } from "./mobile-task-ai-chat"

const baseTask: Task = {
  id: TEST_TASK_ID_1,
  title: "Write report",
  description: "",
  completed: false,
  archived: false,
  priority: 4,
  labels: [],
  comments: [],
  subtasks: [],
  recurring: undefined,
  dueDate: undefined,
  projectId: undefined,
  createdAt: new Date("2024-01-01"),
  recurringMode: "dueDate",
}

describe("MobileTaskAiChat", () => {
  beforeEach(() => {
    mocks.send.mockClear()
    mocks.clear.mockClear()
    mocks.state.status = "idle"
  })

  afterEach(cleanup)

  it("shows an empty state with suggestions that send on tap", async () => {
    const user = userEvent.setup()
    render(<MobileTaskAiChat task={baseTask} />)

    expect(screen.getByText("Ask about this task")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Break this into steps" }))
    expect(mocks.send).toHaveBeenCalledWith("Break this into steps")
  })

  it("sends the draft on Enter and clears the input", async () => {
    const user = userEvent.setup()
    render(<MobileTaskAiChat task={baseTask} />)

    const input = screen.getByRole("textbox", { name: "Message the AI about this task" })
    await user.type(input, "What first?{Enter}")

    expect(mocks.send).toHaveBeenCalledWith("What first?")
    expect(input).toHaveValue("")
  })

  it("disables send until there is text", () => {
    render(<MobileTaskAiChat task={baseTask} />)

    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled()
  })

  it("renders the conversation history instead of the empty state", () => {
    render(
      <MobileTaskAiChat
        task={{
          ...baseTask,
          aiChat: [
            { role: "user", content: "Help" },
            { role: "assistant", content: "Start with an outline" },
          ],
        }}
      />,
    )

    expect(screen.queryByText("Ask about this task")).not.toBeInTheDocument()
    expect(screen.getByText("Start with an outline")).toBeInTheDocument()
  })

  it("asks for confirmation before clearing the chat", async () => {
    const user = userEvent.setup()
    render(<MobileTaskAiChat task={{ ...baseTask, aiChat: [{ role: "user", content: "Help" }] }} />)

    await user.click(screen.getByRole("button", { name: "Clear chat" }))
    expect(mocks.clear).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Clear chat" }))
    expect(mocks.clear).toHaveBeenCalledTimes(1)
  })
})
