// 临时命中判定验证脚本：node hittest.mjs
import * as THREE from "three";

// stub 掉 canvas 2d 上下文（world 贴图只需要 no-op）
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

const results = [];
const check = (name, cond) => results.push(`${cond ? "PASS" : "FAIL"} ${name}`);

const scene = new THREE.Scene();
const world = new World(scene);
const enemies = new EnemyManager(scene, world, null, null);

enemies.spawnWave(1, 0.3);
const bot = enemies.bots[0];
bot.pos.set(0, 0, 10);
const eye = new THREE.Vector3(0, 1.62, 20);

// 1. 同高度水平直射 → 命中头部
let hit = enemies.raycast(eye, new THREE.Vector3(0, 0, -1), 100);
check("level-shot-hits-head", !!hit && hit.isHead === true && Math.abs(hit.dist - 10) < 1);

// 2. 稍微下压 → 命中躯干
let dir = new THREE.Vector3(0, -0.06, -1).normalize();
hit = enemies.raycast(eye, dir, 100);
check("down-shot-hits-body", !!hit && hit.isHead === false);

// 3. 偏 5° → 脱靶
dir = new THREE.Vector3(Math.tan((5 * Math.PI) / 180), 0, -1).normalize();
check("wide-shot-misses", !enemies.raycast(eye, dir, 100));

// 4. 偏 1.5° 且稍微下压（瞄胸口）→ 命中躯干
dir = new THREE.Vector3(Math.tan((1.5 * Math.PI) / 180), -0.06, -1).normalize();
check("near-shot-hits", !!enemies.raycast(eye, dir, 100));

// 5. 中央墙阻挡子弹
bot.pos.set(-14, 0, -3);
const eye2 = new THREE.Vector3(-14, 1.62, 20);
const wallHit = world.raycast(eye2, new THREE.Vector3(0, 0, -1), 150);
const botHit = enemies.raycast(eye2, new THREE.Vector3(0, 0, -1), wallHit ? wallHit.dist : 150);
check("wall-blocks-shot", !!wallHit && !botHit && wallHit.dist < 21);

// 6. 导航图有足够的边
const edgeCount = world.edges.reduce((s, e) => s + e.length, 0);
check("navgraph-has-edges", edgeCount > 20);

// 7. 敌人射玩家的圆柱判定
const fakePlayer = { pos: new THREE.Vector3(-14, 0, 8), height: 1.72, moveSpeed2D: 0, crouching: false };
const t = enemies._rayVsPlayer(
  new THREE.Vector3(-14, 1.55, -2.99),
  new THREE.Vector3(0, -0.04, 1).normalize(),
  fakePlayer,
  100,
);
check("bot-shot-hits-player", t !== null);

// 8. 视线判定：拱门下方可以互见
const a = new THREE.Vector3(0, 1.5, 5);
const b = new THREE.Vector3(0, 1.5, -5);
check("arch-line-of-sight", world.hasLineOfSight(a, b));

console.log(results.join("\n"));
process.exit(results.every((l) => l.startsWith("PASS")) ? 0 : 1);
