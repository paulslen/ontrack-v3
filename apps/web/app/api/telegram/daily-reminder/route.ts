"use server"

import { type NextRequest, NextResponse } from "next/server"
import { safeReadDataFile } from "@/lib/utils/safe-file-operations"
import { sendMessage } from "@/lib/telegram/client"
import type { Task } from "@tasktrove/types/core"

function getTodayInEastern(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

function formatDateInEastern(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = result[i]
    const b = result[j]
    if (a !== undefined && b !== undefined) {
      result[i] = b
      result[j] = a
    }
  }
  return result
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get("authorization")
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!chatId) {
    return NextResponse.json({ error: "TELEGRAM_CHAT_ID not set" }, { status: 500 })
  }

  const fileData = await safeReadDataFile()
  if (!fileData) {
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 })
  }

  const activeTasks = fileData.tasks.filter((t) => !t.completed && !t.archived)

  if (activeTasks.length === 0) {
    await sendMessage(Number(chatId), "Good morning! You have no incomplete tasks. Enjoy your day!")
    return NextResponse.json({ ok: true })
  }

  const today = getTodayInEastern()

  // 5 oldest tasks by createdAt
  const oldest5 = [...activeTasks]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, 5)

  // Tasks due today
  const dueToday = activeTasks.filter((t) => {
    if (!t.dueDate) return false
    return formatDateInEastern(t.dueDate) === today
  })

  // Deduplicated union of oldest5 + dueToday
  const featured = new Map<string, Task>()
  for (const t of [...oldest5, ...dueToday]) {
    featured.set(t.id, t)
  }

  // One random task from what's left
  const remaining = activeTasks.filter((t) => !featured.has(t.id))
  if (remaining.length > 0) {
    const pick = remaining[Math.floor(Math.random() * remaining.length)]
    if (pick) {
      featured.set(pick.id, pick)
    }
  }

  const tasks = shuffle(Array.from(featured.values()))
  const taskList = tasks.map((t) => `• ${t.title}`).join("\n")

  await sendMessage(Number(chatId), `Good morning! Here are your tasks for today:\n\n${taskList}`)

  return NextResponse.json({ ok: true })
}
