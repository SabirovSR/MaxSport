-- Demo venues and a hot lobby (run after at least one user exists via Mini App)
-- Usage: psql $DATABASE_URL -f deploy/migrations/003_pitch_seed.sql

INSERT INTO venues (id, name, address, location, created_by, venue_chat_id)
SELECT
  '00000000-0000-4000-8000-000000000001',
  'ФОК «Центральный»',
  'ул. Спортивная, 1, Москва',
  ST_SetSRID(ST_MakePoint(37.6173, 55.7558), 4326)::geography,
  u.id,
  NULL
FROM users u
ORDER BY u.created_at
LIMIT 1
ON CONFLICT (id) DO NOTHING;

-- Hot volleyball lobby starting in 2 hours (only if organizer exists)
INSERT INTO lobbies (
  id, sport, game_level, status, start_at, is_recurring, venue_id, organizer_id,
  rent_total, deposit_enabled, slot_count
)
SELECT
  '00000000-0000-4000-8000-000000000010',
  'volleyball',
  'amateur',
  'open',
  NOW() + INTERVAL '2 hours',
  FALSE,
  '00000000-0000-4000-8000-000000000001',
  u.id,
  4200,
  TRUE,
  12
FROM users u
ORDER BY u.created_at
LIMIT 1
ON CONFLICT (id) DO NOTHING;

INSERT INTO slots (lobby_id, role_required, user_id, slot_index)
SELECT
  '00000000-0000-4000-8000-000000000010',
  CASE WHEN gs.i = 11 THEN 'Связующий' ELSE NULL END,
  CASE WHEN gs.i = 0 THEN l.organizer_id ELSE NULL END,
  gs.i
FROM lobbies l
CROSS JOIN generate_series(0, 11) AS gs(i)
WHERE l.id = '00000000-0000-4000-8000-000000000010'
ON CONFLICT DO NOTHING;

INSERT INTO presence_records (slot_id, lobby_id, user_id, status)
SELECT s.id, s.lobby_id, s.user_id, 'expected'
FROM slots s
WHERE s.lobby_id = '00000000-0000-4000-8000-000000000010'
  AND s.user_id IS NOT NULL
ON CONFLICT (slot_id) DO NOTHING;

INSERT INTO scheduled_jobs (lobby_id, kind, run_at)
SELECT '00000000-0000-4000-8000-000000000010', j.kind, l.start_at + j.offset
FROM lobbies l
CROSS JOIN (
  VALUES
    ('reminder_t24', INTERVAL '-24 hours'),
    ('reminder_t2', INTERVAL '-2 hours'),
    ('reminder_t30', INTERVAL '-30 minutes'),
    ('venue_ping_t60', INTERVAL '-60 minutes'),
    ('karma_poll', INTERVAL '3 hours')
) AS j(kind, offset)
WHERE l.id = '00000000-0000-4000-8000-000000000010'
ON CONFLICT (lobby_id, kind) DO NOTHING;
