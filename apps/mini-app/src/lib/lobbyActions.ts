import type { Lobby } from "../api";

export function canJoinLobby(status: string) {
  return status === "open" || status === "gathering";
}

export function canEditLobby(status: string) {
  return status === "open" || status === "full" || status === "gathering";
}

export function canRateLobby(
  lobby: Pick<Lobby, "status">,
  isParticipant: boolean,
  remainingTargets: number
) {
  return lobby.status === "finished" && isParticipant && remainingTargets > 0;
}
