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
