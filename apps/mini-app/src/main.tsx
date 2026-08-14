import { createRoot } from "react-dom/client";
import { MaxUI } from "@maxhub/max-ui";
import "@maxhub/max-ui/dist/styles.css";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

/**
 * Platform and colour scheme come from the MAX client rather than being
 * hardcoded, so Android users stop getting iOS styling and a light-themed
 * client stops getting a dark app. The brand tokens carry a light set for
 * exactly this case.
 */
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

const scheme = resolveScheme();
document.documentElement.dataset.msTheme = scheme;

createRoot(document.getElementById("root")!).render(
  <MaxUI platform={resolvePlatform()} colorScheme={scheme}>
    <BrowserRouter basename="/app">
      <App />
    </BrowserRouter>
  </MaxUI>
);
