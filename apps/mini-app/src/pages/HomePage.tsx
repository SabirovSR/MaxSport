import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, LEVEL_LABELS, SPORT_LABELS, type Lobby, type Venue } from "../api";

export function HomePage() {
  const [view, setView] = useState<"feed" | "map">("feed");
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [hotOnly, setHotOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.listLobbies({ hotOnly }),
      api.listVenuesMap(),
    ])
      .then(([lobbyData, venueData]) => {
        setLobbies(lobbyData.lobbies);
        setVenues(venueData.venues);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [hotOnly]);

  return (
    <>
      <div className="nav">
        <Button
          variant={view === "feed" ? "primary" : "secondary"}
          stretched
          onClick={() => setView("feed")}
        >
          Лента
        </Button>
        <Button
          variant={view === "map" ? "primary" : "secondary"}
          stretched
          onClick={() => setView("map")}
        >
          Карта
        </Button>
      </div>

      <div className="chips">
        <button
          className={`chip ${hotOnly ? "active" : ""}`}
          onClick={() => setHotOnly((v) => !v)}
        >
          🔥 Горящие слоты
        </button>
      </div>

      {loading && <p>Загрузка…</p>}
      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      {view === "map" && !loading && (
        <div className="map-panel">
          {venues.length === 0 && (
            <p style={{ color: "#888" }}>Площадки появятся после создания Лобби.</p>
          )}
          {venues.map((venue) => {
            const venueLobbies = lobbies.filter((l) => l.venue.id === venue.id);
            return (
              <div key={venue.id} className="map-pin">
                <strong>{venue.name}</strong>
                <p>{venue.address}</p>
                {venueLobbies.length === 0 ? (
                  <p style={{ color: "#888" }}>Нет открытых игр</p>
                ) : (
                  venueLobbies.map((lobby) => (
                    <Link
                      key={lobby.id}
                      to={`/lobby/${lobby.id}`}
                      style={{ color: "#c8f54a", display: "block", marginTop: 8 }}
                    >
                      {SPORT_LABELS[lobby.sport]} • {lobby.filledCount}/
                      {lobby.slotCount}
                    </Link>
                  ))
                )}
              </div>
            );
          })}
        </div>
      )}

      {view === "feed" && !loading && lobbies.length === 0 && (
        <div>
          <p>Пока нет открытых Лобби.</p>
          <Link to="/create">
            <Button stretched>Создать Лобби</Button>
          </Link>
        </div>
      )}

      {view === "feed" &&
        lobbies.map((lobby) => (
          <Link
            key={lobby.id}
            to={`/lobby/${lobby.id}`}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <article className="lobby-card">
              <h3>
                {SPORT_LABELS[lobby.sport] ?? lobby.sport} •{" "}
                {new Date(lobby.startAt).toLocaleString("ru-RU", {
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </h3>
              <p>
                {lobby.venue.name} • {LEVEL_LABELS[lobby.gameLevel]}
              </p>
              <div className="slot-grid" style={{ marginTop: 8 }}>
                {lobby.slots.slice(0, 8).map((slot) => (
                  <div
                    key={slot.id}
                    className={`slot ${slot.userId ? "filled" : slot.roleRequired ? "needed" : ""}`}
                  />
                ))}
              </div>
              <p>
                👥 {lobby.filledCount}/{lobby.slotCount}
                {lobby.slotCount - lobby.filledCount > 0 &&
                  ` • нужен ${lobby.slotCount - lobby.filledCount}`}
                {lobby.rentTotal > 0 && ` • ${lobby.splitPerPlayer} ₽/чел`}
              </p>
            </article>
          </Link>
        ))}
    </>
  );
}
