import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "Лента" },
  { to: "/create", label: "Создать" },
  { to: "/passport", label: "Паспорт" },
];

export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Основная навигация">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} end={tab.to === "/"}>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
