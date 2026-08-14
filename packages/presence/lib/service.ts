import type { PresenceStatus, PresenceRecord } from "@maxsport/shared";
import { ForbiddenError, NotFoundError, ValidationError, type Pool } from "@maxsport/shared";

export interface RosterEntry {
  slotId: string;
  userId: string;
  firstName: string;
  lastName: string | null;
  roleRequired: string | null;
  status: PresenceStatus;
  updatedAt: Date;
}

export interface PresenceService {
  getRoster(lobbyId: string): Promise<RosterEntry[]>;
  confirmOnTheWay(slotId: string, userId: string): Promise<void>;
  confirmOnSite(slotId: string, userId: string): Promise<void>;
  confirmOnSiteWithGeo(
    slotId: string,
    userId: string,
    lat: number,
    lng: number
  ): Promise<void>;
  manualMark(
    slotId: string,
    organizerId: string,
    status: PresenceStatus
  ): Promise<void>;
  markNoShows(lobbyId: string): Promise<number>;
  getByUser(userId: string): Promise<PresenceRecord[]>;
}

function mapRecord(row: Record<string, unknown>): PresenceRecord {
  return {
    id: row.id as string,
    slotId: row.slot_id as string,
    lobbyId: row.lobby_id as string,
    userId: row.user_id as string,
    status: row.status as PresenceStatus,
    updatedAt: new Date(row.updated_at as string),
  };
}

export function createPresenceService(pool: Pool): PresenceService {
  return {
    async getRoster(lobbyId) {
      const result = await pool.query(
        `SELECT pr.slot_id, pr.user_id, pr.status, pr.updated_at,
                u.first_name, u.last_name, s.role_required
         FROM presence_records pr
         JOIN users u ON u.id = pr.user_id
         JOIN slots s ON s.id = pr.slot_id
         WHERE pr.lobby_id = $1
         ORDER BY s.slot_index`,
        [lobbyId]
      );
      return result.rows.map((row) => ({
        slotId: row.slot_id as string,
        userId: row.user_id as string,
        firstName: row.first_name as string,
        lastName: row.last_name as string | null,
        roleRequired: row.role_required as string | null,
        status: row.status as PresenceStatus,
        updatedAt: new Date(row.updated_at as string),
      }));
    },

    async confirmOnTheWay(slotId, userId) {
      const result = await pool.query(
        `UPDATE presence_records SET status = 'on_the_way', updated_at = NOW()
         WHERE slot_id = $1 AND user_id = $2 RETURNING *`,
        [slotId, userId]
      );
      if (!result.rows[0]) throw new NotFoundError("Явка");
    },

    async confirmOnSite(slotId, userId) {
      const result = await pool.query(
        `UPDATE presence_records SET status = 'on_site', updated_at = NOW()
         WHERE slot_id = $1 AND user_id = $2 RETURNING *`,
        [slotId, userId]
      );
      if (!result.rows[0]) throw new NotFoundError("Явка");
    },

    async confirmOnSiteWithGeo(slotId, userId, lat, lng) {
      const check = await pool.query(
        `SELECT pr.slot_id, ST_DWithin(
           v.location,
           ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
           300
         ) AS within
         FROM presence_records pr
         JOIN slots s ON s.id = pr.slot_id
         JOIN lobbies l ON l.id = s.lobby_id
         JOIN venues v ON v.id = l.venue_id
         WHERE pr.slot_id = $1 AND pr.user_id = $4`,
        [slotId, lat, lng, userId]
      );
      if (!check.rows[0]) throw new NotFoundError("Явка");
      if (!check.rows[0].within) {
        throw new ValidationError("Вы ещё не на площадке — или нажмите «Я на месте» вручную");
      }
      await this.confirmOnSite(slotId, userId);
    },

    async manualMark(slotId, organizerId, status) {
      const lobbyCheck = await pool.query(
        `SELECT l.organizer_id FROM lobbies l
         JOIN slots s ON s.lobby_id = l.id
         WHERE s.id = $1`,
        [slotId]
      );
      if (!lobbyCheck.rows[0]) throw new NotFoundError("Слот");
      if (lobbyCheck.rows[0].organizer_id !== organizerId) {
        throw new ForbiddenError();
      }
      await pool.query(
        `UPDATE presence_records SET status = $1, updated_at = NOW()
         WHERE slot_id = $2`,
        [status, slotId]
      );
    },

    async markNoShows(lobbyId) {
      const result = await pool.query(
        `UPDATE presence_records SET status = 'no_show', updated_at = NOW()
         WHERE lobby_id = $1 AND status NOT IN ('on_site', 'cancelled', 'no_show')
         RETURNING id`,
        [lobbyId]
      );
      return result.rowCount ?? 0;
    },

    async getByUser(userId) {
      const result = await pool.query(
        `SELECT * FROM presence_records WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 20`,
        [userId]
      );
      return result.rows.map(mapRecord);
    },
  };
}
