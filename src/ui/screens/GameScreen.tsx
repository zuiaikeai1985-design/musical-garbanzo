import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { TICK_MS } from "../../engine/constants";
import { Game } from "../../engine/game";
import { SidebarTab, type Difficulty, type StructureKindId } from "../../engine/types";
import type { BuildOption } from "../../engine/queries";
import { m01IronCurtain } from "../../maps/m01-iron-curtain";
import { Camera } from "../../render/camera";
import { Minimap } from "../../render/minimap";
import { Renderer } from "../../render/renderer";
import { SpriteAtlas } from "../../render/sprites/atlas";
import { IconCache } from "../../render/sprites/icons";
import { audio } from "../../audio/AudioManager";
import { hasRadar } from "../../engine/systems/power";
import { GameController, type CursorKind } from "../../input/controls";
import { installTestBridge, removeTestBridge } from "../testBridge";
import { getPrefs } from "../prefs";
import { snapshot, type HudSnapshot } from "../hooks/useGameSnapshot";
import { nextTab, Sidebar } from "../hud/Sidebar";
import { NukeAlert } from "../hud/NukeAlert";
import { Loading } from "./Loading";
import { ResultScreen } from "./ResultScreen";
import { PauseMenu } from "./PauseMenu";
import { Help } from "./Help";
import { GameStatus } from "../../engine/types";
import "./GameScreen.css";

const MAX_CATCHUP_TICKS = 5;
/** HUD refresh rate; the simulation and renderer are unaffected by this. */
const HUD_INTERVAL_MS = 100;

interface Engine {
  game: Game;
  camera: Camera;
  renderer: Renderer;
  minimap: Minimap;
  controller: GameController;
  icons: IconCache;
}

