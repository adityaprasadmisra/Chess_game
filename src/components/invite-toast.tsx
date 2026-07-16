import { AnimatePresence, motion } from "framer-motion"
import { Swords, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useServerMessage } from "@/lib/realtime"

type Invite = { id: string; username: string }

/**
 * App-wide invite notification. Lives outside the routes so an invite still
 * reaches you while you are on the landing page or mid local game — otherwise
 * it would only appear if you happened to be looking at /friends.
 */
export function InviteToast() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [invites, setInvites] = useState<Invite[]>([])
  // /friends already lists invites in the page; a toast there is the same
  // notification twice.
  const redundantHere = pathname === "/friends"

  const refresh = useCallback(async () => {
    if (!user) return setInvites([])
    try {
      const r = await fetch("/api/invites", { credentials: "same-origin" })
      if (!r.ok) return
      const d = await r.json()
      setInvites(d.incoming ?? [])
    } catch {
      /* offline; the socket will tell us when it's back */
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  useServerMessage((msg) => {
    if (msg.type === "invites:changed") refresh()
    if (msg.type === "game:started") navigate(`/game/${msg.gameId}`)
  })

  const act = async (id: string, path: string) => {
    const r = await fetch(`/api/invites/${id}/${path}`, {
      method: "POST",
      credentials: "same-origin",
    })
    const d = await r.json().catch(() => ({}))
    setInvites((v) => v.filter((i) => i.id !== id))
    if (path === "accept" && d.gameId) navigate(`/game/${d.gameId}`)
  }

  // Still mounted while redundant: it keeps listening, so game:started can
  // navigate you into a game from the friends page too.
  if (!user || redundantHere) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
      <AnimatePresence>
        {invites.map((i) => (
          <motion.div
            key={i.id}
            role="alert"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="glass pointer-events-auto flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-glass p-4 shadow-glass"
          >
            <div className="flex items-start gap-2.5">
              <Swords className="mt-0.5 size-4 shrink-0 text-accent-amber" />
              <p className="min-w-0 flex-1 text-sm">
                <strong className="font-medium">{i.username}</strong>{" "}
                <span className="text-muted-foreground">invited you to play</span>
              </p>
              <button
                onClick={() => act(i.id, "decline")}
                aria-label={`Decline invite from ${i.username}`}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <Button variant="primary" size="sm" onClick={() => act(i.id, "accept")}>
              Accept &amp; play
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
