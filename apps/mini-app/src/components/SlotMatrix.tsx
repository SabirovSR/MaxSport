import type { Lobby } from "../api";
import { initialsOf } from "../lib/format";

/**
 * Reads the composition at a glance: filled slots are solid, slots that still
 * need a specific Амплуа are outlined, so a missing связующий is visible
 * before the card is even tapped.
 */
export function SlotMatrix({
  slots,
  compact = false,
  limit,
}: {
  slots: Lobby["slots"];
  compact?: boolean;
  limit?: number;
}) {
  const sorted = [...slots].sort((a, b) => a.index - b.index);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  const hidden = slots.length - shown.length;

  return (
    <div className={`slot-grid ${compact ? "is-compact" : ""}`}>
      {shown.map((slot) => {
        const state = slot.userId
          ? "is-filled"
          : slot.roleRequired
            ? "is-needed"
            : "";
        return (
          <div
            key={slot.id}
            className={`slot ${state}`}
            title={
              slot.occupant
                ? `${slot.occupant.firstName} ${slot.occupant.lastName ?? ""}`.trim()
                : (slot.roleRequired ?? "Любое амплуа")
            }
          >
            {slot.occupant?.photoUrl ? (
              <img src={slot.occupant.photoUrl} alt="" />
            ) : slot.occupant ? (
              initialsOf(slot.occupant.firstName, slot.occupant.lastName)
            ) : !compact && slot.roleRequired ? (
              slot.roleRequired.slice(0, 3)
            ) : null}
          </div>
        );
      })}
      {hidden > 0 && <div className="slot">+{hidden}</div>}
    </div>
  );
}
