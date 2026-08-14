import { useEffect, type ReactNode } from "react";

export function Sheet({
  open,
  onClose,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div className="sheet-grabber" />
        {children}
      </div>
    </>
  );
}
