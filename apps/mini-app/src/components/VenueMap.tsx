import { useEffect, useRef, useState } from "react";
import {
  loadYandexMaps,
  MapKeyMissingError,
  type YandexMapApi,
} from "../lib/ymaps";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label?: string;
  highlighted?: boolean;
}

interface VenueMapProps {
  points: MapPoint[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
  onSelect?: (id: string) => void;
  /** Enables a single draggable pin, used by the Lobby constructor. */
  draggablePoint?: { lat: number; lng: number };
  onDragEnd?: (position: { lat: number; lng: number }) => void;
  emptyHint?: string;
}

const MOSCOW = { lat: 55.7558, lng: 37.6173 };

function MapFrame({
  height,
  children,
}: {
  height: number;
  children: React.ReactNode;
}) {
  return (
    <div className="map-frame" style={{ height }}>
      {children}
    </div>
  );
}

export function VenueMap({
  points,
  center,
  zoom = 12,
  height = 320,
  onSelect,
  draggablePoint,
  onDragEnd,
  emptyHint,
}: VenueMapProps) {
  const [api, setApi] = useState<YandexMapApi | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    loadYandexMaps()
      .then((loaded) => {
        if (alive.current) setApi(loaded);
      })
      .catch((cause: Error) => {
        if (alive.current) setError(cause);
      });
    return () => {
      alive.current = false;
    };
  }, []);

  if (error) {
    return (
      <MapFrame height={height}>
        <div className="map-state">
          <p>
            {error instanceof MapKeyMissingError
              ? "Карта недоступна: не настроен ключ Яндекс Карт."
              : "Карта не загрузилась."}
          </p>
          {points.length > 0 && (
            <p className="map-state-hint">
              Площадки доступны списком ниже.
            </p>
          )}
        </div>
      </MapFrame>
    );
  }

  if (!api) {
    return (
      <MapFrame height={height}>
        <div className="skeleton skeleton-map" aria-label="Загрузка карты" />
      </MapFrame>
    );
  }

  const {
    YMap,
    YMapDefaultSchemeLayer,
    YMapDefaultFeaturesLayer,
    YMapMarker,
    useDefault,
  } = api;

  const anchor =
    center ??
    (points[0] ? { lat: points[0].lat, lng: points[0].lng } : undefined) ??
    (draggablePoint ?? MOSCOW);

  return (
    <MapFrame height={height}>
      <YMap
        location={useDefault({
          center: [anchor.lng, anchor.lat] as [number, number],
          zoom,
        })}
      >
        <YMapDefaultSchemeLayer theme="dark" />
        <YMapDefaultFeaturesLayer />

        {points.map((point) => (
          <YMapMarker
            key={point.id}
            coordinates={[point.lng, point.lat]}
            onClick={onSelect ? () => onSelect(point.id) : undefined}
          >
            <button
              type="button"
              className={`map-marker ${point.highlighted ? "is-hot" : ""}`}
              onClick={onSelect ? () => onSelect(point.id) : undefined}
            >
              {point.label ?? ""}
            </button>
          </YMapMarker>
        ))}

        {draggablePoint && (
          <YMapMarker
            coordinates={[draggablePoint.lng, draggablePoint.lat]}
            draggable
            onDragEnd={(coordinates) =>
              onDragEnd?.({ lat: coordinates[1], lng: coordinates[0] })
            }
          >
            <span className="map-marker is-draggable" />
          </YMapMarker>
        )}
      </YMap>

      {points.length === 0 && !draggablePoint && emptyHint && (
        <p className="map-empty">{emptyHint}</p>
      )}
    </MapFrame>
  );
}
