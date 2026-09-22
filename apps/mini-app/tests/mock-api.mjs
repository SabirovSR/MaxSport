import http from "node:http";

const me = {
  id: "user-1",
  firstName: "Арсен",
  lastName: "Тестов",
  photoUrl: null,
  reliabilityPct: 96,
  gamesPlayed: 4,
  gameLevel: "amateur",
};

const venue = {
  id: "venue-1",
  name: "Зал Волейбол",
  address: "Москва, Тверская 1",
  lat: 55.75,
  lng: 37.61,
};

function player(id, firstName, lastName = null) {
  return { id, firstName, lastName, photoUrl: null };
}

const state = {
  instant: makeLobby({
    id: "lobby-instant",
    sport: "volleyball",
    joinMode: "instant",
    status: "open",
    startAt: "2026-09-24T18:00:00.000Z",
    organizer: me,
    slots: [
      occupied(0, "Связующий", me),
      free(1, "Либеро"),
      free(2, null),
    ],
  }),
  approval: makeLobby({
    id: "lobby-approval",
    sport: "ice_hockey",
    joinMode: "approval",
    status: "open",
    startAt: "2026-09-25T17:00:00.000Z",
    organizer: player("org-1", "Олег", "Хоккеев"),
    slots: [
      occupied(0, "Вратарь", player("org-1", "Олег", "Хоккеев")),
      free(1, "Левый защитник"),
      free(2, null),
    ],
  }),
  finished: makeLobby({
    id: "lobby-finished",
    sport: "basketball",
    joinMode: "instant",
    status: "finished",
    startAt: "2026-09-21T18:00:00.000Z",
    organizer: me,
    slots: [
      occupied(0, "Разыгрывающий", me),
      occupied(1, "Форвард", player("p-2", "Иван", "Форвард")),
    ],
  }),
  request: null,
  skills: [
    {
      sport: "volleyball",
      gameLevel: "advanced",
      preferredRoles: ["Связующий"],
      updatedAt: "2026-09-22T12:00:00.000Z",
    },
  ],
};

function occupied(index, role, occupant) {
  return {
    id: `slot-${occupant.id}-${index}`,
    roleRequired: role,
    userId: occupant.id,
    index,
    occupant,
  };
}

function free(index, role) {
  return {
    id: `slot-free-${index}`,
    roleRequired: role,
    userId: null,
    index,
    occupant: null,
  };
}

