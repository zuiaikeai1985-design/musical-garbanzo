import * as THREE from "three";
import { brushedSteel, mat, muzzleFlashTex, polymerTex, woodGrainGun } from "./look";
import type { Player } from "./player";
import type { Team } from "./types";

type GunId = "ak47" | "m4a4" | "awp" | "deagle" | "usp" | "glock" | "knife";

export class Viewmodel {
  readonly group = new THREE.Group();
  private readonly guns = new Map<GunId, THREE.Group>();
  private readonly flash: THREE.PointLight;
  private readonly flashSprites: THREE.Mesh[] = [];
  private bob = 0;
  private switchT = 0;
  private lastId = "";

  constructor(camera: THREE.PerspectiveCamera, team: Team) {
    const wood = woodGrainGun();
    const steel = brushedSteel();
    this.guns.set("ak47", makeAk(wood, steel, team));
    this.guns.set("m4a4", makeM4(steel, team));
    this.guns.set("awp", makeAwp(steel, team));
    this.guns.set("deagle", makeDeagle(steel, team));
    this.guns.set("usp", makeUsp(steel, team));
    this.guns.set("glock", makeGlock(team));
    this.guns.set("knife", makeKnife(steel, team));
    for (const g of this.guns.values()) this.group.add(g);

    this.flash = new THREE.PointLight(0xffc258, 0, 5);
    this.flash.position.set(0.04, 0.04, -0.92);
    this.group.add(this.flash);

    const flashMap = muzzleFlashTex();
    for (let i = 0; i < 2; i++) {
      const sprite = new THREE.Mesh(
        new THREE.PlaneGeometry(0.22, 0.22),
        new THREE.MeshBasicMaterial({
          map: flashMap,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      sprite.rotation.y = i * Math.PI * 0.5;
      sprite.position.set(0.03, 0.05, -0.94);
      sprite.visible = false;
      this.flashSprites.push(sprite);
      this.group.add(sprite);
    }

    const key = new THREE.DirectionalLight(0xfff1d2, 1.55);
    key.position.set(0.35, 0.55, 0.7);
    const fill = new THREE.DirectionalLight(0x9eb6d4, 0.45);
    fill.position.set(-0.5, 0.1, 0.4);
    this.group.add(key, fill);

    camera.add(this.group);
    this.group.position.set(0.2, -0.2, -0.38);
  }

  update(player: Player, dt: number): void {
    const id = player.weapon.def.id as GunId;
    if (id !== this.lastId) {
      this.switchT = 1;
      this.lastId = id;
    }
    this.switchT = Math.max(0, this.switchT - dt * 4.5);

    for (const [key, gun] of this.guns) gun.visible = key === id;

    this.bob += dt * (player.moving ? 9.2 : 1.6);
    const walk = player.moving && player.grounded ? 1 : 0.12;
    const kick = player.viewKick;
    const reload = player.weapon.reloading > 0 ? 0.16 : 0;
    const drop = this.switchT * 0.22 + reload;
    this.group.position.set(
      0.2 + Math.sin(this.bob) * 0.01 * walk,
      -0.2 + Math.abs(Math.cos(this.bob)) * 0.012 * walk + kick * 0.028 - drop,
      -0.38 - kick * 0.055,
    );
    this.group.rotation.x = -kick * 0.16 - drop * 0.8;
    this.group.rotation.y = Math.sin(this.bob * 0.5) * 0.012 * walk;
    this.group.rotation.z = Math.sin(this.bob) * 0.018 * walk;
    this.group.visible = !player.scoped;

    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 26);
    const show = this.flash.intensity > 0.4;
    for (const s of this.flashSprites) {
      s.visible = show;
      s.scale.setScalar(0.7 + this.flash.intensity * 0.08);
    }
  }

  muzzle(): void {
    this.flash.intensity = 9;
    const id = this.lastId;
    const z = id === "awp" ? -1.28 : id === "deagle" ? -0.72 : id === "usp" ? -0.88 : id === "glock" ? -0.62 : -0.96;
    this.flash.position.z = z;
    for (const s of this.flashSprites) s.position.z = z - 0.02;
  }
}

function part(
  parent: THREE.Object3D,
  geo: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeAk(woodMap: THREE.Texture, steelMap: THREE.Texture, team: Team): THREE.Group {
  const g = new THREE.Group();
  const wood = mat(0xffffff, { map: woodMap, rough: 0.62, metal: 0.02, bump: woodMap, bumpScale: 0.04 });
  const steel = mat(0x8a9096, { map: steelMap, metal: 0.82, rough: 0.32 });
  const dark = mat(0x1c1f23, { metal: 0.55, rough: 0.4 });
  const rec = mat(0x2a2e32, { map: steelMap, metal: 0.7, rough: 0.38 });

  part(g, new THREE.BoxGeometry(0.055, 0.078, 0.42), rec, 0, 0.02, -0.12);
  part(g, new THREE.BoxGeometry(0.05, 0.03, 0.38), dark, 0, 0.058, -0.12);
  part(g, new THREE.BoxGeometry(0.048, 0.07, 0.26), wood, 0, 0.01, -0.42);
  part(g, new THREE.BoxGeometry(0.04, 0.028, 0.24), wood, 0, 0.052, -0.42);
  part(g, new THREE.CylinderGeometry(0.013, 0.013, 0.38, 10), steel, 0, 0.03, -0.68, Math.PI / 2);
  part(g, new THREE.BoxGeometry(0.03, 0.034, 0.055), dark, 0, 0.04, -0.88);
  part(g, new THREE.BoxGeometry(0.036, 0.02, 0.05), steel, 0, 0.04, -0.93);
  part(g, new THREE.BoxGeometry(0.012, 0.04, 0.012), dark, 0, 0.068, -0.86);
  part(g, new THREE.BoxGeometry(0.03, 0.018, 0.05), dark, 0, 0.07, -0.02);
  part(g, new THREE.BoxGeometry(0.046, 0.07, 0.2), wood, 0, 0.0, 0.2);
  part(g, new THREE.BoxGeometry(0.05, 0.09, 0.04), wood, 0, 0.01, 0.3);
  part(g, new THREE.BoxGeometry(0.038, 0.11, 0.055), dark, 0, -0.07, 0.05, 0.35);
  part(g, new THREE.BoxGeometry(0.03, 0.16, 0.07), dark, 0, -0.1, -0.16);
  part(g, new THREE.BoxGeometry(0.028, 0.03, 0.08), dark, 0, -0.18, -0.18, 0.5);
  part(g, new THREE.BoxGeometry(0.04, 0.02, 0.06), dark, 0, -0.03, 0.04);
  addHands(g, team, "rifle");
  g.position.set(0.02, -0.02, 0.06);
  return g;
}

function makeM4(steelMap: THREE.Texture, team: Team): THREE.Group {
  const g = new THREE.Group();
  const steel = mat(0x6e747a, { map: steelMap, metal: 0.78, rough: 0.3 });
  const poly = mat(0x1a1d21, { map: polymerTex("#1a1d21"), metal: 0.15, rough: 0.55 });
  const gray = mat(0x2c3136, { metal: 0.45, rough: 0.42 });

  part(g, new THREE.BoxGeometry(0.05, 0.07, 0.36), gray, 0, 0.02, -0.1);
  part(g, new THREE.BoxGeometry(0.036, 0.034, 0.3), poly, 0, 0.062, -0.08);
  part(g, new THREE.BoxGeometry(0.044, 0.05, 0.28), poly, 0, 0.01, -0.4);
  for (let i = 0; i < 6; i++) {
    part(g, new THREE.BoxGeometry(0.048, 0.008, 0.018), gray, 0, 0.04, -0.3 - i * 0.036);
  }
  part(g, new THREE.CylinderGeometry(0.011, 0.011, 0.34, 10), steel, 0, 0.028, -0.66, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.016, 0.014, 0.04, 8), steel, 0, 0.028, -0.84, Math.PI / 2);
  part(g, new THREE.BoxGeometry(0.03, 0.046, 0.02), poly, 0, 0.055, -0.72);
  part(g, new THREE.BoxGeometry(0.04, 0.05, 0.12), poly, 0, 0.0, 0.18);
  part(g, new THREE.BoxGeometry(0.036, 0.07, 0.03), poly, 0, 0.0, 0.25);
  part(g, new THREE.BoxGeometry(0.036, 0.11, 0.05), poly, 0, -0.068, 0.04, 0.28);
  part(g, new THREE.BoxGeometry(0.03, 0.15, 0.055), poly, 0, -0.1, -0.12);
  part(g, new THREE.BoxGeometry(0.046, 0.04, 0.08), gray, 0, 0.08, 0.02);
  addHands(g, team, "rifle");
  g.position.set(0.02, -0.02, 0.08);
  return g;
}

function makeAwp(steelMap: THREE.Texture, team: Team): THREE.Group {
  const g = new THREE.Group();
  const steel = mat(0x6a7076, { map: steelMap, metal: 0.8, rough: 0.28 });
  const chassis = mat(0x2c3824, { map: polymerTex("#2c3824"), metal: 0.08, rough: 0.6 });
  const dark = mat(0x15181c, { metal: 0.5, rough: 0.38 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x87c6ff,
    metalness: 0.9,
    roughness: 0.08,
    transparent: true,
    opacity: 0.55,
    emissive: 0x12304a,
  });

  part(g, new THREE.BoxGeometry(0.058, 0.07, 0.5), chassis, 0, 0.0, -0.18);
  part(g, new THREE.BoxGeometry(0.05, 0.05, 0.22), chassis, 0, -0.01, 0.18);
  part(g, new THREE.CylinderGeometry(0.014, 0.014, 0.62, 10), steel, 0, 0.02, -0.72, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.022, 0.018, 0.06, 10), dark, 0, 0.02, -1.04, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.028, 0.028, 0.22, 14), dark, 0, 0.09, -0.16, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.034, 0.03, 0.05, 14), dark, 0, 0.09, -0.05, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.034, 0.03, 0.05, 14), dark, 0, 0.09, -0.28, Math.PI / 2);
  part(g, new THREE.CircleGeometry(0.024, 16), glass, 0, 0.09, -0.025);
  part(g, new THREE.BoxGeometry(0.02, 0.04, 0.02), dark, 0, 0.055, -0.16);
  part(g, new THREE.BoxGeometry(0.032, 0.12, 0.07), chassis, 0, -0.08, 0.02, 0.25);
  part(g, new THREE.BoxGeometry(0.03, 0.1, 0.06), dark, 0, -0.08, -0.2);
  part(g, new THREE.BoxGeometry(0.01, 0.08, 0.01), dark, -0.03, -0.08, -0.55);
  part(g, new THREE.BoxGeometry(0.01, 0.08, 0.01), dark, 0.03, -0.08, -0.55);
  addHands(g, team, "rifle");
  g.position.set(0.0, -0.03, 0.12);
  g.scale.set(0.92, 0.92, 0.92);
  return g;
}

