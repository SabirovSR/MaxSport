ALTER TABLE lobbies
  ADD COLUMN IF NOT EXISTS join_mode TEXT NOT NULL DEFAULT 'instant'
  CHECK (join_mode IN ('instant', 'approval'));

CREATE TABLE IF NOT EXISTS slot_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_join_request_one_pending_per_user
  ON slot_join_requests (lobby_id, user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_join_request_lobby_pending
  ON slot_join_requests (lobby_id, created_at)
  WHERE status = 'pending';
