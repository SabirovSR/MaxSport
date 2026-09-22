CREATE TABLE IF NOT EXISTS user_sport_skills (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport TEXT NOT NULL CHECK (
    sport IN (
      'volleyball',
      'mini_football',
      'basketball',
      'padel_tennis',
      'floorball',
      'ice_hockey',
      'water_polo',
      'table_tennis',
      'airsoft',
      'paintball'
    )
  ),
  game_level TEXT NOT NULL CHECK (
    game_level IN ('novice', 'amateur', 'advanced')
  ),
  preferred_roles TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, sport)
);

CREATE INDEX IF NOT EXISTS idx_user_sport_skills_user
  ON user_sport_skills (user_id);
