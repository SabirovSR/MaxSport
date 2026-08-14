import { describe, expect, it } from "vitest";
import { greet } from "../index.js";

describe("example", () => {
  it("greets by name", () => {
    expect(greet("MAX Sport")).toBe("Hello, MAX Sport!");
  });
});
