import * as THREE from "three";
import { aabbFromCenter } from "./math";
import type { AABB, Team, Vec3 } from "./types";
import type { Waypoint } from "./path";

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

const SAND = 0xb8965c;
const WALL = 0x9a7d52;
const WALL_DARK = 0x5c4630;
const WOOD = 0x6b4423;
const WOOD_LIGHT = 0x8a5a32;
const CONCRETE = 0x6e675c;
const METAL = 0x4a4d50;
const TRIM = 0x3d3328;

function noiseTexture(c1: string, c2: string, size = 128): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context");
  ctx.fillStyle = c1;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 18; i++) {
    ctx.fillStyle = c2;
    ctx.globalAlpha = 0.08 + Math.random() * 0.18;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2 + Math.random() * 6, 2 + Math.random() * 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildWorld(scene: THREE.Scene): WorldData {
  const colliders: AABB[] = [];
  const radarWalls: Array<{ x: number; z: number; w: number; d: number }> = [];
  const sandTex = noiseTexture("#c2a36b", "#6a4e2a");
  sandTex.repeat.set(18, 18);
  const wallTex = noiseTexture("#a88858", "#3d2c18");
  wallTex.repeat.set(2, 1);
  const woodTex = noiseTexture("#7a4e28", "#2c160c");

  const floorMat = new THREE.MeshLambertMaterial({ map: sandTex, color: SAND });
  const wallMat = new THREE.MeshLambertMaterial({ map: wallTex, color: WALL });
  const darkWall = new THREE.MeshLambertMaterial({ color: WALL_DARK });
  const woodMat = new THREE.MeshLambertMaterial({ map: woodTex, color: WOOD });
  const crateMat = new THREE.MeshLambertMaterial({ map: woodTex, color: WOOD_LIGHT });
  const concrete = new THREE.MeshLambertMaterial({ color: CONCRETE });
  const metal = new THREE.MeshLambertMaterial({ color: METAL });
  const trimMat = new THREE.MeshLambertMaterial({ color: TRIM });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const addBox = (
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    mat: THREE.Material,
    y = h / 2,
    collide = true,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
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

  // Outer walls
  addBox(0, -36, 82, 1.2, 5.2, darkWall);
  addBox(0, 36, 82, 1.2, 5.2, darkWall);
  addBox(-40, 0, 1.2, 73, 5.2, darkWall);
  addBox(40, 0, 1.2, 73, 5.2, darkWall);

  // Mid corridor walls with door gaps
  addBox(-7, -14, 1.1, 16, 4.6, wallMat);
  addBox(-7, 16, 1.1, 12, 4.6, wallMat);
  addBox(7, -10, 1.1, 10, 4.6, wallMat);
  addBox(7, 18, 1.1, 10, 4.6, wallMat);

  // Long A west wall (opens to cat and A)
  addBox(22, -16, 1.1, 22, 4.6, wallMat);
  addBox(22, 22, 1.1, 10, 4.6, wallMat);

  // A site north / south lips
  addBox(31, 30, 16, 1.1, 4.2, wallMat);
  addBox(31, 12, 10, 1.1, 3.6, wallMat);

  // Catwalk railing / divider
  addBox(14, 8, 12, 1.1, 2.8, wallMat);

  // B tunnels
  addBox(-22, -16, 1.1, 18, 4.4, wallMat);
  addBox(-22, 6, 16, 1.1, 4.4, wallMat);
  addBox(-30, -2, 1.1, 14, 4.4, wallMat);

  // B site lips
  addBox(-30, 28, 16, 1.1, 4.2, wallMat);
  addBox(-16, 22, 1.1, 12, 4.2, wallMat);

  // CT connector
  addBox(4, 26, 18, 1.1, 3.8, wallMat);

  // Cover crates — mid
  addBox(0, 1, 1.4, 1.4, 1.15, crateMat);
  addBox(2.2, -1.2, 1.3, 2.6, 1.85, woodMat);
  addBox(-2.4, 3.2, 2.4, 1.2, 1.1, crateMat);
  addBox(0.6, 8, 1.2, 3.2, 1.2, concrete);

  // T spawn cover
  addBox(6, -26, 1.4, 2.8, 1.2, crateMat);
  addBox(12, -22, 2.2, 1.2, 1.8, woodMat);
  addBox(-2, -24, 1.3, 1.3, 1.1, crateMat);

  // Long A boxes
  addBox(28, -8, 1.5, 1.5, 1.2, crateMat);
  addBox(32, 2, 2.4, 1.2, 1.8, woodMat);
  addBox(26, 8, 1.2, 2.2, 1.15, concrete);

  // A site
  addBox(30, 22, 3.4, 1.4, 0.55, concrete);
  addBox(27, 20, 1.4, 1.4, 1.2, crateMat);
  addBox(33, 24, 1.3, 2.6, 1.85, woodMat);
  addBox(29, 26, 2.2, 1.2, 1.15, crateMat);

  // Cat
  addBox(14, 12, 1.4, 1.4, 1.1, crateMat);
  addBox(17, 14, 2.2, 1.1, 1.7, woodMat);

  // B site
  addBox(-28, 20, 3.2, 1.4, 0.55, concrete);
  addBox(-26, 18, 1.4, 1.4, 1.2, crateMat);
  addBox(-32, 22, 1.3, 2.4, 1.8, woodMat);
  addBox(-24, 24, 2.2, 1.2, 1.15, crateMat);

  // Tunnels boxes
  addBox(-18, -8, 1.3, 1.3, 1.1, crateMat);
  addBox(-26, -6, 1.2, 2.2, 1.7, woodMat);

  // CT spawn
  addBox(8, 30, 2.4, 1.2, 1.2, crateMat);
  addBox(2, 32, 1.3, 1.3, 1.8, woodMat);

  // Decorative towers
  addBox(-38, 34, 2.2, 2.2, 7.5, trimMat, 3.75);
  addBox(38, -34, 2.2, 2.2, 7.5, trimMat, 3.75);
  addBox(38, 34, 2.4, 2.4, 6.2, metal, 3.1);

  // Site markers
  const aMark = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 24),
    new THREE.MeshBasicMaterial({ color: 0xc45c2c, transparent: true, opacity: 0.55 }),
  );
  aMark.rotation.x = -Math.PI / 2;
  aMark.position.set(30, 0.03, 22);
  scene.add(aMark);
  const bMark = aMark.clone();
  bMark.material = new THREE.MeshBasicMaterial({ color: 0x3c6cc4, transparent: true, opacity: 0.55 });
  bMark.position.set(-28, 0.03, 20);
  scene.add(bMark);

  const hemi = new THREE.HemisphereLight(0xc8dceb, 0x6a5333, 0.85);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe6b8, 1.15);
  sun.position.set(-30, 48, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -50;
  sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50;
  sun.shadow.camera.bottom = -50;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.16));

  scene.background = new THREE.Color(0x87b0cc);
  scene.fog = new THREE.Fog(0xc4b48a, 38, 92);

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
