import { Link } from "react-router-dom";
import type { PublicPlayer } from "../api";
import { initialsOf } from "../lib/format";

export function PlayerChip({
  player,
  suffix,
  linked = true,
}: {
  player: PublicPlayer;
  suffix?: string;
  linked?: boolean;
}) {
  const content = (
    <>
      {player.photoUrl ? (
        <img className="avatar avatar-small" src={player.photoUrl} alt="" />
      ) : (
        <span className="avatar avatar-small">
          {initialsOf(player.firstName, player.lastName)}
        </span>
      )}
      <span>
        {player.firstName} {player.lastName ?? ""}
        {suffix}
      </span>
    </>
  );

  return linked ? (
    <Link className="player-chip" to={`/passport/${player.id}`}>
      {content}
    </Link>
  ) : (
    <span className="player-chip">{content}</span>
  );
}
