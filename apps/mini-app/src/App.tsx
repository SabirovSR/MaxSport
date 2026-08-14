import { useEffect } from "react";
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { getStartParam } from "./api";
import { HomePage } from "./pages/HomePage";
import { LobbyPage } from "./pages/LobbyPage";
import { CreateLobbyPage } from "./pages/CreateLobbyPage";
import { PassportPage } from "./pages/PassportPage";
import { RosterPage } from "./pages/RosterPage";
import { KarmaPage } from "./pages/KarmaPage";

export function App() {
  const navigate = useNavigate();

  useEffect(() => {
    const start = getStartParam();
    if (start?.startsWith("lobby_")) {
      navigate(`/lobby/${start.slice("lobby_".length)}`, { replace: true });
    }
  }, [navigate]);

  if (window.WebApp?.ready) {
    window.WebApp.ready();
  }

  return (
    <div className="page">
      <header className="header">
        <Link to="/" className="logo" style={{ textDecoration: "none", color: "inherit" }}>
          MAX <span>Sport</span>
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="small" variant="secondary" onClick={() => navigate("/create")}>
            +
          </Button>
          <Button size="small" variant="secondary" onClick={() => navigate("/passport")}>
            👤
          </Button>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/lobby/:id" element={<LobbyPage />} />
        <Route path="/lobby/:id/roster" element={<RosterPage />} />
        <Route path="/lobby/:id/karma" element={<KarmaPage />} />
        <Route path="/create" element={<CreateLobbyPage />} />
        <Route path="/passport" element={<PassportPage />} />
      </Routes>
    </div>
  );
}
