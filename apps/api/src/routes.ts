import type { FastifyInstance } from "fastify";
import { type Pool } from "@maxsport/shared";
import { DEFAULT_NEARBY_RADIUS_M, type LobbyService } from "@maxsport/lobby";
import type { VenueRepository } from "@maxsport/venue";
import type { PresenceService } from "@maxsport/presence";
import type { PaymentService } from "@maxsport/payment";
import type { KarmaService } from "@maxsport/karma";
import type { ChatCardService } from "@maxsport/chat-card";
import type { RealtimeHub } from "@maxsport/realtime";
import type { NotificationScheduler } from "@maxsport/notifications";
import { type GeoService } from "@maxsport/geo";
import { requireAuth } from "./auth.js";
import { mapRouteError } from "./http/errors.js";
import { tightLimit, voteLimit } from "./http/rate-limit.js";
import {
  CreateLobbyBody,
  CreateVenueBody,
  GeoGeocodeQuery,
  GeoPointQuery,
  GeoStaticQuery,
  GeoSuggestQuery,
  IdParams,
  JoinRequestParams,
  KarmaVoteBody,
  LobbyListQuery,
  ManualPresenceBody,
  OnSiteBody,
  PatchLobbyBody,
  SlotIdParams,
  SlotParams,
  SlotRoleBody,
  SportParams,
  SportSkillBody,
  UserIdParams,
} from "./http/schemas.js";

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

