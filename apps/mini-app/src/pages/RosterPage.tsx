import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, type Lobby, type RosterEntry } from "../api";

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
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    if (!id) return;
    api.getRoster(id).then((d) => setRoster(d.roster));
    api.getLobby(id).then((d) => setLobby(d.lobby));
  };

  useEffect(load, [id]);

  async function startGame() {
    if (!id) return;
    setBusy(true);
    try {
      await api.startLobby(id);
      navigate(`/lobby/${id}/karma`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2>Ростер</h2>
      {roster.map((entry) => (
        <div key={entry.slotId} className="roster-item">
          <div>
            <strong>
              {entry.firstName} {entry.lastName ?? ""}
            </strong>
            {entry.roleRequired && (
              <div style={{ color: "#888", fontSize: "0.85rem" }}>
                {entry.roleRequired}
              </div>
            )}
          </div>
          <span className={`status-${entry.status}`}>
            {STATUS_LABELS[entry.status] ?? entry.status}
          </span>
        </div>
      ))}

      <div style={{ marginTop: 24, display: "flex", gap: 8 }}>
        <Button variant="primary" loading={busy} onClick={startGame}>
          Начинаем
        </Button>
        {lobby?.status === "started" && (
          <Button
            variant="secondary"
            onClick={() => id && api.finishLobby(id).then(() => navigate(`/lobby/${id}/karma`))}
          >
            Завершить
          </Button>
        )}
      </div>
    </>
  );
}
