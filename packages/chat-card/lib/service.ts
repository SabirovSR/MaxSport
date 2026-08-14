import type { LobbyWithDetails } from "@maxsport/shared";
import { GAME_LEVEL_LABELS, SPORT_LABELS } from "@maxsport/shared";
import type { MaxApiClient, InlineButton } from "@maxsport/max-channel";
import type { LobbyService } from "@maxsport/lobby";

export interface ChatCardService {
  renderText(lobby: LobbyWithDetails): string;
  renderButtons(lobby: LobbyWithDetails): InlineButton[][];
  publishToOrganizer(
    lobby: LobbyWithDetails,
    organizerMaxUserId: number
  ): Promise<{ messageId: string }>;
  syncCard(lobbyId: string): Promise<void>;
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  }).format(date);
}

function progressBar(filled: number, total: number): string {
  const width = 10;
  const filledBlocks = Math.round((filled / total) * width);
  return "█".repeat(filledBlocks) + "░".repeat(width - filledBlocks);
}

function urgentRole(lobby: LobbyWithDetails): string | null {
  const open = lobby.slots.filter((s) => !s.userId && s.roleRequired);
  if (!open.length) return null;
  return open[0]!.roleRequired;
}

export function createChatCardService(
  maxApi: MaxApiClient,
  lobbies: LobbyService,
  _publicUrl: string,
  botUsername: string
): ChatCardService {
  const queue = new Map<string, ReturnType<typeof setTimeout>>();

  return {
    renderText(lobby) {
      const sport = SPORT_LABELS[lobby.sport];
      const when = formatDateTime(lobby.startAt);
      const bar = progressBar(lobby.filledCount, lobby.slotCount);
      const urgent = urgentRole(lobby);
      const lines = [
        `${sport === "Волейбол" ? "🏐" : "⚽"} ${sport} • ${when}`,
        `📍 ${lobby.venue.name}`,
        `👥 Заполнено: ${lobby.filledCount} / ${lobby.slotCount}  [${bar}]`,
      ];

      if (urgent && lobby.status !== "full") {
        lines.push(`🔥 Срочно нужен: 1 ${urgent}`);
      } else if (lobby.status === "full") {
        lines.push("✅ Состав собран");
      }

      if (lobby.rentTotal > 0) {
        lines.push(`💰 ${lobby.splitPerPlayer} ₽ / чел`);
      }

      lines.push(`📊 ${GAME_LEVEL_LABELS[lobby.gameLevel]}`);
      return lines.join("\n");
    },

    renderButtons(lobby) {
      if (lobby.status === "cancelled" || lobby.status === "finished") {
        return [];
      }
      if (lobby.status === "full") {
        return [
          [
            {
              type: "open_app",
              text: "Подробнее",
              url: `https://max.ru/${botUsername}?startapp=lobby_${lobby.id}`,
            },
          ],
        ];
      }
      return [
        [
          {
            type: "callback",
            text: "⚡ Занять слот",
            payload: `book_slot:${lobby.id}`,
          },
          {
            type: "open_app",
            text: "Подробнее",
            url: `https://max.ru/${botUsername}?startapp=lobby_${lobby.id}`,
          },
        ],
      ];
    },

    async publishToOrganizer(lobby, organizerMaxUserId) {
      const text = this.renderText(lobby);
      const buttons = this.renderButtons(lobby);
      return maxApi.sendMessage({
        userId: organizerMaxUserId,
        text,
        buttons,
      });
    },

    async syncCard(lobbyId) {
      const existing = queue.get(lobbyId);
      if (existing) clearTimeout(existing);

      queue.set(
        lobbyId,
        setTimeout(async () => {
          queue.delete(lobbyId);
          const lobby = await lobbies.getById(lobbyId);
          if (!lobby.cardMessageId) return;
          await maxApi.editMessage(lobby.cardMessageId, {
            text: this.renderText(lobby),
            buttons: this.renderButtons(lobby),
          });
        }, 500)
      );
    },
  };
}
