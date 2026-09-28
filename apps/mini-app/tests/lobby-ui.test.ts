import { describe, expect, it } from "vitest";
import type { Lobby } from "../src/api";
import {
  canEditLobby,
  canJoinLobby,
  canRateLobby,
} from "../src/lib/lobbyActions";
import { formatSlots, parseCount, slotNoun, slotWord } from "../src/lib/format";
import {
  lobbyDeepLink,
  lobbyShareText,
  maxShareUrl,
} from "../src/lib/lobbyShare";
import { maxProfileUrl } from "../src/lib/maxContact";
import { markableStatuses } from "../src/lib/presenceActions";
import { parentPath } from "../src/lib/useBackButton";
import {
  missingRoleCounts,
  roleMarkKind,
  roleSlotsFromPicks,
} from "../src/lib/roleVisual";
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

  it("strips leading zeros from count fields", () => {
    expect(parseCount("002")).toBe(2);
    expect(parseCount("08")).toBe(8);
    expect(parseCount("12")).toBe(12);
    expect(parseCount("")).toBe(0);
  });
});

describe("lobby share links", () => {
  it("builds a startapp deeplink and a :share url", () => {
    const link = lobbyDeepLink("gov_max_sport_bot", "lobby-1");
    expect(link).toBe(
      "https://max.ru/gov_max_sport_bot?startapp=lobby_lobby-1"
    );
    const text = lobbyShareText({
      sport: "Волейбол",
      when: "ср, 19:00",
      venue: "ФОК",
    });
    expect(text).not.toContain(link);
    expect(maxShareUrl(`${text}\n${link}`)).toBe(
      `https://max.ru/:share?text=${encodeURIComponent(`${text}\n${link}`)}`
    );
  });
});

describe("max contact links", () => {
  it("opens max.ru/u by system id, never /id", () => {
    expect(maxProfileUrl({ maxUserId: 42 })).toBe("https://max.ru/u/42");
    expect(maxProfileUrl({ username: "@coach", maxUserId: 42 })).toBe(
      "https://max.ru/u/42"
    );
    expect(maxProfileUrl({ username: "@coach" })).toBe("https://max.ru/coach");
    expect(maxProfileUrl({ username: "  " })).toBeNull();
  });
});

describe("back navigation", () => {
  it("returns to the parent screen instead of an empty history", () => {
    expect(parentPath("/")).toBeNull();
    expect(parentPath("/create")).toBeNull();
    expect(parentPath("/passport")).toBeNull();
    expect(parentPath("/lobby/abc/roster")).toBe("/lobby/abc");
    expect(parentPath("/lobby/abc/edit")).toBe("/lobby/abc");
    expect(parentPath("/lobby/abc")).toBe("/");
    expect(parentPath("/passport/user-1")).toBe("/passport");
  });
});

describe("presence mark rights", () => {
  it("lets a player edit only their own transit and on-site status", () => {
    expect(
      markableStatuses({
        entryUserId: "me",
        actorUserId: "me",
        isOrganizer: false,
        current: "expected",
      })
    ).toEqual(["on_the_way", "on_site"]);
    expect(
      markableStatuses({
        entryUserId: "other",
        actorUserId: "me",
        isOrganizer: false,
        current: "expected",
      })
    ).toEqual([]);
  });

  it("lets an organizer mark others only as arrived or no-show", () => {
    expect(
      markableStatuses({
        entryUserId: "player",
        actorUserId: "org",
        isOrganizer: true,
        current: "expected",
      })
    ).toEqual(["on_site", "no_show"]);
    expect(
      markableStatuses({
        entryUserId: "org",
        actorUserId: "org",
        isOrganizer: true,
        current: "expected",
      })
    ).toEqual(["on_the_way", "on_site"]);
  });
});

describe("needed roles", () => {
  it("maps picks to empty seats and never the organizer slot", () => {
    expect(roleSlotsFromPicks(["Защитник", "Защитник", "Вратарь"], 4)).toEqual([
      { index: 3, role: "Защитник" },
      { index: 2, role: "Защитник" },
      { index: 1, role: "Вратарь" },
    ]);
    expect(roleSlotsFromPicks(["Снайпер", "Пулемётчик"], 2)).toEqual([
      { index: 1, role: "Снайпер" },
    ]);
    expect(roleMarkKind("Снайпер")).toBe("rifle");
    expect(roleMarkKind("Медик")).toBe("medic");
    expect(roleMarkKind(null)).toBe("player");
    expect(
      missingRoleCounts([
        { userId: "org", roleRequired: "Снайпер" },
        { userId: null, roleRequired: "Пулемётчик" },
        { userId: null, roleRequired: "Пулемётчик" },
        { userId: null, roleRequired: null },
      ])
    ).toEqual([{ role: "Пулемётчик", count: 2 }]);
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
