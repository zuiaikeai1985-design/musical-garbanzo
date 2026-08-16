import { useEffect, useRef } from "react";
import * as THREE from "three";

export type HudState = {
  health: number;
  armor: number;
  ammo: number;
  reserve: number;
  kills: number;
  enemies: number;
  time: number;
  hit: boolean;
  headshot: boolean;
  reloading: boolean;
  damageDirection: number | null;
  enemyPositions: Array<{ x: number; z: number }>;
  playerPosition: { x: number; z: number; yaw: number };
};

type Props = {
  active: boolean;
  roundId: number;
  onHudChange: (hud: HudState) => void;
  onRoundEnd: (result: "victory" | "defeat") => void;
  onPause: () => void;
};

type Enemy = {
  group: THREE.Group;
  health: number;
  alive: boolean;
  phase: number;
  nextShot: number;
  speed: number;
};

const ARENA = 25;
const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.42;
const ROUND_SECONDS = 120;

const createBox = (
  scene: THREE.Scene,
  collisions: THREE.Box3[],
  position: [number, number, number],
  size: [number, number, number],
  color: number,
  roughness = 0.8,
) => {
  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.2,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  collisions.push(new THREE.Box3().setFromObject(mesh));
  return mesh;
};

const makeTextSprite = (text: string, color: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d")!;
  context.font = "900 48px Arial";
  context.textAlign = "center";
  context.fillStyle = color;
  context.fillText(text, 256, 74);
  const texture = new THREE.CanvasTexture(canvas);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true }),
  );
  sprite.scale.set(6, 1.5, 1);
  return sprite;
};

const createEnemy = (scene: THREE.Scene, x: number, z: number, index: number) => {
  const group = new THREE.Group();
  group.position.set(x, 0, z);

  const uniform = new THREE.MeshStandardMaterial({
    color: index % 2 ? 0x27312f : 0x303734,
    roughness: 0.9,
  });
  const vest = new THREE.MeshStandardMaterial({
    color: 0x111615,
    roughness: 0.75,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0xe14b2b,
    emissive: 0x481006,
    emissiveIntensity: 0.8,
  });

  const legs = [-0.2, 0.2].map((offset) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.78, 0.3), uniform);
    leg.position.set(offset, 0.39, 0);
    return leg;
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.42), uniform);
  body.position.y = 1.12;
  const armor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.58, 0.48), vest);
  armor.position.set(0, 1.15, 0);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.27, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xb98b69, roughness: 1 }),
  );
  head.position.y = 1.79;
  head.userData.headshot = true;
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.18), accent);
  mask.position.set(0, 1.81, -0.21);
  mask.userData.headshot = true;
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 1.15), vest);
  rifle.position.set(0.45, 1.19, -0.4);
  rifle.rotation.x = -0.08;

  const enemy: Enemy = {
    group,
    health: 100,
    alive: true,
    phase: index * 0.83,
    nextShot: 4 + index * 0.24,
    speed: 1.3 + (index % 3) * 0.12,
  };
  [...legs, body, armor, head, mask, rifle].forEach((part) => {
    part.castShadow = true;
    part.userData.enemy = enemy;
    group.add(part);
  });
  scene.add(group);
  return enemy;
};

const addTracer = (
  scene: THREE.Scene,
  start: THREE.Vector3,
  end: THREE.Vector3,
  color: number,
) => {
  const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
  });
  const line = new THREE.Line(geometry, material);
  scene.add(line);
  window.setTimeout(() => {
    scene.remove(line);
    geometry.dispose();
    material.dispose();
  }, 55);
};

