import { useEffect, useRef, useState } from "react";
import { api, type GeoSuggestion, type Venue } from "../api";
import { VenueMap } from "./VenueMap";
import type { Position } from "../lib/useGeolocation";

export interface ResolvedVenue {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const DEBOUNCE_MS = 300;

/**
 * Replaces the previous prompt() flow, which pinned every new Площадка to the
 * centre of Moscow. Address text comes from Геосаджест, coordinates from the
 * Геокодер, and the pin stays draggable because a hall entrance is often not
 * where the geocoder puts it.
 */
export function VenuePicker({
  saved,
  near,
  value,
  onChange,
}: {
  saved: Venue[];
  near?: Position | null;
  value: ResolvedVenue | null;
  onChange: (venue: ResolvedVenue | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([]);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (value) return;
    const text = query.trim();
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    const id = ++requestId.current;
    const timer = setTimeout(() => {
      api
        .suggestPlaces(text, near ?? undefined)
        .then((data) => {
          // A slower earlier keystroke must not overwrite newer results.
          if (id === requestId.current) setSuggestions(data.suggestions);
        })
        .catch((cause: Error) => {
          if (id === requestId.current) setError(cause.message);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, near, value]);

  async function pick(suggestion: GeoSuggestion) {
    setResolving(true);
    setError(null);
    try {
      const { place } = await api.geocode(
        suggestion.uri
          ? { uri: suggestion.uri }
          : { query: suggestion.address ?? suggestion.title }
      );
      if (!place) {
        setError("Не удалось определить координаты этого адреса");
        return;
      }
      onChange({
        name: suggestion.title,
        address: place.address || suggestion.address || suggestion.title,
        lat: place.lat,
        lng: place.lng,
      });
      setSuggestions([]);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setResolving(false);
    }
  }

  if (value) {
    return (
      <div className="form-group">
        <label>Площадка</label>
        <div className="slot-row is-open">
          <div>
            <strong>{value.name}</strong>
            <p className="muted" style={{ margin: 0 }}>
              {value.address}
            </p>
          </div>
          <button
            type="button"
            className="chip"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
          >
            Изменить
          </button>
        </div>

        <div style={{ marginTop: "var(--ms-space-3)" }}>
          <VenueMap
            points={[]}
            height={220}
            zoom={16}
            center={{ lat: value.lat, lng: value.lng }}
            draggablePoint={{ lat: value.lat, lng: value.lng }}
            onDragEnd={(position) => onChange({ ...value, ...position })}
          />
          <p className="form-hint">
            Перетащите метку, если вход в зал в другом месте.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-group suggest">
      <label htmlFor="venue-search">Площадка</label>

      {saved.length > 0 && (
        <div className="chips">
          {saved.map((venue) => (
            <button
              key={venue.id}
              type="button"
              className="chip"
              onClick={() =>
                onChange({
                  name: venue.name,
                  address: venue.address,
                  lat: venue.lat,
                  lng: venue.lng,
                })
              }
            >
              {venue.name}
            </button>
          ))}
        </div>
      )}

      <input
        id="venue-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Название зала или адрес"
        autoComplete="off"
      />

      {resolving && <p className="form-hint">Определяем координаты…</p>}
      {error && <p className="form-error">{error}</p>}

      {suggestions.length > 0 && (
        <ul className="suggest-list">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.uri ?? suggestion.title}-${index}`}>
              <button type="button" onClick={() => pick(suggestion)}>
                {suggestion.title}
                {suggestion.subtitle && <small>{suggestion.subtitle}</small>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length >= 3 &&
        suggestions.length === 0 &&
        !resolving &&
        !error && <p className="form-hint">Ничего не нашлось.</p>}
    </div>
  );
}
