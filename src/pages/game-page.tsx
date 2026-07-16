import { Chess, type Color, type PieceSymbol, type Square } from "chess.js"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, FlipVertical2, RotateCcw, Undo2 } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { Link } from "react-router-dom"

import { ChessBoard } from "@/components/game/chess-board"
import { Button } from "@/components/ui/button"
import { HolographicWall } from "@/components/ui/holographic-wall-shadcnui"
import { PIECE_GLYPH, pieceStyle } from "@/lib/board-theme"
import { asTextGlyph } from "@/lib/chess-symbols"
import { cn } from "@/lib/utils"

const PROMOTION_CHOICES: PieceSymbol[] = ["q", "r", "b", "n"]
/** Standard relative values, used only for the material-difference readout. */
const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

function kingSquare(game: Chess, color: Color): Square | null {
  for (const row of game.board()) {
    for (const cell of row) {
      if (cell && cell.type === "k" && cell.color === color) return cell.square
    }
  }
  return null
}

/** Describes the position in the language a player would use. */
function statusOf(game: Chess): { text: string; tone: "normal" | "warn" | "over" } {
  const mover = game.turn() === "w" ? "White" : "Black"
  if (game.isCheckmate()) {
    const winner = game.turn() === "w" ? "Black" : "White"
    return { text: `Checkmate — ${winner} wins`, tone: "over" }
  }
  if (game.isStalemate()) return { text: "Stalemate — draw", tone: "over" }
  if (game.isInsufficientMaterial())
    return { text: "Draw — insufficient material", tone: "over" }
  if (game.isThreefoldRepetition())
    return { text: "Draw — threefold repetition", tone: "over" }
  if (game.isDraw()) return { text: "Draw — fifty-move rule", tone: "over" }
  if (game.inCheck()) return { text: `${mover} is in check`, tone: "warn" }
  return { text: `${mover} to move`, tone: "normal" }
}

