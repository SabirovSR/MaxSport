import { roleMarkKind, type RoleMarkKind } from "../lib/roleVisual";

function Person() {
  return (
    <g>
      <circle cx="8.6" cy="6.2" r="3.15" />
      <path d="M2.5 19.7c0-3.45 2.7-6.05 6.1-6.05s6.1 2.6 6.1 6.05V20.6H2.5z" />
    </g>
  );
}

function Accessory({ kind }: { kind: RoleMarkKind }) {
  switch (kind) {
    case "rifle":
      return (
        <g>
          <rect x="13.4" y="13.5" width="2.1" height="2.5" rx="0.35" />
          <rect x="15.2" y="13.15" width="5.3" height="1.55" rx="0.35" />
          <rect x="20.4" y="13.4" width="3" height="0.95" rx="0.2" />
          <rect x="16.7" y="11.35" width="1.55" height="1.8" rx="0.25" />
        </g>
      );
    case "assault":
      return (
        <g>
          <rect x="13.5" y="13.7" width="1.9" height="2.3" rx="0.3" />
          <rect x="15.1" y="13.2" width="4.6" height="1.55" rx="0.3" />
          <rect x="19.6" y="13.5" width="2.2" height="0.9" rx="0.2" />
          <rect x="16.5" y="14.7" width="1.15" height="2.3" rx="0.2" />
        </g>
      );
    case "lmg":
      return (
        <g>
          <rect x="13.2" y="13.4" width="2.2" height="2.7" rx="0.35" />
          <rect x="15.1" y="12.85" width="5.8" height="2" rx="0.4" />
          <rect x="20.8" y="13.3" width="2.4" height="1.05" rx="0.2" />
          <path
            d="M16.1 15.1v3.3M18.6 15.1v3.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </g>
      );
    case "medic":
      return (
        <path
          fillRule="evenodd"
          d="M14.3 11.1h7.1c.6 0 1.1.5 1.1 1.1v5.1c0 .6-.5 1.1-1.1 1.1h-7.1c-.6 0-1.1-.5-1.1-1.1v-5.1c0-.6.5-1.1 1.1-1.1zm2.55 2.05v1.15h-1.15v1.7h1.15v1.15h1.7v-1.15h1.15v-1.7h-1.15v-1.15z"
        />
      );
    case "grenade":
      return (
        <g>
          <rect x="17.15" y="10.9" width="2.3" height="1.7" rx="0.35" />
          <circle cx="18.3" cy="15.55" r="3.05" />
        </g>
      );
    case "engineer":
      return (
        <path d="M20.85 10.2l-1.15-1.15-1.2 1.2c-.85-.45-1.9-.3-2.55.35l1.55 1.55-3.7 3.7 1.45 1.45 3.7-3.7 1.55 1.55c.65-.65.8-1.7.35-2.55l1.2-1.2z" />
      );
    case "radio":
      return (
        <g>
          <rect x="15.55" y="12.15" width="5.3" height="6.7" rx="1" />
          <rect x="17.55" y="9.2" width="1.25" height="3" rx="0.35" />
          <circle cx="18.2" cy="15.15" r="0.85" />
        </g>
      );
    case "commander":
      return (
        <path d="M18.15 10.15l1.15 2.35 2.6.38-1.88 1.83.44 2.58-2.31-1.22-2.31 1.22.44-2.58-1.88-1.83 2.6-.38z" />
      );
    case "racket":
      return (
        <g>
          <ellipse
            cx="18.35"
            cy="12.2"
            rx="3.15"
            ry="3.95"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.55"
          />
          <rect x="17.7" y="16" width="1.3" height="4.7" rx="0.45" />
        </g>
      );
    case "stick":
      return (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <path d="M20.7 9.7l-6.15 10.15" />
          <path d="M13.45 19.2h4.55" />
        </g>
      );
    case "goalie":
      return (
        <g>
          <rect x="14.15" y="11.3" width="3.15" height="4.2" rx="1" />
          <rect x="18.15" y="11.3" width="3.15" height="4.2" rx="1" />
        </g>
      );
    case "defender":
      return (
        <path d="M18.2 10.2l4.15 1.45v3.35c0 2.25-1.75 3.85-4.15 4.7-2.4-.85-4.15-2.45-4.15-4.7v-3.35z" />
      );
    case "attacker":
    case "playmaker":
      return <circle cx="18.35" cy="14.35" r="2.55" />;
    default:
      return null;
  }
}

export function RoleMark({
  role,
  title,
}: {
  role?: string | null;
  title?: string;
}) {
  const kind = roleMarkKind(role);
  return (
    <svg
      className="role-mark"
      viewBox="0 0 24 24"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <Person />
      <Accessory kind={kind} />
    </svg>
  );
}
