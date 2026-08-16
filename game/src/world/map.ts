import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  concreteTexture,
  crateTexture,
  metalTexture,
  plasterTexture,
  sandTexture,
  skyTexture,
} from "./textures";

export interface GameMap {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
  colliders: THREE.Box3[];
  playerSpawn: THREE.Vector3;
  playerSpawnYaw: number;
  botSpawns: THREE.Vector3[];
  coverPoints: THREE.Vector3[];
  bounds: THREE.Box3;
}

const HALF = 40;
const WALL_H = 7;

interface BlockOptions {
  texture?: "concrete" | "plaster" | "crate" | "metal";
  color?: number;
  collider?: boolean;
  repeat?: [number, number];
}

class MapBuilder {
  readonly group = new THREE.Group();
  readonly colliders: THREE.Box3[] = [];

  private readonly materials = new Map<string, THREE.Material>();
  /** Static geometry is batched per material and merged into one mesh each. */
  private readonly batches = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();

  private materialKey(
    kind: NonNullable<BlockOptions["texture"]>,
    color: number,
    repeat: [number, number],
  ): string {
    return `${kind}:${color}:${repeat[0]}:${repeat[1]}`;
  }

  private material(kind: NonNullable<BlockOptions["texture"]>, color: number, repeat: [number, number]): THREE.Material {
    const key = this.materialKey(kind, color, repeat);
    const existing = this.materials.get(key);
    if (existing) return existing;

    let map: THREE.Texture;
    switch (kind) {
      case "concrete":
        map = concreteTexture(repeat[0], repeat[1]);
        break;
      case "plaster":
        map = plasterTexture(repeat[0], repeat[1]);
        break;
      case "crate":
        map = crateTexture();
        break;
      case "metal":
        map = metalTexture(repeat[0], repeat[1]);
        break;
    }
    const material = new THREE.MeshLambertMaterial({ map, color });
    this.materials.set(key, material);
    return material;
  }

  block(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    options: BlockOptions = {},
  ): void {
    const {
      texture = "concrete",
      color = 0xffffff,
      collider = true,
      repeat,
    } = options;
    const scale: [number, number] = repeat ?? [
      Math.max(1, Math.round(Math.max(w, d) / 2.5)),
      Math.max(1, Math.round(h / 2.5)),
    ];

    const geometry = new THREE.BoxGeometry(w, h, d);
    geometry.translate(x, y + h / 2, z);

    const key = this.materialKey(texture, color, scale);
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { material: this.material(texture, color, scale), geometries: [] };
      this.batches.set(key, batch);
    }
    batch.geometries.push(geometry);

