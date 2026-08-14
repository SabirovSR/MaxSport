import { describe, expect, it } from "vitest";
import { validateInitData } from "../auth.js";
import { createHmac } from "node:crypto";

function signInitData(params: Record<string, string>, botToken: string): string {
  const sorted = Object.entries(params)
    .filter(([k]) => k !== "hash")
    .sort(([a], [b]) => a.localeCompare(b));
  const launchParams = sorted.map(([k, v]) => `${k}=${v}`).join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(launchParams).digest("hex");
  const query = [...sorted, ["hash", hash] as const]
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return query;
}

describe("validateInitData", () => {
  it("accepts valid HMAC initData", () => {
    const botToken = "test-bot-token";
    const authDate = String(Math.floor(Date.now() / 1000));
    const initData = signInitData(
      {
        auth_date: authDate,
        user: JSON.stringify({
          id: 123,
          first_name: "Ivan",
        }),
        query_id: "q1",
      },
      botToken
    );

    const parsed = validateInitData(initData, botToken);
    expect(parsed?.user.id).toBe(123);
    expect(parsed?.user.first_name).toBe("Ivan");
  });

  it("rejects tampered hash", () => {
    const botToken = "test-bot-token";
    const initData = signInitData(
      {
        auth_date: String(Math.floor(Date.now() / 1000)),
        user: JSON.stringify({ id: 1, first_name: "A" }),
      },
      botToken
    ).replace("hash=", "hash=deadbeef");

    expect(validateInitData(initData, botToken)).toBeNull();
  });
});
