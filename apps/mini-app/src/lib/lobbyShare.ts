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

export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // webview часто режет clipboard api
  }
  try {
    const field = document.createElement("textarea");
    field.value = value;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.left = "-9999px";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    return ok;
  } catch {
    return false;
  }
}

export type LobbyShareMode = "card" | "content" | "deeplink" | "clipboard";

export async function openLobbyShare(input: {
  mid?: string | null;
  text: string;
  link: string;
}): Promise<LobbyShareMode> {
  const copied = await copyText(input.link);

  const share = window.WebApp?.shareMaxContent;
  if (share && input.mid) {
    share({ mid: input.mid });
    return copied ? "clipboard" : "card";
  }
  if (share) {
    share({ text: input.text, link: input.link });
    return copied ? "clipboard" : "content";
  }

  const url = maxShareUrl(input.text);
  if (window.WebApp?.openMaxLink) {
    window.WebApp.openMaxLink(url);
    return copied ? "clipboard" : "deeplink";
  }
  if (window.WebApp?.openLink) {
    window.WebApp.openLink(url);
    return copied ? "clipboard" : "deeplink";
  }
  if (copied) return "clipboard";
  window.open(url, "_blank", "noopener,noreferrer");
  return "deeplink";
}
