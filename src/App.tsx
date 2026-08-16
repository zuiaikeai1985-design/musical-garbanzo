import { useCallback, useEffect, useMemo, useState } from "react";
import { GameCanvas, type HudState } from "./game/GameCanvas";
import "./styles.css";

type Phase = "menu" | "playing" | "paused" | "victory" | "defeat";

const initialHud: HudState = {
  health: 100,
  armor: 50,
  ammo: 30,
  reserve: 90,
  kills: 0,
  enemies: 8,
  time: 120,
  hit: false,
  headshot: false,
  reloading: false,
  damageDirection: null,
  enemyPositions: [],
  playerPosition: { x: 0, z: 18, yaw: 0 },
};

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

const Radar = ({ hud }: { hud: HudState }) => {
  const size = 132;
  const center = size / 2;
  const scale = 1.85;
  const points = useMemo(
    () =>
      hud.enemyPositions.map((enemy) => {
        const dx = enemy.x - hud.playerPosition.x;
        const dz = enemy.z - hud.playerPosition.z;
        const cos = Math.cos(-hud.playerPosition.yaw);
        const sin = Math.sin(-hud.playerPosition.yaw);
        return {
          x: center + (dx * cos - dz * sin) * scale,
          y: center + (dx * sin + dz * cos) * scale,
        };
      }),
    [hud.enemyPositions, hud.playerPosition, center],
  );

  return (
    <div className="radar-shell">
      <div className="radar-label">SECTOR 07</div>
      <svg className="radar" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r="62" className="radar-ring" />
        <circle cx={center} cy={center} r="31" className="radar-ring inner" />
        <path d="M66 4V128M4 66H128" className="radar-grid" />
        <path d="M66 66 L55 88 L77 88 Z" className="radar-player" />
        {points.map((point, index) => (
          <circle
            key={index}
            cx={Math.max(7, Math.min(125, point.x))}
            cy={Math.max(7, Math.min(125, point.y))}
            r="3"
            className="radar-enemy"
          />
        ))}
      </svg>
    </div>
  );
};

const Logo = () => (
  <div className="logo" aria-label="Breach Protocol">
    <div className="logo-mark">
      <i />
      <i />
      <i />
    </div>
    <div>
      <span>BREACH</span>
      <strong>PROTOCOL</strong>
    </div>
  </div>
);

