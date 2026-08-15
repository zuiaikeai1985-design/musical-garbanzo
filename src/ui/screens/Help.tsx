import { useLanguage } from "../hooks/useLanguage";
import type { TranslationKey } from "../../i18n";
import "./Help.css";

/** Control bindings, paired with the translation key describing what they do. */
const BINDINGS: readonly [string, TranslationKey][] = [
  ["LMB", "helpSelect"],
  ["LMB drag", "helpMarquee"],
  ["Shift + LMB", "helpAddSelect"],
  ["RMB", "helpOrder"],
  ["Ctrl + 1-9", "helpGroupAssign"],
  ["1-9", "helpGroupRecall"],
  ["S", "helpStop"],
  ["G", "helpGuard"],
  ["X", "helpScatter"],
  ["H", "helpBase"],
  ["Tab", "helpTabCycle"],
  ["L", "helpLanguage"],
  ["+ / -", "helpZoom"],
  ["P", "helpPause"],
  ["Esc", "helpMenu"],
  ["WASD / arrows / edge", "helpScroll"],
];

export function Help({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="help-root" data-testid="help">
      <div className="help-panel">
        <h2 className="help-title">{t.helpTitle}</h2>
        <dl className="help-list">
          {BINDINGS.map(([keys, key]) => (
            <div className="help-row" key={keys}>
              <dt className="help-keys">{keys}</dt>
              <dd className="help-desc">{t[key]}</dd>
            </div>
          ))}
        </dl>
        <button className="help-close" onClick={onClose} data-testid="help-close">
          {t.settingsClose}
        </button>
      </div>
    </div>
  );
}
