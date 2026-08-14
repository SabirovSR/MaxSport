import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACCENT, ACCENT_ON, palette, radius } from "../index.js";

const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");

function declaration(name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim();
}

function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [
    (value >> 16) & 0xff,
    (value >> 8) & 0xff,
    value & 0xff,
  ].map((byte) => {
    const srgb = byte / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return (
    0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
  );
}

function contrastRatio(a: string, b: string): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

describe("brand tokens", () => {
  it("keeps the TypeScript palette in sync with tokens.css", () => {
    const groups = { ink: palette.ink, lime: palette.lime };
    for (const [group, shades] of Object.entries(groups)) {
      for (const [shade, hex] of Object.entries(shades)) {
        expect(declaration(`ms-${group}-${shade}`), `--ms-${group}-${shade}`).toBe(
          hex
        );
      }
    }
    for (const [name, hex] of Object.entries(palette.signal)) {
      expect(declaration(`ms-signal-${name}`), `--ms-signal-${name}`).toBe(hex);
    }
  });

  it("keeps the radius scale in sync with tokens.css", () => {
    for (const [name, value] of Object.entries(radius)) {
      expect(declaration(`ms-radius-${name}`), `--ms-radius-${name}`).toBe(value);
    }
  });

  it("uses court-lime as the only accent", () => {
    expect(ACCENT).toBe(palette.lime[500]);
    expect(declaration("ms-accent")).toBe("var(--ms-lime-500)");
  });
});

describe("brand contrast", () => {
  it("passes AA for text on an accent fill", () => {
    expect(contrastRatio(ACCENT, ACCENT_ON)).toBeGreaterThanOrEqual(4.5);
  });

  it("passes AAA for primary text on the dark base surface", () => {
    expect(
      contrastRatio(palette.ink[0], palette.ink[900])
    ).toBeGreaterThanOrEqual(7);
  });

  it("passes AA for muted text on a raised dark surface", () => {
    expect(
      contrastRatio(palette.ink[400], palette.ink[850])
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("passes AA for accent text on a light surface", () => {
    expect(
      contrastRatio(palette.lime[800], palette.ink[50])
    ).toBeGreaterThanOrEqual(4.5);
  });
});
