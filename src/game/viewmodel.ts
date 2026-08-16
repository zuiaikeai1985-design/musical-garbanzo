import * as THREE from "three";
import type { Player } from "./player";

export class Viewmodel {
  readonly group = new THREE.Group();
  private rifle: THREE.Group;
  private pistol: THREE.Group;
  private knife: THREE.Group;
  private flash: THREE.PointLight;
  private bob = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.rifle = makeRifle();
    this.pistol = makePistol();
    this.knife = makeKnife();
    this.group.add(this.rifle, this.pistol, this.knife);
    this.flash = new THREE.PointLight(0xffcc66, 0, 6);
    this.flash.position.set(0.18, -0.08, -0.85);
    this.group.add(this.flash);
    camera.add(this.group);
    this.group.position.set(0.22, -0.22, -0.42);
  }

  update(player: Player, dt: number): void {
    const id = player.weapon.def.id;
    this.rifle.visible = id === "ak47" || id === "m4a4" || id === "awp";
    this.pistol.visible = id === "deagle" || id === "usp" || id === "glock";
    this.knife.visible = id === "knife";
    this.tint(id);

    this.bob += dt * (player.moving ? 10 : 2);
    const walk = player.moving && player.grounded ? 1 : 0.15;
    const kick = player.viewKick;
    this.group.position.set(
      0.22 + Math.sin(this.bob) * 0.012 * walk,
      -0.22 + Math.abs(Math.cos(this.bob)) * 0.014 * walk + kick * 0.03,
      -0.42 - kick * 0.06,
    );
    this.group.rotation.x = -kick * 0.18;
    this.group.rotation.z = Math.sin(this.bob) * 0.02 * walk;
    this.group.visible = !player.scoped;
    this.flash.intensity = Math.max(0, this.flash.intensity - dt * 28);
  }

  muzzle(): void {
    this.flash.intensity = 8;
  }

  private tint(id: string): void {
    const wood = id === "ak47";
    const long = id === "awp";
    this.rifle.scale.set(long ? 1.15 : 1, 1, long ? 1.25 : 1);
    const stock = this.rifle.children[0] as THREE.Mesh;
    if (stock.material instanceof THREE.MeshLambertMaterial) {
      stock.material.color.set(wood ? 0x6b3d1f : 0x2a2d30);
    }
  }
}

function makeRifle(): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2e32 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b3d1f });
  const metal = new THREE.MeshLambertMaterial({ color: 0x4a4e52 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.55), dark);
  body.position.set(0, 0, -0.15);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.42), metal);
  barrel.position.set(0, 0.02, -0.52);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.08), dark);
  mag.position.set(0, -0.1, -0.08);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.22), wood);
  stock.position.set(0, -0.01, 0.2);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), dark);
  grip.position.set(0, -0.1, 0.06);
  g.add(stock, body, barrel, mag, grip);
  return g;
}

function makePistol(): THREE.Group {
  const g = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x1f2226 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.22), dark);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.14), dark);
  barrel.position.set(0, 0.02, -0.16);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), dark);
  grip.position.set(0, -0.08, 0.04);
  g.add(body, barrel, grip);
  return g;
}

function makeKnife(): THREE.Group {
  const g = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.04, 0.28),
    new THREE.MeshLambertMaterial({ color: 0xc5cdd4 }),
  );
  blade.position.set(0.02, -0.02, -0.2);
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.04, 0.1),
    new THREE.MeshLambertMaterial({ color: 0x2a1c12 }),
  );
  handle.position.set(0.02, -0.02, -0.02);
  g.add(blade, handle);
  return g;
}
