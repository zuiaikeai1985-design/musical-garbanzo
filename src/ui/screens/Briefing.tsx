import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { audio } from "../../audio/AudioManager";
import "./Briefing.css";

/** Characters revealed per second by the typewriter. */
const TYPE_SPEED = 90;

/**
 * Mission briefing.
 *
 * The dossier text types itself out like a teleprinter; clicking anywhere skips straight to the
 * end, because nobody wants to sit through the animation on a restart.
 */
export function Briefing({ onProceed, onBack }: { onProceed: () => void; onBack: () => void }) {
  const { t } = useLanguage();
  const globeRef = useRef<HTMLCanvasElement | null>(null);

  const body = useMemo(() => `${t.briefingBody1}\n\n${t.briefingBody2}`, [t]);
  const [revealed, setRevealed] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const done = revealed >= body.length;

  useEffect(() => {
    // Skipping has to stop the animation, not just jump the counter: an in-flight rAF loop would
    // immediately overwrite the value on the next frame.
    if (skipped) {
      setRevealed(body.length);
      return;
    }
    setRevealed(0);
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const chars = ((now - start) / 1000) * TYPE_SPEED;
      setRevealed(Math.min(body.length, Math.floor(chars)));
      if (chars < body.length) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [body, skipped]);

  // Slowly rotating wireframe globe with a target marker over the theatre of operations.
  useEffect(() => {
    const canvas = globeRef.current;
    if (!canvas) return;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const time = (now - start) / 1000;
      const ctx = canvas.getContext("2d");
      if (ctx) drawGlobe(ctx, canvas.width, canvas.height, time);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="briefing-root" data-testid="briefing" onClick={() => setSkipped(true)}>
      <div className="briefing-panel">
        <div className="briefing-header">
          <span className="briefing-header-label">{t.briefingHeader}</span>
          <span className="briefing-classified">{t.briefingClassified}</span>
        </div>

        <div className="briefing-body">
          <div className="briefing-globe">
            <canvas ref={globeRef} width={180} height={180} />
            <span className="briefing-mission">
              {t.briefingMissionLabel}
              <br />
              <strong>{t.briefingMissionName}</strong>
            </span>
          </div>

          <div className="briefing-text">
            <p className="briefing-dossier" data-testid="briefing-text">
              {body.slice(0, revealed)}
              {!done && <span className="briefing-caret">_</span>}
            </p>

            <p className="briefing-objectives-title">{t.briefingObjectivesLabel}</p>
            <ol className="briefing-objectives">
              <li>{t.briefingObjective1}</li>
              <li>{t.briefingObjective2}</li>
              <li>{t.briefingObjective3}</li>
            </ol>
          </div>
        </div>

        <div className="briefing-actions">
          <button
            className="briefing-button"
            onClick={(e) => {
              e.stopPropagation();
              audio.play("uiClick");
              onBack();
            }}
            data-testid="briefing-back"
          >
            {t.briefingBack}
          </button>
          <button
            className="briefing-button briefing-button--primary"
            onClick={(e) => {
              e.stopPropagation();
              audio.play("uiClick");
              onProceed();
            }}
            data-testid="briefing-proceed"
          >
            {t.briefingProceed}
          </button>
        </div>
      </div>
    </div>
  );
}

function drawGlobe(ctx: CanvasRenderingContext2D, w: number, h: number, time: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 8;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(53,194,58,0.55)";
  ctx.lineWidth = 1;

  // Outline.
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Latitude rings.
  for (let i = 1; i < 5; i++) {
    const lat = (i / 5) * Math.PI - Math.PI / 2;
    const ry = Math.abs(Math.sin(lat)) * r;
    const rx = Math.cos(lat) * r;
    ctx.beginPath();
    ctx.ellipse(cx, cy - Math.sin(lat) * r, rx, ry * 0.28, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Longitude arcs sweeping around as the globe turns.
  for (let i = 0; i < 6; i++) {
    const phase = time * 0.35 + (i / 6) * Math.PI * 2;
    const squash = Math.cos(phase);
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.abs(squash) * r, r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Blinking target reticle.
  const blink = 0.5 + 0.5 * Math.sin(time * 4);
  const tx = cx + r * 0.32;
  const ty = cy - r * 0.28;
  ctx.strokeStyle = `rgba(255,90,68,${0.4 + blink * 0.6})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(tx, ty, 7 + blink * 3, 0, Math.PI * 2);
  ctx.moveTo(tx - 12, ty);
  ctx.lineTo(tx - 4, ty);
  ctx.moveTo(tx + 4, ty);
  ctx.lineTo(tx + 12, ty);
  ctx.moveTo(tx, ty - 12);
  ctx.lineTo(tx, ty - 4);
  ctx.moveTo(tx, ty + 4);
  ctx.lineTo(tx, ty + 12);
  ctx.stroke();
}
