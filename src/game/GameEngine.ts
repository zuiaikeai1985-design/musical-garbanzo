import * as THREE from 'three';
import {
  BombState,
  GameState,
  KillfeedEntry,
  PlayerStats,
  ScoreboardPlayer,
  Team,
  WeaponSlotState,
  WeaponType,
} from './types';
import { WEAPONS } from './weapons';
import { buildDust2Map, MapData } from './MapBuilder';
import { WeaponModelBuilder } from './WeaponModelBuilder';
import { ParticleSystem } from './ParticleSystem';
import { Bot } from './Bot';
import { soundManager } from './SoundManager';

export interface GameEngineEvents {
  onStatsChange: (stats: PlayerStats) => void;
  onWeaponChange: (slot: WeaponSlotState, activeSlot: number) => void;
  onGameStateChange: (state: GameState, roundTimer: number, scoreCT: number, scoreT: number) => void;
  onKillfeed: (entry: KillfeedEntry) => void;
  onScoreboardChange: (players: ScoreboardPlayer[]) => void;
  onBombStateChange: (state: BombState) => void;
  onScopeChange: (isScoped: boolean) => void;
  onFlashbang: (intensity: number) => void;
  onMessage: (msg: string) => void;
}

export class GameEngine {
  private container: HTMLElement;
  private events: GameEngineEvents;

  // Three.js Core
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private mapData: MapData;
  private particles: ParticleSystem;

  // Player State
  public playerTeam: Team = 'CT';
  public playerStats: PlayerStats = {
    health: 100,
    maxHealth: 100,
    armor: 100,
    hasHelmet: true,
    money: 16000,
    kills: 0,
    deaths: 0,
    assists: 0,
    score: 0,
    hasDefuseKit: true,
  };

  // Inventory slots: 0 = primary, 1 = secondary, 2 = melee, 3 = grenade/c4
  public inventory: (WeaponSlotState | null)[] = [
    { config: WEAPONS.m4a1, currentAmmo: 30, reserveAmmo: 90 },
    { config: WEAPONS.deagle, currentAmmo: 7, reserveAmmo: 35 },
    { config: WEAPONS.knife, currentAmmo: 0, reserveAmmo: 0 },
    { config: WEAPONS.hegrenade, currentAmmo: 1, reserveAmmo: 0 },
  ];
  public activeSlotIndex: number = 0;

  // FPS Controller & Camera
  public playerPos: THREE.Vector3 = new THREE.Vector3(0, 1.7, -45);
  public playerVel: THREE.Vector3 = new THREE.Vector3();
  public pitch: number = 0; // Look up/down
  public yaw: number = 0;   // Look left/right
  public isGrounded: boolean = true;
  public isCrouching: boolean = false;
  public isScoped: boolean = false;

  // Input states
  private keys: Record<string, boolean> = {};
  public isPointerLocked: boolean = false;
  private isMouseDown: boolean = false;

  // Gun animation & recoil
  private gunPivot: THREE.Group;
  private currentGunMesh: THREE.Group | null = null;
  private recoilOffset: THREE.Vector3 = new THREE.Vector3();
  private recoilRotation: THREE.Euler = new THREE.Euler();
  private shootCooldown: number = 0;
  private isReloading: boolean = false;
  private reloadTimer: number = 0;
  private bobTimer: number = 0;

  // Game Loop & Match State
  private animationFrameId: number | null = null;
  private lastTime: number = 0;
  public gameState: GameState = 'in_round';
  public roundTimeRemaining: number = 115;
  public scoreCT: number = 0;
  public scoreT: number = 0;
  public currentRound: number = 1;

  // C4 & Objectives
  public bombState: BombState = {
    isPlanted: false,
    isDefused: false,
    isExploded: false,
    defuseProgress: 0,
    plantProgress: 0,
  };
  private bombMesh: THREE.Group | null = null;
  private bombBeepTimer: number = 0;

  // AI Bots
  public bots: Bot[] = [];

  // Decals & Projectiles
  private activeGrenades: {
    mesh: THREE.Mesh;
    pos: THREE.Vector3;
    vel: THREE.Vector3;
    life: number;
    type: WeaponType;
  }[] = [];

  constructor(container: HTMLElement, events: GameEngineEvents) {
    this.container = container;
    this.events = events;

    // 1. Setup Three.js Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.scene.fog = new THREE.FogExp2(0xd6c29b, 0.008);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.position.copy(this.playerPos);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 2. Lighting (Sunlight & Ambient CS desert ambience)
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffedd5, 1.2);
    dirLight.position.set(50, 80, 40);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 250;
    dirLight.shadow.camera.left = -80;
    dirLight.shadow.camera.right = 80;
    dirLight.shadow.camera.top = 80;
    dirLight.shadow.camera.bottom = -80;
    this.scene.add(dirLight);

    // 3. Map & Particles
    this.mapData = buildDust2Map();
    this.scene.add(this.mapData.scene);

    this.particles = new ParticleSystem();
    this.scene.add(this.particles.getGroup());

