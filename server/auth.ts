import { randomBytes, createHash } from "node:crypto"

import bcrypt from "bcrypt"
import type { NextFunction, Request, Response } from "express"

import { db } from "./db.js"

export const SESSION_COOKIE = "chess_session"
const SESSION_DAYS = 30
const BCRYPT_ROUNDS = 12

export type SessionUser = { id: string; email: string; username: string }

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser
    }
  }
}

/**
 * Only the hash of the token is stored. The raw token lives solely in the
 * user's cookie, so a leaked `sessions` table cannot be replayed as logins.
 */
function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash)
}

export async function createSession(res: Response, userId: string) {
  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5)

  await db.query(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)",
    [hashToken(token), userId, expiresAt]
  )

  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true, // JS cannot read it, so XSS cannot exfiltrate it
    sameSite: "lax", // blocks the cross-site POST shape of CSRF
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  })
}

export async function destroySession(req: Request, res: Response) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (token) {
    // Revocable precisely because sessions are server-side state.
    await db.query("DELETE FROM sessions WHERE token_hash = $1", [
      hashToken(token),
    ])
  }
  res.clearCookie(SESSION_COOKIE, { path: "/" })
}

/**
 * Resolve a raw cookie token to its user, or null. Shared by the HTTP
 * middleware and the WebSocket handshake so both authenticate identically.
 */
export async function userForToken(token: string): Promise<SessionUser | null> {
  try {
    const { rows } = await db.query(
      `SELECT u.id, u.email, u.username
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)]
    )
    return rows[0] ?? null
  } catch {
    // A lookup failure must not authenticate anyone.
    return null
  }
}

/** Resolves req.user when a valid session cookie is present. Never rejects. */
export async function attachUser(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const token = req.cookies?.[SESSION_COOKIE]
  if (!token) return next()
  req.user = (await userForToken(token)) ?? undefined
  next()
}

export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: "Not signed in" })
  next()
}