function makeDeagle(steelMap: THREE.Texture, team: Team): THREE.Group {
  const g = new THREE.Group();
  const slide = mat(0x2a2d31, { map: steelMap, metal: 0.72, rough: 0.28 });
  const gold = mat(0xc4a24a, { metal: 0.95, rough: 0.18 });
  const grip = mat(0x1a120c, { map: polymerTex("#1a120c"), metal: 0.05, rough: 0.7 });

  part(g, new THREE.BoxGeometry(0.042, 0.038, 0.26), slide, 0, 0.04, -0.16);
  part(g, new THREE.BoxGeometry(0.03, 0.016, 0.18), gold, 0, 0.03, -0.28);
  part(g, new THREE.BoxGeometry(0.04, 0.04, 0.12), slide, 0, 0.01, -0.04);
  part(g, new THREE.BoxGeometry(0.038, 0.13, 0.055), grip, 0, -0.07, 0.02, 0.22);
  part(g, new THREE.BoxGeometry(0.02, 0.01, 0.03), slide, 0, 0.062, -0.04);
  part(g, new THREE.BoxGeometry(0.016, 0.016, 0.016), slide, 0, 0.062, -0.28);
  addHands(g, team, "pistol");
  g.position.set(0.04, -0.04, -0.02);
  return g;
}

