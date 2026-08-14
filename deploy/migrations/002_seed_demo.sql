-- Demo seed for pitch (run manually after first user exists)
-- Example:
-- INSERT INTO venues (name, address, location, created_by)
-- SELECT 'ФОК «Центральный»', 'ул. Спортивная, 1',
--        ST_SetSRID(ST_MakePoint(37.6173, 55.7558), 4326)::geography, u.id
-- FROM users u ORDER BY created_at LIMIT 1;
SELECT 1;
