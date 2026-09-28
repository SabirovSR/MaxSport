import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import {
  CreateLobbyBody,
  KarmaVoteBody,
  LobbyListQuery,
} from "../src/http/schemas";

describe("api schemas", () => {
  it("rejects a lobby without required fields", () => {
    expect(Value.Check(CreateLobbyBody, { sport: "volleyball" })).toBe(false);
  });

  it("accepts a complete lobby body", () => {
    expect(
      Value.Check(CreateLobbyBody, {
        sport: "volleyball",
        gameLevel: "amateur",
        startAt: "2026-10-01T18:00:00.000Z",
        venueId: "11111111-1111-1111-1111-111111111111",
        rentTotal: 0,
        slotCount: 6,
      })
    ).toBe(true);
  });

  it("rejects an unknown sport in the feed query", () => {
    expect(Value.Check(LobbyListQuery, { sport: "chess" })).toBe(false);
  });

  it("rejects a vote without a target", () => {
    expect(
      Value.Check(KarmaVoteBody, {
        lobbyId: "11111111-1111-1111-1111-111111111111",
        reliability: "on_time",
      })
    ).toBe(false);
  });
});
