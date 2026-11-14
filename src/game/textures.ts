import * as THREE from 'three';

export interface ProceduralTextureSet {
  hospitalFloor: THREE.CanvasTexture;
  hospitalWall: THREE.CanvasTexture;
  forestFloor: THREE.CanvasTexture;
  bark: THREE.CanvasTexture;
  mansionFloor: THREE.CanvasTexture;
  mansionWall: THREE.CanvasTexture;
  labFloor: THREE.CanvasTexture;
  labWall: THREE.CanvasTexture;
  schoolFloor: THREE.CanvasTexture;
  schoolWall: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  muzzleFlash: THREE.CanvasTexture;
  particleGlow: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  isColor = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function addNoise(ctx: CanvasRenderingContext2D, w: number, h: number, alpha = 0.08) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 255 * alpha;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const all: THREE.Texture[] = [];

  // 1. Hospital dirty checkerboard clinical tile
  const [hfC, hfCtx] = makeCanvas(256, 256);
  hfCtx.fillStyle = '#1b2229';
  hfCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      hfCtx.fillStyle = (x + y) % 2 === 0 ? '#232b34' : '#181e25';
      hfCtx.fillRect(x * 64 + 1, y * 64 + 1, 62, 62);
    }
  }
  // Subtle grime & dried blood stain
  hfCtx.fillStyle = 'rgba(80, 12, 12, 0.28)';
  hfCtx.beginPath();
  hfCtx.arc(140, 110, 28, 0, Math.PI * 2);
  hfCtx.fill();
  addNoise(hfCtx, 256, 256, 0.1);
  const hospitalFloor = finalizeTexture(hfC, aniso, 14, 14);
  all.push(hospitalFloor);

  // Hospital cracked plaster & tiled lower wall
  const [hwC, hwCtx] = makeCanvas(256, 256);
  hwCtx.fillStyle = '#242d37';
  hwCtx.fillRect(0, 0, 256, 150);
  hwCtx.fillStyle = '#1a232b';
  hwCtx.fillRect(0, 150, 256, 106);
  hwCtx.fillStyle = '#5c1414';
  hwCtx.fillRect(0, 146, 256, 5);
  hwCtx.strokeStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 256; i += 32) {
    hwCtx.beginPath();
    hwCtx.moveTo(i, 150);
    hwCtx.lineTo(i, 256);
    hwCtx.stroke();
  }
  addNoise(hwCtx, 256, 256, 0.1);
  const hospitalWall = finalizeTexture(hwC, aniso, 4, 1);
  all.push(hospitalWall);

  // 2. Dark Forest soil & moss
  const [ffC, ffCtx] = makeCanvas(256, 256);
  ffCtx.fillStyle = '#111713';
  ffCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 90; i++) {
    ffCtx.fillStyle = i % 3 === 0 ? 'rgba(26, 46, 30, 0.35)' : 'rgba(30, 24, 18, 0.45)';
    ffCtx.beginPath();
    ffCtx.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 18, 0, Math.PI * 2);
    ffCtx.fill();
  }
  addNoise(ffCtx, 256, 256, 0.14);
  const forestFloor = finalizeTexture(ffC, aniso, 20, 20);
  all.push(forestFloor);

  // Tree bark
  const [bkC, bkCtx] = makeCanvas(128, 256);
  bkCtx.fillStyle = '#1c1613';
  bkCtx.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 40; i++) {
    bkCtx.fillStyle = i % 2 === 0 ? '#110d0b' : '#2a211c';
    bkCtx.fillRect(Math.random() * 124, 0, 3 + Math.random() * 5, 256);
  }
  addNoise(bkCtx, 128, 256, 0.12);
  const bark = finalizeTexture(bkC, aniso, 2, 2);
  all.push(bark);

  // 3. Haunted Mansion dark oak parquet
  const [mfC, mfCtx] = makeCanvas(256, 256);
  mfCtx.fillStyle = '#201613';
  mfCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    for (let x = 0; x < 256; x += 64) {
      mfCtx.fillStyle = ((x / 64 + y / 32) % 2 === 0) ? '#291c18' : '#1e1411';
      mfCtx.fillRect(x + 1, y + 1, 62, 30);
    }
  }
  addNoise(mfCtx, 256, 256, 0.08);
  const mansionFloor = finalizeTexture(mfC, aniso, 12, 12);
  all.push(mansionFloor);

  // Mansion damask dark crimson/charcoal wall
  const [mwC, mwCtx] = makeCanvas(256, 256);
  mwCtx.fillStyle = '#22181c';
  mwCtx.fillRect(0, 0, 256, 256);
  mwCtx.fillStyle = '#140f12';
  mwCtx.fillRect(0, 175, 256, 81);
  mwCtx.fillStyle = 'rgba(120, 22, 28, 0.18)';
  for (let y = 16; y < 165; y += 32) {
    for (let x = 16; x < 256; x += 32) {
      mwCtx.beginPath();
      mwCtx.arc(x, y, 7, 0, Math.PI * 2);
      mwCtx.fill();
    }
  }
  addNoise(mwCtx, 256, 256, 0.09);
  const mansionWall = finalizeTexture(mwC, aniso, 4, 1);
  all.push(mansionWall);

  // 4. Lab steel grating
  const [lfC, lfCtx] = makeCanvas(256, 256);
  lfCtx.fillStyle = '#101822';
  lfCtx.fillRect(0, 0, 256, 256);
  lfCtx.strokeStyle = '#223145';
  lfCtx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    lfCtx.strokeRect(i, 0, 64, 256);
    lfCtx.strokeRect(0, i, 256, 64);
  }
  lfCtx.fillStyle = '#090e14';
  for (let y = 12; y < 256; y += 32) {
    for (let x = 12; x < 256; x += 32) {
      lfCtx.fillRect(x, y, 8, 8);
    }
  }
  addNoise(lfCtx, 256, 256, 0.06);
  const labFloor = finalizeTexture(lfC, aniso, 14, 14);
  all.push(labFloor);

  // Lab metallic bulkhead wall
  const [lwC, lwCtx] = makeCanvas(256, 256);
  lwCtx.fillStyle = '#16202e';
  lwCtx.fillRect(0, 0, 256, 256);
  lwCtx.strokeStyle = '#0c121a';
  lwCtx.lineWidth = 4;
  lwCtx.strokeRect(4, 4, 248, 248);
  lwCtx.fillStyle = '#0284c7';
  lwCtx.fillRect(0, 124, 256, 4);
  addNoise(lwCtx, 256, 256, 0.06);
  const labWall = finalizeTexture(lwC, aniso, 4, 1);
  all.push(labWall);

  // 5. School worn linoleum
  const [sfC, sfCtx] = makeCanvas(256, 256);
  sfCtx.fillStyle = '#23211c';
  sfCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      sfCtx.fillStyle = (x + y) % 128 === 0 ? '#2b2822' : '#1f1d18';
      sfCtx.fillRect(x + 1, y + 1, 62, 62);
    }
  }
  addNoise(sfCtx, 256, 256, 0.11);
  const schoolFloor = finalizeTexture(sfC, aniso, 14, 14);
  all.push(schoolFloor);

  const [swC, swCtx] = makeCanvas(256, 256);
  swCtx.fillStyle = '#2c3138';
  swCtx.fillRect(0, 0, 256, 256);
  swCtx.fillStyle = '#1f2328';
  swCtx.fillRect(0, 160, 256, 96);
  addNoise(swCtx, 256, 256, 0.1);
  const schoolWall = finalizeTexture(swC, aniso, 4, 1);
  all.push(schoolWall);

  // Contact shadow radial gradient
  const [csC, csCtx] = makeCanvas(128, 128);
  const grad = csCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.32)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  csCtx.fillStyle = grad;
  csCtx.fillRect(0, 0, 128, 128);
  const contactShadow = finalizeTexture(csC, 1, 1, 1);
  all.push(contactShadow);

  // Muzzle flash star
  const [mzC, mzCtx] = makeCanvas(128, 128);
  const mGrad = mzCtx.createRadialGradient(64, 64, 2, 64, 64, 60);
  mGrad.addColorStop(0, 'rgba(255,255,235,1)');
  mGrad.addColorStop(0.3, 'rgba(255,175,65,0.9)');
  mGrad.addColorStop(0.7, 'rgba(220,38,38,0.4)');
  mGrad.addColorStop(1, 'rgba(0,0,0,0)');
  mzCtx.fillStyle = mGrad;
  mzCtx.fillRect(0, 0, 128, 128);
  const muzzleFlash = finalizeTexture(mzC, 1, 1, 1);
  all.push(muzzleFlash);

  // Particle glow
  const [pgC, pgCtx] = makeCanvas(64, 64);
  const pGrad = pgCtx.createRadialGradient(32, 32, 1, 32, 32, 30);
  pGrad.addColorStop(0, 'rgba(255,255,255,1)');
  pGrad.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  pGrad.addColorStop(1, 'rgba(255,255,255,0)');
  pgCtx.fillStyle = pGrad;
  pgCtx.fillRect(0, 0, 64, 64);
  const particleGlow = finalizeTexture(pgC, 1, 1, 1);
  all.push(particleGlow);

  return {
    hospitalFloor,
    hospitalWall,
    forestFloor,
    bark,
    mansionFloor,
    mansionWall,
    labFloor,
    labWall,
    schoolFloor,
    schoolWall,
    contactShadow,
    muzzleFlash,
    particleGlow,
    dispose: () => {
      for (const t of all) t.dispose();
    },
  };
}
