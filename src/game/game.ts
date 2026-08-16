import * as THREE from "three";
import { GameAudio } from "./audio";
import { createBots, type Bot } from "./bots";
import { damageActor, traceShot } from "./combat";
import { Effects } from "./fx";
import { HUD, teamColor } from "./hud";
import { Input } from "./input";
import { Player } from "./player";
import type { HitZone, KillEvent, Team } from "./types";
import { Viewmodel } from "./viewmodel";
import { beginReload, canFire, consumeShot, WEAPONS } from "./weapons";
import { buildWorld, type WorldData } from "./world";

const MATCH_TIME = 600;
const WIN_KILLS = 20;
const RESPAWN = 3.2;

type Mode = "menu" | "play" | "pause" | "over";

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly input = new Input();
  private readonly audio = new GameAudio();
  private readonly hud = new HUD();
  private readonly clock = new THREE.Clock();
  private world!: WorldData;
  private player: Player | null = null;
  private viewmodel: Viewmodel | null = null;
  private bots: Bot[] = [];
  private fx!: Effects;
  private mode: Mode = "menu";
  private buyOpen = false;
  private timeLeft = MATCH_TIME;
  private incomeT = 0;
  private respawnT = 0;
  private killer = "";
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(78, window.innerWidth / window.innerHeight, 0.08, 160);
    this.input.attach(canvas);
    this.fx = new Effects(this.scene);
    this.scene.add(this.camera);
    this.world = buildWorld(this.scene);
    window.addEventListener("resize", this.onResize);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.bindUi(canvas);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(this.tick);
  }

  private bindUi(canvas: HTMLCanvasElement): void {
    document.getElementById("join-t")?.addEventListener("click", () => this.begin("T"));
    document.getElementById("join-ct")?.addEventListener("click", () => this.begin("CT"));
    document.getElementById("btn-resume")?.addEventListener("click", () => this.resume(canvas));
    document.getElementById("btn-quit")?.addEventListener("click", () => this.quitToMenu());
    const slider = document.getElementById("sens-slider") as HTMLInputElement | null;
    slider?.addEventListener("input", () => {
      const v = Number(slider.value);
      if (this.player) this.player.sensitivity = v;
      const label = document.getElementById("sens-val");
      if (label) label.textContent = v.toFixed(1);
    });
    canvas.addEventListener("click", () => {
      if (this.mode === "play" && !this.buyOpen && this.player?.alive) {
        void canvas.requestPointerLock();
      }
    });
    document.addEventListener("pointerlockchange", () => {
      if (!document.pointerLockElement && this.mode === "play" && !this.buyOpen && this.player?.alive) {
        this.pause();
      }
    });
  }

  private begin(team: Team): void {
    this.audio.unlock();
    this.clearBots();
    this.player = new Player(team, this.camera);
    this.viewmodel = new Viewmodel(this.camera);
    this.bots = createBots(team, this.scene);
    this.timeLeft = MATCH_TIME;
    this.incomeT = 0;
    this.buyOpen = false;
    this.mode = "play";
    this.hud.setMenu(false);
    this.hud.setVisible(true);
    this.hud.setPause(false);
    this.hud.setDeath(false, "", 0);
    this.placeAll();
    this.hud.banner(team === "T" ? "恐怖分子 出击" : "反恐精英 出击", teamColor(team));
    const canvas = this.renderer.domElement;
    void canvas.requestPointerLock();
  }

  private placeAll(): void {
    if (!this.player) return;
    const yaw = this.player.team === "T" ? 0 : Math.PI;
    const spawn = this.world.spawns[this.player.team][0];
    this.player.spawnAt(spawn.x, spawn.z, yaw);
    let ti = 1;
    let cti = this.player.team === "CT" ? 1 : 0;
    for (const bot of this.bots) {
      const list = this.world.spawns[bot.team];
      const idx = bot.team === "T" ? ti++ : cti++;
      const s = list[idx % list.length];
      bot.spawnAt(s.x + (Math.random() - 0.5), s.z + (Math.random() - 0.5), bot.team === "T" ? 0 : Math.PI);
    }
  }

  private tick = (): void => {
    const dt = Math.min(0.033, this.clock.getDelta());
    if (this.mode === "play" && this.player) this.updatePlay(dt);
    this.fx.update(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlay(dt: number): void {
    const player = this.player;
    if (!player) return;

    if (this.input.consumeKey("Escape")) {
      if (this.buyOpen) this.toggleBuy(false);
      else this.pause();
      return;
    }
    if (this.input.consumeKey("KeyB")) this.toggleBuy(!this.buyOpen);
    this.hud.setScoreboard(this.input.keys.has("Tab"));

    if (this.buyOpen) {
      this.handleBuyKeys();
      this.hud.update(player, this.bots, this.world, this.timeLeft, this.teamKills("T"), this.teamKills("CT"), dt);
      this.input.endFrame();
      return;
    }

    this.timeLeft -= dt;
    this.incomeT += dt;
    if (this.incomeT >= 45) {
      this.incomeT = 0;
      player.money += 1400;
      this.hud.toast("+$1400 生存津贴");
    }

    if (player.alive) {
      const { footstep, reloaded } = player.update(dt, this.input, this.world.colliders);
      if (footstep) this.audio.footstep(player.walking);
      if (reloaded) this.audio.reload();
      this.viewmodel?.update(player, dt);
      this.handleFire(player);
    } else {
      this.respawnT -= dt;
      this.hud.setDeath(true, this.killer, this.respawnT);
      if (this.respawnT <= 0) this.respawnPlayer();
    }

    this.updateBots(dt);
    this.hud.update(player, this.bots, this.world, this.timeLeft, this.teamKills("T"), this.teamKills("CT"), dt);

    if (this.teamKills("T") >= WIN_KILLS || this.teamKills("CT") >= WIN_KILLS || this.timeLeft <= 0) {
      this.endMatch();
    }
    this.input.endFrame();
  }

  private handleFire(player: Player): void {
    if (this.input.rightPressed && player.weapon.def.scoped) {
      player.scoped = !player.scoped;
    }
    const wants =
      player.weapon.def.automatic ? this.input.leftHeld : this.input.leftPressed;
    if (!wants) return;
    if (player.weapon.clip <= 0 && player.weapon.def.id !== "knife") {
      if (player.weapon.reserve > 0) beginReload(player.weapon);
      return;
    }
    if (!canFire(player.weapon)) return;
    if (!consumeShot(player.weapon)) return;

    this.audio.shoot(player.weapon.def.id);
    this.viewmodel?.muzzle();
    player.applyRecoil();

    const origin = { x: player.camera.position.x, y: player.camera.position.y, z: player.camera.position.z };
    const maxDist = player.weapon.def.id === "knife" ? 2.1 : 120;
    const pellets = player.weapon.def.pellets;
    for (let i = 0; i < pellets; i++) {
      const dir = player.aimDirection();
      const hit = traceShot(origin, dir, this.bots, player, this.world.colliders, true);
      const end = hit.target?.point ??
        hit.world?.point ?? {
          x: origin.x + dir.x * maxDist,
          y: origin.y + dir.y * maxDist,
          z: origin.z + dir.z * maxDist,
        };
      if (player.weapon.def.id !== "knife") this.fx.tracer(origin, end);
      if (hit.target?.kind === "bot" && hit.target.bot && hit.target.distance <= maxDist) {
        this.hurtBot(hit.target.bot, player, hit.target.zone, hit.target.point);
      } else if (hit.world && hit.world.distance <= maxDist) {
        this.fx.impact(hit.world.point);
      }
    }
  }

  private hurtBot(bot: Bot, attacker: Player, zone: HitZone, point: { x: number; y: number; z: number }): void {
    if (bot.team === attacker.team) return;
    const dmg = damageActor(
      bot.health,
      bot.armor,
      bot.hasHelmet,
      attacker.weapon.def.damage,
      attacker.weapon.def.armorPen,
      zone,
    );
    bot.health = dmg.health;
    bot.armor = dmg.armor;
    this.fx.blood(point);
    this.hud.hitmarker(zone === "head");
    this.audio.hit(zone === "head");
    if (dmg.killed) {
      this.killBot(bot, attacker.name, attacker.weapon.def.name, zone === "head", true, attacker.team);
      attacker.kills += 1;
      attacker.money += 300;
    }
  }

  private updateBots(dt: number): void {
    const player = this.player;
    if (!player) return;
    for (const bot of this.bots) {
      if (!bot.alive && bot.respawnT <= 0) {
        this.respawnBot(bot);
      }
      const target = this.closestEnemy(bot);
      const allies = this.bots.filter((b) => b !== bot && b.alive).map((b) => ({ x: b.pos.x, z: b.pos.z }));
      if (player.alive) allies.push({ x: player.pos.x, z: player.pos.z });
      const { shot, dir } = bot.update(dt, this.world, target, allies, this.world.colliders);
      if (shot && dir) {
        this.audio.shoot(bot.weapon.def.id);
        const origin = bot.eye;
        const hit = traceShot(origin, dir, this.bots, player, this.world.colliders, false, bot.id);
        const end = hit.target?.point ??
          hit.world?.point ?? {
            x: origin.x + dir.x * 80,
            y: origin.y + dir.y * 80,
            z: origin.z + dir.z * 80,
          };
        this.fx.tracer(origin, end);
        if (hit.target?.kind === "player" && player.alive && player.spawnProtect <= 0) {
          const dmg = damageActor(
            player.health,
            player.armor,
            player.hasHelmet,
            bot.weapon.def.damage,
            bot.weapon.def.armorPen,
            hit.target.zone,
          );
          player.health = dmg.health;
          player.armor = dmg.armor;
          this.audio.hurt();
          if (dmg.killed) this.killPlayer(bot);
        } else if (hit.target?.kind === "bot" && hit.target.bot && hit.target.bot.team !== bot.team) {
          const victim = hit.target.bot;
          const dmg = damageActor(
            victim.health,
            victim.armor,
            victim.hasHelmet,
            bot.weapon.def.damage,
            bot.weapon.def.armorPen,
            hit.target.zone,
          );
          victim.health = dmg.health;
          victim.armor = dmg.armor;
          this.fx.blood(hit.target.point);
          if (dmg.killed) {
            this.killBot(victim, bot.name, bot.weapon.def.name, hit.target.zone === "head", false, bot.team);
            bot.kills += 1;
          }
        } else if (hit.world) {
          this.fx.impact(hit.world.point);
        }
      }
    }
  }

  private closestEnemy(bot: Bot): { x: number; y: number; z: number; alive: boolean; team: Team } {
    const player = this.player;
    let best = {
      x: bot.pos.x,
      y: 0,
      z: bot.pos.z,
      alive: false,
      team: bot.team,
    };
    let bestD = Infinity;
    if (player && player.team !== bot.team) {
      const d = (player.pos.x - bot.pos.x) ** 2 + (player.pos.z - bot.pos.z) ** 2;
      best = { x: player.pos.x, y: player.pos.y, z: player.pos.z, alive: player.alive, team: player.team };
      bestD = d;
    }
    for (const other of this.bots) {
      if (other === bot || other.team === bot.team || !other.alive) continue;
      const d = (other.pos.x - bot.pos.x) ** 2 + (other.pos.z - bot.pos.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x: other.pos.x, y: other.pos.y, z: other.pos.z, alive: true, team: other.team };
      }
    }
    return best;
  }

  private killBot(
    bot: Bot,
    attacker: string,
    weapon: string,
    headshot: boolean,
    attackerIsPlayer: boolean,
    attackerTeam: Team,
  ): void {
    bot.alive = false;
    bot.deaths += 1;
    bot.respawnT = RESPAWN;
    bot.health = 0;
    this.audio.death();
    const event: KillEvent = {
      attacker,
      victim: bot.name,
      weapon,
      headshot,
      attackerTeam,
      victimTeam: bot.team,
      attackerIsPlayer,
    };
    this.hud.addKill(event);
  }

  private killPlayer(bot: Bot): void {
    const player = this.player;
    if (!player) return;
    player.alive = false;
    player.health = 0;
    player.deaths += 1;
    player.scoped = false;
    this.respawnT = RESPAWN;
    this.killer = bot.name;
    bot.kills += 1;
    this.audio.death();
    this.hud.addKill({
      attacker: bot.name,
      victim: "YOU",
      weapon: bot.weapon.def.name,
      headshot: false,
      attackerTeam: bot.team,
      victimTeam: player.team,
      attackerIsPlayer: false,
    });
    document.exitPointerLock();
  }

  private respawnPlayer(): void {
    const player = this.player;
    if (!player) return;
    const list = this.world.spawns[player.team];
    const s = list[Math.floor(Math.random() * list.length)];
    player.spawnAt(s.x, s.z, player.team === "T" ? 0 : Math.PI);
    this.hud.setDeath(false, "", 0);
    void this.renderer.domElement.requestPointerLock();
  }

  private respawnBot(bot: Bot): void {
    const list = this.world.spawns[bot.team];
    const s = list[Math.floor(Math.random() * list.length)];
    bot.spawnAt(s.x, s.z, bot.team === "T" ? 0 : Math.PI);
  }

  private handleBuyKeys(): void {
    const player = this.player;
    if (!player) return;
    const map: Record<string, string | "armor"> = {
      Digit1: "ak47",
      Digit2: "m4a4",
      Digit3: "awp",
      Digit4: "deagle",
      Digit5: "usp",
      Digit6: "glock",
      Digit7: "armor",
    };
    for (const [code, id] of Object.entries(map)) {
      if (!this.input.consumeKey(code)) continue;
      if (id === "armor") {
        if (player.buyArmor()) {
          this.audio.buy();
          this.hud.toast("已购买 护甲 + 头盔");
        }
      } else {
        const def = WEAPONS[id];
        if (player.buy(id, def.price)) {
          this.audio.buy();
          this.hud.toast(`已购买 ${def.name}`);
        }
      }
    }
  }

  private toggleBuy(open: boolean): void {
    this.buyOpen = open;
    this.hud.setBuyOpen(open);
    if (open) document.exitPointerLock();
    else void this.renderer.domElement.requestPointerLock();
  }

  private pause(): void {
    if (this.mode !== "play") return;
    this.mode = "pause";
    this.buyOpen = false;
    this.hud.setBuyOpen(false);
    this.hud.setPause(true);
    document.exitPointerLock();
  }

  private resume(canvas: HTMLCanvasElement): void {
    if (this.mode !== "pause") return;
    this.mode = "play";
    this.hud.setPause(false);
    void canvas.requestPointerLock();
  }

  private quitToMenu(): void {
    this.mode = "menu";
    this.clearBots();
    this.player = null;
    this.viewmodel = null;
    this.hud.setPause(false);
    this.hud.setVisible(false);
    this.hud.setDeath(false, "", 0);
    this.hud.setMenu(true);
    document.exitPointerLock();
  }

  private endMatch(): void {
    const t = this.teamKills("T");
    const ct = this.teamKills("CT");
    const player = this.player;
    const won = player ? (player.team === "T" ? t >= ct : ct >= t) : false;
    this.hud.banner(won ? "胜利" : "失败", won ? "#7dce6a" : "#e23b3b");
    this.audio.win();
    this.mode = "over";
    window.setTimeout(() => this.quitToMenu(), 3200);
  }

  private teamKills(team: Team): number {
    let n = this.player?.team === team ? this.player.kills : 0;
    for (const b of this.bots) if (b.team === team) n += b.kills;
    return n;
  }

  private clearBots(): void {
    for (const bot of this.bots) this.scene.remove(bot.mesh);
    this.bots = [];
    if (this.viewmodel) {
      this.camera.remove(this.viewmodel.group);
    }
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
