import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, type Lobby, type RosterEntry } from "../api";
import { EmptyState, ErrorState, LineSkeleton } from "../components/States";
import { initialsOf } from "../lib/format";

const STATUS_LABELS: Record<string, string> = {
  expected: "Ожидается",
  on_the_way: "В пути",
  on_site: "На месте",
  no_show: "Не пришёл",
  cancelled: "Отменил",
};

const MARKABLE = ["on_site", "on_the_way", "no_show"] as const;

export function RosterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    Promise.all([api.getRoster(id), api.getLobby(id)])
      .then(([rosterData, lobbyData]) => {
        setRoster(rosterData.roster);
        setLobby(lobbyData.lobby);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id]);

  useEffect(load, [load]);

  // The card and the lobby both publish on the same channel, so any booking or
  // presence change reaches the organiser without a manual refresh.
  useEffect(() => {
    if (!id) return;
    return api.subscribeLobby(id, () => {
      api
        .getRoster(id)
        .then((data) => setRoster(data.roster))
        .catch(() => undefined);
    });
  }, [id]);

  async function mark(slotId: string, status: string) {
    setBusy(true);
    try {
      await api.markPresence(slotId, status);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отметить");
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (!id) return;
    setBusy(true);
    try {
      const { lobby: updated } = await api.startLobby(id);
      setLobby(updated);
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось начать");
    } finally {
      setBusy(false);
    }
  }

  async function finishGame() {
    if (!id) return;
    setBusy(true);
    try {
      await api.finishLobby(id);
      navigate(`/lobby/${id}/karma`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось завершить");
    } finally {
      setBusy(false);
    }
  }

  if (error && !roster) return <ErrorState message={error} onRetry={load} />;
  if (!roster) return <LineSkeleton count={6} />;

  const onSite = roster.filter((entry) => entry.status === "on_site").length;
  const lateCancels = roster.filter((entry) => entry.status === "cancelled");

  return (
    <>
      <h2 className="section-title">Ростер</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        На месте {onSite} из {roster.length}
      </p>

      {lateCancels.length > 0 && (
        <p className="form-error">
          Снялись перед игрой: {lateCancels.length}. Слоты снова открыты.
        </p>
      )}

      {roster.length === 0 && (
        <EmptyState title="В составе пока никого">
          <p>Поделитесь Карточкой чата, чтобы собрать Игроков.</p>
        </EmptyState>
      )}

      {roster.map((entry) => (
        <div key={entry.slotId} className="roster-item">
          <div style={{ display: "flex", gap: "var(--ms-space-3)", alignItems: "center" }}>
            <span className="avatar">
              {initialsOf(entry.firstName, entry.lastName)}
            </span>
            <div>
              <strong>
                {entry.firstName} {entry.lastName ?? ""}
              </strong>
              <div className="muted">{entry.roleRequired ?? "Любое амплуа"}</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className={`status-${entry.status}`}>
              {STATUS_LABELS[entry.status] ?? entry.status}
            </div>
            <div className="chips" style={{ marginTop: 4, marginBottom: 0 }}>
              {MARKABLE.filter((status) => status !== entry.status).map(
                (status) => (
                  <button
                    key={status}
                    type="button"
                    className="chip"
                    disabled={busy}
                    onClick={() => mark(entry.slotId, status)}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      ))}

      {error && <p className="form-error">{error}</p>}

      <div className="sticky-bar">
        {lobby?.status !== "started" && lobby?.status !== "finished" && (
          <Button variant="primary" loading={busy} onClick={startGame}>
            Начинаем
          </Button>
        )}
        {lobby?.status === "started" && (
          <Button variant="primary" loading={busy} onClick={finishGame}>
            Завершить
          </Button>
        )}
      </div>
    </>
  );
}
