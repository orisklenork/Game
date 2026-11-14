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

  // Floor
  const floorSize = def.outdoor ? 220 : def.arenaHalfSize * 2 + 2;
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
      : textures.schoolFloor;

  const floorMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: mapId === 'hospital' || mapId === 'lab' ? 0.36 : mapId === 'subway' ? 0.52 : 0.82,
      metalness: mapId === 'lab' ? 0.38 : mapId === 'subway' ? 0.22 : 0.1,
    })
  );
  const floor = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(floorSize, floorSize)), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);

  // Lighting: Warm/Cool Contrast + Key Directional Light
  const hemi = new THREE.HemisphereLight(def.lightColor, '#0b0d12', 0.78);
  group.add(hemi);

  const dirLight = new THREE.DirectionalLight(def.lightColor, 1.25);
  dirLight.position.set(18, 32, 16);
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
    dirLight.shadow.camera.far = 85;
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
      : textures.schoolWall;

  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: def.outdoor ? textures.bark : wallTex,
      roughness: mapId === 'lab' ? 0.42 : 0.78,
      metalness: mapId === 'lab' || mapId === 'subway' ? 0.35 : 0.1,
    })
  );

  // Perimeter
  const h = def.arenaHalfSize;
  if (def.outdoor) {
    // Natural dense pine grove & rock outcrop perimeter for Dark Forest (no boxy indoor walls)
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
  } else {
    // Indoor architectural perimeter walls + ceiling structural beams
    const wallH = 5.2;
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

    // Overhead structural rafters for atmospheric framing
    const beamGeo = trackGeo(new THREE.BoxGeometry(h * 2, 0.45, 0.6));
    const beamMat = trackMat(new THREE.MeshStandardMaterial({ color: '#0f131a', roughness: 0.75, metalness: 0.4 }));
    for (let z = -h + 8; z < h; z += 12) {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, wallH - 0.1, z);
      group.add(beam);
    }
  }

  // Map Obstacles & Cover Props
  const propMat = trackMat(new THREE.MeshStandardMaterial({ color: '#2b313a', roughness: 0.65, metalness: 0.3 }));
  const woodMat = trackMat(new THREE.MeshStandardMaterial({ color: '#3b2820', roughness: 0.85, metalness: 0.05 }));
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
    } else {
      const mat = obs.kind === 'wall' || obs.kind === 'pillar' ? wallMat : propMat;
      const mesh = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(obs.w, obs.h, obs.d)), mat);
      mesh.position.set(obs.x, obs.h / 2, obs.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }

  // Supply Cache Beacons (visual markers on the map)
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

    // Small glowing fixture mesh
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
