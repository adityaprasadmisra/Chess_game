import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { useAuth } from "@/lib/auth"

export type ServerMessage =
  | { type: "friends:changed" }
  | { type: "invites:changed" }
  | { type: "game:started"; gameId: string }
  | { type: "game:update"; game: any }
  | { type: "presence"; online: string[] }
  | { type: "error"; message: string }

type Listener = (msg: ServerMessage) => void

type RealtimeState = {
  connected: boolean
  online: Set<string>
  send: (msg: unknown) => void
  subscribe: (fn: Listener) => () => void
}

const RealtimeContext = createContext<RealtimeState | null>(null)

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const wsRef = useRef<WebSocket | null>(null)
  const listeners = useRef(new Set<Listener>())
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState<Set<string>>(new Set())
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attempts = useRef(0)

  useEffect(() => {
    // No session, no socket: the server would reject the upgrade anyway.
    if (!user) {
      wsRef.current?.close()
      wsRef.current = null
      setConnected(false)
      setOnline(new Set())
      return
    }

    let disposed = false

    const open = () => {
      if (disposed) return
      const proto = location.protocol === "https:" ? "wss:" : "ws:"
      const ws = new WebSocket(`${proto}//${location.host}/ws`)
      wsRef.current = ws

      ws.onopen = () => {
        attempts.current = 0
        setConnected(true)
      }

      ws.onmessage = (e) => {
        let msg: ServerMessage
        try {
          msg = JSON.parse(e.data)
        } catch {
          return
        }
        if (msg.type === "presence") setOnline(new Set(msg.online))
        listeners.current.forEach((fn) => fn(msg))
      }

      ws.onclose = () => {
        setConnected(false)
        if (disposed) return
        // Back off rather than hammering a server that may be restarting.
        const delay = Math.min(1000 * 2 ** attempts.current++, 15000)
        retry.current = setTimeout(open, delay)
      }

      ws.onerror = () => ws.close()
    }

    open()
    return () => {
      disposed = true
      if (retry.current) clearTimeout(retry.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [user])

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
  }, [])

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn)
    return () => void listeners.current.delete(fn)
  }, [])

  const value = useMemo(
    () => ({ connected, online, send, subscribe }),
    [connected, online, send, subscribe]
  )

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  )
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error("useRealtime must be used inside <RealtimeProvider>")
  return ctx
}

/** Subscribe to server messages for the lifetime of a component. */
export function useServerMessage(fn: Listener) {
  const { subscribe } = useRealtime()
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => subscribe((m) => ref.current(m)), [subscribe])
}
