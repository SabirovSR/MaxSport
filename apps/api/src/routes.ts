import type { FastifyInstance } from "fastify";
import {
  DomainError,
  httpStatusForDomainError,
  UnauthorizedError,
  type Pool,
} from "@maxsport/shared";
import { DEFAULT_NEARBY_RADIUS_M, type LobbyService } from "@maxsport/lobby";
import type { VenueRepository } from "@maxsport/venue";
import type { PresenceService } from "@maxsport/presence";
import type { PaymentService } from "@maxsport/payment";
import type { KarmaService } from "@maxsport/karma";
import type { ChatCardService } from "@maxsport/chat-card";
import type { RealtimeHub } from "@maxsport/realtime";
import type { NotificationScheduler } from "@maxsport/notifications";
import { YandexGeoError, type GeoService } from "@maxsport/geo";
import { requireAuth } from "./auth.js";

interface ApiDeps {
  pool: Pool;
  botToken: string;
  botUsername: string;
  lobbies: LobbyService;
  venues: VenueRepository;
  presence: PresenceService;
  payments: PaymentService;
  karma: KarmaService;
  chatCard: ChatCardService;
  realtime: RealtimeHub;
  notifications: NotificationScheduler;
  geo: GeoService;
}

function handleError(error: unknown) {
  if (error instanceof YandexGeoError) {
    // An upstream map failure is not the client's fault, and the Yandex status
    // must not be forwarded verbatim: a 403 there means our key is bad, which
    // would read as "you are not authorised" to the caller.
    return {
      statusCode: 502,
      body: {
        error: "Картографический сервис недоступен",
        code: "GEO_UPSTREAM",
      },
    };
  }
  if (error instanceof DomainError) {
    return {
      statusCode: httpStatusForDomainError(error),
      body: { error: error.message, code: error.code },
    };
  }
  if (error instanceof UnauthorizedError) {
    return { statusCode: 401, body: { error: error.message } };
  }
  // BUG-018: Unknown errors should still produce structured JSON, not HTML.
  console.error(error);
  return { statusCode: 500, body: { error: "Внутренняя ошибка сервера" } };
}

