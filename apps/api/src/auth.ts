import type { FastifyRequest } from "fastify";
import { validateInitData } from "@maxsport/max-channel/auth";
import { UnauthorizedError, type Pool } from "@maxsport/shared";

export interface AuthUser {
  id: string;
  maxUserId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
}

export async function upsertUser(
  pool: Pool,
  parsed: NonNullable<ReturnType<typeof validateInitData>>
): Promise<AuthUser> {
  const result = await pool.query(
    `INSERT INTO users (max_user_id, first_name, last_name, username, photo_url)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (max_user_id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       last_name = EXCLUDED.last_name,
       username = EXCLUDED.username,
       photo_url = EXCLUDED.photo_url
     RETURNING id, max_user_id, first_name, last_name, username, photo_url`,
    [
      parsed.user.id,
      parsed.user.first_name,
      parsed.user.last_name ?? null,
      parsed.user.username ?? null,
      parsed.user.photo_url ?? null,
    ]
  );
  const row = result.rows[0]!;
  return {
    id: row.id as string,
    maxUserId: Number(row.max_user_id),
    firstName: row.first_name as string,
    lastName: row.last_name as string | null,
    username: row.username as string | null,
    photoUrl: row.photo_url as string | null,
  };
}

export async function requireAuth(
  request: FastifyRequest,
  pool: Pool,
  botToken: string
): Promise<AuthUser> {
  const initData =
    (request.headers["x-init-data"] as string | undefined) ??
    (request.query as { initData?: string }).initData;

  if (!initData) throw new UnauthorizedError();

  const parsed = validateInitData(initData, botToken);
  if (!parsed) throw new UnauthorizedError("Невалидный initData");

  return upsertUser(pool, parsed);
}

export async function findUserByMaxId(
  pool: Pool,
  maxUserId: number
): Promise<AuthUser | null> {
  const result = await pool.query(
    `SELECT id, max_user_id, first_name, last_name, username, photo_url
     FROM users WHERE max_user_id = $1`,
    [maxUserId]
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    id: row.id as string,
    maxUserId: Number(row.max_user_id),
    firstName: row.first_name as string,
    lastName: row.last_name as string | null,
    username: row.username as string | null,
    photoUrl: row.photo_url as string | null,
  };
}
