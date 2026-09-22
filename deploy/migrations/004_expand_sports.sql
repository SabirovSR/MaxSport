ALTER TABLE lobbies
  DROP CONSTRAINT IF EXISTS lobbies_sport_check;

ALTER TABLE lobbies
  ADD CONSTRAINT lobbies_sport_check
  CHECK (
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
  );
