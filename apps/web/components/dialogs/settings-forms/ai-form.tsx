"use client"

import { useState } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { Eye, EyeOff, Bot } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SettingsCard } from "@/components/ui/custom/settings-card"
import { settingsAtom } from "@tasktrove/atoms/data/base/atoms"
import { updateSettingsAtom } from "@tasktrove/atoms/core/settings"
import type { AiModel } from "@tasktrove/types/settings"

const AI_MODEL_LABELS: Record<AiModel, string> = {
  "claude-haiku-4-5": "Claude Haiku 4.5 (Fast)",
  "claude-sonnet-4-6": "Claude Sonnet 4.6 (Balanced)",
}

const CONTEXT_FILE_PLACEHOLDER = `# About Me
I'm a [your role] at [Company Name].

# My Work
[Describe what you do, your team, and common tasks]

# Communication Style
[Describe your preferred tone, formality level, etc.]

# Context
[Any other context that helps AI understand your work]`

export function AiForm() {
  const settings = useAtomValue(settingsAtom)
  const updateSettings = useSetAtom(updateSettingsAtom)
  const [showApiKey, setShowApiKey] = useState(false)

  const ai = settings.ai

  const handleEnabledChange = (enabled: boolean) => {
    updateSettings({ ai: { enabled } })
  }

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSettings({ ai: { apiKey: e.target.value } })
  }

  const handleModelChange = (model: AiModel) => {
    updateSettings({ ai: { model } })
  }

  const handleContextFileChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateSettings({ ai: { contextFile: e.target.value } })
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        title="Enable AI"
        description="Use AI to expand task descriptions into actionable content."
      >
        <div className="flex items-center justify-between">
          <Label htmlFor="ai-enabled">Enable AI</Label>
          <Switch id="ai-enabled" checked={ai.enabled} onCheckedChange={handleEnabledChange} />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Anthropic API Key"
        description="Your API key is stored server-side and never sent to the browser."
      >
        <div className="flex gap-2 items-center mt-2">
          <div className="relative flex-1">
            <Input
              id="ai-api-key"
              type={showApiKey ? "text" : "password"}
              value={ai.apiKey ?? ""}
              onChange={handleApiKeyChange}
              placeholder="sk-ant-..."
              className="pr-10 font-mono text-sm"
              disabled={!ai.enabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
              onClick={() => setShowApiKey((v) => !v)}
              disabled={!ai.enabled}
            >
              {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              <span className="sr-only">{showApiKey ? "Hide" : "Show"} API key</span>
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">
          Get your API key at{" "}
          <a
            href="https://console.anthropic.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            console.anthropic.com
          </a>
        </p>
      </SettingsCard>

      <SettingsCard
        title="Model"
        description="Haiku is faster and cheaper. Sonnet is more capable for complex tasks."
      >
        <div className="mt-2">
          <Select value={ai.model} onValueChange={handleModelChange} disabled={!ai.enabled}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(AI_MODEL_LABELS) as AiModel[]).map((model) => (
                <SelectItem key={model} value={model}>
                  {AI_MODEL_LABELS[model]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Context File"
        description="Markdown describing who you are, your company, and your work. This is sent to the AI with every request and cached for efficiency."
      >
        <div className="mt-2 space-y-1.5">
          <Textarea
            value={ai.contextFile ?? ""}
            onChange={handleContextFileChange}
            placeholder={CONTEXT_FILE_PLACEHOLDER}
            className="min-h-[240px] font-mono text-sm resize-y"
            disabled={!ai.enabled}
          />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bot className="size-3" />
            <span>
              Supports Markdown. This context is cached — updating it will briefly increase API cost
              for one request.
            </span>
          </div>
        </div>
      </SettingsCard>
    </div>
  )
}
