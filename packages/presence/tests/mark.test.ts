import { describe, expect, it, vi } from "vitest";
import { ForbiddenError, type Pool } from "@maxsport/shared";
import { createPresenceService } from "../index.js";

function serviceWith(
  occupantId: string,
  organizerId = "org-1",
  update = vi.fn(async () => ({ rowCount: 1 }))
) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes("organizer_id")) {
      return { rows: [{ organizer_id: organizerId, user_id: occupantId }] };
    }
    return update();
  });
  return {
    service: createPresenceService({ query } as unknown as Pool),
    update,
  };
}

describe("manual presence marks", () => {
  it("lets a player mark only their own on_the_way or on_site", async () => {
    const { service, update } = serviceWith("player-1");
    await service.manualMark("slot-1", "player-1", "on_the_way");
    await service.manualMark("slot-1", "player-1", "on_site");
    expect(update).toHaveBeenCalledTimes(2);
    await expect(
      service.manualMark("slot-1", "player-1", "no_show")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lets an organizer mark another player only on_site or no_show", async () => {
    const { service, update } = serviceWith("player-1");
    await service.manualMark("slot-1", "org-1", "on_site");
    await service.manualMark("slot-1", "org-1", "no_show");
    expect(update).toHaveBeenCalledTimes(2);
    await expect(
      service.manualMark("slot-1", "org-1", "on_the_way")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("forbids a player from marking someone else", async () => {
    const { service } = serviceWith("player-1");
    await expect(
      service.manualMark("slot-1", "intruder", "on_site")
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
