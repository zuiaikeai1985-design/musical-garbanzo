import * as THREE from "three";
import { World } from "./world.js";
import { Player } from "./player.js";
import { WeaponSystem, WEAPONS } from "./weapons.js";
import { EnemyManager } from "./enemies.js";
import { Effects } from "./effects.js";
import { AudioManager } from "./audio.js";
import { HUD } from "./hud.js";
import { Input } from "./input.js";
import { clamp, lerp, DEG } from "./utils.js";

const BASE_FOV = 75;
const START_MONEY = 800;
const MAX_MONEY = 16000;
const ROUND_TIME = 115;
const FREEZE_TIME = 4;
const BUY_TIME_AFTER_LIVE = 10;

const BUY_ITEMS = [
  { key: "1", id: "mp5", kind: "weapon", label: "MP5 冲锋枪", price: WEAPONS.mp5.price },
  { key: "2", id: "shotgun", kind: "weapon", label: "XM 霰弹枪", price: WEAPONS.shotgun.price },
  { key: "3", id: "ak47", kind: "weapon", label: "AK-47 步枪", price: WEAPONS.ak47.price },
  { key: "4", id: "m4", kind: "weapon", label: "M4A1 卡宾枪", price: WEAPONS.m4.price },
  { key: "5", id: "awp", kind: "weapon", label: "AWP 狙击枪", price: WEAPONS.awp.price },
  { key: "6", id: "armor", kind: "armor", label: "防弹衣", price: 650 },
  { key: "7", id: "ammo", kind: "ammo", label: "补满弹药", price: 200 },
];

/** 检测软件渲染（SwiftShader/llvmpipe 等），自动降低画质保证帧率 */
function isSoftwareGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    return /swiftshader|llvmpipe|softpipe|software/i.test(name);
  } catch {
    return false;
  }
}

