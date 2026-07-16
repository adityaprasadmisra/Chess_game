import { Chess } from "chess.js"
import { Router } from "express"
import { z } from "zod"

import { requireUser } from "./auth.js"
import { db } from "./db.js"
import { publish } from "./realtime.js"

// Each router is mounted on its own prefix in index.ts. That scoping is
// load-bearing: mounting at "/" would make this requireUser run on every
// request in the app, including /api/auth/register — locking everyone out.
export const friendsRouter = Router()
friendsRouter.use(requireUser)

export const invitesRouter = Router()
invitesRouter.use(requireUser)

const idParam = z.string().uuid()

/** Everyone this user is connected to, plus the state of that connection. */
async function listFriends(userId: string) {
  const { rows } = await db.query(
    `SELECT f.id,
            f.status,
            f.requester_id = $1 AS outgoing,
            u.id   AS user_id,
            u.username
       FROM friendships f
       JOIN users u
         ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id
                                                 ELSE f.requester_id END
      WHERE f.requester_id = $1 OR f.addressee_id = $1
      ORDER BY u.username`,
    [userId]
  )
  return rows
}

friendsRouter.get("/", async (req, res) => {
  const rows = await listFriends(req.user!.id)
  res.json({
    friends: rows.filter((r) => r.status === "accepted"),
    incoming: rows.filter((r) => r.status === "pending" && !r.outgoing),
    outgoing: rows.filter((r) => r.status === "pending" && r.outgoing),
  })
})

/** Username search. Never exposes emails — those are not yours to hand out. */
friendsRouter.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim()
  if (q.length < 2) return res.json({ results: [] })

  const { rows } = await db.query(
    `SELECT u.id, u.username
       FROM users u
      WHERE lower(u.username) LIKE '%' || lower($2) || '%'
        AND u.id <> $1
        AND NOT EXISTS (
          SELECT 1 FROM friendships f
           WHERE (f.requester_id = $1 AND f.addressee_id = u.id)
              OR (f.addressee_id = $1 AND f.requester_id = u.id)
        )
      ORDER BY u.username
      LIMIT 10`,
    [req.user!.id, q]
  )
  res.json({ results: rows })
})

friendsRouter.post("/request", async (req, res) => {
  const parsed = z.object({ userId: idParam }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: "Unknown user" })
  if (parsed.data.userId === req.user!.id)
    return res.status(400).json({ error: "You can't add yourself" })

  try {
    const { rows } = await db.query(
      `INSERT INTO friendships (requester_id, addressee_id)
       VALUES ($1, $2) RETURNING id`,
      [req.user!.id, parsed.data.userId]
    )
    publish(parsed.data.userId, { type: "friends:changed" })
    res.status(201).json({ id: rows[0].id })
  } catch (err: any) {
    if (err?.code === "23505")
      return res.status(409).json({ error: "You're already connected" })
    if (err?.code === "23503")
      return res.status(404).json({ error: "Unknown user" })
    console.error("friend request failed:", err?.message)
    res.status(500).json({ error: "Could not send the request" })
  }
})

