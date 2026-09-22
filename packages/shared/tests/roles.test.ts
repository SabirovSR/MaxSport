import { describe, expect, it } from "vitest";
import {
  KARMA_TAGS,
  normalizePreferredRoles,
  ROLE_OPTIONS,
  SPORT_LABELS,
} from "../roles.js";

const SPORTS = [
  "volleyball",
  "mini_football",
  "basketball",
  "padel_tennis",
  "floorball",
  "ice_hockey",
  "water_polo",
  "table_tennis",
  "airsoft",
  "paintball",
] as const;

describe("sports catalog", () => {
  it("contains every supported sport", () => {
    expect(Object.keys(SPORT_LABELS).sort()).toEqual([...SPORTS].sort());
  });

  it.each(SPORTS)("%s has roles and Karma tags", (sport) => {
    expect(ROLE_OPTIONS[sport].length).toBeGreaterThan(0);
    expect(KARMA_TAGS[sport].length).toBeGreaterThan(0);
    expect(new Set(ROLE_OPTIONS[sport]).size).toBe(ROLE_OPTIONS[sport].length);
  });

  it("normalizes and validates preferred roles for one sport", () => {
    expect(
      normalizePreferredRoles("volleyball", [
        "Связующий",
        " Связующий ",
        "Либеро",
      ])
    ).toEqual(["Связующий", "Либеро"]);
    expect(normalizePreferredRoles("volleyball", ["Вратарь"])).toBeNull();
    expect(
      normalizePreferredRoles("airsoft", ROLE_OPTIONS.airsoft.slice(0, 5))
    ).toBeNull();
  });
});
