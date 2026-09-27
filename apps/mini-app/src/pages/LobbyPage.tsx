import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import {
  api,
  LEVEL_LABELS,
  SPORT_LABELS,
  type JoinRequest,
  type Lobby,
  type PaymentHold,
} from "../api";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { LobbyStatusBadge } from "../components/LobbyStatusBadge";
import { PlayerChip } from "../components/PlayerChip";
import { Sheet } from "../components/Sheet";
import { CardSkeleton, ErrorState } from "../components/States";
import { useToast } from "../components/Toast";
import { useMe } from "../lib/useMe";
import {
  formatMoney,
  formatSlots,
  formatStartAt,
  pluralSlots,
} from "../lib/format";
import { canEditLobby, canJoinLobby, canRateLobby } from "../lib/lobbyActions";
import {
  lobbyDeepLink,
  lobbyShareText,
  openLobbyShare,
} from "../lib/lobbyShare";
import {
  contactShareText,
  openMaxChat,
  shareContactMessage,
} from "../lib/maxContact";

const HOLD_LABELS: Record<string, string> = {
  hold_pending: "Ожидает залог",
  held: "Залог удерживается",
  charge_pending: "Списание",
  charged: "Списано",
  released: "Возвращён",
  forfeit: "Удержан за неявку",
};

function summarizeHolds(holds: PaymentHold[]) {
  const groups = new Map<
    string,
    { status: string; amount: number; count: number }
  >();
  for (const hold of holds) {
    const key = `${hold.status}:${hold.amount}`;
    const current = groups.get(key);
    if (current) current.count += 1;
    else {
      groups.set(key, {
        status: hold.status,
        amount: hold.amount,
        count: 1,
      });
    }
  }
  return [...groups.values()];
}

type PendingAction = "release-slot" | "cancel-lobby" | null;

