import { Chess, type Square } from "chess.js"
import { motion } from "framer-motion"

import {
  CHECK_SQUARE,
  DARK_SQUARE,
  LAST_MOVE,
  LIGHT_SQUARE,
  PIECE_GLYPH,
  pieceStyle,
} from "@/lib/board-theme"
import { asTextGlyph } from "@/lib/chess-symbols"
import { cn } from "@/lib/utils"

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const

export function squareAt(row: number, col: number): Square {
  return `${FILES[col]}${8 - row}` as Square
}

type ChessBoardProps = {
  game: Chess
  selected: Square | null
  targets: Square[]
  lastMove: { from: Square; to: Square } | null
  checkSquare: Square | null
  onSquareClick: (square: Square) => void
  /** Draw from black's point of view. */
  flipped?: boolean
}

export function ChessBoard({
  game,
  selected,
  targets,
  lastMove,
  checkSquare,
  onSquareClick,
  flipped = false,
}: ChessBoardProps) {
  const board = game.board()

  return (
    <div className="glass rounded-glass-lg p-2 shadow-glass sm:p-3">
      <div className="relative aspect-square w-full overflow-hidden rounded-xl">
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
          {Array.from({ length: 64 }, (_, i) => {
            const drawRow = Math.floor(i / 8)
            const drawCol = i % 8
            // Flipping only changes which board square each cell draws.
            const row = flipped ? 7 - drawRow : drawRow
            const col = flipped ? 7 - drawCol : drawCol
            const square = squareAt(row, col)
            const piece = board[row][col]
            const light = (row + col) % 2 === 0
            const isTarget = targets.includes(square)
            const isSelected = selected === square
            const isLast =
              lastMove && (lastMove.from === square || lastMove.to === square)

            let bg = light ? LIGHT_SQUARE : DARK_SQUARE
            if (isLast) bg = LAST_MOVE
            if (checkSquare === square) bg = CHECK_SQUARE

            return (
              <button
                key={square}
                type="button"
                onClick={() => onSquareClick(square)}
                aria-label={
                  piece
                    ? `${square}, ${piece.color === "w" ? "white" : "black"} ${piece.type}`
                    : square
                }
                className={cn(
                  "relative flex items-center justify-center transition-colors duration-200",
                  "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-emerald",
                  isSelected && "ring-2 ring-inset ring-accent-amber"
                )}
                style={{ background: bg }}
              >
                {piece && (
                  <motion.span
                    // Keyed by square so a replaced piece re-mounts rather than
                    // animating a capture into the capturing piece.
                    key={`${square}-${piece.color}${piece.type}`}
                    initial={{ scale: 0.82, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.16 }}
                    className="chess-glyph pointer-events-none select-none text-[clamp(1.35rem,6.2vw,2.9rem)] leading-none"
                    style={pieceStyle(piece.color === "w")}
                  >
                    {asTextGlyph(PIECE_GLYPH[piece.type])}
                  </motion.span>
                )}

                {/* Legal-move affordance: a dot on empty squares, a ring on
                    captures — the distinction reads faster than a dot alone. */}
                {isTarget && !piece && (
                  <span className="pointer-events-none absolute size-[22%] rounded-full bg-surface-void/45" />
                )}
                {isTarget && piece && (
                  <span className="pointer-events-none absolute inset-[6%] rounded-full border-[3px] border-surface-void/45" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Coordinates */}
      <div className="mt-1.5 grid grid-cols-8 px-1">
        {(flipped ? [...FILES].reverse() : FILES).map((f) => (
          <span
            key={f}
            className="text-center text-[0.65rem] uppercase tracking-wider text-muted-foreground"
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}
