-- MAX Sport schema (PostgreSQL + PostGIS)
-- Migrations: idempotent DDL only. Demo data → deploy/seeds/ + npm run seed:demo

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_user_id BIGINT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT,
  username TEXT,
  photo_url TEXT,
  game_level TEXT NOT NULL DEFAULT 'amateur' CHECK (game_level IN ('novice', 'amateur', 'advanced')),
  reliability_pct INT NOT NULL DEFAULT 100,
  games_played INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  venue_chat_id BIGINT,
  created_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lobbies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sport TEXT NOT NULL CHECK (sport IN ('volleyball', 'mini_football', 'basketball', 'padel_tennis')),
  game_level TEXT NOT NULL CHECK (game_level IN ('novice', 'amateur', 'advanced')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('draft', 'open', 'full', 'gathering', 'started', 'finished', 'cancelled')),
  start_at TIMESTAMPTZ NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  venue_id UUID NOT NULL REFERENCES venues(id),
  organizer_id UUID NOT NULL REFERENCES users(id),
  rent_total INT NOT NULL DEFAULT 0,
  deposit_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  slot_count INT NOT NULL,
  card_message_id TEXT,
  card_chat_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  role_required TEXT,
  user_id UUID REFERENCES users(id),
  version INT NOT NULL DEFAULT 0,
  slot_index INT NOT NULL,
  UNIQUE (lobby_id, slot_index)
);

CREATE TABLE IF NOT EXISTS presence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'expected' CHECK (status IN ('expected', 'on_the_way', 'on_site', 'no_show', 'cancelled')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_presence_slot ON presence_records(slot_id);

CREATE TABLE IF NOT EXISTS payment_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'hold_pending' CHECK (status IN ('hold_pending', 'held', 'charge_pending', 'charged', 'released', 'forfeit')),
  amount INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id UUID NOT NULL REFERENCES users(id),
  badge_id UUID NOT NULL REFERENCES badges(id),
  lobby_id UUID REFERENCES lobbies(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE IF NOT EXISTS karma_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID NOT NULL REFERENCES users(id),
  target_id UUID NOT NULL REFERENCES users(id),
  lobby_id UUID NOT NULL REFERENCES lobbies(id),
  reliability TEXT NOT NULL CHECK (reliability IN ('on_time', 'late', 'no_show')),
  tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (voter_id, target_id, lobby_id)
);

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id UUID NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  processed_at TIMESTAMPTZ,
  UNIQUE (lobby_id, kind)
);

CREATE INDEX IF NOT EXISTS idx_lobbies_start_at ON lobbies(start_at);
CREATE INDEX IF NOT EXISTS idx_lobbies_status ON lobbies(status);
CREATE INDEX IF NOT EXISTS idx_slots_lobby ON slots(lobby_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_run_at ON scheduled_jobs(run_at) WHERE processed_at IS NULL;

INSERT INTO badges (code, title, description)
VALUES ('match_rescuer', 'Спасатель матча', 'Занял горящий слот и дошёл до площадки')
ON CONFLICT (code) DO NOTHING;
