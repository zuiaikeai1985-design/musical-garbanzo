import type { KillEvent, ScoreRow, Team } from "./types";
import { formatClock } from "./math";
import type { Player } from "./player";
import type { Bot } from "./bots";
import type { WorldData } from "./world";
import { BUY_ORDER, WEAPONS } from "./weapons";

export class HUD {
  private hitUntil = 0;
  private toastUntil = 0;
  private bannerUntil = 0;

  constructor() {
    this.buildBuyList();
  }

  setVisible(on: boolean): void {
    el("hud").hidden = !on;
  }

  update(
    player: Player,
    bots: Bot[],
    world: WorldData,
    timeLeft: number,
    scoreT: number,
    scoreCT: number,
    dt: number,
  ): void {
    el("health-val").textContent = String(Math.max(0, Math.round(player.health)));
    el("armor-val").textContent = String(Math.max(0, Math.round(player.armor)));
    el("money-val").textContent = String(player.money);
    el("buy-money").textContent = `$${player.money}`;
    el("score-t").textContent = String(scoreT);
    el("score-ct").textContent = String(scoreCT);
    el("match-clock").textContent = formatClock(timeLeft);
    el("weapon-name").textContent = player.weapon.def.name;
    if (player.weapon.def.id === "knife") {
      el("ammo-clip").textContent = "—";
      el("ammo-reserve").textContent = "";
    } else {
      el("ammo-clip").textContent = String(player.weapon.clip);
      el("ammo-reserve").textContent = `/ ${player.weapon.reserve}`;
    }
    el("health-val").parentElement?.classList.toggle("low", player.health <= 25);

    const hint = el("hint");
    if (player.weapon.clip === 0 && player.weapon.def.id !== "knife") {
      hint.textContent = player.weapon.reserve > 0 ? "按 R 换弹" : "弹药耗尽 · 按 B 购买";
    } else if (player.weapon.reloading > 0) {
      hint.textContent = "换弹中…";
    } else {
      hint.textContent = "";
    }

    el("scope").hidden = !(player.scoped && player.weapon.def.scoped);
    this.hitUntil = Math.max(0, this.hitUntil - dt);
    el("hitmarker").classList.toggle("show", this.hitUntil > 0);
    this.toastUntil = Math.max(0, this.toastUntil - dt);
    el("pickup-toast").style.opacity = this.toastUntil > 0 ? "1" : "0";
    this.bannerUntil = Math.max(0, this.bannerUntil - dt);
    el("round-banner").hidden = this.bannerUntil <= 0;

    const vig = el("damage-vignette");
    vig.style.opacity = player.health < 100 && player.alive ? String(Math.min(0.7, (100 - player.health) / 140)) : "0";

    this.drawRadar(player, bots, world);
    this.drawScoreboard(player, bots);
    this.refreshBuyLocks(player);
  }

  hitmarker(headshot: boolean): void {
    this.hitUntil = 0.12;
    el("hitmarker").classList.toggle("head", headshot);
  }

  toast(text: string): void {
    el("pickup-toast").textContent = text;
    this.toastUntil = 1.6;
  }

  banner(text: string, color = "#e8e4d9"): void {
    const node = el("round-banner");
    node.textContent = text;
    node.style.color = color;
    node.hidden = false;
    this.bannerUntil = 2.4;
  }

  addKill(event: KillEvent): void {
    const feed = el("killfeed");
    const row = document.createElement("div");
    row.className = "kf";
    const a = document.createElement("span");
    a.className = event.attackerIsPlayer ? "me" : event.attackerTeam.toLowerCase();
    a.textContent = event.attackerIsPlayer ? "YOU" : event.attacker;
    const gun = document.createElement("span");
    gun.className = "gun";
    gun.textContent = event.headshot ? `${event.weapon} ●` : event.weapon;
    const v = document.createElement("span");
    v.className = event.victimTeam.toLowerCase();
    v.textContent = event.victim;
    row.append(a, gun, v);
    feed.append(row);
    while (feed.children.length > 6) feed.firstElementChild?.remove();
    window.setTimeout(() => row.remove(), 5000);
  }

  setBuyOpen(open: boolean): void {
    el("buy-menu").hidden = !open;
  }

  setScoreboard(open: boolean): void {
    el("scoreboard").hidden = !open;
  }

  setDeath(open: boolean, killer: string, remain: number): void {
    el("death-overlay").hidden = !open;
    if (open) {
      el("killer-name").textContent = killer;
      el("respawn-text").textContent = `${Math.ceil(remain)} 秒后复活`;
    }
  }

