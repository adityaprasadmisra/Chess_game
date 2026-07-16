import { motion } from "framer-motion"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

export function SiteNav() {
  const { user, loading, logout } = useAuth()

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-x-0 top-0 z-50 px-4 pt-4"
    >
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between rounded-full px-4 py-2.5 shadow-glass sm:px-5">
        <Link to="/" className="flex items-center gap-2.5 pl-1">
          <span className="chess-glyph text-2xl leading-none text-accent-amber">
            ♚︎
          </span>
          <span className="text-sm font-semibold tracking-tight">Gambit</span>
        </Link>

        {/* Render nothing rather than flashing "Sign in" at someone who is
            already signed in, while the session check is still in flight. */}
        {loading ? (
          <div className="h-9 w-32" aria-hidden />
        ) : user ? (
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user.username}
            </span>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/friends">Friends</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link to="/play">Play</Link>
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button variant="primary" size="sm" asChild>
              <Link to="/register">Register</Link>
            </Button>
          </div>
        )}
      </nav>
    </motion.header>
  )
}