class Game {
  constructor() {
    this.lowQuality = isSoftwareGL();
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowQuality, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(this.lowQuality ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.lowQuality;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    document.getElementById("game").appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, window.innerWidth / window.innerHeight, 0.05, 400);
    this.scene.add(this.camera);

    this.audio = new AudioManager();
    this.world = new World(this.scene);
    if (this.lowQuality) this.world.sun.castShadow = false;
    this.effects = new Effects(this.scene);
    this.hud = new HUD();
    this.input = new Input(this.renderer.domElement);
    this.player = new Player(this.camera, this.world, this.audio);
    this.enemies = new EnemyManager(this.scene, this.world, this.effects, this.audio);
    this.weapons = new WeaponSystem(
      this.camera,
      this.player,
      this.world,
      this.enemies,
      this.effects,
      this.audio,
      this.hud,
    );

    this.state = "menu";
    this.money = START_MONEY;
    this.round = 1;
    this.scoreCT = 0;
    this.scoreT = 0;
    this.kills = 0;
    this.freezeTimer = 0;
    this.buyWindow = 0;
    this.roundTimer = ROUND_TIME;
    this.roundEndTimer = 0;
    this.diedLastRound = false;

    this._wireCallbacks();
    this._wireUI();

    this.player.reset(this.world.playerSpawn);
    this._lastT = performance.now();
    this.renderer.setAnimationLoop(() => this._tick());

    window.addEventListener("resize", () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _wireCallbacks() {
    this.enemies.onKill = (bot, isHead, weaponId) => {
      this.kills++;
      const reward = weaponId === "knife" ? 1500 : 300;
      this.money = Math.min(MAX_MONEY, this.money + reward);
      this.hud.setMoney(this.money);
      const wname = WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId;
      this.hud.killfeed(`你 [${wname}] 击杀了敌人 +$${reward}`, isHead);
      this.hud.setEnemiesLeft(this.enemies.aliveCount());
      this.audio.kill();
    };

    this.player.onDamaged = (dmg, fromPos) => {
      this.hud.damageFlash();
      this.enemies.alertAll(this.player.pos.clone());
    };

    this.weapons.onShot = () => {
      this.enemies.notifyGunshot(this.player.pos.clone());
    };

    this.weapons.onAmmoChanged = (info) => this.hud.setAmmo(info);

    this.input.onLockChange = (locked) => {
      if (!locked && ["freeze", "live", "roundend"].includes(this.state)) {
        this._pause();
      }
    };
    document.addEventListener("pointerlockerror", () => {
      this.hud.hint("指针锁定不可用：可用方向键转视角、Enter 射击", 5);
    });
  }

  _wireUI() {
    document.getElementById("btn-start").addEventListener("click", () => {
      this.audio.init();
      this.audio.resume();
      this.audio.setCamera(this.camera);
      this.hud.showOverlay("menu", false);
      this.input.requestLock();
      this._newMatch();
    });
    document.getElementById("btn-resume").addEventListener("click", () => this._resume());
    document.getElementById("btn-restart").addEventListener("click", () => {
      this.hud.showOverlay("pause", false);
      this.input.requestLock();
      this._newMatch();
    });
  }

  _newMatch() {
    this.money = START_MONEY;
    this.round = 1;
    this.scoreCT = 0;
    this.scoreT = 0;
    this.kills = 0;
    this.player.armor = 0;
    this.diedLastRound = true; // 强制重置武器
    this._startRound();
  }

  _startRound() {
    this.state = "freeze";
    this.freezeTimer = FREEZE_TIME;
    this.buyWindow = FREEZE_TIME + BUY_TIME_AFTER_LIVE;
    this.roundTimer = ROUND_TIME;

    this.player.reset(this.world.playerSpawn);
    this.weapons.reset(this.diedLastRound);
    this.diedLastRound = false;

    const count = Math.min(2 + this.round, 8);
    const skill = clamp(0.28 + this.round * 0.06, 0, 0.9);
    this.enemies.spawnWave(count, skill);

    this.hud.setRound(this.round);
    this.hud.setScore(this.scoreCT, this.scoreT);
    this.hud.setEnemiesLeft(this.enemies.aliveCount());
    this.hud.setMoney(this.money);
    this.hud.setHealth(this.player.hp);
    this.hud.setArmor(this.player.armor);
    this.hud.setAmmo(this.weapons.getAmmoInfo());
    this.hud.setTimer(this.roundTimer);
    this.hud.banner(`第 ${this.round} 回合`, `消灭全部 ${count} 名敌人`, 2.6);
    this.hud.hint("按 B 打开购买菜单", 3.5);
    this.audio.roundStart();
  }

  _winRound() {
    this.state = "roundend";
    this.roundEndTimer = 3.2;
    this.scoreCT++;
    this.money = Math.min(MAX_MONEY, this.money + 3000);
    this.hud.setScore(this.scoreCT, this.scoreT);
    this.hud.setMoney(this.money);
    this.hud.banner("回合胜利", "全部敌人已被消灭 · 奖励 $3000", 3, "good");
    this.audio.win();
    this.hud.buyMenuVisible(false);
  }

  _loseRound(reason) {
    this.state = "roundend";
    this.roundEndTimer = 3.2;
    this.scoreT++;
    this.money = Math.min(MAX_MONEY, this.money + 1400);
    if (!this.player.alive) {
      this.diedLastRound = true;
      this.player.armor = 0;
    }
    this.hud.setScore(this.scoreCT, this.scoreT);
    this.hud.setMoney(this.money);
    this.hud.banner("回合失败", `${reason} · 补助 $1400`, 3, "bad");
    this.audio.lose();
    this.hud.buyMenuVisible(false);
  }

  _pause() {
    if (this.state === "paused" || this.state === "menu") return;
    this.pausedFrom = this.state;
    this.state = "paused";
    this.hud.showOverlay("pause", true);
  }

  _resume() {
    this.hud.showOverlay("pause", false);
    this.state = this.pausedFrom || "live";
    this.input.requestLock();
  }

  _toggleBuyMenu() {
    if (this.hud.isBuyMenuOpen()) {
      this.hud.buyMenuVisible(false);
    } else {
      this._refreshBuyMenu();
      this.hud.buyMenuVisible(true);
    }
  }

  _refreshBuyMenu() {
    this.hud.renderBuyMenu(BUY_ITEMS, this.money, this.weapons.primary, this.player.armor);
  }

  _handleBuyInput() {
    for (const item of BUY_ITEMS) {
      if (this.input.wasPressed(`Digit${item.key}`) || this.input.wasPressed(`Numpad${item.key}`)) {
        this._attemptBuy(item);
      }
    }
  }

  _attemptBuy(item) {
    if (this.money < item.price) {
      this.audio.denied();
      this.hud.hint("资金不足", 1.5);
      return;
    }
    if (item.kind === "weapon") {
      if (this.weapons.primary === item.id) {
        this.audio.denied();
        this.hud.hint("已装备该武器", 1.5);
        return;
      }
      this.money -= item.price;
      this.weapons.give(item.id);
    } else if (item.kind === "armor") {
      if (this.player.armor >= 100) {
        this.audio.denied();
        this.hud.hint("护甲已满", 1.5);
        return;
      }
      this.money -= item.price;
      this.player.armor = 100;
      this.hud.setArmor(100);
    } else if (item.kind === "ammo") {
      this.money -= item.price;
      this.weapons.fillAmmo();
    }
    this.audio.buy();
    this.hud.setMoney(this.money);
    this._refreshBuyMenu();
  }

  _tick() {
    const now = performance.now();
    const dt = Math.min((now - this._lastT) / 1000, 0.05);
    this._lastT = now;
    this.hud.update(dt);
    this.effects.update(dt);

    if (this.state === "menu" || this.state === "paused") {
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    // 灵敏度（开镜时降低）
    const sens = this.weapons.getSensScale();
    this.input.mouseDX *= sens;
    this.input.mouseDY *= sens;

    const buyOpen = this.hud.isBuyMenuOpen();
    const movementLocked = this.state === "freeze" || this.state === "roundend" || buyOpen;

    // 死亡镜头下沉
    if (!this.player.alive) {
      this.player.eye = lerp(this.player.eye, 0.35, Math.min(1, dt * 3));
    }

    this.player.update(dt, this.input, movementLocked);

    const canFire = this.state === "live" && this.player.alive && !buyOpen;
    const allowSwitch = !buyOpen && (this.state === "live" || this.state === "freeze");
    this.weapons.update(dt, this.input, canFire, allowSwitch);

    this.enemies.update(dt, this.player, this.state !== "live");

    // 购买菜单
    const canBuy = this.state === "freeze" || (this.state === "live" && this.buyWindow > 0);
    if (this.input.wasPressed("KeyB")) {
      if (buyOpen) this.hud.buyMenuVisible(false);
      else if (canBuy) this._toggleBuyMenu();
      else this.hud.hint("购买时间已结束", 1.5);
    }
    if (buyOpen) {
      this._handleBuyInput();
      if (!canBuy) this.hud.buyMenuVisible(false);
    }

    // 状态机
    if (this.state === "freeze") {
      this.freezeTimer -= dt;
      if (this.freezeTimer <= 0) {
        this.state = "live";
        this.hud.banner("行动开始！", "", 1.2, "good");
      }
    } else if (this.state === "live") {
      this.buyWindow -= dt;
      this.roundTimer -= dt;
      this.hud.setTimer(this.roundTimer);
      if (!this.player.alive) {
        this._loseRound("你已阵亡");
      } else if (this.enemies.aliveCount() === 0) {
        this._winRound();
      } else if (this.roundTimer <= 0) {
        this._loseRound("时间耗尽");
      }
    } else if (this.state === "roundend") {
      this.roundEndTimer -= dt;
      if (this.roundEndTimer <= 0) {
        this.round++;
        this._startRound();
      }
    }

    // HUD 帧同步
    this.hud.setHealth(this.player.hp);
    this.hud.setArmor(this.player.armor);
    const scoped = this.weapons.isScoped();
    this.hud.scope(scoped);
    const spreadPx =
      4 + Math.tan(this.weapons.getSpread()) * ((window.innerHeight * 0.5) / Math.tan((this.camera.fov / 2) * DEG));
    this.hud.setCrosshair(
      clamp(spreadPx, 4, 80),
      !scoped && !buyOpen && this.player.alive && this.weapons.def.type !== "melee",
    );
    this.hud.drawRadar(this.world, this.player.pos, this.player.yaw, this.enemies.radarDots());

    // 视野（开镜/瞄准）
    const fov = this.weapons.getFov(BASE_FOV);
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }

    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }
}

new Game();
