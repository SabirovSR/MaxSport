import { useEffect, useState } from "react";
import { api, type Passport } from "../api";

let cached: Promise<Passport> | null = null;
const subscribers = new Set<() => void>();

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
  subscribers.forEach((notify) => notify());
}

/** Identity of the signed-in Игрок, shared across screens after one request. */
export function useMe() {
  const [me, setMe] = useState<Passport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const notify = () => setRevision((value) => value + 1);
    subscribers.add(notify);
    return () => {
      subscribers.delete(notify);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setError(null);
    loadMe()
      .then((passport) => active && setMe(passport))
      .catch((cause: Error) => active && setError(cause.message));
    return () => {
      active = false;
    };
  }, [revision]);

  return { me, error, userId: me?.user.id ?? null };
}
