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
  const def = WEAPONS[weaponId];
  const skin = getCustomItem(weaponSkinId);
  const group = new THREE.Group();

  const bodyColor = skin && skin.id !== 'wskin_factory' ? skin.color : def.color;
  const accentColor = skin && skin.secondaryColor ? skin.secondaryColor : def.accentColor;

  const metalMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: skin?.id === 'wskin_gold' ? 0.22 : 0.35,
    metalness: 0.85,
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
    emissive: weaponId === 'plasma' ? new THREE.Color('#dc2626') : new THREE.Color(skin?.emissive || '#000000'),
    emissiveIntensity: weaponId === 'plasma' ? 1.4 : skin?.emissive ? 0.45 : 0,
  });

  const muzzlePoint = new THREE.Object3D();
  let slideMesh: THREE.Object3D | undefined;

  if (weaponId === 'pistol') {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.045, 0.22), gripMat);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.048, 0.23), metalMat);
    slide.position.set(0, 0.036, -0.005);
    slideMesh = slide;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.065), gripMat);
    grip.position.set(0, -0.07, 0.07);
    grip.rotation.x = 0.22;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 10), accentMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.034, -0.16);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.014, 0.02), accentMat);
    sight.position.set(0, 0.066, -0.1);
    group.add(frame, slide, grip, barrel, sight);
    muzzlePoint.position.set(0, 0.035, -0.23);
  } else if (weaponId === 'smg') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.085, 0.34), metalMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.18, 12), accentMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.01, -0.25);
    const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.14, 12), gripMat);
    shroud.rotation.x = Math.PI / 2;
    shroud.position.set(0, 0.01, -0.21);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.2, 0.048), accentMat);
    mag.position.set(0, -0.12, -0.05);
    mag.rotation.x = -0.15;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.13, 0.06), gripMat);
    grip.position.set(0, -0.09, 0.09);
    grip.rotation.x = 0.25;
    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.038, 0.07), accentMat);
    optic.position.set(0, 0.062, 0.02);
    group.add(receiver, barrel, shroud, mag, grip, optic);
    muzzlePoint.position.set(0, 0.01, -0.35);
  } else if (weaponId === 'shotgun') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.085, 0.32), metalMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 12), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.025, -0.36);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 10), accentMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.015, -0.32);
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.17, 10), accentMat);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, -0.015, -0.28);
    slideMesh = pump;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.11, 0.24), accentMat);
    stock.position.set(0, -0.03, 0.26);
    stock.rotation.x = 0.15;
    group.add(receiver, barrel, tube, pump, stock);
    muzzlePoint.position.set(0, 0.025, -0.62);
  } else if (weaponId === 'assault_rifle') {
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.08, 0.38), metalMat);
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.068, 0.26), accentMat);
    handguard.position.set(0, 0.005, -0.3);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 12), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.008, -0.49);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.19, 0.065), gripMat);
    mag.position.set(0, -0.12, -0.04);
    mag.rotation.x = -0.18;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.055), gripMat);
    grip.position.set(0, -0.09, 0.11);
    grip.rotation.x = 0.25;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.052, 0.11, 0.22), gripMat);
    stock.position.set(0, -0.01, 0.28);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.14, 12), accentMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.068, 0.0);
    group.add(upper, handguard, barrel, mag, grip, stock, scope);
    muzzlePoint.position.set(0, 0.008, -0.61);
  } else if (weaponId === 'sniper') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.44), metalMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.019, 0.62, 12), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.018, -0.5);
    const brake = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, 0.07), accentMat);
    brake.position.set(0, 0.018, -0.82);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.026, 0.28, 14), gripMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.078, -0.05);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.01, 12), accentMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0, 0.078, -0.19);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.26), gripMat);
    stock.position.set(0, -0.02, 0.32);
    group.add(body, barrel, brake, scope, lens, stock);
    muzzlePoint.position.set(0, 0.018, -0.86);
  } else if (weaponId === 'lmg') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.105, 0.46), metalMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 12), metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.42);
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.26), accentMat);
    shroud.position.set(0, 0.01, -0.32);
    const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), accentMat);
    ammoBox.position.set(0, -0.11, -0.05);
    const carryHandle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.06, 0.14), gripMat);
    carryHandle.position.set(0, 0.08, -0.08);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.24), gripMat);
    stock.position.set(0, -0.01, 0.32);
    group.add(body, barrel, shroud, ammoBox, carryHandle, stock);
    muzzlePoint.position.set(0, 0.02, -0.66);
  } else {
    // Plasma / Arc Railgun
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.1, 0.48), metalMat);
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.56), gripMat);
    topRail.position.set(0, 0.065, -0.26);
    const botRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.025, 0.56), gripMat);
    botRail.position.set(0, -0.035, -0.26);
    const coil1 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.06), accentMat);
    coil1.position.set(0, 0.015, -0.18);
    const coil2 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.06), accentMat);
    coil2.position.set(0, 0.015, -0.34);
    const coil3 = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.06), accentMat);
    coil3.position.set(0, 0.015, -0.5);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.06), gripMat);
    grip.position.set(0, -0.1, 0.12);
    grip.rotation.x = 0.22;
    group.add(core, topRail, botRail, coil1, coil2, coil3, grip);
    muzzlePoint.position.set(0, 0.015, -0.58);
  }

  group.add(muzzlePoint);

  const flashMat = new THREE.MeshBasicMaterial({
    map: muzzleTex || null,
    color: weaponId === 'plasma' ? 0xef4444 : 0xffcc66,
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

  // Contact shadow at feet
  if (contactShadowTex) {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: contactShadowTex, transparent: true, opacity: 0.6, depthWrite: false })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    group.add(shadowPlane);
  }

  // Legs (pivot near hip)
  const legGeo = new THREE.BoxGeometry(0.18, 0.78, 0.2);
  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.13, 0.39, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.13, 0.39, 0);

  // Boots
  const bootGeo = new THREE.BoxGeometry(0.2, 0.16, 0.26);
  const leftBoot = new THREE.Mesh(bootGeo, gloveMat);
  leftBoot.position.set(0, -0.31, -0.03);
  leftLeg.add(leftBoot);
  const rightBoot = new THREE.Mesh(bootGeo, gloveMat);
  rightBoot.position.set(0, -0.31, -0.03);
  rightLeg.add(rightBoot);

  // Torso (shirt) + Tactical Vest/Coat
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

  // Shoulder pads for heavy/exo
  if (outfitItem?.styleTag === 'heavy' || outfitItem?.styleTag === 'exo' || hasCostume) {
    const padGeo = new THREE.BoxGeometry(0.18, 0.12, 0.28);
    const lPad = new THREE.Mesh(padGeo, outfitMat);
    lPad.position.set(-0.31, 1.36, 0);
    const rPad = new THREE.Mesh(padGeo, outfitMat);
    rPad.position.set(0.31, 1.36, 0);
    group.add(lPad, rPad);
  }

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.32), skinMat);
  head.position.set(0, 1.59, 0);

  // Mask / Headgear
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
      // Skull / balaclava
      const hood = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), maskMat);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.06), visorMat);
      jaw.position.set(0, -0.07, -0.16);
      head.add(hood, jaw);
    }
  } else {
    // Simple eyes + hair cap
    const hair = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.34),
      new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.9 })
    );
    hair.position.set(0, 0.14, 0.01);
    head.add(hair);
  }

  // Arms + Gloves
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

  // Held weapon mounted in right hand
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.26, -0.42);
  const wep = buildWeaponModel(weaponId, loadout.weapon_skin);
  wep.group.scale.setScalar(0.85);
  weaponMount.add(wep.group);
  rightArm.add(weaponMount);

  // Accessories on back
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
    emissive: isSpitter ? new THREE.Color('#22c55e') : isHowler ? new THREE.Color('#c026d3') : isSentinel ? new THREE.Color('#d97706') : new THREE.Color(0x000000),
    emissiveIntensity: isSpitter || isHowler || isSentinel ? 0.65 : 0,
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

  const scale = isBoss ? 1.75 : isBrute ? 1.3 : isSentinel ? 1.18 : isHowler ? 1.05 : isRunner ? 0.94 : 1.0;

  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();

  if (isCrawler) {
    // Low four-limbed horror
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

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34 * scale, 0.36 * scale, 0.34 * scale), fleshMat);
    head.position.set(0, legH + 0.92 * scale, 0.08 * scale);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.048 * scale, 8, 8), eyeMat);
    eyeL.position.set(-0.08 * scale, legH + 0.95 * scale, 0.25 * scale);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.08 * scale;

    // Extended horror arms & claws
    leftArm.position.set(-0.38 * scale, legH + 0.62 * scale, 0.05 * scale);
    const lArmMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.65 * scale, 0.16 * scale), fleshMat);
    lArmMesh.position.set(0, -0.22 * scale, 0.24 * scale);
    lArmMesh.rotation.x = -Math.PI / 2.6;
    const lClaw = new THREE.Mesh(
      new THREE.ConeGeometry(isSentinel ? 0.07 * scale : 0.06 * scale, isSentinel ? 0.44 * scale : 0.24 * scale, 5),
      boneMat
    );
    lClaw.rotation.x = Math.PI / 2;
    lClaw.position.set(0, -0.32 * scale, isSentinel ? 0.64 * scale : 0.56 * scale);
    leftArm.add(lArmMesh, lClaw);

    rightArm.position.set(0.38 * scale, legH + 0.62 * scale, 0.05 * scale);
    const rArmMesh = lArmMesh.clone();
    const rClaw = lClaw.clone();
    rightArm.add(rArmMesh, rClaw);

    if (isSpitter) {
      const sacL = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 10), boneMat);
      sacL.position.set(-0.26, legH + 0.66, -0.14);
      const sacR = sacL.clone();
      sacR.position.x = 0.26;
      bodyParts.push(sacL, sacR);
      group.add(sacL, sacR);
    }

    if (isHowler) {
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.48, 5), boneMat);
      crest.position.set(0, legH + 1.24, 0.04);
      bodyParts.push(crest);
      group.add(crest);
    }

    if (isSentinel || isBoss) {
      const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.1 * scale, 0.42 * scale, 6), boneMat);
      hornL.position.set(-0.2 * scale, legH + 1.2 * scale, 0.05);
      hornL.rotation.z = 0.35;
      const hornR = hornL.clone();
      hornR.position.x = 0.2 * scale;
      hornR.rotation.z = -0.35;
      bodyParts.push(hornL, hornR);
      group.add(hornL, hornR);
    }

    if (isBoss) {
      const shoulderSpikeL = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.55, 6), boneMat);
      shoulderSpikeL.position.set(-0.55, legH + 0.85 * scale, 0);
      shoulderSpikeL.rotation.z = 0.6;
      const shoulderSpikeR = shoulderSpikeL.clone();
      shoulderSpikeR.position.x = 0.55;
      shoulderSpikeR.rotation.z = -0.6;
      bodyParts.push(shoulderSpikeL, shoulderSpikeR);
      group.add(shoulderSpikeL, shoulderSpikeR);
    }

    bodyParts.push(legMeshL, legMeshR, torso, ribs, head, lArmMesh, rArmMesh);
    group.add(leftLeg, rightLeg, torso, ribs, head, eyeL, eyeR, leftArm, rightArm);
  }

  // World-space Health Bar above monster
  const hpBarGroup = new THREE.Group();
  const barY = isCrawler ? 1.15 : isBoss ? 3.85 : isBrute || isSentinel ? 2.85 : 2.25;
  hpBarGroup.position.set(0, barY, 0);

  const barW = isBoss ? 2.0 : 1.05;
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
