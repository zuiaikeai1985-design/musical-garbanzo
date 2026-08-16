import "./styles.css";
import { Game, type Quality } from "./core/game";
import type { Difficulty } from "./core/types";

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
}

const canvas = el<HTMLCanvasElement>("scene");
const menu = el("menu");
const pause = el("pause");
const gameover = el("gameover");
const loading = el("loading");

const difficultySelect = el<HTMLSelectElement>("difficulty");
const qualitySelect = el<HTMLSelectElement>("quality");
const markersCheckbox = el<HTMLInputElement>("markers");
const sensitivitySlider = el<HTMLInputElement>("sensitivity");
const sensitivityValue = el("sensitivity-value");
const sensitivityPause = el<HTMLInputElement>("sensitivity-pause");
const sensitivityPauseValue = el("sensitivity-pause-value");
const fovSlider = el<HTMLInputElement>("fov");
const fovValue = el("fov-value");

const game = new Game(canvas);

if (import.meta.env.DEV) {
  // Handy for poking at the simulation from the dev tools console.
  (window as unknown as { __game: Game }).__game = game;
}

const STORAGE_KEY = "operation-dust-settings";

function loadSettings(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      sensitivity?: number;
      fov?: number;
      difficulty?: Difficulty;
      quality?: Quality;
      markers?: boolean;
    };
    if (parsed.sensitivity) sensitivitySlider.value = String(parsed.sensitivity);
    if (parsed.fov) fovSlider.value = String(parsed.fov);
    if (parsed.difficulty) difficultySelect.value = parsed.difficulty;
    if (parsed.quality) qualitySelect.value = parsed.quality;
    if (typeof parsed.markers === "boolean") markersCheckbox.checked = parsed.markers;
  } catch {
    // Ignore malformed or unavailable storage.
  }
}

function syncSettings(): void {
  const sensitivity = Number(sensitivitySlider.value);
  const fov = Number(fovSlider.value);
  const difficulty = difficultySelect.value as Difficulty;
  const quality = qualitySelect.value as Quality;
  const markers = markersCheckbox.checked;

  sensitivityValue.textContent = sensitivity.toFixed(1);
  sensitivityPauseValue.textContent = sensitivity.toFixed(1);
  sensitivityPause.value = String(sensitivity);
  fovValue.textContent = String(fov);

  game.applySettings({ sensitivity, fov, difficulty, quality, markers });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sensitivity, fov, difficulty, quality, markers }));
  } catch {
    // Storage may be blocked; settings simply will not persist.
  }
}

loadSettings();
syncSettings();

sensitivitySlider.addEventListener("input", syncSettings);
fovSlider.addEventListener("input", syncSettings);
difficultySelect.addEventListener("change", syncSettings);
qualitySelect.addEventListener("change", syncSettings);
markersCheckbox.addEventListener("change", syncSettings);
sensitivityPause.addEventListener("input", () => {
  sensitivitySlider.value = sensitivityPause.value;
  syncSettings();
});

function startGame(): void {
  menu.classList.add("hidden");
  pause.classList.add("hidden");
  gameover.classList.add("hidden");
  syncSettings();
  game.start();
}

el("play-button").addEventListener("click", startGame);
el("retry-button").addEventListener("click", startGame);

el("resume-button").addEventListener("click", () => {
  pause.classList.add("hidden");
  game.resume();
});

el("quit-button").addEventListener("click", () => {
  pause.classList.add("hidden");
  menu.classList.remove("hidden");
  game.quitToMenu();
});

el("menu-button").addEventListener("click", () => {
  gameover.classList.add("hidden");
  menu.classList.remove("hidden");
  game.quitToMenu();
});

game.onPauseChanged = (paused) => {
  pause.classList.toggle("hidden", !paused);
};

game.onGameOver = (summary) => {
  el("gameover-title").textContent = "任务失败";
  el("gameover-title").className = "lose";
  el("result-grid").innerHTML = [
    ["坚持回合", String(summary.round)],
    ["总击杀", String(summary.kills)],
    ["爆头数", String(summary.headshots)],
    ["命中率", `${(summary.accuracy * 100).toFixed(0)}%`],
    ["总伤害", String(Math.round(summary.damage))],
    ["终结者", summary.killer || "—"],
  ]
    .map(([k, v]) => `<div class="cell"><div class="k">${k}</div><div class="v">${v}</div></div>`)
    .join("");
  gameover.classList.remove("hidden");
};

// The first frame has rendered by the time this fires, so the map is ready.
requestAnimationFrame(() => {
  window.setTimeout(() => loading.classList.add("hidden"), 350);
});
