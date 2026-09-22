import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import {
  api,
  LEVEL_LABELS,
  ROLE_OPTIONS,
  SPORT_LABELS,
  type Lobby,
  type Passport,
} from "../api";
import { EmptyState, ErrorState, LineSkeleton } from "../components/States";
import { useToast } from "../components/Toast";
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
  const { userId: profileUserId } = useParams<{ userId: string }>();
  const isOwn = !profileUserId;
  const { showToast } = useToast();
  const [passport, setPassport] = useState<Passport | null>(null);
  const [nearest, setNearest] = useState<Lobby | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [marked, setMarked] = useState(false);
  const [skillSport, setSkillSport] = useState("volleyball");
  const [skillLevel, setSkillLevel] = useState("amateur");
  const [skillRoles, setSkillRoles] = useState<string[]>([]);
  const geo = useGeolocation();

  const photoUrl =
    passport?.user.photoUrl ??
    (isOwn ? window.WebApp?.initDataUnsafe?.user?.photo_url : undefined);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      api.getPassport(profileUserId),
      isOwn ? api.listMyLobbies() : Promise.resolve({ lobbies: [] as Lobby[] }),
    ])
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
  }, [isOwn, profileUserId]);

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
      showToast("Явка отмечена");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отметиться";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const skill = passport?.sportSkills.find(
      (item) => item.sport === skillSport
    );
    setSkillLevel(skill?.gameLevel ?? "amateur");
    setSkillRoles(skill?.preferredRoles ?? []);
  }, [passport, skillSport]);

  function toggleSkillRole(role: string) {
    setSkillRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : current.length < 4
          ? [...current, role]
          : current
    );
  }

  async function saveSkill() {
    setBusy(true);
    try {
      await api.saveSportSkill(skillSport, {
        gameLevel: skillLevel,
        preferredRoles: skillRoles,
      });
      refreshMe();
      load();
      showToast("Навык по спорту сохранён");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось сохранить навык";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSkill() {
    setBusy(true);
    try {
      await api.deleteSportSkill(skillSport);
      refreshMe();
      load();
      showToast("Вид спорта удалён из профиля", "info");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось удалить навык";
      setError(message);
      showToast(message, "error");
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
      <div
        style={{
          display: "flex",
          gap: "var(--ms-space-4)",
          alignItems: "center",
        }}
      >
        {photoUrl ? (
          <img
            className="avatar"
            src={photoUrl}
            alt=""
            width={56}
            height={56}
            style={{ width: 56, height: 56 }}
          />
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
            {passport.sportSkills.length > 0
              ? `${passport.sportSkills.length} видов спорта`
              : `Общий уровень: ${LEVEL_LABELS[passport.user.gameLevel]}`}
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

      <h3 className="section-title">Навыки по видам спорта</h3>
      {passport.sportSkills.length === 0 ? (
        <p className="muted">Отдельные спортивные навыки ещё не заполнены.</p>
      ) : (
        <div className="skill-list">
          {passport.sportSkills.map((skill) => (
            <div key={skill.sport} className="lobby-card">
              <h3>{SPORT_LABELS[skill.sport] ?? skill.sport}</h3>
              <p className="card-meta">
                {LEVEL_LABELS[skill.gameLevel] ?? skill.gameLevel}
                {skill.preferredRoles.length > 0
                  ? ` · ${skill.preferredRoles.join(", ")}`
                  : ""}
              </p>
            </div>
          ))}
        </div>
      )}

      {isOwn && (
        <div className="lobby-card">
          <h3>Настроить спортивный навык</h3>
          <div className="form-group">
            <label htmlFor="skill-sport">Вид спорта</label>
            <select
              id="skill-sport"
              value={skillSport}
              onChange={(event) => setSkillSport(event.target.value)}
            >
              {Object.entries(SPORT_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="skill-level">Уровень</label>
            <select
              id="skill-level"
              value={skillLevel}
              onChange={(event) => setSkillLevel(event.target.value)}
            >
              {Object.entries(LEVEL_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Предпочитаемые Амплуа (до 4)</label>
            <div className="chips">
              {(ROLE_OPTIONS[skillSport] ?? []).map((role) => (
                <button
                  key={role}
                  type="button"
                  className="chip"
                  aria-pressed={skillRoles.includes(role)}
                  onClick={() => toggleSkillRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
          <div className="request-actions">
            {passport.sportSkills.some(
              (skill) => skill.sport === skillSport
            ) && (
              <Button
                size="small"
                variant="secondary"
                loading={busy}
                onClick={deleteSkill}
              >
                Удалить
              </Button>
            )}
            <Button size="small" loading={busy} onClick={saveSkill}>
              Сохранить
            </Button>
          </div>
        </div>
      )}

      {isOwn && <h3 className="section-title">Ближайшая игра</h3>}
      {isOwn &&
        (nearest ? (
          <div className="lobby-card">
            <h3>
              {nearest.venue.name}, {formatStartAt(nearest.startAt)}
            </h3>
            <p className="card-meta">{nearest.venue.address}</p>

            <div
              style={{
                marginTop: "var(--ms-space-3)",
                display: "grid",
                gap: "var(--ms-space-2)",
              }}
            >
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
              <Link
                to={`/lobby/${nearest.id}`}
                className="chip"
                style={{ textAlign: "center" }}
              >
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
        ))}

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
