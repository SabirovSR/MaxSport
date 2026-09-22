import type {
  GameLevel,
  JoinMode,
  JoinRequest,
  Lobby,
  LobbyStatus,
  LobbyWithDetails,
  MyLobbySummary,
  Slot,
  Sport,
  User,
} from "@maxsport/shared";
import {
  calculateSplit,
  ForbiddenError,
  NotFoundError,
  SlotTakenError,
  ValidationError,
  ROLE_OPTIONS,
  isSport,
  isUniqueViolation,
  withTransaction,
  type Pool,
  type PoolClient,
} from "@maxsport/shared";
import type { VenueRepository } from "@maxsport/venue";

export interface CreateLobbyInput {
  sport: Sport;
  gameLevel: GameLevel;
  startAt: Date;
  isRecurring?: boolean;
  venueId: string;
  organizerId: string;
  rentTotal: number;
  depositEnabled?: boolean;
  slotCount: number;
  roleSlots?: Array<{ index: number; role: string }>;
  organizerRole?: string | null;
  joinMode?: JoinMode;
}

export interface UpdateLobbyInput {
  startAt?: Date;
  venueId?: string;
  gameLevel?: GameLevel;
  rentTotal?: number;
  depositEnabled?: boolean;
  slotCount?: number;
  roleSlots?: Array<{ index: number; role: string }>;
  joinMode?: JoinMode;
}

export interface ListLobbiesFilter {
  sport?: Sport;
  gameLevel?: GameLevel;
  hotOnly?: boolean;
  /** Supplying both turns on distance calculation and distance ordering. */
  userLat?: number;
  userLng?: number;
  /** Only meaningful alongside a position. Omit to measure without filtering. */
  radiusM?: number;
}

/** Matches the "рядом" chip in the Mini App feed. */
export const DEFAULT_NEARBY_RADIUS_M = 5000;

