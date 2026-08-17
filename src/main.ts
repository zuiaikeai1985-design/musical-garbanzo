import "./style.css";
import { Game } from "./game/game";

const canvas = document.getElementById("game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("game canvas missing");
}

try {
  const game = new Game(canvas);
  game.start();
} catch (error) {
  const banner = document.createElement("div");
  banner.style.cssText =
    "position:fixed;inset:auto 16px 16px;z-index:99;background:#3a1010;color:#f2d6d6;padding:12px 16px;font:14px sans-serif";
  banner.textContent = `游戏启动失败：${error instanceof Error ? error.message : String(error)}。请用电脑 Chrome / Edge 打开，并允许硬件加速。`;
  document.body.append(banner);
  console.error(error);
}
