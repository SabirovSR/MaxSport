export type Sport = "volleyball" | "mini_football" | "basketball" | "padel_tennis";

export type GameLevel = "novice" | "amateur" | "advanced";

export type LobbyStatus =
  | "draft"
  | "open"
  | "full"
  | "gathering"
  | "started"
  | "finished"
  | "cancelled";

export type PresenceStatus =
  | "expected"
  | "on_the_way"
  | "on_site"
  | "no_show"
  | "cancelled";

export type PaymentHoldStatus =
  | "hold_pending"
  | "held"
  | "charge_pending"
  | "charged"
  | "released"
  | "forfeit";

export type ScheduledJobKind =
  | "reminder_t24"
  | "reminder_t2"
  | "reminder_t30"
  | "presence_window"
  | "venue_ping_t60"
  | "no_show_check"
  | "karma_poll";

export interface User {
  id: string;
  maxUserId: number;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  gameLevel: GameLevel;
  reliabilityPct: number;
  gamesPlayed: number;
  createdAt: Date;
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  venueChatId: number | null;
  createdBy: string;
}

export interface Slot {
  id: string;
  lobbyId: string;
  roleRequired: string | null;
  userId: string | null;
  version: number;
  index: number;
}

export interface Lobby {
  id: string;
  sport: Sport;
  gameLevel: GameLevel;
  status: LobbyStatus;
  startAt: Date;
  isRecurring: boolean;
  venueId: string;
  organizerId: string;
  rentTotal: number;
  depositEnabled: boolean;
  slotCount: number;
  cardMessageId: string | null;
  cardChatId: number | null;
  createdAt: Date;
}

export interface LobbyWithDetails extends Lobby {
  venue: Venue;
  organizer: User;
  slots: Slot[];
  filledCount: number;
  splitPerPlayer: number;
}

export interface PresenceRecord {
  id: string;
  slotId: string;
  lobbyId: string;
  userId: string;
  status: PresenceStatus;
  updatedAt: Date;
}

export interface KarmaVote {
  id: string;
  voterId: string;
  targetId: string;
  lobbyId: string;
  reliability: "on_time" | "late" | "no_show";
  tag: string | null;
}

export interface Badge {
  id: string;
  code: string;
  title: string;
  description: string;
}

export interface UserBadge {
  userId: string;
  badgeId: string;
  earnedAt: Date;
}
