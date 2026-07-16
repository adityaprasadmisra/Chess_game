import type { CSSProperties } from "react"

/**
 * Shared board presentation. The hero preview and the real board both use this
 * so they can't drift apart visually.
 *
 * The squares need genuine light/dark contrast: a black piece is unreadable on
 * a near-black square, which makes the two sides indistinguishable at a glance.
 */
export const LIGHT_SQUARE = "#9FADC2"
export const DARK_SQUARE = "#46566E"
export const LAST_MOVE = "#3F7D62"
export const CHECK_SQUARE = "#B4453C"

/**
 * Piece fills. Both sides render from the solid glyph set and are told apart by
 * colour, so white gets a faint dark rim to hold its shape on light squares.
 *
 * Must be paired with the `.chess-glyph` class: U+265F (♟) is the one chess
 * character with an emoji presentation, and left to default fonts it resolves
 * to a colour-emoji face that ignores `color` entirely — rendering both sides'
 * pawns as the same glyph.
 */
export function pieceStyle(white: boolean): CSSProperties {
  return white
    ? {
        color: "#FFFFFF",
        WebkitTextStroke: "0.6px rgba(2,6,23,0.55)",
        filter: "drop-shadow(0 1px 2px rgba(2,6,23,0.5))",
      }
    : {
        color: "#080D18",
        filter: "drop-shadow(0 1px 2px rgba(2,6,23,0.4))",
      }
}

/** Solid glyphs, keyed by chess.js piece type. Colour comes from pieceStyle. */
export const PIECE_GLYPH: Record<string, string> = {
  p: "♟",
  n: "♞",
  b: "♝",
  r: "♜",
  q: "♛",
  k: "♚",
}
