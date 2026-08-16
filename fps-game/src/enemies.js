import * as THREE from "three";
import { clamp, lerp, randRange, randInt, DEG, moveWithCollisions, raySphere } from "./utils.js";

const BOT_RADIUS = 0.32;
const BOT_HEIGHT = 1.72;
const HEAD_Y = 1.58;
const HEAD_R = 0.2;
const BODY_R = 0.38;
const EYE_Y = 1.55;

const PALETTES = [
  { shirt: "#c08b52", vest: "#6e4c2c", pants: "#5f5748", head: "#a03325" },
  { shirt: "#a8ae74", vest: "#5c683e", pants: "#525244", head: "#8f2c20" },
  { shirt: "#bd7450", vest: "#644434", pants: "#585042", head: "#962e1f" },
];

/** 敌人所用武器的属性（伤害/射速/精度） */
const BOT_GUNS = {
  usp: { dmgMin: 6, dmgMax: 11, burstMin: 1, burstMax: 3, rate: 3.5, sound: "usp" },
  mp5: { dmgMin: 6, dmgMax: 12, burstMin: 3, burstMax: 5, rate: 8, sound: "mp5" },
  ak47: { dmgMin: 9, dmgMax: 16, burstMin: 2, burstMax: 5, rate: 7, sound: "ak47" },
};

function part(w, h, d, color, x, y, z) {
  // 轻微自发光：让敌人在强逆光/软件渲染下也保持可读性
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      emissive: color,
      emissiveIntensity: 0.25,
    }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function buildBotModel(palette) {
  const g = new THREE.Group();

  const legL = new THREE.Group();
  legL.position.set(-0.12, 0.82, 0);
  legL.add(part(0.15, 0.82, 0.17, palette.pants, 0, -0.41, 0));
  const legR = new THREE.Group();
  legR.position.set(0.12, 0.82, 0);
  legR.add(part(0.15, 0.82, 0.17, palette.pants, 0, -0.41, 0));

  const torso = part(0.5, 0.6, 0.28, palette.shirt, 0, 1.12, 0);
  const vest = part(0.54, 0.4, 0.32, palette.vest, 0, 1.14, 0);

  const head = part(0.26, 0.26, 0.26, palette.head, 0, HEAD_Y, 0);
  const face = part(0.2, 0.1, 0.02, "#d8a878", 0, HEAD_Y + 0.01, -0.14);

  const armL = new THREE.Group();
  armL.position.set(-0.32, 1.36, 0);
  armL.add(part(0.12, 0.55, 0.14, palette.shirt, 0, -0.26, 0));
  const armR = new THREE.Group();
  armR.position.set(0.32, 1.36, 0);
  armR.add(part(0.12, 0.55, 0.14, palette.shirt, 0, -0.26, 0));

  const gun = part(0.06, 0.09, 0.55, "#1e2126", 0, 1.3, -0.35);

  g.add(legL, legR, torso, vest, head, face, armL, armR, gun);
  return { group: g, legL, legR, armL, armR, gun, head };
}

