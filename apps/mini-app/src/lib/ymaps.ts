/// <reference types="@yandex/ymaps3-types" />
import * as React from "react";
import * as ReactDOM from "react-dom";
import type { ComponentType, ReactNode } from "react";
import { api } from "../api";

/**
 * The JS API is distributed only as a script tag and lives on a global, so it
 * cannot be a normal dependency. The key is fetched at runtime from
 * /api/config rather than baked in at build time, which keeps key rotation off
 * the Docker rebuild path.
 */

export interface LngLat extends Array<number> {
  0: number;
  1: number;
}

export interface YMapProps {
  location: { center: [number, number]; zoom: number };
  children?: ReactNode;
  ref?: unknown;
}

export interface YMapMarkerProps {
  coordinates: [number, number];
  onClick?: () => void;
  draggable?: boolean;
  onDragEnd?: (coordinates: [number, number]) => void;
  children?: ReactNode;
}

export interface YandexMapApi {
  YMap: ComponentType<YMapProps>;
  YMapDefaultSchemeLayer: ComponentType<{ theme?: "light" | "dark" }>;
  YMapDefaultFeaturesLayer: ComponentType<Record<string, never>>;
  YMapMarker: ComponentType<YMapMarkerProps>;
  YMapListener: ComponentType<{ layer?: string; onClick?: unknown }>;
  useDefault: <T>(value: T) => T;
}

export class MapKeyMissingError extends Error {
  constructor() {
    super("Ключ Яндекс Карт не настроен на сервере");
    this.name = "MapKeyMissingError";
  }
}

let pending: Promise<YandexMapApi> | null = null;

function injectScript(src: string): Promise<void> {
  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-ymaps="v3"]`
  );
  if (existing) {
    return existing.dataset.loaded === "true"
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () =>
            reject(new Error("Не удалось загрузить Яндекс Карты"))
          );
        });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.ymaps = "v3";
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () =>
      reject(new Error("Не удалось загрузить Яндекс Карты"))
    );
    document.head.appendChild(script);
  });
}

async function initialise(): Promise<YandexMapApi> {
  const { yandexMapsApiKey } = await api.getConfig();
  if (!yandexMapsApiKey) throw new MapKeyMissingError();

  await injectScript(
    `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(yandexMapsApiKey)}&lang=ru_RU`
  );

  const [imported] = await Promise.all([
    ymaps3.import("@yandex/ymaps3-reactify"),
    ymaps3.ready,
  ]);

  const reactify = imported.reactify.bindTo(React, ReactDOM);
  // reactify.module() is dynamic by nature; YandexMapApi above pins the shape
  // this app actually consumes so call sites stay typed.
  const components = reactify.module(ymaps3) as unknown as Omit<
    YandexMapApi,
    "useDefault"
  >;

  return { ...components, useDefault: reactify.useDefault };
}

export function loadYandexMaps(): Promise<YandexMapApi> {
  if (!pending) {
    pending = initialise().catch((error) => {
      // Allow a later retry instead of caching the failure forever.
      pending = null;
      throw error;
    });
  }
  return pending;
}
