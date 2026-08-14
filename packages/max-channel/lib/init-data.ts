import { createHmac, timingSafeEqual } from "node:crypto";

export interface InitDataUser {
  id: number;
  first_name: string;
  last_name?: string | null;
  username?: string | null;
  photo_url?: string | null;
  language_code?: string;
}

export interface ParsedInitData {
  user: InitDataUser;
  authDate: number;
  startParam?: string;
  queryId?: string;
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

export function validateInitData(
  initData: string,
  botToken: string
): ParsedInitData | null {
  if (!initData || !botToken) return null;

  const params = initData.split("&").map((part) => {
    const eq = part.indexOf("=");
    if (eq === -1) return [part, ""] as const;
    return [part.slice(0, eq), part.slice(eq + 1)] as const;
  });

  const hashEntries = params.filter(([key]) => key === "hash");
  if (hashEntries.length !== 1) return null;

  const originalHash = decodeURIComponent(hashEntries[0]![1]);
  const sorted = params
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => [key, decodeURIComponent(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const launchParams = sorted.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = hmacSha256("WebAppData", botToken);
  const signature = hmacSha256(secretKey, launchParams).toString("hex");

  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(originalHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const userEntry = sorted.find(([key]) => key === "user");
  const authDateEntry = sorted.find(([key]) => key === "auth_date");
  const startParamEntry = sorted.find(([key]) => key === "start_param");
  const queryIdEntry = sorted.find(([key]) => key === "query_id");

  if (!userEntry || !authDateEntry) return null;

  const authDate = Number(authDateEntry[1]);
  if (!Number.isFinite(authDate)) return null;
  if (Date.now() / 1000 - authDate > 3600) return null;

  let user: InitDataUser;
  try {
    user = JSON.parse(userEntry[1]) as InitDataUser;
  } catch {
    return null;
  }

  return {
    user,
    authDate,
    startParam: startParamEntry?.[1],
    queryId: queryIdEntry?.[1],
  };
}