export class EnemyManager {
  constructor(scene, world, effects, audio) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.audio = audio;
    this.bots = [];
    this.onKill = null; // (bot, isHead, weaponName)
    this.onPlayerHit = null; // (dmg, fromPos)
    this._tmp = new THREE.Vector3();
  }

  clear() {
    for (const b of this.bots) this.scene.remove(b.model.group);
    this.bots = [];
  }

  aliveCount() {
    return this.bots.filter((b) => b.state !== "dead").length;
  }

  spawnWave(count, skill, dmgScale = 1) {
    this.clear();
    this.dmgScale = dmgScale;
    const spawns = [...this.world.enemySpawns].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      const spawn = spawns[i % spawns.length];
      const palette = PALETTES[i % PALETTES.length];
      const model = buildBotModel(palette);
      const gunId = skill < 0.35 ? (i % 2 ? "usp" : "mp5") : skill < 0.6 ? (i % 2 ? "mp5" : "ak47") : "ak47";
      const bot = {
        id: i,
        model,
        pos: spawn.clone().add(new THREE.Vector3(randRange(-1.5, 1.5), 0, randRange(-1.5, 1.5))),
        vel: new THREE.Vector3(),
        yaw: Math.random() * Math.PI * 2,
        hp: 100,
        state: "patrol",
        path: [],
        pathIdx: 0,
        lastKnown: null,
        seeTimer: 0,
        loseTimer: 0,
        reactTimer: 0,
        fireTimer: randRange(0.2, 0.8),
        burstLeft: 0,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        strafeTimer: randRange(0.6, 1.8),
        walkPhase: Math.random() * 10,
        stuckTimer: 0,
        lastPos: spawn.clone(),
        skill: clamp(skill + randRange(-0.08, 0.08), 0.1, 1),
        gun: BOT_GUNS[gunId],
        deadTimer: 0,
        repathTimer: 0,
      };
      bot.model.group.position.copy(bot.pos);
      this.scene.add(bot.model.group);
      this._newPatrolPath(bot);
      this.bots.push(bot);
    }
  }

  _newPatrolPath(bot) {
    const from = this.world.nearestWaypoint(bot.pos);
    let to = this.world.randomWaypoint();
    let guard = 0;
    while ((to === from || this.world.waypoints[to].distanceTo(bot.pos) < 6) && guard++ < 10) {
      to = this.world.randomWaypoint();
    }
    bot.path = this.world.findPath(from, to);
    bot.pathIdx = 0;
  }

  _pathTo(bot, targetPos) {
    const from = this.world.nearestWaypoint(bot.pos);
    const to = this.world.nearestWaypoint(targetPos);
    bot.path = this.world.findPath(from, to);
    bot.pathIdx = 0;
  }

  /** 玩家开枪产生的噪音，附近敌人被惊动 */
  notifyGunshot(playerPos) {
    for (const bot of this.bots) {
      if (bot.state === "dead" || bot.state === "combat") continue;
      if (bot.pos.distanceTo(playerPos) < 80) {
        bot.lastKnown = playerPos.clone();
        if (bot.state === "patrol") {
          bot.state = "hunt";
          this._pathTo(bot, playerPos);
          bot.repathTimer = 1.5;
        }
      }
    }
  }

  _eyePos(bot) {
    return new THREE.Vector3(bot.pos.x, bot.pos.y + EYE_Y, bot.pos.z);
  }

  _canSee(bot, player) {
    const eye = this._eyePos(bot);
    const target = player.eyePos;
    const dist = eye.distanceTo(target);
    if (dist > 48) return false;
    const toPlayer = target.clone().sub(eye).normalize();
    if (bot.state === "patrol") {
      const fwd = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
      const flat = toPlayer.clone();
      flat.y = 0;
      flat.normalize();
      if (fwd.dot(flat) < Math.cos(62 * DEG) && dist > 7) return false;
    }
    return this.world.hasLineOfSight(eye, target);
  }

  update(dt, player, frozen) {
    this._lastPlayerPos = player.pos.clone();
    for (const bot of [...this.bots]) {
      if (bot.state === "dead") {
        this._updateDead(bot, dt);
        continue;
      }
      if (frozen) {
        this._animate(bot, dt, 0);
        continue;
      }

      const playerAlive = player.alive;
      const sees = playerAlive && this._canSee(bot, player);

      if (sees) {
        bot.lastKnown = player.pos.clone();
        bot.loseTimer = 0;
        if (bot.state !== "combat") {
          bot.state = "combat";
          bot.reactTimer = lerp(0.75, 0.18, bot.skill) + randRange(0, 0.2);
        }
      } else if (bot.state === "combat") {
        bot.loseTimer += dt;
        if (bot.loseTimer > 2.5) {
          bot.state = "hunt";
          if (bot.lastKnown) {
            this._pathTo(bot, bot.lastKnown);
            bot.repathTimer = 2;
          }
        }
      }

      let moveDir = null;
      let moveSpeed = 0;

      if (bot.state === "patrol") {
        const res = this._followPath(bot, 2.3);
        moveDir = res.dir;
        moveSpeed = res.speed;
        if (res.done) this._newPatrolPath(bot);
        this._faceMoveDir(bot, moveDir, dt);
      } else if (bot.state === "hunt") {
        const res = this._followPath(bot, 3.6);
        moveDir = res.dir;
        moveSpeed = res.speed;
        if (res.done) {
          bot.state = "patrol";
          this._newPatrolPath(bot);
        }
        this._faceMoveDir(bot, moveDir, dt);
      } else if (bot.state === "combat") {
        // 面向玩家
        const toPlayer = player.pos.clone().sub(bot.pos);
        const dist = toPlayer.length();
        const targetYaw = Math.atan2(-toPlayer.x, -toPlayer.z);
        bot.yaw = this._lerpAngle(bot.yaw, targetYaw, Math.min(1, dt * 7));

        const engageDist = lerp(9, 20, bot.skill);
        if (dist > engageDist) {
          // 距离较远：沿导航路径逼近（可绕过掩体，不会卡住）
          bot.repathTimer -= dt;
          if (bot.repathTimer <= 0 || !bot.path.length || bot.pathIdx >= bot.path.length) {
            this._pathTo(bot, player.pos);
            bot.repathTimer = 1.5;
          }
          const res = this._followPath(bot, lerp(2.4, 3.4, bot.skill));
          moveDir = res.dir;
          moveSpeed = moveDir ? lerp(2.4, 3.4, bot.skill) : 0;
        } else {
          // 近距离：横移走位（技术越高越会走位）
          bot.strafeTimer -= dt;
          if (bot.strafeTimer <= 0) {
            bot.strafeDir *= -1;
            bot.strafeTimer = randRange(0.7, 1.9);
          }
          const fwd = toPlayer.clone().setY(0).normalize();
          const side = new THREE.Vector3(-fwd.z, 0, fwd.x).multiplyScalar(bot.strafeDir);
          moveDir = side.clone();
          if (dist < 4.5) moveDir.addScaledVector(fwd, -0.9);
          moveDir.normalize();
          moveSpeed = lerp(0.6, 2.8, bot.skill);
        }
        // 低技术敌人开火瞬间会站定
        if (bot.skill < 0.5 && sees && bot.reactTimer <= 0 && bot.burstLeft > 0) moveSpeed = 0;

        // 开火
        if (sees && playerAlive) {
          if (bot.reactTimer > 0) {
            bot.reactTimer -= dt;
          } else {
            bot.fireTimer -= dt;
            if (bot.fireTimer <= 0) {
              if (bot.burstLeft <= 0) {
                bot.burstLeft = randInt(bot.gun.burstMin, bot.gun.burstMax);
              }
              this._shootAtPlayer(bot, player, dt);
              bot.burstLeft--;
              bot.fireTimer = bot.burstLeft > 0 ? 1 / bot.gun.rate : randRange(0.5, 1.1) * lerp(1.8, 0.7, bot.skill);
            }
          }
        }
      }

      // 移动与碰撞
      if (moveDir && moveSpeed > 0) {
        bot.vel.x = moveDir.x * moveSpeed;
        bot.vel.z = moveDir.z * moveSpeed;
      } else {
        bot.vel.x = 0;
        bot.vel.z = 0;
      }
      bot.vel.y -= 15 * dt;
      moveWithCollisions(bot.pos, bot.vel, dt, BOT_RADIUS, BOT_HEIGHT, this.world.colliders);

      // 卡死检测
      if (moveSpeed > 0) {
        bot.stuckTimer += dt;
        if (bot.stuckTimer > 0.8) {
          if (bot.lastPos.distanceTo(bot.pos) < 0.25) {
            if (bot.state === "combat") {
              bot.strafeDir *= -1;
            } else {
              this._newPatrolPath(bot);
            }
          }
          bot.stuckTimer = 0;
          bot.lastPos.copy(bot.pos);
        }
      }

      // 追击时定期重新寻路
      if (bot.state === "hunt" && bot.lastKnown) {
        bot.repathTimer -= dt;
        if (bot.repathTimer <= 0) {
          this._pathTo(bot, bot.lastKnown);
          bot.repathTimer = 2;
        }
      }

      this._animate(bot, dt, Math.hypot(bot.vel.x, bot.vel.z));
    }

    // 敌人间避让
    for (let i = 0; i < this.bots.length; i++) {
      const a = this.bots[i];
      if (a.state === "dead") continue;
      for (let j = i + 1; j < this.bots.length; j++) {
        const b = this.bots[j];
        if (b.state === "dead") continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 0.64 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (0.8 - d) * 0.5;
          const nx = dx / d;
          const nz = dz / d;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
        }
      }
    }
  }

  _lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  _faceMoveDir(bot, dir, dt) {
    if (!dir || (dir.x === 0 && dir.z === 0)) return;
    const targetYaw = Math.atan2(-dir.x, -dir.z);
    bot.yaw = this._lerpAngle(bot.yaw, targetYaw, Math.min(1, dt * 6));
  }

  _followPath(bot, speed) {
    if (!bot.path.length || bot.pathIdx >= bot.path.length) {
      return { dir: null, speed: 0, done: true };
    }
    const target = this.world.waypoints[bot.path[bot.pathIdx]];
    const dir = target.clone().sub(bot.pos);
    dir.y = 0;
    const dist = dir.length();
    if (dist < 0.8) {
      bot.pathIdx++;
      if (bot.pathIdx >= bot.path.length) return { dir: null, speed: 0, done: true };
      return { dir: dir.normalize(), speed, done: false };
    }
    return { dir: dir.normalize(), speed, done: false };
  }

  _shootAtPlayer(bot, player) {
    const eye = this._eyePos(bot);
    const chest = new THREE.Vector3(player.pos.x, player.pos.y + player.height * 0.62, player.pos.z);
    const dist = eye.distanceTo(chest);

    const dir = chest.sub(eye).normalize();
    // 散布：技术越高越准，玩家移动、距离都会降低命中
    let spreadDeg = lerp(5.2, 1.5, bot.skill);
    spreadDeg += clamp(player.moveSpeed2D / 6.4, 0, 1) * 2.2;
    spreadDeg += dist * 0.03;
    if (player.crouching) spreadDeg += 0.4;
    const spread = spreadDeg * DEG;
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();
    const ang = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    dir.addScaledVector(right, Math.cos(ang) * r).addScaledVector(realUp, Math.sin(ang) * r).normalize();

    // 枪口
    const fwd = new THREE.Vector3(-Math.sin(bot.yaw), 0, -Math.cos(bot.yaw));
    const muzzle = bot.pos.clone().add(new THREE.Vector3(0, 1.3, 0)).addScaledVector(fwd, 0.55);
    this.effects.worldFlash(muzzle);
    this.audio.shot(bot.gun.sound, muzzle);

    // 命中判定：先撞墙，再判玩家圆柱体
    const wallHit = this.world.raycast(eye, dir, 120);
    const wallDist = wallHit ? wallHit.dist : 120;
    const playerT = this._rayVsPlayer(eye, dir, player, wallDist);

    let endPoint;
    if (playerT !== null) {
      endPoint = eye.clone().addScaledVector(dir, playerT);
      const falloff = clamp(1 - (dist - 12) / 70, 0.5, 1);
      const dmg = Math.max(1, Math.round(randRange(bot.gun.dmgMin, bot.gun.dmgMax) * falloff * (this.dmgScale || 1)));
      player.takeDamage(dmg, bot.pos.clone());
    } else if (wallHit) {
      endPoint = wallHit.point;
      this.effects.impact(wallHit.point, wallHit.normal, "wall");
    } else {
      endPoint = eye.clone().addScaledVector(dir, 120);
    }
    this.effects.tracer(muzzle, endPoint, 0xffb36a);
  }

  /** 射线 vs 玩家（垂直圆柱近似） */
  _rayVsPlayer(origin, dir, player, maxDist) {
    const R = 0.36;
    const yMin = player.pos.y;
    const yMax = player.pos.y + player.height;
    // 在水平面上解射线与圆的交点
    const ox = origin.x - player.pos.x;
    const oz = origin.z - player.pos.z;
    const dx = dir.x;
    const dz = dir.z;
    const a = dx * dx + dz * dz;
    if (a < 1e-8) return null;
    const b = 2 * (ox * dx + oz * dz);
    const c = ox * ox + oz * oz - R * R;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t > maxDist) return null;
    const y = origin.y + dir.y * t;
    if (y < yMin || y > yMax) return null;
    return t;
  }

  /** 玩家子弹检测：返回最近命中的敌人 */
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const bot of this.bots) {
      if (bot.state === "dead") continue;
      // 头部
      const headCenter = new THREE.Vector3(bot.pos.x, bot.pos.y + HEAD_Y, bot.pos.z);
      const tHead = raySphere(origin, dir, headCenter, HEAD_R, maxDist);
      if (tHead !== null && (!best || tHead < best.dist)) {
        best = { bot, dist: tHead, point: origin.clone().addScaledVector(dir, tHead), isHead: true };
      }
      // 躯干圆柱
      const tBody = this._rayVsCylinder(origin, dir, bot.pos, BODY_R, 0.02, 1.48, maxDist);
      if (tBody !== null && (!best || tBody < best.dist)) {
        best = { bot, dist: tBody, point: origin.clone().addScaledVector(dir, tBody), isHead: false };
      }
    }
    return best;
  }

  _rayVsCylinder(origin, dir, basePos, radius, yMinOff, yMaxOff, maxDist) {
    const ox = origin.x - basePos.x;
    const oz = origin.z - basePos.z;
    const a = dir.x * dir.x + dir.z * dir.z;
    if (a < 1e-8) return null;
    const b = 2 * (ox * dir.x + oz * dir.z);
    const c = ox * ox + oz * oz - radius * radius;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return null;
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    if (t < 0 || t > maxDist) return null;
    const y = origin.y + dir.y * t;
    if (y < basePos.y + yMinOff || y > basePos.y + yMaxOff) return null;
    return t;
  }

  applyDamage(bot, dmg, isHead, weaponName) {
    if (bot.state === "dead") return;
    bot.hp -= dmg;
    // 被打后立刻知道玩家位置并追击
    if (bot.state !== "combat" && this._lastPlayerPos) {
      bot.state = "hunt";
      bot.lastKnown = this._lastPlayerPos.clone();
      this._pathTo(bot, bot.lastKnown);
      bot.repathTimer = 2;
    }
    if (bot.hp <= 0) {
      bot.state = "dead";
      bot.deadTimer = 0;
      bot.fallDir = Math.random() > 0.5 ? 1 : -1;
      if (this.onKill) this.onKill(bot, isHead, weaponName);
    }
  }

  /** 告知全部敌人玩家的确切位置（被击中时调用） */
  alertAll(playerPos) {
    for (const bot of this.bots) {
      if (bot.state === "dead") continue;
      bot.lastKnown = playerPos.clone();
      if (bot.state === "patrol") {
        bot.state = "hunt";
        this._pathTo(bot, playerPos);
        bot.repathTimer = 2;
      }
    }
  }

  _updateDead(bot, dt) {
    bot.deadTimer += dt;
    const g = bot.model.group;
    const t = Math.min(1, bot.deadTimer / 0.4);
    g.rotation.z = (bot.fallDir * t * Math.PI) / 2;
    g.position.y = bot.pos.y + Math.sin(t * Math.PI * 0.5) * 0.1 - t * 0.15;
    if (bot.deadTimer > 2.2) {
      const fade = 1 - (bot.deadTimer - 2.2) / 1.0;
      g.traverse((o) => {
        if (o.material) {
          o.material.transparent = true;
          o.material.opacity = Math.max(0, fade);
        }
      });
      if (fade <= 0) {
        this.scene.remove(g);
        this.bots.splice(this.bots.indexOf(bot), 1);
      }
    }
  }

  _animate(bot, dt, speed) {
    const g = bot.model.group;
    g.position.set(bot.pos.x, bot.pos.y, bot.pos.z);
    g.rotation.y = bot.yaw;

    const m = bot.model;
    if (speed > 0.3) {
      bot.walkPhase += dt * speed * 3.2;
      const swing = Math.sin(bot.walkPhase) * 0.55;
      m.legL.rotation.x = swing;
      m.legR.rotation.x = -swing;
      if (bot.state !== "combat") {
        m.armL.rotation.x = -swing * 0.7;
        m.armR.rotation.x = swing * 0.7;
      }
    } else {
      m.legL.rotation.x = lerp(m.legL.rotation.x, 0, dt * 8);
      m.legR.rotation.x = lerp(m.legR.rotation.x, 0, dt * 8);
    }
    if (bot.state === "combat" || bot.state === "hunt") {
      // 持枪瞄准姿势
      m.armL.rotation.x = lerp(m.armL.rotation.x, -1.2, dt * 6);
      m.armR.rotation.x = lerp(m.armR.rotation.x, -1.2, dt * 6);
      m.gun.position.z = -0.38;
      m.gun.position.y = 1.34;
    } else {
      m.gun.position.z = -0.3;
      m.gun.position.y = 1.22;
    }
  }

  radarDots() {
    return this.bots.filter((b) => b.state !== "dead").map((b) => ({ x: b.pos.x, z: b.pos.z }));
  }
}
