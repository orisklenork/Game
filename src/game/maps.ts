import * as THREE from 'three';
import { MapDef, MapId, MAPS } from '../shared/gameData';
import { ProceduralTextureSet } from './textures';

export interface BuiltMapHandle {
  group: THREE.Group;
  flickerLights: Array<{ light: THREE.PointLight; baseIntensity: number; phase: number }>;
  dispose: () => void;
}

export function buildHorrorMap(
  mapId: MapId,
  textures: ProceduralTextureSet,
  quality: 'low' | 'medium' | 'high',
  isSoftwareGl: boolean
): BuiltMapHandle {
  const def: MapDef = MAPS[mapId];
  const group = new THREE.Group();
  const flickerLights: Array<{ light: THREE.PointLight; baseIntensity: number; phase: number }> = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  // Floor texture per map
  const floorSize = def.outdoor && mapId !== 'rooftop' ? 220 : def.arenaHalfSize * 2 + 2;
  const floorTex =
    mapId === 'hospital'
      ? textures.hospitalFloor
      : mapId === 'forest'
      ? textures.forestFloor
      : mapId === 'mansion'
      ? textures.mansionFloor
      : mapId === 'lab'
      ? textures.labFloor
      : mapId === 'catacombs'
      ? textures.catacombsFloor
      : mapId === 'subway'
      ? textures.subwayFloor
      : mapId === 'asylum'
      ? textures.asylumFloor
      : mapId === 'factory'
      ? textures.factoryFloor
      : mapId === 'graveyard'
      ? textures.graveyardFloor
      : mapId === 'bunker'
      ? textures.bunkerFloor
      : mapId === 'rooftop'
      ? textures.rooftopFloor
      : textures.schoolFloor;

  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: mapId === 'hospital' || mapId === 'lab' ? 0.36 : mapId === 'subway' || mapId === 'factory' ? 0.52 : 0.84,
      metalness: mapId === 'lab' || mapId === 'factory' ? 0.38 : mapId === 'subway' ? 0.22 : 0.08,
    })
  );
  const floor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(floorSize, floorSize)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Lighting
  const hemi = new THREE.HemisphereLight(def.lightColor, '#0b0d12', 0.82);
  group.add(hemi);

  const dirLight = new THREE.DirectionalLight(def.lightColor, 1.3);
  dirLight.position.set(18, 34, 16);
  if (!isSoftwareGl && quality !== 'low') {
    dirLight.castShadow = true;
    const sSize = quality === 'high' ? 2048 : 1024;
    dirLight.shadow.mapSize.set(sSize, sSize);
    const d = def.arenaHalfSize + 4;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 90;
    dirLight.shadow.bias = -0.0005;
    dirLight.shadow.normalBias = 0.02;
  }
  group.add(dirLight);

  const wallTex =
    mapId === 'hospital'
      ? textures.hospitalWall
      : mapId === 'mansion'
      ? textures.mansionWall
      : mapId === 'lab'
      ? textures.labWall
      : mapId === 'catacombs'
      ? textures.catacombsWall
      : mapId === 'subway'
      ? textures.subwayWall
      : mapId === 'asylum'
      ? textures.asylumWall
      : mapId === 'factory'
      ? textures.factoryWall
      : mapId === 'bunker'
      ? textures.bunkerWall
      : textures.schoolWall;

  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: mapId === 'forest' ? textures.bark : wallTex,
      roughness: mapId === 'lab' || mapId === 'factory' ? 0.44 : 0.78,
      metalness: mapId === 'lab' || mapId === 'subway' || mapId === 'factory' ? 0.35 : 0.1,
    })
  );

  // Perimeter geometry
  const h = def.arenaHalfSize;
  if (mapId === 'forest') {
    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.45, 0.72, 7.5, 8));
    const foliageGeo = trackGeo(new THREE.ConeGeometry(2.6, 6.2, 7));
    const trunkMat = trackMat(new THREE.MeshStandardMaterial({ map: textures.bark, roughness: 0.92 }));
    const foliageMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0d1f15', roughness: 0.88 }));
    const rockGeo = trackGeo(new THREE.DodecahedronGeometry(1.8, 0));
    const rockMat = trackMat(new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.9, metalness: 0.05 }));

    const treeCount = 64;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crowns = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 32);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2;
      const dist = h + 1.5 + (i % 3) * 3.5;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const sc = 0.85 + (i % 5) * 0.12;
      dummy.position.set(x, 3.75 * sc, z);
      dummy.rotation.set(0, angle, 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(x, 7.2 * sc, z);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
    }
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();

    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2 + 0.1;
      const dist = h + 0.8;
      dummy.position.set(Math.cos(angle) * dist, 0.8, Math.sin(angle) * dist);
      dummy.rotation.set(i * 0.4, i * 0.7, 0);
      dummy.scale.set(1.2, 0.75 + (i % 3) * 0.25, 1.1);
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.computeBoundingSphere();
    group.add(trunks, crowns, rocks);
  } else if (mapId === 'graveyard') {
    // Wrought-iron graveyard fence & corner stone pillars + outer dead trees
    const ironMat = trackMat(new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.5, metalness: 0.75 }));
    const stoneMat = trackMat(new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.9 }));
    const railGeoNS = trackGeo(new THREE.BoxGeometry(h * 2 + 1, 0.14, 0.16));
    const railGeoEW = trackGeo(new THREE.BoxGeometry(0.16, 0.14, h * 2 + 1));
    [
      [0, 1.6, -h, railGeoNS],
      [0, 0.5, -h, railGeoNS],
      [0, 1.6, h, railGeoNS],
      [0, 0.5, h, railGeoNS],
      [-h, 1.6, 0, railGeoEW],
      [-h, 0.5, 0, railGeoEW],
      [h, 1.6, 0, railGeoEW],
      [h, 0.5, 0, railGeoEW],
    ].forEach(([x, y, z, geo]) => {
      const m = new THREE.Mesh(geo as THREE.BufferGeometry, ironMat);
      m.position.set(x as number, y as number, z as number);
      group.add(m);
    });

    const postGeo = trackGeo(new THREE.BoxGeometry(0.12, 2.2, 0.12));
    const pillarGeo = trackGeo(new THREE.BoxGeometry(0.9, 2.8, 0.9));
    for (let s = -h; s <= h; s += 3) {
      const isCorner = Math.abs(Math.abs(s) - h) < 0.5;
      const g = isCorner ? pillarGeo : postGeo;
      const mat = isCorner ? stoneMat : ironMat;
      const py = isCorner ? 1.4 : 1.1;
      for (const [px, pz] of [
        [s, -h],
        [s, h],
        [-h, s],
        [h, s],
      ]) {
        const post = new THREE.Mesh(g, mat);
        post.position.set(px, py, pz);
        group.add(post);
      }
    }
  } else if (mapId === 'rooftop') {
    // Low safety parapet walls + skyline perimeter silhouette blocks + Helipad H circle
    const parapetMat = trackMat(new THREE.MeshStandardMaterial({ color: '#272f3d', roughness: 0.72, metalness: 0.25 }));
    const railMat = trackMat(new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.45, metalness: 0.6 }));
    const pNS = trackGeo(new THREE.BoxGeometry(h * 2 + 1.2, 1.35, 0.9));
    const pEW = trackGeo(new THREE.BoxGeometry(0.9, 1.35, h * 2 + 1.2));
    [
      [0, 0.675, -h, pNS],
      [0, 0.675, h, pNS],
      [-h, 0.675, 0, pEW],
      [h, 0.675, 0, pEW],
    ].forEach(([x, y, z, geo]) => {
      const m = new THREE.Mesh(geo as THREE.BufferGeometry, parapetMat);
      m.position.set(x as number, y as number, z as number);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
    });

    // Helipad Landing Circle & 'H' in center
    const heliRing = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(6.8, 7.35, 36)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.72, side: THREE.DoubleSide }))
    );
    heliRing.rotation.x = -Math.PI / 2;
    heliRing.position.y = 0.025;
    group.add(heliRing);

    const hVert = trackGeo(new THREE.PlaneGeometry(0.85, 5.4));
    const hHoriz = trackGeo(new THREE.PlaneGeometry(3.4, 0.85));
    const hMat = trackMat(new THREE.MeshBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
    const hl = new THREE.Mesh(hVert, hMat);
    hl.rotation.x = -Math.PI / 2;
    hl.position.set(-1.5, 0.03, 0);
    const hr = hl.clone();
    hr.position.x = 1.5;
    const hm = new THREE.Mesh(hHoriz, hMat);
    hm.rotation.x = -Math.PI / 2;
    hm.position.set(0, 0.03, 0);
    group.add(hl, hr, hm);

    // Distant city skyscraper silhouettes below rooftop horizon
    const towerMat = trackMat(new THREE.MeshStandardMaterial({ color: '#090d16', roughness: 0.9 }));
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + 0.15;
      const dist = h + 18 + (i % 3) * 10;
      const tw = 6 + (i % 4) * 3;
      const th = 22 + (i % 5) * 8;
      const tower = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(tw, th, tw)), towerMat);
      tower.position.set(Math.cos(ang) * dist, -th / 2 + 4 + (i % 3) * 3, Math.sin(ang) * dist);
      group.add(tower);
    }

    // Amber corner strobe beacons
    for (const [bx, bz] of [
      [-h + 0.5, -h + 0.5],
      [h - 0.5, -h + 0.5],
      [-h + 0.5, h - 0.5],
      [h - 0.5, h - 0.5],
    ]) {
      const b = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 10)), railMat);
      b.position.set(bx, 1.5, bz);
      group.add(b);
    }
  } else {
    // Indoor architectural perimeter walls + ceiling structural rafters
    const wallH = 5.4;
    const wallLen = h * 2 + 1.5;
    const wallGeoNS = trackGeo(new THREE.BoxGeometry(wallLen, wallH, 1.2));
    const wallGeoEW = trackGeo(new THREE.BoxGeometry(1.2, wallH, wallLen));

    const north = new THREE.Mesh(wallGeoNS, wallMat);
    north.position.set(0, wallH / 2, -h);
    const south = new THREE.Mesh(wallGeoNS, wallMat);
    south.position.set(0, wallH / 2, h);
    const west = new THREE.Mesh(wallGeoEW, wallMat);
    west.position.set(-h, wallH / 2, 0);
    const east = new THREE.Mesh(wallGeoEW, wallMat);
    east.position.set(h, wallH / 2, 0);
    [north, south, west, east].forEach((w) => {
      w.receiveShadow = true;
      w.castShadow = true;
      group.add(w);
    });

    const beamGeo = trackGeo(new THREE.BoxGeometry(h * 2, 0.45, 0.65));
    const beamMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: mapId === 'factory' ? '#432818' : '#0f131a',
        roughness: 0.7,
        metalness: 0.45,
      })
    );
    for (let z = -h + 8; z < h; z += 12) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, wallH - 0.1, z);
      group.add(beam);
    }
  }

  // Unique Floor Details for Subway (rails) & Catacombs (arcane floor circle)
  if (mapId === 'subway') {
    const railMat = trackMat(new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.85, roughness: 0.35 }));
    const railGeo = trackGeo(new THREE.BoxGeometry(h * 1.92, 0.08, 0.14));
    for (const rz of [-1.2, 1.2]) {
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.position.set(0, 0.04, rz);
      group.add(rail);
    }
  } else if (mapId === 'catacombs') {
    const rune = new THREE.Mesh(
      trackGeo(new THREE.RingGeometry(4.2, 4.55, 32)),
      trackMat(new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.42, side: THREE.DoubleSide }))
    );
    rune.rotation.x = -Math.PI / 2;
    rune.position.y = 0.025;
    group.add(rune);
  }

  // Map Obstacles & Cover Props
  const propMat = trackMat(new THREE.MeshStandardMaterial({ color: '#2b313a', roughness: 0.65, metalness: 0.3 }));
  const crateMat = trackMat(new THREE.MeshStandardMaterial({ map: textures.crateTex, roughness: 0.58, metalness: 0.38 }));
  const woodMat = trackMat(new THREE.MeshStandardMaterial({ color: '#3b2820', roughness: 0.85, metalness: 0.05 }));
  const stoneMat = trackMat(new THREE.MeshStandardMaterial({ color: '#475569', roughness: 0.92, metalness: 0.05 }));
  const cryoMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: '#0284c7',
      emissive: '#0369a1',
      emissiveIntensity: 0.9,
      roughness: 0.2,
      metalness: 0.4,
      transparent: true,
      opacity: 0.75,
    })
  );
  const foliageMatSingle = trackMat(new THREE.MeshStandardMaterial({ color: '#0e2217', roughness: 0.88 }));
  const trainBodyMat = trackMat(new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.48, metalness: 0.55 }));
  const trainStripeMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0284c7', emissive: '#0369a1', emissiveIntensity: 0.3 }));
  const trainGlassMat = trackMat(new THREE.MeshStandardMaterial({ color: '#090d14', roughness: 0.15, metalness: 0.8 }));

  for (const obs of def.obstacles) {
    if (obs.kind === 'tree') {
      const trunk = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(obs.w * 0.35, obs.w * 0.5, obs.h, 8)), wallMat);
      trunk.position.set(obs.x, obs.h / 2, obs.z);
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      const crown = new THREE.Mesh(trackGeo(new THREE.ConeGeometry(obs.w * 1.9, 5.2, 7)), foliageMatSingle);
      crown.position.set(obs.x, obs.h - 0.8, obs.z);
      crown.castShadow = true;
      group.add(trunk, crown);
    } else if (obs.kind === 'pod') {
      const base = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(obs.w * 0.48, obs.w * 0.52, 0.5, 12)), propMat);
      base.position.set(obs.x, 0.25, obs.z);
      const cap = base.clone();
      cap.position.y = obs.h - 0.25;
      const tube = new THREE.Mesh(trackGeo(new THREE.CylinderGeometry(obs.w * 0.4, obs.w * 0.4, obs.h - 1.0, 12)), cryoMat);
      tube.position.set(obs.x, obs.h / 2, obs.z);
      group.add(base, cap, tube);
    } else if (obs.kind === 'table' || obs.kind === 'desk') {
      const top = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w, 0.16, obs.d)), woodMat);
      top.position.set(obs.x, obs.h - 0.08, obs.z);
      top.castShadow = true;
      top.receiveShadow = true;
      const under = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w * 0.82, obs.h - 0.16, obs.d * 0.82)), propMat);
      under.position.set(obs.x, (obs.h - 0.16) / 2, obs.z);
      group.add(top, under);
    } else if (obs.kind === 'crate') {
      const crate = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w, obs.h, obs.d)), crateMat);
      crate.position.set(obs.x, obs.h / 2, obs.z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      group.add(crate);
    } else if (obs.kind === 'grave') {
      // Stone plinth + headstone slab + cross detail
      const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w, 0.35, obs.d)), stoneMat);
      base.position.set(obs.x, 0.175, obs.z);
      const stone = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w * 0.8, obs.h - 0.35, obs.d * 0.62)), stoneMat);
      stone.position.set(obs.x, 0.35 + (obs.h - 0.35) / 2, obs.z);
      stone.castShadow = true;
      stone.receiveShadow = true;
      group.add(base, stone);
    } else if (obs.kind === 'train') {
      // Subway rail car with roof, side stripe, and dark windows
      const chassis = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w, obs.h * 0.86, obs.d)), trainBodyMat);
      chassis.position.set(obs.x, obs.h * 0.43 + 0.18, obs.z);
      chassis.castShadow = true;
      chassis.receiveShadow = true;
      const stripe = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w + 0.06, 0.24, obs.d + 0.06)), trainStripeMat);
      stripe.position.set(obs.x, obs.h * 0.42, obs.z);
      const windows = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w + 0.04, 0.65, obs.d * 0.88)), trainGlassMat);
      windows.position.set(obs.x, obs.h * 0.65, obs.z);
      group.add(chassis, stripe, windows);
    } else {
      const mat = obs.kind === 'wall' || obs.kind === 'pillar' ? wallMat : propMat;
      const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w, obs.h, obs.d)), mat);
      mesh.position.set(obs.x, obs.h / 2, obs.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // Supply Cache Beacons
  const beaconMat = trackMat(
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
  );
  const beaconGeo = trackGeo(new THREE.RingGeometry(0.65, 0.85, 24));
  for (const [cx, cz] of def.supplyCaches) {
    const ring = new THREE.Mesh(beaconGeo, beaconMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(cx, 0.03, cz);
    group.add(ring);
  }

  // Atmospheric Flickering Horror Point Lights (max 4 for performance)
  const lightCoords: Array<[number, number, number, string]> = [
    [-14, 3.6, -14, def.accentLightColor],
    [14, 3.6, 14, def.accentLightColor],
    [-14, 3.6, 14, def.lightColor],
    [14, 3.6, -14, def.lightColor],
  ];
  lightCoords.forEach(([lx, ly, lz, col], i) => {
    const pl = new THREE.PointLight(col, 6.5, 24, 1.7);
    pl.position.set(lx, ly, lz);
    group.add(pl);
    flickerLights.push({ light: pl, baseIntensity: 6.5, phase: i * 1.9 });

    const bulb = new THREE.Mesh(
      trackGeo(new THREE.SphereGeometry(0.14, 8, 8)),
      trackMat(new THREE.MeshBasicMaterial({ color: col }))
    );
    bulb.position.set(lx, ly + 0.15, lz);
    group.add(bulb);
  });

  return {
    group,
    flickerLights,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
