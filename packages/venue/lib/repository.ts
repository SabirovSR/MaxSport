import type { Pool, PoolClient } from "@maxsport/shared";
import type { Venue } from "@maxsport/shared";
import { NotFoundError } from "@maxsport/shared";

export interface CreateVenueInput {
  name: string;
  address: string;
  lat: number;
  lng: number;
  createdBy: string;
  venueChatId?: number | null;
}

export interface VenueRepository {
  create(input: CreateVenueInput): Promise<Venue>;
  findById(id: string): Promise<Venue | null>;
  listByUser(userId: string): Promise<Venue[]>;
  listAll(): Promise<Venue[]>;
}

function mapRow(row: Record<string, unknown>): Venue {
  return {
    id: row.id as string,
    name: row.name as string,
    address: row.address as string,
    lat: Number(row.lat),
    lng: Number(row.lng),
    venueChatId: row.venue_chat_id as number | null,
    createdBy: row.created_by as string,
  };
}

async function query(client: Pool | PoolClient, text: string, params?: unknown[]) {
  return client.query(text, params);
}

export function createVenueRepository(pool: Pool): VenueRepository {
  return {
    async create(input) {
      const result = await query(
        pool,
        `INSERT INTO venues (name, address, location, created_by, venue_chat_id)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6)
         RETURNING id, name, address, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
                   venue_chat_id, created_by`,
        [
          input.name,
          input.address,
          input.lng,
          input.lat,
          input.createdBy,
          input.venueChatId ?? null,
        ]
      );
      return mapRow(result.rows[0]!);
    },

    async findById(id) {
      const result = await query(
        pool,
        `SELECT id, name, address, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
                venue_chat_id, created_by
         FROM venues WHERE id = $1`,
        [id]
      );
      return result.rows[0] ? mapRow(result.rows[0]) : null;
    },

    async listByUser(userId) {
      const result = await query(
        pool,
        `SELECT id, name, address, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
                venue_chat_id, created_by
         FROM venues WHERE created_by = $1 ORDER BY name`,
        [userId]
      );
      return result.rows.map(mapRow);
    },

    async listAll() {
      const result = await query(
        pool,
        `SELECT id, name, address, ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng,
                venue_chat_id, created_by
         FROM venues ORDER BY name`
      );
      return result.rows.map(mapRow);
    },
  };
}

export async function requireVenue(repo: VenueRepository, id: string): Promise<Venue> {
  const venue = await repo.findById(id);
  if (!venue) throw new NotFoundError("Площадка");
  return venue;
}