    // 4. Gun Viewmodel Attached to Camera
    this.gunPivot = new THREE.Group();
    this.camera.add(this.gunPivot);
    this.scene.add(this.camera);

    this.updateHeldWeaponMesh();

    // 5. Initialize Bots
    this.initBots();

    // 6. Setup Event Listeners
    this.bindEvents();

    // 7. Start Loop
    this.startRound();
    this.lastTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  public setTeam(team: Team) {
    this.playerTeam = team;
    if (team === 'CT') {
      this.inventory[0] = { config: WEAPONS.m4a1, currentAmmo: 30, reserveAmmo: 90 };
      this.inventory[1] = { config: WEAPONS.deagle, currentAmmo: 7, reserveAmmo: 35 };
      this.playerStats.hasDefuseKit = true;
    } else {
      this.inventory[0] = { config: WEAPONS.ak47, currentAmmo: 30, reserveAmmo: 90 };
      this.inventory[1] = { config: WEAPONS.glock, currentAmmo: 20, reserveAmmo: 120 };
      this.inventory[3] = { config: WEAPONS.c4, currentAmmo: 1, reserveAmmo: 0 };
      this.playerStats.hasDefuseKit = false;
    }
    this.activeSlotIndex = 0;
    this.updateHeldWeaponMesh();
    this.initBots();
    this.startRound();
  }

  private initBots() {
    // Clear old bot meshes
    for (const b of this.bots) {
      this.scene.remove(b.mesh);
    }
    this.bots = [];

    const isCT = this.playerTeam === 'CT';
    // If player is CT: 4 CT bots + 5 T bots. If player is T: 4 T bots + 5 CT bots
    const ctCount = isCT ? 4 : 5;
    const tCount = isCT ? 5 : 4;

    const namesCT = ['Ghost', 'Viper', 'Bravo-1', 'Seal-6', 'SAS-John'];
    const namesT = ['Phoenix', 'Leet-Krew', 'Balkan-Yuri', 'Anarchist', 'Rebel-T'];

    // Spawn CT Bots
    for (let i = 0; i < ctCount; i++) {
      const spawn = this.mapData.botSpawnsCT[i % this.mapData.botSpawnsCT.length].clone();
      spawn.x += (Math.random() - 0.5) * 4;
      const bot = new Bot(
        `bot_ct_${i}`,
        `[BOT] ${namesCT[i % namesCT.length]}`,
        'CT',
        spawn,
        i % 2 === 0 ? 'm4a1' : 'mp5'
      );
      this.bots.push(bot);
      this.scene.add(bot.mesh);
    }

    // Spawn T Bots
    for (let i = 0; i < tCount; i++) {
      const spawn = this.mapData.botSpawnsT[i % this.mapData.botSpawnsT.length].clone();
      spawn.x += (Math.random() - 0.5) * 4;
      const bot = new Bot(
        `bot_t_${i}`,
        `[BOT] ${namesT[i % namesT.length]}`,
        'T',
        spawn,
        i % 2 === 0 ? 'ak47' : (i === 1 ? 'awp' : 'glock')
      );
      this.bots.push(bot);
      this.scene.add(bot.mesh);
    }

    this.notifyScoreboard();
  }

  public startRound() {
    this.gameState = 'in_round';
    this.roundTimeRemaining = 115;
    this.bombState = {
      isPlanted: false,
      isDefused: false,
      isExploded: false,
      defuseProgress: 0,
      plantProgress: 0,
    };

    if (this.bombMesh) {
      this.scene.remove(this.bombMesh);
      this.bombMesh = null;
    }

    // Reset Player
    const spawn = this.playerTeam === 'CT' ? this.mapData.ctSpawn : this.mapData.tSpawn;
    this.playerPos.copy(spawn);
    this.playerPos.y = 1.7;
    this.playerVel.set(0, 0, 0);
    this.playerStats.health = 100;
    this.playerStats.armor = 100;
    this.isScoped = false;
    this.isReloading = false;
    this.events.onScopeChange(false);

    // Refill ammo
    for (const slot of this.inventory) {
      if (slot) {
        slot.currentAmmo = slot.config.magazineSize;
        slot.reserveAmmo = slot.config.reserveAmmo;
      }
    }

    // Reset Bots
    for (const bot of this.bots) {
      const botSpawn =
        bot.team === 'CT'
          ? this.mapData.botSpawnsCT[Math.floor(Math.random() * this.mapData.botSpawnsCT.length)]
          : this.mapData.botSpawnsT[Math.floor(Math.random() * this.mapData.botSpawnsT.length)];
      bot.reset(botSpawn);
    }

    this.particles.clear();
    soundManager.playRadio('go_go_go');

    this.notifyAll();
  }

