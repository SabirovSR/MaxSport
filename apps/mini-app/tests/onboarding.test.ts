import { describe, expect, it } from "vitest";
import {
  hasSeenOnboarding,
  markOnboardingSeen,
  requestOnboarding,
  shouldShowOnboarding,
  subscribeOnboarding,
} from "../src/lib/onboarding";

function memoryStorage(start: Record<string, string> = {}) {
  const data = { ...start };
  return {
    getItem(key: string) {
      return data[key] ?? null;
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

describe("onboarding", () => {
  it("shows only for a player without games and without a seen flag", () => {
    const storage = memoryStorage();
    expect(shouldShowOnboarding(0, storage)).toBe(true);
    expect(shouldShowOnboarding(1, storage)).toBe(false);
  });

  it("does not show again after it was closed", () => {
    const storage = memoryStorage();
    markOnboardingSeen(storage);
    expect(hasSeenOnboarding(storage)).toBe(true);
    expect(shouldShowOnboarding(0, storage)).toBe(false);
  });

  it("can be opened again from the passport", () => {
    const hits: number[] = [];
    const stop = subscribeOnboarding(() => hits.push(1));
    requestOnboarding();
    stop();
    requestOnboarding();
    expect(hits).toEqual([1]);
  });
});
