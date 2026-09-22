import { Button } from "@maxhub/max-ui";
import { Sheet } from "./Sheet";

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  busy = false,
  onConfirm,
  onClose,
}: ConfirmSheetProps) {
  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Sheet open={open} onClose={close} label={title}>
      <h2 className="section-title">{title}</h2>
      <p className="muted confirm-sheet-text">{description}</p>
      <div className="confirm-sheet-actions">
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
