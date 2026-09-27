import {
  DomainError,
  ForbiddenError,
  ValidationError,
  type ScheduledJobKind,
} from "@maxsport/shared";
import type { MaxApiClient } from "@maxsport/max-channel";
import type { Pool } from "@maxsport/shared";

export interface NotificationScheduler {
  start(): void;
  stop(): void;
  scheduleLobbyJobs(lobbyId: string, startAt: Date): Promise<void>;
  rescheduleLobbyJobs(lobbyId: string, startAt: Date): Promise<void>;
  notifyLobbyPlayers(lobbyId: string, organizerId: string): Promise<number>;
  notifyJoinRequest(
    lobbyId: string,
    applicant: {
      firstName: string;
      lastName: string | null;
      roleRequired: string | null;
    }
  ): Promise<void>;
  notifyContact(
    lobbyId: string,
    fromUserId: string,
    toUserId?: string
  ): Promise<void>;
}

const JOB_OFFSETS: Record<
  Exclude<ScheduledJobKind, "presence_window" | "karma_poll" | "no_show_check">,
  number
> = {
  reminder_t24: -24 * 60,
  reminder_t2: -2 * 60,
  reminder_t30: -30,
  venue_ping_t60: -60,
};

async function deliver(
  maxApi: MaxApiClient,
  input: Parameters<MaxApiClient["sendMessage"]>[0]
) {
  try {
    return await maxApi.sendMessage(input);
  } catch {
    throw new DomainError(
      "Бот не смог доставить сообщение. Напишите боту в личку и повторите",
      "MAX_UPSTREAM"
    );
  }
}

