ALTER TABLE lobbies DROP CONSTRAINT IF EXISTS lobbies_game_level_check;
ALTER TABLE lobbies ADD CONSTRAINT lobbies_game_level_check
  CHECK (game_level IN ('novice', 'amateur', 'advanced', 'any'));