  public buyItem(itemId: string): boolean {
    const buyItem = WEAPONS[itemId];
    if (itemId === 'kevlar') {
      if (this.playerStats.money >= 650) {
        this.playerStats.money -= 650;
        this.playerStats.armor = 100;
        soundManager.playBuySuccess();
        this.notifyAll();
        return true;
      }
      return false;
    }
    if (itemId === 'helmet') {
      if (this.playerStats.money >= 1000) {
        this.playerStats.money -= 1000;
        this.playerStats.armor = 100;
        this.playerStats.hasHelmet = true;
        soundManager.playBuySuccess();
        this.notifyAll();
        return true;
      }
      return false;
    }
    if (itemId === 'defuser') {
      if (this.playerTeam === 'CT' && this.playerStats.money >= 400) {
        this.playerStats.money -= 400;
        this.playerStats.hasDefuseKit = true;
        soundManager.playBuySuccess();
        this.notifyAll();
        return true;
      }
      return false;
    }

    if (!buyItem) return false;
    if (this.playerStats.money < buyItem.price) return false;

    this.playerStats.money -= buyItem.price;

    const newSlot: WeaponSlotState = {
      config: buyItem,
      currentAmmo: buyItem.magazineSize,
      reserveAmmo: buyItem.reserveAmmo,
    };

    if (buyItem.category === 'rifle' || buyItem.category === 'sniper' || buyItem.category === 'smg') {
      this.inventory[0] = newSlot;
      this.activeSlotIndex = 0;
    } else if (buyItem.category === 'pistol') {
      this.inventory[1] = newSlot;
      this.activeSlotIndex = 1;
    } else if (buyItem.category === 'grenade') {
      this.inventory[3] = newSlot;
      this.activeSlotIndex = 3;
    }

    soundManager.playBuySuccess();
    this.updateHeldWeaponMesh();
    this.notifyAll();
    return true;
  }

  public selectSlot(slotIndex: number) {
    if (slotIndex < 0 || slotIndex >= this.inventory.length) return;
    if (!this.inventory[slotIndex]) return;

    this.activeSlotIndex = slotIndex;
    this.isReloading = false;
    if (this.isScoped) {
      this.isScoped = false;
      this.camera.fov = 75;
      this.camera.updateProjectionMatrix();
      this.events.onScopeChange(false);
    }
    this.updateHeldWeaponMesh();
    this.notifyWeapon();
  }

  private updateHeldWeaponMesh() {
    if (this.currentGunMesh) {
      this.gunPivot.remove(this.currentGunMesh);
    }

    const currentSlot = this.inventory[this.activeSlotIndex];
    if (!currentSlot) return;

    this.currentGunMesh = WeaponModelBuilder.createWeaponModel(currentSlot.config.id);

    // Viewmodel Positioning (Classic right-handed FPS weapon view)
    this.currentGunMesh.position.set(0.22, -0.22, -0.42);
    this.currentGunMesh.rotation.set(0, Math.PI, 0);

    this.gunPivot.add(this.currentGunMesh);
  }

  // --- Input & Controls ---
  private bindEvents() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      // Slot Quick Switching
      if (e.code === 'Digit1') this.selectSlot(0);
      if (e.code === 'Digit2') this.selectSlot(1);
      if (e.code === 'Digit3') this.selectSlot(2);
      if (e.code === 'Digit4') this.selectSlot(3);
      if (e.code === 'Digit5' && this.inventory[3]?.config.id === 'c4') this.selectSlot(3);

      // Reload
      if (e.code === 'KeyR') {
        this.reload();
      }

