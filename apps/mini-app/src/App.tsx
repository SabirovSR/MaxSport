import { useEffect } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { getStartParam } from "./api";
import { Mark } from "./components/Mark";
import { TabBar } from "./components/TabBar";
import { HomePage } from "./pages/HomePage";
import { LobbyPage } from "./pages/LobbyPage";
import { CreateLobbyPage } from "./pages/CreateLobbyPage";
import { PassportPage } from "./pages/PassportPage";
import { RosterPage } from "./pages/RosterPage";
import { KarmaPage } from "./pages/KarmaPage";
import { useMe } from "./lib/useMe";
import { useBackButton } from "./lib/useBackButton";
import { initialsOf } from "./lib/format";
import { ToastProvider } from "./components/Toast";
import { EditLobbyPage } from "./pages/EditLobbyPage";

export function App() {
  const navigate = useNavigate();
  useBackButton();
  const { me } = useMe();
  const photoUrl = window.WebApp?.initDataUnsafe?.user?.photo_url;
  const reliability = me?.user.reliabilityPct ?? 0;

  useEffect(() => {
    window.WebApp?.ready?.();
  }, []);

  useEffect(() => {
    const start = getStartParam();
    if (start?.startsWith("lobby_")) {
      navigate(`/lobby/${start.slice("lobby_".length)}`, { replace: true });
    }
  }, [navigate]);

  return (
    <ToastProvider>
      <div className="app-shell">
        <div className="page">
          <header className="header">
          <Link to="/" className="logo">
            <Mark size={26} />
            MAX <span>Sport</span>
          </Link>
          <Link
            to="/passport"
            className="avatar-ring"
            aria-label="Игровой паспорт"
            style={{
              background: `conic-gradient(var(--ms-accent) ${reliability * 3.6}deg, var(--ms-border-subtle) 0)`,
            }}
          >
            {photoUrl ? (
              <img
                className="avatar"
                src={photoUrl}
                alt=""
                width={32}
                height={32}
              />
            ) : (
              <span className="avatar">
                {me ? initialsOf(me.user.firstName, me.user.lastName) : ""}
              </span>
            )}
          </Link>
          </header>

          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lobby/:id" element={<LobbyPage />} />
            <Route path="/lobby/:id/roster" element={<RosterPage />} />
            <Route path="/lobby/:id/karma" element={<KarmaPage />} />
            <Route path="/lobby/:id/edit" element={<EditLobbyPage />} />
            <Route path="/create" element={<CreateLobbyPage />} />
            <Route path="/passport" element={<PassportPage />} />
            <Route path="/passport/:userId" element={<PassportPage />} />
          </Routes>
        </div>
        <TabBar />
      </div>
    </ToastProvider>
  );
}