export interface LobbyService {
  create(input: CreateLobbyInput): Promise<LobbyWithDetails>;
  getById(id: string): Promise<LobbyWithDetails>;
  list(filter?: ListLobbiesFilter): Promise<LobbyWithDetails[]>;
  listMine(userId: string): Promise<MyLobbySummary[]>;
  bookSlot(
    lobbyId: string,
    slotId: string,
    userId: string
  ): Promise<LobbyWithDetails>;
  releaseSlot(
    lobbyId: string,
    slotId: string,
    userId: string
  ): Promise<LobbyWithDetails>;
  requestJoin(
    lobbyId: string,
    slotId: string,
    userId: string
  ): Promise<JoinRequest>;
  cancelJoinRequest(lobbyId: string, userId: string): Promise<void>;
  getMyJoinRequest(
    lobbyId: string,
    userId: string
  ): Promise<JoinRequest | null>;
  listJoinRequests(
    lobbyId: string,
    organizerId: string
  ): Promise<JoinRequest[]>;
  acceptJoinRequest(
    lobbyId: string,
    requestId: string,
    organizerId: string
  ): Promise<LobbyWithDetails>;
  rejectJoinRequest(
    lobbyId: string,
    requestId: string,
    organizerId: string
  ): Promise<void>;
  updateLobby(
    lobbyId: string,
    organizerId: string,
    patch: UpdateLobbyInput
  ): Promise<LobbyWithDetails>;
  setCardMessage(
    lobbyId: string,
    messageId: string,
    chatId: number
  ): Promise<void>;
  updateStatus(lobbyId: string, status: LobbyStatus): Promise<void>;
  startLobby(lobbyId: string, organizerId: string): Promise<LobbyWithDetails>;
  finishLobby(lobbyId: string, organizerId: string): Promise<LobbyWithDetails>;
  cancelLobby(lobbyId: string, organizerId: string): Promise<LobbyWithDetails>;
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

function mapLobby(row: Record<string, unknown>): Lobby {
  return {
    id: row.id as string,
    sport: row.sport as Sport,
    gameLevel: row.game_level as GameLevel,
    status: row.status as LobbyStatus,
    startAt: new Date(row.start_at as string),
    isRecurring: Boolean(row.is_recurring),
    venueId: row.venue_id as string,
    organizerId: row.organizer_id as string,
    rentTotal: Number(row.rent_total),
    depositEnabled: Boolean(row.deposit_enabled),
    slotCount: Number(row.slot_count),
    cardMessageId: row.card_message_id as string | null,
    cardChatId: row.card_chat_id ? Number(row.card_chat_id) : null,
    joinMode: (row.join_mode as JoinMode | undefined) ?? "instant",
    createdAt: new Date(row.created_at as string),
  };
}

function mapSlot(row: Record<string, unknown>): Slot {
  return {
    id: row.id as string,
    lobbyId: row.lobby_id as string,
    roleRequired: row.role_required as string | null,
    userId: row.user_id as string | null,
    version: Number(row.version),
    index: Number(row.slot_index),
    occupant: row.user_id
      ? {
          id: row.user_id as string,
          firstName: row.occupant_first_name as string,
          lastName: row.occupant_last_name as string | null,
          photoUrl: row.occupant_photo_url as string | null,
        }
      : null,
  };
}

function mapJoinRequest(row: Record<string, unknown>): JoinRequest {
  return {
    id: row.id as string,
    lobbyId: row.lobby_id as string,
    slotId: row.slot_id as string,
    userId: row.user_id as string,
    status: row.status as JoinRequest["status"],
    player: {
      id: row.user_id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string | null,
      photoUrl: row.photo_url as string | null,
    },
    roleRequired: row.role_required as string | null,
    createdAt: new Date(row.created_at as string),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : null,
  };
}

async function loadDetails(
  client: Pool | PoolClient,
  lobbyId: string
): Promise<LobbyWithDetails> {
  const lobbyResult = await client.query(
    `SELECT l.*, v.id AS v_id, v.name AS v_name, v.address AS v_address,
            ST_Y(v.location::geometry) AS v_lat, ST_X(v.location::geometry) AS v_lng,
            v.venue_chat_id, v.created_by AS v_created_by,
            u.id AS u_id, u.max_user_id, u.first_name, u.last_name, u.username, u.photo_url,
            u.game_level AS u_game_level, u.reliability_pct, u.games_played, u.created_at AS u_created_at
     FROM lobbies l
     JOIN venues v ON v.id = l.venue_id
     JOIN users u ON u.id = l.organizer_id
     WHERE l.id = $1`,
    [lobbyId]
  );
  if (!lobbyResult.rows[0]) throw new NotFoundError("Лобби");

  const row = lobbyResult.rows[0];
  const slotsResult = await client.query(
    `SELECT s.id, s.lobby_id, s.role_required, s.user_id, s.version, s.slot_index,
            u.first_name AS occupant_first_name,
            u.last_name AS occupant_last_name,
            u.photo_url AS occupant_photo_url
     FROM slots s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.lobby_id = $1
     ORDER BY s.slot_index`,
    [lobbyId]
  );

  const lobby = mapLobby(row);
  const slots = slotsResult.rows.map(mapSlot);
  const filledCount = slots.filter((s) => s.userId).length;

  return {
    ...lobby,
    venue: {
      id: row.v_id as string,
      name: row.v_name as string,
      address: row.v_address as string,
      lat: Number(row.v_lat),
      lng: Number(row.v_lng),
      venueChatId: row.venue_chat_id as number | null,
      createdBy: row.v_created_by as string,
    },
    organizer: mapUser({
      id: row.u_id,
      max_user_id: row.max_user_id,
      first_name: row.first_name,
      last_name: row.last_name,
      username: row.username,
      photo_url: row.photo_url,
      game_level: row.u_game_level,
      reliability_pct: row.reliability_pct,
      games_played: row.games_played,
      created_at: row.u_created_at,
    }),
    slots,
    filledCount,
    splitPerPlayer: calculateSplit(lobby.rentTotal, lobby.slotCount),
  };
}

function nextLobbyStatus(filled: number, total: number): LobbyStatus {
  return filled >= total ? "full" : "open";
}

export function createLobbyService(
  pool: Pool,
  venues: VenueRepository
): LobbyService {
  return {
    async create(input) {
      if (!isSport(input.sport)) {
        throw new ValidationError("Неизвестный вид спорта");
      }
      if (!["novice", "amateur", "advanced"].includes(input.gameLevel)) {
        throw new ValidationError("Некорректный уровень игры");
      }
      if (
        input.joinMode != null &&
        !["instant", "approval"].includes(input.joinMode)
      ) {
        throw new ValidationError("Некорректный режим вступления");
      }
      if (input.slotCount < 2) {
        throw new ValidationError("Минимум 2 слота в Лобби");
      }
      if (
        (input.roleSlots ?? []).some(
          ({ index, role }) =>
            index < 0 ||
            index >= input.slotCount ||
            !ROLE_OPTIONS[input.sport].includes(role)
        )
      ) {
        throw new ValidationError("Некорректные амплуа слотов");
      }

      const venue = await venues.findById(input.venueId);
      if (!venue) throw new NotFoundError("Площадка");

      const depositEnabled =
        input.rentTotal > 0 ? Boolean(input.depositEnabled) : false;

      if (Number.isNaN(input.startAt.getTime())) {
        throw new ValidationError("Некорректная дата начала");
      }
      if (input.startAt.getTime() < Date.now() - 5 * 60 * 1000) {
        throw new ValidationError("Нельзя создать Лобби в прошлом");
      }

      return withTransaction(pool, async (client) => {
        const lobbyResult = await client.query(
          `INSERT INTO lobbies
           (sport, game_level, status, start_at, is_recurring, venue_id, organizer_id,
            rent_total, deposit_enabled, slot_count, join_mode)
           VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            input.sport,
            input.gameLevel,
            input.startAt.toISOString(),
            input.isRecurring ?? false,
            input.venueId,
            input.organizerId,
            input.rentTotal,
            depositEnabled,
            input.slotCount,
            input.joinMode ?? "instant",
          ]
        );
        const lobby = mapLobby(lobbyResult.rows[0]!);
        const roleMap = new Map(
          (input.roleSlots ?? []).map((r) => [r.index, r.role])
        );

        for (let i = 0; i < input.slotCount; i++) {
          const role = roleMap.get(i) ?? null;
          const isOrganizerSlot = i === 0;
          await client.query(
            `INSERT INTO slots (lobby_id, role_required, user_id, slot_index)
             VALUES ($1, $2, $3, $4)`,
            [lobby.id, role, isOrganizerSlot ? input.organizerId : null, i]
          );
        }

        if (input.rentTotal > 0 && depositEnabled) {
          await client.query(
            `INSERT INTO payment_holds (slot_id, user_id, lobby_id, status, amount)
             SELECT s.id, s.user_id, $1, 'held', $2
             FROM slots s
             WHERE s.lobby_id = $1 AND s.user_id IS NOT NULL`,
            [lobby.id, calculateSplit(input.rentTotal, input.slotCount)]
          );
        }

        await client.query(
          `INSERT INTO presence_records (slot_id, lobby_id, user_id, status)
           SELECT s.id, $1, s.user_id, 'expected'
           FROM slots s
           WHERE s.lobby_id = $1 AND s.user_id IS NOT NULL`,
          [lobby.id]
        );

        return loadDetails(client, lobby.id);
      });
    },

    async getById(id) {
      return loadDetails(pool, id);
    },

    async list(filter = {}) {
      const conditions: string[] = [
        "l.status IN ('open', 'full', 'gathering')",
      ];
      const params: unknown[] = [];

      if (filter.sport) {
        params.push(filter.sport);
        conditions.push(`l.sport = $${params.length}`);
      }
      if (filter.gameLevel) {
        params.push(filter.gameLevel);
        conditions.push(`l.game_level = $${params.length}`);
      }
      if (filter.hotOnly) {
        conditions.push(`l.start_at <= NOW() + INTERVAL '3 hours'`);
        conditions.push(
          `(SELECT COUNT(*) FROM slots s WHERE s.lobby_id = l.id AND s.user_id IS NULL) > 0`
        );
      }

      const { userLat, userLng } = filter;
      let distanceSelect = "NULL::float8 AS distance_m";
      let orderBy = "l.start_at ASC";

      if (
        typeof userLat === "number" &&
        Number.isFinite(userLat) &&
        typeof userLng === "number" &&
        Number.isFinite(userLng)
      ) {
        // ST_MakePoint takes (x, y), so longitude comes first.
        params.push(userLng, userLat);
        const origin = `ST_SetSRID(ST_MakePoint($${params.length - 1}, $${params.length}), 4326)::geography`;
        distanceSelect = `ST_Distance(v.location, ${origin}) AS distance_m`;
        orderBy = "distance_m ASC, l.start_at ASC";

        if (filter.radiusM != null) {
          params.push(filter.radiusM);
          conditions.push(
            `ST_DWithin(v.location, ${origin}, $${params.length})`
          );
        }
      }

      const result = await pool.query(
        `SELECT l.id, ${distanceSelect}
         FROM lobbies l
         JOIN venues v ON v.id = l.venue_id
         WHERE ${conditions.join(" AND ")}
         ORDER BY ${orderBy}
         LIMIT 50`,
        params
      );

      return Promise.all(
        result.rows.map(async (row) => {
          const details = await loadDetails(pool, row.id as string);
          if (row.distance_m == null) return details;
          return { ...details, distanceM: Math.round(Number(row.distance_m)) };
        })
      );
    },

    async listMine(userId) {
      const result = await pool.query(
        `SELECT l.id, s.id AS my_slot_id, pr.status AS presence_status,
                (l.organizer_id = $1) AS is_organizer,
                (
                  l.status = 'finished'
                  AND EXISTS (
                    SELECT 1
                    FROM slots target
                    WHERE target.lobby_id = l.id
                      AND target.user_id IS NOT NULL
                      AND target.user_id <> $1
                      AND NOT EXISTS (
                        SELECT 1 FROM karma_votes kv
                        WHERE kv.lobby_id = l.id
                          AND kv.voter_id = $1
                          AND kv.target_id = target.user_id
                      )
                  )
                ) AS karma_pending
         FROM lobbies l
         JOIN slots s ON s.lobby_id = l.id AND s.user_id = $1
         LEFT JOIN presence_records pr
           ON pr.slot_id = s.id AND pr.user_id = $1
         ORDER BY
           CASE WHEN l.status IN ('finished', 'cancelled') THEN 1 ELSE 0 END,
           l.start_at ASC`,
        [userId]
      );

      return Promise.all(
        result.rows.map(async (row) => {
          const lobby = await loadDetails(pool, row.id as string);
          return {
            ...lobby,
            myRole: row.is_organizer ? "organizer" : "player",
            mySlotId: row.my_slot_id as string,
            myPresenceStatus:
              (row.presence_status as MyLobbySummary["myPresenceStatus"]) ??
              null,
            karmaPending: Boolean(row.karma_pending),
          } satisfies MyLobbySummary;
        })
      );
    },

    async bookSlot(lobbyId, slotId, userId) {
      return withTransaction(pool, async (client) => {
        const slotResult = await client.query(
          `SELECT * FROM slots WHERE id = $1 AND lobby_id = $2 FOR UPDATE`,
          [slotId, lobbyId]
        );
        const slotRow = slotResult.rows[0];
        if (!slotRow) throw new NotFoundError("Слот");
        if (slotRow.user_id) throw new SlotTakenError();

        const lobbyResult = await client.query(
          `SELECT * FROM lobbies WHERE id = $1 FOR UPDATE`,
          [lobbyId]
        );
        const lobby = mapLobby(lobbyResult.rows[0]!);
        if (!["open", "gathering"].includes(lobby.status)) {
          throw new ValidationError("Лобби не принимает записи");
        }
        if (lobby.joinMode === "approval") {
          throw new ValidationError("Для этого Лобби сначала отправьте заявку");
        }

        const already = await client.query(
          `SELECT id FROM slots
           WHERE lobby_id = $1 AND user_id = $2
           FOR UPDATE`,
          [lobbyId, userId]
        );
        if (already.rows[0]) {
          throw new ValidationError("Вы уже заняли слот в этом Лобби");
        }

        let booked;
        try {
          booked = await client.query(
            `UPDATE slots
             SET user_id = $1, version = version + 1
             WHERE id = $2
               AND lobby_id = $3
               AND user_id IS NULL
               AND version = $4
             RETURNING id`,
            [userId, slotId, lobbyId, Number(slotRow.version)]
          );
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ValidationError("Вы уже заняли слот в этом Лобби");
          }
          throw error;
        }
        if (!booked.rows[0]) throw new SlotTakenError();

        await client.query(
          `INSERT INTO presence_records (slot_id, lobby_id, user_id, status)
           VALUES ($1, $2, $3, 'expected')
           ON CONFLICT (slot_id) DO UPDATE
           SET user_id = EXCLUDED.user_id,
               status = 'expected',
               updated_at = NOW()`,
          [slotId, lobbyId, userId]
        );

        if (lobby.rentTotal > 0 && lobby.depositEnabled) {
          await client.query(
            `INSERT INTO payment_holds (slot_id, user_id, lobby_id, status, amount)
             VALUES ($1, $2, $3, 'held', $4)`,
            [
              slotId,
              userId,
              lobbyId,
              calculateSplit(lobby.rentTotal, lobby.slotCount),
            ]
          );
        }

        const details = await loadDetails(client, lobbyId);
        if (lobby.status !== "gathering") {
          const newStatus = nextLobbyStatus(
            details.filledCount,
            details.slotCount
          );
          await client.query(`UPDATE lobbies SET status = $1 WHERE id = $2`, [
            newStatus,
            lobbyId,
          ]);
        }

        return loadDetails(client, lobbyId);
      });
    },

    async releaseSlot(lobbyId, slotId, userId) {
      return withTransaction(pool, async (client) => {
        const slotResult = await client.query(
          `SELECT s.*, l.start_at, l.organizer_id, l.rent_total, l.deposit_enabled,
                  l.slot_count, l.status AS lobby_status
           FROM slots s
           JOIN lobbies l ON l.id = s.lobby_id
           WHERE s.id = $1 AND s.lobby_id = $2 FOR UPDATE`,
          [slotId, lobbyId]
        );
        const slotRow = slotResult.rows[0];
        if (!slotRow) throw new NotFoundError("Слот");
        if (slotRow.user_id !== userId && slotRow.organizer_id !== userId) {
          throw new ForbiddenError();
        }
        if (
          !["open", "full", "gathering"].includes(
            slotRow.lobby_status as string
          )
        ) {
          throw new ValidationError("Состав этого Лобби уже нельзя менять");
        }
        if (slotRow.organizer_id === userId && slotRow.user_id === userId) {
          throw new ValidationError(
            "Организатор не может освободить свой слот"
          );
        }

        const startAt = new Date(slotRow.start_at as string);
        const hoursUntil = (startAt.getTime() - Date.now()) / (1000 * 60 * 60);
        const forfeit = hoursUntil < 2;

        await client.query(
          `UPDATE slots SET user_id = NULL, version = version + 1 WHERE id = $1`,
          [slotId]
        );
        await client.query(
          `UPDATE presence_records SET status = 'cancelled', updated_at = NOW()
           WHERE slot_id = $1`,
          [slotId]
        );
        if (slotRow.deposit_enabled) {
          await client.query(
            `UPDATE payment_holds SET status = $1, updated_at = NOW()
             WHERE slot_id = $2`,
            [forfeit ? "forfeit" : "released", slotId]
          );
        }

        const lobbyStatus = slotRow.lobby_status as LobbyStatus;
        if (lobbyStatus === "open" || lobbyStatus === "full") {
          await client.query(
            `UPDATE lobbies SET status = 'open' WHERE id = $1`,
            [lobbyId]
          );
        }
        return loadDetails(client, lobbyId);
      });
    },

    async requestJoin(lobbyId, slotId, userId) {
      const lobby = await loadDetails(pool, lobbyId);
      if (lobby.joinMode !== "approval") {
        throw new ValidationError("В этом Лобби действует мгновенная запись");
      }
      if (!["open", "gathering"].includes(lobby.status)) {
        throw new ValidationError("Лобби не принимает заявки");
      }
      const slot = lobby.slots.find((item) => item.id === slotId);
      if (!slot) throw new NotFoundError("Слот");
      if (slot.userId) throw new SlotTakenError();
      if (lobby.slots.some((item) => item.userId === userId)) {
        throw new ValidationError("Вы уже состоите в этом Лобби");
      }

      const pending = await pool.query(
        `SELECT id FROM slot_join_requests
         WHERE lobby_id = $1 AND user_id = $2 AND status = 'pending'`,
        [lobbyId, userId]
      );
      if (pending.rows[0]) {
        throw new ValidationError("Заявка уже отправлена");
      }

      try {
        const result = await pool.query(
          `WITH inserted AS (
             INSERT INTO slot_join_requests (lobby_id, slot_id, user_id)
             VALUES ($1, $2, $3)
             RETURNING *
           )
           SELECT inserted.*, u.first_name, u.last_name, u.photo_url,
                  s.role_required
           FROM inserted
           JOIN users u ON u.id = inserted.user_id
           JOIN slots s ON s.id = inserted.slot_id`,
          [lobbyId, slotId, userId]
        );
        return mapJoinRequest(result.rows[0]!);
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505"
        ) {
          throw new ValidationError("Заявка уже отправлена");
        }
        throw error;
      }
    },

    async cancelJoinRequest(lobbyId, userId) {
      const result = await pool.query(
        `UPDATE slot_join_requests
         SET status = 'cancelled', resolved_at = NOW()
         WHERE lobby_id = $1 AND user_id = $2 AND status = 'pending'
         RETURNING id`,
        [lobbyId, userId]
      );
      if (!result.rows[0]) throw new NotFoundError("Заявка");
    },

    async getMyJoinRequest(lobbyId, userId) {
      const result = await pool.query(
        `SELECT r.*, u.first_name, u.last_name, u.photo_url, s.role_required
         FROM slot_join_requests r
         JOIN users u ON u.id = r.user_id
         JOIN slots s ON s.id = r.slot_id
         WHERE r.lobby_id = $1 AND r.user_id = $2
         ORDER BY r.created_at DESC
         LIMIT 1`,
        [lobbyId, userId]
      );
      return result.rows[0] ? mapJoinRequest(result.rows[0]) : null;
    },

    async listJoinRequests(lobbyId, organizerId) {
      const lobby = await loadDetails(pool, lobbyId);
      if (lobby.organizerId !== organizerId) throw new ForbiddenError();
      const result = await pool.query(
        `SELECT r.*, u.first_name, u.last_name, u.photo_url, s.role_required
         FROM slot_join_requests r
         JOIN users u ON u.id = r.user_id
         JOIN slots s ON s.id = r.slot_id
         WHERE r.lobby_id = $1 AND r.status = 'pending'
         ORDER BY r.created_at`,
        [lobbyId]
      );
      return result.rows.map(mapJoinRequest);
    },

    async acceptJoinRequest(lobbyId, requestId, organizerId) {
      return withTransaction(pool, async (client) => {
        const requestResult = await client.query(
          `SELECT r.*, s.user_id AS slot_user_id, s.version,
                  l.organizer_id, l.status AS lobby_status,
                  l.rent_total, l.deposit_enabled, l.slot_count
           FROM slot_join_requests r
           JOIN slots s ON s.id = r.slot_id
           JOIN lobbies l ON l.id = r.lobby_id
           WHERE r.id = $1 AND r.lobby_id = $2
           FOR UPDATE OF r, s, l`,
          [requestId, lobbyId]
        );
        const row = requestResult.rows[0];
        if (!row) throw new NotFoundError("Заявка");
        if (row.organizer_id !== organizerId) throw new ForbiddenError();
        if (row.status !== "pending") {
          throw new ValidationError("Заявка уже обработана");
        }
        if (!["open", "gathering"].includes(row.lobby_status as string)) {
          throw new ValidationError("Лобби больше не принимает Игроков");
        }
        if (row.slot_user_id) throw new SlotTakenError();

        const already = await client.query(
          `SELECT id FROM slots
           WHERE lobby_id = $1 AND user_id = $2
           FOR UPDATE`,
          [lobbyId, row.user_id]
        );
        if (already.rows[0]) {
          throw new ValidationError("Игрок уже состоит в этом Лобби");
        }

        let booked;
        try {
          booked = await client.query(
            `UPDATE slots
             SET user_id = $1, version = version + 1
             WHERE id = $2 AND user_id IS NULL AND version = $3
             RETURNING id`,
            [row.user_id, row.slot_id, Number(row.version)]
          );
        } catch (error) {
          if (isUniqueViolation(error)) {
            throw new ValidationError("Игрок уже состоит в этом Лобби");
          }
          throw error;
        }
        if (!booked.rows[0]) throw new SlotTakenError();

        await client.query(
          `INSERT INTO presence_records (slot_id, lobby_id, user_id, status)
           VALUES ($1, $2, $3, 'expected')
           ON CONFLICT (slot_id) DO UPDATE
           SET user_id = EXCLUDED.user_id,
               status = 'expected',
               updated_at = NOW()`,
          [row.slot_id, lobbyId, row.user_id]
        );

        if (row.deposit_enabled && Number(row.rent_total) > 0) {
          await client.query(
            `INSERT INTO payment_holds
             (slot_id, user_id, lobby_id, status, amount)
             VALUES ($1, $2, $3, 'held', $4)`,
            [
              row.slot_id,
              row.user_id,
              lobbyId,
              calculateSplit(Number(row.rent_total), Number(row.slot_count)),
            ]
          );
        }

        await client.query(
          `UPDATE slot_join_requests
           SET status = 'accepted', resolved_at = NOW(), resolved_by = $1
           WHERE id = $2`,
          [organizerId, requestId]
        );
        await client.query(
          `UPDATE slot_join_requests
           SET status = 'rejected', resolved_at = NOW(), resolved_by = $1
           WHERE slot_id = $2 AND status = 'pending' AND id <> $3`,
          [organizerId, row.slot_id, requestId]
        );

        const details = await loadDetails(client, lobbyId);
        if (row.lobby_status !== "gathering") {
          await client.query(`UPDATE lobbies SET status = $1 WHERE id = $2`, [
            nextLobbyStatus(details.filledCount, details.slotCount),
            lobbyId,
          ]);
        }
        return loadDetails(client, lobbyId);
      });
    },

    async rejectJoinRequest(lobbyId, requestId, organizerId) {
      const result = await pool.query(
        `UPDATE slot_join_requests r
         SET status = 'rejected', resolved_at = NOW(), resolved_by = $1
         FROM lobbies l
         WHERE r.id = $2
           AND r.lobby_id = $3
           AND r.status = 'pending'
           AND l.id = r.lobby_id
           AND l.organizer_id = $1
         RETURNING r.id`,
        [organizerId, requestId, lobbyId]
      );
      if (!result.rows[0]) throw new NotFoundError("Заявка");
    },

    async updateLobby(lobbyId, organizerId, patch) {
      return withTransaction(pool, async (client) => {
        const result = await client.query(
          `SELECT * FROM lobbies WHERE id = $1 FOR UPDATE`,
          [lobbyId]
        );
        if (!result.rows[0]) throw new NotFoundError("Лобби");
        const lobby = mapLobby(result.rows[0]);
        if (lobby.organizerId !== organizerId) throw new ForbiddenError();
        if (!["open", "full", "gathering"].includes(lobby.status)) {
          throw new ValidationError("Это Лобби уже нельзя редактировать");
        }
        if (patch.startAt && patch.startAt.getTime() < Date.now()) {
          throw new ValidationError("Нельзя перенести Лобби в прошлое");
        }
        if (
          patch.gameLevel != null &&
          !["novice", "amateur", "advanced"].includes(patch.gameLevel)
        ) {
          throw new ValidationError("Некорректный уровень игры");
        }
        if (
          patch.joinMode != null &&
          !["instant", "approval"].includes(patch.joinMode)
        ) {
          throw new ValidationError("Некорректный режим вступления");
        }
        if (patch.venueId && !(await venues.findById(patch.venueId))) {
          throw new NotFoundError("Площадка");
        }

        const slotsResult = await client.query(
          `SELECT * FROM slots WHERE lobby_id = $1 ORDER BY slot_index FOR UPDATE`,
          [lobbyId]
        );
        const occupiedCount = slotsResult.rows.filter(
          (row) => row.user_id
        ).length;
        const nextSlotCount = patch.slotCount ?? lobby.slotCount;
        if (nextSlotCount < 2 || nextSlotCount < occupiedCount) {
          throw new ValidationError(
            "Число слотов не может быть меньше занятого состава"
          );
        }

        if (nextSlotCount < lobby.slotCount) {
          const removable = slotsResult.rows
            .filter(
              (row) => !row.user_id && Number(row.slot_index) >= nextSlotCount
            )
            .map((row) => row.id as string);
          if (removable.length !== lobby.slotCount - nextSlotCount) {
            throw new ValidationError(
              "Сначала освободите занятые крайние слоты"
            );
          }
          await client.query(
            `DELETE FROM slots
             WHERE lobby_id = $1 AND slot_index >= $2 AND user_id IS NULL`,
            [lobbyId, nextSlotCount]
          );
        } else if (nextSlotCount > lobby.slotCount) {
          for (let index = lobby.slotCount; index < nextSlotCount; index++) {
            await client.query(
              `INSERT INTO slots (lobby_id, slot_index) VALUES ($1, $2)`,
              [lobbyId, index]
            );
          }
        }

        if (patch.roleSlots) {
          if (
            patch.roleSlots.some(
              ({ index, role }) =>
                index < 0 ||
                index >= nextSlotCount ||
                !ROLE_OPTIONS[lobby.sport].includes(role)
            )
          ) {
            throw new ValidationError("Некорректные амплуа слотов");
          }
          const roleMap = new Map(
            patch.roleSlots.map((item) => [item.index, item.role])
          );
          const occupiedRoleChange = slotsResult.rows.some(
            (row) =>
              row.user_id &&
              Number(row.slot_index) < nextSlotCount &&
              (roleMap.get(Number(row.slot_index)) ?? null) !==
                (row.role_required ?? null)
          );
          if (occupiedRoleChange) {
            throw new ValidationError("Нельзя изменить амплуа занятого слота");
          }
          await client.query(
            `UPDATE slots SET role_required = NULL
             WHERE lobby_id = $1 AND user_id IS NULL`,
            [lobbyId]
          );
          for (const [index, role] of roleMap) {
            if (index < 0 || index >= nextSlotCount) continue;
            await client.query(
              `UPDATE slots SET role_required = $1
               WHERE lobby_id = $2 AND slot_index = $3 AND user_id IS NULL`,
              [role, lobbyId, index]
            );
          }
        }

        const rentTotal = patch.rentTotal ?? lobby.rentTotal;
        const depositEnabled =
          rentTotal > 0
            ? (patch.depositEnabled ?? lobby.depositEnabled)
            : false;
        await client.query(
          `UPDATE lobbies SET
             start_at = $1,
             venue_id = $2,
             game_level = $3,
             rent_total = $4,
             deposit_enabled = $5,
             slot_count = $6,
             join_mode = $7,
             status = $8
           WHERE id = $9`,
          [
            (patch.startAt ?? lobby.startAt).toISOString(),
            patch.venueId ?? lobby.venueId,
            patch.gameLevel ?? lobby.gameLevel,
            rentTotal,
            depositEnabled,
            nextSlotCount,
            patch.joinMode ?? lobby.joinMode,
            lobby.status === "gathering"
              ? "gathering"
              : nextLobbyStatus(occupiedCount, nextSlotCount),
            lobbyId,
          ]
        );
        return loadDetails(client, lobbyId);
      });
    },

    async setCardMessage(lobbyId, messageId, chatId) {
      await pool.query(
        `UPDATE lobbies SET card_message_id = $1, card_chat_id = $2 WHERE id = $3`,
        [messageId, chatId, lobbyId]
      );
    },

    async updateStatus(lobbyId, status) {
      await pool.query(`UPDATE lobbies SET status = $1 WHERE id = $2`, [
        status,
        lobbyId,
      ]);
    },

    async startLobby(lobbyId, organizerId) {
      const lobby = await loadDetails(pool, lobbyId);
      if (lobby.organizerId !== organizerId) throw new ForbiddenError();
      if (!["open", "full", "gathering"].includes(lobby.status)) {
        throw new ValidationError("Лобби нельзя начать в текущем статусе");
      }
      await pool.query(`UPDATE lobbies SET status = 'started' WHERE id = $1`, [
        lobbyId,
      ]);
      return loadDetails(pool, lobbyId);
    },

    async finishLobby(lobbyId, organizerId) {
      const lobby = await loadDetails(pool, lobbyId);
      if (lobby.organizerId !== organizerId) throw new ForbiddenError();
      if (lobby.status !== "started") {
        throw new ValidationError("Сначала начните игру");
      }
      await pool.query(`UPDATE lobbies SET status = 'finished' WHERE id = $1`, [
        lobbyId,
      ]);
      await pool.query(
        `UPDATE users SET games_played = games_played + 1
         WHERE id IN (
           SELECT user_id FROM slots WHERE lobby_id = $1 AND user_id IS NOT NULL
         )`,
        [lobbyId]
      );
      return loadDetails(pool, lobbyId);
    },

    async cancelLobby(lobbyId, organizerId) {
      const lobby = await loadDetails(pool, lobbyId);
      if (lobby.organizerId !== organizerId) throw new ForbiddenError();
      if (!["open", "full", "gathering"].includes(lobby.status)) {
        throw new ValidationError("Лобби нельзя отменить в текущем статусе");
      }
      await pool.query(
        `UPDATE lobbies SET status = 'cancelled' WHERE id = $1`,
        [lobbyId]
      );
      return loadDetails(pool, lobbyId);
    },
  };
}
