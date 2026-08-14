import { useEffect, useState } from "react";
import { api, type Passport } from "../api";

let cached: Promise<Passport> | null = null;

function loadMe(): Promise<Passport> {
  if (!cached) {
    cached = api
      .getPassport()
      .then((data) => data.passport)
      .catch((error) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}

export function refreshMe() {
  cached = null;
}

/** Identity of the signed-in Игрок, shared across screens after one request. */
export function useMe() {
  const [me, setMe] = useState<Passport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadMe()
      .then((passport) => active && setMe(passport))
      .catch((cause: Error) => active && setError(cause.message));
    return () => {
      active = false;
    };
  }, []);

  return { me, error, userId: me?.user.id ?? null };
}
