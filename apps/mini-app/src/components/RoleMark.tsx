import { roleMarkKind, type RoleMarkKind } from "../lib/roleVisual";

function Person() {
  return (
    <g>
      <circle cx="12" cy="6.4" r="3.15" />
      <path d="M5.9 19.8c0-3.45 2.7-6.05 6.1-6.05s6.1 2.6 6.1 6.05V20.7H5.9z" />
    </g>
  );
}

function Accessory({ kind }: { kind: RoleMarkKind }) {
  switch (kind) {
    case "rifle":
      return (
        <g>
          <rect x="12.2" y="13.6" width="1.9" height="2.3" rx="0.3" />
          <rect x="13.8" y="13.3" width="4.8" height="1.45" rx="0.3" />
          <rect x="18.5" y="13.55" width="2.6" height="0.9" rx="0.2" />
          <rect x="15.2" y="11.55" width="1.4" height="1.7" rx="0.25" />
        </g>
      );
    case "assault":
      return (
        <g>
          <rect x="12.4" y="13.8" width="1.7" height="2.1" rx="0.3" />
          <rect x="13.8" y="13.35" width="4.2" height="1.45" rx="0.3" />
          <rect x="17.9" y="13.6" width="2" height="0.85" rx="0.2" />
          <rect x="15.1" y="14.75" width="1.05" height="2.1" rx="0.2" />
        </g>
      );
    case "lmg":
      return (
        <g>
          <rect x="12" y="13.5" width="2" height="2.5" rx="0.3" />
          <rect x="13.7" y="13" width="5.2" height="1.85" rx="0.35" />
          <rect x="18.8" y="13.4" width="2.1" height="0.95" rx="0.2" />
          <path
            d="M14.8 15v3M17.1 15v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
        </g>
      );
    case "medic":
      return (
        <path
          fillRule="evenodd"
          d="M13.2 11.4h6.4c.5 0 1 .45 1 1v4.6c0 .55-.5 1-1 1h-6.4c-.5 0-1-.45-1-1v-4.6c0-.55.5-1 1-1zm2.25 1.85v1.05h-1.05v1.55h1.05v1.05h1.55v-1.05h1.05v-1.55h-1.05v-1.05z"
        />
      );
    case "grenade":
      return (
        <g>
          <rect x="15.7" y="11.1" width="2.1" height="1.55" rx="0.3" />
          <circle cx="16.75" cy="15.4" r="2.75" />
        </g>
      );
    case "engineer":
      return (
        <path d="M19.4 10.5l-1.05-1.05-1.1 1.1c-.75-.4-1.7-.25-2.3.35l1.4 1.4-3.3 3.3 1.3 1.3 3.3-3.3 1.4 1.4c.6-.6.75-1.55.35-2.3l1.1-1.1z" />
      );
    case "radio":
      return (
        <g>
          <rect x="14.4" y="12.3" width="4.7" height="6" rx="0.9" />
          <rect x="16.15" y="9.5" width="1.15" height="2.8" rx="0.3" />
          <circle cx="16.75" cy="15.1" r="0.75" />
        </g>
      );
    case "commander":
      return (
        <path d="M16.6 10.4l1 2.1 2.3.35-1.65 1.6.4 2.3-2.05-1.1-2.05 1.1.4-2.3-1.65-1.6 2.3-.35z" />
      );
    case "racket":
      return (
        <g>
          <ellipse
            cx="16.7"
            cy="12.4"
            rx="2.8"
            ry="3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.45"
          />
          <rect x="16.1" y="15.8" width="1.2" height="4.2" rx="0.4" />
        </g>
      );
    case "stick":
      return (
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="1.65"
          strokeLinecap="round"
        >
          <path d="M19.2 10.1l-5.4 9.2" />
          <path d="M12.7 18.7h4.1" />
        </g>
      );
    case "goalie":
      return (
        <g>
          <rect x="13.1" y="11.5" width="2.85" height="3.8" rx="0.9" />
          <rect x="16.7" y="11.5" width="2.85" height="3.8" rx="0.9" />
        </g>
      );
    case "defender":
      return (
        <path d="M16.6 10.5l3.6 1.25v2.95c0 2-1.5 3.4-3.6 4.15-2.1-.75-3.6-2.15-3.6-4.15v-2.95z" />
      );
    case "attacker":
    case "playmaker":
      return <circle cx="16.7" cy="14.5" r="2.25" />;
    default:
      return null;
  }
}

function MarkShapes({ kind }: { kind: RoleMarkKind }) {
  return (
    <>
      <Person />
      <Accessory kind={kind} />
    </>
  );
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
      <g className="role-mark-edge">
        <MarkShapes kind={kind} />
      </g>
      <g className="role-mark-body">
        <MarkShapes kind={kind} />
      </g>
    </svg>
  );
}