      // Drop C4 or weapon (G key)
      if (e.code === 'KeyG') {
        // Drop logic
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.container.addEventListener('mousedown', (e) => {
      if (!this.isPointerLocked) {
        this.container.requestPointerLock();
        return;
      }

      if (e.button === 0) {
        this.isMouseDown = true;
        this.handleFirePress();
      } else if (e.button === 2) {
        // Right Click: Scope or alternate fire
        this.handleSecondaryFire();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isMouseDown = false;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.container;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isPointerLocked) return;

      const sens = this.isScoped ? 0.001 : 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;

      // Clamp Pitch to avoid flipping upside down
      this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Prevent context menu on right-click
    this.container.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private handleSecondaryFire() {
    const current = this.inventory[this.activeSlotIndex];
    if (!current) return;

    if (current.config.hasScope) {
      this.isScoped = !this.isScoped;
      this.camera.fov = this.isScoped ? 75 / (current.config.scopeMagnification || 4) : 75;
      this.camera.updateProjectionMatrix();
      this.events.onScopeChange(this.isScoped);
      if (this.currentGunMesh) {
        this.currentGunMesh.visible = !this.isScoped;
      }
    }
  }

  private handleFirePress() {
    const current = this.inventory[this.activeSlotIndex];
    if (!current) return;

    if (current.config.category === 'grenade') {
      this.throwGrenade(current.config.id);
      return;
    }

    if (current.config.category === 'melee') {
      this.performKnifeAttack();
      return;
    }

    this.fireWeapon();
  }

  public fireWeapon() {
    const current = this.inventory[this.activeSlotIndex];
    if (!current || this.isReloading) return;

    if (current.currentAmmo <= 0) {
      this.reload();
      return;
    }

    if (this.shootCooldown > 0) return;

    current.currentAmmo--;
    this.shootCooldown = 1.0 / current.config.fireRate;

    // Play synthesized sound
    soundManager.playGunShot(current.config.id);

    // Gun kickback animation
    this.recoilOffset.z = 0.08;
    this.recoilOffset.y = 0.02;
    this.recoilRotation.x = 0.06;

    // View recoil
    this.pitch += current.config.recoilVertical * (this.isCrouching ? 0.6 : 1.0);
    this.yaw += (Math.random() - 0.5) * current.config.recoilHorizontal;

    // Muzzle Flash
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const muzzlePos = this.camera.position.clone().addScaledVector(forward, 0.6).add(new THREE.Vector3(0.12, -0.1, 0));
    this.particles.emitMuzzleFlash(muzzlePos, forward);

    // Bullet Raycast Hitscan
    this.performHitscan(current.config.damage, current.config.spread, current.config.range);

    this.notifyWeapon();
  }

  private performKnifeAttack() {
    if (this.shootCooldown > 0) return;
    this.shootCooldown = 0.45;

    soundManager.playKnifeSlash();
    this.recoilRotation.z = -0.4;
    this.recoilOffset.z = 0.12;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const raycaster = new THREE.Raycaster(this.camera.position, forward, 0.1, 2.8);
    const botMeshes = this.bots.filter(b => b.isAlive).map(b => b.mesh);
    const intersects = raycaster.intersectObjects(botMeshes, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const bot = this.findBotFromObject(hit.object);
      if (bot && bot.isAlive && bot.team !== this.playerTeam) {
        // Backstab detection
        const botForward = new THREE.Vector3(Math.sin(bot.rotationY), 0, Math.cos(bot.rotationY));
        const isBackstab = forward.dot(botForward) > 0.4;
        const damage = isBackstab ? 180 : 55;

        const result = bot.takeDamage(damage, false);
        this.particles.emitHitEffect(hit.point, hit.face?.normal || new THREE.Vector3(0, 1, 0), true);
        soundManager.playHitSound(false);

        if (result.died) {
          this.handleKill(bot, 'knife', false);
        }
      }
    }
  }

  private throwGrenade(type: WeaponType) {
    const current = this.inventory[this.activeSlotIndex];
    if (!current || current.currentAmmo <= 0) return;

    current.currentAmmo--;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    const geom = new THREE.SphereGeometry(0.1, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(this.camera.position).addScaledVector(forward, 0.8);
    this.scene.add(mesh);

    const vel = forward.clone().multiplyScalar(22).add(this.playerVel.clone().multiplyScalar(0.5));
    vel.y += 3.5;

    this.activeGrenades.push({
      mesh,
      pos: mesh.position,
      vel,
      life: 2.2, // 2.2 sec fuse
      type,
    });

    // Switch to knife or rifle after throw
    setTimeout(() => {
      this.selectSlot(0);
    }, 300);

    this.notifyWeapon();
  }

  private performHitscan(baseDamage: number, spread: number, range: number) {
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);

    // Apply movement & stance spread
    let actualSpread = spread;
    if (this.playerVel.length() > 1.0) actualSpread *= 2.5;
    if (this.isCrouching) actualSpread *= 0.6;
    if (this.isScoped) actualSpread *= 0.05;

    const spreadX = (Math.random() - 0.5) * actualSpread;
    const spreadY = (Math.random() - 0.5) * actualSpread;
    const dir = forward.clone().add(new THREE.Vector3(spreadX, spreadY, spreadX)).normalize();

    const raycaster = new THREE.Raycaster(this.camera.position, dir, 0.1, range);

    // Objects to test: Map meshes and Bot meshes
    const botMeshes = this.bots.filter(b => b.isAlive).map(b => b.mesh);
    const intersects = raycaster.intersectObjects([...botMeshes, this.mapData.scene], true);

    const endPoint = this.camera.position.clone().addScaledVector(dir, range);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const bot = this.findBotFromObject(hit.object);

      if (bot && bot.isAlive && bot.team !== this.playerTeam) {
        const isHeadshot = hit.object.name === 'head' || hit.point.y - bot.position.y > 1.4;
        const result = bot.takeDamage(baseDamage, isHeadshot);

        this.particles.emitHitEffect(hit.point, hit.face?.normal || new THREE.Vector3(0, 1, 0), true);
        soundManager.playHitSound(isHeadshot);

        if (result.died) {
          this.handleKill(bot, this.inventory[this.activeSlotIndex]?.config.id || 'ak47', isHeadshot);
        }
      } else {
        // Hit wall / obstacle
        this.particles.emitHitEffect(hit.point, hit.face?.normal || new THREE.Vector3(0, 1, 0), false);
      }

      this.particles.addTracer(this.camera.position.clone().add(new THREE.Vector3(0.15, -0.1, 0.3)), hit.point);
    } else {
      this.particles.addTracer(this.camera.position.clone().add(new THREE.Vector3(0.15, -0.1, 0.3)), endPoint);
    }
  }

  private handleKill(bot: Bot, weapon: WeaponType, isHeadshot: boolean) {
    this.playerStats.kills++;
    this.playerStats.score += 2;
    const reward = WEAPONS[weapon]?.killReward || 300;
    this.playerStats.money += reward;

    const entry: KillfeedEntry = {
      id: Math.random().toString(),
      killer: 'Player (You)',
      killerTeam: this.playerTeam,
      victim: bot.name,
      victimTeam: bot.team,
      weapon,
      isHeadshot,
      wallbang: false,
      timestamp: Date.now(),
    };

    this.events.onKillfeed(entry);
    this.events.onMessage(`+ $${reward} 击杀奖励!`);
    this.notifyAll();

    this.checkRoundEndCondition();
  }

  public reload() {
    const current = this.inventory[this.activeSlotIndex];
    if (!current || this.isReloading) return;
    if (current.currentAmmo === current.config.magazineSize) return;
    if (current.reserveAmmo <= 0) return;

    this.isReloading = true;
    this.reloadTimer = current.config.reloadTime;
    soundManager.playReload();

    // Weapon drop animation during reload
    this.recoilOffset.y = -0.15;
    this.recoilRotation.x = -0.35;
  }

  private findBotFromObject(obj: THREE.Object3D): Bot | null {
    let curr: THREE.Object3D | null = obj;
    while (curr) {
      const match = this.bots.find(b => b.mesh === curr);
      if (match) return match;
      curr = curr.parent;
    }
    return null;
  }

  // --- Main Update Loop ---
  private loop(time: number) {
    const delta = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.updatePhysics(delta);
    this.updateGuns(delta);
    this.updateBots(delta);
    this.updateObjectives(delta);
    this.updateGrenades(delta);
    this.particles.update(delta);

    // Render Scene
    this.renderer.render(this.scene, this.camera);

    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  private updatePhysics(delta: number) {
    // 1. Camera Rotation
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // 2. Movement direction vectors
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).negate();
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3();
    if (this.keys['KeyW']) moveDir.add(forward);
    if (this.keys['KeyS']) moveDir.sub(forward);
    if (this.keys['KeyD']) moveDir.add(right);
    if (this.keys['KeyA']) moveDir.sub(right);

    const isMoving = moveDir.lengthSq() > 0.001;
    if (isMoving) moveDir.normalize();

    this.isCrouching = !!this.keys['ControlLeft'] || !!this.keys['KeyC'];

    // Speed calculation
    const currentWeapon = this.inventory[this.activeSlotIndex]?.config;
    let baseSpeed = 6.2 * (currentWeapon?.speedMultiplier || 1.0);
    if (this.isCrouching) baseSpeed *= 0.45;
    if (this.isScoped) baseSpeed *= 0.4;

    // Acceleration & Friction
    if (isMoving) {
      this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, moveDir.x * baseSpeed, delta * 12);
      this.playerVel.z = THREE.MathUtils.lerp(this.playerVel.z, moveDir.z * baseSpeed, delta * 12);

      // Footstep sound & View bobbing
      this.bobTimer += delta * (this.isCrouching ? 6 : 11);
      if (Math.sin(this.bobTimer) > 0.95 && this.isGrounded) {
        soundManager.playFootstep();
      }
    } else {
      this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, 0, delta * 14);
      this.playerVel.z = THREE.MathUtils.lerp(this.playerVel.z, 0, delta * 14);
    }

    // Jump & Gravity
    if (this.keys['Space'] && this.isGrounded) {
      this.playerVel.y = 5.8;
      this.isGrounded = false;
    }

    this.playerVel.y -= 18.0 * delta; // Gravity

    // Calculate next proposed position
    const nextPos = this.playerPos.clone().addScaledVector(this.playerVel, delta);

    // Obstacle Collision Detection (AABB bounding box)
    const playerHeight = this.isCrouching ? 1.1 : 1.75;
    const playerBox = new THREE.Box3(
      new THREE.Vector3(nextPos.x - 0.35, nextPos.y - playerHeight, nextPos.z - 0.35),
      new THREE.Vector3(nextPos.x + 0.35, nextPos.y + 0.1, nextPos.z + 0.35)
    );

    let collidedX = false;
    let collidedZ = false;

    for (const obs of this.mapData.obstacles) {
      if (obs.intersectsBox(playerBox)) {
        // Resolve axis collision
        const testX = new THREE.Box3(
          new THREE.Vector3(nextPos.x - 0.35, this.playerPos.y - playerHeight, this.playerPos.z - 0.35),
          new THREE.Vector3(nextPos.x + 0.35, this.playerPos.y + 0.1, this.playerPos.z + 0.35)
        );
        if (obs.intersectsBox(testX)) collidedX = true;

        const testZ = new THREE.Box3(
          new THREE.Vector3(this.playerPos.x - 0.35, this.playerPos.y - playerHeight, nextPos.z - 0.35),
          new THREE.Vector3(this.playerPos.x + 0.35, this.playerPos.y + 0.1, nextPos.z + 0.35)
        );
        if (obs.intersectsBox(testZ)) collidedZ = true;
      }
    }

    if (!collidedX) this.playerPos.x = nextPos.x;
    if (!collidedZ) this.playerPos.z = nextPos.z;

    // Ground floor collision
    if (this.playerPos.y + this.playerVel.y * delta <= playerHeight) {
      this.playerPos.y = playerHeight;
      this.playerVel.y = 0;
      this.isGrounded = true;
    } else {
      this.playerPos.y += this.playerVel.y * delta;
    }

    // Update camera position
    const bobOffset = isMoving && this.isGrounded ? Math.sin(this.bobTimer) * 0.03 : 0;
    this.camera.position.set(this.playerPos.x, this.playerPos.y + bobOffset, this.playerPos.z);
  }

