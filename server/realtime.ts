import type { IncomingMessage, Server } from "node:http"

import { WebSocketServer, WebSocket } from "ws"

import { userForToken, SESSION_COOKIE } from "./auth.js"

type Outbound =
  | { type: "friends:changed" }
  | { type: "invites:changed" }
  | { type: "game:started"; gameId: string }
  | { type: "game:update"; game: unknown }
  | { type: "presence"; online: string[] }
  | { type: "error"; message: string }

/** userId -> that user's live sockets. A person may have several tabs open. */
const sockets = new Map<string, Set<WebSocket>>()

/** Push to every socket a user has open. No-op when they are offline. */
export function publish(userId: string, message: Outbound) {
  const set = sockets.get(userId)
  if (!set) return
  const data = JSON.stringify(message)
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data)
  }
}

export function isOnline(userId: string) {
  return sockets.has(userId)
}

export function onlineUsers() {
  return [...sockets.keys()]
}

/** Broadcast the online set to everyone, so friend lists show live status. */
function broadcastPresence() {
  const online = onlineUsers()
  for (const userId of sockets.keys()) {
    publish(userId, { type: "presence", online })
  }
}

function parseCookie(header: string | undefined, name: string) {
  if (!header) return undefined
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=")
    if (k === name) return decodeURIComponent(v.join("="))
  }
  return undefined
}

type MoveHandler = (
  userId: string,
  payload: { gameId: string; from: string; to: string; promotion?: string }
) => Promise<void>

type ResignHandler = (userId: string, gameId: string) => Promise<void>
type WatchHandler = (userId: string, gameId: string) => Promise<void>

export function attachRealtime(
  server: Server,
  handlers: { move: MoveHandler; resign: ResignHandler; watch: WatchHandler }
) {
  // noServer + manual upgrade: the connection is rejected before the WebSocket
  // exists if there is no valid session, rather than accepted then policed.
  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", async (req: IncomingMessage, socket, head) => {
    if (!req.url?.startsWith("/ws")) return socket.destroy()

    const token = parseCookie(req.headers.cookie, SESSION_COOKIE)
    const user = token ? await userForToken(token) : null
    if (!user) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n")
      return socket.destroy()
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, user)
    })
  })

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage, user: { id: string }) => {
    if (!sockets.has(user.id)) sockets.set(user.id, new Set())
    sockets.get(user.id)!.add(ws)
    broadcastPresence()

    ws.on("message", async (raw) => {
      let msg: any
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return ws.send(JSON.stringify({ type: "error", message: "Bad message" }))
      }

      try {
        // The user id comes from the authenticated socket, never from the
        // message body — otherwise anyone could move as anyone.
        if (msg.type === "move") await handlers.move(user.id, msg)
        else if (msg.type === "resign") await handlers.resign(user.id, msg.gameId)
        else if (msg.type === "watch") await handlers.watch(user.id, msg.gameId)
      } catch (err: any) {
        ws.send(
          JSON.stringify({ type: "error", message: err?.message ?? "Failed" })
        )
      }
    })

    const cleanup = () => {
      const set = sockets.get(user.id)
      if (!set) return
      set.delete(ws)
      if (set.size === 0) sockets.delete(user.id)
      broadcastPresence()
    }
    ws.on("close", cleanup)
    ws.on("error", cleanup)
  })

  return wss
}
