import { AnimatePresence, motion } from "framer-motion"
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom"

import { InviteToast } from "@/components/invite-toast"
import { AuthProvider } from "@/lib/auth"
import { RealtimeProvider } from "@/lib/realtime"
import FriendsPage from "@/pages/friends-page"
import GamePage from "@/pages/game-page"
import LandingPage from "@/pages/landing-page"
import LoginPage from "@/pages/login-page"
import OnlineGamePage from "@/pages/online-game-page"
import RegisterPage from "@/pages/register-page"

/** Cross-fade between routes. The wall persists underneath, so pages should
 *  hand over without the background appearing to reload. */
function Fade({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Fade><LandingPage /></Fade>} />
        <Route path="/login" element={<Fade><LoginPage /></Fade>} />
        <Route path="/register" element={<Fade><RegisterPage /></Fade>} />
        <Route path="/friends" element={<Fade><FriendsPage /></Fade>} />
        {/* Local two-player board: open to everyone, nothing to gate. */}
        <Route path="/play" element={<Fade><GamePage /></Fade>} />
        {/* Online game: the server checks you're actually one of the players. */}
        <Route path="/game/:id" element={<Fade><OnlineGamePage /></Fade>} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/* Realtime lives inside the router so invites can navigate you into a
            game from anywhere in the app. */}
        <RealtimeProvider>
          <AnimatedRoutes />
          <InviteToast />
        </RealtimeProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}
