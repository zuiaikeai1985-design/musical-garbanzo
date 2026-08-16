import "./style.css";
import { Game } from "./game/game";

const canvas = document.getElementById("game-canvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("game canvas missing");
}

const game = new Game(canvas);
game.start();
