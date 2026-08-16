import * as THREE from "three";
import { makeBox, canvasTexture, raycastBoxes, rayAABB } from "./utils.js";

/**
 * 沙漠风格竞技场（类 dust）：
 * 南侧为玩家出生点，北侧为敌人出生区，中间由一堵带三个通道的高墙分隔：
 * 左侧通道 / 中央拱门 / 右侧通道。
 */
export class World {
  constructor(scene) {
    this.scene = scene;
    this.colliders = []; // 阻挡移动与子弹的实体
    this.obstacles2D = []; // 雷达用
    this.waypoints = [];
    this.edges = [];
    this.playerSpawn = { pos: new THREE.Vector3(0, 0, 26), yaw: 0 };
    this.enemySpawns = [
      new THREE.Vector3(-30, 0, -27),
      new THREE.Vector3(30, 0, -27),
      new THREE.Vector3(0, 0, -28),
      new THREE.Vector3(-12, 0, -28),
      new THREE.Vector3(12, 0, -28),
      new THREE.Vector3(-22, 0, -24),
      new THREE.Vector3(22, 0, -24),
      new THREE.Vector3(6, 0, -25),
    ];
    this.groundBox = makeBox(0, -0.5, 0, 90, 1, 70);
    this.bounds = { minX: -43, maxX: 43, minZ: -33, maxZ: 33 };

    this._buildTextures();
    this._buildLighting();
    this._buildMap();
    this._buildWaypoints();
  }

