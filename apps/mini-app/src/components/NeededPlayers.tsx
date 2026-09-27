import { useEffect, useRef, useState, type MouseEvent } from "react";
import { missingRoleCounts } from "../lib/roleVisual";
import { RoleMark } from "./RoleMark";

export function NeededPlayers({
  slots,
}: {
  slots: Array<{ userId: string | null; roleRequired: string | null }>;
}) {
  const missing = missingRoleCounts(slots);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function toggle(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setOpen((value) => !value);
  }

  return (
    <span className="needed-players" ref={rootRef}>
      Требуются игроки
      {missing.length > 0 && (
        <button
          type="button"
          className="needed-info"
          aria-expanded={open}
          aria-label="Какие амплуа нужны"
          onClick={toggle}
        >
          i
        </button>
      )}
      {open && missing.length > 0 && (
        <span className="needed-popover" role="dialog">
          {missing.map((item) => (
            <span key={item.role}>
              <span className="needed-popover-icon">
                <RoleMark role={item.role} />
              </span>
              {item.role}
              {item.count > 1 ? ` ×${item.count}` : ""}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
