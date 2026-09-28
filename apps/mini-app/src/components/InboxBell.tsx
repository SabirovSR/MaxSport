import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, SPORT_LABELS, type InboxJoinRequest } from "../api";
import { PlayerChip } from "./PlayerChip";
import { Sheet } from "./Sheet";
import { useToast } from "./Toast";
import { formatStartAt } from "../lib/format";
import { useInbox } from "../lib/useInbox";

function BellIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 9a6 6 0 1 1 12 0c0 3.2 1.2 5 2 6.5.3.5 0 1.5-.6 1.5H4.6c-.6 0-.9-1-.6-1.5C4.8 14 6 12.2 6 9Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M10 19a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function InboxBell() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { notices, refresh } = useInbox();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const count = notices.length;

  async function accept(notice: InboxJoinRequest) {
    setBusy(notice.id);
    try {
      await api.acceptJoinRequest(notice.lobbyId, notice.id);
      showToast("Игрок добавлен в состав");
      refresh();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось принять заявку";
      showToast(message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function reject(notice: InboxJoinRequest) {
    setBusy(notice.id);
    try {
      await api.rejectJoinRequest(notice.lobbyId, notice.id);
      showToast("Заявка отклонена", "info");
      refresh();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Не удалось отклонить заявку";
      showToast(message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        className="inbox-bell"
        aria-label={count > 0 ? `Уведомления, заявок: ${count}` : "Уведомления"}
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
          refresh();
        }}
      >
        <BellIcon />
        {count > 0 && (
          <span className="inbox-badge">{count > 9 ? "9+" : count}</span>
        )}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} label="Уведомления">
        <h2 className="section-title">Уведомления</h2>
        {count === 0 ? (
          <p className="muted" style={{ marginTop: 0 }}>
            Новых заявок нет.
          </p>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="inbox-item">
              <div className="inbox-item-head">
                <PlayerChip player={notice.player} linked={false} />
                <div className="muted">
                  {SPORT_LABELS[notice.sport] ?? notice.sport}
                  {" · "}
                  {formatStartAt(notice.startAt)}
                  {" · "}
                  {notice.venueName}
                </div>
                <div className="muted">
                  Хочет занять слот
                  {notice.roleRequired ? `: ${notice.roleRequired}` : ""}
                </div>
              </div>
              <div className="request-actions">
                <Button
                  size="small"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => reject(notice)}
                >
                  Отклонить
                </Button>
                <Button
                  size="small"
                  loading={busy === notice.id}
                  disabled={busy !== null && busy !== notice.id}
                  onClick={() => accept(notice)}
                >
                  Принять
                </Button>
                <Button
                  size="small"
                  variant="secondary"
                  disabled={busy !== null}
                  onClick={() => {
                    setOpen(false);
                    navigate(`/lobby/${notice.lobbyId}/roster`);
                  }}
                >
                  Открыть
                </Button>
              </div>
            </div>
          ))
        )}
      </Sheet>
    </>
  );
}
