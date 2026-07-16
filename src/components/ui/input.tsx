import * as React from "react"

import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm",
        "text-foreground placeholder:text-muted-foreground/60",
        "transition-colors hover:border-white/20",
        "focus-visible:border-accent-emerald/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald/30",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-[invalid=true]:border-red-400/60 aria-[invalid=true]:focus-visible:ring-red-400/30",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
