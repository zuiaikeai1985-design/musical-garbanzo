/**
 * HUD 与全部 DOM 界面：准星、血量/护甲、弹药、金钱、雷达、
 * 击杀信息、购买菜单、横幅提示、开镜遮罩、受击红屏。
 */
export class HUD {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.crosshair = this.$("crosshair");
    this.hitmarkerEl = this.$("hitmarker");
    this.vignette = this.$("damage-vignette");
    this.radarCanvas = this.$("radar");
    this.radarCtx = this.radarCanvas.getContext("2d");

    this.vignetteAlpha = 0;
    this.hitTimer = 0;
    this.hintTimer = 0;
    this.bannerTimer = 0;
  }

  setHealth(hp) {
    this.$("hp-num").textContent = Math.max(0, Math.round(hp));
    this.$("hp-fill").style.width = `${Math.max(0, hp)}%`;
    this.$("hp-fill").style.background = hp > 50 ? "#67e26b" : hp > 25 ? "#e2c94f" : "#e25549";
  }

  setArmor(armor) {
    this.$("armor-num").textContent = Math.max(0, Math.round(armor));
    this.$("armor-fill").style.width = `${Math.max(0, armor)}%`;
  }

  setMoney(money) {
    this.$("money").textContent = `$ ${money}`;
  }

  setAmmo(info) {
    this.$("weapon-name").textContent = info.name;
    this.$("ammo-mag").textContent = info.mag;
    this.$("ammo-reserve").textContent = info.reserve === "" ? "" : `/ ${info.reserve}`;
  }

  setScore(ct, t) {
    this.$("score-ct").textContent = ct;
    this.$("score-t").textContent = t;
  }

  setRound(n) {
    this.$("round-num").textContent = `第 ${n} 回合`;
  }

  setTimer(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const el = this.$("round-timer");
    el.textContent = `${m}:${String(s % 60).padStart(2, "0")}`;
    el.classList.toggle("low", s <= 20);
  }

  setEnemiesLeft(n) {
    this.$("enemies-left").textContent = `存活敌人 ${n}`;
  }

  killfeed(text, isHead) {
    const feed = this.$("killfeed");
    const div = document.createElement("div");
    div.className = "kf-item";
    div.innerHTML = isHead ? `${text} <span class="hs">爆头!</span>` : text;
    feed.prepend(div);
    setTimeout(() => div.classList.add("fade"), 3200);
    setTimeout(() => div.remove(), 4000);
    while (feed.children.length > 5) feed.lastChild.remove();
  }

  hitmarker(isHead) {
    this.hitTimer = 0.14;
    this.hitmarkerEl.classList.toggle("head", isHead);
    this.hitmarkerEl.classList.add("show");
  }

  damageFlash() {
    this.vignetteAlpha = Math.min(1, this.vignetteAlpha + 0.55);
  }

  banner(title, sub = "", duration = 2.5, tone = "") {
    this.$("banner-title").textContent = title;
    this.$("banner-sub").textContent = sub;
    const b = this.$("banner");
    b.className = `show ${tone}`;
    this.bannerTimer = duration;
  }

  hint(text, duration = 3) {
    this.$("hint").textContent = text;
    this.$("hint").classList.add("show");
    this.hintTimer = duration;
  }

  setCrosshair(spreadPx, visible) {
    this.crosshair.style.display = visible ? "" : "none";
    this.crosshair.style.setProperty("--gap", `${Math.round(spreadPx)}px`);
  }

  scope(visible) {
    this.$("scope").classList.toggle("show", visible);
  }

  showOverlay(id, visible) {
    this.$(id).classList.toggle("hidden", !visible);
  }

  /** 购买菜单渲染 */
  renderBuyMenu(items, money, ownedPrimary, armor) {
    const list = this.$("buy-list");
    list.innerHTML = "";
    for (const item of items) {
      const div = document.createElement("div");
      const afford = money >= item.price;
      const owned =
        (item.kind === "weapon" && ownedPrimary === item.id) || (item.kind === "armor" && armor >= 100);
      div.className = `buy-item${afford ? "" : " poor"}${owned ? " owned" : ""}`;
      div.innerHTML = `<span class="key">${item.key}</span><span class="bname">${item.label}</span><span class="price">$${item.price}</span>`;
      div.dataset.key = item.key;
      list.appendChild(div);
    }
    this.$("buy-money").textContent = `资金 $ ${money}`;
  }

  buyMenuVisible(v) {
    this.showOverlay("buymenu", v);
  }

  isBuyMenuOpen() {
    return !this.$("buymenu").classList.contains("hidden");
  }

  update(dt) {
    // 受击红屏衰减
    this.vignetteAlpha = Math.max(0, this.vignetteAlpha - dt * 1.4);
    this.vignette.style.opacity = this.vignetteAlpha.toFixed(3);

    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.hitmarkerEl.classList.remove("show");
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.$("hint").classList.remove("show");
    }
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.$("banner").className = "";
    }
  }

  drawRadar(world, playerPos, playerYaw, dots) {
    const ctx = this.radarCtx;
    const W = this.radarCanvas.width;
    const H = this.radarCanvas.height;
    ctx.clearRect(0, 0, W, H);

    const b = world.bounds;
    const scale = Math.min((W - 12) / (b.maxX - b.minX), (H - 12) / (b.maxZ - b.minZ));
    const toX = (x) => (x - (b.minX + b.maxX) / 2) * scale + W / 2;
    const toY = (z) => (z - (b.minZ + b.maxZ) / 2) * scale + H / 2;

    // 背景
    ctx.fillStyle = "rgba(10,16,12,0.72)";
    ctx.fillRect(0, 0, W, H);

    // 障碍物
    ctx.fillStyle = "rgba(180,200,170,0.4)";
    for (const o of world.obstacles2D) {
      ctx.fillRect(toX(o.x), toY(o.z), Math.max(2, o.w * scale), Math.max(2, o.d * scale));
    }

    // 敌人
    ctx.fillStyle = "#ff5140";
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(toX(d.x), toY(d.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玩家箭头
    ctx.save();
    ctx.translate(toX(playerPos.x), toY(playerPos.z));
    ctx.rotate(-playerYaw);
    ctx.fillStyle = "#57d8ff";
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 边框
    ctx.strokeStyle = "rgba(200,220,200,0.35)";
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }
}
