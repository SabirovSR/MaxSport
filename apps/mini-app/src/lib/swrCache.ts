import type { Cache } from "swr";

const STORAGE_KEY = "ms-swr-cache";

export function swrCacheProvider(): Cache {
  const map = new Map();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as [
      string,
      unknown,
    ][];
    for (const [key, value] of stored.slice(-48)) map.set(key, value);
  } catch {
    // квота или закрытый storage
  }

  window.addEventListener("pagehide", () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...map].slice(-48)));
    } catch {
      // ignore
    }
  });

  return map;
}
