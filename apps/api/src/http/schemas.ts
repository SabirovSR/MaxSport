import { Type, type Static } from "@sinclair/typebox";

function literals<T extends string>(values: readonly T[]) {
  return Type.Union(values.map((value) => Type.Literal(value)));
}

const Id = Type.String({ minLength: 1, maxLength: 64 });

export const SportSchema = literals([
  "volleyball",
  "mini_football",
  "basketball",
  "padel_tennis",
  "floorball",
  "ice_hockey",
  "water_polo",
  "table_tennis",
  "airsoft",
  "paintball",
] as const);

export const GameLevelSchema = literals([
  "novice",
  "amateur",
  "advanced",
  "any",
] as const);

export const JoinModeSchema = literals(["instant", "approval"] as const);

export const PresenceStatusSchema = literals([
  "expected",
  "on_the_way",
  "on_site",
  "no_show",
  "cancelled",
] as const);

export const ReliabilitySchema = literals([
  "on_time",
  "late",
  "no_show",
] as const);

export const SkillLevelSchema = literals([
  "novice",
  "amateur",
  "advanced",
] as const);

export const IdParams = Type.Object({ id: Id });
export const UserIdParams = Type.Object({ userId: Id });
export const SportParams = Type.Object({
  sport: Type.String({ minLength: 1 }),
});
export const SlotParams = Type.Object({ id: Id, slotId: Id });
export const SlotIdParams = Type.Object({ slotId: Id });
export const JoinRequestParams = Type.Object({ id: Id, requestId: Id });

export const LobbyListQuery = Type.Object({
  sport: Type.Optional(SportSchema),
  gameLevel: Type.Optional(GameLevelSchema),
  hotOnly: Type.Optional(Type.String()),
  lat: Type.Optional(Type.String()),
  lng: Type.Optional(Type.String()),
  nearbyOnly: Type.Optional(Type.String()),
  radiusM: Type.Optional(Type.String()),
});

const RoleSlot = Type.Object({
  index: Type.Integer({ minimum: 0 }),
  role: Type.String({ minLength: 1 }),
});

export const CreateLobbyBody = Type.Object({
  sport: SportSchema,
  gameLevel: GameLevelSchema,
  startAt: Type.String({ minLength: 1 }),
  isRecurring: Type.Optional(Type.Boolean()),
  venueId: Id,
  rentTotal: Type.Integer({ minimum: 0 }),
  depositEnabled: Type.Optional(Type.Boolean()),
  slotCount: Type.Integer({ minimum: 2, maximum: 40 }),
  roleSlots: Type.Optional(Type.Array(RoleSlot)),
  joinMode: Type.Optional(JoinModeSchema),
});

export const PatchLobbyBody = Type.Object({
  startAt: Type.Optional(Type.String({ minLength: 1 })),
  venueId: Type.Optional(Id),
  gameLevel: Type.Optional(GameLevelSchema),
  rentTotal: Type.Optional(Type.Integer({ minimum: 0 })),
  depositEnabled: Type.Optional(Type.Boolean()),
  slotCount: Type.Optional(Type.Integer({ minimum: 2, maximum: 40 })),
  roleSlots: Type.Optional(Type.Array(RoleSlot)),
  joinMode: Type.Optional(JoinModeSchema),
});

export const SlotRoleBody = Type.Object({
  role: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export const OnSiteBody = Type.Object({
  lat: Type.Optional(Type.Number()),
  lng: Type.Optional(Type.Number()),
});

export const ManualPresenceBody = Type.Object({
  status: PresenceStatusSchema,
});

export const SportSkillBody = Type.Object({
  gameLevel: SkillLevelSchema,
  preferredRoles: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
});

export const KarmaVoteBody = Type.Object({
  targetId: Id,
  lobbyId: Id,
  reliability: ReliabilitySchema,
  tag: Type.Optional(Type.String()),
});

export const CreateVenueBody = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 200 }),
  address: Type.String({ minLength: 1, maxLength: 400 }),
  lat: Type.Number({ minimum: -90, maximum: 90 }),
  lng: Type.Number({ minimum: -180, maximum: 180 }),
  venueChatId: Type.Optional(Type.Integer()),
});

export const GeoSuggestQuery = Type.Object({
  text: Type.Optional(Type.String()),
  lat: Type.Optional(Type.String()),
  lng: Type.Optional(Type.String()),
});

export const GeoGeocodeQuery = Type.Object({
  query: Type.Optional(Type.String()),
  uri: Type.Optional(Type.String()),
});

export const GeoPointQuery = Type.Object({
  lat: Type.String({ minLength: 1 }),
  lng: Type.String({ minLength: 1 }),
});

export const GeoStaticQuery = Type.Object({
  lat: Type.String({ minLength: 1 }),
  lng: Type.String({ minLength: 1 }),
  zoom: Type.Optional(Type.String()),
  width: Type.Optional(Type.String()),
  height: Type.Optional(Type.String()),
});

export const WebhookBody = Type.Object(
  { update_type: Type.Optional(Type.String()) },
  { additionalProperties: true }
);

export type LobbyListQuery = Static<typeof LobbyListQuery>;
export type CreateLobbyBody = Static<typeof CreateLobbyBody>;
export type PatchLobbyBody = Static<typeof PatchLobbyBody>;
export type SlotRoleBody = Static<typeof SlotRoleBody>;
export type OnSiteBody = Static<typeof OnSiteBody>;
export type ManualPresenceBody = Static<typeof ManualPresenceBody>;
export type SportSkillBody = Static<typeof SportSkillBody>;
export type KarmaVoteBody = Static<typeof KarmaVoteBody>;
export type CreateVenueBody = Static<typeof CreateVenueBody>;
export type GeoSuggestQuery = Static<typeof GeoSuggestQuery>;
export type GeoGeocodeQuery = Static<typeof GeoGeocodeQuery>;
export type GeoPointQuery = Static<typeof GeoPointQuery>;
export type GeoStaticQuery = Static<typeof GeoStaticQuery>;
export type WebhookBody = Static<typeof WebhookBody>;
