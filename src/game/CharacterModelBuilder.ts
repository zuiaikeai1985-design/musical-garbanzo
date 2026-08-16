import * as THREE from 'three';
import { Team, WeaponType } from './types';
import { WeaponModelBuilder } from './WeaponModelBuilder';

export class CharacterModelBuilder {
  public static createCharacterModel(team: Team, weapon: WeaponType = 'ak47'): THREE.Group {
    const group = new THREE.Group();

    // Uniform Colors
    // CT: Navy Blue / SWAT Gear
    // T: Desert Camo / Tan / Terrorist mask
    const uniformColor = team === 'CT' ? 0x1e293b : 0x785535;
    const vestColor = team === 'CT' ? 0x0f172a : 0x45311f;
    const skinColor = 0xdcb897;
    const pantsColor = team === 'CT' ? 0x1e293b : 0x3e3228;
    const bootColor = 0x111317;
    const balaclavaColor = team === 'T' ? 0x222222 : 0x111317;

    const uniformMat = new THREE.MeshStandardMaterial({ color: uniformColor, roughness: 0.8 });
    const vestMat = new THREE.MeshStandardMaterial({ color: vestColor, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.6 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });
    const bootMat = new THREE.MeshStandardMaterial({ color: bootColor, roughness: 0.5 });
    const maskMat = new THREE.MeshStandardMaterial({ color: balaclavaColor, roughness: 0.9 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: team === 'CT' ? 0x334155 : 0x574838, roughness: 0.4, metalness: 0.3 });

    // 1. Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.3), uniformMat);
    torso.position.y = 1.05;
    torso.castShadow = true;
    torso.receiveShadow = true;
    group.add(torso);

    // Tactical Vest
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.34), vestMat);
    vest.position.y = 1.05;
    group.add(vest);

    // 2. Head & Helmet / Mask
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), maskMat);
    head.position.y = 1.55;
    head.castShadow = true;
    head.name = 'head'; // Hitbox tag
    group.add(head);

    // Eye cutout / Goggles
    const goggleMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.8 });
    const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), goggleMat);
    goggles.position.set(0, 1.56, -0.12);
    group.add(goggles);

    // Helmet
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.28), helmetMat);
    helmet.position.set(0, 1.66, 0);
    group.add(helmet);

    // 3. Legs
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), pantsMat);
    leftLeg.position.set(-0.14, 0.4, 0);
    leftLeg.castShadow = true;
    leftLeg.name = 'leg_left';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.2), pantsMat);
    rightLeg.position.set(0.14, 0.4, 0);
    rightLeg.castShadow = true;
    rightLeg.name = 'leg_right';
    group.add(rightLeg);

    // Boots
    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.24), bootMat);
    leftBoot.position.set(-0.14, 0.08, -0.02);
    group.add(leftBoot);

    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.15, 0.24), bootMat);
    rightBoot.position.set(0.14, 0.08, -0.02);
    group.add(rightBoot);

    // 4. Arms & Hands holding weapon
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), uniformMat);
    rightArm.position.set(0.32, 1.0, -0.15);
    rightArm.rotation.x = -Math.PI / 3;
    rightArm.rotation.z = -0.2;
    rightArm.castShadow = true;
    group.add(rightArm);

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), uniformMat);
    leftArm.position.set(-0.28, 1.0, -0.15);
    leftArm.rotation.x = -Math.PI / 3.2;
    leftArm.rotation.y = 0.3;
    leftArm.castShadow = true;
    group.add(leftArm);

    // 5. Weapon attached to hands
    const weaponMesh = WeaponModelBuilder.createWeaponModel(weapon);
    weaponMesh.position.set(0.15, 1.0, -0.35);
    weaponMesh.rotation.y = Math.PI; // Face forward
    weaponMesh.name = 'held_weapon';
    group.add(weaponMesh);

    return group;
  }
}
