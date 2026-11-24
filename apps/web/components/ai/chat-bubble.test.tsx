import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ChatBubble, ThinkingIndicator } from "./chat-bubble"

describe("ChatBubble", () => {
  it("renders user messages as a right-aligned bubble", () => {
    render(<ChatBubble role="user" content="Plan my day" />)

    const bubble = screen.getByText("Plan my day")
    expect(bubble).toHaveClass("rounded-2xl")
    expect(bubble.parentElement).toHaveClass("justify-end")
  })

  it("renders assistant replies as markdown", () => {
    render(<ChatBubble role="assistant" content="**Done** for today" />)

    expect(screen.getByText("Done").tagName).toBe("STRONG")
  })
})

describe("ThinkingIndicator", () => {
  it("shows a default label", () => {
    render(<ThinkingIndicator />)
    expect(screen.getByRole("status")).toHaveTextContent("Thinking...")
  })

  it("shows a custom label", () => {
    render(<ThinkingIndicator label="Searching tasks..." />)
    expect(screen.getByRole("status")).toHaveTextContent("Searching tasks...")
  })
})
