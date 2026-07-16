import { Chess } from "chess.js"
import { Router } from "express"

import { requireUser } from "./auth.js"
import { db } from "./db.js"
import { publish } from "./realtime.js"

export const gamesRouter = Router()

type GameRow = {
  id: string
  white_id: string
  black_id: string
  fen: string
  pgn: string
  status: string
  result: string | null
  end_reason: string | null
  winner_id: string | null
}

/** The shape sent to clients. Includes both usernames so the UI needs no join. */
async function serialise(game: GameRow) {
  const { rows } = await db.query(
    "SELECT id, username FROM users WHERE id = $1 OR id = $2",
    [game.white_id, game.black_id]
  )
  const name = (id: string) =>
    rows.find((r) => r.id === id)?.username ?? "Unknown"

  const chess = new Chess()
  // Replay the PGN so the client gets real SAN history, not just a position.
  if (game.pgn) chess.loadPgn(game.pgn)
  else chess.load(game.fen)

  return {
    id: game.id,
    fen: game.fen,
    pgn: game.pgn,
    status: game.status,
    result: game.result,
    endReason: game.end_reason,
    winnerId: game.winner_id,
    white: { id: game.white_id, username: name(game.white_id) },
    black: { id: game.black_id, username: name(game.black_id) },
    history: chess.history({ verbose: true }).map((m) => ({
      san: m.san,
      from: m.from,
      to: m.to,
      color: m.color,
      captured: m.captured ?? null,
    })),
    turn: chess.turn(),
  }
}

async function loadGame(gameId: string): Promise<GameRow | null> {
  const { rows } = await db.query("SELECT * FROM games WHERE id = $1", [gameId])
  return rows[0] ?? null
}

/** Derive the finished state from the position itself, never from the client. */
function conclude(chess: Chess, game: GameRow) {
  if (!chess.isGameOver()) return null
  if (chess.isCheckmate()) {
    const winnerIsWhite = chess.turn() === "b"
    return {
      result: winnerIsWhite ? "1-0" : "0-1",
      winner_id: winnerIsWhite ? game.white_id : game.black_id,
      end_reason: "checkmate",
    }
  }
  const reason = chess.isStalemate()
    ? "stalemate"
    : chess.isInsufficientMaterial()
      ? "insufficient material"
      : chess.isThreefoldRepetition()
        ? "threefold repetition"
        : "fifty-move rule"
  return { result: "1/2-1/2", winner_id: null, end_reason: reason }
}

export async function applyMove(
  userId: string,
  payload: { gameId: string; from: string; to: string; promotion?: string }
) {
  const game = await loadGame(payload.gameId)
  if (!game) throw new Error("No such game")
  if (game.status !== "active") throw new Error("That game is over")

  // Only the two players, and only on their own turn.
  const isWhite = game.white_id === userId
  const isBlack = game.black_id === userId
  if (!isWhite && !isBlack) throw new Error("You're not in this game")

  const chess = new Chess()
  if (game.pgn) chess.loadPgn(game.pgn)
  else chess.load(game.fen)

  const yourColour = isWhite ? "w" : "b"
  if (chess.turn() !== yourColour) throw new Error("Not your turn")

  // chess.js throws on an illegal move; that rejection is the whole point of
  // validating here rather than trusting the sender.
  try {
    chess.move({
      from: payload.from,
      to: payload.to,
      promotion: payload.promotion ?? "q",
    })
  } catch {
    throw new Error("Illegal move")
  }

  const end = conclude(chess, game)
  const { rows } = await db.query(
    `UPDATE games
        SET fen = $2, pgn = $3, updated_at = now(),
            status = $4, result = $5, winner_id = $6, end_reason = $7
      WHERE id = $1
      RETURNING *`,
    [
      game.id,
      chess.fen(),
      chess.pgn(),
      end ? "finished" : "active",
      end?.result ?? null,
      end?.winner_id ?? null,
      end?.end_reason ?? null,
    ]
  )

  const payloadOut = { type: "game:update" as const, game: await serialise(rows[0]) }
  publish(game.white_id, payloadOut)
  publish(game.black_id, payloadOut)
}

export async function resignGame(userId: string, gameId: string) {
  const game = await loadGame(gameId)
  if (!game) throw new Error("No such game")
  if (game.status !== "active") throw new Error("That game is over")

  const isWhite = game.white_id === userId
  const isBlack = game.black_id === userId
  if (!isWhite && !isBlack) throw new Error("You're not in this game")

  const winnerId = isWhite ? game.black_id : game.white_id
  const { rows } = await db.query(
    `UPDATE games
        SET status = 'finished', result = $2, winner_id = $3,
            end_reason = 'resignation', updated_at = now()
      WHERE id = $1 RETURNING *`,
    [gameId, isWhite ? "0-1" : "1-0", winnerId]
  )

  const out = { type: "game:update" as const, game: await serialise(rows[0]) }
  publish(game.white_id, out)
  publish(game.black_id, out)
}

/** Send the caller the current state — used on connect and on reconnect. */
export async function watchGame(userId: string, gameId: string) {
  const game = await loadGame(gameId)
  if (!game) throw new Error("No such game")
  if (game.white_id !== userId && game.black_id !== userId)
    throw new Error("You're not in this game")
  publish(userId, { type: "game:update", game: await serialise(game) })
}

gamesRouter.use(requireUser)

gamesRouter.get("/:id", async (req, res) => {
  const game = await loadGame(req.params.id)
  if (!game) return res.status(404).json({ error: "No such game" })
  if (game.white_id !== req.user!.id && game.black_id !== req.user!.id)
    return res.status(403).json({ error: "You're not in this game" })
  res.json({ game: await serialise(game) })
})

/** Match history — the reason signing in is worth anything. */
gamesRouter.get("/", async (req, res) => {
  const { rows } = await db.query(
    `SELECT g.*, w.username AS white_name, b.username AS black_name
       FROM games g
       JOIN users w ON w.id = g.white_id
       JOIN users b ON b.id = g.black_id
      WHERE g.white_id = $1 OR g.black_id = $1
      ORDER BY g.updated_at DESC
      LIMIT 25`,
    [req.user!.id]
  )
  res.json({
    games: rows.map((g) => ({
      id: g.id,
      status: g.status,
      result: g.result,
      endReason: g.end_reason,
      white: g.white_name,
      black: g.black_name,
      youAreWhite: g.white_id === req.user!.id,
      won: g.winner_id === req.user!.id,
      drawn: g.status === "finished" && !g.winner_id,
      updatedAt: g.updated_at,
    })),
  })
})
