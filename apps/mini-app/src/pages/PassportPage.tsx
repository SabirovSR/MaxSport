import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api, LEVEL_LABELS, type Lobby, type Passport } from "../api";

export function PassportPage() {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [nearest, setNearest] = useState<Lobby | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [passportData, lobbiesData] = await Promise.all([
          api.getPassport(),
          api.listLobbies(),
        ]);
        setPassport(passportData.passport);
        const userId = passportData.passport.user.id;
        const mine = lobbiesData.lobbies.find((l) =>
          l.slots.some((s) => s.userId === userId)
        );
        setNearest(mine ?? lobbiesData.lobbies[0] ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ошибка");
      }
    })();
  }, []);

  async function markOnSite() {
    if (!nearest) return;
    const mySlot = nearest.slots.find((s) => s.userId === passport?.user.id);
    if (!mySlot) return;
    setBusy(true);
    try {
      await api.confirmOnSite(mySlot.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (error && !passport) return <p style={{ color: "#f87171" }}>{error}</p>;
  if (!passport) return <p>Загрузка…</p>;

  const name = [passport.user.firstName, passport.user.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <h2>Игровой паспорт</h2>
      <p style={{ fontSize: "1.5rem", fontWeight: 600 }}>{name}</p>
      <p style={{ color: "#888" }}>
        Надёжность: {passport.user.reliabilityPct}% • Игр:{" "}
        {passport.user.gamesPlayed} • Явка: {passport.attendancePct}%
      </p>
      <p>Уровень: {LEVEL_LABELS[passport.user.gameLevel]}</p>

      {nearest && (
        <div className="lobby-card" style={{ marginTop: 16 }}>
          <h3>Ближайшее Лобби</h3>
          <p>
            {new Date(nearest.startAt).toLocaleString("ru-RU")} •{" "}
            {nearest.venue.name}
          </p>
          <Link to={`/lobby/${nearest.id}`} style={{ color: "#c8f54a" }}>
            Открыть
          </Link>
          <div style={{ marginTop: 12 }}>
            <Button variant="primary" loading={busy} onClick={markOnSite}>
              Я на месте
            </Button>
          </div>
        </div>
      )}

      <h3 style={{ marginTop: 24 }}>Бейджи</h3>
      {passport.badges.length === 0 && (
        <p style={{ color: "#888" }}>Пока нет бейджей</p>
      )}
      {passport.badges.map((b) => (
        <span key={b.code} className="badge" title={b.description}>
          {b.title}
        </span>
      ))}
    </>
  );
}
