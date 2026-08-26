import { useLanguage } from "../hooks/useLanguage";
import "./Loading.css";

const LABELS: Record<string, "loadingTerrain" | "loadingSprites" | "loadingReady"> = {
  terrain: "loadingTerrain",
  units: "loadingSprites",
  structures: "loadingSprites",
  ready: "loadingReady",
};

export function Loading({ fraction, label }: { fraction: number; label: string }) {
  const { t } = useLanguage();
  const key = LABELS[label] ?? "loadingSprites";

  return (
    <div className="loading-root" data-testid="loading">
      <div className="loading-panel">
        <p className="loading-title">{t.loading}</p>
        <div className="loading-bar">
          <div className="loading-fill" style={{ width: `${Math.round(fraction * 100)}%` }} />
        </div>
        <p className="loading-label">{t[key]}</p>
      </div>
    </div>
  );
}
