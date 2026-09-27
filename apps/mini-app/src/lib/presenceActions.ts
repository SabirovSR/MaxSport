export type MarkableStatus = "on_the_way" | "on_site" | "no_show";

export function markableStatuses(input: {
  entryUserId: string;
  actorUserId: string | null;
  isOrganizer: boolean;
  current: string;
}): MarkableStatus[] {
  const isSelf =
    Boolean(input.actorUserId) && input.entryUserId === input.actorUserId;
  const allowed: MarkableStatus[] = isSelf
    ? ["on_the_way", "on_site"]
    : input.isOrganizer
      ? ["on_site", "no_show"]
      : [];
  return allowed.filter((status) => status !== input.current);
}
