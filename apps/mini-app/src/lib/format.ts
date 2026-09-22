const MY_SPORTS_KEY = "ms-my-sports";

export function readMySports(): string[] {
  try {
    const raw = localStorage.getItem(MY_SPORTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** The "мои виды спорта" chip reads this set; creating or filtering a sport writes it. */
export function rememberSport(code: string) {
  try {
    const current = readMySports();
    if (current.includes(code)) return;
    localStorage.setItem(MY_SPORTS_KEY, JSON.stringify([...current, code]));
  } catch {
    // Private mode: the chip simply stays empty.
  }
}

export function forgetSport(code: string) {
  try {
    const next = readMySports().filter((item) => item !== code);
    localStorage.setItem(MY_SPORTS_KEY, JSON.stringify(next));
  } catch {
    // Private mode: there is nothing persistent to update.
  }
}

export function formatDistance(metres?: number): string | null {
  if (metres == null || !Number.isFinite(metres)) return null;
  if (metres < 950) return `${Math.round(metres / 10) * 10} м`;
  return `${(metres / 1000).toFixed(1).replace(".", ",")} км`;
}

export function formatStartAt(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const withinWeek = date.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000;

  return date.toLocaleString("ru-RU", {
    weekday: withinWeek ? "short" : undefined,
    day: withinWeek ? undefined : "numeric",
    month: withinWeek ? undefined : "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatMoney(rubles: number): string {
  return `${rubles.toLocaleString("ru-RU")} ₽`;
}

export function initialsOf(firstName: string, lastName?: string | null) {
  const first = firstName.trim().charAt(0);
  const second = lastName?.trim().charAt(0) ?? "";
  return (first + second).toUpperCase();
}

/** Мест осталось, in the accusative forms Russian needs. */
export function pluralSlots(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} место`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} места`;
  }
  return `${count} мест`;
}
