import { describe, expect, it } from "vitest";
import { maxUserProfileUrl } from "../index.js";

describe("max user profile url", () => {
  it("uses /u/{id}, never /id", () => {
    expect(maxUserProfileUrl(42)).toBe("https://max.ru/u/42");
    expect(maxUserProfileUrl(42)).not.toContain("/id");
  });
});
