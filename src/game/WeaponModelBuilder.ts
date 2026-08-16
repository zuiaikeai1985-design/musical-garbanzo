import * as THREE from 'three';
import { WeaponType } from './types';

export class WeaponModelBuilder {
  public static createWeaponModel(type: WeaponType): THREE.Group {
    const group = new THREE.Group();

    // Material definitions
    const gunMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1f242d,
      roughness: 0.3,
      metalness: 0.85,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.4,
      metalness: 0.9,
    });

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x7c3f1d,
      roughness: 0.6,
      metalness: 0.1,
    });

    const greenSniperMat = new THREE.MeshStandardMaterial({
      color: 0x2e4a2d,
      roughness: 0.5,
      metalness: 0.4,
    });

    const knifeBladeMat = new THREE.MeshStandardMaterial({
      color: 0xd1d5db,
      roughness: 0.15,
      metalness: 0.95,
    });

    const c4CaseMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      roughness: 0.7,
      metalness: 0.2,
    });

    switch (type) {
      case 'knife': {
        // Knife handle
        const handleGeom = new THREE.BoxGeometry(0.04, 0.12, 0.03);
        const handle = new THREE.Mesh(handleGeom, darkMetalMat);
        handle.position.set(0, -0.05, 0);
        group.add(handle);

        // Guard
        const guardGeom = new THREE.BoxGeometry(0.08, 0.015, 0.04);
        const guard = new THREE.Mesh(guardGeom, darkMetalMat);
        guard.position.set(0, 0.01, 0);
        group.add(guard);

        // Blade (Curved karambit/bayonet style)
        const bladeGeom = new THREE.BoxGeometry(0.03, 0.2, 0.008);
        const blade = new THREE.Mesh(bladeGeom, knifeBladeMat);
        blade.position.set(0, 0.11, 0);
        blade.rotation.z = 0.05;
        group.add(blade);
        break;
      }

      case 'glock': {
        // Glock Frame / Grip
        const gripGeom = new THREE.BoxGeometry(0.035, 0.12, 0.04);
        const grip = new THREE.Mesh(gripGeom, darkMetalMat);
        grip.rotation.x = -0.2;
        grip.position.set(0, -0.06, 0.04);
        group.add(grip);

        // Slide
        const slideGeom = new THREE.BoxGeometry(0.038, 0.045, 0.18);
        const slide = new THREE.Mesh(slideGeom, gunMetalMat);
        slide.position.set(0, 0, -0.02);
        group.add(slide);

        // Barrel Tip
        const barrelGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8);
        const barrel = new THREE.Mesh(barrelGeom, darkMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -0.11);
        group.add(barrel);
        break;
      }

      case 'deagle': {
        // Heavy Chunky Grip
        const gripGeom = new THREE.BoxGeometry(0.045, 0.15, 0.055);
        const grip = new THREE.Mesh(gripGeom, darkMetalMat);
        grip.rotation.x = -0.22;
        grip.position.set(0, -0.07, 0.05);
        group.add(grip);

        // Massive Slide
        const slideGeom = new THREE.BoxGeometry(0.05, 0.065, 0.24);
        const slide = new THREE.Mesh(slideGeom, knifeBladeMat); // Silver/Chrome finish
        slide.position.set(0, 0.01, -0.04);
        group.add(slide);

        // Under-barrel rail
        const railGeom = new THREE.BoxGeometry(0.035, 0.02, 0.14);
        const rail = new THREE.Mesh(railGeom, darkMetalMat);
        rail.position.set(0, -0.03, -0.06);
        group.add(rail);
        break;
      }

      case 'mp5': {
        // Body / Receiver
        const bodyGeom = new THREE.BoxGeometry(0.05, 0.07, 0.32);
        const body = new THREE.Mesh(bodyGeom, darkMetalMat);
        group.add(body);

        // Pistol Grip
        const gripGeom = new THREE.BoxGeometry(0.04, 0.12, 0.04);
        const grip = new THREE.Mesh(gripGeom, darkMetalMat);
        grip.rotation.x = -0.25;
        grip.position.set(0, -0.08, 0.06);
        group.add(grip);

        // Curved Magazine
        const magGeom = new THREE.BoxGeometry(0.03, 0.14, 0.035);
        const mag = new THREE.Mesh(magGeom, gunMetalMat);
        mag.rotation.x = 0.2;
        mag.position.set(0, -0.09, -0.04);
        group.add(mag);

        // Suppressor (SD model)
        const suppGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 12);
        const supp = new THREE.Mesh(suppGeom, darkMetalMat);
        supp.rotation.x = Math.PI / 2;
        supp.position.set(0, 0, -0.24);
        group.add(supp);

        // Retractable Stock
        const stockGeom = new THREE.BoxGeometry(0.04, 0.08, 0.15);
        const stock = new THREE.Mesh(stockGeom, darkMetalMat);
        stock.position.set(0, -0.02, 0.22);
        group.add(stock);
        break;
      }

      case 'ak47': {
        // Receiver
        const bodyGeom = new THREE.BoxGeometry(0.055, 0.075, 0.35);
        const body = new THREE.Mesh(bodyGeom, darkMetalMat);
        group.add(body);

        // Wooden Stock
        const stockGeom = new THREE.BoxGeometry(0.045, 0.09, 0.22);
        const stock = new THREE.Mesh(stockGeom, woodMat);
        stock.position.set(0, -0.02, 0.26);
        stock.rotation.x = 0.08;
        group.add(stock);

        // Wooden Foregrip / Handguard
        const handguardGeom = new THREE.BoxGeometry(0.048, 0.055, 0.18);
        const handguard = new THREE.Mesh(handguardGeom, woodMat);
        handguard.position.set(0, 0.005, -0.18);
        group.add(handguard);

        // Pistol Grip
        const gripGeom = new THREE.BoxGeometry(0.038, 0.12, 0.04);
        const grip = new THREE.Mesh(gripGeom, woodMat);
        grip.rotation.x = -0.3;
        grip.position.set(0, -0.09, 0.08);
        group.add(grip);

        // Curved AK Banana Magazine
        const magGeom = new THREE.BoxGeometry(0.035, 0.18, 0.06);
        const mag = new THREE.Mesh(magGeom, gunMetalMat);
        mag.rotation.x = 0.35;
        mag.position.set(0, -0.11, -0.03);
        group.add(mag);

        // Long Barrel & Gas Tube
        const barrelGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 10);
        const barrel = new THREE.Mesh(barrelGeom, darkMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.01, -0.36);
        group.add(barrel);

        // Slanted Muzzle Brake
        const muzzleGeom = new THREE.BoxGeometry(0.02, 0.025, 0.04);
        const muzzle = new THREE.Mesh(muzzleGeom, darkMetalMat);
        muzzle.position.set(0, 0.015, -0.48);
        group.add(muzzle);
        break;
      }

      case 'm4a1': {
        // Modern Upper / Lower Receiver
        const bodyGeom = new THREE.BoxGeometry(0.055, 0.08, 0.32);
        const body = new THREE.Mesh(bodyGeom, darkMetalMat);
        group.add(body);

        // Tactical Crane Stock
        const stockGeom = new THREE.BoxGeometry(0.045, 0.09, 0.2);
        const stock = new THREE.Mesh(stockGeom, darkMetalMat);
        stock.position.set(0, -0.01, 0.25);
        group.add(stock);

        // Picatinny Quad Rail Handguard
        const handguardGeom = new THREE.BoxGeometry(0.05, 0.06, 0.22);
        const handguard = new THREE.Mesh(handguardGeom, gunMetalMat);
        handguard.position.set(0, 0, -0.2);
        group.add(handguard);

        // Carry Handle / Rear Sight
        const handleGeom = new THREE.BoxGeometry(0.03, 0.04, 0.12);
        const handle = new THREE.Mesh(handleGeom, darkMetalMat);
        handle.position.set(0, 0.055, -0.02);
        group.add(handle);

        // Straight STANAG Magazine
        const magGeom = new THREE.BoxGeometry(0.032, 0.16, 0.05);
        const mag = new THREE.Mesh(magGeom, gunMetalMat);
        mag.rotation.x = 0.15;
        mag.position.set(0, -0.11, -0.02);
        group.add(mag);

        // Barrel & Flash Hider
        const barrelGeom = new THREE.CylinderGeometry(0.01, 0.01, 0.2, 10);
        const barrel = new THREE.Mesh(barrelGeom, darkMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0, -0.38);
        group.add(barrel);
        break;
      }

      case 'awp': {
        // Iconic Green Polymer Chassis
        const stockGeom = new THREE.BoxGeometry(0.06, 0.1, 0.6);
        const stock = new THREE.Mesh(stockGeom, greenSniperMat);
        stock.position.set(0, -0.02, 0.08);
        group.add(stock);

        // Huge Long Steel Barrel
        const barrelGeom = new THREE.CylinderGeometry(0.014, 0.014, 0.45, 12);
        const barrel = new THREE.Mesh(barrelGeom, darkMetalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.01, -0.45);
        group.add(barrel);

        // Muzzle Brake
        const brakeGeom = new THREE.BoxGeometry(0.035, 0.035, 0.06);
        const brake = new THREE.Mesh(brakeGeom, darkMetalMat);
        brake.position.set(0, 0.01, -0.7);
        group.add(brake);

        // High-Magnification Sniper Scope
        const scopeGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.22, 16);
        const scope = new THREE.Mesh(scopeGeom, darkMetalMat);
        scope.rotation.x = Math.PI / 2;
        scope.position.set(0, 0.07, -0.04);
        group.add(scope);

        // Scope Mounts
        const mount1 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.02), darkMetalMat);
        mount1.position.set(0, 0.045, 0.03);
        group.add(mount1);
        const mount2 = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.03, 0.02), darkMetalMat);
        mount2.position.set(0, 0.045, -0.1);
        group.add(mount2);

        // Bolt Action Handle
        const boltGeom = new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8);
        const bolt = new THREE.Mesh(boltGeom, knifeBladeMat);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(0.04, 0.02, 0.05);
        group.add(bolt);
        break;
      }

      case 'c4': {
        // C4 Explosive Brick
        const c4Body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.18), c4CaseMat);
        group.add(c4Body);

        // Digital Keypad & Timer Screen
        const screenMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.03), screenMat);
        screen.rotation.x = -Math.PI / 2;
        screen.position.set(0, 0.031, -0.03);
        group.add(screen);

        // Wires
        const wireMat1 = new THREE.MeshBasicMaterial({ color: 0x3b82f6 });
        const wireMat2 = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const wire1 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), wireMat1);
        wire1.rotation.z = Math.PI / 3;
        wire1.position.set(0.03, 0.035, 0.03);
        group.add(wire1);
        const wire2 = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), wireMat2);
        wire2.rotation.z = -Math.PI / 3;
        wire2.position.set(-0.03, 0.035, 0.03);
        group.add(wire2);
        break;
      }

      case 'hegrenade':
      case 'flashbang':
      case 'smokegrenade': {
        const canMat =
          type === 'hegrenade'
            ? new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 })
            : type === 'flashbang'
            ? new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 })
            : new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 12), canMat);
        group.add(body);

        const pin = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), darkMetalMat);
        pin.position.set(0.02, 0.05, 0);
        group.add(pin);
        break;
      }
    }

    // Shadow setup
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
      }
    });

    return group;
  }
}
