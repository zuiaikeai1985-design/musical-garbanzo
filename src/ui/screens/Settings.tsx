import { useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { audio } from "../../audio/AudioManager";
import { getPrefs, setPrefs } from "../prefs";
import { LANGS, type Lang } from "../../i18n";
import "./Settings.css";

const LANG_LABEL: Record<Lang, string> = { en: "English", zh: "中文" };

export function Settings({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang } = useLanguage();
  const [volumes, setVolumes] = useState(() => audio.getSettings());
  const [edgeScroll, setEdgeScroll] = useState(() => getPrefs().edgeScroll);

  const updateVolume = (key: "musicVolume" | "sfxVolume", value: number) => {
    const next = { ...volumes, [key]: value };
    setVolumes(next);
    audio.setSettings({ [key]: value });
    // Give immediate feedback on the effects slider so the level is audible while dragging.
    if (key === "sfxVolume") audio.play("uiClick");
  };

  return (
    <div className="settings-root" data-testid="settings">
      <div className="settings-panel">
        <h2 className="settings-title">{t.settingsTitle}</h2>

        <label className="settings-row">
          <span className="settings-label">{t.settingsLanguage}</span>
          <span className="settings-choices">
            {LANGS.map((l) => (
              <button
                key={l}
                className={"settings-chip" + (l === lang ? " is-active" : "")}
                onClick={() => setLang(l)}
                data-testid={`settings-lang-${l}`}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </span>
        </label>

        <label className="settings-row">
          <span className="settings-label">{t.settingsMusicVolume}</span>
          <input
            className="settings-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(volumes.musicVolume * 100)}
            onChange={(e) => updateVolume("musicVolume", Number(e.target.value) / 100)}
            data-testid="settings-music"
          />
          <span className="settings-readout">{Math.round(volumes.musicVolume * 100)}</span>
        </label>

        <label className="settings-row">
          <span className="settings-label">{t.settingsSfxVolume}</span>
          <input
            className="settings-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(volumes.sfxVolume * 100)}
            onChange={(e) => updateVolume("sfxVolume", Number(e.target.value) / 100)}
            data-testid="settings-sfx"
          />
          <span className="settings-readout">{Math.round(volumes.sfxVolume * 100)}</span>
        </label>

        <label className="settings-row">
          <span className="settings-label">{t.settingsEdgeScroll}</span>
          <span className="settings-choices">
            <button
              className={"settings-chip" + (edgeScroll ? " is-active" : "")}
              onClick={() => {
                setEdgeScroll(true);
                setPrefs({ edgeScroll: true });
              }}
              data-testid="settings-edge-on"
            >
              {t.settingsOn}
            </button>
            <button
              className={"settings-chip" + (!edgeScroll ? " is-active" : "")}
              onClick={() => {
                setEdgeScroll(false);
                setPrefs({ edgeScroll: false });
              }}
              data-testid="settings-edge-off"
            >
              {t.settingsOff}
            </button>
          </span>
        </label>

        <button className="settings-close" onClick={onClose} data-testid="settings-close">
          {t.settingsClose}
        </button>
      </div>
    </div>
  );
}
