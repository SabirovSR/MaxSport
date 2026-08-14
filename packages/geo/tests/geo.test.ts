import { describe, expect, it, vi } from "vitest";
import { createGeoService, type GeoConfig } from "../index.js";

const KEYS = {
  jsApiKey: "js-key",
  suggestKey: "suggest-key",
  geocoderKey: "geocoder-key",
  staticKey: "static-key",
};

function jsonFetch(payload: unknown) {
  return vi.fn(async (_url: string) =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  );
}

function service(overrides: Partial<GeoConfig>) {
  return createGeoService({ ...KEYS, ...overrides });
}

const SUGGEST_PAYLOAD = {
  results: [
    {
      title: { text: "ФОК «Центральный»" },
      subtitle: { text: "Москва, Профсоюзная улица" },
      address: { formatted_address: "Москва, Профсоюзная улица, 1" },
      uri: "ymapsbm1://org?oid=1",
      distance: { value: 1240 },
    },
    { subtitle: { text: "no title, dropped" } },
  ],
};

// Yandex answers "longitude latitude"; everything else here is lat/lng.
const GEOCODE_PAYLOAD = {
  response: {
    GeoObjectCollection: {
      featureMember: [
        {
          GeoObject: {
            name: "Профсоюзная улица, 1",
            Point: { pos: "37.6173 55.7558" },
            metaDataProperty: {
              GeocoderMetaData: {
                text: "Россия, Москва, Профсоюзная улица, 1",
                Address: { formatted: "Москва, Профсоюзная улица, 1" },
              },
            },
          },
        },
      ],
    },
  },
};