    if (collider) {
      this.colliders.push(
        new THREE.Box3(
          new THREE.Vector3(x - w / 2, y, z - d / 2),
          new THREE.Vector3(x + w / 2, y + h, z + d / 2),
        ),
      );
    }
  }

  /** Merges every batch so the whole level renders in a handful of draw calls. */
  finalize(): void {
    for (const batch of this.batches.values()) {
      const merged = mergeGeometries(batch.geometries, false);
      if (!merged) continue;
      for (const geometry of batch.geometries) geometry.dispose();
      const mesh = new THREE.Mesh(merged, batch.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
    this.batches.clear();
  }

  ramp(
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    facing: "north" | "south" | "east" | "west",
    steps = 6,
  ): void {
    // Ramps are built from stair steps so that the AABB physics can climb them.
    const stepH = height / steps;
    const stepD = depth / steps;
    for (let i = 0; i < steps; i++) {
      const h = stepH * (i + 1);
      let px = x;
      let pz = z;
      let w = width;
      let d = stepD;
      const offset = -depth / 2 + stepD * (i + 0.5);
      switch (facing) {
        case "north":
          pz = z - offset;
          break;
        case "south":
          pz = z + offset;
          break;
        case "east":
          px = x - offset;
          w = stepD;
          d = width;
          break;
        case "west":
          px = x + offset;
          w = stepD;
          d = width;
          break;
      }
      this.block(px, y, pz, w, h, d, { texture: "concrete", color: 0xd7cbb0 });
    }
  }
}

export function buildMap(scene: THREE.Scene): GameMap {
  const builder = new MapBuilder();

  // ---------- sky & lighting ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(220, 32, 16),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog(0xd9c9a5, 45, 165);

  const hemi = new THREE.HemisphereLight(0xbcd4f0, 0xc2a878, 1.05);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff0d0, 2.1);
  sun.position.set(38, 54, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  // ---------- ground ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF * 2, HALF * 2),
    new THREE.MeshLambertMaterial({ map: sandTexture(30) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  builder.group.add(ground);
  builder.colliders.push(
    new THREE.Box3(
      new THREE.Vector3(-HALF, -2, -HALF),
      new THREE.Vector3(HALF, 0, HALF),
    ),
  );

  // ---------- perimeter ----------
  const P = { texture: "plaster" as const, color: 0xe4d8bd };
  builder.block(0, 0, -HALF, HALF * 2, WALL_H, 1.5, P);
  builder.block(0, 0, HALF, HALF * 2, WALL_H, 1.5, P);
  builder.block(-HALF, 0, 0, 1.5, WALL_H, HALF * 2, P);
  builder.block(HALF, 0, 0, 1.5, WALL_H, HALF * 2, P);

  // ---------- bomb site A: raised platform, north-east ----------
  builder.block(20, 0, -22, 22, 1.3, 18, { texture: "concrete", color: 0xd8ccb2 });
  builder.ramp(20, 0, -11.5, 10, 1.3, 5, "south", 5);
  builder.ramp(8.5, 0, -22, 12, 1.3, 5, "east", 5);

  // crates on the site
  builder.block(15, 1.3, -26, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(17.4, 1.3, -26, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(15, 3.7, -26, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(24, 1.3, -18, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(26.4, 1.3, -18, 2.4, 1.6, 2.4, { texture: "crate" });
  builder.block(22, 1.3, -28, 3.2, 1.6, 2.4, { texture: "crate" });

  // site back wall with a window
  builder.block(29, 0, -22, 1.2, 3, 16, P);
  builder.block(29, 4.4, -22, 1.2, 2.6, 16, P);
  builder.block(29, 3, -29, 1.2, 1.4, 2, P);
  builder.block(29, 3, -15.5, 1.2, 1.4, 3, P);

  // ---------- long corridor, east side ----------
  builder.block(33, 0, 2, 1.2, 5, 34, { texture: "concrete", color: 0xcfc3a8 });
  builder.block(24, 0, 14, 1.2, 5, 18, { texture: "concrete", color: 0xcfc3a8 });
  builder.block(24, 0, -2, 1.2, 5, 8, { texture: "concrete", color: 0xcfc3a8 });
  builder.block(28.5, 0, 22, 10, 5, 1.2, { texture: "concrete", color: 0xcfc3a8 });
  builder.block(28.5, 1.2, 5.5, 2.4, 1.2, 2.4, { texture: "crate" });
  builder.block(28.5, 0, 5.5, 2.4, 1.2, 2.4, { texture: "crate" });

  // ---------- mid: central open lane with cover ----------
  builder.block(-2, 0, 4, 1.2, 4.5, 22, { texture: "plaster", color: 0xdccfb4 });
  builder.block(-2, 0, -14, 1.2, 4.5, 10, { texture: "plaster", color: 0xdccfb4 });
  builder.block(6, 0, -4, 1.2, 4.5, 20, { texture: "plaster", color: 0xdccfb4 });
  builder.block(6, 0, 14, 1.2, 4.5, 8, { texture: "plaster", color: 0xdccfb4 });

  // double doors at mid
  builder.block(2, 3.4, -8.5, 8, 1.6, 1, { texture: "metal", color: 0x8a8f94 });
  builder.block(-0.4, 0, -8.5, 1.5, 3.4, 1, { texture: "metal", color: 0x8a8f94 });
  builder.block(4.4, 0, -8.5, 1.5, 3.4, 1, { texture: "metal", color: 0x8a8f94 });

  // mid crates
  builder.block(2, 0, 2, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(2, 0, -18, 2.4, 1.6, 2.4, { texture: "crate" });
  builder.block(2, 0, 12, 2.4, 1.6, 2.4, { texture: "crate" });

  // ---------- west tunnels: covered passage ----------
  builder.block(-14, 0, -6, 1.2, 4.5, 24, { texture: "concrete", color: 0xcabd9f });
  builder.block(-24, 0, -6, 1.2, 4.5, 24, { texture: "concrete", color: 0xcabd9f });
  builder.block(-19, 4.5, -6, 11.2, 0.8, 24, { texture: "concrete", color: 0xb3a88d });
  builder.block(-19, 0, -18.6, 11.2, 4.5, 1.2, { texture: "concrete", color: 0xcabd9f });
  builder.block(-19, 3.2, 6.6, 11.2, 1.3, 1.2, { texture: "concrete", color: 0xcabd9f });
  builder.block(-16.4, 0, 6.6, 6, 3.2, 1.2, { texture: "concrete", color: 0xcabd9f });
  builder.block(-19, 0, -12, 2.4, 1.6, 2.4, { texture: "crate" });
  builder.block(-21.5, 0, -3, 2.4, 2.4, 2.4, { texture: "crate" });

  // tunnel exit into the north-west courtyard
  builder.block(-19, 0, -24, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(-16.6, 0, -24, 2.4, 1.6, 2.4, { texture: "crate" });

  // ---------- north-west courtyard / bomb site B ----------
  builder.block(-24, 0, -30, 20, 0.9, 14, { texture: "concrete", color: 0xd4c8ae });
  builder.ramp(-24, 0, -22.5, 9, 0.9, 4, "south", 4);
  builder.block(-30, 0.9, -34, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(-27.6, 0.9, -34, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(-30, 3.3, -34, 2.4, 2.4, 2.4, { texture: "crate" });
  builder.block(-18, 0.9, -30, 2.4, 1.6, 2.4, { texture: "crate" });
  builder.block(-31, 0, -24, 12, 4.5, 1.2, { texture: "plaster", color: 0xdccfb4 });

  // ---------- south spawn area ----------
  builder.block(-8, 0, 22, 1.2, 4.5, 16, { texture: "plaster", color: 0xdccfb4 });
  builder.block(12, 0, 22, 1.2, 4.5, 16, { texture: "plaster", color: 0xdccfb4 });
  builder.block(2, 0, 30, 20, 1.2, 1.2, { texture: "concrete", color: 0xcfc3a8 });
  builder.block(-14, 0, 16, 2.4, 1.6, 2.4, { texture: "crate" });
  builder.block(16, 0, 16, 2.4, 1.6, 2.4, { texture: "crate" });

  // ---------- catwalk over the west lane ----------
  builder.block(-8, 3.4, 12, 12, 0.6, 3, { texture: "metal", color: 0x9aa0a5 });
  builder.ramp(-8, 0, 17, 3, 3.4, 6, "south", 7);
  builder.block(-2.6, 4, 12, 0.4, 1.2, 3, { texture: "metal", color: 0x9aa0a5, collider: false });

  // ---------- scattered barrels / low cover ----------
  const barrelPositions: Array<[number, number]> = [
    [-6, -20],
    [10, -14],
    [18, 6],
    [-28, 4],
    [-4, 26],
    [22, 30],
    [-30, 18],
    [8, -30],
  ];
  const barrelMat = new THREE.MeshLambertMaterial({ map: metalTexture(2, 1), color: 0xb8563a });
  const barrelGeometries: THREE.BufferGeometry[] = [];
  for (const [x, z] of barrelPositions) {
    const geometry = new THREE.CylinderGeometry(0.55, 0.55, 1.5, 14);
    geometry.translate(x, 0.75, z);
    barrelGeometries.push(geometry);
    builder.colliders.push(
      new THREE.Box3(
        new THREE.Vector3(x - 0.55, 0, z - 0.55),
        new THREE.Vector3(x + 0.55, 1.5, z + 0.55),
      ),
    );
  }
  const mergedBarrels = mergeGeometries(barrelGeometries, false);
  if (mergedBarrels) {
    const barrels = new THREE.Mesh(mergedBarrels, barrelMat);
    barrels.castShadow = true;
    barrels.receiveShadow = true;
    builder.group.add(barrels);
  }

  builder.finalize();
  scene.add(builder.group);
  sun.target.position.set(0, 0, 0);

  const botSpawns = [
    new THREE.Vector3(20, 1.4, -24),
    new THREE.Vector3(26, 1.4, -18),
    new THREE.Vector3(-26, 1.0, -30),
    new THREE.Vector3(-19, 0, -16),
    new THREE.Vector3(30, 0, 10),
    new THREE.Vector3(2, 0, -22),
    new THREE.Vector3(-30, 0, -14),
    new THREE.Vector3(14, 1.4, -20),
    new THREE.Vector3(-19, 0, -2),
    new THREE.Vector3(28, 0, 0),
  ];

  const coverPoints = [
    new THREE.Vector3(2, 0, -12),
    new THREE.Vector3(-4, 0, -6),
    new THREE.Vector3(8, 0, -2),
    new THREE.Vector3(-10, 0, 2),
    new THREE.Vector3(-16, 0, -10),
    new THREE.Vector3(12, 0, 8),
    new THREE.Vector3(20, 0, 2),
    new THREE.Vector3(-19, 0, 4),
    new THREE.Vector3(-24, 0.9, -28),
    new THREE.Vector3(18, 1.3, -20),
    new THREE.Vector3(24, 1.3, -26),
    new THREE.Vector3(-6, 0, 14),
    new THREE.Vector3(10, 0, 18),
    new THREE.Vector3(0, 0, 24),
    new THREE.Vector3(-30, 0, 6),
    new THREE.Vector3(30, 0, 18),
  ];

  return {
    group: builder.group,
    sun,
    colliders: builder.colliders,
    playerSpawn: new THREE.Vector3(2, 0, 27),
    playerSpawnYaw: Math.PI,
    botSpawns,
    coverPoints,
    bounds: new THREE.Box3(
      new THREE.Vector3(-HALF, 0, -HALF),
      new THREE.Vector3(HALF, WALL_H, HALF),
    ),
  };
}
