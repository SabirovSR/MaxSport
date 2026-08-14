import type { Lobby } from "../api";

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
  const shown = limit ? slots.slice(0, limit) : slots;
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
            title={slot.roleRequired ?? "Любое амплуа"}
          >
            {!compact && !slot.userId && slot.roleRequired
              ? slot.roleRequired.slice(0, 3)
              : null}
          </div>
        );
      })}
      {hidden > 0 && <div className="slot">+{hidden}</div>}
    </div>
  );
}
