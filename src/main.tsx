import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { LanguageProvider } from "./ui/hooks/useLanguage";
import { audio } from "./audio/AudioManager";
import "./styles/global.css";

const container = document.getElementById("root");
if (!container) throw new Error("#root not found");

declare global {
  interface Window {
    __raAudio?: ReturnType<typeof audio.debugState>;
    __raAudioState?: () => ReturnType<typeof audio.debugState>;
  }
}

// Audio has no observable surface in a headless browser, so dev builds expose a snapshot the
// end-to-end suite can assert on.
if (import.meta.env.DEV) {
  window.__raAudioState = () => audio.debugState();
}

createRoot(container).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
