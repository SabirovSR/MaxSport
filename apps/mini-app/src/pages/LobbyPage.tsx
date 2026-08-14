import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, LEVEL_LABELS, SPORT_LABELS, type Lobby } from "../api";

export function LobbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    api.getLobby(id).then((d) => {
      setLobby(d.lobby);
      setMessageId(d.lobby.cardMessageId);
    });
  };

  useEffect(() => {
    load();
    if (!id) return;
    const source = new EventSource(`/api/lobbies/${id}/stream`);
    source.onmessage = (event) => {
      try {
        setLobby(JSON.parse(event.data));
      } catch {
        /* ignore */
      }
    };
    return () => source.close();
  }, [id]);

  async function book(slotId: string) {
    if (!id) return;
    setBusy(true);
    try {
      const { lobby: updated } = await api.bookSlot(id, slotId);
      setLobby(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!id) return;
    setBusy(true);
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
        setError("Шеринг доступен только в MAX");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!lobby) return <p>Загрузка…</p>;

  const freeSlots = lobby.slots.filter((s) => !s.userId);

  return (
    <>
      <h2>{SPORT_LABELS[lobby.sport]}</h2>
      <p style={{ color: "#888" }}>
        {lobby.venue.name}
        <br />
        {lobby.venue.address}
        <br />
        {new Date(lobby.startAt).toLocaleString("ru-RU")} •{" "}
        {LEVEL_LABELS[lobby.gameLevel]}
      </p>

      <div className="slot-grid">
        {lobby.slots.map((slot) => (
          <div
            key={slot.id}
            className={`slot ${slot.userId ? "filled" : slot.roleRequired ? "needed" : ""}`}
          >
            {slot.roleRequired ?? `#${slot.index + 1}`}
          </div>
        ))}
      </div>

      {lobby.rentTotal > 0 && (
        <p>
          💰 {lobby.splitPerPlayer} ₽ / чел
          {lobby.depositEnabled && " • залог (мок)"}
        </p>
      )}

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      <div className="sticky-bar">
        <Button variant="secondary" onClick={() => navigate(`/lobby/${id}/roster`)}>
          Ростер
        </Button>
        <Button variant="secondary" loading={busy} onClick={share}>
          Поделиться
        </Button>
        {freeSlots.length > 0 && (
          <Button
            variant="primary"
            loading={busy}
            onClick={() => book(freeSlots[0]!.id)}
          >
            Занять
          </Button>
        )}
      </div>
    </>
  );
}
