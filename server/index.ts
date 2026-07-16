import { createServer } from "node:http"

import cookieParser from "cookie-parser"
import express from "express"
import rateLimit from "express-rate-limit"
import { z } from "zod"

import {
  attachUser,
  createSession,
  destroySession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "./auth.js"
import { connect, engine, db, migrate, pruneSessions } from "./db.js"
import { friendsRouter, invitesRouter } from "./friends.js"
import { applyMove, gamesRouter, resignGame, watchGame } from "./games.js"
import { attachRealtime } from "./realtime.js"

const app = express()
const PORT = Number(process.env.PORT ?? 3001)

app.use(express.json({ limit: "16kb" }))
app.use(cookieParser())
app.use(attachUser)

// Mount each router on its own prefix. Mounting at "/" instead would apply the
// routers' internal requireUser to every request in the app — including
// /api/auth/register and /api/health — so nobody could ever sign in.
app.use("/api/friends", friendsRouter)
app.use("/api/invites", invitesRouter)
app.use("/api/games", gamesRouter)

/** Throttle credential endpoints: unlimited guesses is how passwords fall. */
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again in a few minutes." },
})

const credentials = z.object({
  // Lowercased here so it matches how it was stored at registration.
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .max(254),
  // Long over complex: length dominates entropy, and rules users hate get
  // worked around with Password1!.
  password: z.string().min(10, "Use at least 10 characters").max(200),
})

const registration = credentials.extend({
  username: z
    .string()
    .trim()
    .min(3, "At least 3 characters")
    .max(24, "At most 24 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Letters, numbers, hyphen and underscore only"),
})

function firstIssue(err: z.ZodError) {
  return err.issues[0]?.message ?? "Check your details and try again"
}

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const parsed = registration.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) })

  const { email, username, password } = parsed.data
  try {
    const password_hash = await hashPassword(password)
    const { rows } = await db.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email, username`,
      [email, username, password_hash]
    )
    await createSession(res, rows[0].id)
    res.status(201).json({ user: rows[0] })
  } catch (err: any) {
    // 23505 = unique_violation. Say which field so the user can fix it; unlike
    // login, registration cannot hide that an account exists anyway.
    if (err?.code === "23505") {
      const where = `${err.constraint ?? ""} ${err.detail ?? ""}`
      return res.status(409).json({
        error: where.includes("username")
          ? "That username is taken"
          : "An account with that email already exists",
      })
    }
    console.error("register failed:", err?.message)
    res.status(500).json({ error: "Could not create your account" })
  }
})

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const parsed = credentials.safeParse(req.body)
  // Do not leak which field was wrong, or the shape of the password policy.
  if (!parsed.success)
    return res.status(401).json({ error: "Incorrect email or password" })

  const { email, password } = parsed.data
  try {
    const { rows } = await db.query(
      "SELECT id, email, username, password_hash FROM users WHERE email = $1",
      [email]
    )
    const user = rows[0]

    // Compare even when the user is absent: returning early on a missing email
    // makes login a timing oracle for which addresses are registered.
    const ok = await verifyPassword(
      password,
      user?.password_hash ??
        "$2b$12$0000000000000000000000000000000000000000000000000000"
    )
    if (!user || !ok)
      return res.status(401).json({ error: "Incorrect email or password" })

    await createSession(res, user.id)
    res.json({ user: { id: user.id, email: user.email, username: user.username } })
  } catch (err: any) {
    console.error("login failed:", err?.message)
    res.status(500).json({ error: "Could not sign you in" })
  }
})

app.post("/api/auth/logout", async (req, res) => {
  await destroySession(req, res)
  res.json({ ok: true })
})

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.user ?? null })
})

app.get("/api/health", async (_req, res) => {
  try {
    await db.query("SELECT 1")
    // Surface the engine: silently running on the PGlite fallback when you
    // believe you are on Docker Postgres is a confusing way to lose data.
    res.json({ ok: true, db: "up", engine })
  } catch {
    res.status(503).json({ ok: false, db: "down", engine })
  }
})

// Example of a route that needs a session — proves auth end to end.
app.get("/api/profile", requireUser, (req, res) => {
  res.json({ user: req.user })
})

async function start() {
  await connect()
  await migrate()
  const pruned = await pruneSessions()
  if (pruned) console.log(`pruned ${pruned} expired sessions`)

  // An explicit http.Server, because the WebSocket upgrade needs to hook it.
  const server = createServer(app)
  attachRealtime(server, {
    move: applyMove,
    resign: resignGame,
    watch: watchGame,
  })

  server.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`)
    console.log(`WebSocket on ws://localhost:${PORT}/ws`)
  })
}

start().catch((err) => {
  console.error("server failed to start:", err.message)
  process.exit(1)
})
