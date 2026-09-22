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

export type SlotCase =
  | "nominative"
  | "genitive"
  | "accusative"
  | "dative"
  | "instrumental"
  | "prepositional";

const SLOT_FORMS: Record<SlotCase, [string, string, string]> = {
  nominative: ["слот", "слота", "слотов"],
  genitive: ["слота", "слотов", "слотов"],
  accusative: ["слот", "слота", "слотов"],
  dative: ["слоту", "слотам", "слотам"],
  instrumental: ["слотом", "слотами", "слотами"],
  prepositional: ["слоте", "слотах", "слотах"],
};

function slotPluralIndex(count: number): 0 | 1 | 2 {
  const n = Math.abs(Math.trunc(count)) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 2;
  if (n1 === 1) return 0;
  if (n1 >= 2 && n1 <= 4) return 1;
  return 2;
}

export function slotWord(count = 1, form: SlotCase = "nominative"): string {
  return SLOT_FORMS[form][slotPluralIndex(count)];
}

const SLOT_PLURAL: Record<SlotCase, string> = {
  nominative: "слоты",
  genitive: "слотов",
  accusative: "слоты",
  dative: "слотам",
  instrumental: "слотами",
  prepositional: "слотах",
};

/** Слово «слот» без числительного: «остальные слоты», «по слотам». */
export function slotNoun(
  plural = false,
  form: SlotCase = "nominative"
): string {
  return plural ? SLOT_PLURAL[form] : SLOT_FORMS[form][0];
}

export function formatSlots(
  count: number,
  form: SlotCase = "nominative"
): string {
  return `${count} ${slotWord(count, form)}`;
}

/** Сколько слотов осталось свободными. */
export function pluralSlots(count: number): string {
  return formatSlots(count, "nominative");
}
