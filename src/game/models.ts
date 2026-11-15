import * as THREE from 'three';
import { CUSTOMIZATION_ITEMS, EquippedLoadout, MonsterType, WEAPONS, WeaponId } from '../shared/gameData';

function getCustomItem(id: string) {
  return CUSTOMIZATION_ITEMS.find((i) => i.id === id);
}

export interface WeaponModelHandle {
  group: THREE.Group;
  muzzlePoint: THREE.Object3D;
  flashMesh: THREE.Mesh;
  slideMesh?: THREE.Object3D;
}

export function buildWeaponModel(
  weaponId: WeaponId,
  weaponSkinId = 'wskin_factory',
  muzzleTex?: THREE.Texture
): WeaponModelHandle {
  const def = WEAPONS[weaponId] || WEAPONS.pistol;
  const skin = getCustomItem(weaponSkinId);
  const group = new THREE.Group();

  const bodyColor = skin && skin.id !== 'wskin_factory' ? skin.color : def.color;
  const accentColor = skin && skin.secondaryColor ? skin.secondaryColor : def.accentColor;

  const isChrome = skin?.id === 'wskin_chrome' || skin?.id === 'wskin_gold';
  const metalMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: isChrome ? 0.18 : 0.36,
    metalness: isChrome ? 0.94 : 0.82,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: '#111318',
    roughness: 0.85,
    metalness: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.28,
    metalness: 0.78,
    emissive:
      weaponId === 'plasma' || weaponId === 'plasma_cannon' || weaponId === 'shock_grenade'
        ? new THREE.Color(def.accentColor)
        : new THREE.Color(skin?.emissive || '#000000'),
    emissiveIntensity:
      weaponId === 'plasma' || weaponId === 'plasma_cannon' ? 1.35 : skin?.emissive ? 0.45 : 0,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: skin && skin.id !== 'wskin_factory' ? accentColor : '#78350f',
    roughness: 0.72,
    metalness: 0.08,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: skin && skin.id !== 'wskin_factory' ? accentColor : '#cbd5e1',
    roughness: 0.18,
    metalness: 0.95,
    emissive: skin?.emissive ? new THREE.Color(skin.emissive) : new THREE.Color('#000000'),
    emissiveIntensity: skin?.emissive ? 0.35 : 0,
  });

  const muzzlePoint = new THREE.Object3D();
  let slideMesh: THREE.Object3D | undefined;

  if (def.weaponClass === 'melee') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 10), gripMat);
    handle.position.set(0, -0.02, 0.04);
    handle.rotation.x = 0.28;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.016, 0.026), accentMat);
    guard.position.set(0, 0.06, -0.02);

    if (weaponId === 'katana') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.032, 0.72), bladeMat);
      blade.position.set(0, 0.08, -0.38);
      blade.rotation.x = 0.08;
      group.add(handle, guard, blade);
    } else if (weaponId === 'machete') {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.065, 0.46), bladeMat);
      blade.position.set(0, 0.08, -0.25);
      blade.rotation.x = 0.1;
      group.add(handle, guard, blade);
    } else if (weaponId === 'tomahawk') {
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.42, 10), metalMat);
      shaft.rotation.x = Math.PI / 3;
      shaft.position.set(0, 0.05, -0.1);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.13, 0.18), bladeMat);
      head.position.set(0, 0.14, -0.26);
      group.add(shaft, head);
    } else if (weaponId === 'karambit') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 8, 16), accentMat);
      ring.position.set(0, -0.08, 0.06);
      const curved = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.22, 4), bladeMat);
      curved.rotation.x = -Math.PI / 2.6;
      curved.position.set(0, 0.05, -0.14);
      group.add(handle, ring, curved);
    } else {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.038, 0.28), bladeMat);
      blade.position.set(0, 0.075, -0.16);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 4), bladeMat);
      tip.rotation.x = -Math.PI / 2;
      tip.position.set(0, 0.075, -0.33);
      group.add(handle, guard, blade, tip);
    }
    muzzlePoint.position.set(0, 0.07, -0.35);
  } else if (def.weaponClass === 'throwable') {
    if (weaponId === 'molotov') {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.046, 0.18, 12), woodMat);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.036, 0.09, 10), woodMat);
      neck.position.y = 0.12;
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.032, 0.09, 8),
        new THREE.MeshBasicMaterial({ color: 0xfb923c })
      );
      flame.position.y = 0.2;
      group.add(bottle, neck, flame);
    } else if (weaponId === 'pipe_bomb') {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.22, 12), metalMat);
      const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 12), accentMat);
      cap1.position.y = 0.11;
      const cap2 = cap1.clone();
      cap2.position.y = -0.11;
      group.add(pipe, cap1, cap2);
    } else if (weaponId === 'thermite') {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.08), metalMat);
      const core = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.08, 0.09),
        new THREE.MeshBasicMaterial({ color: 0xfacc15 })
      );
      group.add(block, core);
    } else {
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.062, 12, 10), metalMat);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.01, 6, 16), accentMat);
      band.rotation.x = Math.PI / 2;
      const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.025), accentMat);
      spoon.position.set(0.04, 0.04, 0);
      group.add(body, band, spoon);
    }
    muzzlePoint.position.set(0, 0.05, -0.14);
  } else if (def.weaponClass === 'handgun') {
    const buildSinglePistol = (offsetX = 0) => {
      const pGroup = new THREE.Group();
      pGroup.position.x = offsetX;
      const isHeavy = weaponId === 'deagle' || weaponId === 'revolver';
      const frame = new THREE.Mesh(new THREE.BoxGeometry(isHeavy ? 0.064 : 0.052, 0.044, isHeavy ? 0.28 : 0.22), gripMat);
      const slide = new THREE.Mesh(
        new THREE.BoxGeometry(isHeavy ? 0.068 : 0.056, isHeavy ? 0.056 : 0.048, isHeavy ? 0.29 : 0.23),
        metalMat
      );
      slide.position.set(0, 0.036, -0.005);
      if (offsetX === 0) slideMesh = slide;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.14, 0.062), gripMat);
      grip.position.set(0, -0.07, 0.07);
      grip.rotation.x = 0.22;
      pGroup.add(frame, slide, grip);

      if (weaponId === 'revolver') {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.08, 10), accentMat);
        cyl.rotation.x = Math.PI / 2;
        cyl.position.set(0, 0.036, 0.01);
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.22, 10), metalMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.042, -0.18);
        pGroup.add(cyl, barrel);
      } else if (weaponId === 'usp45') {
        const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.2, 12), gripMat);
        silencer.rotation.x = Math.PI / 2;
        silencer.position.set(0, 0.034, -0.22);
        pGroup.add(silencer);
      } else if (weaponId === 'glock18') {
        const extMag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.22, 0.046), accentMat);
        extMag.position.set(0, -0.13, 0.09);
        extMag.rotation.x = 0.22;
        pGroup.add(extMag);
      } else {
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 10), accentMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.034, -0.16);
        pGroup.add(barrel);
      }
      group.add(pGroup);
    };

    if (weaponId === 'dual_berettas') {
      buildSinglePistol(-0.12);
      buildSinglePistol(0.12);
      muzzlePoint.position.set(0, 0.035, -0.24);
    } else {
      buildSinglePistol(0);
      muzzlePoint.position.set(0, 0.035, weaponId === 'usp45' ? -0.34 : -0.24);
    }
  } else if (def.weaponClass === 'smg') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.085, 0.34), metalMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 12), accentMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.25);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 0.06), gripMat);
    grip.position.set(0, -0.09, 0.09);
    grip.rotation.x = 0.25;
    group.add(receiver, barrel, grip);

    if (weaponId === 'tommy') {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 16), accentMat);
      drum.rotation.z = Math.PI / 2;
      drum.position.set(0, -0.09, -0.06);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.11, 0.24), woodMat);
      stock.position.set(0, -0.03, 0.27);
      group.add(drum, stock);
    } else if (weaponId === 'p90') {
      const topMag = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.035, 0.3), accentMat);
      topMag.position.set(0, 0.062, -0.04);
      group.add(topMag);
    } else {
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.2, 0.048), accentMat);
      mag.position.set(0, -0.12, -0.05);
      mag.rotation.x = -0.15;
      group.add(mag);
    }
    muzzlePoint.position.set(0, 0.01, -0.36);
  } else if (def.weaponClass === 'shotgun') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.088, 0.32), metalMat);
    const barrelLen = weaponId === 'sawed_off' ? 0.3 : 0.48;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, barrelLen, 12), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(weaponId === 'sawed_off' ? -0.022 : 0, 0.025, -0.18 - barrelLen / 2);
    group.add(receiver, barrel);

    if (weaponId === 'sawed_off') {
      const barrel2 = barrel.clone();
      barrel2.position.x = 0.022;
      const wood = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.09, 0.18), woodMat);
      wood.position.set(0, -0.04, 0.18);
      wood.rotation.x = 0.35;
      group.add(barrel2, wood);
    } else if (weaponId === 'aa12') {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.075, 16), accentMat);
      drum.rotation.x = Math.PI / 2;
      drum.position.set(0, -0.11, -0.02);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.12, 0.24), gripMat);
      stock.position.set(0, -0.02, 0.25);
      group.add(drum, stock);
    } else {
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.17, 10), accentMat);
      pump.rotation.x = Math.PI / 2;
      pump.position.set(0, -0.015, -0.28);
      slideMesh = pump;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.11, 0.24), woodMat);
      stock.position.set(0, -0.03, 0.26);
      stock.rotation.x = 0.15;
      group.add(pump, stock);
    }
    muzzlePoint.position.set(0, 0.025, weaponId === 'sawed_off' ? -0.49 : -0.66);
  } else if (def.weaponClass === 'rifle') {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.08, 0.38), metalMat);
    const handguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.062, 0.068, 0.26),
      weaponId === 'ak47' ? woodMat : accentMat
    );
    handguard.position.set(0, 0.005, -0.3);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(weaponId === 'as_val' ? 0.028 : 0.015, weaponId === 'as_val' ? 0.028 : 0.015, 0.24, 12),
      weaponId === 'as_val' ? gripMat : metalMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.008, -0.5);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.19, 0.065), gripMat);
    mag.position.set(0, -0.12, weaponId === 'famas' ? 0.14 : -0.04);
    mag.rotation.x = weaponId === 'ak47' ? -0.34 : -0.18;
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.052, 0.11, 0.22),
      weaponId === 'ak47' ? woodMat : gripMat
    );
    stock.position.set(0, -0.01, 0.28);
    const optic = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12), accentMat);
    optic.rotation.x = Math.PI / 2;
    optic.position.set(0, 0.068, 0.0);
    group.add(upper, handguard, barrel, mag, stock, optic);
    muzzlePoint.position.set(0, 0.008, -0.63);
  } else if (def.weaponClass === 'lmg') {
    if (weaponId === 'minigun') {
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.36, 14), metalMat);
      motor.rotation.x = Math.PI / 2;
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.56, 8), accentMat);
        bar.rotation.x = Math.PI / 2;
        bar.position.set(Math.cos(ang) * 0.055, Math.sin(ang) * 0.055, -0.44);
        group.add(bar);
      }
      const clamp = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 14), gripMat);
      clamp.rotation.x = Math.PI / 2;
      clamp.position.set(0, 0, -0.64);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 16), gripMat);
      handle.position.set(0, 0.11, -0.05);
      group.add(motor, clamp, handle);
      muzzlePoint.position.set(0, 0, -0.74);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.105, 0.46), metalMat);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 12), metalMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.02, -0.42);
      const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.28), accentMat);
      shroud.position.set(0, 0.01, -0.32);
      const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), accentMat);
      ammoBox.position.set(0, -0.11, -0.05);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.24), gripMat);
      stock.position.set(0, -0.01, 0.32);
      group.add(body, barrel, shroud, ammoBox, stock);
      muzzlePoint.position.set(0, 0.02, -0.68);
    }
  } else if (def.weaponClass === 'sniper') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.44), metalMat);
    const barrelLen = weaponId === 'barrett' ? 0.72 : 0.6;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, barrelLen, 12), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.018, -0.22 - barrelLen / 2);
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.04, 0.08), accentMat);
    brake.position.set(0, 0.018, -0.24 - barrelLen);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.026, 0.28, 14), gripMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.078, -0.05);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 12), accentMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.078, -0.19);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.26), gripMat);
    stock.position.set(0, -0.02, 0.32);
    group.add(body, barrel, brake, scope, lens, stock);
    muzzlePoint.position.set(0, 0.018, -0.29 - barrelLen);
  } else if (weaponId === 'flamethrower') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.42), metalMat);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 0.32, 12), accentMat);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.set(0, 0.01, -0.35);
    const tankL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.24, 12), metalMat);
    tankL.position.set(-0.07, -0.08, -0.08);
    const tankR = tankL.clone();
    tankR.position.x = 0.07;
    const pilot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: 0xfb923c }));
    pilot.position.set(0, 0.01, -0.53);
    group.add(body, nozzle, tankL, tankR, pilot);
    muzzlePoint.position.set(0, 0.01, -0.55);
  } else if (weaponId === 'rpg') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.85, 14), metalMat);
    tube.rotation.x = Math.PI / 2;
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.28, 12), woodMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.z = 0.02;
    const warhead = new THREE.Mesh(new THREE.ConeGeometry(0.068, 0.24, 12), accentMat);
    warhead.rotation.x = -Math.PI / 2;
    warhead.position.z = -0.52;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.055), gripMat);
    grip.position.set(0, -0.1, -0.08);
    group.add(tube, shroud, warhead, grip);
    muzzlePoint.position.set(0, 0.02, -0.64);
  } else {
    // Plasma / Arc Railgun / Helios Plasma Minigun
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.48), metalMat);
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.56), gripMat);
    topRail.position.set(0, 0.065, -0.26);
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.56), gripMat);
    botRail.position.set(0, -0.035, -0.26);
    for (const cz of [-0.18, -0.34, -0.5]) {
      const coil = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.055), accentMat);
      coil.position.set(0, 0.015, cz);
      group.add(coil);
    }
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), gripMat);
    grip.position.set(0, -0.1, 0.12);
    grip.rotation.x = 0.22;
    group.add(core, topRail, botRail, grip);
    muzzlePoint.position.set(0, 0.015, -0.58);
  }

  group.add(muzzlePoint);

  const flashMat = new THREE.MeshBasicMaterial({
    map: muzzleTex || null,
    color: weaponId === 'plasma' ? 0xef4444 : weaponId === 'plasma_cannon' ? 0x38bdf8 : 0xffcc66,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const flashMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), flashMat);
  flashMesh.position.copy(muzzlePoint.position);
  group.add(flashMesh);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== flashMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, muzzlePoint, flashMesh, slideMesh };
}

