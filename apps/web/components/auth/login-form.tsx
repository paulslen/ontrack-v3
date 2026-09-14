"use client"

import React, { useState } from "react"
import { signIn } from "next-auth/react"
import { toast } from "@/lib/toast"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@tasktrove/i18n"
import { API_ROUTES } from "@tasktrove/types/constants"
import { cn } from "@/lib/utils"

const inputFieldClassName =
  "bg-white/5 border-white/15 text-white placeholder:text-white/40 focus-visible:border-emerald-400/50 focus-visible:ring-emerald-400/20"

export type LoginFormProps = {
  needsPasswordSetup: boolean
  onSuccess?: () => void
  onCancel?: () => void
  username?: string
  onUsernameChange?: (value: string) => void
  isUsernameRequired?: boolean
  headerAuthUser?: string | null
  /** optional override to perform login instead of NextAuth credentials */
  onLogin?: (input: { username?: string; password: string }) => Promise<void>
  /** allow editing a prefilled username during setup/login */
  usernameEditableWhenPrefilled?: boolean
  /** slot for consumers to inject additional form fields */
  extraFields?: React.ReactNode
  /** placement for extraFields; default places after core inputs */
  extraFieldsPlacement?: "before" | "after"
}

export function LoginForm({
  needsPasswordSetup: initialNeedsPasswordSetup,
  onSuccess,
  username = "",
  onUsernameChange,
  isUsernameRequired = false,
  headerAuthUser,
  onLogin,
  usernameEditableWhenPrefilled = false,
  extraFields,
  extraFieldsPlacement = "after",
}: LoginFormProps) {
  // Translation hooks
  const { t } = useTranslation("auth")

  // Local state to track if password setup is still needed
  // This allows us to transition from setup mode to login mode after password is set
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(initialNeedsPasswordSetup)

  // Form state
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Compute whether username change should be disabled (when username is pre-filled)
  const usernameChangeDisabled =
    !usernameEditableWhenPrefilled && isUsernameRequired && username !== ""

  // Check if this is SSO header auth mode
  // Note: Password setup takes priority over SSO header auth for first-time setup
  const isHeaderAuthMode = !!headerAuthUser && !needsPasswordSetup

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (isUsernameRequired && !username) {
      setError(t("errors.usernameRequired", "Username is required"))
      return
    }

    if (!password) {
      setError(t("errors.passwordRequired", "Password is required"))
      return
    }

    // If user needs to set up password, handle password setup
    if (needsPasswordSetup) {
      // Validate password confirmation
      if (password !== confirmPassword) {
        setError(t("errors.passwordMismatch", "Passwords do not match"))
        return
      }

      setIsLoading(true)
      try {
        // Set up password using initial-setup endpoint
        const response = await fetch(API_ROUTES.INITIAL_SETUP, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(isUsernameRequired && { username }),
            password: password,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to set up password")
        }

        await response.json()

        toast.success(
          t("messages.passwordSetSuccess", "Password set successfully! Please sign in."),
        )

        // Clear form and switch to login mode
        setPassword("")
        setConfirmPassword("")
        setNeedsPasswordSetup(false)

        // Note: needsPasswordSetup is now false, so form will switch to login mode
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : t("errors.passwordSetupFailed", "Failed to set password. Please try again."),
        )
      } finally {
        setIsLoading(false)
      }
      return
    }
    // Normal login flow
    setIsLoading(true)
    try {
      if (onLogin) {
        await onLogin({ username, password })
        toast.success(t("messages.loginSuccess", "Login successful"))
        onSuccess?.()
        return
      }

      const result = await signIn("credentials", {
        ...(isUsernameRequired && { username }),
        password,
        redirect: false,
      })

      if (result.error) {
        setError(
          isUsernameRequired
            ? t("errors.invalidCredentials", "Invalid username or password. Please try again.")
            : t("errors.invalidPassword", "Invalid password. Please try again."),
        )
        setIsLoading(false)
        setPassword("")
      } else {
        toast.success(t("messages.loginSuccess", "Login successful"))
        onSuccess?.()
      }
    } catch (error) {
      setError(t("errors.loginFailed", "Login failed. Please check your credentials."))
      console.error("Login error:", error)
      setIsLoading(false)
      setPassword("")
    }
  }

  return (
    <div className="flex w-full items-center justify-center">
      <Card className="w-full max-w-md gap-0 border-none bg-black/60 shadow-none backdrop-blur-md">
        <CardContent className="p-6">
          {isHeaderAuthMode ? (
            // SSO Header Auth Mode
            <div className="space-y-6 max-w-xs mx-auto">
              <p className="text-center font-sans text-base font-bold tracking-tight text-white/90">
                welcome, please authenticate
              </p>
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center p-4 bg-white/5 border border-white/10 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm text-white/50 mb-1">Authenticated as</p>
                    <p className="font-semibold text-lg text-white">{headerAuthUser}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      setIsLoading(true)
                      try {
                        await signIn("header-auth", {
                          remoteUser: headerAuthUser,
                          redirect: true,
                          callbackUrl: "/",
                        })
                      } catch (error) {
                        console.error("[Header Auth] Sign-in exception:", error)
                        setError("Authentication failed. Please try again.")
                      } finally {
                        setIsLoading(false)
                      }
                    }}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {isLoading ? "Signing in..." : "SSO Sign In"}
                  </Button>
                  {error && <p className="text-sm text-red-500 text-center">{error}</p>}
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2 max-w-64 mx-auto">
              {extraFields && extraFieldsPlacement === "before" ? (
                <div className="space-y-2">{extraFields}</div>
              ) : null}
              {needsPasswordSetup ? (
                // Password Setup Mode
                <>
                  <div className="text-center space-y-2 mb-4">
                    <p className="font-sans text-base font-bold tracking-tight text-white/90">
                      {t("setup.title", "First Time Setup")}
                    </p>
                    <p className="text-sm text-white/50">
                      {t(
                        "setup.description",
                        "Welcome! Let's complete your initial setup to get started.",
                      )}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {isUsernameRequired && onUsernameChange && (
                      <div className="space-y-2">
                        <Input
                          id="username"
                          type="text"
                          placeholder={t("setup.usernamePlaceholder", "Username")}
                          value={username}
                          onChange={(e) => onUsernameChange(e.target.value)}
                          disabled={isLoading || usernameChangeDisabled}
                          className={cn(inputFieldClassName, error && "border-red-500")}
                          autoFocus={true}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          placeholder={t("setup.passwordPlaceholder", "Create Password")}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          disabled={isLoading}
                          className={cn(
                            inputFieldClassName,
                            password.length > 0 && "pr-10",
                            error && "border-red-500",
                          )}
                          autoFocus={!isUsernameRequired}
                        />
                        {password.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={
                              showPassword
                                ? t("accessibility.hidePassword", "Hide password")
                                : t("accessibility.showPassword", "Show password")
                            }
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Input
                        id="confirmPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("setup.confirmPasswordPlaceholder", "Confirm Password")}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        className={cn(inputFieldClassName, error && "border-red-500")}
                      />
                    </div>
                    {error && <p className="text-sm text-red-500">{error}</p>}
                  </div>
                </>
              ) : (
                // Normal Login Mode
                <>
                  <p className="text-left font-sans text-base font-bold tracking-tight text-white/90 mb-3">
                    welcome, please authenticate
                  </p>
                  {isUsernameRequired && onUsernameChange && (
                    <div className="space-y-2">
                      <Input
                        id="username"
                        type="text"
                        placeholder={t("login.usernamePlaceholder", "Username")}
                        value={username}
                        onChange={(e) => onUsernameChange(e.target.value)}
                        disabled={isLoading}
                        className={cn(inputFieldClassName, error && "border-red-500")}
                        autoFocus={true}
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={t("login.passwordPlaceholder", "Password")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        className={cn(
                          inputFieldClassName,
                          password.length > 0 && "pr-10",
                          error && "border-red-500",
                        )}
                        autoFocus={!isUsernameRequired}
                      />
                      {password.length > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword
                              ? t("accessibility.hidePassword", "Hide password")
                              : t("accessibility.showPassword", "Show password")
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </>
              )}
              {extraFields && extraFieldsPlacement === "after" ? (
                <div className="space-y-2">{extraFields}</div>
              ) : null}
              <Button
                type="submit"
                className="w-full bg-zinc-900 text-white border border-white/10 hover:bg-zinc-800 transition-shadow hover:shadow-[0_0_24px_rgba(16,185,129,0.35)]"
                disabled={isLoading}
              >
                {isLoading
                  ? needsPasswordSetup
                    ? t("buttons.settingUp", "Setting up...")
                    : t("buttons.signingIn", "Signing in...")
                  : needsPasswordSetup
                    ? t("buttons.initialize", "Initialize")
                    : t("buttons.signIn", "Sign In")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
