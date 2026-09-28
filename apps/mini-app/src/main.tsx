import { createRoot } from "react-dom/client";
import { MaxUI } from "@maxhub/max-ui";
import "@maxhub/max-ui/dist/styles.css";
import { BrowserRouter } from "react-router-dom";
import { SWRConfig } from "swr";
import { App } from "./App";
import { swrCacheProvider } from "./lib/swrCache";
import "./styles.css";

function resolvePlatform(): "ios" | "android" {
  const fromBridge = window.WebApp?.platform;
  if (fromBridge === "ios" || fromBridge === "android") return fromBridge;
  return /android/i.test(navigator.userAgent) ? "android" : "ios";
}

function resolveScheme(): "light" | "dark" {
  const fromBridge = window.WebApp?.colorScheme;
  if (fromBridge === "light" || fromBridge === "dark") return fromBridge;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

window.WebApp?.ready?.();

const scheme = resolveScheme();
document.documentElement.dataset.msTheme = scheme;

createRoot(document.getElementById("root")!).render(
  <MaxUI platform={resolvePlatform()} colorScheme={scheme}>
    <SWRConfig
      value={{
        provider: swrCacheProvider,
        revalidateOnFocus: true,
        shouldRetryOnError: true,
      }}
    >
      <BrowserRouter basename="/app">
        <App />
      </BrowserRouter>
    </SWRConfig>
  </MaxUI>
);
