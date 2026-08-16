import * as THREE from "three";
import { aabbFromCenter } from "./math";
import type { AABB, Team, Vec3 } from "./types";
import type { Waypoint } from "./path";
import {
  createSky,
  mat,
  metalMaps,
  sandMaps,
  sandstoneMaps,
  woodMaps,
} from "./look";

export type { Waypoint } from "./path";
export { findPath, nearestWaypoint } from "./path";

export interface WorldData {
  colliders: AABB[];
  floorBoxes: AABB[];
  spawns: Record<Team, Vec3[]>;
  sites: { A: Vec3; B: Vec3 };
  waypoints: Waypoint[];
  radarWalls: Array<{ x: number; z: number; w: number; d: number }>;
}

export function buildWorld(scene: THREE.Scene): WorldData {
  const colliders: AABB[] = [];
  const radarWalls: Array<{ x: number; z: number; w: number; d: number }> = [];

  const sand = sandMaps();
  const stone = sandstoneMaps();
  const wood = woodMaps();
  const metalTex = metalMaps();

  const floorMat = mat(0xffffff, { map: sand.map, bump: sand.bump, rough: 0.92, metal: 0.02, bumpScale: 0.28 });
  const wallMat = mat(0xffffff, { map: stone.map, bump: stone.bump, rough: 0.78, metal: 0.04, bumpScale: 0.22 });
  const darkWall = mat(0x6a5336, { map: stone.map, bump: stone.bump, rough: 0.82, metal: 0.03, bumpScale: 0.18 });
  const woodMat = mat(0xffffff, { map: wood.map, bump: wood.bump, rough: 0.7, metal: 0.04, bumpScale: 0.16 });
  const crateMat = mat(0xf0d2a8, { map: wood.map, bump: wood.bump, rough: 0.68, metal: 0.05, bumpScale: 0.14 });
  const concrete = mat(0x7a7468, { rough: 0.88, metal: 0.06 });
  const metal = mat(0xffffff, { map: metalTex.map, bump: metalTex.bump, metal: 0.72, rough: 0.38, bumpScale: 0.08 });
  const trimMat = mat(0x3d3328, { rough: 0.7, metal: 0.08 });
  const capMat = mat(0x4a3a28, { map: stone.map, rough: 0.75, metal: 0.05 });

  scene.add(createSky());

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 120, 8, 8), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const addBox = (
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    material: THREE.Material,
    y = h / 2,
    collide = true,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    if (collide) {
      colliders.push(aabbFromCenter(x, y, z, w, h, d));
      if (h >= 2.4) radarWalls.push({ x, z, w, d });
    }
    return mesh;
  };

  const addWall = (x: number, z: number, w: number, d: number, h: number, material: THREE.Material): void => {
    addBox(x, z, w, d, h, material);
    addBox(x, z, w + 0.12, d + 0.12, 0.16, capMat, h + 0.02, false);
  };

  const addCrate = (x: number, z: number, w: number, d: number, h: number): void => {
    addBox(x, z, w, d, h, crateMat);
    addBox(x, z, w + 0.04, 0.06, 0.06, metal, h - 0.08, false);
    addBox(x, z, 0.06, d + 0.04, 0.06, metal, h - 0.08, false);
    addBox(x, z, w + 0.02, 0.05, 0.05, metal, 0.08, false);
  };

  const addBarrel = (x: number, z: number): void => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.95, 14), metal);
    barrel.position.set(x, 0.48, z);
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    scene.add(barrel);
    colliders.push(aabbFromCenter(x, 0.48, z, 0.68, 0.95, 0.68));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 8, 16), trimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(x, 0.92, z);
    scene.add(rim);
  };

  const addPalm = (x: number, z: number): void => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 3.4, 8), woodMat);
    trunk.position.set(x, 1.7, z);
    trunk.castShadow = true;
    scene.add(trunk);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 1.6), mat(0x3d6a32, { rough: 0.8 }));
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 0.55, 3.45, z + Math.sin(a) * 0.55);
      leaf.rotation.set(0.45, -a, 0.15);
      leaf.castShadow = true;
      scene.add(leaf);
    }
  };

  const addLetter = (ch: "A" | "B", x: number, z: number, color: number): void => {
    const { c, ctx } = (() => {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("2d");
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillRect(0, 0, 128, 128);
      ctx.font = "bold 96px Rajdhani, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = ch === "A" ? "#c45c2c" : "#3c6cc4";
      ctx.fillText(ch, 64, 70);
      return { c, ctx };
    })();
    void ctx;
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    const mark = new THREE.Mesh(
      new THREE.CircleGeometry(1.7, 28),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.42, roughness: 0.9 }),
    );
    mark.rotation.x = -Math.PI / 2;
    mark.position.set(x, 0.03, z);
    scene.add(mark);
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 1.4),
      new THREE.MeshStandardMaterial({ map, transparent: true, roughness: 0.45, metalness: 0.1 }),
    );
    board.position.set(x, 2.15, z);
    board.castShadow = true;
    scene.add(board);
    const board2 = board.clone();
    board2.rotation.y = Math.PI;
    scene.add(board2);
  };

  // Outer walls
  addWall(0, -36, 82, 1.2, 5.2, darkWall);
  addWall(0, 36, 82, 1.2, 5.2, darkWall);
  addWall(-40, 0, 1.2, 73, 5.2, darkWall);
  addWall(40, 0, 1.2, 73, 5.2, darkWall);

  addWall(-7, -14, 1.1, 16, 4.6, wallMat);
  addWall(-7, 16, 1.1, 12, 4.6, wallMat);
  addWall(7, -10, 1.1, 10, 4.6, wallMat);
  addWall(7, 18, 1.1, 10, 4.6, wallMat);
  addWall(22, -16, 1.1, 22, 4.6, wallMat);
  addWall(22, 22, 1.1, 10, 4.6, wallMat);
  addWall(31, 30, 16, 1.1, 4.2, wallMat);
  addWall(31, 12, 10, 1.1, 3.6, wallMat);
  addWall(14, 8, 12, 1.1, 2.8, wallMat);
  addWall(-22, -16, 1.1, 18, 4.4, wallMat);
  addWall(-22, 6, 16, 1.1, 4.4, wallMat);
  addWall(-30, -2, 1.1, 14, 4.4, wallMat);
  addWall(-30, 28, 16, 1.1, 4.2, wallMat);
  addWall(-16, 22, 1.1, 12, 4.2, wallMat);
  addWall(4, 26, 18, 1.1, 3.8, wallMat);

  // Door pillars
  addBox(-7, -5.8, 0.42, 0.42, 4.2, trimMat);
  addBox(-7, 9.8, 0.42, 0.42, 4.2, trimMat);
  addBox(7, -4.8, 0.42, 0.42, 4.2, trimMat);
  addBox(7, 12.8, 0.42, 0.42, 4.2, trimMat);

  addCrate(0, 1, 1.4, 1.4, 1.15);
  addCrate(2.2, -1.2, 1.3, 2.6, 1.85);
  addCrate(-2.4, 3.2, 2.4, 1.2, 1.1);
  addBox(0.6, 8, 1.2, 3.2, 1.2, concrete);

  addCrate(6, -26, 1.4, 2.8, 1.2);
  addCrate(12, -22, 2.2, 1.2, 1.8);
  addCrate(-2, -24, 1.3, 1.3, 1.1);

  addCrate(28, -8, 1.5, 1.5, 1.2);
  addCrate(32, 2, 2.4, 1.2, 1.8);
  addBox(26, 8, 1.2, 2.2, 1.15, concrete);

  addBox(30, 22, 3.4, 1.4, 0.55, concrete);
  addCrate(27, 20, 1.4, 1.4, 1.2);
  addCrate(33, 24, 1.3, 2.6, 1.85);
  addCrate(29, 26, 2.2, 1.2, 1.15);

  addCrate(14, 12, 1.4, 1.4, 1.1);
  addCrate(17, 14, 2.2, 1.1, 1.7);

  addBox(-28, 20, 3.2, 1.4, 0.55, concrete);
  addCrate(-26, 18, 1.4, 1.4, 1.2);
  addCrate(-32, 22, 1.3, 2.4, 1.8);
  addCrate(-24, 24, 2.2, 1.2, 1.15);

  addCrate(-18, -8, 1.3, 1.3, 1.1);
  addCrate(-26, -6, 1.2, 2.2, 1.7);

  addCrate(8, 30, 2.4, 1.2, 1.2);
  addCrate(2, 32, 1.3, 1.3, 1.8);

  addBox(-38, 34, 2.2, 2.2, 7.5, trimMat, 3.75);
  addBox(38, -34, 2.2, 2.2, 7.5, trimMat, 3.75);
  addBox(38, 34, 2.4, 2.4, 6.2, metal, 3.1);

  addBarrel(3.4, -24);
  addBarrel(4.1, -23.2);
  addBarrel(29, 19.2);
  addBarrel(-25, 16.6);
  addBarrel(-1.2, 7.2);

  addPalm(-36, -30);
  addPalm(36, -30);
  addPalm(-36, 32);
  addPalm(18, -34);

  addLetter("A", 30, 22, 0xc45c2c);
  addLetter("B", -28, 20, 0x3c6cc4);

  // Distant hills
  for (const [x, z, s] of [
    [-70, 20, 18],
    [72, -10, 16],
    [-60, -40, 14],
    [65, 40, 20],
  ] as Array<[number, number, number]>) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(s, s * 0.55, 7), mat(0x6a5a3e, { rough: 0.95 }));
    hill.position.set(x, s * 0.12, z);
    scene.add(hill);
  }

  const hemi = new THREE.HemisphereLight(0xcde6f5, 0x6a5333, 0.7);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe3b0, 1.55);
  sun.position.set(-34, 52, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.00025;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xfff6e8, 0.18));

  scene.background = new THREE.Color(0x87b0cc);
  scene.fog = new THREE.Fog(0xd4c09a, 48, 105);

  const waypoints: Waypoint[] = [
    { id: "tspawn", pos: { x: 8, y: 0, z: -26 }, neighbors: ["tmid", "longt", "tunnels"] },
    { id: "tmid", pos: { x: 0, y: 0, z: -12 }, neighbors: ["tspawn", "mid", "tunnels"] },
    { id: "mid", pos: { x: 0, y: 0, z: 2 }, neighbors: ["tmid", "ctmid", "cat"] },
    { id: "ctmid", pos: { x: 2, y: 0, z: 18 }, neighbors: ["mid", "ctspawn", "asite"] },
    { id: "ctspawn", pos: { x: 8, y: 0, z: 30 }, neighbors: ["ctmid", "asite", "bsite"] },
    { id: "longt", pos: { x: 28, y: 0, z: -18 }, neighbors: ["tspawn", "longa"] },
    { id: "longa", pos: { x: 28, y: 0, z: 4 }, neighbors: ["longt", "asite"] },
    { id: "cat", pos: { x: 14, y: 0, z: 12 }, neighbors: ["mid", "asite"] },
    { id: "asite", pos: { x: 30, y: 0, z: 22 }, neighbors: ["longa", "cat", "ctspawn", "ctmid"] },
    { id: "tunnels", pos: { x: -20, y: 0, z: -8 }, neighbors: ["tspawn", "tmid", "bsite"] },
    { id: "bsite", pos: { x: -28, y: 0, z: 20 }, neighbors: ["tunnels", "ctspawn"] },
  ];

  return {
    colliders,
    floorBoxes: [],
    spawns: {
      T: [
        { x: 6, y: 0, z: -28 },
        { x: 10, y: 0, z: -26 },
        { x: 4, y: 0, z: -24 },
        { x: 12, y: 0, z: -28 },
        { x: 8, y: 0, z: -22 },
      ],
      CT: [
        { x: 8, y: 0, z: 30 },
        { x: 4, y: 0, z: 32 },
        { x: 12, y: 0, z: 28 },
        { x: 2, y: 0, z: 28 },
        { x: 10, y: 0, z: 32 },
      ],
    },
    sites: { A: { x: 30, y: 0, z: 22 }, B: { x: -28, y: 0, z: 20 } },
    waypoints,
    radarWalls,
  };
}
