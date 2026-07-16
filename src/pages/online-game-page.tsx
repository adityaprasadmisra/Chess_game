import { Chess, type Square } from "chess.js"
import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Flag, Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"

import { ChessBoard } from "@/components/game/chess-board"
import { Button } from "@/components/ui/button"
import { HolographicWall } from "@/components/ui/holographic-wall-shadcnui"
import { PIECE_GLYPH, pieceStyle } from "@/lib/board-theme"
import { asTextGlyph } from "@/lib/chess-symbols"
import { useAuth } from "@/lib/auth"
import { useRealtime, useServerMessage } from "@/lib/realtime"
import { cn } from "@/lib/utils"

type GameDto = {
  id: string
  fen: string
  pgn: string
  status: string
  result: string | null
  endReason: string | null
  winnerId: string | null
  white: { id: string; username: string }
  black: { id: string; username: string }
  history: { san: string; from: string; to: string; color: string; captured: string | null }[]
  turn: "w" | "b"
}

export function OnlineGamePage() {
  const { id } = useParams<{ id: string }>()
  const { user, loading } = useAuth()
  const { send, connected } = useRealtime()

  const [game, setGame] = useState<GameDto | null>(null)
  const [selected, setSelected] = useState<Square | null>(null)
  const [targets, setTargets] = useState<Square[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<{ from: Square; to: Square } | null>(null)

  // Ask for state on connect, and again on reconnect — a socket that dropped
  // mid-game will have missed every move made while it was away.
  useEffect(() => {
    if (connected && id) send({ type: "watch", gameId: id })
  }, [connected, id, send])

  useServerMessage((msg) => {
    if (msg.type === "game:update" && msg.game?.id === id) {
      setGame(msg.game)
      setSelected(null)
      setTargets([])
      setPending(null)
      setError(null)
    }
    if (msg.type === "error") setError(msg.message)
  })

  /** A local Chess only to render and to offer legal targets. The server is
   *  the authority; this is a convenience so the board feels instant. */
  const chess = useMemo(() => {
    const c = new Chess()
    if (game?.pgn) c.loadPgn(game.pgn)
    else if (game?.fen) c.load(game.fen)
    return c
  }, [game?.pgn, game?.fen])

  if (loading) return null
  if (!user) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">Sign in to play online.</p>
        <Button variant="primary" size="sm" className="mt-4" asChild>
          <Link to="/login">Log in</Link>
        </Button>
      </Shell>
    )
  }

  if (!game) {
    return (
      <Shell>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading game…
        </div>
        {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
      </Shell>
    )
  }

  const iAmWhite = game.white.id === user.id
  const myColour = iAmWhite ? "w" : "b"
  const opponent = iAmWhite ? game.black : game.white
  const me = iAmWhite ? game.white : game.black
  const myTurn = game.turn === myColour && game.status === "active"
  const last = game.history[game.history.length - 1]

  const kingSquare = (colour: "w" | "b"): Square | null => {
    for (const row of chess.board())
      for (const cell of row)
        if (cell && cell.type === "k" && cell.color === colour) return cell.square
    return null
  }
  const inCheck = chess.inCheck() ? kingSquare(chess.turn()) : null

  const handleSquare = (square: Square) => {
    if (!myTurn || pending) return
    const piece = chess.get(square)

    if (!selected) {
      if (piece && piece.color === myColour) {
        setSelected(square)
        setTargets(chess.moves({ square, verbose: true }).map((m) => m.to))
      }
      return
    }
    if (square === selected) {
      setSelected(null)
      setTargets([])
      return
    }

    const legal = chess.moves({ square: selected, verbose: true }).filter((m) => m.to === square)
    if (legal.length === 0) {
      if (piece && piece.color === myColour) {
        setSelected(square)
        setTargets(chess.moves({ square, verbose: true }).map((m) => m.to))
      } else {
        setSelected(null)
        setTargets([])
      }
      return
    }
    if (legal.some((m) => m.promotion)) return setPending({ from: selected, to: square })

    send({ type: "move", gameId: game.id, from: selected, to: square })
  }

  const status = (() => {
    if (game.status === "finished") {
      if (!game.winnerId) return `Draw — ${game.endReason}`
      const youWon = game.winnerId === user.id
      return `${youWon ? "You win" : `${opponent.username} wins`} — ${game.endReason}`
    }
    if (chess.inCheck()) return myTurn ? "You're in check" : `${opponent.username} is in check`
    return myTurn ? "Your move" : `Waiting for ${opponent.username}`
  })()

  return (
    <>
      <HolographicWall fullscreen intensity={0.5} radius={210} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-surface-void/85 via-surface-void/70 to-surface-void/90"
      />

      <main className="mx-auto min-h-dvh max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/friends">
              <ArrowLeft />
              Friends
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            {!connected && (
              <span className="text-xs text-accent-amber">Reconnecting…</span>
            )}
            {game.status === "active" && (
              <Button
                variant="glass"
                size="sm"
                onClick={() => {
                  if (confirm("Resign this game?"))
                    send({ type: "resign", gameId: game.id })
                }}
              >
                <Flag />
                Resign
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="mx-auto flex w-full min-w-0 max-w-[min(100%,calc(100dvh-16rem))] flex-col gap-3 lg:mx-0">
            <PlayerRail
              name={opponent.username}
              white={!iAmWhite}
              toMove={game.turn !== myColour && game.status === "active"}
              captured={game.history.filter((m) => m.captured && m.color === myColour).map((m) => m.captured!)}
            />

            <div className="relative">
              <ChessBoard
                game={chess}
                selected={selected}
                targets={targets}
                lastMove={last ? { from: last.from as Square, to: last.to as Square } : null}
                checkSquare={inCheck}
                onSquareClick={handleSquare}
                // Always draw from your own side, like every chess site.
                flipped={!iAmWhite}
              />

              <AnimatePresence>
                {pending && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex items-center justify-center rounded-glass-lg bg-surface-void/70 backdrop-blur-sm"
                  >
                    <div className="glass flex flex-col gap-3 rounded-glass p-4">
                      <p className="text-center text-sm text-muted-foreground">
                        Promote to
                      </p>
                      <div className="flex gap-2">
                        {(["q", "r", "b", "n"] as const).map((p) => (
                          <button
                            key={p}
                            aria-label={`Promote to ${p}`}
                            onClick={() =>
                              send({
                                type: "move",
                                gameId: game.id,
                                from: pending.from,
                                to: pending.to,
                                promotion: p,
                              })
                            }
                            className="flex size-14 items-center justify-center rounded-2xl bg-white/5 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-emerald"
                          >
                            <span
                              className="chess-glyph text-3xl leading-none"
                              style={pieceStyle(iAmWhite)}
                            >
                              {asTextGlyph(PIECE_GLYPH[p])}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <PlayerRail
              name={`${me.username} (you)`}
              white={iAmWhite}
              toMove={myTurn}
              captured={game.history.filter((m) => m.captured && m.color !== myColour).map((m) => m.captured!)}
            />
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <div className="glass rounded-glass p-4 shadow-glass">
              <p
                className={cn(
                  "text-sm font-medium",
                  game.status === "finished" && "text-accent-amber",
                  game.status === "active" && myTurn && "text-accent-emerald"
                )}
              >
                {status}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You are {iAmWhite ? "White" : "Black"} · playing {opponent.username}
              </p>
              {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
            </div>

            <div className="glass flex min-h-[12rem] flex-col rounded-glass p-4 shadow-glass lg:max-h-[26rem]">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Moves
              </h2>
              {game.history.length === 0 ? (
                <p className="text-sm text-muted-foreground/60">
                  No moves yet. White starts.
                </p>
              ) : (
                <ol className="flex flex-col gap-0.5 overflow-y-auto pr-1 text-sm tabular-nums">
                  {Array.from(
                    { length: Math.ceil(game.history.length / 2) },
                    (_, n) => (
                      <li key={n} className="flex gap-3 rounded-lg px-1.5 py-1">
                        <span className="w-6 shrink-0 text-muted-foreground/50">
                          {n + 1}.
                        </span>
                        <span className="w-16 shrink-0">
                          {game.history[n * 2]?.san}
                        </span>
                        <span className="w-16 shrink-0 text-muted-foreground">
                          {game.history[n * 2 + 1]?.san}
                        </span>
                      </li>
                    )
                  )}
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
}: {
  name: string
  white: boolean
  toMove: boolean
  captured: string[]
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
      <span className="shrink-0 text-sm font-medium">{name}</span>
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
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HolographicWall fullscreen intensity={0.5} radius={210} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-surface-void/85 via-surface-void/65 to-surface-void/90"
      />
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="glass w-full max-w-sm rounded-glass-lg p-7 shadow-glass">
          {children}
        </div>
      </main>
    </>
  )
}

export default OnlineGamePage
