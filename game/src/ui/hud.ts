import type { WeaponId } from "../player/weapons";

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing element #${id}`);
  return found as T;
}

export interface ScoreRow {
  name: string;
  kills: number;
  headshots: number;
  accuracy: number;
  damage: number;
}

export class Hud {
  private readonly root = el("hud");
  private readonly healthValue = el("health-value");
  private readonly healthStat = document.querySelector<HTMLElement>(".stat.health")!;
  private readonly armorValue = el("armor-value");
  private readonly ammoMag = el("ammo-mag");
  private readonly ammoReserve = el("ammo-reserve");
  private readonly ammoBlock = document.querySelector<HTMLElement>(".ammo")!;
  private readonly weaponName = el("weapon-name");
  private readonly weaponList = el("weapon-list");
  private readonly reloadHint = el("reload-hint");
  private readonly crosshair = el("crosshair");
  private readonly hitmarkerEl = el("hitmarker");
  private readonly killfeed = el("killfeed");
  private readonly roundValue = el("round-value");
  private readonly enemiesValue = el("enemies-value");
  private readonly killsValue = el("kills-value");
  private readonly banner = el("center-banner");
  private readonly damageFlashEl = el("damage-flash");
  private readonly hitDirLayer = el("hit-direction-layer");
  private readonly scopeEl = el("scope");
  private readonly scoreboardEl = el("scoreboard");
  private readonly scoreboardBody = el("scoreboard-body");
  private readonly moneyPopup = el("money-popup");

  private hitmarkerTimer = 0;
  private bannerTimer = 0;
  private flashTimer = 0;
  private popupTimer = 0;

  setVisible(visible: boolean): void {
    this.root.classList.toggle("hidden", !visible);
  }

  setHealth(value: number): void {
    const rounded = Math.max(0, Math.ceil(value));
    this.healthValue.textContent = String(rounded);
    this.healthStat.classList.toggle("low", rounded <= 30);
  }

  setArmor(value: number): void {
    this.armorValue.textContent = String(Math.max(0, Math.ceil(value)));
  }

  setAmmo(mag: number, reserve: number, melee: boolean): void {
    if (melee) {
      this.ammoMag.textContent = "∞";
      this.ammoReserve.textContent = "";
      this.ammoBlock.classList.remove("empty");
      return;
    }
    this.ammoMag.textContent = String(mag);
    this.ammoReserve.textContent = String(reserve);
    this.ammoBlock.classList.toggle("empty", mag === 0);
  }

  setReloadHint(show: boolean): void {
    this.reloadHint.classList.toggle("hidden", !show);
  }

  setWeaponName(name: string): void {
    this.weaponName.textContent = name;
  }

  buildWeaponList(entries: Array<{ id: WeaponId; name: string; key: string }>): void {
    this.weaponList.innerHTML = "";
    for (const entry of entries) {
      const div = document.createElement("div");
      div.className = "weapon-slot";
      div.dataset.weapon = entry.id;
      div.innerHTML = `<span class="key">${entry.key}</span>${entry.name}`;
      this.weaponList.appendChild(div);
    }
  }

  setActiveWeapon(id: WeaponId): void {
    for (const child of Array.from(this.weaponList.children)) {
      child.classList.toggle("active", (child as HTMLElement).dataset.weapon === id);
    }
  }

  setCrosshair(gapPx: number, lengthPx: number): void {
    this.crosshair.style.setProperty("--gap", `${gapPx.toFixed(1)}px`);
    this.crosshair.style.setProperty("--len", `${lengthPx.toFixed(1)}px`);
  }

  showHitmarker(kill: boolean): void {
    this.hitmarkerEl.classList.toggle("kill", kill);
    this.hitmarkerEl.style.opacity = "1";
    this.hitmarkerTimer = kill ? 0.35 : 0.16;
  }

  addKill(killer: string, victim: string, weapon: string, headshot: boolean): void {
    const entry = document.createElement("div");
    entry.className = `kill-entry${headshot ? " headshot" : ""}`;
    entry.innerHTML = `<span class="killer">${killer}</span><span class="weapon">${weapon}</span><span class="victim">${victim}</span>`;
    this.killfeed.appendChild(entry);
    window.setTimeout(() => entry.remove(), 5200);
    while (this.killfeed.children.length > 5) this.killfeed.firstElementChild?.remove();
  }

  setRound(round: number): void {
    this.roundValue.textContent = String(round);
  }

  setEnemies(count: number): void {
    this.enemiesValue.textContent = String(count);
  }

  setKills(count: number): void {
    this.killsValue.textContent = String(count);
  }

  showBanner(title: string, sub = "", duration = 2.2): void {
    this.banner.innerHTML = `${title}${sub ? `<span class="sub">${sub}</span>` : ""}`;
    this.banner.style.opacity = "1";
    this.bannerTimer = duration;
  }

  hideBanner(): void {
    this.banner.style.opacity = "0";
    this.bannerTimer = 0;
  }

  showPopup(text: string): void {
    this.moneyPopup.textContent = text;
    this.moneyPopup.style.opacity = "1";
    this.popupTimer = 1.4;
  }

  flashDamage(intensity: number): void {
    this.damageFlashEl.style.opacity = String(Math.min(0.95, intensity));
    this.flashTimer = 0.35;
  }

  showHitDirection(angleRad: number): void {
    const arrow = document.createElement("div");
    arrow.className = "hit-arrow";
    arrow.style.transform = `rotate(${angleRad}rad)`;
    this.hitDirLayer.appendChild(arrow);
    window.setTimeout(() => arrow.remove(), 900);
  }

  setScope(visible: boolean): void {
    this.scopeEl.classList.toggle("hidden", !visible);
    this.crosshair.style.visibility = visible ? "hidden" : "visible";
  }

  setScoreboard(visible: boolean, rows?: ScoreRow[]): void {
    this.scoreboardEl.classList.toggle("hidden", !visible);
    if (visible && rows) {
      this.scoreboardBody.innerHTML = rows
        .map(
          (row) =>
            `<tr><td>${row.name}</td><td>${row.kills}</td><td>${row.headshots}</td><td>${(row.accuracy * 100).toFixed(0)}%</td><td>${Math.round(row.damage)}</td></tr>`,
        )
        .join("");
    }
  }

  update(dt: number): void {
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0) this.hitmarkerEl.style.opacity = "0";
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.style.opacity = "0";
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.damageFlashEl.style.opacity = "0";
    }
    if (this.popupTimer > 0) {
      this.popupTimer -= dt;
      if (this.popupTimer <= 0) this.moneyPopup.style.opacity = "0";
    }
  }
}