export default function App() {
  const [phase, setPhase] = useState<Phase>("menu");
  const [roundId, setRoundId] = useState(1);
  const [hud, setHud] = useState(initialHud);

  const requestLock = useCallback(() => {
    const canvas = document.getElementById("game-canvas");
    canvas?.requestPointerLock();
  }, []);

  const start = () => {
    setPhase("playing");
    requestLock();
  };

  const restart = () => {
    setHud(initialHud);
    setRoundId((value) => value + 1);
    setPhase("playing");
    window.setTimeout(requestLock, 80);
  };

  useEffect(() => {
    const onPointerLock = () => {
      if (!document.pointerLockElement && phase === "playing") {
        setPhase("paused");
      }
    };
    document.addEventListener("pointerlockchange", onPointerLock);
    return () => document.removeEventListener("pointerlockchange", onPointerLock);
  }, [phase]);

  const resume = () => {
    setPhase("playing");
    requestLock();
  };

  return (
    <main className={`app phase-${phase}`}>
      <GameCanvas
        active={phase === "playing"}
        roundId={roundId}
        onHudChange={setHud}
        onRoundEnd={setPhase}
        onPause={() => setPhase("paused")}
      />

      <div className="grain" />
      <header className="top-bar">
        <Logo />
        <div className="build-tag">BUILD 0.7.31 // SECURE</div>
      </header>

      {phase === "menu" && (
        <section className="menu-screen">
          <div className="menu-copy">
            <div className="eyebrow">
              <span>LIVE TRAINING SIMULATION</span>
              <b>ONLINE</b>
            </div>
            <h1>
              ENTER THE
              <br />
              <em>KILLHOUSE.</em>
            </h1>
            <p>
              进入第 07 区战术训练场。清除全部敌方单位，
              <br />
              在倒计时结束前完成行动。
            </p>
            <button className="primary-button" onClick={start}>
              <span>开始行动</span>
              <kbd>ENTER</kbd>
              <i>→</i>
            </button>
            <div className="controls-strip">
              <span>
                <kbd>WASD</kbd> 移动
              </span>
              <span>
                <kbd>鼠标</kbd> 瞄准
              </span>
              <span>
                <kbd>左键</kbd> 射击
              </span>
              <span>
                <kbd>R</kbd> 换弹
              </span>
              <span>
                <kbd>SHIFT</kbd> 静步
              </span>
            </div>
          </div>

          <aside className="mission-card">
            <div className="mission-image">
              <div className="map-lines" />
              <div className="map-pulse" />
              <span>TACTICAL FEED // 07</span>
            </div>
            <div className="mission-content">
              <span className="mission-index">01 / ACTIVE MISSION</span>
              <h2>灰港 · 训练区</h2>
              <div className="mission-stats">
                <div>
                  <span>任务</span>
                  <strong>歼灭</strong>
                </div>
                <div>
                  <span>敌方单位</span>
                  <strong>08</strong>
                </div>
                <div>
                  <span>时间限制</span>
                  <strong>02:00</strong>
                </div>
              </div>
            </div>
          </aside>

          <div className="menu-footer">
            <span>LOCAL SIMULATION</span>
            <i />
            <span>NO NETWORK REQUIRED</span>
          </div>
        </section>
      )}

      {(phase === "playing" || phase === "paused") && (
        <section className="hud">
          <div className="objective-panel">
            <span>ACTIVE OBJECTIVE</span>
            <strong>清除敌方单位</strong>
            <small>{hud.enemies} HOSTILES REMAINING</small>
          </div>

          <div className="round-timer">
            <span>ROUND 01</span>
            <strong className={hud.time < 20 ? "danger" : ""}>
              {formatTime(hud.time)}
            </strong>
          </div>

          <Radar hud={hud} />

          <div className="vitals">
            <div className="vital-number">
              <span>生命</span>
              <strong>{Math.ceil(hud.health)}</strong>
            </div>
            <div className="vital-bars">
              <i style={{ width: `${hud.health}%` }} />
              <div>
                <span>护甲</span>
                <b>{hud.armor}</b>
              </div>
            </div>
          </div>

          <div className="weapon-panel">
            <span className="weapon-name">VLR-12 / CARBINE</span>
            <div className="ammo-count">
              <strong>{String(hud.ammo).padStart(2, "0")}</strong>
              <span>/ {hud.reserve}</span>
            </div>
            <div className="fire-mode">
              <i />
              <i />
              <i />
              <span>AUTO</span>
            </div>
          </div>

          <div className={`crosshair ${hud.hit ? "hit" : ""}`}>
            <i />
            <i />
            <i />
            <i />
            {hud.headshot && <b>HEADSHOT</b>}
          </div>

          {hud.reloading && (
            <div className="reload-indicator">
              <span>RELOADING</span>
              <i />
            </div>
          )}

          {hud.damageDirection !== null && (
            <div
              className="damage-indicator"
              style={{ transform: `rotate(${hud.damageDirection}rad)` }}
            >
              ▲
            </div>
          )}

          <div className="kill-counter">
            <span>ELIMINATIONS</span>
            <strong>{String(hud.kills).padStart(2, "0")}</strong>
          </div>
        </section>
      )}

      {phase === "paused" && (
        <section className="modal-backdrop">
          <div className="pause-card">
            <span className="modal-code">SIMULATION // PAUSED</span>
            <h2>行动暂停</h2>
            <p>点击继续后，鼠标将重新锁定到游戏画面。</p>
            <button className="primary-button compact" onClick={resume}>
              <span>继续行动</span>
              <i>→</i>
            </button>
            <button className="text-button" onClick={() => setPhase("menu")}>
              返回任务简报
            </button>
          </div>
        </section>
      )}

      {(phase === "victory" || phase === "defeat") && (
        <section className="modal-backdrop result">
          <div className="result-card">
            <span className="modal-code">
              {phase === "victory" ? "MISSION COMPLETE" : "MISSION FAILED"}
            </span>
            <div className={`result-icon ${phase}`}>{phase === "victory" ? "✓" : "×"}</div>
            <h2>{phase === "victory" ? "区域已肃清" : "行动已终止"}</h2>
            <p>
              {phase === "victory"
                ? "第 07 区所有敌方单位已被清除。"
                : "重新调整战术，再次进入训练场。"}
            </p>
            <div className="result-stats">
              <div>
                <span>歼敌</span>
                <strong>{hud.kills} / 8</strong>
              </div>
              <div>
                <span>剩余时间</span>
                <strong>{formatTime(hud.time)}</strong>
              </div>
              <div>
                <span>生命</span>
                <strong>{Math.ceil(hud.health)}</strong>
              </div>
            </div>
            <button className="primary-button compact" onClick={restart}>
              <span>再次行动</span>
              <i>↻</i>
            </button>
            <button className="text-button" onClick={() => setPhase("menu")}>
              返回任务简报
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
