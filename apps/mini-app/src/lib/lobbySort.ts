import type { Lobby } from "../api";

export type LobbySortMode = "time" | "distance" | "cost" | "free";

export function sortLobbies(items: Lobby[], mode: LobbySortMode): Lobby[] {
  return [...items].sort((a, b) => {
    if (mode === "distance") {
      return (
        (a.distanceM ?? Number.MAX_SAFE_INTEGER) -
        (b.distanceM ?? Number.MAX_SAFE_INTEGER)
      );
    }
    if (mode === "cost") return a.splitPerPlayer - b.splitPerPlayer;
    if (mode === "free") {
      return b.slotCount - b.filledCount - (a.slotCount - a.filledCount);
    }
    return new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
  });
}
