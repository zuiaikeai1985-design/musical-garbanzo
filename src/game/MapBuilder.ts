import * as THREE from 'three';

export interface MapObstacle {
  box: THREE.Box3;
  mesh: THREE.Mesh | THREE.Group;
  type: 'wall' | 'crate' | 'door' | 'ramp';
}

export interface BombSiteZone {
  name: 'A' | 'B';
  center: THREE.Vector3;
  radius: number;
}

export interface MapData {
  scene: THREE.Group;
  obstacles: THREE.Box3[];
  tSpawn: THREE.Vector3;
  ctSpawn: THREE.Vector3;
  botSpawnsT: THREE.Vector3[];
  botSpawnsCT: THREE.Vector3[];
  siteA: BombSiteZone;
  siteB: BombSiteZone;
  navPoints: THREE.Vector3[];
}

export function buildDust2Map(): MapData {
  const group = new THREE.Group();
  const obstacles: THREE.Box3[] = [];

  // Textures / Procedural Canvas Textures for CS desert theme
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xcdb28e,
    roughness: 0.85,
    metalness: 0.1,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xd6c29b,
    roughness: 0.9,
    metalness: 0.05,
  });

  const darkWallMat = new THREE.MeshStandardMaterial({
    color: 0x9f8865,
    roughness: 0.8,
    metalness: 0.1,
  });

  const crateWoodMat = new THREE.MeshStandardMaterial({
    color: 0x825a2c,
    roughness: 0.7,
    metalness: 0.2,
  });

  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x484d56,
    roughness: 0.4,
    metalness: 0.8,
  });

  const siteSignMatA = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.5,
  });

  const siteSignMatB = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.5,
  });

  // Helper to add a block with collision
  function addBlock(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    noCollide: boolean = false
  ) {
    const geom = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    if (!noCollide) {
      const box = new THREE.Box3().setFromObject(mesh);
      obstacles.push(box);
    }
    return mesh;
  }

  // 1. Ground floor (Huge desert floor)
  const floorGeom = new THREE.PlaneGeometry(300, 300);
  const floor = new THREE.Mesh(floorGeom, sandMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Outer Map Perimeter Boundaries
  const mapSize = 140;
  const wallHeight = 12;
  addBlock(0, 0, -mapSize / 2, mapSize, wallHeight, 4, wallMat); // North
  addBlock(0, 0, mapSize / 2, mapSize, wallHeight, 4, wallMat);  // South
  addBlock(-mapSize / 2, 0, 0, 4, wallHeight, mapSize, wallMat); // West
  addBlock(mapSize / 2, 0, 0, 4, wallHeight, mapSize, wallMat);  // East

  // 2. T Spawn (South area: Z = 40 to 60)
  // T Spawn back wall and arches
  addBlock(-15, 0, 50, 20, 6, 2, darkWallMat);
  addBlock(15, 0, 50, 20, 6, 2, darkWallMat);

  // 3. Middle (Mid Doors, Catwalk, Xbox crate)
  // Mid dividing walls
  addBlock(-15, 0, 0, 4, 8, 50, wallMat);
  addBlock(15, 0, 0, 4, 8, 40, wallMat);

  // Mid double doors
  const doorL = addBlock(-3, 0, 10, 4, 6, 1, metalMat);
  const doorR = addBlock(3, 0, 10, 4, 6, 1, metalMat);
  doorL.rotation.y = 0.2;
  doorR.rotation.y = -0.2;

  // Xbox in Mid
  addBlock(0, 0, 0, 3.5, 3.5, 3.5, crateWoodMat);

  // Catwalk (Connecting Mid to A Short)
  addBlock(-12, 3, -15, 6, 0.5, 25, wallMat);
  addBlock(-15, 0, -15, 2, 6, 25, wallMat); // Catwalk railing wall

  // 4. A Site (North-East: X = 30 to 50, Z = -35 to -50)
  // A Long Path & Long Doors
  addBlock(45, 0, 20, 3, 8, 60, wallMat);
  addBlock(30, 0, 20, 3, 8, 40, wallMat);
  addBlock(38, 0, 35, 14, 8, 2, darkWallMat); // Long A entrance arch
  // Long Corner Pit
  addBlock(48, 0, 45, 10, 2, 10, sandMat);

  // A Site Platform (Raised floor)
  addBlock(38, 0, -38, 26, 2.5, 26, sandMat);
  // Goose Corner Wall
  addBlock(50, 2.5, -48, 2, 6, 10, wallMat);
  addBlock(44, 2.5, -50, 14, 6, 2, wallMat);

  // A Site Crates (Default & Triple box)
  addBlock(35, 2.5, -35, 2.5, 2.5, 2.5, crateWoodMat);
  addBlock(35, 5.0, -35, 2.2, 2.2, 2.2, crateWoodMat);
  addBlock(32.5, 2.5, -35, 2.5, 2.5, 2.5, crateWoodMat);
  addBlock(40, 2.5, -42, 3, 3, 3, crateWoodMat);

  // A Site Decal / Marker
  const aSign = addBlock(38, 2.6, -38, 4, 0.05, 4, siteSignMatA, true);
  aSign.name = 'SiteA_Marker';

  // Ramp from Long to A Platform
  const aRamp = addBlock(38, 0, -22, 10, 2.5, 8, sandMat);
  aRamp.rotation.x = 0.2;

  // 5. B Site (North-West: X = -35 to -55, Z = -35 to -55)
  // B Upper Tunnels
  addBlock(-45, 0, 15, 16, 7, 30, darkWallMat);
  // B Tunnels exit into B site
  addBlock(-35, 0, -10, 4, 8, 20, wallMat);

  // B Site Platform & Back B
  addBlock(-45, 0, -42, 28, 1, 28, sandMat);
  // Back Plat Walls
  addBlock(-58, 0, -42, 2, 8, 26, wallMat);
  addBlock(-45, 0, -56, 26, 8, 2, wallMat);

  // B Site Crates & Car
  addBlock(-42, 1, -40, 3, 3, 3, crateWoodMat);
  addBlock(-42, 4, -40, 2.5, 2.5, 2.5, crateWoodMat);
  addBlock(-48, 1, -36, 2.8, 2.8, 5, crateWoodMat);
  addBlock(-35, 1, -45, 4, 2, 2, metalMat); // Car / Humvee proxy

  // B Doors & Window
  addBlock(-30, 0, -35, 2, 7, 12, wallMat);
  addBlock(-30, 0, -46, 2, 5, 8, wallMat); // B Window

  // B Site Decal / Marker
  const bSign = addBlock(-45, 1.1, -42, 4, 0.05, 4, siteSignMatB, true);
  bSign.name = 'SiteB_Marker';

  // 6. CT Spawn (North area: X = 0 to 10, Z = -45 to -55)
  addBlock(0, 0, -50, 25, 6, 2, darkWallMat);
  addBlock(12, 0, -42, 2, 6, 16, wallMat); // CT to A ramp wall
  addBlock(-12, 0, -42, 2, 6, 16, wallMat); // CT to B door wall

  // Crates scattered around Mid
  addBlock(8, 0, -10, 2.2, 2.2, 2.2, crateWoodMat);
  addBlock(-8, 0, 25, 2.5, 2.5, 2.5, crateWoodMat);

  // Decorative palm trees / street lamps / barrels
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.4 });
  for (let i = 0; i < 6; i++) {
    const barrelGeom = new THREE.CylinderGeometry(0.6, 0.6, 1.6, 16);
    const barrel = new THREE.Mesh(barrelGeom, barrelMat);
    barrel.position.set(20 + (i % 2) * 2, 0.8, -30 + Math.floor(i / 2) * 2);
    barrel.castShadow = true;
    group.add(barrel);
    obstacles.push(new THREE.Box3().setFromObject(barrel));
  }

  // Key Spawn Coordinates
  const tSpawn = new THREE.Vector3(0, 0, 52);
  const ctSpawn = new THREE.Vector3(0, 0, -45);

  const botSpawnsT = [
    new THREE.Vector3(-6, 0, 52),
    new THREE.Vector3(6, 0, 52),
    new THREE.Vector3(-12, 0, 50),
    new THREE.Vector3(12, 0, 50),
  ];

  const botSpawnsCT = [
    new THREE.Vector3(-6, 0, -45),
    new THREE.Vector3(6, 0, -45),
    new THREE.Vector3(-8, 0, -48),
    new THREE.Vector3(8, 0, -48),
  ];

  const siteA: BombSiteZone = {
    name: 'A',
    center: new THREE.Vector3(38, 2.5, -38),
    radius: 7.5,
  };

  const siteB: BombSiteZone = {
    name: 'B',
    center: new THREE.Vector3(-45, 1, -42),
    radius: 7.5,
  };

  // Strategic AI Navigation Waypoints
  const navPoints: THREE.Vector3[] = [
    tSpawn,
    new THREE.Vector3(0, 0, 30),     // T Mid
    new THREE.Vector3(0, 0, 0),      // Mid Doors
    new THREE.Vector3(0, 0, -25),    // CT Mid
    ctSpawn,
    new THREE.Vector3(38, 0, 40),    // Long Doors
    new THREE.Vector3(42, 0, 0),     // Long A
    new THREE.Vector3(38, 2.5, -38), // A Site
    new THREE.Vector3(-12, 3, -15),  // Catwalk
    new THREE.Vector3(20, 3, -30),   // A Short
    new THREE.Vector3(-45, 0, 25),   // B Tunnels Lower
    new THREE.Vector3(-45, 0, 0),    // B Tunnels Upper
    new THREE.Vector3(-45, 1, -42),  // B Site
    new THREE.Vector3(-30, 0, -35),  // B Doors
    new THREE.Vector3(0, 0, -45),    // CT Spawn
  ];

  return {
    scene: group,
    obstacles,
    tSpawn,
    ctSpawn,
    botSpawnsT,
    botSpawnsCT,
    siteA,
    siteB,
    navPoints,
  };
}
