import type { FastifyInstance } from "fastify";
import type { MaxBotAdapter } from "@maxsport/max-channel";
import type { LobbyService } from "@maxsport/lobby";
import type { ChatCardService } from "@maxsport/chat-card";
import type { PresenceService } from "@maxsport/presence";
import type { RealtimeHub } from "@maxsport/realtime";
import type { LobbyWithDetails, Pool } from "@maxsport/shared";
import { DomainError } from "@maxsport/shared";
import type { KarmaService } from "@maxsport/karma";
import { findUserByMaxId } from "./auth.js";

interface WebhookDeps {
  pool: Pool;
  botToken: string;
  webhookSecret: string;
  bot: MaxBotAdapter;
  lobbies: LobbyService;
  chatCard: ChatCardService;
  presence: PresenceService;
  karma: KarmaService;
  realtime: RealtimeHub;
  publicUrl: string;
}

type CallbackCtx = {
  userId: number;
  payload: string;
  reply: (text: string) => Promise<void>;
  replyWithButtons: (
    text: string,
    buttons: Array<{ label: string; callbackData: string }>
  ) => Promise<void>;
};

export function registerWebhookRoutes(app: FastifyInstance, deps: WebhookDeps) {
  async function publishLobby(lobbyId: string, lobby?: LobbyWithDetails) {
    const updated = lobby ?? (await deps.lobbies.getById(lobbyId));
    await deps.realtime.publishLobbyUpdate(lobbyId, updated);
    return updated;
  }

  async function bookSlotForUser(
    ctx: CallbackCtx,
    lobbyId: string,
    slotId: string
  ) {
    const user = await findUserByMaxId(deps.pool, ctx.userId);
    if (!user) {
      await ctx.reply("Сначала открой Mini App и нажми /start");
      return;
    }

    try {
      const lobby = await deps.lobbies.getById(lobbyId);
      const wasHot =
        lobby.startAt.getTime() - Date.now() < 3 * 60 * 60 * 1000 &&
        lobby.filledCount >= lobby.slotCount - 1;

      if (lobby.joinMode === "approval") {
        await deps.lobbies.requestJoin(lobbyId, slotId, user.id);
        await deps.realtime.publishLobbyUpdate(lobbyId, {
          type: "join_request",
          lobbyId,
        });
        await ctx.reply("Заявка отправлена Организатору");
        return;
      }

      const updated = await deps.lobbies.bookSlot(lobbyId, slotId, user.id);
      await deps.chatCard.syncCard(lobbyId);
      await publishLobby(lobbyId, updated);
      if (wasHot) {
        await deps.karma.awardRescueBadge(user.id, lobbyId);
      }
      await ctx.reply(
        `Слот занят! ${updated.filledCount}/${updated.slotCount}`
      );
    } catch (error) {
      const message =
        error instanceof DomainError ? error.message : "Не удалось занять слот";
      await ctx.reply(message);
    }
  }

  deps.bot.registerCommand("start", async (ctx) => {
    await ctx.reply(
      "MAX Sport — собери состав и не сорви игру!\nОткрой Mini App или жми «Занять слот» в карточке Лобби."
    );
  });

  deps.bot.registerCallback("book_slot", async (ctx) => {
    const lobbyId = ctx.payload.split(":")[1];
    if (!lobbyId) {
      await ctx.reply("Лобби не найдено");
      return;
    }

    const user = await findUserByMaxId(deps.pool, ctx.userId);
    if (!user) {
      await ctx.reply("Сначала открой Mini App и нажми /start");
      return;
    }

    let lobby: LobbyWithDetails;
    try {
      lobby = await deps.lobbies.getById(lobbyId);
    } catch {
      await ctx.reply("Лобби не найдено");
      return;
    }

    const freeSlots = lobby.slots.filter((s) => !s.userId);
    if (freeSlots.length === 0) {
      await ctx.reply("Все слоты заняты");
      return;
    }

    // BUG-011: When multiple free roles exist, ask user to choose.
    const freeRoles = new Set(
      freeSlots.map((slot) => slot.roleRequired ?? "Любое амплуа")
    );
    if (freeRoles.size > 1) {
      await ctx.replyWithButtons(
        "В лобби несколько свободных Амплуа. Какое берёте?",
        freeSlots.map((slot) => ({
          label: slot.roleRequired ?? "Любое амплуа",
          callbackData: `book_role:${lobbyId}:${slot.id}`,
        }))
      );
      return;
    }

    const freeSlot = freeSlots.find((s) => s.roleRequired) ?? freeSlots[0];
    await bookSlotForUser(ctx, lobbyId, freeSlot.id);
  });

  deps.bot.registerCallback("book_role", async (ctx) => {
    const [, lobbyId, slotId] = ctx.payload.split(":");
    if (!lobbyId || !slotId) {
      await ctx.reply("Лобби не найдено");
      return;
    }
    await bookSlotForUser(ctx, lobbyId, slotId);
  });

  deps.bot.registerCallback("presence_go", async (ctx) => {
    const slotId = ctx.payload.split(":")[1];
    const user = await findUserByMaxId(deps.pool, ctx.userId);
    if (!user || !slotId) return;
    try {
      await deps.presence.confirmOnTheWay(slotId, user.id);
      const lobbyId = await deps.presence.getLobbyIdForSlot(slotId);
      if (lobbyId) await publishLobby(lobbyId);
      await ctx.reply("Отлично, ждём на площадке!");
    } catch (error) {
      const message =
        error instanceof DomainError
          ? error.message
          : "Не удалось отметить явку";
      await ctx.reply(message);
    }
  });

  deps.bot.registerCallback("presence_cancel", async (ctx) => {
    const slotId = ctx.payload.split(":")[1];
    const user = await findUserByMaxId(deps.pool, ctx.userId);
    if (!user || !slotId) return;
    const lobbyId = await deps.presence.getLobbyIdForSlot(slotId);
    if (!lobbyId) return;
    try {
      const updated = await deps.lobbies.releaseSlot(lobbyId, slotId, user.id);
      await deps.chatCard.syncCard(lobbyId);
      await publishLobby(lobbyId, updated);
      await ctx.reply("Слот освобождён. До встречи!");
    } catch (error) {
      const message =
        error instanceof DomainError
          ? error.message
          : "Не удалось освободить слот";
      await ctx.reply(message);
    }
  });

  deps.bot.registerCallback("presence_onsite", async (ctx) => {
    const slotId = ctx.payload.split(":")[1];
    const user = await findUserByMaxId(deps.pool, ctx.userId);
    if (!user || !slotId) return;
    try {
      await deps.presence.confirmOnSite(slotId, user.id);
      const lobbyId = await deps.presence.getLobbyIdForSlot(slotId);
      if (lobbyId) await publishLobby(lobbyId);
      await ctx.reply("Явка отмечена. Хорошей игры!");
    } catch (error) {
      const message =
        error instanceof DomainError
          ? error.message
          : "Не удалось отметить явку";
      await ctx.reply(message);
    }
  });

  app.post("/webhook", async (request, reply) => {
    const secret = request.headers["x-max-bot-api-secret"];
    if (deps.webhookSecret && secret !== deps.webhookSecret) {
      return reply.status(403).send({ error: "Invalid webhook secret" });
    }

    try {
      await deps.bot.handleUpdate(request.body);
    } catch (error) {
      request.log.error(error);
    }

    return reply.send({ ok: true });
  });
}

export async function registerWebhookSubscription(deps: {
  maxApi: { subscribeWebhook(url: string, secret: string): Promise<void> };
  publicUrl: string;
  webhookSecret: string;
}) {
  if (!deps.webhookSecret) return;

  const url = `${deps.publicUrl}/webhook`;
  const retryDelaysMs = [0, 2_000, 5_000];
  let lastError: unknown;

  for (const delayMs of retryDelaysMs) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    try {
      await deps.maxApi.subscribeWebhook(url, deps.webhookSecret);
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
