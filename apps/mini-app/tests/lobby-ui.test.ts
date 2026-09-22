import { describe, expect, it } from "vitest";
import type { Lobby } from "../src/api";
import {
  canEditLobby,
  canJoinLobby,
  canRateLobby,
} from "../src/lib/lobbyActions";
import { formatSlots, slotNoun, slotWord } from "../src/lib/format";
import { sortLobbies } from "../src/lib/lobbySort";

function lobby(
  id: string,
  values: Partial<
    Pick<
      Lobby,
      "startAt" | "distanceM" | "splitPerPlayer" | "slotCount" | "filledCount"
    >
  >
): Lobby {
  return {
    id,
    startAt: "2026-09-22T12:00:00.000Z",
    splitPerPlayer: 0,
    slotCount: 10,
    filledCount: 5,
    ...values,
  } as Lobby;
}

describe("lobby sorting", () => {
  const items = [
    lobby("a", {
      startAt: "2026-09-22T15:00:00.000Z",
      distanceM: 2000,
      splitPerPlayer: 500,
      slotCount: 10,
      filledCount: 8,
    }),
    lobby("b", {
      startAt: "2026-09-22T13:00:00.000Z",
      distanceM: 500,
      splitPerPlayer: 800,
      slotCount: 12,
      filledCount: 4,
    }),
    lobby("c", {
      startAt: "2026-09-22T14:00:00.000Z",
      splitPerPlayer: 100,
      slotCount: 4,
      filledCount: 3,
    }),
  ];

  it("sorts by all supported modes without mutating the result", () => {
    expect(sortLobbies(items, "time").map(({ id }) => id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(sortLobbies(items, "distance").map(({ id }) => id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(sortLobbies(items, "cost").map(({ id }) => id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(sortLobbies(items, "free").map(({ id }) => id)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(items.map(({ id }) => id)).toEqual(["a", "b", "c"]);
  });
});

describe("slot declension", () => {
  it("agrees with the count and case", () => {
    expect(formatSlots(1)).toBe("1 слот");
    expect(formatSlots(2)).toBe("2 слота");
    expect(formatSlots(5)).toBe("5 слотов");
    expect(formatSlots(21, "prepositional")).toBe("21 слоте");
    expect(formatSlots(3, "prepositional")).toBe("3 слотах");
    expect(slotWord(1, "accusative")).toBe("слот");
    expect(slotNoun(true)).toBe("слоты");
    expect(slotNoun(true, "instrumental")).toBe("слотами");
  });
});

describe("lobby actions by status", () => {
  it("blocks unavailable actions and exposes Karma when ready", () => {
    expect(canJoinLobby("open")).toBe(true);
    expect(canJoinLobby("gathering")).toBe(true);
    expect(canJoinLobby("full")).toBe(false);
    expect(canJoinLobby("started")).toBe(false);
    expect(canEditLobby("full")).toBe(true);
    expect(canEditLobby("started")).toBe(false);
    expect(canRateLobby({ status: "finished" }, true, 2)).toBe(true);
    expect(canRateLobby({ status: "finished" }, false, 2)).toBe(false);
    expect(canRateLobby({ status: "finished" }, true, 0)).toBe(false);
  });
});
