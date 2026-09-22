import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const ROOT_ROUTES = new Set(["/", "/create", "/passport"]);

/** Keeps the native MAX back button in sync with the current route. */
export function useBackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    const backButton = window.WebApp?.BackButton;
    if (!backButton) return;

    if (ROOT_ROUTES.has(pathname)) {
      backButton.hide();
      return;
    }

    const goBack = () => navigate(-1);
    backButton.show();
    backButton.onClick(goBack);

    return () => {
      backButton.offClick?.(goBack);
      backButton.hide();
    };
  }, [navigate, pathname]);
}
