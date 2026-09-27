export function lobbyDeepLink(botUsername: string, lobbyId: string): string {
  const bot = botUsername.replace(/^@/, "").trim();
  return `https://max.ru/${encodeURIComponent(bot)}?startapp=lobby_${lobbyId}`;
}

export function maxShareUrl(text: string): string {
  return `https://max.ru/:share?text=${encodeURIComponent(text)}`;
}

export function lobbyShareText(input: {
  sport: string;
  when: string;
  venue: string;
  link: string;
}): string {
  return `${input.sport} • ${input.when}\n${input.venue}\n${input.link}`;
}

export type LobbyShareMode = "card" | "content" | "deeplink" | "clipboard";

export async function openLobbyShare(input: {
  mid?: string | null;
  text: string;
  link: string;
}): Promise<LobbyShareMode> {
  const share = window.WebApp?.shareMaxContent;
  if (share && input.mid) {
    share({ mid: input.mid });
    return "card";
  }
  if (share) {
    share({ text: input.text, link: input.link });
    return "content";
  }

  const url = maxShareUrl(input.text);
  if (window.WebApp?.openMaxLink) {
    window.WebApp.openMaxLink(url);
    return "deeplink";
  }
  if (window.WebApp?.openLink) {
    window.WebApp.openLink(url);
    return "deeplink";
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(input.link);
    return "clipboard";
  }
  window.open(url, "_blank", "noopener,noreferrer");
  return "deeplink";
}