function makeUsp(steelMap: THREE.Texture, team: Team): THREE.Group {
  const g = new THREE.Group();
  const slide = mat(0xc5c8cc, { map: steelMap, metal: 0.88, rough: 0.22 });
  const frame = mat(0x171a1e, { metal: 0.25, rough: 0.5 });
  const can = mat(0x2a2e32, { metal: 0.7, rough: 0.35 });

  part(g, new THREE.BoxGeometry(0.036, 0.032, 0.2), slide, 0, 0.036, -0.12);
  part(g, new THREE.BoxGeometry(0.034, 0.036, 0.12), frame, 0, 0.008, -0.04);
  part(g, new THREE.CylinderGeometry(0.013, 0.013, 0.16, 10), can, 0, 0.03, -0.32, Math.PI / 2);
  part(g, new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10), can, 0, 0.03, -0.41, Math.PI / 2);
  part(g, new THREE.BoxGeometry(0.034, 0.12, 0.048), frame, 0, -0.065, 0.02, 0.18);
  part(g, new THREE.BoxGeometry(0.018, 0.012, 0.02), frame, 0, 0.056, -0.02);
  addHands(g, team, "pistol");
  g.position.set(0.05, -0.03, 0.0);
  return g;
}

function makeGlock(team: Team): THREE.Group {
  const g = new THREE.Group();
  const slide = mat(0x2b3036, { metal: 0.55, rough: 0.36 });
  const frame = mat(0x1c1f22, { map: polymerTex("#1c1f22"), metal: 0.12, rough: 0.58 });

  part(g, new THREE.BoxGeometry(0.034, 0.03, 0.18), slide, 0, 0.034, -0.1);
  part(g, new THREE.BoxGeometry(0.032, 0.034, 0.1), frame, 0, 0.006, -0.02);
  part(g, new THREE.BoxGeometry(0.02, 0.014, 0.08), slide, 0, 0.028, -0.2);
  part(g, new THREE.BoxGeometry(0.032, 0.118, 0.046), frame, 0, -0.064, 0.02, 0.16);
  part(g, new THREE.BoxGeometry(0.016, 0.01, 0.018), slide, 0, 0.052, -0.02);
  addHands(g, team, "pistol");
  g.position.set(0.05, -0.03, 0.02);
  return g;
}