function makeLobby(partial) {
  const slots = partial.slots;
  return {
    ...partial,
    venue,
    filledCount: slots.filter((slot) => slot.userId).length,
    slotCount: slots.length,
    splitPerPlayer: 350,
    rentTotal: 350 * slots.length,
    depositEnabled: true,
    cardMessageId: null,
    distanceM: 800,
  };
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function lobbyById(id) {
  return [state.instant, state.approval, state.finished].find(
    (lobby) => lobby.id === id
  );
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const method = req.method ?? "GET";

  if (path === "/api/config") {
    return json(res, 200, { yandexMapsApiKey: "", botUsername: "sport_bot" });
  }
  if (path === "/api/passport/me" || path.startsWith("/api/passport/user")) {
    return json(res, 200, {
      passport: {
        user: me,
        badges: [],
        attendancePct: 90,
        sportSkills: state.skills,
      },
    });
  }
  if (method === "GET" && path.startsWith("/api/passport/skills/")) {
    const sport = path.split("/").pop();
    return json(res, 200, {
      skill: state.skills.find((item) => item.sport === sport) ?? null,
    });
  }
  if (method === "PUT" && path.startsWith("/api/passport/skills/")) {
    const sport = path.split("/").pop();
    readBody(req).then((body) => {
      const skill = {
        sport,
        gameLevel: body.gameLevel,
        preferredRoles: body.preferredRoles ?? [],
        updatedAt: new Date().toISOString(),
      };
      state.skills = [
        ...state.skills.filter((item) => item.sport !== sport),
        skill,
      ];
      json(res, 200, { skill });
    });
    return;
  }
  if (path === "/api/lobbies" && method === "GET") {
    return json(res, 200, {
      lobbies: [state.instant, state.approval, state.finished],
    });
  }
  if (path === "/api/me/lobbies") {
    return json(res, 200, {
      lobbies: [
        {
          ...state.instant,
          myRole: "organizer",
          mySlotId: state.instant.slots[0].id,
          myPresenceStatus: "expected",
          karmaPending: false,
        },
        {
          ...state.finished,
          myRole: "organizer",
          mySlotId: state.finished.slots[0].id,
          myPresenceStatus: "on_site",
          karmaPending: true,
        },
      ],
    });
  }
  if (path === "/api/venues" || path === "/api/venues/map") {
    return json(res, 200, { venues: [venue] });
  }

  const lobbyMatch = path.match(/^\/api\/lobbies\/([^/]+)(.*)$/);
  if (lobbyMatch) {
    const [, id, rest] = lobbyMatch;
    const lobby = lobbyById(id);
    if (!lobby) return json(res, 404, { error: "Лобби не найдено" });

    if (rest === "" && method === "GET") return json(res, 200, { lobby });
    if (rest === "" && method === "PATCH") {
      return readBody(req).then((body) => {
        Object.assign(lobby, body);
        json(res, 200, { lobby });
      });
    }
    if (rest === "/payments") return json(res, 200, { holds: [] });
    if (rest === "/join-requests/me") {
      if (method === "DELETE") {
        state.request = state.request
          ? { ...state.request, status: "cancelled" }
          : null;
        return json(res, 200, { ok: true });
      }
      return json(res, 200, { request: id === "lobby-approval" ? state.request : null });
    }
    if (rest === "/join-requests") {
      return json(res, 200, {
        requests: state.request?.status === "pending" ? [state.request] : [],
      });
    }
    if (rest.endsWith("/accept")) {
      const slot = lobby.slots.find((item) => !item.userId);
      if (slot && state.request) {
        slot.userId = state.request.userId;
        slot.occupant = state.request.player;
        lobby.filledCount += 1;
        state.request = { ...state.request, status: "accepted" };
      }
      return json(res, 200, { lobby });
    }
    if (rest.endsWith("/reject")) {
      if (state.request) state.request = { ...state.request, status: "rejected" };
      return json(res, 200, { ok: true });
    }
    if (rest === "/karma/status") {
      return json(res, 200, {
        status: {
          open: lobby.status === "finished",
          remainingTargets: lobby.status === "finished" ? 1 : 0,
          votedTargetIds: [],
        },
      });
    }
    if (rest === "/roster") {
      return json(res, 200, {
        roster: lobby.slots
          .filter((slot) => slot.userId && slot.occupant)
          .map((slot) => ({
            slotId: slot.id,
            userId: slot.userId,
            firstName: slot.occupant.firstName,
            lastName: slot.occupant.lastName,
            photoUrl: slot.occupant.photoUrl,
            roleRequired: slot.roleRequired,
            status: "expected",
          })),
      });
    }
    if (rest.endsWith("/book") && method === "POST") {
      const slotId = rest.split("/")[2];
      const slot = lobby.slots.find((item) => item.id === slotId);
      if (slot) {
        slot.userId = me.id;
        slot.occupant = me;
        lobby.filledCount += 1;
      }
      return json(res, 200, { lobby });
    }
    if (rest.endsWith("/request") && method === "POST") {
      const slotId = rest.split("/")[2];
      const slot = lobby.slots.find((item) => item.id === slotId);
      state.request = {
        id: "req-1",
        lobbyId: lobby.id,
        slotId,
        userId: me.id,
        status: "pending",
        player: me,
        roleRequired: slot?.roleRequired ?? null,
        createdAt: new Date().toISOString(),
        resolvedAt: null,
      };
      return json(res, 201, { request: state.request });
    }
    if (rest.startsWith("/slots/") && method === "DELETE") {
      const slotId = rest.split("/")[2];
      const slot = lobby.slots.find((item) => item.id === slotId);
      if (slot) {
        slot.userId = null;
        slot.occupant = null;
        lobby.filledCount = Math.max(0, lobby.filledCount - 1);
      }
      return json(res, 200, { lobby });
    }
    if (rest === "/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      });
      res.write(": ping\n\n");
      return;
    }
  }

  json(res, 404, { error: `${method} ${path}` });
});

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

server.listen(3000, () => {
  console.log("mock api on :3000");
});
