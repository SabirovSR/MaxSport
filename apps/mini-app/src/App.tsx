import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { getStartParam } from "./api";
import { InboxBell } from "./components/InboxBell";
import { Mark } from "./components/Mark";
import { Onboarding } from "./components/Onboarding";
import { TabBar } from "./components/TabBar";
import { HomePage } from "./pages/HomePage";
import { LobbyPage } from "./pages/LobbyPage";
import { CreateLobbyPage } from "./pages/CreateLobbyPage";
import { PassportPage } from "./pages/PassportPage";
import { RosterPage } from "./pages/RosterPage";
import { KarmaPage } from "./pages/KarmaPage";
import { shouldShowOnboarding, subscribeOnboarding } from "./lib/onboarding";
import { useMe } from "./lib/useMe";
import { useBackButton } from "./lib/useBackButton";
import { initialsOf } from "./lib/format";
import { ToastProvider } from "./components/Toast";
import { EditLobbyPage } from "./pages/EditLobbyPage";

export function App() {
  const navigate = useNavigate();
  const { search } = useLocation();
  useBackButton();
  const { me } = useMe();
  const photoUrl = window.WebApp?.initDataUnsafe?.user?.photo_url;
  const reliability = me?.user.reliabilityPct ?? 0;
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    window.WebApp?.ready?.();
  }, []);

  useEffect(() => subscribeOnboarding(() => setOnboarding(true)), []);

  useEffect(() => {
    if (new URLSearchParams(search).get("onboarding") === "1") {
      setOnboarding(true);
    }
  }, [search]);

  useEffect(() => {
    if (!me) return;
    const start = getStartParam();
    if (start?.startsWith("lobby_") || start?.startsWith("roster_")) return;
    if (shouldShowOnboarding(me.user.gamesPlayed)) setOnboarding(true);
  }, [me]);

  useEffect(() => {
    const start = getStartParam();
    if (start?.startsWith("roster_")) {
      navigate(`/lobby/${start.slice("roster_".length)}/roster`, {
        replace: true,
      });
    } else if (start?.startsWith("lobby_")) {
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
            <div className="header-actions">
              <InboxBell />
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
            </div>
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
      {onboarding && <Onboarding onClose={() => setOnboarding(false)} />}
    </ToastProvider>
  );
}
