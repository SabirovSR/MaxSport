import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@maxhub/max-ui";
import { api } from "../api";

const TAGS = ["отличный командный", "крутой пас", "пушечный удар"];

export function KarmaPage() {
  const { id } = useParams<{ id: string }>();
  const [targetId, setTargetId] = useState("");
  const [reliability, setReliability] = useState<"on_time" | "late" | "no_show">("on_time");
  const [tag, setTag] = useState(TAGS[0]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!id || !targetId) {
      setError("Укажите ID игрока");
      return;
    }
    try {
      await api.submitKarma({ targetId, lobbyId: id, reliability, tag });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка");
    }
  }

  if (done) {
    return (
      <>
        <h2>Спасибо!</h2>
        <p>Карма обновлена. Бейдж «Спасатель матча» начисляется автоматически.</p>
      </>
    );
  }

  return (
    <>
      <h2>Карма — 10 секунд</h2>
      <div className="form-group">
        <label>ID игрока (target)</label>
        <input value={targetId} onChange={(e) => setTargetId(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Надёжность</label>
        <select
          value={reliability}
          onChange={(e) => setReliability(e.target.value as typeof reliability)}
        >
          <option value="on_time">Пришёл вовремя</option>
          <option value="late">Опоздал</option>
          <option value="no_show">Не пришёл</option>
        </select>
      </div>
      <div className="form-group">
        <label>Спортивный тег</label>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          {TAGS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <Button variant="primary" stretched onClick={submit}>
        Отправить
      </Button>
    </>
  );
}