export function GameScreen({
  difficulty,
  onExit,
  onRestart,
}: {
  difficulty: Difficulty;
  onExit: () => void;
  onRestart: () => void;
}) {
  const { toggleLang } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const minimapRef = useRef<HTMLCanvasElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const [progress, setProgress] = useState({ fraction: 0, label: "" });
  const [engine, setEngine] = useState<Engine | null>(null);
  const [cursor, setCursor] = useState<CursorKind>("default");
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [tab, setTab] = useState<SidebarTab>(SidebarTab.Structures);
  const [tools, setTools] = useState({ sell: false, repair: false });
  const [nukeTargeting, setNukeTargeting] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  /**
   * The render loop is created once and captured in a closure, so it reads pause state through a
   * ref rather than through the (stale) state value it closed over.
   */
  const pausedRef = useRef(false);
  pausedRef.current = paused || showHelp;

  const handleHotkey = useCallback(
    (key: string) => {
      if (key === "l") toggleLang();
      else if (key === "escape") setPaused((p) => !p);
      else if (key === "p") setPaused((p) => !p);
      else if (key === "f1") setShowHelp((h) => !h);
      else if (key === "tab") setTab((t) => nextTab(t));
    },
    [toggleLang],
  );
  const hotkeyRef = useRef(handleHotkey);
  hotkeyRef.current = handleHotkey;

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let observer: ResizeObserver | null = null;

    const boot = async () => {
      const atlas = await SpriteAtlas.build((fraction, label) => {
        if (!cancelled) setProgress({ fraction, label });
      });
      if (cancelled) return;

      // Audio loads alongside the mission rather than blocking it; a silent first second is far
      // better than a black screen.
      void audio.load().then(() => {
        if (!cancelled) audio.playMusic("theme");
      });

      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      if (!canvas || !viewport) return;

      const game = new Game(m01IronCurtain, difficulty);
      const camera = new Camera(game.world.grid.worldWidth, game.world.grid.worldHeight);
      const renderer = new Renderer(game.world, atlas);
      const minimap = new Minimap(game.world);
      const icons = new IconCache(atlas);
      const controller = new GameController(canvas, game, camera, {
        onCursorChanged: setCursor,
        onHotkey: (key) => hotkeyRef.current(key),
        onPlacementDone: () => setTools({ sell: false, repair: false }),
      });

      const resize = () => {
        const rect = viewport.getBoundingClientRect();
        canvas.width = Math.max(1, Math.floor(rect.width));
        canvas.height = Math.max(1, Math.floor(rect.height));
        camera.setViewport(canvas.width, canvas.height);
      };
      resize();
      observer = new ResizeObserver(resize);
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
      const next: Engine = { game, camera, renderer, minimap, controller, icons };
      engineRef.current = next;
      installTestBridge(game, camera);
      setEngine(next);
      setHud(snapshot(game));

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let last = performance.now();
      let accumulator = 0;
      let hudTimer = 0;
      /** Current screen-shake magnitude in pixels; decays exponentially each frame. */
      let shake = 0;

      const frame = (now: number) => {
        const dtMs = Math.min(250, now - last);
        last = now;
        controller.update(dtMs / 1000, getPrefs().edgeScroll);

        if (pausedRef.current) {
          // Keep rendering (so the pause overlay sits over a live-looking battlefield) but stop
          // advancing the simulation, and drop the accumulated time so it does not fast-forward
          // the moment play resumes.
          accumulator = 0;
        } else {
          accumulator += dtMs;
          let steps = 0;
          while (accumulator >= TICK_MS && steps < MAX_CATCHUP_TICKS) {
            game.tick();
            accumulator -= TICK_MS;
            steps++;
          }
          if (steps === MAX_CATCHUP_TICKS) accumulator = 0;
        }

        // Drain engine output so the queues do not grow without bound.
        const world = game.world;
        if (world.dirtyTiles.length > 0) {
          for (const index of world.dirtyTiles) {
            renderer.terrain.invalidateTile(
              index % world.grid.width,
              Math.floor(index / world.grid.width),
            );
          }
          world.dirtyTiles.length = 0;
          minimap.invalidate();
        }

        audio.setListener(
          camera.x + camera.viewportWidth / camera.zoom / 2,
          camera.y + camera.viewportHeight / camera.zoom / 2,
          camera.zoom,
        );

        for (const event of world.events) {
          if (event.type === "screenShake" && camera.isVisible(event.x, event.y, 200)) {
            // Only shake for blasts the player can actually see.
            shake = Math.min(14, shake + event.magnitude);
          } else if (event.type === "sound") {
            audio.play(event.cue, event.x, event.y);
            if (event.cue === "klaxon") audio.duckMusic(0.35, 3);
            if (event.cue === "nukeImpact") audio.duckMusic(0.2, 5);
          } else if (event.type === "gameOver") {
            audio.stopMusic(1.5);
          }
        }
        world.events.length = 0;

        shake *= Math.pow(0.86, dtMs / 16.7);
        if (shake < 0.15) shake = 0;
        controller.overlay.shakeX = shake === 0 ? 0 : (Math.random() - 0.5) * shake * 2;
        controller.overlay.shakeY = shake === 0 ? 0 : (Math.random() - 0.5) * shake * 2;

        // Once the match is decided, lift the fog so the player can see the whole battlefield.
        if (world.status !== GameStatus.Playing) renderer.shroudEnabled = false;

        renderer.draw(ctx, camera, accumulator / TICK_MS, controller.overlay, world.tick);

        const mini = minimapRef.current;
        if (mini) minimap.draw(mini, camera, renderer.shroudEnabled, hasRadar(world, world.humanSide));

        hudTimer += dtMs;
        if (hudTimer >= HUD_INTERVAL_MS) {
          hudTimer = 0;
          setHud(snapshot(game));
          // The controller can leave targeting mode on its own (Esc, right click, launch).
          setNukeTargeting(controller.isTargetingNuke);
        }

        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    };

    void boot();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      engineRef.current?.controller.detach();
      engineRef.current = null;
      removeTestBridge();
      audio.stopMusic(0.4);
    };
  }, [difficulty]);

  const onMinimapPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const eng = engineRef.current;
    const canvas = minimapRef.current;
    if (!eng || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = eng.minimap.canvasToWorld(
      canvas,
      ((e.clientX - rect.left) / rect.width) * canvas.width,
      ((e.clientY - rect.top) / rect.height) * canvas.height,
    );
    if (point) eng.camera.centerOn(point.x, point.y);
  };

  const onBuild = (option: BuildOption) => {
    const eng = engineRef.current;
    if (!eng) return;
    const world = eng.game.world;
    const queue = world.players[world.humanSide].queues[option.queue];
    const head = queue.items[0];

    // A finished structure enters placement mode instead of being queued again.
    if (option.isStructure && head && head.what === option.id && head.progress > 0) {
      const done = head.progress >= option.buildTime;
      if (done) {
        eng.controller.beginPlacement(option.id as StructureKindId);
        setTools({ sell: false, repair: false });
        return;
      }
    }
    eng.game.dispatch({
      type: "queueAdd",
      side: world.humanSide,
      queue: option.queue,
      what: option.id,
    });
  };

  const onCancel = (option: BuildOption) => {
    const eng = engineRef.current;
    if (!eng) return;
    if (eng.controller.isPlacing) eng.controller.cancelPlacement();
    eng.game.dispatch({
      type: "queueCancel",
      side: eng.game.world.humanSide,
      queue: option.queue,
      what: option.id,
    });
  };

  const onTargetNuke = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const silo = eng.game.world.nukeReadySilo;
    if (!silo) return;
    if (eng.controller.isTargetingNuke) {
      eng.controller.cancelNukeTargeting();
      setNukeTargeting(false);
      return;
    }
    eng.controller.beginNukeTargeting(silo);
    setNukeTargeting(true);
    setTools({ sell: false, repair: false });
  };

  const toggleSell = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const next = !eng.controller.isSelling;
    eng.controller.setSellMode(next);
    setTools({ sell: next, repair: false });
  };

  const toggleRepair = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const next = !eng.controller.isRepairing;
    eng.controller.setRepairMode(next);
    setTools({ sell: false, repair: next });
  };

  return (
    <div className="game-root">
      <div className="game-viewport" ref={viewportRef}>
        <canvas ref={canvasRef} data-testid="battlefield" data-cursor={cursor} />
        {!engine && <Loading fraction={progress.fraction} label={progress.label} />}
        {hud?.pendingNuke && <NukeAlert nuke={hud.pendingNuke} />}
        {showHelp && <Help onClose={() => setShowHelp(false)} />}
        {paused && !showHelp && hud?.status === GameStatus.Playing && (
          <PauseMenu
            onResume={() => setPaused(false)}
            onRestart={() => {
              setPaused(false);
              onRestart();
            }}
            onAbort={onExit}
          />
        )}
        {hud && hud.status !== GameStatus.Playing && (
          <ResultScreen
            victory={hud.status === GameStatus.Victory}
            stats={hud.stats}
            ticks={hud.tick}
            onRestart={onRestart}
            onMenu={onExit}
          />
        )}
      </div>

      {hud && engine ? (
        <Sidebar
          hud={hud}
          icons={engine.icons}
          side={engine.game.world.humanSide}
          minimapRef={minimapRef}
          onMinimapPointer={onMinimapPointer}
          onBuild={onBuild}
          onCancel={onCancel}
          onToggleSell={toggleSell}
          onToggleRepair={toggleRepair}
          sellActive={tools.sell}
          repairActive={tools.repair}
          onAbort={onExit}
          activeTab={tab}
          onTab={setTab}
          onTargetNuke={onTargetNuke}
          nukeTargeting={nukeTargeting}
        />
      ) : (
        <aside className="sidebar" />
      )}
    </div>
  );
}
