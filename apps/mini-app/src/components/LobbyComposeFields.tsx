import { LEVEL_LABELS, ROLE_OPTIONS } from "../api";
import { formatMoney, formatSlots, parseCount, slotNoun } from "../lib/format";

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
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={values.slotCount > 0 ? String(values.slotCount) : ""}
          onChange={(event) =>
            onChange({ slotCount: parseCount(event.target.value) })
          }
        />
        {values.slotCount < 2 && (
          <p className="form-error">
            Минимум {formatSlots(2, "nominative")} в лобби.
          </p>
        )}
      </div>

      <div className="form-group">
        <label>Нужные амплуа</label>
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
          Отмеченные амплуа станут отдельными {slotNoun(true, "instrumental")}.
          Остальные {slotNoun(true)} открыты для любого.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor={`${idPrefix}-join-mode`}>Как игроки вступают</label>
        <select
          id={`${idPrefix}-join-mode`}
          value={values.joinMode}
          onChange={(event) =>
            onChange({
              joinMode: event.target.value as "instant" | "approval",
            })
          }
        >
          <option value="approval">По заявке организатору</option>
          <option value="instant">Сразу занимают слот</option>
        </select>
        <p className="form-hint">
          В режиме заявок вы подтверждаете каждого игрока в ростере.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor={`${idPrefix}-rent`}>Аренда площадки, ₽</label>
        <input
          id={`${idPrefix}-rent`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={values.rentTotal > 0 ? String(values.rentTotal) : ""}
          onChange={(event) =>
            onChange({ rentTotal: parseCount(event.target.value) })
          }
        />
        <p className="form-hint">
          {values.rentTotal > 0
            ? `Сплит: ${formatMoney(split)} с человека при ${formatSlots(values.slotCount, "prepositional")}.`
            : "Бесплатное лобби, залог недоступен."}
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
