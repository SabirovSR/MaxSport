/**
 * Raw calls into the three Yandex HTTP APIs. Each product is a separate
 * package in the Yandex cabinet with its own key.
 */

const SUGGEST_URL = "https://suggest-maps.yandex.ru/v1/suggest";
const GEOCODER_URL = "https://geocode-maps.yandex.ru/v1/";
const STATIC_URL = "https://static-maps.yandex.ru/v1";

export type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal }
) => Promise<Response>;

export interface GeoSuggestion {
  title: string;
  subtitle?: string;
  address?: string;
  /** Opaque Yandex handle; feed it back to the geocoder to resolve coordinates. */
  uri?: string;
  distanceM?: number;
}

export interface GeocodeResult {
  name?: string;
  address: string;
  lat: number;
  lng: number;
}

interface SuggestResponse {
  results?: Array<{
    title?: { text?: string };
    subtitle?: { text?: string };
    address?: { formatted_address?: string };
    uri?: string;
    distance?: { value?: number };
  }>;
}

interface GeocoderResponse {
  response?: {
    GeoObjectCollection?: {
      featureMember?: Array<{
        GeoObject?: {
          name?: string;
          Point?: { pos?: string };
          metaDataProperty?: {
            GeocoderMetaData?: {
              text?: string;
              Address?: { formatted?: string };
            };
          };
        };
      }>;
    };
  };
}

export class YandexGeoError extends Error {
  constructor(
    readonly service: string,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "YandexGeoError";
  }
}

async function requestJson<T>(
  service: string,
  url: URL,
  fetchImpl: FetchLike,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url.toString(), {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new YandexGeoError(
        service,
        response.status,
        `${service} responded ${response.status}`
      );
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSuggestions(input: {
  apiKey: string;
  text: string;
  near?: { lat: number; lng: number };
  results?: number;
  fetchImpl: FetchLike;
  timeoutMs: number;
}): Promise<GeoSuggestion[]> {
  const url = new URL(SUGGEST_URL);
  url.searchParams.set("apikey", input.apiKey);
  url.searchParams.set("text", input.text);
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("results", String(input.results ?? 7));
  url.searchParams.set("print_address", "1");
  url.searchParams.set("attrs", "uri");
  // Sports halls are usually registered organisations, so bias toward those
  // plus street addresses rather than whole cities.
  url.searchParams.set("types", "biz,house,street");
  if (input.near) {
    url.searchParams.set("ll", `${input.near.lng},${input.near.lat}`);
    url.searchParams.set("spn", "0.5,0.5");
  }

  const data = await requestJson<SuggestResponse>(
    "geosuggest",
    url,
    input.fetchImpl,
    input.timeoutMs
  );

  return (data.results ?? [])
    .map((item) => ({
      title: item.title?.text ?? "",
      subtitle: item.subtitle?.text,
      address: item.address?.formatted_address,
      uri: item.uri,
      distanceM: item.distance?.value,
    }))
    .filter((item) => item.title.length > 0);
}

function readFirstGeoObject(data: GeocoderResponse): GeocodeResult | null {
  const object =
    data.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
  const position = object?.Point?.pos;
  if (!object || !position) return null;

  // Yandex returns "longitude latitude", which is the opposite of the order
  // used everywhere else in this codebase.
  const [lng, lat] = position.split(" ").map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const meta = object.metaDataProperty?.GeocoderMetaData;
  return {
    name: object.name,
    address: meta?.Address?.formatted ?? meta?.text ?? object.name ?? "",
    lat: lat as number,
    lng: lng as number,
  };
}

export async function fetchGeocode(input: {
  apiKey: string;
  /** Either a free-form address, "lng,lat" for reverse lookup, or a suggest uri. */
  geocode?: string;
  uri?: string;
  fetchImpl: FetchLike;
  timeoutMs: number;
}): Promise<GeocodeResult | null> {
  const url = new URL(GEOCODER_URL);
  url.searchParams.set("apikey", input.apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("results", "1");
  if (input.uri) url.searchParams.set("uri", input.uri);
  if (input.geocode) url.searchParams.set("geocode", input.geocode);

  const data = await requestJson<GeocoderResponse>(
    "geocoder",
    url,
    input.fetchImpl,
    input.timeoutMs
  );
  return readFirstGeoObject(data);
}

export async function fetchStaticMap(input: {
  apiKey: string;
  lat: number;
  lng: number;
  zoom: number;
  width: number;
  height: number;
  fetchImpl: FetchLike;
  timeoutMs: number;
}): Promise<{ body: ArrayBuffer; contentType: string }> {
  const url = new URL(STATIC_URL);
  url.searchParams.set("apikey", input.apiKey);
  url.searchParams.set("ll", `${input.lng},${input.lat}`);
  url.searchParams.set("z", String(input.zoom));
  url.searchParams.set("size", `${input.width},${input.height}`);
  url.searchParams.set("lang", "ru_RU");
  url.searchParams.set("theme", "dark");
  url.searchParams.set("pt", `${input.lng},${input.lat},pm2gnl`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);
  try {
    const response = await input.fetchImpl(url.toString(), {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new YandexGeoError(
        "static",
        response.status,
        `static map responded ${response.status}`
      );
    }
    return {
      body: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") ?? "image/png",
    };
  } finally {
    clearTimeout(timer);
  }
}
