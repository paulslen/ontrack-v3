"use server"

import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { createTaskId } from "@tasktrove/types/id"
import { DEFAULT_TASK_PRIORITY, DEFAULT_TASK_COMPLETED } from "@tasktrove/constants"
import { safeReadDataFile, safeWriteDataFile } from "@/lib/utils/safe-file-operations"
import { sendMessage } from "@/lib/telegram/client"
import type { Task } from "@tasktrove/types/core"

function isAuthorizedChat(chatId: number): boolean {
  const authorizedId = process.env.TELEGRAM_CHAT_ID
  return Boolean(authorizedId && String(chatId) === authorizedId)
}

async function handleAddTask(title: string, chatId: number): Promise<void> {
  const newTask: Task = {
    id: createTaskId(uuidv4()),
    title,
    completed: DEFAULT_TASK_COMPLETED,
    priority: DEFAULT_TASK_PRIORITY,
    labels: [],
    subtasks: [],
    comments: [],
    createdAt: new Date(),
    recurringMode: "dueDate",
  }

  const fileData = await safeReadDataFile()
  if (!fileData) {
    await sendMessage(chatId, "Failed to read data. Please try again.")
    return
  }

  fileData.tasks.push(newTask)
  const success = await safeWriteDataFile({ data: fileData })

  if (success) {
    await sendMessage(chatId, `Task added: "${title}"`)
  } else {
    await sendMessage(chatId, "Failed to save task. Please try again.")
  }
}

async function handleTaskCount(chatId: number): Promise<void> {
  const fileData = await safeReadDataFile()
  if (!fileData) {
    await sendMessage(chatId, "Failed to read data. Please try again.")
    return
  }

  const count = fileData.tasks.filter((t) => !t.completed && !t.archived).length
  await sendMessage(chatId, `You have ${count} incomplete task${count === 1 ? "" : "s"}.`)
}

async function handleHelp(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    [
      "Available commands:",
      "• add task <title> — Add a new task",
      "• task count — Show number of incomplete tasks",
    ].join("\n"),
  )
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = (body as Record<string, unknown>)?.message as Record<string, unknown> | undefined
  const chatId = (message?.chat as Record<string, unknown>)?.id as number | undefined
  const text = ((message?.text as string | undefined) ?? "").trim()

  if (!chatId || !text) {
    return NextResponse.json({ ok: true })
  }

  if (!isAuthorizedChat(chatId)) {
    return NextResponse.json({ ok: true })
  }

  const lower = text.toLowerCase()

  if (lower.startsWith("add task ")) {
    const title = text.slice("add task ".length).trim()
    if (title) {
      await handleAddTask(title, chatId)
    } else {
      await sendMessage(chatId, "Please provide a task title. Example: add task water the plants")
    }
  } else if (lower === "task count") {
    await handleTaskCount(chatId)
  } else {
    await handleHelp(chatId)
  }

  return NextResponse.json({ ok: true })
}
