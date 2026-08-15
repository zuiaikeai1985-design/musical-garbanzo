import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { TICK_MS } from "../../engine/constants";
import { Game } from "../../engine/game";
import type { Difficulty } from "../../engine/types";
import { m01IronCurtain } from "../../maps/m01-iron-curtain";
import { Camera } from "../../render/camera";
import { Minimap } from "../../render/minimap";
import { Renderer } from "../../render/renderer";
import { SpriteAtlas } from "../../render/sprites/atlas";
import { GameController, type CursorKind } from "../../input/controls";
import { installTestBridge, removeTestBridge } from "../testBridge";
import { Loading } from "./Loading";
import "./GameScreen.css";

const MAX_CATCHUP_TICKS = 5;

interface Engine {
  game: Game;
  camera: Camera;
  renderer: Renderer;
  minimap: Minimap;
  controller: GameController;
}

export function GameScreen({
  difficulty,
  onExit,
}: {
  difficulty: Difficulty;
  onExit: () => void;
}) {
  const { t, toggleLang } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const [progress, setProgress] = useState({ fraction: 0, label: "" });
  const [ready, setReady] = useState(false);
  const [cursor, setCursor] = useState<CursorKind>("default");
  const [hud, setHud] = useState({ credits: 0, power: 0, drain: 0, units: 0 });

  const handleHotkey = useCallback(
    (key: string) => {
      if (key === "l") toggleLang();
      if (key === "escape") onExit();
    },
    [onExit, toggleLang],
  );
  const hotkeyRef = useRef(handleHotkey);
  hotkeyRef.current = handleHotkey;

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    const boot = async () => {
      const atlas = await SpriteAtlas.build((fraction, label) => {
        if (!cancelled) setProgress({ fraction, label });
      });
      if (cancelled) return;

      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      if (!canvas || !viewport) return;

      const game = new Game(m01IronCurtain, difficulty);
      const camera = new Camera(game.world.grid.worldWidth, game.world.grid.worldHeight);
      const renderer = new Renderer(game.world, atlas);
      const minimap = new Minimap(game.world);
      const controller = new GameController(canvas, game, camera, {
        onCursorChanged: setCursor,
        onHotkey: (key) => hotkeyRef.current(key),
      });

      const resize = () => {
        const rect = viewport.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width));
        canvas.height = Math.max(1, Math.floor(rect.height));
        camera.setViewport(canvas.width, canvas.height);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(viewport);

      // Open on the player's Construction Yard rather than a hard-coded tile.
      const home = game.world.structures.find(
        (s) => s.side === game.world.humanSide && s.kind === "conyard",
      );
      if (home) {
        const c = game.world.structureCenter(home);
        camera.centerOn(c.x + 48, c.y + 48);
      } else {
        camera.centerOnTile(m01IronCurtain.cameraStart.tx, m01IronCurtain.cameraStart.ty);
      }
      controller.attach();
      engineRef.current = { game, camera, renderer, minimap, controller };
      installTestBridge(game, camera);
      setReady(true);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let last = performance.now();
      let accumulator = 0;
      let hudTimer = 0;

      const frame = (now: number) => {
        const dtMs = Math.min(250, now - last);
        last = now;
        const dt = dtMs / 1000;

        controller.update(dt, true);

        accumulator += dtMs;
        let steps = 0;
        while (accumulator >= TICK_MS && steps < MAX_CATCHUP_TICKS) {
          game.tick();
          accumulator -= TICK_MS;
          steps++;
        }
        if (steps === MAX_CATCHUP_TICKS) accumulator = 0;

        // Drain engine output so the queues do not grow without bound.
        const world = game.world;
        if (world.dirtyTiles.length > 0) {
          for (const index of world.dirtyTiles) {
            renderer.terrain.invalidateTile(index % world.grid.width, Math.floor(index / world.grid.width));
          }
          world.dirtyTiles.length = 0;
          minimap.invalidate();
        }
        world.events.length = 0;

        const alpha = accumulator / TICK_MS;
        renderer.draw(ctx, camera, alpha, controller.overlay, world.tick);

        const mini = minimapRef.current;
        if (mini) minimap.draw(mini, camera, false);

        hudTimer += dtMs;
        if (hudTimer > 120) {
          hudTimer = 0;
          const player = world.players[world.humanSide];
          setHud({
            credits: Math.floor(player.credits),
            power: player.powerProduced,
            drain: player.powerConsumed,
            units: world.units.filter((u) => u.side === world.humanSide).length,
          });
        }

        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      return () => observer.disconnect();
    };

    const cleanupPromise = boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      engineRef.current?.controller.detach();
      engineRef.current = null;
      removeTestBridge();
      void cleanupPromise;
    };
  }, [difficulty]);

  const onMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const canvas = minimapRef.current;
    if (!engine || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = engine.minimap.canvasToWorld(
      canvas,
      ((e.clientX - rect.left) / rect.width) * canvas.width,
      ((e.clientY - rect.top) / rect.height) * canvas.height,
    );
    if (point) engine.camera.centerOn(point.x, point.y);
  };

  return (
    <div className="game-root">
      <div className="game-viewport" ref={viewportRef}>
        <canvas ref={canvasRef} data-testid="battlefield" data-cursor={cursor} />
        {!ready && <Loading fraction={progress.fraction} label={progress.label} />}
      </div>

      <aside className="game-sidebar" data-testid="sidebar">
        <canvas
          ref={minimapRef}
          className="sidebar-radar"
          width={216}
          height={216}
          onClick={onMinimapClick}
          data-testid="minimap"
        />
        <div className="sidebar-readout">
          <span className="readout-label">{t.hudCredits}</span>
          <span className="readout-value" data-testid="credits">
            ${hud.credits}
          </span>
        </div>
        <div className="sidebar-readout">
          <span className="readout-label">{t.hudPower}</span>
          <span className="readout-value">
            {hud.power} / {hud.drain}
          </span>
        </div>
        <button className="sidebar-exit" onClick={onExit} data-testid="exit">
          {t.abort}
        </button>
      </aside>
    </div>
  );
}
