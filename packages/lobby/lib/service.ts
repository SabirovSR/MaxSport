import type {
  GameLevel,
  Lobby,
  LobbyStatus,
  LobbyWithDetails,
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
    `SELECT id, lobby_id, role_required, user_id, version, slot_index
     FROM slots WHERE lobby_id = $1 ORDER BY slot_index`,
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
      if (input.slotCount < 2) {
        throw new ValidationError("Минимум 2 Слота в Лобби");
      }

      const venue = await venues.findById(input.venueId);
      if (!venue) throw new NotFoundError("Площадка");

      const depositEnabled =
        input.rentTotal > 0 ? Boolean(input.depositEnabled) : false;

      return withTransaction(pool, async (client) => {
        const lobbyResult = await client.query(
          `INSERT INTO lobbies
           (sport, game_level, status, start_at, is_recurring, venue_id, organizer_id,
            rent_total, deposit_enabled, slot_count)
           VALUES ($1, $2, 'open', $3, $4, $5, $6, $7, $8, $9)
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
            [
              lobby.id,
              role,
              isOrganizerSlot ? input.organizerId : null,
              i,
            ]
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
      const conditions: string[] = ["l.status IN ('open', 'full', 'gathering')"];
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
          conditions.push(`ST_DWithin(v.location, ${origin}, $${params.length})`);
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
        if (!["open", "full"].includes(lobby.status)) {
          throw new ValidationError("Лобби не принимает записи");
        }

        await client.query(
          `UPDATE slots SET user_id = $1, version = version + 1 WHERE id = $2`,
          [userId, slotId]
        );

        await client.query(
          `INSERT INTO presence_records (slot_id, lobby_id, user_id, status)
           VALUES ($1, $2, $3, 'expected')`,
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
        const newStatus = nextLobbyStatus(details.filledCount, details.slotCount);
        await client.query(`UPDATE lobbies SET status = $1 WHERE id = $2`, [
          newStatus,
          lobbyId,
        ]);

        return loadDetails(client, lobbyId);
      });
    },

    async releaseSlot(lobbyId, slotId, userId) {
      return withTransaction(pool, async (client) => {
        const slotResult = await client.query(
          `SELECT s.*, l.start_at, l.organizer_id, l.rent_total, l.deposit_enabled, l.slot_count
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
        if (slotRow.organizer_id === userId && slotRow.user_id === userId) {
          throw new ValidationError("Организатор не может освободить свой Слот");
        }

        const startAt = new Date(slotRow.start_at as string);
        const hoursUntil =
          (startAt.getTime() - Date.now()) / (1000 * 60 * 60);
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

        await client.query(`UPDATE lobbies SET status = 'open' WHERE id = $1`, [
          lobbyId,
        ]);
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
      await pool.query(
        `UPDATE lobbies SET status = 'started' WHERE id = $1`,
        [lobbyId]
      );
      return loadDetails(pool, lobbyId);
    },

    async finishLobby(lobbyId, organizerId) {
      const lobby = await loadDetails(pool, lobbyId);
      if (lobby.organizerId !== organizerId) throw new ForbiddenError();
      await pool.query(
        `UPDATE lobbies SET status = 'finished' WHERE id = $1`,
        [lobbyId]
      );
      return loadDetails(pool, lobbyId);
    },

    async cancelLobby(lobbyId, organizerId) {
      const lobby = await loadDetails(pool, lobbyId);
      if (lobby.organizerId !== organizerId) throw new ForbiddenError();
      await pool.query(
        `UPDATE lobbies SET status = 'cancelled' WHERE id = $1`,
        [lobbyId]
      );
      return loadDetails(pool, lobbyId);
    },
  };
}
