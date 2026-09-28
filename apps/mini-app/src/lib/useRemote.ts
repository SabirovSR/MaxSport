import { useEffect, useRef } from "react";
import useSWR from "swr";
import { useToast } from "../components/Toast";

export function useRemote<T>(key: string | null, fetcher: () => Promise<T>) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    fetcher,
    {
      revalidateOnFocus: true,
      shouldRetryOnError: true,
      errorRetryCount: 2,
      keepPreviousData: true,
    }
  );
  const { showToast } = useToast();
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!error || !data) {
      last.current = null;
      return;
    }
    const message =
      error instanceof Error
        ? error.message
        : "Нет сети. Показаны сохранённые данные.";
    if (last.current === message) return;
    last.current = message;
    showToast(message, "error");
  }, [error, data, showToast]);

  return { data, error, isLoading, isValidating, mutate };
}