export function GamePage() {
  const gameRef = useRef(new Chess())
  const [, setTick] = useState(0)
  const [selected, setSelected] = useState<Square | null>(null)
  const [targets, setTargets] = useState<Square[]>([])
  const [flipped, setFlipped] = useState(false)
  const [pending, setPending] = useState<{ from: Square; to: Square } | null>(null)

  const game = gameRef.current
  const rerender = useCallback(() => setTick((t) => t + 1), [])

  const clearSelection = () => {
    setSelected(null)
    setTargets([])
  }

  const select = (square: Square) => {
    const moves = game.moves({ square, verbose: true })
    setSelected(square)
    setTargets(moves.map((m) => m.to))
  }

  const handleSquareClick = (square: Square) => {
    if (pending) return
    if (game.isGameOver()) return

    const piece = game.get(square)

    if (!selected) {
      if (piece && piece.color === game.turn()) select(square)
      return
    }

    if (square === selected) return clearSelection()

    const legal = game
      .moves({ square: selected, verbose: true })
      .filter((m) => m.to === square)

    if (legal.length === 0) {
      // Re-select instead of deselecting — clicking another of your own pieces
      // almost always means "I meant this one".
      if (piece && piece.color === game.turn()) select(square)
      else clearSelection()
      return
    }

    // Underpromotion is a real move; ask rather than always queening.
    if (legal.some((m) => m.promotion)) {
      setPending({ from: selected, to: square })
      clearSelection()
      return
    }

    game.move({ from: selected, to: square })
    clearSelection()
    rerender()
  }

  const completePromotion = (promotion: PieceSymbol) => {
    if (!pending) return
    game.move({ from: pending.from, to: pending.to, promotion })
    setPending(null)
    rerender()
  }

  const newGame = () => {
    gameRef.current = new Chess()
    clearSelection()
    setPending(null)
    rerender()
  }

  const undo = () => {
    game.undo()
    clearSelection()
    setPending(null)
    rerender()
  }

  const history = game.history({ verbose: true })
  const last = history[history.length - 1]
  const status = statusOf(game)
  const checkSquare =
    game.inCheck() && !game.isCheckmate() ? kingSquare(game, game.turn()) : null
  const mateSquare = game.isCheckmate() ? kingSquare(game, game.turn()) : null

  // Captured pieces, grouped by who lost them.
  const lostBy = (color: Color) =>
    history
      .filter((m) => m.captured && m.color !== color)
      .map((m) => m.captured as PieceSymbol)

  const material = (color: Color) =>
    lostBy(color === "w" ? "b" : "w").reduce((n, p) => n + VALUE[p], 0)
  const edge = material("w") - material("b")

  // Pair the SAN list into numbered full moves.
  const rows: Array<{ n: number; w?: string; b?: string }> = []
  history.forEach((m, i) => {
    const n = Math.floor(i / 2)
    rows[n] = rows[n] ?? { n: n + 1 }
    if (i % 2 === 0) rows[n].w = m.san
    else rows[n].b = m.san
  })

  return (
    <>
      <HolographicWall fullscreen intensity={0.55} radius={220} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-surface-void/85 via-surface-void/70 to-surface-void/90"
      />

      <main className="mx-auto min-h-dvh max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft />
              Back
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="glass" size="sm" onClick={() => setFlipped((f) => !f)}>
              <FlipVertical2 />
              <span className="hidden sm:inline">Flip</span>
            </Button>
            <Button
              variant="glass"
              size="sm"
              onClick={undo}
              disabled={history.length === 0}
            >
              <Undo2 />
              <span className="hidden sm:inline">Undo</span>
            </Button>
            <Button variant="primary" size="sm" onClick={newGame}>
              <RotateCcw />
              New game
            </Button>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* Board + the two players' rails.
              The board is square, so its width sets its height — left free it
              grows past the viewport and pushes a player rail below the fold.
              Cap the width by the height actually available instead. */}
          <div className="mx-auto flex w-full min-w-0 max-w-[min(100%,calc(100dvh-16rem))] flex-col gap-3 lg:mx-0">
            <PlayerRail
              name="Black"
              white={false}
              toMove={game.turn() === "b" && !game.isGameOver()}
              captured={lostBy("w")}
              edge={-edge}
            />

            <div className="relative">
              <ChessBoard
                game={game}
                selected={selected}
                targets={targets}
                lastMove={last ? { from: last.from, to: last.to } : null}
                checkSquare={checkSquare ?? mateSquare}
                onSquareClick={handleSquareClick}
                flipped={flipped}
              />

              {/* Promotion picker */}
              <AnimatePresence>
                {pending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex items-center justify-center rounded-glass-lg bg-surface-void/70 backdrop-blur-sm"
                  >
                    <motion.div
                      initial={{ scale: 0.94, y: 8 }}
                      animate={{ scale: 1, y: 0 }}
                      className="glass flex flex-col gap-3 rounded-glass p-4"
                    >
                      <p className="text-center text-sm text-muted-foreground">
                        Promote to
                      </p>
                      <div className="flex gap-2">
                        {PROMOTION_CHOICES.map((p) => (
                          <button
                            key={p}
                            onClick={() => completePromotion(p)}
                            aria-label={`Promote to ${p}`}
                            className="flex size-14 items-center justify-center rounded-2xl bg-white/5 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald"
                          >
                            <span
                              className="chess-glyph text-3xl leading-none"
                              style={pieceStyle(game.turn() === "w")}
                            >
                              {asTextGlyph(PIECE_GLYPH[p])}
                            </span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <PlayerRail
              name="White"
              white
              toMove={game.turn() === "w" && !game.isGameOver()}
              captured={lostBy("b")}
              edge={edge}
            />
          </div>

          {/* Side panel */}
          <aside className="flex min-w-0 flex-col gap-4">
            <div className="glass rounded-glass p-4 shadow-glass">
              <p
                className={cn(
                  "text-sm font-medium",
                  status.tone === "over" && "text-accent-amber",
                  status.tone === "warn" && "text-accent-emerald",
                  status.tone === "normal" && "text-foreground"
                )}
              >
                {status.text}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Two players, one board — take turns on this device.
              </p>
            </div>

            <div className="glass flex min-h-[12rem] flex-col rounded-glass p-4 shadow-glass lg:max-h-[26rem]">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Moves
              </h2>
              {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground/60">
                  No moves yet. White starts.
                </p>
              ) : (
                <ol className="flex flex-col gap-0.5 overflow-y-auto pr-1 text-sm tabular-nums">
                  {rows.map((r) => (
                    <li key={r.n} className="flex gap-3 rounded-lg px-1.5 py-1">
                      <span className="w-6 shrink-0 text-muted-foreground/50">
                        {r.n}.
                      </span>
                      <span className="w-16 shrink-0">{r.w}</span>
                      <span className="w-16 shrink-0 text-muted-foreground">
                        {r.b}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      </main>
    </>
  )
}

function PlayerRail({
  name,
  white,
  toMove,
  captured,
  edge,
}: {
  name: string
  white: boolean
  toMove: boolean
  captured: PieceSymbol[]
  edge: number
}) {
  return (
    <div
      className={cn(
        "glass flex items-center gap-3 rounded-glass px-4 py-2.5 transition-colors",
        toMove && "border-accent-emerald/40"
      )}
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full transition-colors",
          toMove ? "bg-accent-emerald" : "bg-white/15"
        )}
      />
      <span className="text-sm font-medium">{name}</span>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
        {captured.map((p, i) => (
          <span
            key={i}
            className="chess-glyph text-base leading-none opacity-70"
            style={pieceStyle(!white)}
          >
            {asTextGlyph(PIECE_GLYPH[p])}
          </span>
        ))}
      </div>

      {edge > 0 && (
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          +{edge}
        </span>
      )}
    </div>
  )
}

export default GamePage
