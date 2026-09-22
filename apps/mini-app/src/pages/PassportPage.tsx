import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, LEVEL_LABELS, type Lobby, type Passport } from "../api";
import { EmptyState, ErrorState, LineSkeleton } from "../components/States";
import { useGeolocation } from "../lib/useGeolocation";
import { formatStartAt, initialsOf } from "../lib/format";
import { refreshMe } from "../lib/useMe";

/** Окно Явки: PRODUCT §4.6 opens it at T−20 and closes it at T+15. */
const WINDOW_OPENS_MS = -20 * 60 * 1000;
const WINDOW_CLOSES_MS = 15 * 60 * 1000;

function presenceWindow(startAt: string) {
  const delta = Date.now() - new Date(startAt).getTime();
  return delta >= WINDOW_OPENS_MS && delta <= WINDOW_CLOSES_MS;
}

export function PassportPage() {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [nearest, setNearest] = useState<Lobby | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marked, setMarked] = useState(false);
  const geo = useGeolocation();

  const photoUrl = window.WebApp?.initDataUnsafe?.user?.photo_url;

  const load = useCallback(() => {
    setError(null);
    Promise.all([api.getPassport(), api.listLobbies()])
      .then(([passportData, lobbiesData]) => {
        setPassport(passportData.passport);
        const userId = passportData.passport.user.id;
        // Only a lobby the player actually occupies can be checked into.
        const mine = lobbiesData.lobbies
          .filter((lobby) => lobby.slots.some((slot) => slot.userId === userId))
          .sort((a, b) => a.startAt.localeCompare(b.startAt));
        setNearest(mine[0] ?? null);
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  useEffect(load, [load]);

  async function markOnSite() {
    if (!nearest || !passport) return;
    const mySlot = nearest.slots.find(
      (slot) => slot.userId === passport.user.id
    );
    if (!mySlot) return;

    setBusy(true);
    setError(null);
    try {
      // Geo is an enhancement: a refusal still allows the one tap confirmation.
      const position = geo.position ?? (await geo.request());
      await api.confirmOnSite(mySlot.id, position ?? undefined);
      refreshMe();
      load();
      setMarked(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отметиться");
    } finally {
      setBusy(false);
    }
  }

  if (error && !passport) return <ErrorState message={error} onRetry={load} />;
  if (!passport) return <LineSkeleton count={5} />;

  const name = [passport.user.firstName, passport.user.lastName]
    .filter(Boolean)
    .join(" ");
  const windowOpen = nearest ? presenceWindow(nearest.startAt) : false;

  return (
    <>
      <div style={{ display: "flex", gap: "var(--ms-space-4)", alignItems: "center" }}>
        {photoUrl ? (
          <img className="avatar" src={photoUrl} alt="" width={56} height={56} style={{ width: 56, height: 56 }} />
        ) : (
          <span className="avatar" style={{ width: 56, height: 56 }}>
            {initialsOf(passport.user.firstName, passport.user.lastName)}
          </span>
        )}
        <div>
          <h2 className="section-title" style={{ marginBottom: 2 }}>
            {name}
          </h2>
          <p className="muted" style={{ margin: 0 }}>
            {LEVEL_LABELS[passport.user.gameLevel]}
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <div>
          <strong>{passport.user.reliabilityPct}%</strong>
          <small>Надёжность</small>
        </div>
        <div>
          <strong>{passport.user.gamesPlayed}</strong>
          <small>Игр</small>
        </div>
        <div>
          <strong>{passport.attendancePct}%</strong>
          <small>Явка</small>
        </div>
      </div>

      <h3 className="section-title">Ближайшая игра</h3>
      {nearest ? (
        <div className="lobby-card">
          <h3>
            {nearest.venue.name}, {formatStartAt(nearest.startAt)}
          </h3>
          <p className="card-meta">{nearest.venue.address}</p>

          <div style={{ marginTop: "var(--ms-space-3)", display: "grid", gap: "var(--ms-space-2)" }}>
            {marked ? (
              <p className="status-on_site" style={{ margin: 0 }}>
                Явка отмечена.
              </p>
            ) : windowOpen ? (
              <Button variant="primary" loading={busy} onClick={markOnSite}>
                Я на месте
              </Button>
            ) : (
              <p className="form-hint" style={{ margin: 0 }}>
                Кнопка «Я на месте» появится за 20 минут до начала.
              </p>
            )}
            <Link to={`/lobby/${nearest.id}`} className="chip" style={{ textAlign: "center" }}>
              Открыть Лобби
            </Link>
          </div>
        </div>
      ) : (
        <EmptyState title="Вы пока никуда не записаны">
          <Link to="/">
            <Button>Найти игру</Button>
          </Link>
        </EmptyState>
      )}

      <h3 className="section-title" style={{ marginTop: "var(--ms-space-6)" }}>
        Бейджи
      </h3>
      {passport.badges.length === 0 ? (
        <p className="muted">Бейджи появятся после сыгранных матчей.</p>
      ) : (
        passport.badges.map((badge) => (
          <span key={badge.code} className="badge" title={badge.description}>
            {badge.title}
          </span>
        ))
      )}

      {error && <p className="form-error">{error}</p>}
    </>
  );
}
