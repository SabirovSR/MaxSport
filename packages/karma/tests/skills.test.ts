import { describe, expect, it, vi } from "vitest";
import type { Pool } from "@maxsport/shared";
import { ValidationError } from "@maxsport/shared";
import { createKarmaService } from "../index.js";

describe("sport-specific skills", () => {
  it("stores a validated level and roles for one sport", async () => {
    const query = vi.fn(async (_sql: string, params: unknown[]) => ({
      rows: [
        {
          sport: params[1],
          game_level: params[2],
          preferred_roles: params[3],
          updated_at: "2026-09-22T12:00:00.000Z",
        },
      ],
    }));
    const service = createKarmaService({ query } as unknown as Pool);

    const skill = await service.upsertSportSkill("user-1", "volleyball", {
      gameLevel: "advanced",
      preferredRoles: ["Связующий", "Либеро"],
    });

    expect(skill).toMatchObject({
      sport: "volleyball",
      gameLevel: "advanced",
      preferredRoles: ["Связующий", "Либеро"],
    });
  });

  it("returns a stored skill for one sport", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          sport: "ice_hockey",
          game_level: "novice",
          preferred_roles: ["Вратарь"],
          updated_at: "2026-09-22T12:00:00.000Z",
        },
      ],
    }));
    const service = createKarmaService({ query } as unknown as Pool);

    await expect(
      service.getSportSkill("user-1", "ice_hockey")
    ).resolves.toEqual({
      sport: "ice_hockey",
      gameLevel: "novice",
      preferredRoles: ["Вратарь"],
      updatedAt: new Date("2026-09-22T12:00:00.000Z"),
    });
  });

  it("rejects a role from another sport", async () => {
    const service = createKarmaService({
      query: vi.fn(),
    } as unknown as Pool);

    await expect(
      service.upsertSportSkill("user-1", "volleyball", {
        gameLevel: "amateur",
        preferredRoles: ["Вратарь"],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("Karma state", () => {
  it("blocks voting before the Lobby is finished", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT status FROM lobbies")) {
        return { rows: [{ status: "started" }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const service = createKarmaService({ query } as unknown as Pool);

    await expect(
      service.submitVote({
        voterId: "user-1",
        targetId: "user-2",
        lobbyId: "lobby-1",
        reliability: "on_time",
      })
    ).rejects.toThrow("после завершения");
  });

  it("reports remaining targets after the lobby is finished", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT status FROM lobbies")) {
        return { rows: [{ status: "finished" }] };
      }
      if (sql.includes("SELECT 1 FROM slots")) {
        return { rows: [{ "?column?": 1 }] };
      }
      if (sql.includes("SELECT s.user_id")) {
        return {
          rows: [
            { user_id: "user-2", voted: true },
            { user_id: "user-3", voted: false },
          ],
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const service = createKarmaService({ query } as unknown as Pool);

    await expect(service.getKarmaStatus("lobby-1", "user-1")).resolves.toEqual({
      open: true,
      remainingTargets: 1,
      votedTargetIds: ["user-2"],
    });
  });

  it("shows tags from other players on the passport", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT * FROM users")) {
        return {
          rows: [
            {
              id: "user-1",
              max_user_id: 1,
              first_name: "Арсен",
              last_name: null,
              username: null,
              photo_url: null,
              game_level: "amateur",
              reliability_pct: 90,
              games_played: 3,
              created_at: "2026-09-20T12:00:00.000Z",
            },
          ],
        };
      }
      if (sql.includes("user_badges")) return { rows: [] };
      if (sql.includes("FROM karma_votes")) {
        return { rows: [{ tag: "крутой пас", votes: 2 }] };
      }
      if (sql.includes("FROM presence_records")) {
        return { rows: [{ on_site: 1, total: 1 }] };
      }
      if (sql.includes("user_sport_skills")) return { rows: [] };
      throw new Error(`Unexpected query: ${sql}`);
    });
    const service = createKarmaService({ query } as unknown as Pool);

    await expect(service.getPassport("user-1")).resolves.toMatchObject({
      kudos: [{ tag: "крутой пас", votes: 2 }],
      badges: [],
    });
  });
});