describe("geo suggest", () => {
  it("ignores input shorter than three characters without calling Yandex", async () => {
    const fetchImpl = jsonFetch(SUGGEST_PAYLOAD);
    const geo = service({ fetchImpl });

    expect(await geo.suggest({ text: "фо", rateKey: "u1" })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps the Yandex payload and drops entries without a title", async () => {
    const geo = service({ fetchImpl: jsonFetch(SUGGEST_PAYLOAD) });

    const results = await geo.suggest({ text: "фок центр", rateKey: "u1" });

    expect(results).toEqual([
      {
        title: "ФОК «Центральный»",
        subtitle: "Москва, Профсоюзная улица",
        address: "Москва, Профсоюзная улица, 1",
        uri: "ymapsbm1://org?oid=1",
        distanceM: 1240,
      },
    ]);
  });

  it("sends the documented required parameters", async () => {
    const fetchImpl = jsonFetch(SUGGEST_PAYLOAD);
    await service({ fetchImpl }).suggest({ text: "фок центр", rateKey: "u1" });

    const url = new URL(fetchImpl.mock.calls[0]![0]);
    expect(url.origin + url.pathname).toBe(
      "https://suggest-maps.yandex.ru/v1/suggest"
    );
    expect(url.searchParams.get("apikey")).toBe("suggest-key");
    expect(url.searchParams.get("text")).toBe("фок центр");
  });

  it("serves a repeated query from cache", async () => {
    const fetchImpl = jsonFetch(SUGGEST_PAYLOAD);
    const geo = service({ fetchImpl });

    await geo.suggest({ text: "фок центр", rateKey: "u1" });
    await geo.suggest({ text: "фок центр", rateKey: "u1" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects once a single user exhausts the window", async () => {
    const geo = service({ fetchImpl: jsonFetch(SUGGEST_PAYLOAD) });

    for (let i = 0; i < 40; i += 1) {
      await geo.suggest({ text: `запрос ${i}`, rateKey: "noisy" });
    }

    await expect(
      geo.suggest({ text: "ещё один", rateKey: "noisy" })
    ).rejects.toThrow(/Слишком много запросов/);
  });

  it("does not rate limit a different user", async () => {
    const geo = service({ fetchImpl: jsonFetch(SUGGEST_PAYLOAD) });

    for (let i = 0; i < 40; i += 1) {
      await geo.suggest({ text: `запрос ${i}`, rateKey: "noisy" });
    }

    await expect(
      geo.suggest({ text: "первый", rateKey: "quiet" })
    ).resolves.toHaveLength(1);
  });

  it("degrades to an empty list when the key is missing", async () => {
    const fetchImpl = jsonFetch(SUGGEST_PAYLOAD);
    const geo = service({ fetchImpl, suggestKey: "" });

    expect(await geo.suggest({ text: "фок центр", rateKey: "u1" })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("geo geocode", () => {
  it("reads Yandex longitude-latitude order into lat and lng", async () => {
    const geo = service({ fetchImpl: jsonFetch(GEOCODE_PAYLOAD) });

    const result = await geo.geocode({ query: "Профсоюзная 1", rateKey: "u1" });

    expect(result).toEqual({
      name: "Профсоюзная улица, 1",
      address: "Москва, Профсоюзная улица, 1",
      lat: 55.7558,
      lng: 37.6173,
    });
  });

  it("resolves a suggestion uri instead of free text", async () => {
    const fetchImpl = jsonFetch(GEOCODE_PAYLOAD);
    await service({ fetchImpl }).geocode({
      uri: "ymapsbm1://org?oid=1",
      rateKey: "u1",
    });

    const url = new URL(fetchImpl.mock.calls[0]![0]);
    expect(url.searchParams.get("uri")).toBe("ymapsbm1://org?oid=1");
    expect(url.searchParams.get("geocode")).toBeNull();
    expect(url.searchParams.get("format")).toBe("json");
  });

  it("passes reverse lookups as longitude,latitude", async () => {
    const fetchImpl = jsonFetch(GEOCODE_PAYLOAD);
    await service({ fetchImpl }).reverseGeocode({
      lat: 55.7558,
      lng: 37.6173,
      rateKey: "u1",
    });

    const url = new URL(fetchImpl.mock.calls[0]![0]);
    expect(url.searchParams.get("geocode")).toBe("37.6173,55.7558");
  });

  it("returns null when Yandex finds nothing", async () => {
    const geo = service({
      fetchImpl: jsonFetch({ response: { GeoObjectCollection: {} } }),
    });

    expect(
      await geo.geocode({ query: "нет такого места", rateKey: "u1" })
    ).toBeNull();
  });

  it("rejects an out of range coordinate", async () => {
    const geo = service({ fetchImpl: jsonFetch(GEOCODE_PAYLOAD) });

    await expect(
      geo.reverseGeocode({ lat: 991, lng: 37, rateKey: "u1" })
    ).rejects.toThrow(/Некорректная координата/);
  });

  it("requires either a query or a uri", async () => {
    const geo = service({ fetchImpl: jsonFetch(GEOCODE_PAYLOAD) });

    await expect(geo.geocode({ rateKey: "u1" })).rejects.toThrow(
      /Нужен адрес или uri/
    );
  });

  it("surfaces an invalid key as an error rather than a silent null", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("Invalid apikey", { status: 403 })
    );
    const geo = service({ fetchImpl });

    await expect(
      geo.geocode({ query: "Профсоюзная 1", rateKey: "u1" })
    ).rejects.toThrow(/403/);
  });
});

describe("geo static map", () => {
  it("clamps size and zoom to the Yandex limits", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(new ArrayBuffer(8), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
    );

    await service({ fetchImpl }).staticMap({
      lat: 55.7558,
      lng: 37.6173,
      zoom: 99,
      width: 4000,
      height: 4000,
      rateKey: "u1",
    });

    const url = new URL(fetchImpl.mock.calls[0]![0]);
    expect(url.searchParams.get("z")).toBe("21");
    expect(url.searchParams.get("size")).toBe("650,650");
    expect(url.searchParams.get("ll")).toBe("37.6173,55.7558");
  });
});

describe("geo js api key", () => {
  it("exposes the browser key verbatim", () => {
    expect(service({}).jsApiKey()).toBe("js-key");
  });
});
