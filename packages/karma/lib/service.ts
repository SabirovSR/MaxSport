import { ValidationError, type Pool } from "@maxsport/shared";
import type { Badge, User } from "@maxsport/shared";

export interface PassportView {
  user: User;
  badges: Badge[];
  attendancePct: number;
}

export interface KarmaService {
  submitVote(input: {
    voterId: string;
    targetId: string;
    lobbyId: string;
    reliability: "on_time" | "late" | "no_show";
    tag?: string;
  }): Promise<void>;
  getPassport(userId: string): Promise<PassportView>;
  awardRescueBadge(userId: string, lobbyId: string): Promise<void>;
}

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    maxUserId: Number(row.max_user_id),
    firstName: row.first_name as string,
    lastName: row.last_name as string | null,
    username: row.username as string | null,
    photoUrl: row.photo_url as string | null,
    gameLevel: row.game_level as User["gameLevel"],
    reliabilityPct: Number(row.reliability_pct),
    gamesPlayed: Number(row.games_played),
    createdAt: new Date(row.created_at as string),
  };
}

export function createKarmaService(pool: Pool): KarmaService {
  return {
    async submitVote(input) {
      if (input.voterId === input.targetId) {
        throw new ValidationError("Нельзя голосовать за себя");
      }
      const voter = await pool.query(
        `SELECT 1 FROM slots WHERE lobby_id = $1 AND user_id = $2`,
        [input.lobbyId, input.voterId]
      );
      if (!voter.rows[0]) {
        throw new ValidationError("Голосовать могут только участники Лобби");
      }
      const target = await pool.query(
        `SELECT 1 FROM presence_records WHERE lobby_id = $1 AND user_id = $2`,
        [input.lobbyId, input.targetId]
      );
      if (!target.rows[0]) {
        throw new ValidationError("Оценить можно только участника этого Лобби");
      }
      await pool.query(
        `INSERT INTO karma_votes (voter_id, target_id, lobby_id, reliability, tag)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (voter_id, target_id, lobby_id) DO UPDATE
         SET reliability = EXCLUDED.reliability, tag = EXCLUDED.tag`,
        [
          input.voterId,
          input.targetId,
          input.lobbyId,
          input.reliability,
          input.tag ?? null,
        ]
      );

      const stats = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE reliability = 'on_time') AS on_time,
           COUNT(*) AS total
         FROM karma_votes WHERE target_id = $1`,
        [input.targetId]
      );
      const onTime = Number(stats.rows[0]?.on_time ?? 0);
      const total = Number(stats.rows[0]?.total ?? 0);
      const pct = total > 0 ? Math.round((onTime / total) * 100) : 100;
      await pool.query(
        `UPDATE users SET reliability_pct = $1 WHERE id = $2`,
        [pct, input.targetId]
      );
    },

    async getPassport(userId) {
      const userResult = await pool.query(`SELECT * FROM users WHERE id = $1`, [
        userId,
      ]);
      if (!userResult.rows[0]) throw new ValidationError("Пользователь не найден");

      const badgesResult = await pool.query(
        `SELECT b.id, b.code, b.title, b.description
         FROM user_badges ub
         JOIN badges b ON b.id = ub.badge_id
         WHERE ub.user_id = $1`,
        [userId]
      );

      const presenceStats = await pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'on_site') AS on_site,
           COUNT(*) AS total
         FROM presence_records WHERE user_id = $1`,
        [userId]
      );
      const onSite = Number(presenceStats.rows[0]?.on_site ?? 0);
      const total = Number(presenceStats.rows[0]?.total ?? 0);
      const attendancePct =
        total > 0 ? Math.round((onSite / total) * 100) : 100;

      return {
        user: mapUser(userResult.rows[0]),
        badges: badgesResult.rows.map((row) => ({
          id: row.id as string,
          code: row.code as string,
          title: row.title as string,
          description: row.description as string,
        })),
        attendancePct,
      };
    },

    async awardRescueBadge(userId, lobbyId) {
      const badge = await pool.query(
        `SELECT id FROM badges WHERE code = 'match_rescuer'`
      );
      if (!badge.rows[0]) return;
      await pool.query(
        `INSERT INTO user_badges (user_id, badge_id, lobby_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, badge_id) DO NOTHING`,
        [userId, badge.rows[0].id, lobbyId]
      );
    },
  };
}
