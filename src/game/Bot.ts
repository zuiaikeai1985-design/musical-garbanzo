import * as THREE from 'three';
import { Team, WeaponType } from './types';
import { WEAPONS } from './weapons';
import { CharacterModelBuilder } from './CharacterModelBuilder';

export interface BotTarget {
  position: THREE.Vector3;
  isPlayer: boolean;
  botId?: string;
  team: Team;
}

export type BotState = 'patrol' | 'rush_site' | 'guard_site' | 'combat' | 'plant' | 'defuse' | 'dead';

export class Bot {
  public id: string;
  public name: string;
  public team: Team;
  public health: number = 100;
  public armor: number = 100;
  public hasHelmet: boolean = true;
  public isAlive: boolean = true;
  public weapon: WeaponType;
  public kills: number = 0;
  public deaths: number = 0;
  public score: number = 0;

  public mesh: THREE.Group;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public rotationY: number = 0;

  public state: BotState = 'patrol';
  public targetNavIndex: number = 0;
  public currentPath: THREE.Vector3[] = [];
  public currentWayPointIndex: number = 0;

  public shootCooldown: number = 0;
  public reactionTimer: number = 0;
  public targetEnemy: BotTarget | null = null;
  public difficultyMultiplier: number = 1.0; // aim precision & reaction

  public isDefusing: boolean = false;
  public isPlanting: boolean = false;

  constructor(
    id: string,
    name: string,
    team: Team,
    spawnPos: THREE.Vector3,
    weapon: WeaponType = 'ak47'
  ) {
    this.id = id;
    this.name = name;
    this.team = team;
    this.weapon = weapon;
    this.position = spawnPos.clone();

    this.mesh = CharacterModelBuilder.createCharacterModel(team, weapon);
    this.mesh.position.copy(this.position);
  }

  public reset(spawnPos: THREE.Vector3, newWeapon?: WeaponType) {
    this.health = 100;
    this.armor = 100;
    this.hasHelmet = true;
    this.isAlive = true;
    this.isDefusing = false;
    this.isPlanting = false;
    this.targetEnemy = null;
    this.position.copy(spawnPos);
    this.mesh.position.copy(spawnPos);
    this.mesh.visible = true;
    this.state = 'patrol';
    this.currentWayPointIndex = 0;

    if (newWeapon) {
      this.weapon = newWeapon;
    }
  }

  public takeDamage(
    amount: number,
    isHeadshot: boolean
  ): { died: boolean; actualDamage: number } {
    if (!this.isAlive) return { died: false, actualDamage: 0 };

    let dmg = amount;
    const config = WEAPONS[this.weapon];
    if (isHeadshot) {
      dmg *= (config?.headshotMultiplier || 3.0);
      if (this.hasHelmet) {
        dmg *= 0.75;
      }
    } else if (this.armor > 0) {
      dmg *= 0.7; // Armor damage reduction
      this.armor = Math.max(0, this.armor - dmg * 0.5);
    }

    dmg = Math.round(dmg);
    this.health = Math.max(0, this.health - dmg);

    if (this.health <= 0) {
      this.isAlive = false;
      this.deaths++;
      this.state = 'dead';
      this.mesh.visible = false;
      return { died: true, actualDamage: dmg };
    }

    return { died: false, actualDamage: dmg };
  }

