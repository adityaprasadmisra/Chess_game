-- Chess game schema. Applied idempotently on every server start.
--
-- Deliberately uses no extensions: gen_random_uuid() is core since PG13, and
-- case-insensitivity is handled by normalising email/username to lowercase in
-- the application rather than depending on citext. That keeps this schema
-- identical on a real Postgres server and on PGlite.

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stored already lowercased by the app; emails are case-insensitive in
  -- practice and treating them otherwise lets one person register twice.
  email         TEXT NOT NULL UNIQUE,
  -- Kept as typed, for display. Uniqueness is enforced case-insensitively by
  -- the functional index below, so "Magnus" cannot impersonate "magnus".
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
  ON users (lower(username));

-- Sessions store a SHA-256 of the cookie token, never the token itself: a dump
-- of this table must not be replayable as a set of live logins.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions(expires_at);

-- One row per relationship, never two. `requester` is who asked, so the
-- direction is still known, but the unique index is on the *ordered pair* —
-- otherwise A→B and B→A both insert and the friendship exists twice with
-- potentially disagreeing statuses.
CREATE TABLE IF NOT EXISTS friendships (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (requester_id <> addressee_id)   -- nobody friends themselves
);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_pair_idx ON friendships (
  LEAST(requester_id::text, addressee_id::text),
  GREATEST(requester_id::text, addressee_id::text)
);
CREATE INDEX IF NOT EXISTS friendships_addressee_idx ON friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS friendships_requester_idx ON friendships(requester_id, status);

-- The server owns the position. `fen` is the authoritative current state and
-- `pgn` the replayable history; the client is never trusted to report either.
CREATE TABLE IF NOT EXISTS games (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  white_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  black_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fen        TEXT NOT NULL,
  pgn        TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('active', 'finished', 'aborted')),
  result     TEXT CHECK (result IN ('1-0', '0-1', '1/2-1/2')),
  end_reason TEXT,
  winner_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (white_id <> black_id)
);

CREATE INDEX IF NOT EXISTS games_white_idx  ON games(white_id, status);
CREATE INDEX IF NOT EXISTS games_black_idx  ON games(black_id, status);

CREATE TABLE IF NOT EXISTS invites (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  game_id    UUID REFERENCES games(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (from_id <> to_id)
);

-- At most one live invite per direction; re-inviting should not spam a queue.
CREATE UNIQUE INDEX IF NOT EXISTS invites_pending_idx
  ON invites (from_id, to_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS invites_to_idx ON invites(to_id, status);
