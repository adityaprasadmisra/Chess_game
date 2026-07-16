import { motion } from "framer-motion"
import { ArrowRight, Swords, Undo2 } from "lucide-react"
import { Link } from "react-router-dom"

import { ChessBoardPreview } from "@/components/landing/chess-board-preview"
import { SiteNav } from "@/components/landing/site-nav"
import { Button } from "@/components/ui/button"
import { HolographicWall } from "@/components/ui/holographic-wall-shadcnui"

const EASE = [0.22, 1, 0.36, 1] as const

/** Entrance sequence: copy resolves top-down, board arrives last. */
const rise = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.15 + i * 0.09, ease: EASE },
  }),
}

export function LandingPage() {
  return (
    <>
      {/* Background layer */}
      <HolographicWall fullscreen intensity={0.8} radius={240} />

      {/* Overlay layer: legibility over the glyph field, plus the gradient
          lighting. Indigo pools bottom-left, emerald bleeds off the CTA. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-surface-void/70 via-surface-void/30 to-surface-void/90"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-40 -left-40 -z-10 size-[36rem] rounded-full bg-accent-indigo/20 blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -right-32 -top-32 -z-10 size-[30rem] rounded-full bg-accent-emerald/10 blur-[140px]"
      />

      <SiteNav />

      <main className="relative mx-auto flex min-h-dvh max-w-6xl flex-col justify-center px-5 pb-16 pt-28 sm:px-6 sm:pt-32">
        {/* grid-cols-1 + min-w-0 are load-bearing: an implicit auto column
            sizes to max-content, letting the headline push the page wider than
            the viewport and scroll it sideways on mobile. */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          {/* Copy */}
          <div className="flex min-w-0 flex-col items-start gap-6">
            <motion.div
              custom={0}
              variants={rise}
              initial="hidden"
              animate="show"
              className="glass flex items-center gap-2 rounded-full px-3 py-1.5"
            >
              <span className="text-xs text-muted-foreground">
                Two players · one board
              </span>
            </motion.div>

            <motion.h1
              custom={1}
              variants={rise}
              initial="hidden"
              animate="show"
              className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
            >
              Every game is a
              <span className="bg-gradient-to-r from-accent-amber via-accent-amber to-accent-emerald bg-clip-text text-transparent">
                {" "}
                position
              </span>
              <br className="hidden sm:block" /> worth playing.
            </motion.h1>

            <motion.p
              custom={2}
              variants={rise}
              initial="hidden"
              animate="show"
              className="max-w-[52ch] text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Sit down across the same screen and play. Full rules, legal moves
              only, and a board that gets out of your way — no account, no
              download, nothing to set up.
            </motion.p>

            <motion.div
              custom={3}
              variants={rise}
              initial="hidden"
              animate="show"
              className="flex flex-col gap-3 sm:flex-row"
            >
              <Button variant="primary" size="lg" className="group" asChild>
                <Link to="/play">
                  Play now
                  <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </motion.div>

            <motion.div
              custom={4}
              variants={rise}
              initial="hidden"
              animate="show"
              className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <Swords className="size-4 text-accent-indigo" />
                Legal moves, check &amp; mate
              </span>
              <span className="flex items-center gap-2">
                <Undo2 className="size-4 text-accent-amber" />
                Undo &amp; flip the board
              </span>
            </motion.div>
          </div>

          {/* Board */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
            className="w-full max-w-[34rem] justify-self-center lg:justify-self-end"
          >
            <div className="animate-float">
              <ChessBoardPreview />
            </div>
          </motion.div>
        </div>
      </main>
    </>
  )
}

export default LandingPage