friendsRouter.post("/:id/accept", async (req, res) => {
  // Only the addressee may accept: the requester accepting their own request
  // would let anyone add anyone.
  const { rowCount } = await db.query(
    `UPDATE friendships
        SET status = 'accepted', responded_at = now()
      WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
    [req.params.id, req.user!.id]
  )
  if (!rowCount) return res.status(404).json({ error: "No such request" })

  const { rows } = await db.query(
    "SELECT requester_id FROM friendships WHERE id = $1",
    [req.params.id]
  )
  publish(rows[0].requester_id, { type: "friends:changed" })
  res.json({ ok: true })
})

/** Decline and remove are the same operation: drop the row. */
friendsRouter.delete("/:id", async (req, res) => {
  const { rows } = await db.query(
    `DELETE FROM friendships
      WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)
      RETURNING requester_id, addressee_id`,
    [req.params.id, req.user!.id]
  )
  if (!rows[0]) return res.status(404).json({ error: "No such friend" })

  const other =
    rows[0].requester_id === req.user!.id
      ? rows[0].addressee_id
      : rows[0].requester_id
  publish(other, { type: "friends:changed" })
  res.json({ ok: true })
})

// ---------------------------------------------------------------- invites

invitesRouter.get("/", async (req, res) => {
  const { rows } = await db.query(
    `SELECT i.id, i.status, i.game_id,
            i.from_id = $1 AS outgoing,
            u.username
       FROM invites i
       JOIN users u ON u.id = CASE WHEN i.from_id = $1 THEN i.to_id ELSE i.from_id END
      WHERE (i.from_id = $1 OR i.to_id = $1) AND i.status = 'pending'
      ORDER BY i.created_at DESC`,
    [req.user!.id]
  )
  res.json({
    incoming: rows.filter((r) => !r.outgoing),
    outgoing: rows.filter((r) => r.outgoing),
  })
})

invitesRouter.post("/", async (req, res) => {
  const parsed = z.object({ userId: idParam }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: "Unknown user" })

  // You may only invite an accepted friend — this is what makes "request +
  // accept" mean anything. Without it, strangers can pester anyone.
  const { rows: friend } = await db.query(
    `SELECT 1 FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = $1 AND addressee_id = $2)
          OR (addressee_id = $1 AND requester_id = $2))`,
    [req.user!.id, parsed.data.userId]
  )
  if (!friend[0])
    return res.status(403).json({ error: "You can only invite friends" })

  try {
    const { rows } = await db.query(
      `INSERT INTO invites (from_id, to_id) VALUES ($1, $2) RETURNING id`,
      [req.user!.id, parsed.data.userId]
    )
    publish(parsed.data.userId, { type: "invites:changed" })
    res.status(201).json({ id: rows[0].id })
  } catch (err: any) {
    if (err?.code === "23505")
      return res.status(409).json({ error: "You've already invited them" })
    console.error("invite failed:", err?.message)
    res.status(500).json({ error: "Could not send the invite" })
  }
})

invitesRouter.post("/:id/accept", async (req, res) => {
  const { rows } = await db.query(
    `SELECT * FROM invites
      WHERE id = $1 AND to_id = $2 AND status = 'pending'`,
    [req.params.id, req.user!.id]
  )
  const invite = rows[0]
  if (!invite) return res.status(404).json({ error: "No such invite" })

  // Inviter plays White — a fixed, stated rule beats a hidden coin flip.
  const chess = new Chess()
  const { rows: game } = await db.query(
    `INSERT INTO games (white_id, black_id, fen) VALUES ($1, $2, $3) RETURNING *`,
    [invite.from_id, invite.to_id, chess.fen()]
  )

  await db.query(
    "UPDATE invites SET status = 'accepted', game_id = $2 WHERE id = $1",
    [invite.id, game[0].id]
  )

  // Tell the inviter their game exists — they are sitting on another screen.
  publish(invite.from_id, { type: "invites:changed" })
  publish(invite.from_id, { type: "game:started", gameId: game[0].id })
  res.json({ gameId: game[0].id })
})

invitesRouter.post("/:id/decline", async (req, res) => {
  const { rows } = await db.query(
    `UPDATE invites SET status = 'declined'
      WHERE id = $1 AND to_id = $2 AND status = 'pending'
      RETURNING from_id`,
    [req.params.id, req.user!.id]
  )
  if (!rows[0]) return res.status(404).json({ error: "No such invite" })
  publish(rows[0].from_id, { type: "invites:changed" })
  res.json({ ok: true })
})

invitesRouter.post("/:id/cancel", async (req, res) => {
  const { rows } = await db.query(
    `UPDATE invites SET status = 'cancelled'
      WHERE id = $1 AND from_id = $2 AND status = 'pending'
      RETURNING to_id`,
    [req.params.id, req.user!.id]
  )
  if (!rows[0]) return res.status(404).json({ error: "No such invite" })
  publish(rows[0].to_id, { type: "invites:changed" })
  res.json({ ok: true })
})
