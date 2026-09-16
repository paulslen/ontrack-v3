import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@/test-utils"
import { TaskTroveLogo } from "./tasktrove-logo"

describe("TaskTroveLogo", () => {
  it("renders the TaskTrove logo image", () => {
    render(<TaskTroveLogo />)
    const image = screen.getByAltText("TaskTrove")
    expect(image).toBeInTheDocument()
    expect(image.tagName).toBe("IMG")
  })

  it("applies default medium size dimensions", () => {
    render(<TaskTroveLogo />)
    const image = screen.getByAltText("TaskTrove")
    expect(image).toHaveAttribute("width", "150")
    expect(image).toHaveAttribute("height", "38")
  })

  it("applies small size dimensions when size is sm", () => {
    render(<TaskTroveLogo size="sm" />)
    const image = screen.getByAltText("TaskTrove")
    expect(image).toHaveAttribute("width", "120")
    expect(image).toHaveAttribute("height", "30")
  })

  it("applies large size dimensions when size is lg", () => {
    render(<TaskTroveLogo size="lg" />)
    const image = screen.getByAltText("TaskTrove")
    expect(image).toHaveAttribute("width", "180")
    expect(image).toHaveAttribute("height", "45")
  })

  it("applies custom className to the heading wrapper", () => {
    render(<TaskTroveLogo className="custom-class" />)
    const heading = screen.getByRole("heading")
    expect(heading).toHaveClass("custom-class")
  })

  it("renders as h1 element", () => {
    render(<TaskTroveLogo />)
    const heading = screen.getByRole("heading")
    expect(heading.tagName).toBe("H1")
  })

  it("renders optional badge content", () => {
    render(<TaskTroveLogo badge={<span>Beta</span>} />)
    expect(screen.getByText("Beta")).toBeInTheDocument()
  })

  it("wraps the image with the flicker/underline hover effect", () => {
    render(<TaskTroveLogo />)
    const image = screen.getByAltText("TaskTrove")
    const flickerWrapper = image.closest("span")
    expect(flickerWrapper).not.toBeNull()
    expect(flickerWrapper).toHaveClass("relative")
    expect(flickerWrapper?.className).toMatch(/after:content-/)
    expect(flickerWrapper).toHaveClass("hover:after:h-[2px]")
  })
})
