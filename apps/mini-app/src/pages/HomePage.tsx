import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import {
  api,
  LEVEL_LABELS,
  SPORT_LABELS,
  type Lobby,
  type MyLobby,
  type Venue,
} from "../api";
import { VenueMap, type MapPoint } from "../components/VenueMap";
import { SlotMatrix } from "../components/SlotMatrix";
import { Sheet } from "../components/Sheet";
import { LobbyStatusBadge } from "../components/LobbyStatusBadge";
import { CardSkeleton, EmptyState, ErrorState } from "../components/States";
import { useGeolocation } from "../lib/useGeolocation";
import { useMe } from "../lib/useMe";
import { useRefreshOnFocus } from "../lib/useRefreshOnFocus";
import { sortLobbies, type LobbySortMode as SortMode } from "../lib/lobbySort";
import {
  formatDistance,
  formatMoney,
  formatStartAt,
  forgetSport,
  pluralSlots,
  readMySports,
  rememberSport,
} from "../lib/format";

const SPORTS = Object.keys(SPORT_LABELS);

function LobbyCard({
  lobby,
  mine,
}: {
  lobby: Lobby | MyLobby;
  mine?: boolean;
}) {
  const free = lobby.slotCount - lobby.filledCount;
  const distance = formatDistance(lobby.distanceM);
  const neededRole = lobby.slots.find((s) => !s.userId && s.roleRequired);
  const myLobby = mine && "karmaPending" in lobby ? lobby : null;

  return (
    <Link to={`/lobby/${lobby.id}`} className="lobby-card">
      <div className="card-head">
        <div>
          <h3>
            {SPORT_LABELS[lobby.sport] ?? lobby.sport},{" "}
            {formatStartAt(lobby.startAt)}
          </h3>
          <p className="card-meta">
            {lobby.venue.name}
            {distance ? `, ${distance}` : ""}
            {myLobby
              ? ` · ${myLobby.myRole === "organizer" ? "организатор" : "игрок"}`
              : ""}
          </p>
        </div>
        <span className={`count-pill ${free === 0 ? "is-full" : ""}`}>
          {lobby.filledCount}/{lobby.slotCount}
        </span>
      </div>
      <LobbyStatusBadge status={lobby.status} />
      {myLobby?.karmaPending && <p className="hot-flag">Оцените игроков</p>}

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
          <span className="muted">
            {formatMoney(lobby.splitPerPlayer)} с человека
          </span>
        )}
      </div>
    </Link>
  );
}

export function HomePage() {
  const { me } = useMe();
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [view, setView] = useState<"feed" | "map">("feed");
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [sport, setSport] = useState<string | null>(null);
  const [gameLevel, setGameLevel] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("time");
  const [hotOnly, setHotOnly] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [mySportsOnly, setMySportsOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
  const [mySports, setMySports] = useState(readMySports);

  const geo = useGeolocation();
  const position = geo.position;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      scope === "mine"
        ? api.listMyLobbies()
        : api.listLobbies({
            sport: sport ?? undefined,
            gameLevel: gameLevel ?? undefined,
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
  }, [
    scope,
    sport,
    gameLevel,
    hotOnly,
    nearbyOnly,
    position?.lat,
    position?.lng,
  ]);

  useEffect(load, [load]);
  useRefreshOnFocus(load);

  useEffect(() => {
    if (me) setMySports(me.sportSkills.map((skill) => skill.sport));
  }, [me?.sportSkills]);

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

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = lobbies.filter((lobby) => {
      if (
        mySportsOnly &&
        mySports.length > 0 &&
        !mySports.includes(lobby.sport)
      ) {
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
    return sortLobbies(filtered, sortMode);
  }, [lobbies, mySports, mySportsOnly, query, sortMode]);

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
  const sheetLobbies = visible.filter(
    (lobby) => lobby.venue.id === selectedVenue
  );

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

      <div className="segmented" role="tablist" aria-label="Раздел игр">
        <button
          type="button"
          role="tab"
          aria-selected={scope === "all"}
          onClick={() => setScope("all")}
        >
          Все игры
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === "mine"}
          onClick={() => setScope("mine")}
        >
          Мои игры
        </button>
      </div>

      {scope === "all" && (
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
            onClick={() => {
              const enabling = !mySportsOnly;
              if (enabling) setSport(null);
              setMySportsOnly(enabling);
            }}
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
                const enabling = sport !== code;
                if (enabling) rememberSport(code);
                else forgetSport(code);
                setMySports(readMySports());
                setMySportsOnly(false);
                setSport(enabling ? code : null);
              }}
            >
              {SPORT_LABELS[code]}
            </button>
          ))}
        </div>
      )}

      {scope === "all" && (
        <div className="filter-selects">
          <label>
            <span>Уровень</span>
            <select
              value={gameLevel ?? ""}
              onChange={(event) => setGameLevel(event.target.value || null)}
            >
              <option value="">Любой</option>
              {Object.entries(LEVEL_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Сортировка</span>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
            >
              <option value="time">По времени</option>
              <option value="distance">По расстоянию</option>
              <option value="cost">По стоимости</option>
              <option value="free">По свободным слотам</option>
            </select>
          </label>
        </div>
      )}

      {scope === "all" && mySportsOnly && mySports.length === 0 && (
        <p className="muted" style={{ marginBottom: "var(--ms-space-3)" }}>
          Отметьте виды спорта чипами ниже. Они запомнятся для этого фильтра.
        </p>
      )}

      {scope === "all" &&
        geo.state.status === "denied" &&
        nearbyOnly === false && (
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

      {view === "feed" && (
        <button
          type="button"
          className="feed-refresh"
          disabled={loading}
          onClick={load}
        >
          <span aria-hidden="true" className={loading ? "is-spinning" : ""}>
            ↻
          </span>
          {loading ? "Обновляем…" : "Обновить ленту"}
        </button>
      )}

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
        <EmptyState
          title={scope === "mine" ? "У вас пока нет игр" : "Открытых Лобби нет"}
        >
          <p>
            {scope === "mine"
              ? "Запишитесь в состав или создайте своё Лобби."
              : "Ослабьте фильтры или соберите игру сами."}
          </p>
          <Link to="/create">
            <Button>Создать Лобби</Button>
          </Link>
        </EmptyState>
      )}

      {!error &&
        !loading &&
        view === "feed" &&
        visible.map((lobby) => (
          <LobbyCard key={lobby.id} lobby={lobby} mine={scope === "mine"} />
        ))}

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
