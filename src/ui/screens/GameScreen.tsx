import { useEffect, useRef } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { Difficulty } from "../../engine/types";
import "./GameScreen.css";

/**
 * Phase 0 placeholder: hosts the battlefield canvas and wires up resizing.
 * The renderer, HUD and input layers are attached here in later phases.
 */
export function GameScreen({
  difficulty,
  onExit,
}: {
  difficulty: Difficulty;
  onExit: () => void;
}) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width));
      canvas.height = Math.max(1, Math.floor(rect.height));
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    const startedAt = performance.now();
    const loop = (now: number) => {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const time = (now - startedAt) / 1000;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#1d2a16";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Placeholder grid so we can confirm the canvas is live and sized correctly.
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 48) {
          ctx.beginPath();
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(canvas.width, y + 0.5);
          ctx.stroke();
        }
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        ctx.fillStyle = `rgba(192,36,42,${0.25 + pulse * 0.35})`;
        ctx.fillRect(canvas.width / 2 - 60, canvas.height / 2 - 60, 120, 120);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="game-root">
      <div className="game-viewport" ref={wrapRef}>
        <canvas ref={canvasRef} data-testid="battlefield" />
      </div>
      <aside className="game-sidebar" data-testid="sidebar">
        <div className="sidebar-slot">{t.hudCredits}</div>
        <div className="sidebar-slot">{t.hudPower}</div>
        <div className="sidebar-slot">{difficulty}</div>
        <button className="sidebar-exit" onClick={onExit} data-testid="exit">
          {t.abort}
        </button>
      </aside>
    </div>
  );
}