export function buildProjectileMesh(kind: string): THREE.Group {
  const g = new THREE.Group();
  if (kind === 'acid') {
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x4ade80 })
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.35 })
    );
    g.add(orb, halo);
    return g;
  }
  if (kind === 'rpg') {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.44, 10),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.7, roughness: 0.3 })
    );
    body.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, 0.18, 10),
      new THREE.MeshStandardMaterial({ color: '#f97316', emissive: '#ea580c', emissiveIntensity: 0.7 })
    );
    tip.rotation.x = -Math.PI / 2;
    tip.position.z = -0.3;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.24, 8),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    flame.rotation.x = Math.PI / 2;
    flame.position.z = 0.3;
    g.add(body, tip, flame);
    return g;
  }

  const def = WEAPONS[kind as WeaponId];
  const color = def?.aoeColor || '#f97316';
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 10, 10),
    new THREE.MeshStandardMaterial({
      color: def?.color || '#334155',
      emissive: color,
      emissiveIntensity: 0.6,
      roughness: 0.4,
    })
  );
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35 })
  );
  g.add(core, glow);
  return g;
}

export interface PlayerModelHandle {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  weaponMount: THREE.Group;
}

export function buildPlayerCharacterModel(
  loadout: EquippedLoadout,
  weaponId: WeaponId = 'pistol',
  contactShadowTex?: THREE.Texture
): PlayerModelHandle {
  const group = new THREE.Group();

  const shirtItem = getCustomItem(loadout.shirt);
  const outfitItem = getCustomItem(loadout.outfit);
  const skinItem = getCustomItem(loadout.skin);
  const maskItem = getCustomItem(loadout.mask);
  const glovesItem = getCustomItem(loadout.gloves);
  const accItem = getCustomItem(loadout.accessory);
  const costumeItem = getCustomItem(loadout.costume);

  const hasCostume = costumeItem && costumeItem.id !== 'costume_none';

  const skinMat = new THREE.MeshStandardMaterial({
    color: skinItem?.color || '#d6b39b',
    roughness: skinItem?.styleTag === 'synth' ? 0.3 : 0.72,
    metalness: skinItem?.styleTag === 'synth' ? 0.75 : 0.05,
    emissive: skinItem?.emissive ? new THREE.Color(skinItem.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: skinItem?.emissive ? 0.35 : 0,
  });

  const shirtMat = new THREE.MeshStandardMaterial({
    color: hasCostume ? costumeItem!.color : shirtItem?.color || '#334155',
    roughness: 0.78,
    metalness: 0.1,
  });

  const outfitMat = new THREE.MeshStandardMaterial({
    color: hasCostume ? costumeItem!.secondaryColor || costumeItem!.color : outfitItem?.color || '#1e293b',
    roughness: 0.55,
    metalness: outfitItem?.styleTag === 'heavy' || outfitItem?.styleTag === 'exo' ? 0.65 : 0.2,
    emissive: hasCostume && costumeItem?.emissive ? new THREE.Color(costumeItem.emissive) : new THREE.Color(0x000000),
    emissiveIntensity: hasCostume && costumeItem?.emissive ? 0.35 : 0,
  });

  const pantsMat = new THREE.MeshStandardMaterial({
    color: hasCostume ? costumeItem!.color : '#111827',
    roughness: 0.85,
    metalness: 0.08,
  });

  const gloveMat = new THREE.MeshStandardMaterial({
    color: glovesItem?.color || '#1e293b',
    roughness: glovesItem?.styleTag === 'steel' ? 0.3 : 0.7,
    metalness: glovesItem?.styleTag === 'steel' ? 0.8 : 0.2,
  });

  if (contactShadowTex) {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: contactShadowTex, transparent: true, opacity: 0.6, depthWrite: false })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    group.add(shadowPlane);
  }

  const legGeo = new THREE.BoxGeometry(0.18, 0.78, 0.2);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.13, 0.39, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.13, 0.39, 0);

  const bootGeo = new THREE.BoxGeometry(0.2, 0.16, 0.26);
  const leftBoot = new THREE.Mesh(bootGeo, gloveMat);
  leftBoot.position.set(0, -0.31, -0.03);
  leftLeg.add(leftBoot);
  const rightBoot = new THREE.Mesh(bootGeo, gloveMat);
  rightBoot.position.set(0, -0.31, -0.03);
  rightLeg.add(rightBoot);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), shirtMat);
  torso.position.set(0, 1.09, 0);

  const vest = new THREE.Mesh(
    new THREE.BoxGeometry(
      outfitItem?.styleTag === 'heavy' ? 0.52 : 0.49,
      outfitItem?.styleTag === 'trench' || hasCostume ? 0.88 : 0.5,
      0.3
    ),
    outfitMat
  );
  vest.position.set(0, outfitItem?.styleTag === 'trench' || hasCostume ? 0.98 : 1.12, 0);

  if (outfitItem?.styleTag === 'heavy' || outfitItem?.styleTag === 'exo' || hasCostume) {
    const padGeo = new THREE.BoxGeometry(0.18, 0.12, 0.28);
    const lPad = new THREE.Mesh(padGeo, outfitMat);
    lPad.position.set(-0.31, 1.36, 0);
    const rPad = new THREE.Mesh(padGeo, outfitMat);
    rPad.position.set(0.31, 1.36, 0);
    group.add(lPad, rPad);
  }

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
  head.position.set(0, 1.59, 0);

  if (maskItem && maskItem.styleTag !== 'none') {
    const maskMat = new THREE.MeshStandardMaterial({
      color: maskItem.color,
      roughness: 0.4,
      metalness: 0.55,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: maskItem.secondaryColor || '#ef4444',
      emissive: new THREE.Color(maskItem.emissive || '#dc2626'),
      emissiveIntensity: 1.2,
      roughness: 0.2,
    });

    if (maskItem.styleTag === 'gasmask') {
      const facePlate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.28, 0.22), maskMat);
      facePlate.position.set(0, -0.03, -0.09);
      const filterL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 10), maskMat);
      filterL.rotation.x = Math.PI / 2;
      filterL.position.set(-0.09, -0.1, -0.2);
      const filterR = filterL.clone();
      filterR.position.x = 0.09;
      const eyeL = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), visorMat);
      eyeL.rotation.x = Math.PI / 2;
      eyeL.position.set(-0.075, 0.04, -0.19);
      const eyeR = eyeL.clone();
      eyeR.position.x = 0.075;
      head.add(facePlate, filterL, filterR, eyeL, eyeR);
    } else if (maskItem.styleTag === 'nvg') {
      const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.36), maskMat);
      helmet.position.set(0, 0.1, 0);
      head.add(helmet);
      for (const ox of [-0.09, -0.03, 0.03, 0.09]) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 8), visorMat);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(ox, 0.05, -0.2);
        head.add(tube);
      }
    } else if (maskItem.styleTag === 'oni') {
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.1), maskMat);
      face.position.set(0, 0, -0.14);
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 6), visorMat);
      hornL.position.set(-0.11, 0.21, -0.14);
      hornL.rotation.z = 0.25;
      const hornR = hornL.clone();
      hornR.position.x = 0.11;
      hornR.rotation.z = -0.25;
      head.add(face, hornL, hornR);
    } else {
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), maskMat);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.06), visorMat);
      jaw.position.set(0, -0.07, -0.16);
      head.add(hood, jaw);
    }
  } else {
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.34),
      new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 })
    );
    hair.position.set(0, 0.14, 0.01);
    head.add(hair);
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.32, 1.32, 0);
  const lUpper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.15), shirtMat);
  lUpper.position.set(0, -0.18, 0);
  const lGlove = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.16), gloveMat);
  lGlove.position.set(0, -0.45, 0);
  leftArm.add(lUpper, lGlove);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.32, 1.32, 0);
  const rUpper = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.15), shirtMat);
  rUpper.position.set(0, -0.18, -0.12);
  rUpper.rotation.x = Math.PI / 3;
  const rGlove = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.16, 0.16), gloveMat);
  rGlove.position.set(0, -0.28, -0.34);
  rightArm.add(rUpper, rGlove);

  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.26, -0.42);
  const wep = buildWeaponModel(weaponId, loadout.weapon_skin);
  wep.group.scale.setScalar(0.85);
  weaponMount.add(wep.group);
  rightArm.add(weaponMount);

  if (accItem && accItem.styleTag !== 'none') {
    const accMat = new THREE.MeshStandardMaterial({
      color: accItem.color,
      roughness: 0.45,
      metalness: 0.5,
      emissive: accItem.emissive ? new THREE.Color(accItem.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: accItem.emissive ? 0.8 : 0,
    });
    if (accItem.styleTag === 'backpack') {
      const pack = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.18), accMat);
      pack.position.set(0, 1.12, 0.22);
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.05, 0.02),
        new THREE.MeshStandardMaterial({ color: '#dc2626', emissive: '#991b1b', emissiveIntensity: 0.5 })
      );
      cross.position.set(0, 1.16, 0.32);
      group.add(pack, cross);
    } else if (accItem.styleTag === 'tank') {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.46, 12), accMat);
      tank.position.set(0, 1.14, 0.22);
      group.add(tank);
    } else if (accItem.styleTag === 'blade') {
      const sheath = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.95, 0.08), accMat);
      sheath.position.set(0, 1.18, 0.2);
      sheath.rotation.z = 0.65;
      group.add(sheath);
    }
  }

  group.add(leftLeg, rightLeg, torso, vest, head, leftArm, rightArm);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, leftLeg, rightLeg, leftArm, rightArm, weaponMount };
}