function optionalNumber(value: string | undefined): number | undefined {
  if (value == null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function registerApiRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get(
    "/api/lobbies",
    { schema: { querystring: LobbyListQuery } },
    async (request, reply) => {
      try {
        await requireAuth(request, deps.pool, deps.botToken);
        const query = request.query as LobbyListQuery;
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
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get("/api/me/lobbies", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const lobbies = await deps.lobbies.listMine(user.id);
      return reply.send({ lobbies });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/me/inbox", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const notices = await deps.lobbies.listOrganizerInbox(user.id);
      return reply.send({ notices });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get(
    "/api/lobbies/:id",
    { schema: { params: IdParams } },
    async (request, reply) => {
      try {
        await requireAuth(request, deps.pool, deps.botToken);
        const { id } = request.params as { id: string };
        const lobby = await deps.lobbies.getById(id);
        return reply.send({ lobby });
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.patch(
    "/api/lobbies/:id",
    { schema: { params: IdParams, body: PatchLobbyBody } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const { id } = request.params as { id: string };
        const body = request.body as PatchLobbyBody;
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
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.post(
    "/api/lobbies",
    { schema: { body: CreateLobbyBody }, config: tightLimit },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const body = request.body as CreateLobbyBody;

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
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.post("/api/lobbies/:id/slots/:slotId/book", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id, slotId } = request.params as { id: string; slotId: string };
      const lobby = await deps.lobbies.bookSlot(id, slotId, user.id);
      await deps.chatCard.syncCard(id);
      await deps.realtime.publishLobbyUpdate(id, lobby);
      return reply.send({ lobby });
    } catch (error) {
      const mapped = mapRouteError(error);
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
      void deps.notifications
        .notifyJoinRequest(id, {
          firstName: user.firstName,
          lastName: user.lastName,
          roleRequired: joinRequest.roleRequired,
        })
        .catch((error) => console.error(error));
      return reply.status(201).send({ request: joinRequest });
    } catch (error) {
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post(
    "/api/lobbies/:id/join-requests/:requestId/accept",
    { schema: { params: JoinRequestParams } },
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
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.post(
    "/api/lobbies/:id/join-requests/:requestId/reject",
    { schema: { params: JoinRequestParams } },
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
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.patch(
    "/api/lobbies/:id/slots/:slotId/role",
    { schema: { params: SlotParams, body: SlotRoleBody } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const { id, slotId } = request.params as { id: string; slotId: string };
        const body = request.body as SlotRoleBody;
        const lobby = await deps.lobbies.changeSlotRole(
          id,
          slotId,
          user.id,
          body.role ?? null
        );
        await deps.chatCard.syncCard(id);
        await deps.realtime.publishLobbyUpdate(id, lobby);
        return reply.send({ lobby });
      } catch (error) {
        const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies/:id/cancel", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const lobby = await deps.lobbies.cancelLobby(id, user.id);
      await deps.chatCard.syncCard(id);
      await deps.realtime.publishLobbyUpdate(id, lobby);
      return reply.send({ lobby });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post("/api/lobbies/:id/notify-players", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const sent = await deps.notifications.notifyLobbyPlayers(id, user.id);
      return reply.send({ sent });
    } catch (error) {
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post(
    "/api/presence/:slotId/on-site",
    { schema: { params: SlotIdParams, body: OnSiteBody } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const { slotId } = request.params as { slotId: string };
        const body = request.body as OnSiteBody | undefined;
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
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.post("/api/presence/:slotId/on-the-way", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { slotId } = request.params as { slotId: string };
      await deps.presence.confirmOnTheWay(slotId, user.id);
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post(
    "/api/presence/:slotId/manual",
    { schema: { params: SlotIdParams, body: ManualPresenceBody } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const { slotId } = request.params as { slotId: string };
        const body = request.body as ManualPresenceBody;
        await deps.presence.manualMark(slotId, user.id, body.status as never);
        return reply.send({ ok: true });
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get("/api/passport/me", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const passport = await deps.karma.getPassport(user.id);
      return reply.send({ passport });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get(
    "/api/passport/:userId",
    { schema: { params: UserIdParams } },
    async (request, reply) => {
      try {
        await requireAuth(request, deps.pool, deps.botToken);
        const { userId } = request.params as { userId: string };
        const passport = await deps.karma.getPassport(userId);
        return reply.send({ passport });
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get("/api/passport/skills/:sport", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { sport } = request.params as { sport: string };
      const skill = await deps.karma.getSportSkill(user.id, sport);
      return reply.send({ skill });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.put(
    "/api/passport/skills/:sport",
    { schema: { params: SportParams, body: SportSkillBody } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const { sport } = request.params as { sport: string };
        const body = request.body as SportSkillBody;
        const skill = await deps.karma.upsertSportSkill(user.id, sport, {
          gameLevel: body.gameLevel,
          preferredRoles: body.preferredRoles ?? [],
        });
        return reply.send({ skill });
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.delete("/api/passport/skills/:sport", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const { sport } = request.params as { sport: string };
      await deps.karma.deleteSportSkill(user.id, sport);
      return reply.send({ ok: true });
    } catch (error) {
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post(
    "/api/karma/vote",
    { schema: { body: KarmaVoteBody }, config: voteLimit },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const body = request.body as KarmaVoteBody;
        await deps.karma.submitVote({
          voterId: user.id,
          targetId: body.targetId,
          lobbyId: body.lobbyId,
          reliability: body.reliability,
          tag: body.tag,
        });
        return reply.send({ ok: true });
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get("/api/venues/map", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const venues = await deps.venues.listAll();
      return reply.send({ venues });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get("/api/venues", async (request, reply) => {
    try {
      const user = await requireAuth(request, deps.pool, deps.botToken);
      const venues = await deps.venues.listByUser(user.id);
      return reply.send({ venues });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.post(
    "/api/venues",
    { schema: { body: CreateVenueBody }, config: tightLimit },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const body = request.body as CreateVenueBody;
        const venue = await deps.venues.create({
          ...body,
          createdBy: user.id,
        });
        return reply.status(201).send({ venue });
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get("/api/lobbies/:id/payments", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      const { id } = request.params as { id: string };
      const holds = await deps.payments.listForLobby(id);
      return reply.send({ holds });
    } catch (error) {
      const mapped = mapRouteError(error);
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
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  // в браузер только js-ключ яндекса
  app.get("/api/config", async (request, reply) => {
    try {
      await requireAuth(request, deps.pool, deps.botToken);
      return reply.send({
        yandexMapsApiKey: deps.geo.jsApiKey(),
        botUsername: deps.botUsername,
      });
    } catch (error) {
      const mapped = mapRouteError(error);
      return reply.status(mapped.statusCode).send(mapped.body);
    }
  });

  app.get(
    "/api/geo/suggest",
    { schema: { querystring: GeoSuggestQuery } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const query = request.query as GeoSuggestQuery;
        const lat = optionalNumber(query.lat);
        const lng = optionalNumber(query.lng);
        const suggestions = await deps.geo.suggest({
          text: query.text ?? "",
          near: lat != null && lng != null ? { lat, lng } : undefined,
          rateKey: user.id,
        });
        return reply.send({ suggestions });
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get(
    "/api/geo/geocode",
    { schema: { querystring: GeoGeocodeQuery } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const query = request.query as GeoGeocodeQuery;
        const place = await deps.geo.geocode({
          query: query.query,
          uri: query.uri,
          rateKey: user.id,
        });
        return reply.send({ place });
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get(
    "/api/geo/reverse",
    { schema: { querystring: GeoPointQuery } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const query = request.query as GeoPointQuery;
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
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get(
    "/api/geo/static",
    { schema: { querystring: GeoStaticQuery } },
    async (request, reply) => {
      try {
        const user = await requireAuth(request, deps.pool, deps.botToken);
        const query = request.query as GeoStaticQuery;
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
        if (!image)
          return reply.status(404).send({ error: "Карта недоступна" });

        return reply
          .type(image.contentType)
          .header("Cache-Control", "private, max-age=86400")
          .send(Buffer.from(image.body));
      } catch (error) {
        const mapped = mapRouteError(error);
        return reply.status(mapped.statusCode).send(mapped.body);
      }
    }
  );

  app.get("/api/lobbies/:id/stream", async (request, reply) => {
    // сначала auth, потом поток
    try {
      await requireAuth(request, deps.pool, deps.botToken);
    } catch (error) {
      const mapped = mapRouteError(error);
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

    // ping, чтобы прокси не закрыл sse
    const heartbeat = setInterval(() => reply.raw.write(": ping\n\n"), 25_000);

    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
