import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { PGlite } from "@electric-sql/pglite"
import pg from "pg"

const here = dirname(fileURLToPath(import.meta.url))

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://chess:chess_dev_password@localhost:5432/chessgame"

/** The subset of the pg API this app uses. Both engines satisfy it. */
export type Db = {
  query: (
    text: string,
    params?: unknown[]
  ) => Promise<{ rows: any[]; rowCount: number | null }>
  /**
   * Run a script of several statements. Separate from query() because PGlite's
   * query() speaks the extended protocol, which permits exactly one command —
   * so the multi-statement schema has to go through exec().
   */
  exec: (sql: string) => Promise<void>
}

export let db: Db
export let engine: "postgres" | "pglite" = "postgres"

/**
 * Prefer the real Postgres named by DATABASE_URL. Fall back to PGlite — real
 * PostgreSQL compiled to WASM, running in this process — when that server is
 * unreachable, so development is not blocked on Docker.
 *
 * The fallback is refused outright in production: silently serving from a local
 * WASM database instead of the intended server would hide a broken deployment
 * and write real users into a file nobody backs up.
 */
export async function connect() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 10 })
  try {
    const probe = await pool.connect()
    probe.release()
    db = {
      query: (text, params) => pool.query(text, params as any[]),
      // pg's simple query protocol accepts multiple statements when there are
      // no bind parameters.
      exec: async (sql) => {
        await pool.query(sql)
      },
    }
    engine = "postgres"
    console.log(`db: connected to Postgres (${redact(DATABASE_URL)})`)
    return
  } catch (err: any) {
    await pool.end().catch(() => {})
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `Cannot reach Postgres at ${redact(DATABASE_URL)}: ${err?.message}`
      )
    }
    console.warn(
      `db: Postgres unreachable (${err?.code ?? err?.message}); ` +
        `falling back to PGlite at server/.pgdata`
    )
  }

  const lite = new PGlite(join(here, ".pgdata"))
  await lite.waitReady
  db = {
    query: async (text, params) => {
      const r = await lite.query(text, params as any[])
      return { rows: r.rows as any[], rowCount: r.affectedRows ?? r.rows.length }
    },
    exec: async (sql) => {
      await lite.exec(sql)
    },
  }
  engine = "pglite"
  console.log("db: using PGlite (PostgreSQL in WASM), persisted to server/.pgdata")
}

/** Never print the password in a connection string. */
function redact(url: string) {
  return url.replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@")
}

export async function migrate() {
  const sql = readFileSync(join(here, "schema.sql"), "utf8")
  await db.exec(sql)
}

export async function pruneSessions() {
  const { rowCount } = await db.query(
    "DELETE FROM sessions WHERE expires_at < now()"
  )
  return rowCount ?? 0
}
