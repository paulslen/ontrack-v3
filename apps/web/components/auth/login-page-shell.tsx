import type { CSSProperties, PropsWithChildren } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { PrivacyTermsNotice } from "@/components/legal/privacy-terms-notice"

interface LoginPageShellProps {
  className?: string
  style?: CSSProperties
}

export function LoginPageShell({
  children,
  className,
  style,
}: PropsWithChildren<LoginPageShellProps>) {
  return (
    <div
      data-theme="dark"
      className={cn("relative h-dvh w-full overflow-hidden bg-black", className)}
      style={style}
    >
      {/* Hero image, full-bleed */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/on-track-person.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
      </div>

      {/* Content, floating over the hero */}
      <div className="relative z-10 h-full w-full">
        {/* Decorative ambient glow, minimal drift */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 left-1/4 h-72 w-72 rounded-full bg-emerald-500/10 blur-[110px] will-change-transform animate-[drift_20s_ease-in-out_infinite]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-[-10%] right-1/4 h-64 w-64 rounded-full bg-teal-400/10 blur-[100px] will-change-transform animate-[drift_26s_ease-in-out_infinite_reverse]"
        />

        {/* Decorative floating dots */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]"
        >
          <span className="absolute left-[18%] top-[25%] h-1 w-1 rounded-full bg-emerald-300/70 animate-[float-dot_7s_ease-in-out_infinite]" />
          <span className="absolute left-[78%] top-[20%] h-1 w-1 rounded-full bg-emerald-200/60 animate-[float-dot_9s_ease-in-out_infinite_1s]" />
          <span className="absolute left-[65%] top-[75%] h-1.5 w-1.5 rounded-full bg-teal-300/50 animate-[float-dot_11s_ease-in-out_infinite_0.5s]" />
          <span className="absolute left-[30%] top-[80%] h-1 w-1 rounded-full bg-emerald-300/50 animate-[float-dot_8s_ease-in-out_infinite_2s]" />
          <span className="absolute left-[85%] top-[65%] h-1 w-1 rounded-full bg-emerald-200/40 animate-[float-dot_10s_ease-in-out_infinite_1.5s]" />
          <span className="absolute left-[10%] top-[60%] h-1 w-1 rounded-full bg-teal-300/40 animate-[float-dot_9s_ease-in-out_infinite_3s]" />
        </div>

        {/* Positioned so its vertical center sits ~35% down the viewport */}
        <div className="absolute left-1/2 top-[35%] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 px-4 sm:max-w-md sm:px-6">
          {children}
        </div>
      </div>

      {/* Rendered at the shell root (no filter/transform ancestor) so it truly pins to the viewport corner */}
      <PrivacyTermsNotice className="fixed bottom-4 right-4 z-30 text-white/40" />
    </div>
  )
}
