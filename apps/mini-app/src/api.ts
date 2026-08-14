const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export function getInitData(): string {
  return window.WebApp?.initData ?? "";
}

export function getStartParam(): string | undefined {
  return window.WebApp?.initDataUnsafe?.start_param;
}

async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Init-Data": getInitData(),
      ...(init?.headers ?? {}),
    },
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
  venue: { id: string; name: string; address: string; lat: number; lng: number };
  organizer: { id: string; firstName: string; lastName: string | null };
  slots: Array<{
    id: string;
    roleRequired: string | null;
    userId: string | null;
    index: number;
  }>;
  filledCount: number;
  slotCount: number;
  splitPerPlayer: number;
  rentTotal: number;
  depositEnabled: boolean;
  cardMessageId: string | null;
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
    reliabilityPct: number;
    gamesPlayed: number;
    gameLevel: string;
  };
  badges: Array<{ code: string; title: string; description: string }>;
  attendancePct: number;
}

export interface RosterEntry {
  slotId: string;
  userId: string;
  firstName: string;
  lastName: string | null;
  roleRequired: string | null;
  status: string;
}

export const api = {
  listLobbies(params?: { sport?: string; hotOnly?: boolean }) {
    const search = new URLSearchParams();
    if (params?.sport) search.set("sport", params.sport);
    if (params?.hotOnly) search.set("hotOnly", "true");
    const q = search.toString();
    return apiFetch<{ lobbies: Lobby[] }>(`/api/lobbies${q ? `?${q}` : ""}`);
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
  bookSlot(lobbyId: string, slotId: string) {
    return apiFetch<{ lobby: Lobby }>(
      `/api/lobbies/${lobbyId}/slots/${slotId}/book`,
      { method: "POST" }
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
  getRoster(lobbyId: string) {
    return apiFetch<{ roster: RosterEntry[] }>(`/api/lobbies/${lobbyId}/roster`);
  },
  confirmOnSite(slotId: string) {
    return apiFetch<{ ok: boolean }>(`/api/presence/${slotId}/on-site`, {
      method: "POST",
    });
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
};

export const SPORT_LABELS: Record<string, string> = {
  volleyball: "Волейбол",
  mini_football: "Мини-футбол",
  basketball: "Баскетбол",
  padel_tennis: "Падел/Теннис",
};

export const LEVEL_LABELS: Record<string, string> = {
  novice: "Новичок",
  amateur: "Любитель",
  advanced: "Продвинутый",
};