export interface MonsterModelHandle {
  group: THREE.Group;
  bodyParts: THREE.Mesh[];
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  hpBarFill: THREE.Mesh;
  hpBarGroup: THREE.Group;
}

export function buildMonsterModel(type: MonsterType, contactShadowTex: THREE.Texture): MonsterModelHandle {
  const group = new THREE.Group();
  const bodyParts: THREE.Mesh[] = [];

  const isBoss = type === 'boss';
  const isBrute = type === 'brute';
  const isCrawler = type === 'crawler';
  const isPhantom = type === 'phantom';
  const isRunner = type === 'runner';
  const isSpitter = type === 'spitter';
  const isHowler = type === 'howler';
  const isSentinel = type === 'sentinel';

  const skinColor = isBoss
    ? '#2b0d11'
    : isBrute
    ? '#2f2b29'
    : isPhantom
    ? '#1e1b4b'
    : isSpitter
    ? '#1a3a22'
    : isHowler
    ? '#3b2442'
    : isSentinel
    ? '#14171f'
    : isRunner
    ? '#4a1d1f'
    : isCrawler
    ? '#3a322d'
    : '#374137';

  const fleshMat = new THREE.MeshStandardMaterial({
    color: skinColor,
    roughness: isPhantom ? 0.35 : isSentinel ? 0.35 : 0.76,
    metalness: isBoss || isBrute || isSentinel ? 0.38 : 0.06,
    transparent: isPhantom,
    opacity: isPhantom ? 0.84 : 1,
    emissive: isPhantom
      ? new THREE.Color('#312e81')
      : isBoss
      ? new THREE.Color('#450a0a')
      : isSpitter
      ? new THREE.Color('#14532d')
      : isHowler
      ? new THREE.Color('#581c87')
      : isSentinel
      ? new THREE.Color('#78350f')
      : new THREE.Color(0x000000),
    emissiveIntensity: isPhantom ? 0.7 : isBoss ? 0.5 : isSpitter || isHowler || isSentinel ? 0.35 : 0,
  });

  const boneMat = new THREE.MeshStandardMaterial({
    color: isBoss ? '#991b1b' : isSpitter ? '#4ade80' : isHowler ? '#e879f9' : isSentinel ? '#f59e0b' : '#a8a29e',
    roughness: 0.4,
    metalness: 0.3,
    emissive: isSpitter
      ? new THREE.Color('#22c55e')
      : isHowler
      ? new THREE.Color('#c026d3')
      : isSentinel
      ? new THREE.Color('#d97706')
      : isBoss
      ? new THREE.Color('#dc2626')
      : new THREE.Color(0x000000),
    emissiveIntensity: isSpitter || isHowler || isSentinel || isBoss ? 0.65 : 0,
  });

  const eyeMat = new THREE.MeshBasicMaterial({
    color: isPhantom
      ? 0x60a5fa
      : isSpitter
      ? 0x4ade80
      : isHowler
      ? 0xe879f9
      : isSentinel
      ? 0xfbbf24
      : isBoss
      ? 0xff1e1e
      : 0xef4444,
  });

  const shadowScale = isBoss ? 2.8 : isBrute || isSentinel ? 2.0 : 1.3;
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(shadowScale, shadowScale),
    new THREE.MeshBasicMaterial({ map: contactShadowTex, transparent: true, opacity: 0.65, depthWrite: false })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);

  const scale = isBoss ? 1.8 : isBrute ? 1.32 : isSentinel ? 1.2 : isHowler ? 1.06 : isRunner ? 0.94 : 1.0;

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();

  if (isCrawler) {
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.34, 0.95), fleshMat);
    torso.position.set(0, 0.38, 0);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.85), boneMat);
    spine.position.set(0, 0.56, 0.04);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.34), fleshMat);
    head.position.set(0, 0.42, 0.56);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eyeL.position.set(-0.09, 0.45, 0.73);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.09;

    const limbGeo = new THREE.BoxGeometry(0.13, 0.42, 0.13);
    const fl = new THREE.Mesh(limbGeo, fleshMat);
    fl.position.set(-0.34, 0.22, 0.32);
    fl.rotation.z = 0.45;
    leftArm.add(fl);
    const fr = new THREE.Mesh(limbGeo, fleshMat);
    fr.position.set(0.34, 0.22, 0.32);
    fr.rotation.z = -0.45;
    rightArm.add(fr);
    const bl = new THREE.Mesh(limbGeo, fleshMat);
    bl.position.set(-0.34, 0.22, -0.32);
    bl.rotation.z = 0.45;
    leftLeg.add(bl);
    const br = new THREE.Mesh(limbGeo, fleshMat);
    br.position.set(0.34, 0.22, -0.32);
    br.rotation.z = -0.45;
    rightLeg.add(br);

    bodyParts.push(torso, spine, head, fl, fr, bl, br);
    group.add(torso, spine, head, eyeL, eyeR, leftArm, rightArm, leftLeg, rightLeg);
  } else {
    const legH = 0.78 * scale;
    const legMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, legH, 0.22 * scale), fleshMat);
    legMeshL.position.set(-0.16 * scale, legH / 2, 0);
    leftLeg.add(legMeshL);

    const legMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, legH, 0.22 * scale), fleshMat);
    legMeshR.position.set(0.16 * scale, legH / 2, 0);
    rightLeg.add(legMeshR);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56 * scale, 0.72 * scale, 0.32 * scale), fleshMat);
    torso.position.set(0, legH + 0.36 * scale, 0);
    torso.rotation.x = isRunner || isSpitter ? 0.24 : 0.08;

    const ribs = new THREE.Mesh(new THREE.BoxGeometry(0.46 * scale, 0.36 * scale, 0.34 * scale), boneMat);
    ribs.position.set(0, legH + 0.4 * scale, 0.02 * scale);

    // Dorsal spine plates
    const dorsal = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.5 * scale, 0.12 * scale), boneMat);
    dorsal.position.set(0, legH + 0.42 * scale, -0.18 * scale);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.36 * scale, 0.34 * scale), fleshMat);
    head.position.set(0, legH + 0.92 * scale, 0.08 * scale);

    // Lower jaw & fangs for menacing horror silhouette
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.26 * scale, 0.11 * scale, 0.26 * scale), boneMat);
    jaw.position.set(0, legH + 0.72 * scale, 0.16 * scale);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.052 * scale, 8, 8), eyeMat);
    eyeL.position.set(-0.08 * scale, legH + 0.96 * scale, 0.25 * scale);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.08 * scale;

    leftArm.position.set(-0.38 * scale, legH + 0.62 * scale, 0.05 * scale);
    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.65 * scale, 0.16 * scale), fleshMat);
    lArmMesh.position.set(0, -0.22 * scale, 0.24 * scale);
    lArmMesh.rotation.x = -Math.PI / 2.6;
    const lClaw = new THREE.Mesh(
      new THREE.ConeGeometry(isSentinel ? 0.075 * scale : 0.06 * scale, isSentinel ? 0.48 * scale : 0.26 * scale, 5),
      boneMat
    );
    lClaw.rotation.x = Math.PI / 2;
    lClaw.position.set(0, -0.32 * scale, isSentinel ? 0.66 * scale : 0.56 * scale);
    leftArm.add(lArmMesh, lClaw);

    rightArm.position.set(0.38 * scale, legH + 0.62 * scale, 0.05 * scale);
    const rArmMesh = lArmMesh.clone();
    const rClaw = lClaw.clone();
    rightArm.add(rArmMesh, rClaw);

    if (isSpitter) {
      const sacL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), boneMat);
      sacL.position.set(-0.28, legH + 0.66, -0.14);
      const sacR = sacL.clone();
      sacR.position.x = 0.28;
      bodyParts.push(sacL, sacR);
      group.add(sacL, sacR);
    }

    if (isHowler) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.54, 5), boneMat);
      crest.position.set(0, legH + 1.28, 0.04);
      bodyParts.push(crest);
      group.add(crest);
    }

    if (isBrute) {
      const plateL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.36), boneMat);
      plateL.position.set(-0.46, legH + 0.9, 0);
      const plateR = plateL.clone();
      plateR.position.x = 0.46;
      bodyParts.push(plateL, plateR);
      group.add(plateL, plateR);
    }

    if (isSentinel || isBoss) {
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.1 * scale, 0.45 * scale, 6), boneMat);
      hornL.position.set(-0.2 * scale, legH + 1.22 * scale, 0.05);
      hornL.rotation.z = 0.35;
      const hornR = hornL.clone();
      hornR.position.x = 0.2 * scale;
      hornR.rotation.z = -0.35;
      bodyParts.push(hornL, hornR);
      group.add(hornL, hornR);
    }

    if (isBoss) {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xf97316 })
      );
      core.position.set(0, legH + 0.48 * scale, 0.22 * scale);
      const shoulderSpikeL = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 6), boneMat);
      shoulderSpikeL.position.set(-0.58, legH + 0.85 * scale, 0);
      shoulderSpikeL.rotation.z = 0.6;
      const shoulderSpikeR = shoulderSpikeL.clone();
      shoulderSpikeR.position.x = 0.58;
      shoulderSpikeR.rotation.z = -0.6;
      bodyParts.push(shoulderSpikeL, shoulderSpikeR);
      group.add(core, shoulderSpikeL, shoulderSpikeR);
    }

    bodyParts.push(legMeshL, legMeshR, torso, ribs, dorsal, head, jaw, lArmMesh, rArmMesh);
    group.add(leftLeg, rightLeg, torso, ribs, dorsal, head, jaw, eyeL, eyeR, leftArm, rightArm);
  }

  const hpBarGroup = new THREE.Group();
  const barY = isCrawler ? 1.15 : isBoss ? 3.95 : isBrute || isSentinel ? 2.9 : 2.28;
  hpBarGroup.position.set(0, barY, 0);

  const barW = isBoss ? 2.1 : 1.05;
  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(barW, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x090d14, side: THREE.DoubleSide })
  );
  const hpBarFill = new THREE.Mesh(
    new THREE.PlaneGeometry(barW - 0.06, 0.075),
    new THREE.MeshBasicMaterial({ color: isBoss ? 0xf59e0b : 0xef4444, side: THREE.DoubleSide })
  );
  hpBarFill.position.z = 0.01;
  hpBarGroup.add(bgPlane, hpBarFill);
  group.add(hpBarGroup);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== shadowPlane && o !== bgPlane && o !== hpBarFill) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  return { group, bodyParts, leftArm, rightArm, leftLeg, rightLeg, hpBarFill, hpBarGroup };
}

export function buildMedkitModel(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.3, metalness: 0.55 });
  const greenMat = new THREE.MeshStandardMaterial({
    color: '#10b981',
    emissive: '#059669',
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });
  const redMat = new THREE.MeshStandardMaterial({ color: '#dc2626', roughness: 0.45 });

  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 10), bodyMat);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.13, 10), greenMat);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.04, 0.05), redMat);
  cap.position.y = 0.13;
  const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), bodyMat);
  needle.position.y = -0.15;
  g.add(tube, core, cap, needle);
  return g;
}
