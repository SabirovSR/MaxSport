import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ROOT_ROUTES = new Set(["/", "/create", "/passport"]);

export function parentPath(pathname: string): string | null {
  if (ROOT_ROUTES.has(pathname)) return null;
  const lobbyNested = pathname.match(/^\/lobby\/([^/]+)\/.+/);
  if (lobbyNested) return `/lobby/${lobbyNested[1]}`;
  if (pathname.startsWith("/passport/")) return "/passport";
  return "/";
}

export function useBackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    window.WebApp?.ready?.();
    const backButton = window.WebApp?.BackButton;
    const target = parentPath(pathname);

    if (!backButton || !target) {
      backButton?.hide();
      return;
    }

    const goBack = () => navigate(target);
    backButton.show();
    backButton.onClick(goBack);
    window.WebApp?.onEvent?.("backButtonClicked", goBack);

    return () => {
      backButton.offClick?.(goBack);
      window.WebApp?.offEvent?.("backButtonClicked", goBack);
      backButton.hide();
    };
  }, [navigate, pathname]);
}
