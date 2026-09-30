import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applySkin, readSkin } from "./lib/skins";
import { applyFont, readFont } from "./lib/fonts";
import "katex/dist/katex.min.css";
import "./styles.css";

// Apply theme skin & typography before first render
applySkin(readSkin());
applyFont(readFont());

// Mount AutoTask app directly
const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

