import { AnimatePresence, motion } from "framer-motion"
import { ArrowLeft, Check, Loader2, Search, Swords, UserPlus, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { HolographicWall } from "@/components/ui/holographic-wall-shadcnui"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth"
import { useRealtime, useServerMessage } from "@/lib/realtime"
import { cn } from "@/lib/utils"

type Friend = { id: string; user_id: string; username: string; status: string }
type Invite = { id: string; username: string; game_id: string | null }

const api = async (path: string, init?: RequestInit) => {
  const res = await fetch(path, { credentials: "same-origin", ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? "Something went wrong")
  return data
}

export function FriendsPage() {
  const { user, loading } = useAuth()
  const { online, connected } = useRealtime()
  const navigate = useNavigate()

  const [friends, setFriends] = useState<Friend[]>([])
  const [incoming, setIncoming] = useState<Friend[]>([])
  const [outgoing, setOutgoing] = useState<Friend[]>([])
  const [invitesIn, setInvitesIn] = useState<Invite[]>([])
  const [invitesOut, setInvitesOut] = useState<Invite[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<{ id: string; username: string }[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [f, i] = await Promise.all([api("/api/friends"), api("/api/invites")])
      setFriends(f.friends)
      setIncoming(f.incoming)
      setOutgoing(f.outgoing)
      setInvitesIn(i.incoming)
      setInvitesOut(i.outgoing)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    if (user) refresh()
  }, [user, refresh])

  // The server tells us when anything changed; no polling.
  useServerMessage((msg) => {
    if (msg.type === "friends:changed" || msg.type === "invites:changed") refresh()
    if (msg.type === "game:started") navigate(`/game/${msg.gameId}`)
  })

  // Debounced search — one request per pause, not per keystroke.
  useEffect(() => {
    if (query.trim().length < 2) return setResults([])
    const t = setTimeout(async () => {
      try {
        const d = await api(`/api/friends/search?q=${encodeURIComponent(query)}`)
        setResults(d.results)
      } catch {
        setResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
      await refresh()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  if (loading) return null
  if (!user) {
    return (
      <Gate>
        <p className="text-sm text-muted-foreground">
          Sign in to add friends and invite them to a game.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="primary" size="sm" asChild>
            <Link to="/login">Log in</Link>
          </Button>
          <Button variant="glass" size="sm" asChild>
            <Link to="/register">Register</Link>
          </Button>
        </div>
      </Gate>
    )
  }

  return (
    <>
      <HolographicWall fullscreen intensity={0.6} radius={220} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-surface-void/80 via-surface-void/60 to-surface-void/90"
      />

      <main className="mx-auto min-h-dvh max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft />
              Back
            </Link>
          </Button>
          <span
            className={cn(
              "flex items-center gap-1.5 text-xs",
              connected ? "text-muted-foreground" : "text-accent-amber"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                connected ? "bg-accent-emerald" : "bg-accent-amber"
              )}
            />
            {connected ? "Live" : "Reconnecting"}
          </span>
        </div>

        <h1 className="text-3xl font-semibold tracking-tight">Friends</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add someone by username, then invite them to a game.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-red-400/25 bg-red-400/10 px-3 py-2.5 text-xs text-red-300"
          >
            {error}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-4">
          {/* Game invites first — they're time-sensitive */}
          <AnimatePresence>
            {invitesIn.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass rounded-glass p-4 shadow-glass"
              >
                <SectionTitle>Game invites</SectionTitle>
                <ul className="flex flex-col gap-2">
                  {invitesIn.map((i) => (
                    <li key={i.id} className="flex items-center gap-3">
                      <Swords className="size-4 shrink-0 text-accent-amber" />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        <strong className="font-medium">{i.username}</strong>{" "}
                        <span className="text-muted-foreground">
                          wants to play
                        </span>
                      </span>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busy === i.id}
                        onClick={() =>
                          act(i.id, async () => {
                            const d = await api(`/api/invites/${i.id}/accept`, {
                              method: "POST",
                            })
                            navigate(`/game/${d.gameId}`)
                          })
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === i.id}
                        onClick={() =>
                          act(i.id, () =>
                            api(`/api/invites/${i.id}/decline`, { method: "POST" })
                          )
                        }
                      >
                        Decline
                      </Button>
                    </li>
                  ))}
                </ul>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Friend requests */}
          {incoming.length > 0 && (
            <section className="glass rounded-glass p-4 shadow-glass">
              <SectionTitle>Friend requests</SectionTitle>
              <ul className="flex flex-col gap-2">
                {incoming.map((f) => (
                  <li key={f.id} className="flex items-center gap-3">
                    <Avatar name={f.username} />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {f.username}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy === f.id}
                      onClick={() =>
                        act(f.id, () =>
                          api(`/api/friends/${f.id}/accept`, { method: "POST" })
                        )
                      }
                    >
                      <Check />
                      Accept
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Decline ${f.username}`}
                      disabled={busy === f.id}
                      onClick={() =>
                        act(f.id, () =>
                          api(`/api/friends/${f.id}`, { method: "DELETE" })
                        )
                      }
                    >
                      <X />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Search */}
          <section className="glass rounded-glass p-4 shadow-glass">
            <SectionTitle>Add a friend</SectionTitle>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username"
                aria-label="Search by username"
                className="pl-10"
              />
            </div>

            {query.trim().length >= 2 && (
              <ul className="mt-3 flex flex-col gap-2">
                {results.length === 0 ? (
                  <li className="text-xs text-muted-foreground/60">
                    No one new matches “{query}”.
                  </li>
                ) : (
                  results.map((r) => (
                    <li key={r.id} className="flex items-center gap-3">
                      <Avatar name={r.username} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {r.username}
                      </span>
                      <Button
                        variant="glass"
                        size="sm"
                        disabled={busy === r.id}
                        onClick={() =>
                          act(r.id, async () => {
                            await api("/api/friends/request", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ userId: r.id }),
                            })
                            setQuery("")
                          })
                        }
                      >
                        {busy === r.id ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <UserPlus />
                        )}
                        Add
                      </Button>
                    </li>
                  ))
                )}
              </ul>
            )}

            {outgoing.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground/70">
                Waiting on {outgoing.map((f) => f.username).join(", ")}
              </p>
            )}
          </section>

          {/* Friends */}
          <section className="glass rounded-glass p-4 shadow-glass">
            <SectionTitle>
              Your friends {friends.length > 0 && `(${friends.length})`}
            </SectionTitle>
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground/60">
                No friends yet. Search for someone above.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {friends.map((f) => {
                  const isOnline = online.has(f.user_id)
                  const invited = invitesOut.some((i) => i.username === f.username)
                  return (
                    <li key={f.id} className="flex items-center gap-3">
                      <Avatar name={f.username} online={isOnline} />
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {f.username}
                        <span className="ml-2 text-xs text-muted-foreground/60">
                          {isOnline ? "online" : "offline"}
                        </span>
                      </span>
                      {invited ? (
                        <span className="text-xs text-accent-amber">Invited</span>
                      ) : (
                        <Button
                          variant="glass"
                          size="sm"
                          // An invite to someone offline would just expire unseen.
                          disabled={!isOnline || busy === f.id}
                          title={isOnline ? undefined : `${f.username} is offline`}
                          onClick={() =>
                            act(f.id, () =>
                              api("/api/invites", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ userId: f.user_id }),
                              })
                            )
                          }
                        >
                          <Swords />
                          Invite
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove ${f.username}`}
                        disabled={busy === f.id}
                        onClick={() =>
                          act(f.id, () =>
                            api(`/api/friends/${f.id}`, { method: "DELETE" })
                          )
                        }
                      >
                        <X />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  )
}

function Avatar({ name, online }: { name: string; online?: boolean }) {
  return (
    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-xs font-medium uppercase">
      {name.slice(0, 2)}
      {online !== undefined && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-surface-void",
            online ? "bg-accent-emerald" : "bg-white/20"
          )}
        />
      )}
    </span>
  )
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HolographicWall fullscreen intensity={0.6} radius={220} />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-surface-void/80 via-surface-void/50 to-surface-void/90"
      />
      <main className="flex min-h-dvh items-center justify-center px-4">
        <div className="glass w-full max-w-sm rounded-glass-lg p-7 shadow-glass">
          <h1 className="text-xl font-semibold tracking-tight">Friends</h1>
          {children}
        </div>
      </main>
    </>
  )
}

export default FriendsPage
