import { LEVEL_LABELS, ROLE_OPTIONS } from "../api";
import { formatMoney, formatSlots, slotNoun } from "../lib/format";

export interface LobbyComposeValues {
  gameLevel: string;
  slotCount: number;
  roles: string[];
  joinMode: "instant" | "approval";
  rentTotal: number;
  depositEnabled: boolean;
}

export function LobbyComposeFields({
  sport,
  values,
  onChange,
  showLevel = true,
  idPrefix = "lobby",
}: {
  sport: string;
  values: LobbyComposeValues;
  onChange: (patch: Partial<LobbyComposeValues>) => void;
  showLevel?: boolean;
  idPrefix?: string;
}) {
  const split =
    values.slotCount > 0 ? Math.ceil(values.rentTotal / values.slotCount) : 0;

  function toggleRole(role: string) {
    onChange({
      roles: values.roles.includes(role)
        ? values.roles.filter((item) => item !== role)
        : [...values.roles, role],
    });
  }

  return (
    <>
      {showLevel && (
        <div className="form-group">
          <label htmlFor={`${idPrefix}-level`}>Уровень игры</label>
          <select
            id={`${idPrefix}-level`}
            value={values.gameLevel}
            onChange={(event) => onChange({ gameLevel: event.target.value })}
          >
            {Object.entries(LEVEL_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor={`${idPrefix}-slots`}>Сколько слотов</label>
        <input
          id={`${idPrefix}-slots`}
          type="number"
          min={2}
          max={24}
          value={values.slotCount}
          onChange={(event) =>
            onChange({ slotCount: Number(event.target.value) })
          }
        />
        {values.slotCount < 2 && (
          <p className="form-error">
            Минимум {formatSlots(2, "nominative")} в Лобби.
          </p>
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
              aria-pressed={values.roles.includes(role)}
              onClick={() => toggleRole(role)}
            >
              {role}
            </button>
          ))}
        </div>
        <p className="form-hint">
          Отмеченные Амплуа станут отдельными {slotNoun(true, "instrumental")}.
          Остальные {slotNoun(true)} открыты для любого.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor={`${idPrefix}-join-mode`}>Как Игроки вступают</label>
        <select
          id={`${idPrefix}-join-mode`}
          value={values.joinMode}
          onChange={(event) =>
            onChange({
              joinMode: event.target.value as "instant" | "approval",
            })
          }
        >
          <option value="approval">По заявке Организатору</option>
          <option value="instant">Сразу занимают слот</option>
        </select>
        <p className="form-hint">
          В режиме заявок вы подтверждаете каждого Игрока в Ростере.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor={`${idPrefix}-rent`}>Аренда Площадки, ₽</label>
        <input
          id={`${idPrefix}-rent`}
          type="number"
          min={0}
          step={100}
          value={values.rentTotal}
          onChange={(event) =>
            onChange({ rentTotal: Number(event.target.value) })
          }
        />
        <p className="form-hint">
          {values.rentTotal > 0
            ? `Сплит: ${formatMoney(split)} с человека при ${formatSlots(values.slotCount, "prepositional")}.`
            : "Бесплатное Лобби, Залог недоступен."}
        </p>
      </div>

      {values.rentTotal > 0 && (
        <div className="form-group checkbox-row">
          <input
            id={`${idPrefix}-deposit`}
            type="checkbox"
            checked={values.depositEnabled}
            onChange={(event) =>
              onChange({ depositEnabled: event.target.checked })
            }
          />
          <label htmlFor={`${idPrefix}-deposit`} style={{ margin: 0 }}>
            Залог против неявок
          </label>
        </div>
      )}
    </>
  );
}
