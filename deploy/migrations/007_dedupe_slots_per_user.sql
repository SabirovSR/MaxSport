-- One player may occupy only one slot in a lobby.
-- Clear extras first so the unique index can be applied on existing data.

UPDATE presence_records
SET status = 'cancelled', updated_at = NOW()
WHERE slot_id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY lobby_id, user_id
             ORDER BY slot_index
           ) AS rn
    FROM slots
    WHERE user_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

UPDATE slots
SET user_id = NULL, version = version + 1
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY lobby_id, user_id
             ORDER BY slot_index
           ) AS rn
    FROM slots
    WHERE user_id IS NOT NULL
  ) ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_one_user_per_lobby
  ON slots (lobby_id, user_id)
  WHERE user_id IS NOT NULL;
