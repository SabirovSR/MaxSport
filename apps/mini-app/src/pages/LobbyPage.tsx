import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, LEVEL_LABELS, SPORT_LABELS, type Lobby, type PaymentHold } from "../api";
import { Sheet } from "../components/Sheet";
import { CardSkeleton, ErrorState } from "../components/States";
import { useMe } from "../lib/useMe";
import { formatMoney, formatStartAt, pluralSlots } from "../lib/format";

const HOLD_LABELS: Record<string, string> = {
  hold_pending: "Ожидает залог",
  held: "Залог удерживается",
  charge_pending: "Списание",
  charged: "Списано",
  released: "Возвращён",
  forfeit: "Удержан за неявку",
};

export function LobbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useMe();

  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [holds, setHolds] = useState<PaymentHold[]>([]);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [staticMapUrl, setStaticMapUrl] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!id) return;
    setError(null);
    Promise.all([api.getLobby(id), api.listPayments(id).catch(() => ({ holds: [] }))])
      .then(([data, payments]) => {
        setLobby(data.lobby);
        setMessageId(data.lobby.cardMessageId);
        setHolds(payments.holds);
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!id) return;
    return api.subscribeLobby(id, setLobby);
  }, [id]);

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

  async function book(slotId: string) {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const { lobby: updated } = await api.bookSlot(id, slotId);
      setLobby(updated);
      setPicking(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось занять Слот");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      let mid = messageId;
      if (!mid) {
        const result = await api.publishCard(id);
        mid = result.messageId;
        setMessageId(mid);
      }
      if (window.WebApp?.shareMaxContent && mid) {
        window.WebApp.shareMaxContent({ mid });
      } else {
        setError("Поделиться Карточкой чата можно только внутри MAX");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось поделиться");
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
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось списать залоги");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const { lobby: updated } = await api.cancelLobby(id);
      setLobby(updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отменить Лобби");
    } finally {
      setBusy(false);
    }
  }

  if (error && !lobby) return <ErrorState message={error} onRetry={load} />;
  if (!lobby) return <CardSkeleton count={2} />;

  const freeSlots = lobby.slots.filter((slot) => !slot.userId);
  const freeRoles = [
    ...new Set(
      freeSlots.map((slot) => slot.roleRequired ?? "Любое амплуа")
    ),
  ];
  const mySlot = lobby.slots.find((slot) => slot.userId === userId);
  const isOrganizer = lobby.organizer.id === userId;
  const routeUrl = `https://yandex.ru/maps/?rtext=~${lobby.venue.lat},${lobby.venue.lng}&rtt=auto`;

  function join() {
    // Only ask which Амплуа when the answer is genuinely ambiguous.
    if (freeRoles.length > 1) {
      setPicking(true);
      return;
    }
    const target =
      freeSlots.find((slot) => slot.roleRequired) ?? freeSlots[0];
    if (target) void book(target.id);
  }

  return (
    <>
      <h2 className="section-title">
        {SPORT_LABELS[lobby.sport] ?? lobby.sport}, {formatStartAt(lobby.startAt)}
      </h2>

      {staticMapUrl && (
        <img
          className="static-map"
          src={staticMapUrl}
          alt={`Карта: ${lobby.venue.address}`}
        />
      )}

      <p className="card-meta" style={{ marginTop: "var(--ms-space-3)" }}>
        <strong style={{ color: "var(--ms-text-primary)" }}>
          {lobby.venue.name}
        </strong>
        <br />
        {lobby.venue.address}
        <br />
        {LEVEL_LABELS[lobby.gameLevel]}
      </p>

      <a
        className="chip"
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
              <span className="muted">Занят</span>
            ) : (
              <Button size="small" loading={busy} onClick={() => book(slot.id)}>
                Занять
              </Button>
            )}
          </div>
        ))}
      </div>

      {lobby.rentTotal > 0 && (
        <div className="lobby-card">
          <h3>Сплит аренды</h3>
          <p className="card-meta">
            {formatMoney(lobby.rentTotal)} за зал, {lobby.slotCount} Слотов.
          </p>
          <p style={{ margin: "var(--ms-space-2) 0 0" }}>
            <strong>{formatMoney(lobby.splitPerPlayer)}</strong> с человека
          </p>
          {lobby.depositEnabled && (
            <p className="form-hint">
              При записи удерживается Залог. Отмена за два часа возвращает его.
            </p>
          )}
          {holds.length > 0 && (
            <ul className="hold-list">
              {holds.map((hold) => (
                <li key={hold.slotId}>
                  {HOLD_LABELS[hold.status] ?? hold.status}
                  {": "}
                  {formatMoney(hold.amount)}
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
        {isOrganizer && lobby.status !== "cancelled" && lobby.status !== "finished" && (
          <Button variant="secondary" loading={busy} onClick={cancel}>
            Отменить
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
        {!mySlot && freeSlots.length > 0 && (
          <Button variant="primary" loading={busy} onClick={join}>
            Занять слот
          </Button>
        )}
        {mySlot && (
          <Link to="/passport" style={{ flex: 1 }}>
            <Button variant="primary" stretched>
              Вы в составе
            </Button>
          </Link>
        )}
      </div>

      <Sheet
        open={picking}
        onClose={() => setPicking(false)}
        label="Выбор амплуа"
      >
        <h2 className="section-title">Какое Амплуа берёте?</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Свободно {pluralSlots(freeSlots.length)}.
        </p>
        <div className="slot-list">
          {freeSlots.map((slot) => (
            <div key={slot.id} className="slot-row is-open">
              <span>{slot.roleRequired ?? "Любое амплуа"}</span>
              <Button size="small" loading={busy} onClick={() => book(slot.id)}>
                Выбрать
              </Button>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
