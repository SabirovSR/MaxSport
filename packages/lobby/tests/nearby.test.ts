import { describe, expect, it, vi } from "vitest";
import type { Pool } from "@maxsport/shared";
import type { VenueRepository } from "@maxsport/venue";
import { createLobbyService, DEFAULT_NEARBY_RADIUS_M } from "../index.js";

/**
 * list() resolves each row through loadDetails, so returning no rows keeps the
 * assertions on the one query that matters: the feed query itself.
 */
function serviceWithSpy() {
  const query = vi.fn(async () => ({ rows: [] }));
  const pool = { query } as unknown as Pool;
  const venues = {} as unknown as VenueRepository;
  return { service: createLobbyService(pool, venues), query };
}

function lastCall(query: ReturnType<typeof vi.fn>) {
  const [sql, params] = query.mock.calls[0] as [string, unknown[]];
  return { sql, params };
}

describe("lobby feed without a position", () => {
  it("does not measure distance and orders by start time", async () => {
    const { service, query } = serviceWithSpy();
    await service.list({});
    const { sql, params } = lastCall(query);

    expect(sql).toContain("NULL::float8 AS distance_m");
    expect(sql).not.toContain("ST_Distance");
    expect(sql).not.toContain("ST_DWithin");
    expect(sql).toContain("ORDER BY l.start_at ASC");
    expect(params).toEqual([]);
  });

  it("ignores a radius supplied without a position", async () => {
    const { service, query } = serviceWithSpy();
    await service.list({ radiusM: 3000 });

    expect(lastCall(query).sql).not.toContain("ST_DWithin");
  });

  it("ignores a half-supplied position", async () => {
    const { service, query } = serviceWithSpy();
    await service.list({ userLat: 55.75 });

    expect(lastCall(query).sql).not.toContain("ST_Distance");
  });
});

describe("lobby feed with a position", () => {
  it("passes longitude before latitude, as ST_MakePoint expects", async () => {
    const { service, query } = serviceWithSpy();
    await service.list({ userLat: 55.7558, userLng: 37.6173 });
    const { sql, params } = lastCall(query);

    expect(sql).toContain("ST_MakePoint($1, $2)");
    expect(params).toEqual([37.6173, 55.7558]);
  });

  it("measures distance but does not filter until a radius is given", async () => {
    const { service, query } = serviceWithSpy();
    await service.list({ userLat: 55.7558, userLng: 37.6173 });
    const { sql } = lastCall(query);

    expect(sql).toContain("ST_Distance(v.location");
    expect(sql).not.toContain("ST_DWithin");
    expect(sql).toContain("ORDER BY distance_m ASC, l.start_at ASC");
  });

  it("filters by radius when one is given", async () => {
    const { service, query } = serviceWithSpy();
    await service.list({
      userLat: 55.7558,
      userLng: 37.6173,
      radiusM: DEFAULT_NEARBY_RADIUS_M,
    });
    const { sql, params } = lastCall(query);

    expect(sql).toContain("ST_DWithin(v.location");
    expect(sql).toContain("$3)");
    expect(params).toEqual([37.6173, 55.7558, DEFAULT_NEARBY_RADIUS_M]);
  });

  it("keeps placeholder numbering correct behind the other filters", async () => {
    const { service, query } = serviceWithSpy();
    await service.list({
      sport: "volleyball",
      gameLevel: "amateur",
      userLat: 55.7558,
      userLng: 37.6173,
      radiusM: 2000,
    });
    const { sql, params } = lastCall(query);

    expect(params).toEqual([
      "volleyball",
      "amateur",
      37.6173,
      55.7558,
      2000,
    ]);
    expect(sql).toContain("l.sport = $1");
    expect(sql).toContain("l.game_level = $2");
    expect(sql).toContain("ST_MakePoint($3, $4)");
    expect(sql).toContain("$5)");
  });

  it("joins venues so the distance expression can resolve", async () => {
    const { service, query } = serviceWithSpy();
    await service.list({ userLat: 55.7558, userLng: 37.6173 });

    expect(lastCall(query).sql).toContain("JOIN venues v ON v.id = l.venue_id");
  });
});
