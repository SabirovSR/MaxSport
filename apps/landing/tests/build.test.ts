import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dist = new URL("../dist/", import.meta.url).pathname.replace(/^\/(\w:)/, "$1");
const indexPath = join(dist, "index.html");
const built = existsSync(indexPath);

/**
 * `npm run check` builds before it tests, so these assertions run against real
 * output. Standalone `npm test` skips rather than failing on a missing build.
 */
describe.skipIf(!built)("landing build output", () => {
  const html = built ? readFileSync(indexPath, "utf8") : "";

  function bundledText(): string {
    const assets = join(dist, "assets");
    return readdirSync(assets)
      .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
      .map((file) => readFileSync(join(assets, file), "utf8"))
      .join("\n");
  }

  it("declares an absolute og:image a scraper can fetch", () => {
    expect(html).toContain(
      'content="https://max-sport.sabirov.tech/og-card.jpg"'
    );
    expect(existsSync(join(dist, "og-card.jpg"))).toBe(true);
  });

  it("ships the favicon and apple touch icon it references", () => {
    expect(html).toContain('href="/mark.svg"');
    expect(existsSync(join(dist, "mark.svg"))).toBe(true);
    expect(existsSync(join(dist, "mark-180.png"))).toBe(true);
  });

  it("preloads the hero image, which is the LCP element", () => {
    expect(html).toContain('href="/hero-court.jpg"');
    expect(existsSync(join(dist, "hero-court.jpg"))).toBe(true);
  });

  it("contains no em dash or en dash in any shipped copy", () => {
    const text = html + bundledText();
    expect(text).not.toContain("\u2014");
    expect(text).not.toContain("\u2013");
  });

  it("resolves brand tokens instead of emitting bare custom property names", () => {
    const css = bundledText();
    expect(css).toMatch(/--ms-lime-500:\s*#c8f54a/i);
    // A Tailwind v4 arbitrary value written with the v3 bracket syntax emits
    // the property name without var(), which silently does nothing.
    expect(css).not.toMatch(/transition-duration:\s*--ms-/);
  });
});
