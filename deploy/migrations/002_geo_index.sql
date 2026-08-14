-- Spatial index for the "рядом" filter and the presence radius check.
--
-- 001_init created venues.location without one, so every ST_DWithin call
-- (both the lobby feed and the on-site geo check) does a sequential scan.

CREATE INDEX IF NOT EXISTS idx_venues_location ON venues USING GIST (location);
