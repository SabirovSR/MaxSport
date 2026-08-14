import { createRoot } from "react-dom/client";
import { MaxUI } from "@maxhub/max-ui";
import "@maxhub/max-ui/dist/styles.css";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <MaxUI platform="ios" colorScheme="dark">
    <BrowserRouter basename="/app">
      <App />
    </BrowserRouter>
  </MaxUI>
);
