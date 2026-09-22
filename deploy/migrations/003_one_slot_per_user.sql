-- A player may occupy at most one Slot in a given Lobby.
CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_one_user_per_lobby
  ON slots (lobby_id, user_id)
  WHERE user_id IS NOT NULL;