function makeKnife(steelMap: THREE.Texture, team: Team): THREE.Group {
  const g = new THREE.Group();
  const blade = mat(0xd5dde4, { map: steelMap, metal: 0.92, rough: 0.16 });
  const handle = mat(0x2a1c12, { map: polymerTex("#2a1c12"), metal: 0.05, rough: 0.7 });
  const guard = mat(0x3a3f44, { metal: 0.7, rough: 0.3 });

  part(g, new THREE.BoxGeometry(0.012, 0.038, 0.26), blade, 0.03, 0.0, -0.22);
  part(g, new THREE.BoxGeometry(0.004, 0.02, 0.2), blade, 0.03, 0.012, -0.22);
  part(g, new THREE.BoxGeometry(0.04, 0.012, 0.04), guard, 0.03, 0.0, -0.08);
  part(g, new THREE.BoxGeometry(0.022, 0.03, 0.1), handle, 0.03, 0.0, 0.0);
  addHands(g, team, "knife");
  g.position.set(0.06, -0.06, -0.04);
  g.rotation.z = -0.35;
  return g;
}

function addHands(parent: THREE.Group, team: Team, pose: "rifle" | "pistol" | "knife"): void {
  const skin = mat(0xc4a07a, { rough: 0.55, metal: 0.02 });
  const sleeve = mat(team === "T" ? 0x8a6a2c : 0x2d4a72, { rough: 0.7, metal: 0.04 });
  const right = new THREE.Group();
  const left = new THREE.Group();

  part(right, new THREE.BoxGeometry(0.055, 0.075, 0.09), skin, 0, 0, 0);
  part(right, new THREE.BoxGeometry(0.06, 0.07, 0.1), sleeve, 0, 0.01, 0.09);
  for (let i = 0; i < 4; i++) {
    part(right, new THREE.BoxGeometry(0.012, 0.014, 0.045), skin, -0.02 + i * 0.013, 0.028, -0.055);
  }
  part(right, new THREE.BoxGeometry(0.014, 0.016, 0.036), skin, -0.034, -0.01, -0.03, 0, 0.6);

  part(left, new THREE.BoxGeometry(0.05, 0.07, 0.085), skin, 0, 0, 0);
  part(left, new THREE.BoxGeometry(0.055, 0.065, 0.09), sleeve, 0, 0.01, 0.08);
  for (let i = 0; i < 4; i++) {
    part(left, new THREE.BoxGeometry(0.012, 0.014, 0.04), skin, -0.018 + i * 0.012, 0.026, -0.05);
  }

  if (pose === "rifle") {
    right.position.set(0.055, -0.08, 0.05);
    right.rotation.set(0.15, 0.15, 0.15);
    left.position.set(-0.03, -0.02, -0.38);
    left.rotation.set(0.1, -0.2, 0.4);
  } else if (pose === "pistol") {
    right.position.set(0.05, -0.08, 0.04);
    right.rotation.set(0.2, 0.1, 0.1);
    left.position.set(-0.02, -0.04, -0.02);
    left.rotation.set(0.3, -0.15, 0.5);
  } else {
    right.position.set(0.07, -0.05, 0.04);
    right.rotation.set(0.4, 0.2, -0.2);
    left.visible = false;
  }
  parent.add(right, left);
}
