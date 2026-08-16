import * as THREE from "three";
import { AudioEngine } from "./audio";
import { Input } from "./input";
import { DIFFICULTIES, type Difficulty } from "./types";
import { Bot, type BotWorld } from "../entities/bot";
import { Effects } from "../entities/effects";
import { Player } from "../player/player";
import { ViewModel } from "../player/viewmodel";
import {
  WEAPONS,
  WEAPON_ORDER,
  WeaponState,
  type WeaponId,
} from "../player/weapons";
import { Hud } from "../ui/hud";
import { Radar } from "../ui/radar";
import { buildMap, type GameMap } from "../world/map";
import { rayBoxes } from "../world/collision";
import { NavGrid } from "../world/navgrid";

type GameState = "menu" | "playing" | "paused" | "gameover";

interface Stats {
  kills: number;
  headshots: number;
  shots: number;
  hits: number;
  damage: number;
  deaths: number;
}

export type Quality = "auto" | "low" | "medium" | "high";

export interface Settings {
  sensitivity: number;
  fov: number;
  difficulty: Difficulty;
  quality: Quality;
  /** Show a marker above enemies that currently have line of sight on you. */
  markers: boolean;
}

const SLOT_KEYS: Record<string, WeaponId> = {
  Digit1: "rifle",
  Digit2: "smg",
  Digit3: "pistol",
  Digit4: "sniper",
  Digit5: "knife",
};

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private lastFrameTime = performance.now();

  private readonly input: Input;
  private readonly audio = new AudioEngine();
  private readonly hud = new Hud();
  private readonly effects: Effects;
  private readonly map: GameMap;
  private readonly player: Player;
  private readonly viewModel: ViewModel;
  private readonly radar: Radar;

  private readonly weapons = new Map<WeaponId, WeaponState>();
  private currentWeapon: WeaponId = "rifle";
  private previousWeapon: WeaponId = "pistol";
  private switchTimer = 0;

  private readonly navGrid: NavGrid;
  private navTimer = 0;

  private readonly bots: Bot[] = [];
  private spawnQueue = 0;
  private spawnTimer = 0;
  private round = 1;
  private roundState: "active" | "intermission" = "active";
  private intermissionTimer = 0;

  private state: GameState = "menu";
  private settings: Settings = {
    sensitivity: 2,
    fov: 90,
    difficulty: "normal",
    quality: "auto",
    markers: true,
  };
  private activeQuality: Exclude<Quality, "auto"> = "high";
  private renderScale = 1;
  private qualitySampleTime = 0;
  private qualitySampleFrames = 0;
  private stats: Stats = { kills: 0, headshots: 0, shots: 0, hits: 0, damage: 0, deaths: 0 };

  private aiming = false;
  private cameraTilt = 0;
  private respawnTimer = 0;
  private lastKiller = "";

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.camera = new THREE.PerspectiveCamera(
      this.settings.fov,
      window.innerWidth / window.innerHeight,
      0.05,
      400,
    );
    this.camera.rotation.order = "YXZ";
    this.scene.add(this.camera);

    this.map = buildMap(this.scene);
    this.effects = new Effects(this.scene);
    this.player = new Player(this.map.playerSpawn, this.map.playerSpawnYaw);
    this.viewModel = new ViewModel(this.camera);
    this.navGrid = new NavGrid(this.map.bounds, this.map.colliders);
    this.navGrid.update(this.player.position);
    this.radar = new Radar(
      document.getElementById("radar") as HTMLCanvasElement,
      this.map.bounds,
      this.map.colliders,
    );

    for (const id of WEAPON_ORDER) this.weapons.set(id, new WeaponState(WEAPONS[id]));

    this.input = new Input(canvas);
    this.input.onLockChange = (locked) => {
      if (!locked && this.state === "playing") this.pause();
    };

    this.hud.buildWeaponList(
      WEAPON_ORDER.map((id) => ({ id, name: WEAPONS[id].name, key: String(WEAPONS[id].slot) })),
    );
    this.hud.setActiveWeapon(this.currentWeapon);

    window.addEventListener("resize", this.onResize);
    requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- lifecycle

  applySettings(settings: Partial<Settings>): void {
    const previousQuality = this.settings.quality;
    this.settings = { ...this.settings, ...settings };
    this.camera.fov = this.settings.fov;
    this.camera.updateProjectionMatrix();

    if (this.settings.quality !== previousQuality || settings.quality !== undefined) {
      this.applyQuality(
        this.settings.quality === "auto" ? this.activeQuality : this.settings.quality,
      );
      this.qualitySampleTime = 0;
      this.qualitySampleFrames = 0;
    }
  }

  /** Shadow resolution and render scale, tuned for the current hardware. */
  private applyQuality(level: Exclude<Quality, "auto">): void {
    this.activeQuality = level;
    const dpr = Math.min(window.devicePixelRatio, 2);
    const sun = this.map.sun;

    const previousShadows = this.renderer.shadowMap.enabled;
    const setShadow = (size: number | null): void => {
      if (size === null) {
        this.renderer.shadowMap.enabled = false;
        sun.castShadow = false;
        return;
      }
      this.renderer.shadowMap.enabled = true;
      sun.castShadow = true;
      if (sun.shadow.mapSize.x !== size) {
        sun.shadow.mapSize.set(size, size);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    };

    switch (level) {
      case "high":
        setShadow(2048);
        this.renderScale = dpr;
        break;
      case "medium":
        setShadow(1024);
        this.renderScale = Math.min(dpr, 1);
        break;
      case "low":
        setShadow(null);
        this.renderScale = Math.min(this.renderScale, 0.7);
        break;
    }
    this.renderer.setPixelRatio(this.renderScale);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    // Toggling shadows changes the shader defines, so materials must recompile.
    if (previousShadows !== this.renderer.shadowMap.enabled) {
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const material = object.material as THREE.Material | THREE.Material[];
          if (Array.isArray(material)) material.forEach((m) => (m.needsUpdate = true));
          else material.needsUpdate = true;
        }
      });
    }
    this.onQualityChanged?.(level);
  }

  onQualityChanged: ((level: Exclude<Quality, "auto">) => void) | null = null;

  /**
   * In auto mode, step the quality down when the frame rate is poor and, once
   * effects are already off, keep scaling the render resolution down.
   */
  private updateAdaptiveQuality(rawDt: number): void {
    if (this.settings.quality !== "auto") return;
    this.qualitySampleTime += rawDt;
    this.qualitySampleFrames++;
    if (this.qualitySampleTime < 1.5) return;

    const fps = this.qualitySampleFrames / this.qualitySampleTime;
    this.qualitySampleTime = 0;
    this.qualitySampleFrames = 0;

    if (this.activeQuality === "high") {
      if (fps < 45) this.applyQuality("medium");
    } else if (this.activeQuality === "medium") {
      if (fps < 35) this.applyQuality("low");
    } else if (fps < 28 && this.renderScale > 0.4) {
      this.renderScale = Math.max(0.4, this.renderScale - 0.15);
      this.renderer.setPixelRatio(this.renderScale);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  get currentSettings(): Settings {
    return this.settings;
  }

  start(): void {
    this.audio.resume();
    this.resetMatch();
    this.state = "playing";
    this.hud.setVisible(true);
    this.input.requestLock();
    this.startRound(1);
  }

  resume(): void {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.input.requestLock();
  }

  pause(): void {
    if (this.state !== "playing") return;
    this.state = "paused";
    this.input.releaseLock();
    this.onPauseChanged?.(true);
  }

  quitToMenu(): void {
    this.state = "menu";
    this.input.releaseLock();
    this.hud.setVisible(false);
    this.hud.setScope(false);
    this.clearBots();
    this.effects.clear();
  }

  onPauseChanged: ((paused: boolean) => void) | null = null;
  onGameOver: ((summary: {
    round: number;
    kills: number;
    headshots: number;
    accuracy: number;
    damage: number;
    killer: string;
  }) => void) | null = null;

  private resetMatch(): void {
    this.stats = { kills: 0, headshots: 0, shots: 0, hits: 0, damage: 0, deaths: 0 };
    this.round = 1;
    this.roundState = "active";
    this.clearBots();
    this.effects.clear();
    this.player.reset(this.map.playerSpawn, this.map.playerSpawnYaw);
    for (const weapon of this.weapons.values()) weapon.resetAmmo();
    this.currentWeapon = "rifle";
    this.previousWeapon = "pistol";
    this.viewModel.setWeapon(this.currentWeapon);
    this.hud.setActiveWeapon(this.currentWeapon);
    this.hud.setKills(0);
    this.hud.setScope(false);
    this.aiming = false;
    this.updateAmmoHud();
  }

  private clearBots(): void {
    for (const bot of this.bots) this.scene.remove(bot.group);
    this.bots.length = 0;
    this.spawnQueue = 0;
  }

  // ------------------------------------------------------------------- rounds

  private startRound(round: number): void {
    const profile = DIFFICULTIES[this.settings.difficulty];
    this.round = round;
    this.roundState = "active";
    this.spawnQueue = profile.baseBots + profile.botsPerRound * (round - 1);
    this.spawnTimer = 0.6;
    this.hud.setRound(round);
    this.hud.setEnemies(this.spawnQueue);
    this.hud.showBanner(`第 ${round} 回合`, `消灭 ${this.spawnQueue} 名敌人`, 2.4);
    this.audio.roundStart();
  }

  private endRound(): void {
    this.roundState = "intermission";
    this.intermissionTimer = 4.5;
    const healed = Math.min(100, this.player.health + 35);
    this.player.health = healed;
    this.player.armor = Math.min(100, this.player.armor + 40);
    for (const weapon of this.weapons.values()) {
      weapon.reserve = weapon.spec.reserveAmmo;
      weapon.mag = weapon.spec.magSize;
      weapon.cancelReload();
    }
    this.updateAmmoHud();
    this.hud.showBanner("区域已清理", "补给已投放 · 准备下一波", 3.2);
    this.hud.showPopup("+35 生命 · 弹药补满");
    this.audio.roundWin();
  }

  private updateSpawning(dt: number): void {
    const profile = DIFFICULTIES[this.settings.difficulty];
    const alive = this.bots.filter((bot) => bot.alive).length;

    if (this.roundState === "active") {
      if (this.spawnQueue > 0 && alive < profile.maxAlive) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.spawnBot();
          this.spawnQueue--;
          this.spawnTimer = 0.9 + Math.random() * 1.3;
        }
      }
      this.hud.setEnemies(alive + this.spawnQueue);
      if (this.spawnQueue === 0 && alive === 0) this.endRound();
    } else {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) this.startRound(this.round + 1);
    }
  }

  private spawnBot(): void {
    const profile = DIFFICULTIES[this.settings.difficulty];
    // Spawn out of sight but close enough that fights start quickly.
    const far = this.map.botSpawns.filter(
      (spawn) => spawn.distanceTo(this.player.position) > 16,
    );
    const candidates = (far.length >= 3 ? far : this.map.botSpawns).sort(
      (a, b) =>
        a.distanceToSquared(this.player.position) - b.distanceToSquared(this.player.position),
    );
    const pick = candidates[Math.floor(Math.random() * Math.min(4, candidates.length))];
    const spawn = pick.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 2.2, 0, (Math.random() - 0.5) * 2.2),
    );
    const bot = new Bot(spawn, profile);
    bot.alertTo(this.player.position);
    this.scene.add(bot.group);
    this.bots.push(bot);
  }

  // ------------------------------------------------------------------ weapons

  private get weapon(): WeaponState {
    return this.weapons.get(this.currentWeapon)!;
  }

  private switchWeapon(id: WeaponId): void {
    if (id === this.currentWeapon || this.switchTimer > 0) return;
    this.previousWeapon = this.currentWeapon;
    this.weapon.cancelReload();
    this.currentWeapon = id;
    this.switchTimer = 0.45;
    this.aiming = false;
    this.hud.setScope(false);
    this.viewModel.setWeapon(id);
    this.hud.setActiveWeapon(id);
    this.hud.setWeaponName(WEAPONS[id].name);
    this.audio.switchWeapon();
    this.updateAmmoHud();
  }

  private updateAmmoHud(): void {
    const weapon = this.weapon;
    this.hud.setAmmo(weapon.mag, weapon.reserve, weapon.isMelee);
    this.hud.setWeaponName(weapon.spec.name);
    this.hud.setReloadHint(!weapon.isMelee && weapon.mag === 0 && weapon.reserve > 0);
  }

  private currentSpread(): number {
    const weapon = this.weapon;
    const spec = weapon.spec;
    const speed = this.player.horizontalSpeed;
    let spread: number;
    if (!this.player.grounded) spread = spec.spread.air;
    else if (speed > 2.4) spread = spec.spread.moving;
    else if (this.player.crouching) spread = spec.spread.crouch;
    else spread = spec.spread.stand;

    spread += Math.min(spec.spread.max, spec.spread.perShot * weapon.shotIndex);
    if (this.aiming) spread *= spec.scoped ? 0.06 : 0.45;
    return Math.min(spread, spec.spread.max + spec.spread.air);
  }

  private tryFire(): void {
    const weapon = this.weapon;
    const spec = weapon.spec;
    if (this.switchTimer > 0 || !this.player.alive) return;
    if (weapon.cooldown > 0) return;

    if (weapon.isMelee) {
      this.meleeAttack();
      return;
    }

    if (weapon.reloading) return;
    if (weapon.mag <= 0) {
      this.audio.dryFire();
      weapon.cooldown = 0.25;
      if (weapon.reserve > 0) weapon.startReload();
      return;
    }

    weapon.consume();
    this.stats.shots++;
    this.audio.gunshot(spec.sound, 0.85);
    this.viewModel.fire(spec.sound === "sniper" ? 1.6 : 1);

    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const dir = this.player.getAimDirection(new THREE.Vector3());

    const spreadRad = THREE.MathUtils.degToRad(this.currentSpread());
    if (spreadRad > 0) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * spreadRad;
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
      const up = new THREE.Vector3().crossVectors(right, dir).normalize();
      dir
        .addScaledVector(right, Math.cos(angle) * Math.tan(radius))
        .addScaledVector(up, Math.sin(angle) * Math.tan(radius))
        .normalize();
    }

    this.resolveShot(origin, dir, spec.range);

    // Recoil: use the spray pattern so each weapon kicks predictably.
    const pattern = spec.recoil.pattern;
    const index = Math.min(weapon.shotIndex - 1, pattern.length - 1);
    const [px, py] = pattern[Math.max(0, index)];
    this.player.addRecoil(
      THREE.MathUtils.degToRad(spec.recoil.vertical * py),
      THREE.MathUtils.degToRad(spec.recoil.horizontal * px),
    );

    const muzzle = this.viewModel.getMuzzleWorldPosition(new THREE.Vector3());
    this.effects.muzzleSmoke(muzzle, dir);

    for (const bot of this.bots) {
      if (bot.alive && bot.position.distanceTo(this.player.position) < 34) {
        bot.alertTo(this.player.position);
      }
    }
    this.updateAmmoHud();
  }

  private resolveShot(origin: THREE.Vector3, dir: THREE.Vector3, range: number): void {
    const spec = this.weapon.spec;
    const worldHit = rayBoxes(origin, dir, this.map.colliders, range);
    let closestBot: Bot | null = null;
    let closestHit: ReturnType<Bot["raycast"]> = null;

    for (const bot of this.bots) {
      const hit = bot.raycast(origin, dir, range);
      if (hit && (!closestHit || hit.distance < closestHit.distance)) {
        closestHit = hit;
        closestBot = bot;
      }
    }

    const muzzle = this.viewModel.getMuzzleWorldPosition(new THREE.Vector3());

    if (closestBot && closestHit && (!worldHit || closestHit.distance < worldHit.distance)) {
      const falloff = THREE.MathUtils.clamp(
        1 -
          ((closestHit.distance - spec.falloffStart) / (spec.falloffEnd - spec.falloffStart)) *
            (1 - spec.falloffMin),
        spec.falloffMin,
        1,
      );
      let multiplier = 1;
      if (closestHit.part === "head") multiplier = spec.headMultiplier;
      else if (closestHit.part === "legs") multiplier = spec.legMultiplier;
      else if (closestHit.part === "stomach") multiplier = 1.15;

      const damage = spec.damage * multiplier * falloff;
      const killed = closestBot.takeDamage(damage, spec.armorPenetration);

      this.stats.hits++;
      this.stats.damage += damage;
      if (closestHit.part === "head") this.stats.headshots++;

      this.effects.tracer(muzzle, closestHit.point, 1);
      this.effects.impact(closestHit.point, closestHit.normal, "flesh");
      this.audio.flesh(0, 0.5);
      this.audio.hitmarker(closestHit.part === "head");
      this.hud.showHitmarker(killed);

      if (killed) this.onBotKilled(closestBot, closestHit.part === "head");
      else closestBot.alertTo(this.player.position);
      return;
    }

    if (worldHit) {
      this.effects.tracer(muzzle, worldHit.point, 1);
      this.effects.impact(worldHit.point, worldHit.normal, "world");
      this.audio.impact(0, 0.28);
    } else {
      this.effects.tracer(muzzle, origin.clone().addScaledVector(dir, range), 1);
    }
  }

  private meleeAttack(): void {
    const weapon = this.weapon;
    const spec = weapon.spec;
    weapon.consume();
    this.viewModel.melee();
    this.audio.knifeSwing();

    const origin = this.camera.getWorldPosition(new THREE.Vector3());
    const forward = this.player.getAimDirection(new THREE.Vector3());
    let target: Bot | null = null;
    let bestDistance = Infinity;

    for (const bot of this.bots) {
      if (!bot.alive) continue;
      const toBot = bot.eye.clone().sub(origin);
      const distance = toBot.length();
      if (distance > (spec.meleeRange ?? 2.2)) continue;
      if (forward.dot(toBot.normalize()) < 0.55) continue;
      if (distance < bestDistance) {
        bestDistance = distance;
        target = bot;
      }
    }

    if (!target) return;

    const botForward = new THREE.Vector3(
      -Math.sin(target.group.rotation.y),
      0,
      -Math.cos(target.group.rotation.y),
    );
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();
    const backstab = botForward.dot(flatForward) > 0.5;
    const damage = backstab ? (spec.meleeBackstab ?? 200) : spec.damage;

    this.stats.shots++;
    this.stats.hits++;
    this.stats.damage += damage;
    const killed = target.takeDamage(damage, spec.armorPenetration);
    this.effects.impact(target.eye, forward.clone().negate(), "flesh");
    this.audio.flesh(0, 0.7);
    this.audio.hitmarker(backstab);
    this.hud.showHitmarker(killed);
    if (killed) this.onBotKilled(target, false);
    else target.alertTo(this.player.position);
  }

  private onBotKilled(bot: Bot, headshot: boolean): void {
    this.stats.kills++;
    this.hud.setKills(this.stats.kills);
    this.hud.addKill("你", bot.name, WEAPONS[this.currentWeapon].name, headshot);
    this.audio.death();
    const weapon = this.weapon;
    if (!weapon.isMelee) {
      weapon.reserve = Math.min(weapon.spec.reserveAmmo, weapon.reserve + weapon.spec.magSize / 2);
      this.updateAmmoHud();
    }
  }

  // -------------------------------------------------------------------- input

  private handleWeaponInput(dt: number): void {
    this.switchTimer = Math.max(0, this.switchTimer - dt);

    for (const [code, id] of Object.entries(SLOT_KEYS)) {
      if (this.input.wasPressed(code)) this.switchWeapon(id);
    }
    if (this.input.wasPressed("KeyQ")) this.switchWeapon(this.previousWeapon);
    if (this.input.wheelDelta !== 0) {
      const index = WEAPON_ORDER.indexOf(this.currentWeapon);
      const next =
        (index + (this.input.wheelDelta > 0 ? 1 : -1) + WEAPON_ORDER.length) % WEAPON_ORDER.length;
      this.switchWeapon(WEAPON_ORDER[next]);
    }

    const weapon = this.weapon;
    if (this.input.wasPressed("KeyR")) {
      if (weapon.startReload()) this.aiming = false;
    }

    // Aim / scope on right mouse button.
    const wantAim =
      this.input.isMouseDown(2) &&
      weapon.spec.zoomFov !== null &&
      !weapon.reloading &&
      this.switchTimer <= 0;
    if (wantAim !== this.aiming) {
      this.aiming = wantAim;
      if (weapon.spec.scoped) this.hud.setScope(wantAim);
    }

    const canFire =
      this.player.alive &&
      (weapon.spec.mode === "auto"
        ? this.input.isMouseDown(0)
        : this.input.wasMousePressed(0));
    if (canFire) this.tryFire();

    const cue = weapon.update(dt);
    if (cue) this.audio.reload(cue);
    if (weapon.reloading || cue) this.updateAmmoHud();

    // Auto-reload when the magazine runs dry.
    if (!weapon.isMelee && weapon.mag === 0 && weapon.reserve > 0 && !weapon.reloading) {
      weapon.startReload();
    }
  }

  // --------------------------------------------------------------- bot damage

  private damagePlayer = (amount: number, from: THREE.Vector3, botName: string): void => {
    if (!this.player.alive) return;
    this.player.takeDamage(amount);
    this.hud.setHealth(this.player.health);
    this.hud.setArmor(this.player.armor);
    this.hud.flashDamage(0.28 + Math.min(0.5, amount / 60));
    this.audio.playerHurt();

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const to = from.clone().sub(this.player.position);
    to.y = 0;
    to.normalize();
    const angle = Math.atan2(right.dot(to), forward.dot(to));
    this.hud.showHitDirection(angle - Math.PI / 2);

    // Getting shot shakes the aim slightly.
    this.player.addRecoil(
      THREE.MathUtils.degToRad((Math.random() - 0.3) * amount * 0.06),
      THREE.MathUtils.degToRad((Math.random() - 0.5) * amount * 0.08),
    );

    if (!this.player.alive) {
      this.lastKiller = botName;
      this.onPlayerDeath();
    }
  };

  private onPlayerDeath(): void {
    this.stats.deaths++;
    this.hud.addKill(this.lastKiller, "你", "AK", false);
    this.hud.showBanner("你已阵亡", "", 3);
    this.audio.gameOver();
    this.respawnTimer = 2.4;
  }

  private finishGame(): void {
    this.state = "gameover";
    this.input.releaseLock();
    this.hud.setScope(false);
    this.onGameOver?.({
      round: this.round,
      kills: this.stats.kills,
      headshots: this.stats.headshots,
      accuracy: this.stats.shots > 0 ? this.stats.hits / this.stats.shots : 0,
      damage: this.stats.damage,
      killer: this.lastKiller,
    });
  }

  // ---------------------------------------------------------------- main loop

  private readonly onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };

  private readonly loop = (): void => {
    requestAnimationFrame(this.loop);
    const now = performance.now();
    const rawDt = (now - this.lastFrameTime) / 1000;
    const dt = Math.min(rawDt, 0.05);
    this.lastFrameTime = now;

    if (this.state === "playing") {
      this.updateAdaptiveQuality(rawDt);
      this.updatePlaying(dt);
    } else {
      this.effects.update(dt);
    }

    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  };

  private updatePlaying(dt: number): void {
    const weapon = this.weapon;

    if (this.input.wasPressed("Escape")) {
      this.pause();
      return;
    }
    const showScoreboard = this.input.isDown("Tab");
    this.hud.setScoreboard(showScoreboard, [
      {
        name: "你",
        kills: this.stats.kills,
        headshots: this.stats.headshots,
        accuracy: this.stats.shots > 0 ? this.stats.hits / this.stats.shots : 0,
        damage: this.stats.damage,
      },
    ]);

    // ---- look ----
    const sensitivity =
      this.settings.sensitivity * (this.aiming ? weapon.spec.zoomSensitivity : 1);
    if (this.player.alive) this.player.look(this.input.mouseDX, this.input.mouseDY, sensitivity);

    // ---- movement ----
    const speedFactor = weapon.spec.moveSpeedFactor * (this.aiming ? 0.6 : 1);
    const moveState = this.player.update(dt, this.input, this.map.colliders, this.audio, {
      speedFactor,
      frozen: !this.player.alive,
    });

    // ---- weapons ----
    if (this.player.alive) this.handleWeaponInput(dt);
    else weapon.update(dt);

    // ---- camera ----
    const strafeTilt = THREE.MathUtils.clamp(
      -this.player.velocity.clone().dot(
        new THREE.Vector3(Math.cos(this.player.yaw), 0, -Math.sin(this.player.yaw)),
      ) * 0.0035,
      -0.03,
      0.03,
    );
    this.cameraTilt = THREE.MathUtils.damp(this.cameraTilt, strafeTilt, 8, dt);
    this.player.applyToCamera(this.camera, this.cameraTilt);

    const targetFov = this.aiming && weapon.spec.zoomFov ? weapon.spec.zoomFov : this.settings.fov;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 16, dt);
      this.camera.updateProjectionMatrix();
    }

    this.viewModel.update({
      dt,
      speed: moveState.speed,
      grounded: moveState.grounded,
      moving: moveState.moving,
      aiming: this.aiming,
      reloadProgress: weapon.reloading ? weapon.reloadTimer / weapon.spec.reloadTime : null,
      mouseDX: this.input.mouseDX,
      mouseDY: this.input.mouseDY,
    });
    // Hide the view model while looking through a sniper scope.
    this.viewModel.root.visible = !(this.aiming && weapon.spec.scoped);

    // ---- crosshair ----
    const spread = this.currentSpread();
    this.hud.setCrosshair(4 + spread * 4.5, 6 + spread * 1.2);

    // ---- bots ----
    this.navTimer -= dt;
    if (this.navTimer <= 0) {
      this.navGrid.update(this.player.position);
      this.navTimer = 0.3;
    }

    const botWorld: BotWorld = {
      colliders: this.map.colliders,
      coverPoints: this.map.coverPoints,
      effects: this.effects,
      audio: this.audio,
      profile: DIFFICULTIES[this.settings.difficulty],
      player: {
        alive: this.player.alive,
        position: this.player.position,
        eye: this.player.eyePosition,
        box: this.player.box,
      },
      listener: this.camera,
      showMarkers: this.settings.markers,
      navGrid: this.navGrid,
      damagePlayer: this.damagePlayer,
    };

    for (let i = this.bots.length - 1; i >= 0; i--) {
      const bot = this.bots[i];
      bot.update(dt, botWorld);
      if (bot.removeMe) {
        this.scene.remove(bot.group);
        this.bots.splice(i, 1);
      }
    }

    if (this.player.alive) {
      this.updateSpawning(dt);
    } else {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this.finishGame();
    }

    this.radar.update(
      dt,
      { position: this.player.position, yaw: this.player.yaw },
      this.bots.map((bot) => ({ position: bot.position, spotted: bot.alive && bot.spotted })),
    );

    this.effects.update(dt);
    this.hud.setHealth(this.player.health);
    this.hud.setArmor(this.player.armor);
  }
}
