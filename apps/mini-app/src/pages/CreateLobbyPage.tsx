import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, LEVEL_LABELS, SPORT_LABELS, type Venue } from "../api";
import { VenuePicker, type ResolvedVenue } from "../components/VenuePicker";
import { useGeolocation } from "../lib/useGeolocation";
import { formatMoney, rememberSport } from "../lib/format";

const ROLE_OPTIONS: Record<string, string[]> = {
  volleyball: ["Связующий", "Доигровщик", "Центральный блокирующий", "Либеро"],
  mini_football: ["Вратарь", "Защитник", "Полузащитник", "Нападающий"],
  basketball: ["Разыгрывающий", "Защитник", "Форвард", "Центровой"],
  padel_tennis: ["Левый", "Правый"],
};

const STEPS = ["Игра", "Площадка", "Состав"] as const;

function defaultStart() {
  const date = new Date();
  date.setHours(date.getHours() + 3, 0, 0, 0);
  const twoDigits = (value: number) => String(value).padStart(2, "0");
  return [
    `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`,
    `${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`,
  ].join("T");
}

export function CreateLobbyPage() {
  const navigate = useNavigate();
  const geo = useGeolocation();

  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<Venue[]>([]);
  const [sport, setSport] = useState("volleyball");
  const [gameLevel, setGameLevel] = useState("amateur");
  const [venue, setVenue] = useState<ResolvedVenue | null>(null);
  const [startAt, setStartAt] = useState(defaultStart);
  const [slotCount, setSlotCount] = useState(12);
  const [rentTotal, setRentTotal] = useState(4200);
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [roles, setRoles] = useState<string[]>(["Связующий"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listVenues()
      .then((data) => setSaved(data.venues))
      .catch(() => setSaved([]));
  }, []);

  useEffect(() => {
    setRoles([]);
  }, [sport]);

  const split = useMemo(
    () => (slotCount > 0 ? Math.ceil(rentTotal / slotCount) : 0),
    [rentTotal, slotCount]
  );

  const stepValid = [
    Boolean(sport && gameLevel && startAt),
    venue !== null,
    slotCount >= 2 && roles.length <= slotCount,
  ];

  function toggleRole(role: string) {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role]
    );
  }

  async function submit() {
    if (!venue) return;
    setBusy(true);
    setError(null);
    try {
      // A saved Площадка is reused by coordinates so repeat games at the same
      // hall do not pile up duplicate rows.
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

      const { lobby } = await api.createLobby({
        sport,
        gameLevel,
        venueId,
        slotCount,
        rentTotal,
        depositEnabled: rentTotal > 0 && depositEnabled,
        startAt: new Date(startAt).toISOString(),
        // Required Амплуа occupy the last slots, leaving the opening ones free
        // for anyone.
        roleSlots: roles.map((role, offset) => ({
          index: slotCount - 1 - offset,
          role,
        })),
      });
      rememberSport(sport);
      navigate(`/lobby/${lobby.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать Лобби");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 className="section-title">Создать Лобби</h2>

      <div className="wizard-progress" aria-hidden="true">
        {STEPS.map((label, index) => (
          <span key={label} className={index <= step ? "is-done" : ""} />
        ))}
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Шаг {step + 1} из {STEPS.length}. {STEPS[step]}
      </p>

      {step === 0 && (
        <>
          <div className="form-group">
            <label htmlFor="sport">Вид спорта</label>
            <select
              id="sport"
              value={sport}
              onChange={(event) => setSport(event.target.value)}
            >
              {Object.entries(SPORT_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="level">Уровень игры</label>
            <select
              id="level"
              value={gameLevel}
              onChange={(event) => setGameLevel(event.target.value)}
            >
              {Object.entries(LEVEL_LABELS).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <p className="form-hint">
              Уровень видно в ленте, чтобы состав собрался комфортным для всех.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="start">Дата и время</label>
            <input
              id="start"
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </div>
        </>
      )}

      {step === 1 && (
        <VenuePicker
          saved={saved}
          near={geo.position}
          value={venue}
          onChange={setVenue}
        />
      )}

      {step === 2 && (
        <>
          <div className="form-group">
            <label htmlFor="slots">Сколько Слотов</label>
            <input
              id="slots"
              type="number"
              min={2}
              max={24}
              value={slotCount}
              onChange={(event) => setSlotCount(Number(event.target.value))}
            />
            {slotCount < 2 && (
              <p className="form-error">Минимум 2 Слота в Лобби.</p>
            )}
          </div>

          <div className="form-group">
            <label>Нужные Амплуа</label>
            <div className="chips">
              {(ROLE_OPTIONS[sport] ?? []).map((role) => (
                <button
                  key={role}
                  type="button"
                  className="chip"
                  aria-pressed={roles.includes(role)}
                  onClick={() => toggleRole(role)}
                >
                  {role}
                </button>
              ))}
            </div>
            <p className="form-hint">
              Отмеченные Амплуа станут отдельными Слотами. Остальные Слоты
              открыты для любого.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="rent">Аренда Площадки, ₽</label>
            <input
              id="rent"
              type="number"
              min={0}
              step={100}
              value={rentTotal}
              onChange={(event) => setRentTotal(Number(event.target.value))}
            />
            <p className="form-hint">
              {rentTotal > 0
                ? `Сплит: ${formatMoney(split)} с человека при ${slotCount} Слотах.`
                : "Бесплатное Лобби, Залог недоступен."}
            </p>
          </div>

          {rentTotal > 0 && (
            <div className="form-group checkbox-row">
              <input
                id="deposit"
                type="checkbox"
                checked={depositEnabled}
                onChange={(event) => setDepositEnabled(event.target.checked)}
              />
              <label htmlFor="deposit" style={{ margin: 0 }}>
                Залог против неявок
              </label>
            </div>
          )}
        </>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="sticky-bar">
        {step > 0 && (
          <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>
            Назад
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            variant="primary"
            disabled={!stepValid[step]}
            onClick={() => setStep((s) => s + 1)}
          >
            Дальше
          </Button>
        ) : (
          <Button
            variant="primary"
            loading={busy}
            disabled={!stepValid[step] || busy}
            onClick={submit}
          >
            Опубликовать
          </Button>
        )}
      </div>
    </>
  );
}
