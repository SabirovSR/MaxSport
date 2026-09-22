import { describe, expect, it, vi } from "vitest";
import type { Pool } from "@maxsport/shared";
import { SlotTakenError, ValidationError } from "@maxsport/shared";
import type { VenueRepository } from "@maxsport/venue";
import { createLobbyService } from "../index.js";

const lobbyRow = {
  id: "lobby-1",
  sport: "volleyball",
  game_level: "amateur",
  status: "open",
  start_at: "2026-09-24T12:00:00.000Z",
  is_recurring: false,
  venue_id: "venue-1",
  organizer_id: "organizer-1",
  rent_total: 0,
  deposit_enabled: false,
  slot_count: 2,
  card_message_id: null,
  card_chat_id: null,
  join_mode: "approval",
  created_at: "2026-09-20T12:00:00.000Z",
  v_id: "venue-1",
  v_name: "Зал",
  v_address: "Москва",
  v_lat: 55.75,
  v_lng: 37.61,
  venue_chat_id: null,
  v_created_by: "organizer-1",
  u_id: "organizer-1",
  max_user_id: 1,
  first_name: "Организатор",
  last_name: null,
  username: null,
  photo_url: null,
  u_game_level: "amateur",
  reliability_pct: 100,
  games_played: 0,
  u_created_at: "2026-09-20T12:00:00.000Z",
};

const freeSlot = {
  id: "slot-2",
  lobby_id: "lobby-1",
  role_required: "Либеро",
  user_id: null,
  version: 0,
  slot_index: 1,
  occupant_first_name: null,
  occupant_last_name: null,
  occupant_photo_url: null,
};

describe("join requests", () => {
  it("creates a pending request for an approval lobby", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("FROM lobbies l")) return { rows: [lobbyRow] };
      if (sql.includes("FROM slots s") && sql.includes("LEFT JOIN users")) {
        return { rows: [freeSlot] };
      }
      if (sql.includes("SELECT id FROM slot_join_requests")) {
        return { rows: [] };
      }
      if (sql.includes("WITH inserted AS")) {
        return {
          rows: [
            {
              id: "request-1",
              lobby_id: "lobby-1",
              slot_id: "slot-2",
              user_id: "player-1",
              status: "pending",
              first_name: "Игрок",
              last_name: null,
              photo_url: null,
              role_required: "Либеро",
              created_at: "2026-09-22T12:00:00.000Z",
              resolved_at: null,
            },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const service = createLobbyService(
      { query } as unknown as Pool,
      {} as VenueRepository
    );

    const request = await service.requestJoin("lobby-1", "slot-2", "player-1");

    expect(request.status).toBe("pending");
    expect(request.player.firstName).toBe("Игрок");
    expect(request.roleRequired).toBe("Либеро");
  });

  it("turns a stale concurrent accept into SLOT_TAKEN", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT r.*")) {
        return {
          rows: [
            {
              id: "request-1",
              lobby_id: "lobby-1",
              slot_id: "slot-2",
              user_id: "player-1",
              status: "pending",
              slot_user_id: null,
              version: 0,
              organizer_id: "organizer-1",
              lobby_status: "open",
              rent_total: 0,
              deposit_enabled: false,
              slot_count: 2,
            },
          ],
        };
      }
      if (sql.includes("SELECT id FROM slots")) return { rows: [] };
      if (sql.includes("UPDATE slots")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const service = createLobbyService(pool, {} as VenueRepository);

    await expect(
      service.acceptJoinRequest("lobby-1", "request-1", "organizer-1")
    ).rejects.toBeInstanceOf(SlotTakenError);
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("AND version = $3"))
    ).toBe(true);
  });

  it("does not let the same player occupy two slots", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT * FROM slots WHERE id")) {
        return { rows: [freeSlot] };
      }
      if (sql.includes("SELECT * FROM lobbies")) {
        return { rows: [{ ...lobbyRow, join_mode: "instant" }] };
      }
      if (sql.includes("SELECT id FROM slots") && sql.includes("user_id")) {
        return { rows: [{ id: "slot-1" }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const client = { query, release: vi.fn() };
    const service = createLobbyService(
      { connect: vi.fn(async () => client) } as unknown as Pool,
      {} as VenueRepository
    );

    await expect(
      service.bookSlot("lobby-1", "slot-2", "organizer-1")
    ).rejects.toBeInstanceOf(ValidationError);
    expect(
      query.mock.calls.some(([sql]) => String(sql).includes("FOR UPDATE"))
    ).toBe(true);
  });

  it("rejects instant booking on an approval lobby", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT * FROM slots")) return { rows: [freeSlot] };
      if (sql.includes("SELECT * FROM lobbies")) return { rows: [lobbyRow] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    const client = { query, release: vi.fn() };
    const service = createLobbyService(
      { connect: vi.fn(async () => client) } as unknown as Pool,
      {} as VenueRepository
    );

    await expect(
      service.bookSlot("lobby-1", "slot-2", "player-1")
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("blocks editing after the game has started", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT * FROM lobbies")) {
        return { rows: [{ ...lobbyRow, status: "started" }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const client = { query, release: vi.fn() };
    const service = createLobbyService(
      { connect: vi.fn(async () => client) } as unknown as Pool,
      {} as VenueRepository
    );

    await expect(
      service.updateLobby("lobby-1", "organizer-1", { rentTotal: 1000 })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("does not change the role of an occupied slot", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT * FROM lobbies")) return { rows: [lobbyRow] };
      if (sql.includes("SELECT * FROM slots")) {
        return {
          rows: [
            {
              ...freeSlot,
              id: "slot-1",
              user_id: "organizer-1",
              slot_index: 0,
              role_required: "Связующий",
            },
            freeSlot,
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const client = { query, release: vi.fn() };
    const pool = {
      connect: vi.fn(async () => client),
    } as unknown as Pool;
    const service = createLobbyService(pool, {} as VenueRepository);

    await expect(
      service.updateLobby("lobby-1", "organizer-1", {
        roleSlots: [{ index: 0, role: "Либеро" }],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
