import type { Sport } from "./types.js";

export const SPORT_LABELS: Record<Sport, string> = {
  volleyball: "Волейбол",
  mini_football: "Мини-футбол",
  basketball: "Баскетбол",
  padel_tennis: "Падел/Теннис",
  floorball: "Флорбол",
  ice_hockey: "Хоккей",
  water_polo: "Водное поло",
  table_tennis: "Настольный теннис",
  airsoft: "Страйкбол",
  paintball: "Пейнтбол",
};

export const ROLE_OPTIONS: Record<Sport, string[]> = {
  volleyball: ["Связующий", "Доигровщик", "Центральный блокирующий", "Либеро"],
  mini_football: ["Вратарь", "Защитник", "Полузащитник", "Нападающий"],
  basketball: ["Разыгрывающий", "Защитник", "Форвард", "Центровой"],
  padel_tennis: ["Левый", "Правый"],
  floorball: [
    "Вратарь",
    "Левый защитник",
    "Правый защитник",
    "Центральный нападающий",
    "Левый нападающий",
    "Правый нападающий",
  ],
  ice_hockey: [
    "Вратарь",
    "Левый защитник",
    "Правый защитник",
    "Центральный нападающий",
    "Левый крайний",
    "Правый крайний",
  ],
  water_polo: [
    "Вратарь",
    "Центральный нападающий",
    "Центральный защитник",
    "Левый край",
    "Правый край",
    "Подвижный нападающий",
  ],
  table_tennis: ["Одиночник", "Левый игрок пары", "Правый игрок пары"],
  airsoft: [
    "Командир",
    "Штурмовик",
    "Пулемётчик",
    "Снайпер",
    "Марксман",
    "Медик",
    "Гренадёр",
    "Инженер",
    "Радиооператор",
  ],
  paintball: [
    "Фронтовой игрок",
    "Игрок центра",
    "Тыловой игрок",
    "Снейк-игрок",
    "Дорито-игрок",
  ],
};

export const GAME_LEVEL_LABELS = {
  novice: "Новичок",
  amateur: "Любитель",
  advanced: "Продвинутый",
} as const;

export const KARMA_TAGS: Record<Sport, string[]> = {
  volleyball: ["отличный командный", "крутой пас", "пушечный удар"],
  mini_football: ["надёжный вратарь", "точный пас", "быстрый форвард"],
  basketball: ["точный бросок", "жёсткая защита", "отличный пас"],
  padel_tennis: ["сильная подача", "точный удар", "хорошая игра у сетки"],
  floorball: ["точный пас", "сильный бросок", "цепкая защита"],
  ice_hockey: ["точный пас", "сильный бросок", "надёжная защита"],
  water_polo: ["точная передача", "сильный бросок", "плотная защита"],
  table_tennis: ["сильная подача", "точное вращение", "надёжный партнёр"],
  airsoft: ["тактичный игрок", "точный стрелок", "надёжный напарник"],
  paintball: ["быстрый прорыв", "точная стрельба", "командная игра"],
};

export function isSport(value: string): value is Sport {
  return Object.prototype.hasOwnProperty.call(SPORT_LABELS, value);
}

export function normalizePreferredRoles(
  sport: Sport,
  roles: string[]
): string[] | null {
  const normalized = [...new Set(roles.map((role) => role.trim()))].filter(
    Boolean
  );
  if (
    normalized.length > 4 ||
    normalized.some((role) => !ROLE_OPTIONS[sport].includes(role))
  ) {
    return null;
  }
  return normalized;
}
