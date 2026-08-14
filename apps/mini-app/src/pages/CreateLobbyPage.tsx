import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, type Venue } from "../api";

export function CreateLobbyPage() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [sport, setSport] = useState("volleyball");
  const [gameLevel, setGameLevel] = useState("amateur");
  const [venueId, setVenueId] = useState("");
  const [slotCount, setSlotCount] = useState(12);
  const [rentTotal, setRentTotal] = useState(4200);
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [setterIndex, setSetterIndex] = useState(11);
  const [startAt, setStartAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 3, 0, 0, 0);
    return d.toISOString().slice(0, 16);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listVenues().then((d) => {
      setVenues(d.venues);
      if (d.venues[0]) setVenueId(d.venues[0].id);
    });
  }, []);

  async function submit() {
    if (!venueId) {
      setError("Выберите Площадку");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { lobby } = await api.createLobby({
        sport,
        gameLevel,
        venueId,
        slotCount,
        rentTotal,
        depositEnabled: rentTotal > 0 && depositEnabled,
        startAt: new Date(startAt).toISOString(),
        roleSlots:
          sport === "volleyball"
            ? [{ index: setterIndex, role: "Связующий" }]
            : [],
      });
      navigate(`/lobby/${lobby.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function addVenue() {
    const name = prompt("Название Площадки");
    const address = prompt("Адрес");
    if (!name || !address) return;
    const { venue } = await api.createVenue({
      name,
      address,
      lat: 55.7558,
      lng: 37.6173,
    });
    setVenues((v) => [...v, venue]);
    setVenueId(venue.id);
  }

  return (
    <>
      <h2>Создать Лобби</h2>

      <div className="form-group">
        <label>Вид спорта</label>
        <select value={sport} onChange={(e) => setSport(e.target.value)}>
          <option value="volleyball">Волейбол</option>
          <option value="mini_football">Мини-футбол</option>
          <option value="basketball">Баскетбол</option>
          <option value="padel_tennis">Падел/Теннис</option>
        </select>
      </div>

      <div className="form-group">
        <label>Уровень</label>
        <select value={gameLevel} onChange={(e) => setGameLevel(e.target.value)}>
          <option value="novice">Новичок</option>
          <option value="amateur">Любитель</option>
          <option value="advanced">Продвинутый</option>
        </select>
      </div>

      <div className="form-group">
        <label>Площадка</label>
        <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <Button size="small" variant="secondary" onClick={addVenue} style={{ marginTop: 8 }}>
          + Новая Площадка
        </Button>
      </div>

      <div className="form-group">
        <label>Дата и время</label>
        <input
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label>Число Слотов</label>
        <input
          type="number"
          min={2}
          max={24}
          value={slotCount}
          onChange={(e) => setSlotCount(Number(e.target.value))}
        />
      </div>

      {sport === "volleyball" && (
        <div className="form-group">
          <label>Слот «Связующий» (индекс)</label>
          <input
            type="number"
            min={0}
            max={slotCount - 1}
            value={setterIndex}
            onChange={(e) => setSetterIndex(Number(e.target.value))}
          />
        </div>
      )}

      <div className="form-group">
        <label>Аренда, ₽</label>
        <input
          type="number"
          min={0}
          value={rentTotal}
          onChange={(e) => setRentTotal(Number(e.target.value))}
        />
      </div>

      {rentTotal > 0 && (
        <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <input
            type="checkbox"
            checked={depositEnabled}
            onChange={(e) => setDepositEnabled(e.target.checked)}
          />
          Защита от no-show (залог, мок)
        </label>
      )}

      {error && <p style={{ color: "#f87171" }}>{error}</p>}

      <Button variant="primary" stretched loading={busy} onClick={submit}>
        Опубликовать
      </Button>
    </>
  );
}
