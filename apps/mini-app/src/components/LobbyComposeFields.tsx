import { LOBBY_LEVEL_LABELS, ROLE_OPTIONS } from "../api";
import { formatMoney, formatSlots, parseCount, slotNoun } from "../lib/format";
import { RoleMark } from "./RoleMark";

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

  const maxRoles = Math.max(0, values.slotCount - 1);

  function addRole(role: string) {
    if (values.roles.length >= maxRoles) return;
    onChange({ roles: [...values.roles, role] });
  }

  function removeRole(role: string) {
    const index = values.roles.lastIndexOf(role);
    if (index < 0) return;
    onChange({ roles: values.roles.filter((_, item) => item !== index) });
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
            {Object.entries(LOBBY_LEVEL_LABELS).map(([code, label]) => (
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
        <div className="role-pick">
          {(ROLE_OPTIONS[sport] ?? []).map((role) => {
            const count = values.roles.filter((item) => item === role).length;
            return (
              <div key={role} className="role-pick-row">
                <span className="role-pick-label">
                  <span className="slot-role-icon">
                    <RoleMark role={role} />
                  </span>
                  {role}
                  {count > 0 ? ` ×${count}` : ""}
                </span>
                <span className="role-pick-stepper">
                  <button
                    type="button"
                    className="chip"
                    disabled={count === 0}
                    onClick={() => removeRole(role)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="chip"
                    aria-pressed={count > 0}
                    disabled={values.roles.length >= maxRoles}
                    onClick={() => addRole(role)}
                  >
                    +
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <p className="form-hint">
          Можно несколько одинаковых амплуа. Одно место ваше, роли — для
          остальных {slotNoun(true, "genitive")}.
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
