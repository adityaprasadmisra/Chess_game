import { motion } from "framer-motion"
import { AlertCircle } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router-dom"

import { HolographicWall } from "@/components/ui/holographic-wall-shadcnui"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const EASE = [0.22, 1, 0.36, 1] as const

/** Shared frame for Login and Register so the two can't drift apart. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <>
      <HolographicWall fullscreen intensity={0.7} radius={230} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-surface-void/75 via-surface-void/45 to-surface-void/90"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-1/2 -z-10 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-indigo/15 blur-[130px]"
      />

      <main className="flex min-h-dvh items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="w-full max-w-[26rem]"
        >
          {/* Floats for ambience, but freezes once the pointer or keyboard is
              in the card: a submit button that drifts while you aim at it is a
              moving target, and the motion is distracting mid-typing. */}
          <div className="animate-float [animation-play-state:running] focus-within:[animation-play-state:paused] hover:[animation-play-state:paused] motion-reduce:animate-none">
            <div className="glass rounded-glass-lg p-7 shadow-glass sm:p-8">
              <Link
                to="/"
                className="mb-6 inline-flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald"
              >
                <span className="chess-glyph text-2xl leading-none text-accent-amber">
                  ♚︎
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  Gambit
                </span>
              </Link>

              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>

              <div className="mt-6">{children}</div>
            </div>
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {footer}
          </p>
        </motion.div>
      </main>
    </>
  )
}

/** A labelled field that can show its own error, tied together for a11y. */
export function Field({
  id,
  label,
  error,
  hint,
  ...props
}: {
  id: string
  label: string
  error?: string
  hint?: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground/60">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Form-level error: announced to screen readers, not only coloured red. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-2xl border border-red-400/25 bg-red-400/10 px-3 py-2.5",
        "text-xs text-red-300"
      )}
    >
      <AlertCircle className="mt-px size-3.5 shrink-0" />
      <span>{message}</span>
    </motion.div>
  )
}
