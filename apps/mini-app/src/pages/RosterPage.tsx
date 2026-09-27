import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, type JoinRequest, type Lobby, type RosterEntry } from "../api";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { PlayerChip } from "../components/PlayerChip";
import { EmptyState, ErrorState, LineSkeleton } from "../components/States";
import { useToast } from "../components/Toast";
import { useMe } from "../lib/useMe";
import {
  contactShareText,
  openMaxChat,
  shareContactMessage,
} from "../lib/maxContact";
import { lobbyDeepLink } from "../lib/lobbyShare";
import { markableStatuses } from "../lib/presenceActions";

const STATUS_LABELS: Record<string, string> = {
  expected: "Ожидается",
  on_the_way: "В пути",
  on_site: "На месте",
  no_show: "Не пришёл",
  cancelled: "Отменил",
};

export function RosterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useMe();
  const { showToast } = useToast();
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "start-lobby" | "finish-lobby" | "kick-player" | null
  >(null);
  const [kickSlotId, setKickSlotId] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    Promise.all([api.getRoster(id), api.getLobby(id), api.listJoinRequests(id)])
      .then(([rosterData, lobbyData, requestData]) => {
        setRoster(rosterData.roster);
        setLobby(lobbyData.lobby);
        setRequests(requestData.requests);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!id) return;
    return api.subscribeLobby(id, () => {
      Promise.all([
        api.getRoster(id),
        api.listJoinRequests(id).catch(() => ({ requests: [] })),
      ])
        .then(([rosterData, requestData]) => {
          setRoster(rosterData.roster);
          setRequests(requestData.requests);
        })
        .catch(() => undefined);
    });
  }, [id]);

  async function mark(slotId: string, status: string) {
    setBusy(true);
    try {
      await api.markPresence(slotId, status);
      showToast("Статус явки обновлён");
      load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отметить";
      setError(message);
      showToast(message, "error");
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
      setPendingAction(null);
      showToast("Игра началась");
      load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось начать";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function notifyPlayers() {
    if (!id) return;
    setBusy(true);
    try {
      const { sent } = await api.notifyLobbyPlayers(id);
      showToast(
        sent === 1
          ? "Сообщение отправлено участнику"
          : `Сообщение отправлено ${sent} участникам`
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось написать всем";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function writeToPlayer(entry: RosterEntry) {
    if (!id) return;
    setBusy(true);
    try {
      let botUsername = "gov_max_sport_bot";
      try {
        const config = await api.getConfig();
        if (config.botUsername) botUsername = config.botUsername;
      } catch {
        // без конфига всё равно соберём ссылку
      }
      const link = lobbyDeepLink(botUsername, id);
      const text = contactShareText();
      void api.contactLobby(id, entry.userId).catch(() => undefined);
      openMaxChat({ username: entry.username });
      const shared = await shareContactMessage(text, link);
      showToast(
        shared
          ? "Выберите чат с игроком"
          : "Текст скопирован — отправьте его игроку"
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось открыть чат";
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function finishGame() {
    if (!id) return;
    setBusy(true);
    try {
      await api.finishLobby(id);
      setPendingAction(null);
      showToast("Игра завершена");
      navigate(`/lobby/${id}/karma`);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось завершить";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function accept(requestId: string) {
    if (!id) return;
    setBusy(true);
    try {
      await api.acceptJoinRequest(id, requestId);
      showToast("Игрок добавлен в состав");
      load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось принять заявку";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function reject(requestId: string) {
    if (!id) return;
    setBusy(true);
    try {
      await api.rejectJoinRequest(id, requestId);
      showToast("Заявка отклонена", "info");
      load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отклонить заявку";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function removePlayer() {
    if (!id || !kickSlotId) return;
    setBusy(true);
    try {
      await api.releaseSlot(id, kickSlotId);
      setPendingAction(null);
      setKickSlotId(null);
      showToast("Игрок удалён из состава", "info");
      load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось освободить слот";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !roster) return <ErrorState message={error} onRetry={load} />;
  if (!roster) return <LineSkeleton count={6} />;

  const onSite = roster.filter((entry) => entry.status === "on_site").length;
  const lateCancels = roster.filter((entry) => entry.status === "cancelled");
  const isOrganizer = lobby?.organizer.id === userId;
  const confirmation =
    pendingAction === "kick-player"
      ? {
          title: "Удалить игрока?",
          description:
            "Игрок потеряет место в составе, а слот снова станет свободным.",
          confirmLabel: "Удалить",
          danger: true,
          onConfirm: removePlayer,
        }
      : pendingAction === "finish-lobby"
        ? {
            title: "Завершить игру?",
            description:
              "После завершения откроется голосование за карму. Вернуться к ростеру будет нельзя.",
            confirmLabel: "Завершить",
            danger: true,
            onConfirm: finishGame,
          }
        : {
            title: "Начать игру?",
            description:
              "Лобби перейдёт в статус «Идёт игра». Проверьте явку перед началом.",
            confirmLabel: "Начинаем",
            danger: false,
            onConfirm: startGame,
          };

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

      {requests.length > 0 && (
        <section>
          <h3 className="section-title">Заявки ({requests.length})</h3>
          {requests.map((request) => (
            <div key={request.id} className="roster-item">
              <div className="roster-item-head">
                <PlayerChip player={request.player} />
                <div className="muted">
                  {request.roleRequired ?? "Любое амплуа"}
                </div>
              </div>
              <div className="request-actions">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => reject(request.id)}
                >
                  Отклонить
                </Button>
                <Button
                  size="small"
                  loading={busy}
                  onClick={() => accept(request.id)}
                >
                  Принять
                </Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {roster.length === 0 && (
        <EmptyState title="В составе пока никого">
          <p>Поделитесь карточкой чата, чтобы собрать игроков.</p>
        </EmptyState>
      )}

      {roster.map((entry) => (
        <div key={entry.slotId} className="roster-item">
          <div className="roster-item-head">
            <PlayerChip
              player={{
                id: entry.userId,
                firstName: entry.firstName,
                lastName: entry.lastName,
                photoUrl: entry.photoUrl,
              }}
            />
            <div className="muted">{entry.roleRequired ?? "Любое амплуа"}</div>
          </div>
          <div className={`roster-status status-${entry.status}`}>
            {STATUS_LABELS[entry.status] ?? entry.status}
          </div>
          <div className="roster-item-actions">
            {markableStatuses({
              entryUserId: entry.userId,
              actorUserId: userId,
              isOrganizer: Boolean(isOrganizer),
              current: entry.status,
            }).map((status) => (
              <button
                key={status}
                type="button"
                className="chip"
                disabled={busy}
                onClick={() => mark(entry.slotId, status)}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
            {entry.userId !== userId && (
              <button
                type="button"
                className="chip"
                onClick={() => writeToPlayer(entry)}
              >
                Написать
              </button>
            )}
            {entry.userId !== userId &&
              lobby &&
              ["open", "full", "gathering"].includes(lobby.status) && (
                <button
                  type="button"
                  className="chip chip-danger"
                  disabled={busy}
                  onClick={() => {
                    setKickSlotId(entry.slotId);
                    setPendingAction("kick-player");
                  }}
                >
                  Удалить
                </button>
              )}
          </div>
        </div>
      ))}

      {error && <p className="form-error">{error}</p>}

      <div className="sticky-bar">
        {lobby &&
          lobby.status !== "finished" &&
          lobby.status !== "cancelled" &&
          roster.some((entry) => entry.userId !== userId) && (
            <Button variant="secondary" loading={busy} onClick={notifyPlayers}>
              Написать всем
            </Button>
          )}
        {lobby?.status !== "started" && lobby?.status !== "finished" && (
          <Button
            variant="primary"
            loading={busy}
            onClick={() => setPendingAction("start-lobby")}
          >
            Начинаем
          </Button>
        )}
        {lobby?.status === "started" && (
          <Button
            variant="primary"
            loading={busy}
            onClick={() => setPendingAction("finish-lobby")}
          >
            Завершить
          </Button>
        )}
      </div>

      <ConfirmSheet
        open={pendingAction !== null}
        title={confirmation.title}
        description={confirmation.description}
        confirmLabel={confirmation.confirmLabel}
        danger={confirmation.danger}
        busy={busy}
        onConfirm={confirmation.onConfirm}
        onClose={() => setPendingAction(null)}
      />
    </>
  );
}
