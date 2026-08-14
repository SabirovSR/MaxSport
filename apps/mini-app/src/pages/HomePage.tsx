import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import {
  api,
  LEVEL_LABELS,
  SPORT_LABELS,
  type Lobby,
  type Venue,
} from "../api";
import { VenueMap, type MapPoint } from "../components/VenueMap";
import { SlotMatrix } from "../components/SlotMatrix";
import { Sheet } from "../components/Sheet";
import { CardSkeleton, EmptyState, ErrorState } from "../components/States";
import { useGeolocation } from "../lib/useGeolocation";
import {
  formatDistance,
  formatMoney,
  formatStartAt,
  pluralSlots,
  readMySports,
  rememberSport,
} from "../lib/format";

const SPORTS = Object.keys(SPORT_LABELS);

function LobbyCard({ lobby }: { lobby: Lobby }) {
  const free = lobby.slotCount - lobby.filledCount;
  const distance = formatDistance(lobby.distanceM);
  const neededRole = lobby.slots.find((s) => !s.userId && s.roleRequired);

  return (
    <Link to={`/lobby/${lobby.id}`} className="lobby-card">
      <div className="card-head">
        <div>
          <h3>
            {SPORT_LABELS[lobby.sport] ?? lobby.sport}, {formatStartAt(lobby.startAt)}
          </h3>
          <p className="card-meta">
            {lobby.venue.name}
            {distance ? `, ${distance}` : ""}
          </p>
        </div>
        <span className={`count-pill ${free === 0 ? "is-full" : ""}`}>
          {lobby.filledCount}/{lobby.slotCount}
        </span>
      </div>

      <SlotMatrix slots={lobby.slots} limit={12} />

      <div className="card-foot">
        {free === 0 ? (
          <span>Состав собран</span>
        ) : neededRole ? (
          <span className="hot-flag">Нужен {neededRole.roleRequired}</span>
        ) : (
          <span>Осталось {pluralSlots(free)}</span>
        )}
        <span className="muted">{LEVEL_LABELS[lobby.gameLevel]}</span>
        {lobby.rentTotal > 0 && (
          <span className="muted">{formatMoney(lobby.splitPerPlayer)} с человека</span>
        )}
      </div>
    </Link>
  );
}