function optionalNumber(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function registerApiRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/api/lobbies", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const query = request.query as {
        sport?: string;
        gameLevel?: string;
        hotOnly?: string;
        lat?: string;
        lng?: string;
        nearbyOnly?: string;
        radiusM?: string;
      };
      // A position alone only measures distance; "рядом" is what filters.
      const nearbyOnly = query.nearbyOnly === "true";
      const lobbies = await deps.lobbies.list({
        sport: query.sport as never,
        gameLevel: query.gameLevel as never,
        hotOnly: query.hotOnly === "true",
        userLat: optionalNumber(query.lat),
        userLng: optionalNumber(query.lng),
        radiusM: nearbyOnly
          ? (optionalNumber(query.radiusM) ?? DEFAULT_NEARBY_RADIUS_M)
          : undefined,
      });
      return reply.send({ lobbies });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/me/lobbies", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const lobbies = await deps.lobbies.listMine(user.id);
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

  app.patch("/api/lobbies/:id", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const body = request.body as {
        startAt?: string;
        venueId?: string;
        gameLevel?: string;
        rentTotal?: number;
        depositEnabled?: boolean;
        slotCount?: number;
        roleSlots?: Array<{ index: number; role: string }>;
        joinMode?: "instant" | "approval";
      };
      const before = await deps.lobbies.getById(id);
      const lobby = await deps.lobbies.updateLobby(id, user.id, {
        ...body,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        gameLevel: body.gameLevel as never,
      });
      if (lobby.startAt.getTime() !== before.startAt.getTime()) {
        await deps.notifications.rescheduleLobbyJobs(id, lobby.startAt);
      }
      await deps.chatCard.syncCard(id);
      await deps.realtime.publishLobbyUpdate(id, lobby);
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
        joinMode?: "instant" | "approval";
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
        joinMode: body.joinMode,
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

  app.post("/api/lobbies/:id/slots/:slotId/request", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id, slotId } = request.params as {
        id: string;
        slotId: string;
      };
      const joinRequest = await deps.lobbies.requestJoin(id, slotId, user.id);
      await deps.realtime.publishLobbyUpdate(id, {
        type: "join_request",
        lobbyId: id,
      });
      return reply.status(201).send({ request: joinRequest });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.delete("/api/lobbies/:id/join-requests/me", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      await deps.lobbies.cancelJoinRequest(id, user.id);
      await deps.realtime.publishLobbyUpdate(id, {
        type: "join_request",
        lobbyId: id,
      });
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/lobbies/:id/join-requests/me", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const joinRequest = await deps.lobbies.getMyJoinRequest(id, user.id);
      return reply.send({ request: joinRequest });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/lobbies/:id/join-requests", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const requests = await deps.lobbies.listJoinRequests(id, user.id);
      return reply.send({ requests });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post(
    "/api/lobbies/:id/join-requests/:requestId/accept",
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const { id, requestId } = request.params as {
          id: string;
          requestId: string;
        };
        const lobby = await deps.lobbies.acceptJoinRequest(
          id,
          requestId,
          user.id
        );
        await deps.chatCard.syncCard(id);
        await deps.realtime.publishLobbyUpdate(id, lobby);
        return reply.send({ lobby });
      } catch (error) {
        const mapped = handleError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.post(
    "/api/lobbies/:id/join-requests/:requestId/reject",
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const { id, requestId } = request.params as {
          id: string;
          requestId: string;
        };
        await deps.lobbies.rejectJoinRequest(id, requestId, user.id);
        await deps.realtime.publishLobbyUpdate(id, {
          type: "join_request",
          lobbyId: id,
        });
        return reply.send({ ok: true });
      } catch (error) {
        const mapped = handleError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

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
        return reply.status(403).send({ error: "Только организатор" });
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
      await deps.chatCard.syncCard(id);
      await deps.realtime.publishLobbyUpdate(id, lobby);
      return reply.send({ lobby });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies/:id/cancel", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const lobby = await deps.lobbies.cancelLobby(id, user.id);
      // The chat card must lose its join buttons, and anyone watching the
      // lobby in the Mini App should see the change without a refresh.
      await deps.chatCard.syncCard(id);
      await deps.realtime.publishLobbyUpdate(id, lobby);
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
      await deps.chatCard.syncCard(id);
      await deps.realtime.publishLobbyUpdate(id, lobby);
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

  app.get("/api/passport/skills/:sport", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { sport } = request.params as { sport: string };
      const skill = await deps.karma.getSportSkill(user.id, sport);
      return reply.send({ skill });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.put("/api/passport/skills/:sport", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { sport } = request.params as { sport: string };
      const body = request.body as {
        gameLevel: "novice" | "amateur" | "advanced";
        preferredRoles?: string[];
      };
      const skill = await deps.karma.upsertSportSkill(user.id, sport, {
        gameLevel: body.gameLevel,
        preferredRoles: body.preferredRoles ?? [],
      });
      return reply.send({ skill });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.delete("/api/passport/skills/:sport", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { sport } = request.params as { sport: string };
      await deps.karma.deleteSportSkill(user.id, sport);
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/lobbies/:id/karma/status", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const status = await deps.karma.getKarmaStatus(id, user.id);
      return reply.send({ status });
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

  // The JS API key is the only Yandex key that may reach the browser: it is
  // restricted by HTTP referrer in the Yandex cabinet. Geosuggest, Geocoder
  // and Static keys are not, so those stay behind the proxy routes below.
  // Serving the key at runtime also means rotating it needs no image rebuild.
  app.get("/api/config", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      return reply.send({
        yandexMapsApiKey: deps.geo.jsApiKey(),
        botUsername: deps.botUsername,
      });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/geo/suggest", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const query = request.query as {
        text?: string;
        lat?: string;
        lng?: string;
      };
      const lat = optionalNumber(query.lat);
      const lng = optionalNumber(query.lng);
      const suggestions = await deps.geo.suggest({
        text: query.text ?? "",
        near: lat != null && lng != null ? { lat, lng } : undefined,
        rateKey: user.id,
      });
      return reply.send({ suggestions });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/geo/geocode", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const query = request.query as { query?: string; uri?: string };
      const place = await deps.geo.geocode({
        query: query.query,
        uri: query.uri,
        rateKey: user.id,
      });
      return reply.send({ place });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/geo/reverse", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const query = request.query as { lat?: string; lng?: string };
      const lat = optionalNumber(query.lat);
      const lng = optionalNumber(query.lng);
      if (lat == null || lng == null) {
        return reply.status(400).send({ error: "Нужны lat и lng" });
      }
      const place = await deps.geo.reverseGeocode({
        lat,
        lng,
        rateKey: user.id,
      });
      return reply.send({ place });
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/geo/static", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const query = request.query as {
        lat?: string;
        lng?: string;
        zoom?: string;
        width?: string;
        height?: string;
      };
      const lat = optionalNumber(query.lat);
      const lng = optionalNumber(query.lng);
      if (lat == null || lng == null) {
        return reply.status(400).send({ error: "Нужны lat и lng" });
      }

      const image = await deps.geo.staticMap({
        lat,
        lng,
        zoom: optionalNumber(query.zoom),
        width: optionalNumber(query.width),
        height: optionalNumber(query.height),
        rateKey: user.id,
      });
      if (!image) return reply.status(404).send({ error: "Карта недоступна" });

      return reply
        .type(image.contentType)
        .header("Cache-Control", "private, max-age=86400")
        .send(Buffer.from(image.body));
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/lobbies/:id/stream", async (request, reply) => {
    // Authenticate before writeHead, otherwise an auth error cannot be
    // reported as a normal JSON response.
    try {
      await requireAuth(request, deps.pool, deps.botToken);
    } catch (error) {
      const mapped = handleError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }

    const { id } = request.params as { id: string };
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const unsubscribe = deps.realtime.subscribeLobby(id, (payload) => {
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    });

    // Without traffic the reverse proxy drops an idle stream, which would kill
    // the live counter mid-demo.
    const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
