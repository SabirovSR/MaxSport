import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

const TABS = [
  {
    to: "/",
    label: "Лента",
    icon: (
      <path d="M4 5h16M4 12h16M4 19h10" />
    ),
  },
  {
    to: "/create",
    label: "Создать",
    icon: <path d="M12 4v16M4 12h16" />,
  },
  {
    to: "/passport",
    label: "Паспорт",
    icon: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" />
      </>
    ),
  },
];

function TabIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="tab-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {children}
    </svg>
  );
}

export function TabBar() {
  const { pathname } = useLocation();
  const activePath = pathname.startsWith("/lobby/") ? "/" : pathname;

  return (
    <nav className="tabbar" aria-label="Основная навигация">
      {TABS.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          aria-current={activePath === tab.to ? "page" : undefined}
        >
          <TabIcon>{tab.icon}</TabIcon>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
