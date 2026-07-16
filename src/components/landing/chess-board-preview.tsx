import { motion, useReducedMotion } from "framer-motion"
import { useEffect, useState } from "react"

import { asTextGlyph } from "@/lib/chess-symbols"
import { cn } from "@/lib/utils"

/**
 * Decorative board that loops Scholar's Mate. No game logic — the moves are
 * scripted, so this shares nothing with the real board (which will run on
 * chess.js). Kept separate deliberately: a hero animation should never be able
 * to break gameplay.
 *
 * Coordinates are screen-space: row 0 is rank 8, col 0 is file a.
 */

type Piece = { id: string; glyph: string; white: boolean; row: number; col: number }

// Filled glyphs for both sides. The outline set (♔♕♖) disappears against a
// dark board, so white/black are distinguished by fill + stroke instead.
const BACK_RANK = ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"]

const INITIAL: Piece[] = [
  ...BACK_RANK.map((glyph, col) => ({
    id: `b-back-${col}`, glyph, white: false, row: 0, col,
  })),
  ...Array.from({ length: 8 }, (_, col) => ({
    id: `b-pawn-${col}`, glyph: "♟", white: false, row: 1, col,
  })),
  ...Array.from({ length: 8 }, (_, col) => ({
    id: `w-pawn-${col}`, glyph: "♟", white: true, row: 6, col,
  })),
  ...BACK_RANK.map((glyph, col) => ({
    id: `w-back-${col}`, glyph, white: true, row: 7, col,
  })),
]

type Move = { from: [number, number]; to: [number, number]; san: string }

const MOVES: Move[] = [
  { from: [6, 4], to: [4, 4], san: "e4" },
  { from: [1, 4], to: [3, 4], san: "e5" },
  { from: [7, 5], to: [4, 2], san: "Bc4" },
  { from: [0, 1], to: [2, 2], san: "Nc6" },
  { from: [7, 3], to: [3, 7], san: "Qh5" },
  { from: [0, 6], to: [2, 5], san: "Nf6" },
  { from: [3, 7], to: [1, 5], san: "Qxf7#" },
]

/** Replay from the start so the loop can reset without accumulating drift. */
function positionAfter(ply: number): Piece[] {
  let pieces = INITIAL.map((p) => ({ ...p }))
  for (let i = 0; i < ply; i++) {
    const { from, to } = MOVES[i]
    const mover = pieces.find((p) => p.row === from[0] && p.col === from[1])
    if (!mover) continue
    pieces = pieces.filter((p) => !(p.row === to[0] && p.col === to[1]))
    mover.row = to[0]
    mover.col = to[1]
  }
  return pieces
}

const MOVE_MS = 1300
const RESET_MS = 2600

/**
 * The board needs genuine light/dark contrast, not two shades of near-black:
 * a black piece is unreadable on a black square, and the two sides stop being
 * distinguishable at a glance. These are cool slates that sit calmly on the
 * #020617 page while still giving both piece colours something to read against.
 */
const LIGHT_SQUARE = "#9FADC2"
const DARK_SQUARE = "#46566E"
const LAST_MOVE = "#3F7D62"

export function ChessBoardPreview({ className }: { className?: string }) {
  const [ply, setPly] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) return
    const done = ply >= MOVES.length
    const t = setTimeout(
      () => setPly(done ? 0 : ply + 1),
      done ? RESET_MS : MOVE_MS
    )
    return () => clearTimeout(t)
  }, [ply, prefersReducedMotion])

  const pieces = positionAfter(ply)
  const lastMove = ply > 0 ? MOVES[ply - 1] : null
  const isMate = ply === MOVES.length

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="glass relative aspect-square w-full overflow-hidden rounded-glass-lg p-2 shadow-glass">
        <div className="relative h-full w-full overflow-hidden rounded-xl">
          {/* Squares */}
          <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
            {Array.from({ length: 64 }, (_, i) => {
              const row = Math.floor(i / 8)
              const col = i % 8
              const light = (row + col) % 2 === 0
              const isLastSquare =
                lastMove &&
                ((lastMove.to[0] === row && lastMove.to[1] === col) ||
                  (lastMove.from[0] === row && lastMove.from[1] === col))
              return (
                <div
                  key={i}
                  className={cn("transition-colors duration-500")}
                  style={{
                    background: isLastSquare
                      ? LAST_MOVE
                      : light
                        ? LIGHT_SQUARE
                        : DARK_SQUARE,
                  }}
                />
              )
            })}
          </div>

          {/* Pieces */}
          {pieces.map((p) => (
            <motion.div
              key={p.id}
              className="pointer-events-none absolute flex select-none items-center justify-center"
              style={{ width: "12.5%", height: "12.5%" }}
              initial={false}
              animate={{ left: `${p.col * 12.5}%`, top: `${p.row * 12.5}%` }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 210, damping: 24 }
              }
            >
              <span
                className="chess-glyph text-[clamp(1rem,4.2vw,2.25rem)] leading-none"
                style={
                  p.white
                    ? {
                        color: "#FFFFFF",
                        WebkitTextStroke: "0.6px rgba(2,6,23,0.55)",
                        filter: "drop-shadow(0 1px 2px rgba(2,6,23,0.5))",
                      }
                    : {
                        color: "#080D18",
                        filter: "drop-shadow(0 1px 2px rgba(2,6,23,0.4))",
                      }
                }
              >
                {asTextGlyph(p.glyph)}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Move strip — doubles as a caption and hints at the real move history */}
      <div className="flex items-center gap-2 overflow-x-auto px-1 pb-1">
        {MOVES.map((m, i) => (
          <span
            key={m.san}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs tabular-nums transition-colors duration-300",
              i < ply
                ? "text-foreground/70"
                : "text-muted-foreground/30",
              i === ply - 1 &&
                (isMate
                  ? "bg-accent-amber/20 text-accent-amber"
                  : "bg-accent-emerald/15 text-accent-emerald")
            )}
          >
            {i % 2 === 0 && (
              <span className="mr-1 text-muted-foreground/50">
                {i / 2 + 1}.
              </span>
            )}
            {m.san}
          </span>
        ))}
      </div>
    </div>
  )
}
