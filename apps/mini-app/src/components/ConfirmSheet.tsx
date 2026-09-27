import { Button } from "@maxhub/max-ui";
import { Sheet } from "./Sheet";

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Sheet open={open} onClose={close} label={title}>
      <h2 className="section-title confirm-sheet-title">{title}</h2>
      <p className="muted confirm-sheet-text">{description}</p>
      <div
        className={
          danger ? "confirm-sheet-actions is-danger" : "confirm-sheet-actions"
        }
      >
        <Button variant="secondary" disabled={busy} onClick={close}>
          Не сейчас
        </Button>
        <Button
          variant="primary"
          loading={busy}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
