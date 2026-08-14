import type { FastifyInstance } from "fastify";
import {
  DomainError,
  UnauthorizedError,
  type Pool,
} from "@maxsport/shared";
import type { LobbyService } from "@maxsport/lobby";
import type { VenueRepository } from "@maxsport/venue";
import type { PresenceService } from "@maxsport/presence";
import type { PaymentService } from "@maxsport/payment";
import type { KarmaService } from "@maxsport/karma";
import type { ChatCardService } from "@maxsport/chat-card";
import type { RealtimeHub } from "@maxsport/realtime";
import type { NotificationScheduler } from "@maxsport/notifications";
import { requireAuth } from "./auth.js";

interface ApiDeps {
  pool: Pool;
  botToken: string;
  lobbies: LobbyService;
  venues: VenueRepository;
  presence: PresenceService;
  payments: PaymentService;
  karma: KarmaService;
  chatCard: ChatCardService;
  realtime: RealtimeHub;
  notifications: NotificationScheduler;
}

function handleError(error: unknown) {
  if (error instanceof DomainError) {
    return { statusCode: error.code === "UNAUTHORIZED" ? 401 : 400, body: { error: error.message, code: error.code } };
  }
  if (error instanceof UnauthorizedError) {
    return { statusCode: 401, body: { error: error.message } };
  }
  throw error;
}

export async function registerApiRoutes(
  app: FastifyInstance,
  deps: ApiDeps
) {
  app.get("/api/lobbies", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const query = request.query as {
        sport?: string;
        gameLevel?: string;
        hotOnly?: string;
      };
      const lobbies = await deps.lobbies.list({
        sport: query.sport as never,
        gameLevel: query.gameLevel as never,
        hotOnly: query.hotOnly === "true",
      });
      return reply.send({ lobbies });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/lobbies/:id", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const lobby = await deps.lobbies.getById(id);
      return reply.send({ lobby });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const body = request.body as {
        sport: string;
        gameLevel: string;
        startAt: string;
        isRecurring?: boolean;
        venueId: string;
        rentTotal: number;
        depositEnabled?: boolean;
        slotCount: number;
        roleSlots?: Array<{ index: number; role: string }>;
      };

      const lobby = await deps.lobbies.create({
        sport: body.sport as never,
        gameLevel: body.gameLevel as never,
        startAt: new Date(body.startAt),
        isRecurring: body.isRecurring,
        venueId: body.venueId,
        organizerId: user.id,
        rentTotal: body.rentTotal,
        depositEnabled: body.depositEnabled,
        slotCount: body.slotCount,
        roleSlots: body.roleSlots,
      });

      await deps.notifications.scheduleLobbyJobs(lobby.id, lobby.startAt);
      await deps.realtime.publishLobbyUpdate(lobby.id, lobby);

      return reply.status(201).send({ lobby });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies/:id/slots/:slotId/book", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id, slotId } = request.params as { id: string; slotId: string };
      const lobby = await deps.lobbies.bookSlot(id, slotId, user.id);
      await deps.chatCard.syncCard(id);
      await deps.realtime.publishLobbyUpdate(id, lobby);
      return reply.send({ lobby });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.delete("/api/lobbies/:id/slots/:slotId", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id, slotId } = request.params as { id: string; slotId: string };
      const lobby = await deps.lobbies.releaseSlot(id, slotId, user.id);
      await deps.chatCard.syncCard(id);
      await deps.realtime.publishLobbyUpdate(id, lobby);
      return reply.send({ lobby });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies/:id/card", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const lobby = await deps.lobbies.getById(id);
      if (lobby.organizerId !== user.id) {
        return reply.status(403).send({ error: "Только Организатор" });
      }
      const { messageId } = await deps.chatCard.publishToOrganizer(
        lobby,
        user.maxUserId
      );
      await deps.lobbies.setCardMessage(id, messageId, user.maxUserId);
      return reply.send({ messageId });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/lobbies/:id/roster", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const roster = await deps.presence.getRoster(id);
      return reply.send({ roster });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies/:id/start", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const lobby = await deps.lobbies.startLobby(id, user.id);
      await deps.presence.markNoShows(id);
      return reply.send({ lobby });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies/:id/finish", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const lobby = await deps.lobbies.finishLobby(id, user.id);
      return reply.send({ lobby });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/presence/:slotId/on-site", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { slotId } = request.params as { slotId: string };
      const body = request.body as { lat?: number; lng?: number } | undefined;
      if (body?.lat != null && body?.lng != null) {
        await deps.presence.confirmOnSiteWithGeo(
          slotId,
          user.id,
          body.lat,
          body.lng
        );
      } else {
        await deps.presence.confirmOnSite(slotId, user.id);
      }
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/presence/:slotId/on-the-way", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { slotId } = request.params as { slotId: string };
      await deps.presence.confirmOnTheWay(slotId, user.id);
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/presence/:slotId/manual", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { slotId } = request.params as { slotId: string };
      const body = request.body as { status: string };
      await deps.presence.manualMark(slotId, user.id, body.status as never);
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/passport/me", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const passport = await deps.karma.getPassport(user.id);
      return reply.send({ passport });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/passport/:userId", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const { userId } = request.params as { userId: string };
      const passport = await deps.karma.getPassport(userId);
      return reply.send({ passport });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/karma/vote", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const body = request.body as {
        targetId: string;
        lobbyId: string;
        reliability: "on_time" | "late" | "no_show";
        tag?: string;
      };
      await deps.karma.submitVote({
        voterId: user.id,
        targetId: body.targetId,
        lobbyId: body.lobbyId,
        reliability: body.reliability,
        tag: body.tag,
      });
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/venues/map", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const venues = await deps.venues.listAll();
      return reply.send({ venues });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/venues", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const venues = await deps.venues.listByUser(user.id);
      return reply.send({ venues });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/venues", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const body = request.body as {
        name: string;
        address: string;
        lat: number;
        lng: number;
        venueChatId?: number;
      };
      const venue = await deps.venues.create({
        ...body,
        createdBy: user.id,
      });
      return reply.status(201).send({ venue });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/lobbies/:id/payments", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const holds = await deps.payments.listForLobby(id);
      return reply.send({ holds });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies/:id/payments/collect", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      await deps.payments.collectForLobby(id, user.id);
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/lobbies/:id/stream", async (request, reply) => {
    const { id } = request.params as { id: string };
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const unsubscribe = deps.realtime.subscribeLobby(id, (payload) => {
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

    request.raw.on("close", () => {
      unsubscribe();
    });
  });
}
