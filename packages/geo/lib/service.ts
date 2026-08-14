import { ValidationError } from "@maxsport/shared";
import { createRateLimiter, createTtlCache } from "./cache.js";
import {
  fetchGeocode,
  fetchStaticMap,
  fetchSuggestions,
  type FetchLike,
  type GeocodeResult,
  type GeoSuggestion,
} from "./yandex.js";

export interface GeoConfig {
  /** Public by design: it ships to the browser and is restricted by referrer. */
  jsApiKey: string;
  suggestKey: string;
  geocoderKey: string;
  staticKey: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface GeoService {
  /** The one key that may leave the server. Empty string when unconfigured. */
  jsApiKey(): string;
  suggest(input: {
    text: string;
    near?: { lat: number; lng: number };
    rateKey: string;
  }): Promise<GeoSuggestion[]>;
  geocode(input: {
    query?: string;
    uri?: string;
    rateKey: string;
  }): Promise<GeocodeResult | null>;
  reverseGeocode(input: {
    lat: number;
    lng: number;
    rateKey: string;
  }): Promise<GeocodeResult | null>;
  staticMap(input: {
    lat: number;
    lng: number;
    zoom?: number;
    width?: number;
    height?: number;
    rateKey: string;
  }): Promise<{ body: ArrayBuffer; contentType: string } | null>;
}

export class GeoQuotaError extends ValidationError {
  constructor() {
    super("Слишком много запросов к картам, попробуйте через минуту");
  }
}

const SUGGEST_TTL_MS = 60_000;
const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000;
const STATIC_MAX_EDGE = 650;

function requireCoordinate(value: number, name: string, limit: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new ValidationError(`Некорректная координата ${name}`);
  }
  return value;
}

export function createGeoService(config: GeoConfig): GeoService {
  const fetchImpl = config.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = config.timeoutMs ?? 4000;

  const suggestCache = createTtlCache<GeoSuggestion[]>({
    ttlMs: SUGGEST_TTL_MS,
    maxEntries: 500,
  });
  const geocodeCache = createTtlCache<GeocodeResult | null>({
    ttlMs: GEOCODE_TTL_MS,
    maxEntries: 1000,
  });

  // Typing "ФОК Центральный" is ~15 keystrokes, so the suggest budget has to
  // absorb a full query while still capping a runaway client.
  const suggestLimiter = createRateLimiter({ limit: 40, windowMs: 60_000 });
  const geocodeLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
  const staticLimiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

  return {
    jsApiKey() {
      return config.jsApiKey;
    },

    async suggest({ text, near, rateKey }) {
      const query = text.trim();
      if (query.length < 3) return [];
      if (!config.suggestKey) return [];
      if (!suggestLimiter.take(rateKey)) throw new GeoQuotaError();

      const cacheKey = near
        ? `${query}|${near.lat.toFixed(2)},${near.lng.toFixed(2)}`
        : query;
      const cached = suggestCache.get(cacheKey);
      if (cached) return cached;

      const results = await fetchSuggestions({
        apiKey: config.suggestKey,
        text: query,
        near,
        fetchImpl,
        timeoutMs,
      });
      suggestCache.set(cacheKey, results);
      return results;
    },

    async geocode({ query, uri, rateKey }) {
      if (!query && !uri) {
        throw new ValidationError("Нужен адрес или uri");
      }
      if (!config.geocoderKey) return null;
      if (!geocodeLimiter.take(rateKey)) throw new GeoQuotaError();

      const cacheKey = `f:${uri ?? query}`;
      const cached = geocodeCache.get(cacheKey);
      if (cached !== undefined) return cached;

      const result = await fetchGeocode({
        apiKey: config.geocoderKey,
        geocode: uri ? undefined : query,
        uri,
        fetchImpl,
        timeoutMs,
      });
      geocodeCache.set(cacheKey, result);
      return result;
    },

    async reverseGeocode({ lat, lng, rateKey }) {
      requireCoordinate(lat, "lat", 90);
      requireCoordinate(lng, "lng", 180);
      if (!config.geocoderKey) return null;
      if (!geocodeLimiter.take(rateKey)) throw new GeoQuotaError();

      const cacheKey = `r:${lat.toFixed(5)},${lng.toFixed(5)}`;
      const cached = geocodeCache.get(cacheKey);
      if (cached !== undefined) return cached;

      const result = await fetchGeocode({
        apiKey: config.geocoderKey,
        geocode: `${lng},${lat}`,
        fetchImpl,
        timeoutMs,
      });
      geocodeCache.set(cacheKey, result);
      return result;
    },

    async staticMap({ lat, lng, zoom, width, height, rateKey }) {
      requireCoordinate(lat, "lat", 90);
      requireCoordinate(lng, "lng", 180);
      if (!config.staticKey) return null;
      if (!staticLimiter.take(rateKey)) throw new GeoQuotaError();

      return fetchStaticMap({
        apiKey: config.staticKey,
        lat,
        lng,
        zoom: Math.min(Math.max(zoom ?? 16, 1), 21),
        width: Math.min(width ?? 640, STATIC_MAX_EDGE),
        height: Math.min(height ?? 320, STATIC_MAX_EDGE),
        fetchImpl,
        timeoutMs,
      });
    },
  };
}
