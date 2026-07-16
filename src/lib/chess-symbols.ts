/**
 * The twelve Unicode chess glyphs, mirroring the piece set already used by
 * Chess.py. Shared by the HolographicWall background and the board preview so
 * both render the same characters.
 */
export const CHESS_SYMBOLS = [
  "♔",
  "♕",
  "♖",
  "♗",
  "♘",
  "♙",
  "♚",
  "♛",
  "♜",
  "♝",
  "♞",
  "♟",
] as const

export type ChessSymbol = (typeof CHESS_SYMBOLS)[number]

/**
 * U+FE0E, the text-presentation variation selector.
 *
 * U+265F (♟) is the only chess character with an emoji presentation, so
 * browsers route it to the colour-emoji font — which paints its own colours and
 * silently ignores `color` / `-webkit-text-stroke`. Left alone, both sides'
 * pawns render as the same purple emoji and white/black become
 * indistinguishable. VS15 forces text rendering; pair it with the
 * `.chess-glyph` class, which pins a font stack containing no emoji fonts.
 */
export const TEXT_PRESENTATION = "︎"

/** Render a chess glyph as text rather than emoji. */
export function asTextGlyph(symbol: string) {
  return symbol + TEXT_PRESENTATION
}
