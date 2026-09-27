import { copyText, maxShareUrl } from "./lobbyShare";

export interface MaxContact {
  username?: string | null;
  maxUserId?: number | null;
}

export function maxProfileUrl(contact: MaxContact): string | null {
  const username = contact.username?.replace(/^@/, "").trim();
  if (!username) return null;
  return `https://max.ru/${encodeURIComponent(username)}`;
}

export function openMaxChat(contact: MaxContact): boolean {
  const url = maxProfileUrl(contact);
  if (!url) return false;
  if (window.WebApp?.openMaxLink) {
    window.WebApp.openMaxLink(url);
  } else if (window.WebApp?.openLink) {
    window.WebApp.openLink(url);
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
  return true;
}

export function contactShareText(link: string): string {
  return `Привет! Пишу по игре в MAX Sport.\n${link}`;
}

export async function shareContactMessage(
  text: string,
  link: string
): Promise<boolean> {
  await copyText(text);
  if (window.WebApp?.shareMaxContent) {
    window.WebApp.shareMaxContent({ text, link });
    return true;
  }
  const url = maxShareUrl(text);
  if (window.WebApp?.openMaxLink) {
    window.WebApp.openMaxLink(url);
    return true;
  }
  if (window.WebApp?.openLink) {
    window.WebApp.openLink(url);
    return true;
  }
  return false;
}