  _buildTextures() {
    this.texFloor = canvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = "#c7a869";
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 900; i++) {
          const a = Math.random();
          ctx.fillStyle = a > 0.5 ? "rgba(90,70,40,0.12)" : "rgba(255,240,200,0.10)";
          ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 2 + Math.random() * 3);
        }
        ctx.strokeStyle = "rgba(80,60,35,0.35)";
        ctx.lineWidth = 3;
        ctx.strokeRect(1, 1, s - 2, s - 2);
      },
      22,
      18,
    );

    this.texWall = canvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = "#d8bf92";
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 500; i++) {
          ctx.fillStyle = Math.random() > 0.5 ? "rgba(120,95,60,0.10)" : "rgba(255,245,215,0.08)";
          const w = 6 + Math.random() * 20;
          ctx.fillRect(Math.random() * s, Math.random() * s, w, 3 + Math.random() * 6);
        }
        ctx.fillStyle = "rgba(110,85,55,0.25)";
        ctx.fillRect(0, s - 26, s, 26);
        ctx.fillStyle = "rgba(90,70,45,0.18)";
        ctx.fillRect(0, 0, s, 10);
      },
      3,
      1.2,
    );

    this.texStone = canvasTexture(
      256,
      (ctx, s) => {
        ctx.fillStyle = "#b59d76";
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = "rgba(70,55,35,0.5)";
        ctx.lineWidth = 3;
        const rows = 4;
        for (let r = 0; r < rows; r++) {
          const y = (r * s) / rows;
          ctx.strokeRect(0, y, s, s / rows);
          const off = r % 2 === 0 ? 0 : s / 4;
          for (let cx = off; cx < s; cx += s / 2) {
            ctx.beginPath();
            ctx.moveTo(cx, y);
            ctx.lineTo(cx, y + s / rows);
            ctx.stroke();
          }
        }
        for (let i = 0; i < 300; i++) {
          ctx.fillStyle = "rgba(60,45,25,0.10)";
          ctx.fillRect(Math.random() * s, Math.random() * s, 4, 4);
        }
      },
      2,
      1,
    );

    this.texCrate = canvasTexture(256, (ctx, s) => {
      ctx.fillStyle = "#9a6f3f";
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 ? "rgba(70,45,20,0.25)" : "rgba(190,140,80,0.22)";
        ctx.fillRect(0, (i * s) / 7, s, s / 14);
      }
      ctx.strokeStyle = "#6d4a24";
      ctx.lineWidth = 18;
      ctx.strokeRect(9, 9, s - 18, s - 18);
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(14, 14);
      ctx.lineTo(s - 14, s - 14);
      ctx.moveTo(s - 14, 14);
      ctx.lineTo(14, s - 14);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,230,180,0.15)";
      for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * s, Math.random() * s, 3, 3);
    });

    this.texMetal = (base, rust) =>
      canvasTexture(256, (ctx, s) => {
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, s, s);
        for (let x = 0; x < s; x += 24) {
          ctx.fillStyle = "rgba(0,0,0,0.22)";
          ctx.fillRect(x, 0, 5, s);
          ctx.fillStyle = "rgba(255,255,255,0.10)";
          ctx.fillRect(x + 12, 0, 4, s);
        }
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = rust;
          ctx.globalAlpha = 0.2 + Math.random() * 0.3;
          const r = 4 + Math.random() * 16;
          ctx.beginPath();
          ctx.arc(Math.random() * s, Math.random() * s, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      });

    this.texBarrel = canvasTexture(128, (ctx, s) => {
      ctx.fillStyle = "#7a2f24";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(0, s * 0.22, s, 6);
      ctx.fillRect(0, s * 0.72, s, 6);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = "rgba(40,20,10,0.25)";
        ctx.fillRect(Math.random() * s, Math.random() * s, 5, 5);
      }
    });
  }

  _buildLighting() {
    this.scene.background = new THREE.Color("#96c4e8");
    this.scene.fog = new THREE.Fog("#c8d2cf", 70, 190);

    const hemi = new THREE.HemisphereLight("#cfe5ff", "#8a7350", 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight("#fff1d0", 2.0);
    sun.position.set(45, 70, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.0005;
    this.scene.add(sun);
  }

  _mat(tex, repX = 1, repY = 1, extra = {}) {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(repX, repY);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, metalness: 0.02, ...extra });
  }

  /** 添加一个实心方块（含碰撞与雷达标记） */
  _block(cx, cy, cz, sx, sy, sz, mat, { collider = true, radar = true, shadow = true } = {}) {
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, cy, cz);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collider) this.colliders.push(makeBox(cx, cy, cz, sx, sy, sz));
    if (radar) this.obstacles2D.push({ x: cx - sx / 2, z: cz - sz / 2, w: sx, d: sz });
    return mesh;
  }

  _buildMap() {
    // 地面
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 70), this._mat(this.texFloor, 1, 1));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const wallMat = () => this._mat(this.texWall, 4, 1);
    const stoneMat = () => this._mat(this.texStone, 2, 1);
    const crateMat = () => this._mat(this.texCrate, 1, 1);
    const metalOlive = () => this._mat(this.texMetal("#5d6b4a", "#7a4a28"), 2, 1);
    const metalRed = () => this._mat(this.texMetal("#8a3a2a", "#4a2a18"), 2, 1);

    // 外围墙
    this._block(0, 3, -33.5, 90, 6, 1.4, wallMat());
    this._block(0, 3, 33.5, 90, 6, 1.4, wallMat());
    this._block(-43.5, 3, 0, 1.4, 6, 70, wallMat());
    this._block(43.5, 3, 0, 1.4, 6, 70, wallMat());

    // 中央分隔墙（z=0，留三个通道：左 [-30,-22]、中 [-6,6]、右 [24,32]）
    const midSegs = [
      [-43, -30],
      [-22, -6],
      [6, 24],
      [32, 43],
    ];
    for (const [a, b] of midSegs) {
      const cx = (a + b) / 2;
      const w = b - a;
      this._block(cx, 2.5, 0, w, 5, 2, wallMat());
    }
    // 中央拱门（石柱 + 门楣）
    this._block(-5.25, 2.5, 0, 1.5, 5, 3, stoneMat());
    this._block(5.25, 2.5, 0, 1.5, 5, 3, stoneMat());
    this._block(0, 4, 0, 12, 2, 3, stoneMat());

    // 左右通道口的石框
    this._block(-30.6, 2.5, 0, 1.2, 5, 2.6, stoneMat());
    this._block(-21.4, 2.5, 0, 1.2, 5, 2.6, stoneMat());
    this._block(24.6 - 1.2, 2.5, 0, 1.2, 5, 2.6, stoneMat());
    this._block(32.6, 2.5, 0, 1.2, 5, 2.6, stoneMat());

    // ---------- 南半场（玩家侧）掩体 ----------
    this._block(-8, 0.8, 9, 1.6, 1.6, 1.6, crateMat());
    this._block(-8, 2.4, 9, 1.6, 1.6, 1.6, crateMat());
    this._block(-6.2, 0.4, 9.6, 0.9, 0.8, 0.9, crateMat());
    this._block(8, 0.8, 9, 1.6, 1.6, 1.6, crateMat());
    this._block(20, 0.8, 8, 3.2, 1.6, 1.6, crateMat());
    this._block(0, 0.55, 18, 6, 1.1, 1.1, this._mat(this.texMetal("#6e6650", "#4d4030"), 3, 1));
    this._block(-36, 1.4, 10, 2.8, 2.8, 10, metalOlive());
    this._block(-24, 0.8, 6, 1.6, 1.6, 1.6, crateMat());
    this._block(28, 0.8, 6, 1.6, 1.6, 1.6, crateMat());
    this._block(36, 1.4, 16, 2.8, 2.8, 8, metalRed());

    // ---------- 北半场（敌人侧）掩体 ----------
    this._block(-8, 0.8, -9, 1.6, 1.6, 1.6, crateMat());
    this._block(8, 0.8, -9, 1.6, 1.6, 1.6, crateMat());
    this._block(8, 2.4, -9, 1.6, 1.6, 1.6, crateMat());
    this._block(-20, 0.8, -8, 3.2, 1.6, 1.6, crateMat());
    this._block(0, 0.55, -18, 6, 1.1, 1.1, this._mat(this.texMetal("#6e6650", "#4d4030"), 3, 1));
    this._block(36, 1.4, -10, 2.8, 2.8, 10, metalOlive());
    this._block(-28, 0.8, -5, 1.6, 1.6, 1.6, crateMat());
    this._block(24, 0.8, -5, 1.6, 1.6, 1.6, crateMat());
    this._block(-36, 1.4, -16, 2.8, 2.8, 8, metalRed());

    // 油桶（圆柱外观 + 方形碰撞）
    const barrelSpots = [
      [-14, 2.8],
      [14.5, -2.8],
      [33, 4],
      [-33, -4],
      [-2, 24],
      [2, -24],
    ];
    for (const [bx, bz] of barrelSpots) {
      const geo = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 14);
      const mesh = new THREE.Mesh(geo, this._mat(this.texBarrel, 2, 1));
      mesh.position.set(bx, 0.6, bz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.colliders.push(makeBox(bx, 0.6, bz, 0.9, 1.2, 0.9));
      this.obstacles2D.push({ x: bx - 0.45, z: bz - 0.45, w: 0.9, d: 0.9 });
    }

    // 遮阳棚装饰（不参与碰撞）
    const awning = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.25, 3),
      new THREE.MeshStandardMaterial({ color: "#8a4a30", roughness: 0.9 }),
    );
    awning.position.set(-36, 3.4, 10);
    awning.castShadow = true;
    this.scene.add(awning);
    const awning2 = awning.clone();
    awning2.position.set(36, 3.4, -10);
    this.scene.add(awning2);
  }

  _buildWaypoints() {
    const pts = [
      [0, 26], // 0 玩家出生点
      [-14, 22], // 1
      [14, 22], // 2
      [-26, 14], // 3
      [26, 14], // 4
      [0, 12], // 5
      [-13, 6], // 6
      [13, 6], // 7
      [-26, 0], // 8 左通道
      [0, 0], // 9 中央拱门
      [28, 0], // 10 右通道
      [-13, -6], // 11
      [13, -6], // 12
      [0, -12], // 13
      [-26, -14], // 14
      [26, -14], // 15
      [-14, -22], // 16
      [14, -22], // 17
      [0, -26], // 18 敌人出生区
      [-30, -24], // 19
      [30, -24], // 20
      [-30, 22], // 21
      [30, 22], // 22
    ];
    this.waypoints = pts.map(([x, z]) => new THREE.Vector3(x, 0, z));
    const n = this.waypoints.length;
    this.edges = Array.from({ length: n }, () => []);

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = this.waypoints[i];
        const b = this.waypoints[j];
        const dist = a.distanceTo(b);
        if (dist > 17) continue;
        if (this._walkClear(a, b)) {
          this.edges[i].push(j);
          this.edges[j].push(i);
        }
      }
    }

    // 连通性自检
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const cur = stack.pop();
      for (const nb of this.edges[cur]) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    if (seen.size !== n) {
      console.warn(`[World] 导航图不连通：${seen.size}/${n}`, [...Array(n).keys()].filter((i) => !seen.has(i)));
    }
  }

  /** 两点间是否可以直线行走（考虑身位宽度与低矮障碍） */
  _walkClear(a, b) {
    const dir = b.clone().sub(a);
    const dist = dir.length();
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(0.5);
    for (const h of [0.35, 1.2]) {
      for (const off of [-1, 0, 1]) {
        const o = a.clone().addScaledVector(side, off);
        o.y = h;
        for (const c of this.colliders) {
          if (rayAABB(o, dir, c, dist)) return false;
        }
      }
    }
    return true;
  }

  /** 子弹/视线射线检测（含地面） */
  raycast(origin, dir, maxDist) {
    const hitWalls = raycastBoxes(origin, dir, this.colliders, maxDist);
    const hitGround = rayAABB(origin, dir, this.groundBox, maxDist);
    if (hitGround && (!hitWalls || hitGround.t < hitWalls.dist)) {
      const point = origin.clone().addScaledVector(dir, hitGround.t);
      return { dist: hitGround.t, point, normal: hitGround.normal };
    }
    return hitWalls;
  }

  /** 两点之间是否有视线（不含地面遮挡判断） */
  hasLineOfSight(a, b) {
    const dir = b.clone().sub(a);
    const dist = dir.length();
    if (dist < 0.001) return true;
    dir.normalize();
    for (const c of this.colliders) {
      if (rayAABB(a, dir, c, dist)) return false;
    }
    return true;
  }

  nearestWaypoint(pos) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.waypoints.length; i++) {
      const d = this.waypoints[i].distanceToSquared(pos);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** BFS 寻路，返回途经的 waypoint 索引数组 */
  findPath(fromIdx, toIdx) {
    if (fromIdx === toIdx) return [toIdx];
    const prev = new Array(this.waypoints.length).fill(-1);
    const queue = [fromIdx];
    prev[fromIdx] = fromIdx;
    while (queue.length) {
      const cur = queue.shift();
      for (const nb of this.edges[cur]) {
        if (prev[nb] === -1) {
          prev[nb] = cur;
          if (nb === toIdx) {
            const path = [toIdx];
            let p = toIdx;
            while (p !== fromIdx) {
              p = prev[p];
              path.unshift(p);
            }
            return path;
          }
          queue.push(nb);
        }
      }
    }
    return [fromIdx];
  }

  randomWaypoint() {
    return Math.floor(Math.random() * this.waypoints.length);
  }
}
