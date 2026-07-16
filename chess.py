import pygame
import chess

pygame.init()

WIDTH, HEIGHT = 640, 640
SQ = WIDTH // 8

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("2 Player Chess")

WHITE = (240, 217, 181)
BROWN = (181, 136, 99)
HIGHLIGHT = (255, 255, 0)

font = pygame.font.SysFont(None, 48)

board = chess.Board()

pieces = {
    'P': '♙', 'N': '♘', 'B': '♗', 'R': '♖', 'Q': '♕', 'K': '♔',
    'p': '♟', 'n': '♞', 'b': '♝', 'r': '♜', 'q': '♛', 'k': '♚'
}

selected = None

running = True

while running:

    for event in pygame.event.get():

        if event.type == pygame.QUIT:
            running = False

        if event.type == pygame.MOUSEBUTTONDOWN:

            mx, my = pygame.mouse.get_pos()

            col = mx // SQ
            row = my // SQ

            square = chess.square(col, 7 - row)

            if selected is None:

                piece = board.piece_at(square)

                if piece:
                    selected = square

            else:

                move = chess.Move(selected, square)

                if move in board.legal_moves:
                    board.push(move)

                else:
                    promo = chess.Move(
                        selected,
                        square,
                        promotion=chess.QUEEN
                    )

                    if promo in board.legal_moves:
                        board.push(promo)

                selected = None

    # Draw board
    for row in range(8):
        for col in range(8):

            color = WHITE if (row + col) % 2 == 0 else BROWN

            pygame.draw.rect(
                screen,
                color,
                (col * SQ, row * SQ, SQ, SQ)
            )

    # Highlight selected square
    if selected is not None:
        col = chess.square_file(selected)
        row = 7 - chess.square_rank(selected)

        pygame.draw.rect(
            screen,
            HIGHLIGHT,
            (col * SQ, row * SQ, SQ, SQ),
            4
        )

    # Draw pieces
    for square in chess.SQUARES:

        piece = board.piece_at(square)

        if piece:

            col = chess.square_file(square)
            row = 7 - chess.square_rank(square)

            text = font.render(
                pieces[piece.symbol()],
                True,
                (0, 0, 0)
            )

            rect = text.get_rect(
                center=(col * SQ + SQ // 2,
                        row * SQ + SQ // 2)
            )

            screen.blit(text, rect)

    pygame.display.flip()

    if board.is_checkmate():
        print("Checkmate!")
        running = False

pygame.quit()