  private updateGuns(delta: number) {
    this.shootCooldown = Math.max(0, this.shootCooldown - delta);

    // Continuous fire (Full-auto spray like AK47 / M4 / MP5)
    if (this.isMouseDown && this.isPointerLocked) {
      const current = this.inventory[this.activeSlotIndex];
      if (current && (current.config.category === 'rifle' || current.config.category === 'smg')) {
        this.fireWeapon();
      }
    }

    // Reload completion
    if (this.isReloading) {
      this.reloadTimer -= delta;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        const current = this.inventory[this.activeSlotIndex];
        if (current) {
          const needed = current.config.magazineSize - current.currentAmmo;
          const toAdd = Math.min(needed, current.reserveAmmo);
          current.currentAmmo += toAdd;
          current.reserveAmmo -= toAdd;
          this.notifyWeapon();
        }
      }
    }

    // Smooth recoil recovery
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 10);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, delta * 12);
    this.recoilRotation.z = THREE.MathUtils.lerp(this.recoilRotation.z, 0, delta * 12);

    if (this.currentGunMesh) {
      this.currentGunMesh.position.set(
        0.22 + this.recoilOffset.x,
        -0.22 + this.recoilOffset.y,
        -0.42 + this.recoilOffset.z
      );
      this.currentGunMesh.rotation.set(
        this.recoilRotation.x,
        Math.PI + this.recoilRotation.y,
        this.recoilRotation.z
      );
    }
  }

  private updateBots(delta: number) {
    const potentialTargets = [
      {
        position: this.camera.position,
        isPlayer: true,
        team: this.playerTeam,
      },
      ...this.bots.map(b => ({
        position: b.position,
        isPlayer: false,
        botId: b.id,
        team: b.team,
      })),
    ];

    for (const bot of this.bots) {
      bot.update(
        delta,
        this.mapData.navPoints,
        potentialTargets,
        this.mapData.obstacles,
        this.bombState,
        (firingBot, targetPos) => {
          this.handleBotFire(firingBot, targetPos);
        }
      );
    }
  }

  private handleBotFire(bot: Bot, targetPos: THREE.Vector3) {
    soundManager.playGunShot(bot.weapon);

    const botEyePos = bot.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const dir = targetPos.clone().sub(botEyePos).normalize();

    this.particles.emitMuzzleFlash(botEyePos, dir);

    // Test if hit player
    const distToPlayer = bot.position.distanceTo(this.playerPos);
    const toPlayer = this.camera.position.clone().sub(botEyePos).normalize();
    const dot = dir.dot(toPlayer);

    if (bot.team !== this.playerTeam && dot > 0.94 && distToPlayer < 45) {
      // Player takes damage
      const weaponConf = WEAPONS[bot.weapon];
      const damage = weaponConf ? weaponConf.damage * 0.75 : 20;
      this.takePlayerDamage(damage, bot.name, bot.team, bot.weapon);
      this.particles.emitHitEffect(this.camera.position, new THREE.Vector3(0, 1, 0), true);
    } else {
      // Check bot vs bot
      for (const targetBot of this.bots) {
        if (targetBot.id !== bot.id && targetBot.isAlive && targetBot.team !== bot.team) {
          const dist = bot.position.distanceTo(targetBot.position);
          const toBot = targetBot.position.clone().add(new THREE.Vector3(0, 1.2, 0)).sub(botEyePos).normalize();
          if (dir.dot(toBot) > 0.92 && dist < 40) {
            const result = targetBot.takeDamage(28, Math.random() < 0.2);
            this.particles.emitHitEffect(targetBot.position, new THREE.Vector3(0, 1, 0), true);
            if (result.died) {
              bot.kills++;
              bot.score += 2;
              this.events.onKillfeed({
                id: Math.random().toString(),
                killer: bot.name,
                killerTeam: bot.team,
                victim: targetBot.name,
                victimTeam: targetBot.team,
                weapon: bot.weapon,
                isHeadshot: Math.random() < 0.3,
                wallbang: false,
                timestamp: Date.now(),
              });
              this.checkRoundEndCondition();
            }
          }
        }
      }
    }

    this.particles.addTracer(botEyePos, targetPos);
  }

  public takePlayerDamage(amount: number, attacker: string, attackerTeam: Team, weapon: WeaponType) {
    let dmg = amount;
    if (this.playerStats.armor > 0) {
      dmg *= 0.7;
      this.playerStats.armor = Math.max(0, this.playerStats.armor - dmg * 0.5);
    }
    dmg = Math.round(dmg);
    this.playerStats.health = Math.max(0, this.playerStats.health - dmg);

    soundManager.playHitSound(false);

    if (this.playerStats.health <= 0) {
      this.playerStats.deaths++;
      this.events.onKillfeed({
        id: Math.random().toString(),
        killer: attacker,
        killerTeam: attackerTeam,
        victim: 'Player (You)',
        victimTeam: this.playerTeam,
        weapon,
        isHeadshot: false,
        wallbang: false,
        timestamp: Date.now(),
      });
      this.events.onMessage('你已被击杀！等待下一回合...');
      this.checkRoundEndCondition();
    }

    this.notifyStats();
  }

  private updateObjectives(delta: number) {
    if (this.gameState !== 'in_round') return;

    this.roundTimeRemaining -= delta;

    // C4 Beeping and Explosion countdown
    if (this.bombState.isPlanted && !this.bombState.isDefused && !this.bombState.isExploded) {
      this.bombBeepTimer -= delta;
      if (this.bombBeepTimer <= 0) {
        soundManager.playC4Beep();
        this.bombBeepTimer = Math.max(0.15, (this.roundTimeRemaining / 45) * 1.0);
      }

      if (this.roundTimeRemaining <= 0) {
        // C4 Exploded
        this.bombState.isExploded = true;
        soundManager.playExplosion();
        this.particles.emitExplosion(new THREE.Vector3(...(this.bombState.position || [0, 0, 0])), true);
        this.endRound('T', 'C4 炸药包已引爆！恐怖分子获胜！');
        return;
      }
    } else if (this.roundTimeRemaining <= 0) {
      // Time Ran Out -> CT Wins
      this.endRound('CT', '时间耗尽！反恐精英获胜！');
      return;
    }

    // Plant / Defuse Input with E key
    if (this.keys['KeyE']) {
      this.handleObjectiveInteraction(delta);
    } else {
      this.playerStats.isPlanting = false;
      this.playerStats.isDefusing = false;
    }

    this.events.onGameStateChange(
      this.gameState,
      Math.max(0, Math.ceil(this.roundTimeRemaining)),
      this.scoreCT,
      this.scoreT
    );
  }

  private handleObjectiveInteraction(delta: number) {
    // 1. Defusing planted C4 (CT)
    if (this.playerTeam === 'CT' && this.bombState.isPlanted && !this.bombState.isDefused) {
      const bombPos = new THREE.Vector3(...(this.bombState.position || [0, 0, 0]));
      if (this.playerPos.distanceTo(bombPos) < 4.0) {
        this.playerStats.isDefusing = true;
        const speed = this.playerStats.hasDefuseKit ? 0.2 : 0.1; // 5s with kit, 10s without
        this.bombState.defuseProgress = Math.min(1.0, this.bombState.defuseProgress + delta * speed);

        if (this.bombState.defuseProgress >= 1.0) {
          this.bombState.isDefused = true;
          this.playerStats.score += 3;
          this.playerStats.money += 3500;
          soundManager.playRadio('bomb_defused');
          this.endRound('CT', '炸弹已被成功拆除！反恐精英获胜！');
        }
        this.events.onBombStateChange(this.bombState);
        return;
      }
    }

    // 2. Planting C4 (T)
    if (this.playerTeam === 'T' && !this.bombState.isPlanted && this.inventory[3]?.config.id === 'c4') {
      const distA = this.playerPos.distanceTo(this.mapData.siteA.center);
      const distB = this.playerPos.distanceTo(this.mapData.siteB.center);

      if (distA <= this.mapData.siteA.radius || distB <= this.mapData.siteB.radius) {
        this.playerStats.isPlanting = true;
        const site = distA <= this.mapData.siteA.radius ? 'A' : 'B';
        this.bombState.plantProgress = Math.min(1.0, this.bombState.plantProgress + delta * 0.33); // 3 seconds to plant

        if (this.bombState.plantProgress >= 1.0) {
          this.bombState.isPlanted = true;
          this.bombState.site = site;
          this.bombState.position = [this.playerPos.x, this.playerPos.y - 1.6, this.playerPos.z];
          this.roundTimeRemaining = 40; // 40 seconds C4 timer

          // Spawn visual C4 mesh on ground
          this.bombMesh = WeaponModelBuilder.createWeaponModel('c4');
          this.bombMesh.position.set(...this.bombState.position);
          this.scene.add(this.bombMesh);

          // Remove C4 from inventory
          this.inventory[3] = null;
          this.selectSlot(0);

          soundManager.playRadio('bomb_planted');
          this.events.onMessage(`C4 已安装在 ${site} 点！`);
        }
        this.events.onBombStateChange(this.bombState);
      }
    }
  }

  private updateGrenades(delta: number) {
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.life -= delta;
      g.vel.y -= 14 * delta; // Gravity
      g.pos.addScaledVector(g.vel, delta);

      // Bounce off floor
      if (g.pos.y < 0.2) {
        g.pos.y = 0.2;
        g.vel.y = -g.vel.y * 0.45;
        g.vel.x *= 0.7;
        g.vel.z *= 0.7;
      }

      g.mesh.position.copy(g.pos);

      if (g.life <= 0) {
        // Explode
        if (g.type === 'hegrenade') {
          soundManager.playExplosion();
          this.particles.emitExplosion(g.pos);
          // Damage nearby entities
          const distToPlayer = this.playerPos.distanceTo(g.pos);
          if (distToPlayer < 9) {
            const dmg = (1 - distToPlayer / 9) * 85;
            this.takePlayerDamage(dmg, 'HE Grenade', this.playerTeam === 'CT' ? 'T' : 'CT', 'hegrenade');
          }
          for (const bot of this.bots) {
            if (bot.isAlive) {
              const d = bot.position.distanceTo(g.pos);
              if (d < 9) {
                bot.takeDamage((1 - d / 9) * 85, false);
              }
            }
          }
        } else if (g.type === 'flashbang') {
          soundManager.playExplosion();
          const dist = this.camera.position.distanceTo(g.pos);
          if (dist < 30) {
            this.events.onFlashbang(Math.max(0.3, 1 - dist / 30));
          }
        } else if (g.type === 'smokegrenade') {
          this.particles.emitSmokeExplosion(g.pos);
        }

        this.scene.remove(g.mesh);
        g.mesh.geometry.dispose();
        this.activeGrenades.splice(i, 1);
      }
    }
  }

  private checkRoundEndCondition() {
    if (this.gameState !== 'in_round') return;

    const aliveCT = this.bots.filter(b => b.team === 'CT' && b.isAlive).length + (this.playerTeam === 'CT' && this.playerStats.health > 0 ? 1 : 0);
    const aliveT = this.bots.filter(b => b.team === 'T' && b.isAlive).length + (this.playerTeam === 'T' && this.playerStats.health > 0 ? 1 : 0);

    if (aliveCT === 0 && !this.bombState.isPlanted) {
      this.endRound('T', '反恐精英全军覆没！恐怖分子获胜！');
    } else if (aliveT === 0 && !this.bombState.isPlanted) {
      this.endRound('CT', '恐怖分子全军覆没！反恐精英获胜！');
    }
  }

  private endRound(winner: Team, reason: string) {
    this.gameState = 'round_end';
    if (winner === 'CT') {
      this.scoreCT++;
      soundManager.playRadio('ct_win');
    } else {
      this.scoreT++;
      soundManager.playRadio('t_win');
    }

    // Money bonus
    this.playerStats.money += winner === this.playerTeam ? 3250 : 1400;

    this.events.onMessage(reason);
    this.notifyAll();

    setTimeout(() => {
      this.currentRound++;
      if (this.currentRound > 16) {
        this.gameState = 'match_end';
        this.events.onMessage('比赛结束！');
      } else {
        this.startRound();
      }
    }, 4500);
  }

  // --- UI Notification Helpers ---
  private notifyStats() {
    this.events.onStatsChange({ ...this.playerStats });
  }

  private notifyWeapon() {
    const current = this.inventory[this.activeSlotIndex];
    if (current) {
      this.events.onWeaponChange({ ...current }, this.activeSlotIndex);
    }
  }

  private notifyScoreboard() {
    const list: ScoreboardPlayer[] = [
      {
        id: 'player',
        name: 'You (Player)',
        team: this.playerTeam,
        kills: this.playerStats.kills,
        deaths: this.playerStats.deaths,
        assists: this.playerStats.assists,
        score: this.playerStats.score,
        ping: 5,
        isBot: false,
        isAlive: this.playerStats.health > 0,
        money: this.playerStats.money,
      },
      ...this.bots.map(b => ({
        id: b.id,
        name: b.name,
        team: b.team,
        kills: b.kills,
        deaths: b.deaths,
        assists: 0,
        score: b.score,
        ping: Math.floor(15 + Math.random() * 20),
        isBot: true,
        isAlive: b.isAlive,
        money: 3000,
      })),
    ];
    this.events.onScoreboardChange(list);
  }

  public notifyAll() {
    this.notifyStats();
    this.notifyWeapon();
    this.notifyScoreboard();
    this.events.onGameStateChange(
      this.gameState,
      Math.max(0, Math.ceil(this.roundTimeRemaining)),
      this.scoreCT,
      this.scoreT
    );
  }

  public destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderer.dispose();
  }
}