export const GameCanvas = ({
  active,
  roundId,
  onHudChange,
  onRoundEnd,
  onPause,
}: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(active);
  const endRef = useRef(onRoundEnd);
  const pauseRef = useRef(onPause);
  const hudRef = useRef(onHudChange);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  useEffect(() => {
    endRef.current = onRoundEnd;
    pauseRef.current = onPause;
    hudRef.current = onHudChange;
  });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x88908c);
    scene.fog = new THREE.FogExp2(0x76807c, 0.018);
    const camera = new THREE.PerspectiveCamera(
      76,
      window.innerWidth / window.innerHeight,
      0.05,
      120,
    );
    camera.position.set(0, PLAYER_HEIGHT, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.id = "game-canvas";
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xc8d7d2, 0x242b29, 1.6);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff3d5, 3.2);
    sun.position.set(-12, 24, 9);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    scene.add(sun);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(ARENA * 2, ARENA * 2),
      new THREE.MeshStandardMaterial({
        color: 0x59615d,
        roughness: 0.97,
        metalness: 0.02,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(ARENA * 2, 25, 0x79817c, 0x666d69);
    grid.position.y = 0.012;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.26;
    scene.add(grid);

    const collisions: THREE.Box3[] = [];
    createBox(scene, collisions, [0, 2.2, -ARENA], [51, 4.4, 1], 0x303936);
    createBox(scene, collisions, [0, 2.2, ARENA], [51, 4.4, 1], 0x303936);
    createBox(scene, collisions, [-ARENA, 2.2, 0], [1, 4.4, 51], 0x303936);
    createBox(scene, collisions, [ARENA, 2.2, 0], [1, 4.4, 51], 0x303936);

    const coverData: Array<
      [[number, number, number], [number, number, number], number]
    > = [
      [[-12, 1.25, -12], [5, 2.5, 2.4], 0x384440],
      [[11, 1.25, -10], [6, 2.5, 2.4], 0x4b4f43],
      [[-13, 1.25, 9], [2.4, 2.5, 6], 0x4c4438],
      [[12, 1.25, 10], [2.4, 2.5, 6], 0x37443f],
      [[0, 1.15, 5], [5.5, 2.3, 1.2], 0x343b38],
      [[-5.5, 1.15, -2], [1.2, 2.3, 5.5], 0x343b38],
      [[6, 1.15, -2], [1.2, 2.3, 5.5], 0x343b38],
    ];
    coverData.forEach(([position, size, color], index) => {
      const box = createBox(scene, collisions, position, size, color);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(size[0] + 0.02, 0.12, size[2] + 0.02),
        new THREE.MeshStandardMaterial({
          color: index % 2 ? 0xd5a938 : 0xe65a35,
          emissive: index % 2 ? 0x3c2c05 : 0x401006,
        }),
      );
      stripe.position.set(position[0], position[1] + size[1] / 2 - 0.35, position[2]);
      scene.add(stripe);
      box.userData.cover = true;
    });

    const tower = createBox(scene, collisions, [0, 2.4, -11], [7, 4.8, 5], 0x27312f);
    const sign = makeTextSprite("SECTOR 07", "#e8b94b");
    sign.position.set(0, 3.1, -8.45);
    scene.add(sign);
    tower.userData.cover = true;

    for (let i = -2; i <= 2; i++) {
      const light = new THREE.PointLight(0xf0b844, 4, 8);
      light.position.set(i * 9, 3.2, -23.8);
      scene.add(light);
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.16, 0.12),
        new THREE.MeshBasicMaterial({ color: 0xffd265 }),
      );
      fixture.position.copy(light.position);
      scene.add(fixture);
    }

    const enemySpawns: Array<[number, number]> = [
      [-18, -17],
      [18, -17],
      [-19, 2],
      [19, 1],
      [-17, 17],
      [17, 17],
      [0, 10],
      [7, -18],
    ];
    const enemies = enemySpawns.map(([x, z], index) =>
      createEnemy(scene, x, z, index),
    );

    const weapon = new THREE.Group();
    weapon.position.set(0.34, -0.34, -0.63);
    const gunMetal = new THREE.MeshStandardMaterial({
      color: 0x171c1b,
      roughness: 0.36,
      metalness: 0.85,
    });
    const gunAccent = new THREE.MeshStandardMaterial({
      color: 0xb68b39,
      roughness: 0.52,
      metalness: 0.72,
    });
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.17, 0.72), gunMetal);
    receiver.position.z = -0.1;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.7, 10), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.72);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.13, 0.48), gunAccent);
    handguard.position.z = -0.48;
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.16), gunMetal);
    sight.position.set(0, 0.13, -0.16);
    weapon.add(receiver, barrel, handguard, sight);
    camera.add(weapon);
    scene.add(camera);

    const muzzle = new THREE.PointLight(0xffa52e, 0, 4);
    muzzle.position.set(0, 0.03, -1.08);
    weapon.add(muzzle);
    const muzzleDisc = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd36b }),
    );
    muzzleDisc.position.copy(muzzle.position);
    muzzleDisc.visible = false;
    weapon.add(muzzleDisc);

    const keys = new Set<string>();
    let yaw = 0;
    let pitch = 0;
    let health = 100;
    let armor = 50;
    let ammo = 30;
    let reserve = 90;
    let kills = 0;
    let reloading = false;
    let reloadEnds = 0;
    let roundStart = performance.now();
    let lastFrame = performance.now();
    let lastShot = 0;
    let lastHud = 0;
    let hitUntil = 0;
    let headshotUntil = 0;
    let damageDirection: number | null = null;
    let damageUntil = 0;
    let recoil = 0;
    let ended = false;
    let audioContext: AudioContext | null = null;
    const raycaster = new THREE.Raycaster();
    const clockDirection = new THREE.Vector3();
    const moveVector = new THREE.Vector3();
    const proposed = new THREE.Vector3();

    const playSound = (frequency: number, duration: number, gain: number) => {
      audioContext ??= new AudioContext();
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, frequency * 0.25),
        audioContext.currentTime + duration,
      );
      volume.gain.setValueAtTime(gain, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(
        0.001,
        audioContext.currentTime + duration,
      );
      oscillator.connect(volume).connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration);
    };

    const collides = (position: THREE.Vector3) =>
      collisions.some(
        (box) =>
          position.x + PLAYER_RADIUS > box.min.x &&
          position.x - PLAYER_RADIUS < box.max.x &&
          position.z + PLAYER_RADIUS > box.min.z &&
          position.z - PLAYER_RADIUS < box.max.z,
      );

    const startReload = () => {
      if (reloading || ammo === 30 || reserve === 0) return;
      reloading = true;
      reloadEnds = performance.now() + 1700;
      playSound(120, 0.12, 0.025);
    };

    const shoot = () => {
      const now = performance.now();
      if (!activeRef.current || reloading || now - lastShot < 105 || ended) return;
      if (ammo <= 0) {
        startReload();
        return;
      }
      lastShot = now;
      ammo -= 1;
      recoil = Math.min(recoil + 0.035, 0.1);
      muzzle.intensity = 16;
      muzzleDisc.visible = true;
      window.setTimeout(() => {
        muzzle.intensity = 0;
        muzzleDisc.visible = false;
      }, 42);
      playSound(105, 0.09, 0.11);

      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const liveTargets = enemies.flatMap((enemy) =>
        enemy.alive ? enemy.group.children : [],
      );
      const intersections = raycaster.intersectObjects(liveTargets, false);
      const impact = intersections[0];
      const farPoint = raycaster.ray.at(70, new THREE.Vector3());
      addTracer(
        scene,
        camera.localToWorld(new THREE.Vector3(0.34, -0.26, -0.95)),
        impact?.point ?? farPoint,
        0xffd58a,
      );

      if (impact) {
        const enemy = impact.object.userData.enemy as Enemy | undefined;
        if (enemy?.alive) {
          const isHeadshot = Boolean(impact.object.userData.headshot);
          enemy.health -= isHeadshot ? 72 : 36;
          hitUntil = now + 120;
          headshotUntil = isHeadshot ? now + 180 : 0;
          playSound(isHeadshot ? 880 : 520, 0.045, 0.035);
          if (enemy.health <= 0) {
            enemy.alive = false;
            kills += 1;
            enemy.group.rotation.z = -Math.PI / 2;
            enemy.group.position.y = 0.35;
            enemy.group.traverse((object) => {
              object.userData.enemy = undefined;
            });
            window.setTimeout(() => {
              enemy.group.visible = false;
            }, 800);
          }
        }
      }
      if (ammo === 0) window.setTimeout(startReload, 220);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      keys.add(event.code);
      if (event.code === "KeyR") startReload();
      if (event.code === "Escape" && activeRef.current) pauseRef.current();
    };
    const onKeyUp = (event: KeyboardEvent) => keys.delete(event.code);
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement || !activeRef.current) return;
      yaw -= event.movementX * 0.0021;
      pitch -= event.movementY * 0.0021;
      pitch = THREE.MathUtils.clamp(pitch, -1.35, 1.35);
    };
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 0) shoot();
    };
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("resize", onResize);

    let animationFrame = 0;
    const animate = (now: number) => {
      animationFrame = requestAnimationFrame(animate);
      const dt = Math.min((now - lastFrame) / 1000, 0.04);
      lastFrame = now;
      const elapsed = (now - roundStart) / 1000;
      const time = Math.max(0, ROUND_SECONDS - elapsed);

      if (activeRef.current && !ended) {
        if (reloading && now >= reloadEnds) {
          const needed = 30 - ammo;
          const loaded = Math.min(needed, reserve);
          ammo += loaded;
          reserve -= loaded;
          reloading = false;
          playSound(180, 0.06, 0.02);
        }

        const forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
        const strafe = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
        moveVector.set(strafe, 0, -forward).normalize();
        moveVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const speed = keys.has("ShiftLeft") ? 3.3 : 5.7;
        proposed.copy(camera.position);
        proposed.x += moveVector.x * speed * dt;
        if (!collides(proposed)) camera.position.x = proposed.x;
        proposed.copy(camera.position);
        proposed.z += moveVector.z * speed * dt;
        if (!collides(proposed)) camera.position.z = proposed.z;
        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -23.8, 23.8);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -23.8, 23.8);

        const bob = moveVector.lengthSq() > 0 ? Math.sin(now * 0.012) * 0.018 : 0;
        camera.position.y = PLAYER_HEIGHT + bob;
        pitch += recoil;
        recoil *= 0.72;
        camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ"));
        weapon.position.y = -0.34 - bob * 0.8;
        weapon.rotation.x = -recoil * 2.5;

        enemies.forEach((enemy) => {
          if (!enemy.alive) return;
          clockDirection.copy(camera.position).sub(enemy.group.position);
          clockDirection.y = 0;
          const distance = clockDirection.length();
          clockDirection.normalize();
          const strafeAmount = Math.sin(now * 0.0014 + enemy.phase) * 0.8;
          const enemyMove = new THREE.Vector3(
            clockDirection.x + clockDirection.z * strafeAmount,
            0,
            clockDirection.z - clockDirection.x * strafeAmount,
          ).normalize();
          if (distance > 7.5) {
            const next = enemy.group.position
              .clone()
              .addScaledVector(enemyMove, enemy.speed * dt);
            const blocked = collisions.some((box) => box.containsPoint(next));
            if (!blocked) enemy.group.position.copy(next);
          }
          enemy.group.lookAt(camera.position.x, enemy.group.position.y, camera.position.z);

          if (distance < 21 && elapsed > enemy.nextShot) {
            enemy.nextShot = elapsed + 1.55 + Math.random() * 1.3;
            const accuracy = THREE.MathUtils.clamp(0.58 - distance / 45, 0.12, 0.44);
            const hit = Math.random() < accuracy;
            const start = enemy.group.localToWorld(new THREE.Vector3(0.45, 1.2, -1));
            const end = hit
              ? camera.position.clone()
              : camera.position
                  .clone()
                  .add(new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2, 0));
            addTracer(scene, start, end, 0xff5a30);
            playSound(78, 0.07, 0.018);
            if (hit) {
              const rawDamage = 4 + Math.floor(Math.random() * 5);
              const absorbed = Math.min(armor, Math.ceil(rawDamage * 0.45));
              armor -= absorbed;
              health -= rawDamage - absorbed;
              damageDirection = Math.atan2(
                enemy.group.position.x - camera.position.x,
                enemy.group.position.z - camera.position.z,
              );
              damageUntil = now + 280;
            }
          }
        });

        if (health <= 0 || time <= 0) {
          ended = true;
          document.exitPointerLock?.();
          endRef.current("defeat");
        } else if (kills === enemies.length) {
          ended = true;
          document.exitPointerLock?.();
          endRef.current("victory");
        }
      } else {
        roundStart += dt * 1000;
      }

      if (now - lastHud > 70) {
        lastHud = now;
        hudRef.current({
          health: Math.max(0, health),
          armor,
          ammo,
          reserve,
          kills,
          enemies: enemies.length - kills,
          time,
          hit: now < hitUntil,
          headshot: now < headshotUntil,
          reloading,
          damageDirection: now < damageUntil ? damageDirection : null,
          enemyPositions: enemies
            .filter((enemy) => enemy.alive)
            .map((enemy) => ({
              x: enemy.group.position.x,
              z: enemy.group.position.z,
            })),
          playerPosition: { x: camera.position.x, z: camera.position.z, yaw },
        });
      }

      renderer.render(scene, camera);
    };
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      mount.removeChild(renderer.domElement);
    };
  }, [roundId]);

  return <div className="game-mount" ref={mountRef} aria-hidden="true" />;
};
