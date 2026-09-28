const STORAGE_KEY = "ms-onboarding-seen";

export const ONBOARDING_SLIDES = [
  {
    id: "level",
    title: "Найди игру своего уровня",
    text: "В ленте лобби с уровнем и амплуа. Открываешь подходящую игру — без сюрпризов на площадке.",
  },
  {
    id: "slot",
    title: "Занимай слот в 1 клик",
    text: "Слот — место в составе. Часть слотов просит конкретное амплуа, остальные подойдут любому.",
  },
  {
    id: "reliability",
    title: "Приходи — копи надёжность",
    text: "Отметь явку на площадке. Чем чаще приходишь, тем выше надёжность в игровом паспорте.",
  },
] as const;

export function hasSeenOnboarding(
  storage: Pick<Storage, "getItem"> | null = globalThis.localStorage
): boolean {
  try {
    return storage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(
  storage: Pick<Storage, "setItem"> | null = globalThis.localStorage
): void {
  try {
    storage?.setItem(STORAGE_KEY, "1");
  } catch {
    // localstorage может быть закрыт
  }
}

export function shouldShowOnboarding(
  gamesPlayed: number,
  storage: Pick<Storage, "getItem"> | null = globalThis.localStorage
): boolean {
  return gamesPlayed === 0 && !hasSeenOnboarding(storage);
}

const openListeners = new Set<() => void>();

export function requestOnboarding() {
  openListeners.forEach((notify) => notify());
}

export function subscribeOnboarding(notify: () => void): () => void {
  openListeners.add(notify);
  return () => {
    openListeners.delete(notify);
  };
}
