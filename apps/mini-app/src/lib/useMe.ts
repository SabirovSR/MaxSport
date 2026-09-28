import useSWR, { mutate } from "swr";
import { api } from "../api";

const ME_KEY = "passport-me";

export function refreshMe() {
  void mutate(ME_KEY);
}

export function useMe() {
  const { data, error } = useSWR(
    ME_KEY,
    () => api.getPassport().then((payload) => payload.passport),
    {
      revalidateOnFocus: true,
      shouldRetryOnError: true,
      errorRetryCount: 2,
      keepPreviousData: true,
    }
  );

  return {
    me: data ?? null,
    error:
      error instanceof Error ? error.message : error ? String(error) : null,
    userId: data?.user.id ?? null,
  };
}
