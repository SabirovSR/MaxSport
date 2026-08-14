import { describe, expect, it } from "vitest";
import { calculateSplit } from "../split.js";

describe("calculateSplit", () => {
  it("splits rent evenly with ceiling per player", () => {
    expect(calculateSplit(4200, 12)).toBe(350);
    expect(calculateSplit(500, 3)).toBe(167);
  });

  it("returns 0 for empty lobby", () => {
    expect(calculateSplit(1000, 0)).toBe(0);
  });
});
