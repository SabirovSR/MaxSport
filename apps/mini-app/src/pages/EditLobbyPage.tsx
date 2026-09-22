import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, type Lobby, type Venue } from "../api";
import { LobbyComposeFields } from "../components/LobbyComposeFields";
import { useToast } from "../components/Toast";
import { VenuePicker, type ResolvedVenue } from "../components/VenuePicker";
import { CardSkeleton, ErrorState } from "../components/States";

function toLocalInput(value: string) {
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function EditLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [saved, setSaved] = useState<Venue[]>([]);
  const [venue, setVenue] = useState<ResolvedVenue | null>(null);
  const [startAt, setStartAt] = useState("");
  const [gameLevel, setGameLevel] = useState("amateur");
  const [slotCount, setSlotCount] = useState(2);
  const [rentTotal, setRentTotal] = useState(0);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [joinMode, setJoinMode] = useState<"instant" | "approval">("approval");
  const [roles, setRoles] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getLobby(id), api.listVenues()])
      .then(([lobbyData, venueData]) => {
        const value = lobbyData.lobby;
        setLobby(value);
        setSaved(venueData.venues);
        setVenue(value.venue);
        setStartAt(toLocalInput(value.startAt));
        setGameLevel(value.gameLevel);
        setSlotCount(value.slotCount);
        setRentTotal(value.rentTotal);
        setDepositEnabled(value.depositEnabled);
        setJoinMode(value.joinMode);
        setRoles(
          value.slots
            .map((slot) => slot.roleRequired)
            .filter((role): role is string => Boolean(role))
        );
      })
      .catch((cause: Error) => setError(cause.message));
  }, [id]);

  async function submit() {
    if (!id || !lobby || !venue) return;
    setBusy(true);
    setError(null);
    try {
      const existing = saved.find(
        (item) =>
          Math.abs(item.lat - venue.lat) < 0.0002 &&
          Math.abs(item.lng - venue.lng) < 0.0002
      );
      const venueId =
        existing?.id ??
        (
          await api.createVenue({
            name: venue.name,
            address: venue.address,
            lat: venue.lat,
            lng: venue.lng,
          })
        ).venue.id;
      await api.updateLobby(id, {
        startAt: new Date(startAt).toISOString(),
        venueId,
        gameLevel,
        slotCount,
        rentTotal,
        depositEnabled: rentTotal > 0 && depositEnabled,
        joinMode,
        roleSlots: roles.map((role, offset) => ({
          index: slotCount - 1 - offset,
          role,
        })),
      });
      showToast("Изменения Лобби сохранены");
      navigate(`/lobby/${id}`, { replace: true });
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось сохранить";
      setError(message);
      showToast(message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (error && !lobby) {
    return (
      <ErrorState message={error} onRetry={() => window.location.reload()} />
    );
  }
  if (!lobby) return <CardSkeleton count={2} />;

  return (
    <>
      <h2 className="section-title">Редактировать Лобби</h2>

      <div className="form-group">
        <label htmlFor="edit-start">Дата и время</label>
        <input
          id="edit-start"
          type="datetime-local"
          value={startAt}
          onChange={(event) => setStartAt(event.target.value)}
        />
      </div>

      <VenuePicker saved={saved} value={venue} onChange={setVenue} />

      <LobbyComposeFields
        sport={lobby.sport}
        idPrefix="edit"
        values={{
          gameLevel,
          slotCount,
          roles,
          joinMode,
          rentTotal,
          depositEnabled,
        }}
        onChange={(patch) => {
          if (patch.gameLevel != null) setGameLevel(patch.gameLevel);
          if (patch.slotCount != null) setSlotCount(patch.slotCount);
          if (patch.roles) setRoles(patch.roles);
          if (patch.joinMode) setJoinMode(patch.joinMode);
          if (patch.rentTotal != null) setRentTotal(patch.rentTotal);
          if (patch.depositEnabled != null) {
            setDepositEnabled(patch.depositEnabled);
          }
        }}
      />

      {error && <p className="form-error">{error}</p>}

      <div className="sticky-bar">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Отмена
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabled={busy || !venue || slotCount < 2 || roles.length > slotCount}
          onClick={submit}
        >
          Сохранить
        </Button>
      </div>
    </>
  );
}
