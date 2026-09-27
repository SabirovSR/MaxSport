export type RoleMarkKind =
  | "player"
  | "goalie"
  | "defender"
  | "attacker"
  | "playmaker"
  | "racket"
  | "stick"
  | "commander"
  | "rifle"
  | "assault"
  | "lmg"
  | "medic"
  | "grenade"
  | "engineer"
  | "radio";

const ROLE_MARKS: Record<string, RoleMarkKind> = {
  Связующий: "playmaker",
  Доигровщик: "attacker",
  "Центральный блокирующий": "defender",
  Либеро: "goalie",
  Вратарь: "goalie",
  Защитник: "defender",
  Полузащитник: "playmaker",
  Нападающий: "attacker",
  Разыгрывающий: "playmaker",
  Форвард: "attacker",
  Центровой: "defender",
  Левый: "racket",
  Правый: "racket",
  "Левый защитник": "defender",
  "Правый защитник": "defender",
  "Центральный нападающий": "attacker",
  "Левый нападающий": "attacker",
  "Правый нападающий": "attacker",
  "Левый крайний": "stick",
  "Правый крайний": "stick",
  "Центральный защитник": "defender",
  "Левый край": "attacker",
  "Правый край": "attacker",
  "Подвижный нападающий": "attacker",
  Одиночник: "racket",
  "Левый игрок пары": "racket",
  "Правый игрок пары": "racket",
  Командир: "commander",
  Штурмовик: "assault",
  Пулемётчик: "lmg",
  Снайпер: "rifle",
  Марксман: "rifle",
  Медик: "medic",
  Гренадёр: "grenade",
  Инженер: "engineer",
  Радиооператор: "radio",
  "Фронтовой игрок": "assault",
  "Игрок центра": "player",
  "Тыловой игрок": "defender",
  "Снейк-игрок": "assault",
  "Дорито-игрок": "defender",
};

export function roleMarkKind(role: string | null | undefined): RoleMarkKind {
  if (!role) return "player";
  return ROLE_MARKS[role] ?? "player";
}

export function missingRoleCounts(
  slots: Array<{ userId: string | null; roleRequired: string | null }>
): Array<{ role: string; count: number }> {
  const counts = new Map<string, number>();
  for (const slot of slots) {
    if (slot.userId || !slot.roleRequired) continue;
    counts.set(slot.roleRequired, (counts.get(slot.roleRequired) ?? 0) + 1);
  }
  return [...counts.entries()].map(([role, count]) => ({ role, count }));
}

export function roleSlotsFromPicks(roles: string[], slotCount: number) {
  const picks = roles.slice(0, Math.max(0, slotCount - 1));
  return picks.map((role, offset) => ({
    index: slotCount - 1 - offset,
    role,
  }));
}
