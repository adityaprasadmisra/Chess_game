import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type User = { id: string; email: string; username: string }

type AuthState = {
  user: User | null
  /** True until the initial session check resolves. */
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

/** Surfaces the server's message so forms can show what actually went wrong. */
export class AuthError extends Error {}

async function post(path: string, body: unknown) {
  let res: Response
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    })
  } catch {
    throw new AuthError("Can't reach the server. Is the API running?")
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    // The server's own message is the useful one.
    if (data?.error) throw new AuthError(data.error)
    // A dev proxy with nothing behind it answers 500/502 rather than failing
    // the fetch, so an unreachable API lands here — not in the catch above.
    if (res.status >= 500)
      throw new AuthError("Can't reach the server. Is the API running?")
    throw new AuthError("Something went wrong. Please try again.")
  }
  return data ?? {}
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore an existing session on load: the cookie is httpOnly, so the client
  // cannot read it and must ask the server who it is.
  useEffect(() => {
    let cancelled = false
    fetch("/api/auth/me", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => !cancelled && setUser(d.user ?? null))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user } = await post("/api/auth/login", { email, password })
    setUser(user)
  }, [])

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const { user } = await post("/api/auth/register", {
        email,
        username,
        password,
      })
      setUser(user)
    },
    []
  )

  const logout = useCallback(async () => {
    await post("/api/auth/logout", {}).catch(() => {})
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>")
  return ctx
}
