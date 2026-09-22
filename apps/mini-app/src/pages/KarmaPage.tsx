import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, type Lobby, type RosterEntry } from "../api";
import { EmptyState, ErrorState, LineSkeleton } from "../components/States";
import { useToast } from "../components/Toast";
import { refreshMe, useMe } from "../lib/useMe";
import { initialsOf } from "../lib/format";

const TAGS_BY_SPORT: Record<string, string[]> = {
  volleyball: ["отличный командный", "крутой пас", "пушечный удар"],
  mini_football: ["надёжный вратарь", "точный пас", "быстрый форвард"],
  basketball: ["точный бросок", "жёсткая защита", "отличный пас"],
  padel_tennis: ["сильная подача", "точный удар", "хорошая игра у сетки"],
  floorball: ["точный пас", "сильный бросок", "цепкая защита"],
  ice_hockey: ["точный пас", "сильный бросок", "надёжная защита"],
  water_polo: ["точная передача", "сильный бросок", "плотная защита"],
  table_tennis: ["сильная подача", "точное вращение", "надёжный партнёр"],
  airsoft: ["тактичный игрок", "точный стрелок", "надёжный напарник"],
  paintball: ["быстрый прорыв", "точная стрельба", "командная игра"],
};

const RELIABILITY = [
  { value: "on_time", label: "Пришёл вовремя" },
  { value: "late", label: "Опоздал" },
  { value: "no_show", label: "Не пришёл" },
] as const;

type Reliability = (typeof RELIABILITY)[number]["value"];

/** Presence already knows who showed up, so the vote starts pre-filled. */
function suggestedReliability(status: string): Reliability {
  if (status === "on_site") return "on_time";
  if (status === "no_show" || status === "cancelled") return "no_show";
  return "late";
}

export function KarmaPage() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useMe();
  const { showToast } = useToast();
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [voted, setVoted] = useState<Record<string, true>>({});
  const [choices, setChoices] = useState<
    Record<string, { reliability: Reliability; tag?: string }>
  >({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    Promise.all([api.getRoster(id), api.getLobby(id), api.getKarmaStatus(id)])
      .then(([rosterData, lobbyData, statusData]) => {
        setRoster(rosterData.roster);
        setLobby(lobbyData.lobby);
        setVoted(
          Object.fromEntries(
            statusData.status.votedTargetIds.map((targetId) => [targetId, true])
          )
        );
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id]);

  useEffect(load, [load]);

  async function vote(entry: RosterEntry) {
    if (!id) return;
    const choice = choices[entry.userId] ?? {
      reliability: suggestedReliability(entry.status),
    };
    setBusy(entry.userId);
    setError(null);
    try {
      await api.submitKarma({
        targetId: entry.userId,
        lobbyId: id,
        reliability: choice.reliability,
        tag: choice.tag,
      });
      refreshMe();
      setVoted((current) => ({ ...current, [entry.userId]: true }));
      showToast("Оценка отправлена");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отправить";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(null);
    }
  }

  if (error && !roster) return <ErrorState message={error} onRetry={load} />;
  if (!roster) return <LineSkeleton count={5} />;

  const tags = TAGS_BY_SPORT[lobby?.sport ?? "volleyball"] ?? [];
  // Нет самоголосованию: PRODUCT §4.7.
  const others = roster.filter((entry) => entry.userId !== userId);
  const remaining = others.filter((entry) => !voted[entry.userId]);

  if (others.length === 0) {
    return (
      <EmptyState title="Оценивать некого">
        <Link to="/passport">
          <Button>В Игровой паспорт</Button>
        </Link>
      </EmptyState>
    );
  }

  if (remaining.length === 0) {
    return (
      <EmptyState title="Спасибо, Карма обновлена">
        <p>Бейдж «Спасатель матча» начисляется автоматически.</p>
        <Link to="/passport">
          <Button>В Игровой паспорт</Button>
        </Link>
      </EmptyState>
    );
  }

  return (
    <>
      <h2 className="section-title">Как сыграли?</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Осталось оценить: {remaining.length}. Надёжность подставлена из Явки.
      </p>

      {remaining.map((entry) => (
        <div key={entry.userId} className="lobby-card">
          <div
            style={{
              display: "flex",
              gap: "var(--ms-space-3)",
              alignItems: "center",
            }}
          >
            {entry.photoUrl ? (
              <img className="avatar" src={entry.photoUrl} alt="" />
            ) : (
              <span className="avatar">
                {initialsOf(entry.firstName, entry.lastName)}
              </span>
            )}
            <div>
              <strong>
                {entry.firstName} {entry.lastName ?? ""}
              </strong>
              <div className="muted">
                {entry.roleRequired ?? "Любое амплуа"}
              </div>
            </div>
          </div>

          <div className="chips" style={{ marginTop: "var(--ms-space-3)" }}>
            {RELIABILITY.map((option) => (
              <button
                key={option.value}
                type="button"
                className="chip"
                aria-pressed={
                  (choices[entry.userId]?.reliability ??
                    suggestedReliability(entry.status)) === option.value
                }
                disabled={busy === entry.userId}
                onClick={() =>
                  setChoices((current) => ({
                    ...current,
                    [entry.userId]: {
                      ...current[entry.userId],
                      reliability: option.value,
                    },
                  }))
                }
              >
                {option.label}
              </button>
            ))}
          </div>

          {tags.length > 0 && (
            <>
              <p className="form-hint">Отметить за игру:</p>
              <div className="chips" style={{ marginBottom: 0 }}>
                {tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="chip"
                    aria-pressed={choices[entry.userId]?.tag === tag}
                    disabled={busy === entry.userId}
                    onClick={() =>
                      setChoices((current) => ({
                        ...current,
                        [entry.userId]: {
                          reliability:
                            current[entry.userId]?.reliability ??
                            suggestedReliability(entry.status),
                          tag:
                            current[entry.userId]?.tag === tag
                              ? undefined
                              : tag,
                        },
                      }))
                    }
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </>
          )}
          <div style={{ marginTop: "var(--ms-space-3)" }}>
            <Button
              stretched
              loading={busy === entry.userId}
              disabled={busy !== null && busy !== entry.userId}
              onClick={() => vote(entry)}
            >
              Отправить оценку
            </Button>
          </div>
        </div>
      ))}

      {error && <p className="form-error">{error}</p>}
    </>
  );
}
