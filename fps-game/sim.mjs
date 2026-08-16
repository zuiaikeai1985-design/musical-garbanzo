// 临时 AI 行为仿真：node sim.mjs
import * as THREE from "three";

const ctxProxy = new Proxy(
  {},
  {
    get: (t, k) => (typeof k === "string" ? () => undefined : undefined),
    set: () => true,
  },
);
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ctxProxy }),
};

const { World } = await import("./src/world.js");
const { EnemyManager } = await import("./src/enemies.js");

const scene = new THREE.Scene();
const world = new World(scene);
const effects = { worldFlash() {}, impact() {}, tracer() {} };
const audio = { shot() {} };
const enemies = new EnemyManager(scene, world, effects, audio);

// 假玩家：站在南侧沙袋后 (0, 17)
let dmgTaken = 0;
const player = {
  pos: new THREE.Vector3(0, 0, 17),
  height: 1.72,
  moveSpeed2D: 0,
  crouching: false,
  alive: true,
  get eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.62, this.pos.z);
  },
  takeDamage(d) {
    dmgTaken += d;
  },
};

enemies.spawnWave(3, 0.12, 0.55); // 简单难度第 1 回合
console.log(
  "spawn:",
  enemies.bots.map((b) => `#${b.id}(${b.pos.x.toFixed(0)},${b.pos.z.toFixed(0)})`).join(" "),
);

// 玩家开了两枪
enemies.notifyGunshot(player.pos.clone());

const dt = 0.05;
for (let step = 1; step <= 1600; step++) {
  enemies.update(dt, player, false);
  if (step % 200 === 0) {
    const t = (step * dt).toFixed(0);
    const info = enemies.bots
      .map((b) => {
        const d = b.pos.distanceTo(player.pos).toFixed(1);
        return `#${b.id}[${b.state}] (${b.pos.x.toFixed(1)},${b.pos.z.toFixed(1)}) d=${d} path=${b.path.length - b.pathIdx}`;
      })
      .join("  |  ");
    console.log(`t=${t}s ${info} dmg=${dmgTaken}`);
  }
}
const near = enemies.bots.filter((b) => b.pos.distanceTo(player.pos) < 12).length;
console.log(`RESULT: ${near}/3 bots within 12m of player, player damage taken: ${dmgTaken}`);
process.exit(near >= 2 ? 0 : 1);
