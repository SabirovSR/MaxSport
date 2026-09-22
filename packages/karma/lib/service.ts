import {
  isSport,
  normalizePreferredRoles,
  ValidationError,
  type Pool,
} from "@maxsport/shared";
import type {
  Badge,
  GameLevel,
  Sport,
  SportSkill,
  User,
} from "@maxsport/shared";

export interface PassportView {
  user: User;
  badges: Badge[];
  attendancePct: number;
  sportSkills: SportSkill[];
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
  getSportSkill(userId: string, sport: string): Promise<SportSkill | null>;
  upsertSportSkill(
    userId: string,
    sport: string,
    input: { gameLevel: GameLevel; preferredRoles: string[] }
  ): Promise<SportSkill>;
  deleteSportSkill(userId: string, sport: string): Promise<void>;
  getKarmaStatus(
    lobbyId: string,
    userId: string
  ): Promise<{
    open: boolean;
    remainingTargets: number;
    votedTargetIds: string[];
  }>;
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

function mapSkill(row: Record<string, unknown>): SportSkill {
  return {
    sport: row.sport as Sport,
    gameLevel: row.game_level as GameLevel,
    preferredRoles: (row.preferred_roles as string[]) ?? [],
    updatedAt: new Date(row.updated_at as string),
  };
}

export function createKarmaService(pool: Pool): KarmaService {
  return {
    async submitVote(input) {
      if (input.voterId === input.targetId) {
        throw new ValidationError("Нельзя голосовать за себя");
      }
      const lobby = await pool.query(
        `SELECT status FROM lobbies WHERE id = $1`,
        [input.lobbyId]
      );
      if (lobby.rows[0]?.status !== "finished") {
        throw new ValidationError(
          "Оценивать Игроков можно после завершения игры"
        );
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
      await pool.query(`UPDATE users SET reliability_pct = $1 WHERE id = $2`, [
        pct,
        input.targetId,
      ]);
    },

    async getPassport(userId) {
      const userResult = await pool.query(`SELECT * FROM users WHERE id = $1`, [
        userId,
      ]);
      if (!userResult.rows[0])
        throw new ValidationError("Пользователь не найден");

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
      const skillsResult = await pool.query(
        `SELECT sport, game_level, preferred_roles, updated_at
         FROM user_sport_skills
         WHERE user_id = $1
         ORDER BY sport`,
        [userId]
      );

      return {
        user: mapUser(userResult.rows[0]),
        badges: badgesResult.rows.map((row) => ({
          id: row.id as string,
          code: row.code as string,
          title: row.title as string,
          description: row.description as string,
        })),
        attendancePct,
        sportSkills: skillsResult.rows.map(mapSkill),
      };
    },

    async getSportSkill(userId, sportValue) {
      if (!isSport(sportValue)) {
        throw new ValidationError("Неизвестный вид спорта");
      }
      const result = await pool.query(
        `SELECT sport, game_level, preferred_roles, updated_at
         FROM user_sport_skills
         WHERE user_id = $1 AND sport = $2`,
        [userId, sportValue]
      );
      return result.rows[0] ? mapSkill(result.rows[0]) : null;
    },

    async upsertSportSkill(userId, sportValue, input) {
      if (!isSport(sportValue)) {
        throw new ValidationError("Неизвестный вид спорта");
      }
      if (!["novice", "amateur", "advanced"].includes(input.gameLevel)) {
        throw new ValidationError("Некорректный уровень игры");
      }
      const preferredRoles = normalizePreferredRoles(
        sportValue,
        input.preferredRoles
      );
      if (!preferredRoles) {
        throw new ValidationError(
          "Выберите не более четырёх допустимых Амплуа"
        );
      }
      const result = await pool.query(
        `INSERT INTO user_sport_skills
         (user_id, sport, game_level, preferred_roles)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, sport) DO UPDATE SET
           game_level = EXCLUDED.game_level,
           preferred_roles = EXCLUDED.preferred_roles,
           updated_at = NOW()
         RETURNING sport, game_level, preferred_roles, updated_at`,
        [userId, sportValue, input.gameLevel, preferredRoles]
      );
      return mapSkill(result.rows[0]!);
    },

    async deleteSportSkill(userId, sportValue) {
      if (!isSport(sportValue)) {
        throw new ValidationError("Неизвестный вид спорта");
      }
      await pool.query(
        `DELETE FROM user_sport_skills WHERE user_id = $1 AND sport = $2`,
        [userId, sportValue]
      );
    },

    async getKarmaStatus(lobbyId, userId) {
      const lobby = await pool.query(
        `SELECT status FROM lobbies WHERE id = $1`,
        [lobbyId]
      );
      if (!lobby.rows[0]) throw new ValidationError("Лобби не найдено");
      const membership = await pool.query(
        `SELECT 1 FROM slots WHERE lobby_id = $1 AND user_id = $2`,
        [lobbyId, userId]
      );
      if (!membership.rows[0]) {
        return { open: false, remainingTargets: 0, votedTargetIds: [] };
      }
      const targets = await pool.query(
        `SELECT s.user_id,
                EXISTS (
                  SELECT 1 FROM karma_votes kv
                  WHERE kv.lobby_id = $1
                    AND kv.voter_id = $2
                    AND kv.target_id = s.user_id
                ) AS voted
         FROM slots s
         WHERE s.lobby_id = $1
           AND s.user_id IS NOT NULL
           AND s.user_id <> $2`,
        [lobbyId, userId]
      );
      const votedTargetIds = targets.rows
        .filter((row) => row.voted)
        .map((row) => row.user_id as string);
      return {
        open: lobby.rows[0].status === "finished",
        remainingTargets: targets.rows.length - votedTargetIds.length,
        votedTargetIds,
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
