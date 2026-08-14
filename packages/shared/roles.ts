import type { Sport } from "./types.js";

export const SPORT_LABELS: Record<Sport, string> = {
  volleyball: "Волейбол",
  mini_football: "Мини-футбол",
  basketball: "Баскетбол",
  padel_tennis: "Падел/Теннис",
};

export const ROLE_OPTIONS: Record<Sport, string[]> = {
  volleyball: ["Связующий", "Доигровщик", "Центральный блокирующий", "Либеро"],
  mini_football: ["Вратарь", "Защитник", "Полузащитник", "Нападающий"],
  basketball: ["Разыгрывающий", "Защитник", "Форвард", "Центровой"],
  padel_tennis: ["Левый", "Правый"],
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
};
