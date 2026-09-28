import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, ValidationError, type Pool } from "@maxsport/shared";
import type { MaxApiClient } from "@maxsport/max-channel";
import { createNotificationScheduler } from "../index.js";

describe("notify lobby players", () => {
  it("sends a message to each participant except the organizer", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT organizer_id, status, sport")) {
        return {
          rows: [
            { organizer_id: "org-1", status: "open", sport: "volleyball" },
          ],
        };
      }
      if (sql.includes("FROM slots")) {
        return { rows: [{ max_user_id: 11 }, { max_user_id: 12 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const sendMessage = vi.fn(async () => ({ messageId: "m1" }));
    const scheduler = createNotificationScheduler(
      { query } as unknown as Pool,
      { sendMessage } as unknown as MaxApiClient
    );

    await expect(
      scheduler.notifyLobbyPlayers("lobby-1", "org-1")
    ).resolves.toBe(2);
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it("rejects a stranger", async () => {
    const scheduler = createNotificationScheduler(
      {
        query: vi.fn(async () => ({
          rows: [
            { organizer_id: "org-1", status: "open", sport: "volleyball" },
          ],
        })),
      } as unknown as Pool,
      { sendMessage: vi.fn() } as unknown as MaxApiClient
    );

    await expect(
      scheduler.notifyLobbyPlayers("lobby-1", "intruder")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("does not write after the game", async () => {
    const scheduler = createNotificationScheduler(
      {
        query: vi.fn(async () => ({
          rows: [
            { organizer_id: "org-1", status: "finished", sport: "volleyball" },
          ],
        })),
      } as unknown as Pool,
      { sendMessage: vi.fn() } as unknown as MaxApiClient
    );

    await expect(
      scheduler.notifyLobbyPlayers("lobby-1", "org-1")
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("notify join request", () => {
  it("sends the organizer a roster deep link", async () => {
    const sendMessage = vi.fn(async () => ({ messageId: "m1" }));
    const scheduler = createNotificationScheduler(
      {
        query: vi.fn(async () => ({ rows: [{ max_user_id: 77 }] })),
      } as unknown as Pool,
      { sendMessage } as unknown as MaxApiClient
    );

    await scheduler.notifyJoinRequest("lobby-1", {
      firstName: "Иван",
      lastName: null,
      roleRequired: "Либеро",
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    const payload = sendMessage.mock.calls[0]![0];
    expect(payload.userId).toBe(77);
    expect(payload.text).toContain("Иван");
    expect(payload.buttons?.[0]?.[0]?.url).toContain("startapp=roster_lobby-1");
  });
});

describe("notify contact", () => {
  it("lets any player ping the organizer", async () => {
    const sendMessage = vi.fn(async () => ({ messageId: "m1" }));
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT organizer_id FROM lobbies")) {
        return { rows: [{ organizer_id: "org-1" }] };
      }
      if (sql.includes("SELECT first_name")) {
        return {
          rows: [{ first_name: "Иван", last_name: null, max_user_id: 55 }],
        };
      }
      if (sql.includes("SELECT max_user_id")) {
        return { rows: [{ max_user_id: 77 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const scheduler = createNotificationScheduler(
      { query } as unknown as Pool,
      { sendMessage } as unknown as MaxApiClient
    );

    await scheduler.notifyContact("lobby-1", "player-1");
    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(sendMessage.mock.calls[0]![0].userId).toBe(77);
    expect(sendMessage.mock.calls[0]![0].text).toContain("https://max.ru/u/55");
    expect(sendMessage.mock.calls[1]![0].userId).toBe(55);
    expect(sendMessage.mock.calls[1]![0].text).toContain("уведомлен");
  });
});
