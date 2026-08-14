import type { FastifyInstance } from "fastify";
import type { MaxBotAdapter } from "@maxsport/max-channel";
import type { LobbyService } from "@maxsport/lobby";
import type { ChatCardService } from "@maxsport/chat-card";
import type { PresenceService } from "@maxsport/presence";
import type { RealtimeHub } from "@maxsport/realtime";
import type { Pool } from "@maxsport/shared";
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

export function registerWebhookRoutes(
  app: FastifyInstance,
  deps: WebhookDeps
) {
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

    const lobby = await deps.lobbies.getById(lobbyId);
    const freeSlot = lobby.slots.find((s) => !s.userId);
    if (!freeSlot) {
      await ctx.reply("Все Слоты заняты");
      return;
    }

    const wasHot =
      lobby.startAt.getTime() - Date.now() < 3 * 60 * 60 * 1000 &&
      lobby.filledCount >= lobby.slotCount - 1;

    const updated = await deps.lobbies.bookSlot(lobbyId, freeSlot.id, user.id);
    await deps.chatCard.syncCard(lobbyId);
    await deps.realtime.publishLobbyUpdate(lobbyId, updated);
    if (wasHot) {
      await deps.karma.awardRescueBadge(user.id, lobbyId);
    }
    await ctx.reply(`Слот занят! ${updated.filledCount}/${updated.slotCount}`);
  });

  deps.bot.registerCallback("presence_go", async (ctx) => {
    const slotId = ctx.payload.split(":")[1];
    const user = await findUserByMaxId(deps.pool, ctx.userId);
    if (!user || !slotId) return;
    await deps.presence.confirmOnTheWay(slotId, user.id);
    await ctx.reply("Отлично, ждём на площадке!");
  });

  deps.bot.registerCallback("presence_cancel", async (ctx) => {
    const slotId = ctx.payload.split(":")[1];
    const user = await findUserByMaxId(deps.pool, ctx.userId);
    if (!user || !slotId) return;
    const slot = await deps.pool.query(`SELECT lobby_id FROM slots WHERE id = $1`, [slotId]);
    if (!slot.rows[0]) return;
    await deps.lobbies.releaseSlot(slot.rows[0].lobby_id as string, slotId, user.id);
    await ctx.reply("Слот освобождён. До встречи!");
  });

  deps.bot.registerCallback("presence_onsite", async (ctx) => {
    const slotId = ctx.payload.split(":")[1];
    const user = await findUserByMaxId(deps.pool, ctx.userId);
    if (!user || !slotId) return;
    await deps.presence.confirmOnSite(slotId, user.id);
    await ctx.reply("Явка отмечена. Хорошей игры!");
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
