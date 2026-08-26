import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { Settings } from "./Settings";
import { Help } from "./Help";
import "./PauseMenu.css";

export function PauseMenu({
  onResume,
  onRestart,
  onAbort,
}: {
  onResume: () => void;
  onRestart: () => void;
  onAbort: () => void;
}) {
  const { t } = useLanguage();
  const [panel, setPanel] = useState<"none" | "settings" | "help">("none");

  if (panel === "settings") return <Settings onClose={() => setPanel("none")} />;
  if (panel === "help") return <Help onClose={() => setPanel("none")} />;

  return (
    <div className="pause-root" data-testid="pause-menu">
      <div className="pause-panel">
        <h2 className="pause-title">{t.paused}</h2>
        <button className="pause-button" onClick={onResume} data-testid="pause-resume">
          {t.resume}
        </button>
        <button className="pause-button" onClick={() => setPanel("settings")} data-testid="pause-settings">
          {t.settingsTitle}
        </button>
        <button className="pause-button" onClick={() => setPanel("help")} data-testid="pause-help">
          {t.helpTitle}
        </button>
        <button className="pause-button" onClick={onRestart} data-testid="pause-restart">
          {t.restart}
        </button>
        <button
          className="pause-button pause-button--danger"
          onClick={onAbort}
          data-testid="pause-abort"
        >
          {t.abort}
        </button>
      </div>
    </div>
  );
}
