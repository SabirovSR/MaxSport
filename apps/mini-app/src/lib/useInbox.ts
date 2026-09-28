import { useCallback, useEffect, useState } from "react";
import { api, type InboxJoinRequest } from "../api";
import { useMe } from "./useMe";
import { useRefreshOnFocus } from "./useRefreshOnFocus";

export function useInbox() {
  const { userId } = useMe();
  const [notices, setNotices] = useState<InboxJoinRequest[]>([]);

  const refresh = useCallback(() => {
    if (!userId) {
      setNotices([]);
      return;
    }
    api
      .listInbox()
      .then((data) => setNotices(data.notices))
      .catch(() => undefined);
  }, [userId]);

  useEffect(refresh, [refresh]);
  useRefreshOnFocus(refresh, 8_000);

  useEffect(() => {
    if (!userId) return;
    const timer = window.setInterval(refresh, 20_000);
    return () => window.clearInterval(timer);
  }, [refresh, userId]);

  return { userId, notices, refresh };
}