  setPause(open: boolean): void {
    el("pause-menu").hidden = !open;
  }

  setMenu(open: boolean): void {
    el("main-menu").hidden = !open;
  }

  private buildBuyList(): void {
    const list = el("buy-list");
    list.innerHTML = "";
    BUY_ORDER.forEach((id, i) => {
      const def = WEAPONS[id];
      const row = document.createElement("div");
      row.className = "buy-item";
      row.dataset.id = id;
      row.innerHTML = `<span class="key">${i + 1}</span><span>${def.name}</span><span class="price">$${def.price}</span>`;
      list.append(row);
    });
    const armor = document.createElement("div");
    armor.className = "buy-item";
    armor.dataset.id = "armor";
    armor.innerHTML = `<span class="key">7</span><span>凯夫拉 + 头盔</span><span class="price">$1000</span>`;
    list.append(armor);
  }

  private refreshBuyLocks(player: Player): void {
    for (const row of el("buy-list").querySelectorAll<HTMLElement>(".buy-item")) {
      const id = row.dataset.id ?? "";
      const price = id === "armor" ? 1000 : WEAPONS[id]?.price ?? 0;
      row.classList.toggle("locked", player.money < price);
    }
  }

  private drawRadar(player: Player, bots: Bot[], world: WorldData): void {
    const canvas = document.getElementById("radar") as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(10, 16, 12, 0.35)";
    ctx.fillRect(0, 0, w, h);

    const scale = 2.05;
    const map = (x: number, z: number): [number, number] => {
      const lx = x - player.pos.x;
      const lz = z - player.pos.z;
      const c = Math.cos(-player.yaw);
      const s = Math.sin(-player.yaw);
      const rx = lx * c - lz * s;
      const rz = lx * s + lz * c;
      return [w / 2 + rx * scale, h / 2 + rz * scale];
    };

    ctx.fillStyle = "rgba(70, 58, 36, 0.85)";
    for (const wall of world.radarWalls) {
      const pts = [
        map(wall.x - wall.w / 2, wall.z - wall.d / 2),
        map(wall.x + wall.w / 2, wall.z - wall.d / 2),
        map(wall.x + wall.w / 2, wall.z + wall.d / 2),
        map(wall.x - wall.w / 2, wall.z + wall.d / 2),
      ];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      ctx.fill();
    }

    const drawSite = (label: string, x: number, z: number): void => {
      const [px, pz] = map(x, z);
      ctx.fillStyle = "#e8d29a";
      ctx.font = "bold 14px Rajdhani";
      ctx.fillText(label, px - 4, pz + 4);
    };
    drawSite("A", world.sites.A.x, world.sites.A.z);
    drawSite("B", world.sites.B.x, world.sites.B.z);

    for (const bot of bots) {
      if (!bot.alive) continue;
      const [px, pz] = map(bot.pos.x, bot.pos.z);
      ctx.fillStyle = bot.team === player.team ? "#7dce6a" : "#e23b3b";
      ctx.beginPath();
      ctx.arc(px, pz, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#d7ff6a";
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2 - 7);
    ctx.lineTo(w / 2 - 5, h / 2 + 6);
    ctx.lineTo(w / 2 + 5, h / 2 + 6);
    ctx.closePath();
    ctx.fill();
  }

  private drawScoreboard(player: Player, bots: Bot[]): void {
    const rows: ScoreRow[] = [
      {
        id: "player",
        name: "YOU",
        team: player.team,
        kills: player.kills,
        deaths: player.deaths,
        isPlayer: true,
      },
      ...bots.map((b) => ({
        id: b.id,
        name: b.name,
        team: b.team,
        kills: b.kills,
        deaths: b.deaths,
        isPlayer: false,
      })),
    ];
    fillTeam("sb-t", rows.filter((r) => r.team === "T"));
    fillTeam("sb-ct", rows.filter((r) => r.team === "CT"));
  }
}

function fillTeam(id: string, rows: ScoreRow[]): void {
  const ul = el(id);
  ul.innerHTML = "";
  rows
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
    .forEach((r) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${r.isPlayer ? "YOU" : r.name}</span><span>${r.kills} / ${r.deaths}</span>`;
      ul.append(li);
    });
}

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`#${id} missing`);
  return node;
}

export function teamColor(team: Team): string {
  return team === "T" ? "#d4a017" : "#5b8def";
}
