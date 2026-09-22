const LABELS: Record<string, string> = {
  draft: "Черновик",
  open: "Идёт набор",
  full: "Состав собран",
  gathering: "Сбор команды",
  started: "Идёт игра",
  finished: "Завершено",
  cancelled: "Отменено",
};

export function LobbyStatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-badge-${status}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