export function createNotificationScheduler(
  pool: Pool,
  maxApi: MaxApiClient
): NotificationScheduler {
  let timer: ReturnType<typeof setInterval> | null = null;

  async function enqueueJobs(lobbyId: string, startAt: Date) {
    for (const [kind, offsetMinutes] of Object.entries(JOB_OFFSETS)) {
      const runAt = new Date(startAt.getTime() + offsetMinutes * 60 * 1000);
      await pool.query(
        `INSERT INTO scheduled_jobs (lobby_id, kind, run_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (lobby_id, kind) DO NOTHING`,
        [lobbyId, kind, runAt.toISOString()]
      );
    }
    const gatheringAt = new Date(startAt.getTime() - 20 * 60 * 1000);
    await pool.query(
      `INSERT INTO scheduled_jobs (lobby_id, kind, run_at)
       VALUES ($1, 'presence_window', $2)
       ON CONFLICT (lobby_id, kind) DO NOTHING`,
      [lobbyId, gatheringAt.toISOString()]
    );
    const noShowAt = new Date(startAt.getTime() + 15 * 60 * 1000);
    await pool.query(
      `INSERT INTO scheduled_jobs (lobby_id, kind, run_at)
       VALUES ($1, 'no_show_check', $2)
       ON CONFLICT (lobby_id, kind) DO NOTHING`,
      [lobbyId, noShowAt.toISOString()]
    );
    await pool.query(
      `INSERT INTO scheduled_jobs (lobby_id, kind, run_at)
       VALUES ($1, 'karma_poll', $2)
       ON CONFLICT (lobby_id, kind) DO NOTHING`,
      [lobbyId, new Date(startAt.getTime() + 3 * 60 * 60 * 1000).toISOString()]
    );
  }

  async function processDueJobs() {
    await pool.query(
      `UPDATE lobbies SET status = 'gathering'
       WHERE status IN ('open', 'full')
         AND start_at <= NOW() + INTERVAL '20 minutes'
         AND start_at > NOW() - INTERVAL '15 minutes'`
    );

    const due = await pool.query(
      `SELECT sj.*, l.start_at, l.venue_id, v.name AS venue_name, v.address, v.venue_chat_id
       FROM scheduled_jobs sj
       JOIN lobbies l ON l.id = sj.lobby_id
       JOIN venues v ON v.id = l.venue_id
       WHERE sj.processed_at IS NULL AND sj.run_at <= NOW()
       LIMIT 20`
    );

    for (const job of due.rows) {
      const players = await pool.query(
        `SELECT u.max_user_id, u.first_name, pr.status, s.id AS slot_id
         FROM slots s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN presence_records pr ON pr.slot_id = s.id
         WHERE s.lobby_id = $1 AND s.user_id IS NOT NULL`,
        [job.lobby_id]
      );

      if (job.kind === "no_show_check") {
        await pool.query(
          `UPDATE presence_records SET status = 'no_show', updated_at = NOW()
           WHERE lobby_id = $1 AND status NOT IN ('on_site', 'cancelled', 'no_show')`,
          [job.lobby_id]
        );
      }

      for (const player of players.rows) {
        const maxUserId = Number(player.max_user_id);
        if (!maxUserId) continue;

        if (job.kind === "reminder_t24") {
          await maxApi.sendMessage({
            userId: maxUserId,
            text: `🏐 Идёшь на игру? Подтверди участие в MAX Sport.`,
            buttons: [
              [
                {
                  type: "callback",
                  text: "Иду",
                  payload: `presence_go:${player.slot_id}`,
                },
                {
                  type: "callback",
                  text: "Не смогу",
                  payload: `presence_cancel:${player.slot_id}`,
                },
              ],
            ],
          });
        } else if (job.kind === "reminder_t2") {
          await maxApi.sendMessage({
            userId: maxUserId,
            text: `⏰ Через 2 часа игра! Подтверди, что идёшь.`,
            buttons: [
              [
                {
                  type: "callback",
                  text: "Иду",
                  payload: `presence_go:${player.slot_id}`,
                },
                {
                  type: "callback",
                  text: "Не смогу",
                  payload: `presence_cancel:${player.slot_id}`,
                },
              ],
            ],
          });
        } else if (job.kind === "reminder_t30") {
          await maxApi.sendMessage({
            userId: maxUserId,
            text: `🚗 Выезжай! ${job.venue_name}, ${job.address}`,
            buttons: [
              [
                {
                  type: "callback",
                  text: "Я на месте",
                  payload: `presence_onsite:${player.slot_id}`,
                },
              ],
            ],
          });
        } else if (job.kind === "presence_window") {
          await maxApi.sendMessage({
            userId: maxUserId,
            text: `📍 Окно Явки открыто. Нажми «Я на месте», когда будешь на площадке.`,
            buttons: [
              [
                {
                  type: "callback",
                  text: "Я на месте",
                  payload: `presence_onsite:${player.slot_id}`,
                },
              ],
            ],
          });
        } else if (job.kind === "karma_poll") {
          await maxApi.sendMessage({
            userId: maxUserId,
            text: `⭐ Как прошла игра? Оцени напарников в Mini App (10 секунд).`,
            buttons: [
              [
                {
                  type: "open_app",
                  text: "Оценить",
                  url: `https://max.ru/${process.env.BOT_USERNAME ?? "gov_max_sport_bot"}?startapp=lobby_${job.lobby_id}`,
                },
              ],
            ],
          });
        }
      }

      if (job.kind === "venue_ping_t60" && job.venue_chat_id) {
        const onSite = players.rows.filter(
          (p) => p.status === "on_site"
        ).length;
        await maxApi.sendMessage({
          chatId: Number(job.venue_chat_id),
          text: `📍 Группа на подходе: явка ${onSite}/${players.rows.length}\n🏟 ${job.venue_name}`,
        });
      }

      await pool.query(
        `UPDATE scheduled_jobs SET processed_at = NOW() WHERE id = $1`,
        [job.id]
      );
    }
  }

  return {
    start() {
      if (timer) return;
      timer = setInterval(() => {
        // ошибка тика не роняет процесс
        processDueJobs().catch((error) => {
          console.error("Notification tick failed", error);
        });
      }, 30_000);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    scheduleLobbyJobs: enqueueJobs,
    async rescheduleLobbyJobs(lobbyId, startAt) {
      await pool.query(`DELETE FROM scheduled_jobs WHERE lobby_id = $1`, [
        lobbyId,
      ]);
      await enqueueJobs(lobbyId, startAt);
    },
    async notifyLobbyPlayers(lobbyId, organizerId) {
      const lobby = await pool.query(
        `SELECT organizer_id, status, sport FROM lobbies WHERE id = $1`,
        [lobbyId]
      );
      if (!lobby.rows[0]) throw new ValidationError("Лобби не найдено");
      if (lobby.rows[0].organizer_id !== organizerId) {
        throw new ForbiddenError();
      }
      if (["cancelled", "finished"].includes(lobby.rows[0].status as string)) {
        throw new ValidationError("После игры писать всем уже не нужно");
      }
      const players = await pool.query(
        `SELECT u.max_user_id
         FROM slots s
         JOIN users u ON u.id = s.user_id
         WHERE s.lobby_id = $1
           AND s.user_id IS NOT NULL
           AND s.user_id <> $2`,
        [lobbyId, organizerId]
      );
      const botUsername = process.env.BOT_USERNAME ?? "gov_max_sport_bot";
      let sent = 0;
      for (const player of players.rows) {
        const maxUserId = Number(player.max_user_id);
        if (!maxUserId) continue;
        await deliver(maxApi, {
          userId: maxUserId,
          text: "Организатор пишет участникам лобби. Откройте карточку, если нужно ответить.",
          buttons: [
            [
              {
                type: "open_app",
                text: "Открыть лобби",
                url: `https://max.ru/${botUsername}?startapp=lobby_${lobbyId}`,
              },
            ],
          ],
        });
        sent += 1;
      }
      if (sent === 0) {
        throw new ValidationError("Пока некому написать: в составе только вы");
      }
      return sent;
    },
    async notifyJoinRequest(lobbyId, applicant) {
      const result = await pool.query(
        `SELECT u.max_user_id
         FROM lobbies l
         JOIN users u ON u.id = l.organizer_id
         WHERE l.id = $1`,
        [lobbyId]
      );
      const maxUserId = Number(result.rows[0]?.max_user_id);
      if (!maxUserId) return;
      const name = [applicant.firstName, applicant.lastName]
        .filter(Boolean)
        .join(" ");
      const role = applicant.roleRequired ? ` (${applicant.roleRequired})` : "";
      const botUsername = process.env.BOT_USERNAME ?? "gov_max_sport_bot";
      await deliver(maxApi, {
        userId: maxUserId,
        text: `Заявка в лобби: ${name}${role} хочет присоединиться. Откройте ростер, чтобы принять или отклонить.`,
        buttons: [
          [
            {
              type: "open_app",
              text: "Открыть ростер",
              url: `https://max.ru/${botUsername}?startapp=roster_${lobbyId}`,
            },
          ],
        ],
      });
    },
    async notifyContact(lobbyId, fromUserId, toUserId) {
      const lobby = await pool.query(
        `SELECT organizer_id FROM lobbies WHERE id = $1`,
        [lobbyId]
      );
      if (!lobby.rows[0]) throw new ValidationError("Лобби не найдено");
      const organizerId = lobby.rows[0].organizer_id as string;
      const targetId = toUserId ?? organizerId;
      if (fromUserId === targetId) {
        throw new ValidationError("Нельзя написать себе");
      }

      const fromIsOrganizer = fromUserId === organizerId;
      const toIsOrganizer = targetId === organizerId;
      if (!fromIsOrganizer && !toIsOrganizer) {
        throw new ForbiddenError();
      }
      if (fromIsOrganizer && !toIsOrganizer) {
        const occupant = await pool.query(
          `SELECT 1 FROM slots WHERE lobby_id = $1 AND user_id = $2`,
          [lobbyId, targetId]
        );
        if (!occupant.rows[0]) throw new ForbiddenError();
      }

      const [from, to] = await Promise.all([
        pool.query(`SELECT first_name, last_name FROM users WHERE id = $1`, [
          fromUserId,
        ]),
        pool.query(`SELECT max_user_id FROM users WHERE id = $1`, [targetId]),
      ]);
      const maxUserId = Number(to.rows[0]?.max_user_id);
      if (!maxUserId) {
        throw new ValidationError(
          "Нет аккаунта MAX, чтобы доставить сообщение"
        );
      }
      const name = [from.rows[0]?.first_name, from.rows[0]?.last_name]
        .filter(Boolean)
        .join(" ");
      const botUsername = process.env.BOT_USERNAME ?? "gov_max_sport_bot";
      await deliver(maxApi, {
        userId: maxUserId,
        text: `${name || "Игрок"} хочет написать вам в MAX Sport. Откройте лобби.`,
        buttons: [
          [
            {
              type: "open_app",
              text: "Открыть лобби",
              url: `https://max.ru/${botUsername}?startapp=lobby_${lobbyId}`,
            },
          ],
        ],
      });
    },
  };
}
