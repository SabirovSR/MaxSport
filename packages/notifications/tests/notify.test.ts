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
