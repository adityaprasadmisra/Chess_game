import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"

import { CHESS_SYMBOLS, asTextGlyph } from "@/lib/chess-symbols"
import { cn } from "@/lib/utils"

type HolographicWallProps = {
  intensity?: number
  radius?: number
  /**
   * Render as a fixed, full-viewport background layer behind page content
   * instead of the default self-contained card. In this mode the pointer is
   * tracked on the window, because foreground content would otherwise swallow
   * the events and kill the glow wherever it overlaps.
   */
  fullscreen?: boolean
  className?: string
}

/** Amber (#F59E0B) from the design palette, in place of the original gold. */
const GLOW_RGB = "245, 158, 11"

/** Target spacing between glyphs, in px. Held roughly constant at any size. */
const CELL_PX = 56

/** Ceiling on glyph count; spacing relaxes past this so ultrawide stays smooth. */
const MAX_GLYPHS = 800

/**
 * Deterministic glyph per grid cell. Math.random() would reshuffle the entire
 * wall on every resize tick, which reads as flickering.
 */
function glyphFor(col: number, row: number) {
  const hash = Math.abs(Math.sin(col * 127.1 + row * 311.7) * 43758.5453)
  return CHESS_SYMBOLS[Math.floor((hash % 1) * CHESS_SYMBOLS.length)]
}

export function HolographicWall({
  intensity = 0.8,
  radius = 200,
  fullscreen = false,
  className,
}: HolographicWallProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState<{
    x: number
    y: number
  } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const prefersReducedMotion = useReducedMotion()

  // Measure the container so the grid tracks the real box at any viewport.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const letters = useMemo(() => {
    const { width, height } = size
    if (!width || !height) return []

    // Relax spacing until the glyph count is under the cap.
    let cell = CELL_PX
    let cols = Math.max(1, Math.round(width / cell))
    let rows = Math.max(1, Math.round(height / cell))
    while (cols * rows > MAX_GLYPHS) {
      cell *= 1.15
      cols = Math.max(1, Math.round(width / cell))
      rows = Math.max(1, Math.round(height / cell))
    }

    // Divide the box into `cols` slots and place inside each, so the last glyph
    // lands at width - stepX. Positioning at i * cell instead would push the
    // final column past the edge and scroll the whole page sideways — the
    // parent's overflow:hidden does not contain it.
    const stepX = width / cols
    const stepY = height / rows

    const result: Array<{ char: string; x: number; y: number }> = []
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        result.push({ char: glyphFor(i, j), x: i * stepX, y: j * stepY })
      }
    }
    return result
  }, [size])

  // Pointer tracking, rAF-throttled: a move event fires far more often than we
  // can paint, and each update re-renders every glyph.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let frame = 0
    const handleMove = (e: PointerEvent) => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const rect = el.getBoundingClientRect()
        setMousePosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
      })
    }
    const handleLeave = () => setMousePosition(null)

    // Fullscreen tracks the window so foreground content can't swallow moves.
    // pointerleave is bound to <html> rather than window either way: it does
    // not bubble and never fires on window, so the glow would otherwise freeze
    // in place when the cursor exits the viewport.
    const moveTarget: Window | HTMLDivElement = fullscreen ? window : el
    const leaveTarget: HTMLElement = fullscreen ? document.documentElement : el

    moveTarget.addEventListener("pointermove", handleMove as EventListener)
    leaveTarget.addEventListener("pointerleave", handleLeave)
    return () => {
      moveTarget.removeEventListener("pointermove", handleMove as EventListener)
      leaveTarget.removeEventListener("pointerleave", handleLeave)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [fullscreen])

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        fullscreen
          ? "fixed inset-0 -z-10 bg-surface-void"
          : "h-96 w-full rounded-2xl border border-border bg-black",
        className
      )}
    >
      {/* Chess glyphs on the wall */}
      <div className="absolute inset-0">
        {letters.map((letter, index) => {
          const distance = mousePosition
            ? Math.sqrt(
                Math.pow(letter.x - mousePosition.x, 2) +
                  Math.pow(letter.y - mousePosition.y, 2)
              )
            : Infinity
          const lit = distance < radius
          const letterIntensity = lit
            ? Math.max(0, 1 - distance / radius) * intensity
            : 0

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0.15 }}
              animate={{
                opacity: lit ? 0.15 + letterIntensity : 0.15,
                scale: lit && !prefersReducedMotion ? 1.3 : 1,
                color: lit
                  ? `rgba(${GLOW_RGB}, ${0.3 + letterIntensity})`
                  : "rgba(200, 200, 200, 0.15)",
              }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 500, damping: 30 }
              }
              className="chess-glyph pointer-events-none absolute select-none text-sm"
              style={{
                left: letter.x,
                top: letter.y,
                textShadow: lit
                  ? `0 0 ${letterIntensity * 25}px rgba(${GLOW_RGB}, ${letterIntensity})`
                  : "none",
              }}
            >
              {asTextGlyph(letter.char)}
            </motion.div>
          )
        })}
      </div>

      {/* Cursor light reflection - only around cursor */}
      {mousePosition && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: intensity }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute inset-0"
        >
          <div
            className="absolute"
            style={{
              left: mousePosition.x,
              top: mousePosition.y,
              width: `${radius * 2}px`,
              height: `${radius * 2}px`,
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, rgba(${GLOW_RGB}, 0.6) 0%, rgba(${GLOW_RGB}, 0.3) 30%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />
        </motion.div>
      )}
    </div>
  )
}

export default HolographicWall
