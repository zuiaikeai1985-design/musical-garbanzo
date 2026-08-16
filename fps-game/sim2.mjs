// 临时端到端射击仿真：node sim2.mjs
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
globalThis.window = { innerHeight: 800 };

const { World } = await import("./src/world.js");
const { EnemyManager } = await import("./src/enemies.js");
const { Player } = await import("./src/player.js");
const { WeaponSystem } = await import("./src/weapons.js");
const { DEG } = await import("./src/utils.js");

const scene = new THREE.Scene();
const world = new World(scene);
const camera = new THREE.PerspectiveCamera(75, 1.6, 0.05, 400);
scene.add(camera);

const audioStub = new Proxy({}, { get: () => () => {} });
const effectsStub = new Proxy({ flashTex: null }, { get: (t, k) => (k in t ? t[k] : () => {}) });
const hudStub = new Proxy({}, { get: () => () => {} });

const enemies = new EnemyManager(scene, world, effectsStub, audioStub);
const player = new Player(camera, world, audioStub);
player.reset({ pos: new THREE.Vector3(0, 0, 16), yaw: 0 });
const weapons = new WeaponSystem(camera, player, world, enemies, effectsStub, audioStub, hudStub);
weapons.aimAssist = 0.85;

enemies.spawnWave(1, 0.12, 0.55);
const bot = enemies.bots[0];

let hits = 0;
let kills = 0;
const origApply = enemies.applyDamage.bind(enemies);
enemies.applyDamage = (b, dmg, isHead, wid) => {
  hits++;
  origApply(b, dmg, isHead, wid);
};
enemies.onKill = () => kills++;

const idleInput = {
  mouseDown: false,
  mouse2Down: false,
  clicks: 0,
  mouseDX: 0,
  mouseDY: 0,
  wheelDelta: 0,
  isDown: () => false,
  wasPressed: () => false,
};

function runScenario(name, { yawErrDeg, pitchDeg, dist, shots, weapon }) {
  bot.pos.set(0, 0, 16 - dist);
  bot.hp = 100;
  bot.state = "patrol";
  hits = 0;
  kills = 0;
  if (weapon && weapons.current !== weapon) {
    weapons.primary = weapon;
    weapons._initAmmo(weapon);
    weapons.switchTo(weapon);
  }
  weapons.switchTimer = 0;
  weapons.fireTimer = 0;
  weapons.bloom = 0;
  weapons.recoilPitch = 0;
  weapons.recoilYaw = 0;
  const a = weapons.ammo[weapons.current];
  a.mag = weapons.def.magSize;

  player.yaw = yawErrDeg * DEG; // 偏离正对目标的角度
  player.pitch = pitchDeg * DEG;
  player.syncCamera();

  let fired = 0;
  let t = 0;
  const dt = 1 / 30;
  while (fired < shots && t < 15) {
    const wantFire = weapons.fireTimer <= 0;
    const magBefore = weapons.ammo[weapons.current].mag;
    weapons.update(
      dt,
      { ...idleInput, mouseDown: wantFire, clicks: wantFire ? 1 : 0 },
      true,
      true,
    );
    if (weapons.ammo[weapons.current].mag < magBefore) fired++;
    // 保持 bot 不动不反击
    bot.state = "patrol";
    bot.hp = Math.max(bot.hp, 1) === bot.hp && bot.hp <= 0 ? bot.hp : bot.hp;
    t += dt;
  }
  console.log(
    `${name}: fired=${fired} hits=${hits} kills=${kills} (${weapons.current}, dist=${dist}m, yawErr=${yawErrDeg}°, pitch=${pitchDeg}°)`,
  );
  return { fired, hits, kills };
}

// 场景 1：USP，8m，水平误差 3°，平视 → 辅助瞄准应能命中大部分
const s1 = runScenario("S1 usp 3° off level", { yawErrDeg: 3, pitchDeg: 0, dist: 8, shots: 8 });
// 场景 2：USP，8m，水平误差 3°，压低 4°（瞄胸口） → 应命中
const s2 = runScenario("S2 usp 3° off chest", { yawErrDeg: 3, pitchDeg: -4, dist: 8, shots: 8 });
// 场景 3：USP，8m，误差 8°（超出吸附锥） → 应大多脱靶
const s3 = runScenario("S3 usp 8° off", { yawErrDeg: 8, pitchDeg: 0, dist: 8, shots: 8 });
// 场景 4：霰弹枪 5m 误差 4° → 多弹丸+吸附应大量命中
const s4 = runScenario("S4 shotgun 4° off 5m", { yawErrDeg: 4, pitchDeg: -3, dist: 5, shots: 3, weapon: "shotgun" });
// 场景 5：MP5 连喷 10m 误差 3°
const s5 = runScenario("S5 mp5 3° off 10m", { yawErrDeg: 3, pitchDeg: -3, dist: 10, shots: 12, weapon: "mp5" });

const ok = s1.hits >= 5 && s2.hits >= 5 && s3.hits <= 3 && s4.hits >= 6 && s5.hits >= 7;
console.log(ok ? "SIM2 PASS" : "SIM2 FAIL");
process.exit(ok ? 0 : 1);
