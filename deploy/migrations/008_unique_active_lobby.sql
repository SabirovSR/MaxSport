CREATE UNIQUE INDEX IF NOT EXISTS idx_lobbies_unique_active_event
  ON lobbies (venue_id, start_at, sport)
  WHERE status NOT IN ('cancelled', 'finished');