export function LobbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { userId } = useMe();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [holds, setHolds] = useState<PaymentHold[]>([]);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [staticMapUrl, setStaticMapUrl] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [myRequest, setMyRequest] = useState<JoinRequest | null>(null);
  const [karmaRemaining, setKarmaRemaining] = useState(0);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    Promise.all([
      api.getLobby(id),
      api.listPayments(id).catch(() => ({ holds: [] })),
      api.getMyJoinRequest(id).catch(() => ({ request: null })),
      api.getKarmaStatus(id).catch(() => ({
        status: { open: false, remainingTargets: 0, votedTargetIds: [] },
      })),
    ])
      .then(([data, payments, requestData, karmaData]) => {
        setLobby(data.lobby);
        setMessageId(data.lobby.cardMessageId);
        setHolds(payments.holds);
        setMyRequest(requestData.request);
        setKarmaRemaining(
          karmaData.status.open ? karmaData.status.remainingTargets : 0
        );
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!id) return;
    return api.subscribeLobby(id, () => load());
  }, [id, load]);

  useEffect(() => {
    if (!lobby) return;
    let active = true;
    let objectUrl: string | null = null;
    setStaticMapUrl(null);
    api
      .getStaticMap(lobby.venue.lat, lobby.venue.lng)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setStaticMapUrl(objectUrl);
      })
      .catch(() => active && setStaticMapUrl(null));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [lobby?.venue.lat, lobby?.venue.lng]);

  function alreadyInLobby(current = lobby) {
    return Boolean(
      userId && current?.slots.some((slot) => slot.userId === userId)
    );
  }

  async function book(slotId: string) {
    if (!id || busy || !userId || alreadyInLobby()) return;
    setBusy(true);
    setError(null);
    try {
      const { lobby: updated } = await api.bookSlot(id, slotId);
      setLobby(updated);
      setPicking(false);
      showToast("Вы заняли слот");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось занять слот";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function requestJoin(slotId: string) {
    if (!id || busy || !userId || alreadyInLobby()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.requestJoin(id, slotId);
      setMyRequest(result.request);
      setPicking(false);
      showToast("Заявка отправлена организатору");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отправить заявку";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    if (!id) return;
    setBusy(true);
    try {
      await api.cancelJoinRequest(id);
      setMyRequest((current) =>
        current ? { ...current, status: "cancelled" } : null
      );
      showToast("Заявка отменена", "info");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отменить заявку";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function writeToOrganizer() {
    if (!id || !lobby) return;
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
      const text = contactShareText(link);
      void api.contactLobby(id).catch(() => undefined);
      openMaxChat({ username: lobby.organizer.username });
      const shared = await shareContactMessage(text, link);
      showToast(
        shared
          ? "Выберите чат с организатором"
          : "Текст скопирован — отправьте его организатору"
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Не удалось написать организатору";
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!id || !lobby) return;
    setBusy(true);
    setError(null);
    try {
      let mid = messageId;
      if (!mid && lobby.organizer.id === userId) {
        try {
          const result = await api.publishCard(id);
          mid = result.messageId;
          setMessageId(mid);
        } catch {
          mid = null;
        }
      }
      let botUsername = "gov_max_sport_bot";
      try {
        const config = await api.getConfig();
        if (config.botUsername) botUsername = config.botUsername;
      } catch {
        // без конфига всё равно соберём ссылку
      }
      const link = lobbyDeepLink(botUsername, id);
      const text = lobbyShareText({
        sport: SPORT_LABELS[lobby.sport] ?? lobby.sport,
        when: formatStartAt(lobby.startAt),
        venue: lobby.venue.name,
        link,
      });
      const mode = await openLobbyShare({ mid, text, link });
      showToast(
        mode === "clipboard"
          ? "Ссылка скопирована"
          : "Ссылка готова — выберите чат или вставьте из буфера"
      );
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось поделиться";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function collect() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await api.collectPayments(id);
      showToast("Залоги отправлены на списание");
      load();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось списать залоги";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function releaseMySlot() {
    if (!id || !mySlot) return;
    setBusy(true);
    setError(null);
    try {
      const { lobby: updated } = await api.releaseSlot(id, mySlot.id);
      setLobby(updated);
      setPendingAction(null);
      showToast("Вы покинули состав", "info");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отменить запись";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function cancelLobby() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const { lobby: updated } = await api.cancelLobby(id);
      setLobby(updated);
      setPendingAction(null);
      showToast("Лобби отменено", "info");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отменить лобби";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !lobby) return <ErrorState message={error} onRetry={load} />;
  if (!lobby) return <CardSkeleton count={2} />;

  const freeSlots = lobby.slots.filter((slot) => !slot.userId);
  const freeRoles = [
    ...new Set(freeSlots.map((slot) => slot.roleRequired ?? "Любое амплуа")),
  ];
  const mySlot = lobby.slots.find((slot) => slot.userId === userId);
  const isOrganizer = lobby.organizer.id === userId;
  const joinable = canJoinLobby(lobby.status);
  const requiresApproval = lobby.joinMode === "approval";
  const pendingRequest = myRequest?.status === "pending";
  const routeUrl = `https://yandex.ru/maps/?rtext=~${lobby.venue.lat},${lobby.venue.lng}&rtt=auto`;
  const confirmation =
    pendingAction === "release-slot"
      ? {
          title: "Покинуть состав?",
          description:
            "Слот снова станет свободным. При поздней отмене залог может быть удержан.",
          confirmLabel: "Покинуть",
          danger: true,
          onConfirm: releaseMySlot,
        }
      : {
          title: "Отменить лобби?",
          description:
            "Лобби будет закрыто для всех игроков. Это действие нельзя отменить.",
          confirmLabel: "Отменить лобби",
          danger: true,
          onConfirm: cancelLobby,
        };

  function join() {
    if (!userId || busy || alreadyInLobby()) return;
    if (freeRoles.length > 1) {
      setPicking(true);
      return;
    }
    const target = freeSlots.find((slot) => slot.roleRequired) ?? freeSlots[0];
    if (target) {
      void (requiresApproval ? requestJoin(target.id) : book(target.id));
    }
  }

  return (
    <>
      <h2 className="section-title">
        {SPORT_LABELS[lobby.sport] ?? lobby.sport},{" "}
        {formatStartAt(lobby.startAt)}
      </h2>
      <LobbyStatusBadge status={lobby.status} />

      <section className="venue-block">
        {staticMapUrl && (
          <img
            className="static-map"
            src={staticMapUrl}
            alt={`Карта: ${lobby.venue.address}`}
          />
        )}

        <div className="venue-block-copy">
          <strong>{lobby.venue.name}</strong>
          <p>{lobby.venue.address}</p>
          {LEVEL_LABELS[lobby.gameLevel] && (
            <p className="muted">{LEVEL_LABELS[lobby.gameLevel]}</p>
          )}
        </div>

        <a
          className="venue-route"
          href={routeUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            if (window.WebApp?.openLink) {
              event.preventDefault();
              window.WebApp.openLink(routeUrl);
            }
          }}
        >
          Маршрут в Яндекс Картах
        </a>
      </section>

      <div className="slot-list">
        {lobby.slots.map((slot) => (
          <div
            key={slot.id}
            className={`slot-row ${!slot.userId ? "is-open" : ""}`}
          >
            <span>
              {slot.roleRequired ?? `Слот ${slot.index + 1}`}
              {slot.userId === userId && " (вы)"}
            </span>
            {slot.userId ? (
              slot.occupant ? (
                <PlayerChip
                  player={slot.occupant}
                  suffix={slot.userId === userId ? " (вы)" : undefined}
                />
              ) : (
                <span className="muted">Участник</span>
              )
            ) : mySlot || pendingRequest || !userId ? (
              <span className="muted">Свободен</span>
            ) : (
              <Button
                size="small"
                loading={busy}
                disabled={!joinable || pendingRequest || busy}
                onClick={() =>
                  lobby.joinMode === "approval"
                    ? requestJoin(slot.id)
                    : book(slot.id)
                }
              >
                {lobby.joinMode === "approval" ? "Подать заявку" : "Занять"}
              </Button>
            )}
          </div>
        ))}
      </div>

      {!joinable && !mySlot && (
        <p className="form-hint">
          Запись недоступна: лобби находится в статусе выше.
        </p>
      )}

      {pendingRequest && (
        <div className="lobby-card">
          <h3>Заявка на рассмотрении</h3>
          <p className="card-meta">
            Организатор увидит её в ростере и подтвердит или отклонит.
          </p>
          <div style={{ marginTop: "var(--ms-space-3)" }}>
            <Button
              size="small"
              variant="secondary"
              loading={busy}
              onClick={cancelRequest}
            >
              Отменить заявку
            </Button>
          </div>
        </div>
      )}

      {lobby.rentTotal > 0 && (
        <div className="lobby-card">
          <h3>Сплит аренды</h3>
          <p className="card-meta">
            {formatMoney(lobby.rentTotal)} за зал,{" "}
            {formatSlots(lobby.slotCount, "nominative")}.
          </p>
          <p style={{ margin: "var(--ms-space-2) 0 0" }}>
            <strong>{formatMoney(lobby.splitPerPlayer)}</strong> с человека
          </p>
          {lobby.depositEnabled && (
            <p className="form-hint">
              При записи удерживается залог. Отмена за два часа возвращает его.
            </p>
          )}
          {holds.length > 0 && (
            <ul className="hold-list">
              {summarizeHolds(holds).map((group) => (
                <li key={`${group.status}-${group.amount}`}>
                  {HOLD_LABELS[group.status] ?? group.status}
                  {": "}
                  {formatMoney(group.amount)}
                  {group.count > 1 ? ` × ${group.count}` : ""}
                </li>
              ))}
            </ul>
          )}
          {isOrganizer && holds.some((hold) => hold.status === "held") && (
            <div style={{ marginTop: "var(--ms-space-3)" }}>
              <Button size="small" loading={busy} onClick={collect}>
                Списать залоги
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="sticky-bar">
        {isOrganizer &&
          lobby.status !== "cancelled" &&
          lobby.status !== "finished" && (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => setPendingAction("cancel-lobby")}
            >
              Отменить
            </Button>
          )}
        {isOrganizer && canEditLobby(lobby.status) && (
          <Button
            variant="secondary"
            onClick={() => navigate(`/lobby/${id}/edit`)}
          >
            Редактировать
          </Button>
        )}
        {isOrganizer &&
          lobby.status !== "cancelled" &&
          lobby.status !== "finished" && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/lobby/${id}/roster`)}
            >
              Ростер
            </Button>
          )}
        <Button variant="secondary" loading={busy} onClick={share}>
          Поделиться
        </Button>
        {!isOrganizer &&
          lobby.status !== "cancelled" &&
          lobby.status !== "finished" && (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => {
                void writeToOrganizer();
              }}
            >
              Написать
            </Button>
          )}
        {!mySlot && !pendingRequest && freeSlots.length > 0 && joinable && (
          <Button variant="primary" loading={busy} onClick={join}>
            {lobby.joinMode === "approval" ? "Отправить заявку" : "Занять слот"}
          </Button>
        )}
        {canRateLobby(lobby, Boolean(mySlot), karmaRemaining) && (
          <Button
            variant="primary"
            onClick={() => navigate(`/lobby/${id}/karma`)}
          >
            Оценить игроков ({karmaRemaining})
          </Button>
        )}
        {mySlot && !isOrganizer && (
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => setPendingAction("release-slot")}
          >
            Покинуть
          </Button>
        )}
      </div>

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        label="Выбор амплуа"
      >
        <h2 className="section-title">Какое амплуа берёте?</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Свободно {pluralSlots(freeSlots.length)}.
        </p>
        <div className="slot-list">
          {freeSlots.map((slot) => (
            <div key={slot.id} className="slot-row is-open">
              <span>{slot.roleRequired ?? "Любое амплуа"}</span>
              <Button
                size="small"
                loading={busy}
                onClick={() =>
                  lobby.joinMode === "approval"
                    ? requestJoin(slot.id)
                    : book(slot.id)
                }
              >
                Выбрать
              </Button>
            </div>
          ))}
        </div>
      </Sheet>

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
