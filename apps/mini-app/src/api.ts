const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function getInitData(): string {
  return window.WebApp?.initData ?? "";
}

export function getStartParam(): string | undefined {
  return window.WebApp?.initDataUnsafe?.start_param;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("X-Init-Data", getInitData());
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export interface Lobby {
  id: string;
  sport: string;
  gameLevel: string;
  status: string;
  startAt: string;
  venue: {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
  };
  organizer: {
    id: string;
    firstName: string;
    lastName: string | null;
    photoUrl?: string | null;
  };
  slots: Array<{
    id: string;
    roleRequired: string | null;
    userId: string | null;
    index: number;
    occupant: PublicPlayer | null;
  }>;
  filledCount: number;
  slotCount: number;
  splitPerPlayer: number;
  rentTotal: number;
  depositEnabled: boolean;
  cardMessageId: string | null;
  joinMode: "instant" | "approval";
  /** Present only when the feed request carried the user's position. */
  distanceM?: number;
}

export interface PublicPlayer {
  id: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
}

export interface JoinRequest {
  id: string;
  lobbyId: string;
  slotId: string;
  userId: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  player: PublicPlayer;
  roleRequired: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface MyLobby extends Lobby {
  myRole: "organizer" | "player";
  mySlotId: string;
  myPresenceStatus: string | null;
  karmaPending: boolean;
}

export interface SportSkill {
  sport: string;
  gameLevel: string;
  preferredRoles: string[];
  updatedAt: string;
}

export interface GeoSuggestion {
  title: string;
  subtitle?: string;
  address?: string;
  uri?: string;
  distanceM?: number;
}

export interface GeoPlace {
  name?: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface Passport {
  user: {
    id: string;
    firstName: string;
    lastName: string | null;
    photoUrl: string | null;
    reliabilityPct: number;
    gamesPlayed: number;
    gameLevel: string;
  };
  badges: Array<{ code: string; title: string; description: string }>;
  attendancePct: number;
  sportSkills: SportSkill[];
}

export interface PaymentHold {
  slotId: string;
  userId: string;
  lobbyId: string;
  status: string;
  amount: number;
}

export interface RosterEntry {
  slotId: string;
  userId: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  roleRequired: string | null;
  status: string;
}

export const api = {
  getConfig() {
    return apiFetch<{ yandexMapsApiKey: string; botUsername: string }>(
      "/api/config"
    );
  },
  listLobbies(params?: {
    sport?: string;
    gameLevel?: string;
    hotOnly?: boolean;
    nearbyOnly?: boolean;
    lat?: number;
    lng?: number;
  }) {
    const search = new URLSearchParams();
    if (params?.sport) search.set("sport", params.sport);
    if (params?.gameLevel) search.set("gameLevel", params.gameLevel);
    if (params?.hotOnly) search.set("hotOnly", "true");
    if (params?.nearbyOnly) search.set("nearbyOnly", "true");
    if (params?.lat != null) search.set("lat", String(params.lat));
    if (params?.lng != null) search.set("lng", String(params.lng));
    const q = search.toString();
    return apiFetch<{ lobbies: Lobby[] }>(`/api/lobbies${q ? `?${q}` : ""}`);
  },
  listMyLobbies() {
    return apiFetch<{ lobbies: MyLobby[] }>("/api/me/lobbies");
  },
  suggestPlaces(text: string, near?: { lat: number; lng: number }) {
    const search = new URLSearchParams({ text });
    if (near) {
      search.set("lat", String(near.lat));
      search.set("lng", String(near.lng));
    }
    return apiFetch<{ suggestions: GeoSuggestion[] }>(
      `/api/geo/suggest?${search.toString()}`
    );
  },
  geocode(input: { query?: string; uri?: string }) {
    const search = new URLSearchParams();
    if (input.query) search.set("query", input.query);
    if (input.uri) search.set("uri", input.uri);
    return apiFetch<{ place: GeoPlace | null }>(
      `/api/geo/geocode?${search.toString()}`
    );
  },
  reverseGeocode(lat: number, lng: number) {
    return apiFetch<{ place: GeoPlace | null }>(
      `/api/geo/reverse?lat=${lat}&lng=${lng}`
    );
  },
  async getStaticMap(lat: number, lng: number, width = 640, height = 280) {
    const search = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      width: String(width),
      height: String(height),
    });
    const response = await fetch(
      `${API_BASE}/api/geo/static?${search.toString()}`,
      { headers: { "X-Init-Data": getInitData() } }
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }
    return response.blob();
  },
  listPayments(lobbyId: string) {
    return apiFetch<{ holds: PaymentHold[] }>(
      `/api/lobbies/${lobbyId}/payments`
    );
  },
  collectPayments(lobbyId: string) {
    return apiFetch<{ ok: boolean }>(
      `/api/lobbies/${lobbyId}/payments/collect`,
      { method: "POST" }
    );
  },
  getLobby(id: string) {
    return apiFetch<{ lobby: Lobby }>(`/api/lobbies/${id}`);
  },
  createLobby(body: Record<string, unknown>) {
    return apiFetch<{ lobby: Lobby }>("/api/lobbies", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  updateLobby(id: string, body: Record<string, unknown>) {
    return apiFetch<{ lobby: Lobby }>(`/api/lobbies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },
  bookSlot(lobbyId: string, slotId: string) {
    return apiFetch<{ lobby: Lobby }>(
      `/api/lobbies/${lobbyId}/slots/${slotId}/book`,
      { method: "POST" }
    );
  },
  requestJoin(lobbyId: string, slotId: string) {
    return apiFetch<{ request: JoinRequest }>(
      `/api/lobbies/${lobbyId}/slots/${slotId}/request`,
      { method: "POST" }
    );
  },
  cancelJoinRequest(lobbyId: string) {
    return apiFetch<{ ok: boolean }>(
      `/api/lobbies/${lobbyId}/join-requests/me`,
      { method: "DELETE" }
    );
  },
  getMyJoinRequest(lobbyId: string) {
    return apiFetch<{ request: JoinRequest | null }>(
      `/api/lobbies/${lobbyId}/join-requests/me`
    );
  },
  listJoinRequests(lobbyId: string) {
    return apiFetch<{ requests: JoinRequest[] }>(
      `/api/lobbies/${lobbyId}/join-requests`
    );
  },
  acceptJoinRequest(lobbyId: string, requestId: string) {
    return apiFetch<{ lobby: Lobby }>(
      `/api/lobbies/${lobbyId}/join-requests/${requestId}/accept`,
      { method: "POST" }
    );
  },
  rejectJoinRequest(lobbyId: string, requestId: string) {
    return apiFetch<{ ok: boolean }>(
      `/api/lobbies/${lobbyId}/join-requests/${requestId}/reject`,
      { method: "POST" }
    );
  },
  releaseSlot(lobbyId: string, slotId: string) {
    return apiFetch<{ lobby: Lobby }>(
      `/api/lobbies/${lobbyId}/slots/${slotId}`,
      { method: "DELETE" }
    );
  },
  publishCard(lobbyId: string) {
    return apiFetch<{ messageId: string }>(`/api/lobbies/${lobbyId}/card`, {
      method: "POST",
    });
  },
  listVenues() {
    return apiFetch<{ venues: Venue[] }>("/api/venues");
  },
  listVenuesMap() {
    return apiFetch<{ venues: Venue[] }>("/api/venues/map");
  },
  createVenue(body: Record<string, unknown>) {
    return apiFetch<{ venue: Venue }>("/api/venues", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  getPassport(userId?: string) {
    return apiFetch<{ passport: Passport }>(
      userId ? `/api/passport/${userId}` : "/api/passport/me"
    );
  },
  getSportSkill(sport: string) {
    return apiFetch<{ skill: SportSkill | null }>(
      `/api/passport/skills/${sport}`
    );
  },
  saveSportSkill(
    sport: string,
    body: { gameLevel: string; preferredRoles: string[] }
  ) {
    return apiFetch<{ skill: SportSkill }>(`/api/passport/skills/${sport}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  deleteSportSkill(sport: string) {
    return apiFetch<{ ok: boolean }>(`/api/passport/skills/${sport}`, {
      method: "DELETE",
    });
  },
  getRoster(lobbyId: string) {
    return apiFetch<{ roster: RosterEntry[] }>(
      `/api/lobbies/${lobbyId}/roster`
    );
  },
  confirmOnSite(slotId: string, position?: { lat: number; lng: number }) {
    return apiFetch<{ ok: boolean }>(`/api/presence/${slotId}/on-site`, {
      method: "POST",
      body: position ? JSON.stringify(position) : undefined,
    });
  },
  confirmOnTheWay(slotId: string) {
    return apiFetch<{ ok: boolean }>(`/api/presence/${slotId}/on-the-way`, {
      method: "POST",
    });
  },
  markPresence(slotId: string, status: string) {
    return apiFetch<{ ok: boolean }>(`/api/presence/${slotId}/manual`, {
      method: "POST",
      body: JSON.stringify({ status }),
    });
  },
  cancelLobby(lobbyId: string) {
    return apiFetch<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/cancel`, {
      method: "POST",
    });
  },
  subscribeLobby(
    lobbyId: string,
    onMessage: (lobby: Lobby) => void,
    onError?: (error: Error) => void
  ) {
    const controller = new AbortController();
    void (async () => {
      while (!controller.signal.aborted) {
        try {
          const response = await fetch(
            `${API_BASE}/api/lobbies/${lobbyId}/stream`,
            {
              headers: { "X-Init-Data": getInitData() },
              signal: controller.signal,
            }
          );
          if (!response.ok || !response.body) {
            onError?.(new Error(`Realtime HTTP ${response.status}`));
            return;
          }

          const reader = response.body
            .pipeThrough(new TextDecoderStream())
            .getReader();
          let buffer = "";
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() ?? "";
            for (const frame of frames) {
              const data = frame
                .split(/\r?\n/)
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trimStart())
                .join("\n");
              if (!data) continue;
              try {
                onMessage(JSON.parse(data) as Lobby);
              } catch {
                // Ignore a malformed frame and keep the live stream running.
              }
            }
          }
        } catch (cause) {
          if (controller.signal.aborted) return;
          onError?.(
            cause instanceof Error ? cause : new Error("Realtime недоступен")
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
    })();
    return () => controller.abort();
  },
  startLobby(lobbyId: string) {
    return apiFetch<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/start`, {
      method: "POST",
    });
  },
  finishLobby(lobbyId: string) {
    return apiFetch<{ lobby: Lobby }>(`/api/lobbies/${lobbyId}/finish`, {
      method: "POST",
    });
  },
  submitKarma(body: {
    targetId: string;
    lobbyId: string;
    reliability: "on_time" | "late" | "no_show";
    tag?: string;
  }) {
    return apiFetch<{ ok: boolean }>("/api/karma/vote", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  getKarmaStatus(lobbyId: string) {
    return apiFetch<{
      status: {
        open: boolean;
        remainingTargets: number;
        votedTargetIds: string[];
      };
    }>(`/api/lobbies/${lobbyId}/karma/status`);
  },
};

export const ROLE_OPTIONS: Record<string, string[]> = {
  volleyball: ["Связующий", "Доигровщик", "Центральный блокирующий", "Либеро"],
  mini_football: ["Вратарь", "Защитник", "Полузащитник", "Нападающий"],
  basketball: ["Разыгрывающий", "Защитник", "Форвард", "Центровой"],
  padel_tennis: ["Левый", "Правый"],
  floorball: [
    "Вратарь",
    "Левый защитник",
    "Правый защитник",
    "Центральный нападающий",
    "Левый нападающий",
    "Правый нападающий",
  ],
  ice_hockey: [
    "Вратарь",
    "Левый защитник",
    "Правый защитник",
    "Центральный нападающий",
    "Левый крайний",
    "Правый крайний",
  ],
  water_polo: [
    "Вратарь",
    "Центральный нападающий",
    "Центральный защитник",
    "Левый край",
    "Правый край",
    "Подвижный нападающий",
  ],
  table_tennis: ["Одиночник", "Левый игрок пары", "Правый игрок пары"],
  airsoft: [
    "Командир",
    "Штурмовик",
    "Пулемётчик",
    "Снайпер",
    "Марксман",
    "Медик",
    "Гренадёр",
    "Инженер",
    "Радиооператор",
  ],
  paintball: [
    "Фронтовой игрок",
    "Игрок центра",
    "Тыловой игрок",
    "Снейк-игрок",
    "Дорито-игрок",
  ],
};

export const SPORT_LABELS: Record<string, string> = {
  volleyball: "Волейбол",
  mini_football: "Мини-футбол",
  basketball: "Баскетбол",
  padel_tennis: "Падел/Теннис",
  floorball: "Флорбол",
  ice_hockey: "Хоккей",
  water_polo: "Водное поло",
  table_tennis: "Настольный теннис",
  airsoft: "Страйкбол",
  paintball: "Пейнтбол",
};

export const LEVEL_LABELS: Record<string, string> = {
  novice: "Новичок",
  amateur: "Любитель",
  advanced: "Продвинутый",
};