  public update(
    delta: number,
    navPoints: THREE.Vector3[],
    potentialTargets: BotTarget[],
    obstacles: THREE.Box3[],
    bombState: { isPlanted: boolean; site?: 'A' | 'B'; position?: [number, number, number] },
    onBotFire: (bot: Bot, targetPos: THREE.Vector3) => void
  ) {
    if (!this.isAlive) return;

    this.shootCooldown = Math.max(0, this.shootCooldown - delta);
    this.reactionTimer = Math.max(0, this.reactionTimer - delta);

    // 1. Target Detection (FOV and Distance Check)
    this.findNearestEnemy(potentialTargets);

    // 2. State Machine Logic
    if (this.targetEnemy) {
      this.state = 'combat';
    } else if (bombState.isPlanted) {
      if (this.team === 'CT') {
        this.state = 'defuse';
      } else {
        this.state = 'guard_site';
      }
    } else {
      if (this.team === 'T') {
        this.state = 'rush_site';
      } else {
        this.state = 'patrol';
      }
    }

    // 3. Movement & Aiming Execution
    switch (this.state) {
      case 'combat':
        if (this.targetEnemy) {
          // Turn to face enemy
          const dx = this.targetEnemy.position.x - this.position.x;
          const dz = this.targetEnemy.position.z - this.position.z;
          const targetAngle = Math.atan2(dx, dz);
          this.rotationY = targetAngle;
          this.mesh.rotation.y = targetAngle;

          // Strafe / Stand still & shoot with burst recoil simulation
          const dist = this.position.distanceTo(this.targetEnemy.position);
          if (dist > 15) {
            // Move closer
            this.moveToward(this.targetEnemy.position, 3.5, delta, obstacles);
          } else if (dist < 4) {
            // Back up
            this.moveAwayFrom(this.targetEnemy.position, 2.5, delta, obstacles);
          }

          // Shoot cooldown
          if (this.shootCooldown <= 0 && this.reactionTimer <= 0) {
            const config = WEAPONS[this.weapon] || WEAPONS.ak47;
            this.shootCooldown = 1.0 / config.fireRate + Math.random() * 0.08;

            // Apply slight aim inaccuracy based on distance
            const aimSpread = (Math.random() - 0.5) * 0.4;
            const aimPos = this.targetEnemy.position.clone().add(
              new THREE.Vector3(aimSpread, 1.3 + (Math.random() - 0.5) * 0.3, aimSpread)
            );

            onBotFire(this, aimPos);
          }
        }
        break;

      case 'defuse':
      case 'rush_site':
      case 'guard_site':
      case 'patrol':
      default: {
        // Path navigation
        if (navPoints.length > 0) {
          const targetWaypoint = navPoints[this.targetNavIndex % navPoints.length];
          const distToWp = this.position.distanceTo(targetWaypoint);

          if (distToWp < 2.5) {
            // Pick next nav point
            this.targetNavIndex = (this.targetNavIndex + 1) % navPoints.length;
          }

          this.moveToward(targetWaypoint, 4.2, delta, obstacles);
        }
        break;
      }
    }

    // Keep mesh in sync
    this.mesh.position.copy(this.position);
  }

  private findNearestEnemy(targets: BotTarget[]) {
    let closest: BotTarget | null = null;
    let closestDist = 35; // Bot visual range in meters

    for (const t of targets) {
      if (t.team === this.team) continue;

      const dist = this.position.distanceTo(t.position);
      if (dist < closestDist) {
        // FOV Check: angle between bot forward vector and direction to target
        const botForward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
        const dirToTarget = t.position.clone().sub(this.position).normalize();
        const dot = botForward.dot(dirToTarget);

        // Bots have 160 deg FOV or 360 deg if very close (< 6m footsteps)
        if (dot > 0.1 || dist < 6) {
          closest = t;
          closestDist = dist;
        }
      }
    }

    if (closest && !this.targetEnemy) {
      // First sight reaction delay (CS style human reaction ~200-350ms)
      this.reactionTimer = 0.2 + Math.random() * 0.15;
    }
    this.targetEnemy = closest;
  }

  private moveToward(target: THREE.Vector3, speed: number, delta: number, obstacles: THREE.Box3[]) {
    const dir = target.clone().sub(this.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) return;
    dir.normalize();

    this.rotationY = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.y = this.rotationY;

    const moveStep = dir.multiplyScalar(speed * delta);
    const newPos = this.position.clone().add(moveStep);

    // Collision check with obstacles
    const botBox = new THREE.Box3(
      new THREE.Vector3(newPos.x - 0.35, newPos.y, newPos.z - 0.35),
      new THREE.Vector3(newPos.x + 0.35, newPos.y + 1.8, newPos.z + 0.35)
    );

    let collided = false;
    for (const obs of obstacles) {
      if (obs.intersectsBox(botBox)) {
        collided = true;
        break;
      }
    }

    if (!collided) {
      this.position.copy(newPos);
    } else {
      // Sliding around corner
      this.targetNavIndex = (this.targetNavIndex + 1) % 15;
    }
  }

  private moveAwayFrom(target: THREE.Vector3, speed: number, delta: number, obstacles: THREE.Box3[]) {
    const dir = this.position.clone().sub(target);
    dir.y = 0;
    dir.normalize();

    const moveStep = dir.multiplyScalar(speed * delta);
    const newPos = this.position.clone().add(moveStep);

    const botBox = new THREE.Box3(
      new THREE.Vector3(newPos.x - 0.35, newPos.y, newPos.z - 0.35),
      new THREE.Vector3(newPos.x + 0.35, newPos.y + 1.8, newPos.z + 0.35)
    );

    let collided = false;
    for (const obs of obstacles) {
      if (obs.intersectsBox(botBox)) {
        collided = true;
        break;
      }
    }

    if (!collided) {
      this.position.copy(newPos);
    }
  }
}