export function HomePage() {
  const [view, setView] = useState<"feed" | "map">("feed");
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [sport, setSport] = useState<string | null>(null);
  const [hotOnly, setHotOnly] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [mySportsOnly, setMySportsOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

  const geo = useGeolocation();
  const position = geo.position;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.listLobbies({
        sport: mySportsOnly ? undefined : (sport ?? undefined),
        hotOnly,
        nearbyOnly,
        lat: position?.lat,
        lng: position?.lng,
      }),
      api.listVenuesMap(),
    ])
      .then(([lobbyData, venueData]) => {
        setLobbies(lobbyData.lobbies);
        setVenues(venueData.venues);
      })
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [sport, hotOnly, nearbyOnly, mySportsOnly, position?.lat, position?.lng]);

  useEffect(load, [load]);

  // "Рядом" needs a position, so asking for one is folded into the toggle
  // rather than prompting on first open.
  const toggleNearby = async () => {
    if (nearbyOnly) {
      setNearbyOnly(false);
      return;
    }
    const granted = position ?? (await geo.request());
    if (granted) setNearbyOnly(true);
  };

  const mySports = readMySports();
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return lobbies.filter((lobby) => {
      if (mySportsOnly && mySports.length > 0 && !mySports.includes(lobby.sport)) {
        return false;
      }
      if (!needle) return true;
      const hay = [
        lobby.venue.name,
        lobby.venue.address,
        SPORT_LABELS[lobby.sport] ?? lobby.sport,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [lobbies, mySports, mySportsOnly, query]);

  const points: MapPoint[] = useMemo(() => {
    const lobbiesByVenue = new Map<string, Lobby[]>();
    for (const lobby of visible) {
      const list = lobbiesByVenue.get(lobby.venue.id) ?? [];
      list.push(lobby);
      lobbiesByVenue.set(lobby.venue.id, list);
    }
    return venues
      .filter((venue) => lobbiesByVenue.has(venue.id))
      .map((venue) => {
        const venueLobbies = lobbiesByVenue.get(venue.id) ?? [];
        const hasHot = venueLobbies.some(
          (lobby) => lobby.slotCount - lobby.filledCount > 0
        );
        return {
          id: venue.id,
          lat: venue.lat,
          lng: venue.lng,
          label: String(venueLobbies.length),
          highlighted: hasHot,
        };
      });
  }, [visible, venues]);

  const sheetVenue = venues.find((venue) => venue.id === selectedVenue) ?? null;
  const sheetLobbies = visible.filter((lobby) => lobby.venue.id === selectedVenue);

  return (
    <>
      <label className="search" htmlFor="lobby-search">
        <span className="visually-hidden">Поиск по площадке</span>
        <input
          id="lobby-search"
          type="search"
          value={query}
          placeholder="Площадка или вид спорта"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className="chips" role="group" aria-label="Фильтры">
        <button
          type="button"
          className="chip"
          aria-pressed={hotOnly}
          onClick={() => setHotOnly((value) => !value)}
        >
          Горящие слоты
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={nearbyOnly}
          onClick={toggleNearby}
          disabled={geo.state.status === "pending"}
        >
          {geo.state.status === "pending" ? "Определяем…" : "Рядом"}
        </button>
        <button
          type="button"
          className="chip"
          aria-pressed={mySportsOnly}
          onClick={() => setMySportsOnly((value) => !value)}
        >
          Мои виды спорта
        </button>
        {SPORTS.map((code) => (
          <button
            key={code}
            type="button"
            className="chip"
            aria-pressed={sport === code}
            onClick={() => {
              rememberSport(code);
              setSport((value) => (value === code ? null : code));
            }}
          >
            {SPORT_LABELS[code]}
          </button>
        ))}
      </div>

      {mySportsOnly && mySports.length === 0 && (
        <p className="muted" style={{ marginBottom: "var(--ms-space-3)" }}>
          Отметьте виды спорта чипами ниже. Они запомнятся для этого фильтра.
        </p>
      )}

      {geo.state.status === "denied" && nearbyOnly === false && (
        <p className="muted" style={{ marginBottom: "var(--ms-space-3)" }}>
          {geo.state.reason}. Фильтр «Рядом» недоступен.
        </p>
      )}

      <div className="chips" role="tablist" aria-label="Вид">
        <button
          type="button"
          role="tab"
          className="chip"
          aria-pressed={view === "feed"}
          aria-selected={view === "feed"}
          onClick={() => setView("feed")}
        >
          Лента
        </button>
        <button
          type="button"
          role="tab"
          className="chip"
          aria-pressed={view === "map"}
          aria-selected={view === "map"}
          onClick={() => setView("map")}
        >
          Карта
        </button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && loading && <CardSkeleton />}

      {!error && !loading && view === "map" && (
        <VenueMap
          points={points}
          center={position ?? undefined}
          zoom={position ? 13 : 11}
          height={360}
          onSelect={setSelectedVenue}
          emptyHint="Открытых Лобби на карте пока нет."
        />
      )}

      {!error && !loading && view === "feed" && visible.length === 0 && (
        <EmptyState title="Открытых Лобби нет">
          <p>Ослабьте фильтры или соберите игру сами.</p>
          <Link to="/create">
            <Button>Создать Лобби</Button>
          </Link>
        </EmptyState>
      )}

      {!error && !loading && view === "feed" &&
        visible.map((lobby) => <LobbyCard key={lobby.id} lobby={lobby} />)}

      <Sheet
        open={sheetVenue !== null}
        onClose={() => setSelectedVenue(null)}
        label="Площадка"
      >
        {sheetVenue && (
          <>
            <h2 className="section-title">{sheetVenue.name}</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              {sheetVenue.address}
            </p>
            <div style={{ marginTop: "var(--ms-space-4)" }}>
              {sheetLobbies.map((lobby) => (
                <LobbyCard key={lobby.id} lobby={lobby} />
              ))}
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
