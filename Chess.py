import pygame
import chess

# ----------------------------
# Initialize
# ----------------------------
pygame.init()

WIDTH = 800
HEIGHT = 800
SQ_SIZE = WIDTH // 8

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("2 Player Chess")

# Colors
LIGHT = (240, 217, 181)
DARK = (181, 136, 99)
SELECT = (255, 255, 0)
MOVE = (100, 255, 100)

# Chess Board
board = chess.Board()

# Font for chess symbols
font = pygame.font.SysFont("Segoe UI Symbol", 64)

# Unicode Chess Pieces
pieces = {
    'P': '♙',
    'N': '♘',
    'B': '♗',
    'R': '♖',
    'Q': '♕',
    'K': '♔',
    'p': '♟',
    'n': '♞',
    'b': '♝',
    'r': '♜',
    'q': '♛',
    'k': '♚'
}

selected_square = None
legal_targets = []

running = True

while running:

    # ----------------------------
    # Events
    # ----------------------------
    for event in pygame.event.get():

        if event.type == pygame.QUIT:
            running = False

        if event.type == pygame.MOUSEBUTTONDOWN:

            mx, my = pygame.mouse.get_pos()

            col = mx // SQ_SIZE
            row = my // SQ_SIZE

            square = chess.square(col, 7 - row)

            if selected_square is None:

                piece = board.piece_at(square)

                if piece and piece.color == board.turn:

                    selected_square = square

                    legal_targets = []

                    for move in board.legal_moves:
                        if move.from_square == square:
                            legal_targets.append(move.to_square)

            else:

                move = chess.Move(selected_square, square)

                # Promotion
                if move not in board.legal_moves:
                    move = chess.Move(
                        selected_square,
                        square,
                        promotion=chess.QUEEN
                    )

                if move in board.legal_moves:
                    board.push(move)

                selected_square = None
                legal_targets = []

    # ----------------------------
    # Draw Board
    # ----------------------------
    for row in range(8):
        for col in range(8):

            color = LIGHT if (row + col) % 2 == 0 else DARK

            pygame.draw.rect(
                screen,
                color,
                (
                    col * SQ_SIZE,
                    row * SQ_SIZE,
                    SQ_SIZE,
                    SQ_SIZE
                )
            )

    # ----------------------------
    # Highlight Selected Piece
    # ----------------------------
    if selected_square is not None:

        col = chess.square_file(selected_square)
        row = 7 - chess.square_rank(selected_square)

        pygame.draw.rect(
            screen,
            SELECT,
            (
                col * SQ_SIZE,
                row * SQ_SIZE,
                SQ_SIZE,
                SQ_SIZE
            ),
            4
        )

    # ----------------------------
    # Highlight Legal Moves
    # ----------------------------
    for target in legal_targets:

        col = chess.square_file(target)
        row = 7 - chess.square_rank(target)

        pygame.draw.circle(
            screen,
            MOVE,
            (
                col * SQ_SIZE + SQ_SIZE // 2,
                row * SQ_SIZE + SQ_SIZE // 2
            ),
            12
        )

    # ----------------------------
    # Draw Pieces
    # ----------------------------
    for square in chess.SQUARES:

        piece = board.piece_at(square)

        if piece:

            col = chess.square_file(square)
            row = 7 - chess.square_rank(square)

            symbol = pieces[piece.symbol()]

            text = font.render(
                symbol,
                True,
                (0, 0, 0)
            )

            rect = text.get_rect(
                center=(
                    col * SQ_SIZE + SQ_SIZE // 2,
                    row * SQ_SIZE + SQ_SIZE // 2
                )
            )

            screen.blit(text, rect)

    # ----------------------------
    # Checkmate
    # ----------------------------
    if board.is_checkmate():

        winner = "Black" if board.turn else "White"

        pygame.display.set_caption(
            f"Checkmate! {winner} Wins"
        )

    pygame.display.flip()

pygame.quit()