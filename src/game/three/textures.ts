import * as THREE from 'three';
import { COLORS } from '../constants';
import type { LineMode } from '../lines';

/**
 * High-Detail Procedural PBR Texture Factory (Albedo + Bump + Roughness)
 * for Paris Metro Line 14 3D assets — zero external image dependencies.
 */

function finalizeColorTex(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 8);
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

function finalizeDataTex(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = Math.min(maxAnisotropy, 8);
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

/** Deterministic fast pseudo-random for rich micro-grain weathering */
function hash2d(x: number, y: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/**
 * Converts a height/bump canvas into a true tangent-space RGB normalMap (NoColorSpace)
 * so headlights, station cove lights, and IBL catch authentic beveled edges and seams.
 */
function createNormalMapFromHeightCanvas(
  heightCanvas: HTMLCanvasElement,
  strength: number,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const hCtx = heightCanvas.getContext('2d')!;
  const src = hCtx.getImageData(0, 0, w, h).data;

  const nCanvas = document.createElement('canvas');
  nCanvas.width = w;
  nCanvas.height = h;
  const nCtx = nCanvas.getContext('2d')!;
  const out = nCtx.createImageData(w, h);
  const dst = out.data;

  const sample = (x: number, y: number) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tl = sample(x - 1, y - 1);
      const t = sample(x, y - 1);
      const tr = sample(x + 1, y - 1);
      const l = sample(x - 1, y);
      const r = sample(x + 1, y);
      const bl = sample(x - 1, y + 1);
      const b = sample(x, y + 1);
      const br = sample(x + 1, y + 1);

      const dx = (tr + 2 * r + br - (tl + 2 * l + bl)) * strength;
      const dy = (bl + 2 * b + br - (tl + 2 * t + tr)) * strength;
      const nz = 1.0;
      const invLen = 1 / Math.sqrt(dx * dx + dy * dy + nz * nz);

      const idx = (y * w + x) * 4;
      dst[idx + 0] = Math.round((-dx * invLen * 0.5 + 0.5) * 255);
      dst[idx + 1] = Math.round((-dy * invLen * 0.5 + 0.5) * 255);
      dst[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      dst[idx + 3] = 255;
    }
  }
  nCtx.putImageData(out, 0, 0);
  return finalizeDataTex(nCanvas, maxAnisotropy, repeatX, repeatY);
}

/** Realistic Parisian Line 14 architectural concrete ashlar (Albedo + Normal + Bump pair) */
export function createStationMasonryTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const ctx = colorCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  ctx.fillStyle = '#B8B4AA';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#B0B0B0';
  bctx.fillRect(0, 0, size, size);

  const rows = 8;
  const cols = 4;
  const rowH = size / rows;
  const colW = size / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (colW * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + offset;
      const y = r * rowH;
      const h = hash2d(c + 17, r + 31);
      const base = Math.floor(176 + (h - 0.5) * 26);

      // Architectural brushed concrete panel gradient (top warm light, bottom slight shadow)
      const grad = ctx.createLinearGradient(x, y, x, y + rowH);
      grad.addColorStop(0, `rgb(${base + 12}, ${base + 10}, ${base + 5})`);
      grad.addColorStop(0.5, `rgb(${base}, ${base - 2}, ${base - 6})`);
      grad.addColorStop(1, `rgb(${base - 14}, ${base - 15}, ${base - 19})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      // Subtle beveled top catchlight & bottom AO along ashlar block
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(x + 2, y + 2, colW - 4, 2);
      ctx.fillStyle = 'rgba(20,24,32,0.16)';
      ctx.fillRect(x + 2, y + rowH - 4, colW - 4, 2);

      // Formwork tie-rod pin holes (iconic modern Line 14 poured-concrete detail)
      ctx.fillStyle = 'rgba(34, 38, 46, 0.42)';
      ctx.beginPath();
      ctx.arc(x + 18, y + rowH * 0.5, 2.8, 0, Math.PI * 2);
      ctx.arc(x + colW - 18, y + rowH * 0.5, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // Bump panel face
      const bVal = Math.floor(188 + (h - 0.5) * 32);
      bctx.fillStyle = `rgb(${bVal},${bVal},${bVal})`;
      bctx.fillRect(x + 3, y + 3, colW - 6, rowH - 6);
      bctx.fillStyle = '#404040';
      bctx.beginPath();
      bctx.arc(x + 18, y + rowH * 0.5, 3, 0, Math.PI * 2);
      bctx.arc(x + colW - 18, y + rowH * 0.5, 3, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  // Subtle concrete mineral speckles & vertical weathering streaks
  for (let i = 0; i < 1600; i++) {
    const sx = Math.floor(hash2d(i, 3) * size);
    const sy = Math.floor(hash2d(i, 7) * size);
    const dark = hash2d(i, 11) > 0.5;
    ctx.fillStyle = dark ? 'rgba(30,34,42,0.10)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(sx, sy, 2, 2);
    bctx.fillStyle = dark ? 'rgba(90,90,90,0.22)' : 'rgba(240,240,240,0.2)';
    bctx.fillRect(sx, sy, 2, 2);
  }

  // Deep recessed mortar joints
  ctx.strokeStyle = 'rgba(32, 36, 44, 0.65)';
  ctx.lineWidth = 3;
  bctx.strokeStyle = '#181818';
  bctx.lineWidth = 4;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * rowH);
    ctx.lineTo(size, r * rowH);
    ctx.stroke();

    bctx.beginPath();
    bctx.moveTo(0, r * rowH);
    bctx.lineTo(size, r * rowH);
    bctx.stroke();
  }

  return {
    map: finalizeColorTex(colorCanvas, maxAnisotropy, 12, 3),
    bumpMap: finalizeDataTex(bumpCanvas, maxAnisotropy, 12, 3),
    normalMap: createNormalMapFromHeightCanvas(bumpCanvas, 2.2, maxAnisotropy, 12, 3),
  };
}

/** Weathered dark concrete TBM tunnel voussoirs with damp streaks & bolts (Albedo + Normal + Roughness) */
export function createTunnelConcreteTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const ctx = cCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bctx = bCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rctx = rCanvas.getContext('2d')!;

  ctx.fillStyle = '#181E2B';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#DEDEDE'; // dry raw concrete = rough (~0.87)
  rctx.fillRect(0, 0, size, size);

  // TBM segmental concrete rings
  const segW = 64;
  const segH = 128;
  for (let x = 0; x < size; x += segW) {
    for (let y = 0; y < size; y += segH) {
      const n = hash2d(x + 5, y + 9);
      const r = Math.floor(24 + n * 18);
      const g = Math.floor(30 + n * 18);
      const b = Math.floor(40 + n * 20);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 2, y + 2, segW - 4, segH - 4);

      // Bolt pockets on precast TBM voussoir rings
      ctx.fillStyle = '#090C12';
      ctx.fillRect(x + 8, y + 12, 6, 10);
      ctx.fillRect(x + segW - 14, y + segH - 22, 6, 10);

      bctx.fillStyle = `rgb(${144 + Math.floor(n * 42)},${144 + Math.floor(n * 42)},${144 + Math.floor(n * 42)})`;
      bctx.fillRect(x + 3, y + 3, segW - 6, segH - 6);
      bctx.fillStyle = '#202020';
      bctx.fillRect(x + 8, y + 12, 6, 10);
      bctx.fillRect(x + segW - 14, y + segH - 22, 6, 10);
    }
  }

  // Moisture seepage & soot streaks (visibly glossier under train headlights!)
  for (let i = 0; i < 42; i++) {
    const sx = hash2d(i, 19) * size;
    const sw = 4 + hash2d(i, 23) * 14;
    ctx.fillStyle = 'rgba(5, 8, 14, 0.36)';
    ctx.fillRect(sx, 0, sw, size);
    // Damp streaks are much smoother (darker in roughnessMap -> specular highlights!)
    rctx.fillStyle = 'rgba(58, 58, 58, 0.65)';
    rctx.fillRect(sx, 0, sw, size);
  }

  // Coarse gritty concrete noise
  for (let i = 0; i < 1800; i++) {
    const px = Math.floor(hash2d(i, 41) * size);
    const py = Math.floor(hash2d(i, 43) * size);
    const bright = hash2d(i, 47) > 0.55;
    ctx.fillStyle = bright ? 'rgba(130,145,165,0.09)' : 'rgba(4,6,10,0.22)';
    ctx.fillRect(px, py, 3, 2);
    bctx.fillStyle = bright ? '#C8C8C8' : '#303030';
    bctx.fillRect(px, py, 3, 2);
  }

  // Dark deep segment joints
  ctx.strokeStyle = '#070A10';
  ctx.lineWidth = 3;
  bctx.strokeStyle = '#121212';
  bctx.lineWidth = 4;
  for (let x = 0; x <= size; x += segW) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
    bctx.beginPath();
    bctx.moveTo(x, 0);
    bctx.lineTo(x, size);
    bctx.stroke();
  }

  return {
    map: finalizeColorTex(cCanvas, maxAnisotropy, 16, 4),
    bumpMap: finalizeDataTex(bCanvas, maxAnisotropy, 16, 4),
    normalMap: createNormalMapFromHeightCanvas(bCanvas, 2.8, maxAnisotropy, 16, 4),
    roughnessMap: finalizeDataTex(rCanvas, maxAnisotropy, 16, 4),
  };
}

/** Realistic Parisian speckled anthracite granite platform pavers (Albedo + Normal + Roughness) */
export function createPlatformDeckTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
} {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const ctx = cCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bctx = bCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = size;
  rCanvas.height = size;
  const rctx = rCanvas.getContext('2d')!;

  ctx.fillStyle = '#242B37';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#505050';
  bctx.fillRect(0, 0, size, size);
  rctx.fillStyle = '#C8C8C8';
  rctx.fillRect(0, 0, size, size);

  const tile = 64;
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const h = hash2d(x, y);
      const tone = Math.floor(42 + h * 18);
      ctx.fillStyle = `rgb(${tone}, ${tone + 4}, ${tone + 10})`;
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);

      const bv = Math.floor(170 + h * 30);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);

      // Alternating honed-granite sheen variation
      const rv = Math.floor(110 + h * 65);
      rctx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
    }
  }

  // Granite mineral flecking
  for (let i = 0; i < 2200; i++) {
    const px = Math.floor(hash2d(i, 61) * size);
    const py = Math.floor(hash2d(i, 67) * size);
    ctx.fillStyle = hash2d(i, 71) > 0.5 ? 'rgba(200,210,225,0.09)' : 'rgba(10,12,16,0.16)';
    ctx.fillRect(px, py, 2, 2);
  }

  return {
    map: finalizeColorTex(cCanvas, maxAnisotropy, 22, 3),
    bumpMap: finalizeDataTex(bCanvas, maxAnisotropy, 22, 3),
    normalMap: createNormalMapFromHeightCanvas(bCanvas, 2.0, maxAnisotropy, 22, 3),
    roughnessMap: finalizeDataTex(rCanvas, maxAnisotropy, 22, 3),
  };
}

/** Realistic weathered Paris Metro rubber-tire running beam texture with black Michelin tire wear streak */
export function createRubberTireTrackTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base weathered concrete/steel rollway
  ctx.fillStyle = '#566070';
  ctx.fillRect(0, 0, 256, 256);

  // Dark brushed black rubber-tire wear strip down the center of the beam!
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#5A6474');
  grad.addColorStop(0.22, '#2B313C');
  grad.addColorStop(0.5, '#171B22');
  grad.addColorStop(0.78, '#2B313C');
  grad.addColorStop(1, '#5A6474');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  // Subtle longitudinal tire scuff lines & expansion joint seam
  for (let i = 0; i < 36; i++) {
    const y = 40 + hash2d(i, 83) * 176;
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, y, 256, 1.5);
  }
  ctx.fillStyle = '#0D1016';
  ctx.fillRect(126, 0, 4, 256);

  return finalizeColorTex(canvas, maxAnisotropy, 36, 1);
}

/** Parisian RATP dark-blue enamel station nameplate with line accent bar */
export function createStationSignTexture(
  stationName: string,
  maxAnisotropy: number,
  lineMode: LineMode = 'metro14'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // White outer enamel trim
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(0, 0, 1024, 256);

  // Deep RATP navy blue core with subtle enamel vignette
  const grad = ctx.createLinearGradient(0, 14, 0, 242);
  grad.addColorStop(0, '#0047A8');
  grad.addColorStop(0.5, COLORS.ratpBlue);
  grad.addColorStop(1, '#002C6B');
  ctx.fillStyle = grad;
  ctx.fillRect(14, 14, 996, 228);

  // Line accent bar on left (Line 14 purple vs RER A Carmine Red)
  ctx.fillStyle = lineMode === 'rerA' ? COLORS.rerARed : COLORS.line14Purple;
  ctx.fillRect(28, 28, 24, 200);

  // Station name in bold Parisine-inspired uppercase
  const upper = stationName.toUpperCase();
  const fontSize = upper.length > 22 ? 48 : upper.length > 14 ? 64 : 82;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(upper, 524, 132, 910);

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Hanging Parisian SIEL overhead departure LED display */
export function createSielBoardTexture(
  stationName: string,
  maxAnisotropy: number,
  lineMode: LineMode = 'metro14',
  terminusLabel?: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  const isRer = lineMode === 'rerA';
  const destText = (terminusLabel ?? (isRer ? 'VINCENNES' : 'OLYMPIADES')).toUpperCase();

  ctx.fillStyle = '#0B1120';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 504, 184);

  ctx.fillStyle = isRer ? COLORS.rerARed : COLORS.line14Purple;
  ctx.fillRect(14, 14, 484, 52);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(isRer ? 'RER A' : 'M 14', 24, 41);

  ctx.font = '700 21px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#F1F5F9';
  ctx.fillText(destText, 132, 41, 352);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '600 18px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(stationName.toUpperCase(), 24, 92, 464);

  ctx.fillStyle = '#04070E';
  ctx.fillRect(20, 114, 224, 58);
  ctx.fillRect(268, 114, 224, 58);

  ctx.fillStyle = '#FBBF24';
  ctx.font = '700 32px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('00 min', 132, 145);
  ctx.fillText(isRer ? '04 min' : '02 min', 380, 145);

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** 3D Cab Left-Pillar Platform CCTV Quad-Feed Monitor Texture */
export function createCabCctvMonitorTexture(
  maxAnisotropy: number,
  lineMode: LineMode = 'metro14'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const isRer = lineMode === 'rerA';

  ctx.fillStyle = '#050911';
  ctx.fillRect(0, 0, 512, 320);

  // Header bar
  ctx.fillStyle = '#0F1B2E';
  ctx.fillRect(0, 0, 512, 38);
  ctx.fillStyle = isRer ? '#F87171' : '#38BDF8';
  ctx.font = '700 18px "JetBrains Mono", monospace';
  ctx.fillText(isRer ? 'CCTV QUAI · MI09 CAM 1–4' : 'CCTV QUAI · MP14 CAM 1–4', 14, 25);
  ctx.fillStyle = '#10B981';
  ctx.fillText('LIVE', 448, 25);

  // 4 realistic monochrome platform camera quadrants
  const quads = [
    { x: 10, y: 48, label: 'CAM 1 · VOITURE 1' },
    { x: 262, y: 48, label: 'CAM 2 · VOITURE 2' },
    { x: 10, y: 184, label: 'CAM 3 · VOITURE 3' },
    { x: 262, y: 184, label: isRer ? 'CAM 4 · VOITURE 4' : 'CAM 4 · QUEUE' },
  ];

  for (const q of quads) {
    const grad = ctx.createLinearGradient(q.x, q.y, q.x + 240, q.y + 126);
    grad.addColorStop(0, '#1B2736');
    grad.addColorStop(0.6, '#121B26');
    grad.addColorStop(1, '#090F17');
    ctx.fillStyle = grad;
    ctx.fillRect(q.x, q.y, 240, 126);

    // Subtle platform perspective lines inside CCTV feed
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(q.x + 25, q.y + 126);
    ctx.lineTo(q.x + 115, q.y + 38);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(q.x + 100, q.y + 126);
    ctx.lineTo(q.x + 150, q.y + 38);
    ctx.stroke();

    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(q.x, q.y, 240, 126);

    ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText(q.label, q.x + 8, q.y + 18);
  }

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** 3D Cab Right-Pillar CBTC / SACEM Radio & Line Diagnostics Screen */
export function createCabCbtcScreenTexture(
  maxAnisotropy: number,
  lineMode: LineMode = 'metro14'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;
  const isRer = lineMode === 'rerA';

  ctx.fillStyle = '#060B15';
  ctx.fillRect(0, 0, 512, 320);

  // Top bar
  ctx.fillStyle = isRer ? COLORS.rerARed : COLORS.line14Purple;
  ctx.fillRect(0, 0, 512, 42);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(isRer ? 'RER A · SACEM KVB / RATP-SNCF' : 'M14 · CBTC SAET / RATP', 16, 28);

  // System status diagnostics rows
  const rows = isRer
    ? [
        { k: 'MODE CONDUITE', v: 'KVB / SACEM ACTIF', c: '#009EE0' },
        { k: 'CATÉNAIRE', v: '1500V DC · PANTO UP', c: '#10B981' },
        { k: 'FREIN PNEU', v: '5.0 BAR · MI09', c: '#38BDF8' },
        { k: 'QUAI OUVERT', v: 'SANS FAÇADES', c: '#FBBF24' },
        { k: 'RADIO SOL-TR.', v: 'CANAL RER-A', c: '#E2E8F0' },
      ]
    : [
        { k: 'MODE CONDUITE', v: 'MANUEL CM', c: '#00AA91' },
        { k: 'TRACTION MP14', v: 'NOMINAL 750V', c: '#10B981' },
        { k: 'FREIN PNEU', v: '5.2 BAR OK', c: '#38BDF8' },
        { k: 'INTERVERROUIL.', v: 'ACTIF', c: '#FBBF24' },
        { k: 'RADIO PCC', v: 'CANAL 14A', c: '#E2E8F0' },
      ];

  rows.forEach((r, idx) => {
    const y = 78 + idx * 46;
    ctx.fillStyle = '#0D1526';
    ctx.fillRect(14, y - 24, 484, 36);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillText(r.k, 26, y);
    ctx.fillStyle = r.c;
    ctx.font = '700 17px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(r.v, 484, y);
    ctx.textAlign = 'left';
  });

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** French circular speed limit disc (40 / 50 / 60 / 70 / 80 / 100 / 120 km/h) */
export function createSpeedLimitSignTexture(
  limitKmh: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fillStyle = '#DC2626';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.font = limitKmh >= 100 ? '800 82px "JetBrains Mono", monospace' : '800 104px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(limitKmh), 128, 134);

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Yellow ARRÊT stop board texture */
export function createStopMarkerTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = COLORS.safetyYellow;
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 240, 112);

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 54px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARRÊT', 128, 68);

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Glowing green tunnel emergency exit (SORTIE) plaque */
export function createSortieSignTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#059669';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = '#A7F3D0';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 248, 88);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 42px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SORTIE →', 128, 50);

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** MP14 / MI09 front cab LED destination matrix */
export function createTrainDestinationTexture(
  maxAnisotropy: number,
  lineMode: LineMode = 'metro14',
  terminusLabel?: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const isRer = lineMode === 'rerA';
  const destText = (terminusLabel ?? (isRer ? 'VINCENNES' : 'OLYMPIADES')).toUpperCase();

  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, 512, 96);

  ctx.fillStyle = isRer ? COLORS.rerARed : COLORS.line14Purple;
  ctx.fillRect(14, 14, 78, 68);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 44px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isRer ? 'A' : '14', 53, 50);

  ctx.fillStyle = '#FDE047';
  ctx.font = '800 40px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText(destText, 112, 52, 384);

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Distance countdown board (300m, 200m, 100m, 50m) */
export function createDistanceMarkerTexture(
  meters: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 116);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '800 62px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${meters}m`, 128, 68);

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Realistic windshield rain-droplet refraction overlay texture */
export function createWindshieldRainTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 256);

  for (let i = 0; i < 210; i++) {
    const x = hash2d(i, 101) * 512;
    const y = hash2d(i, 103) * 256;
    const len = 8 + hash2d(i, 107) * 26;
    const r = 1.2 + hash2d(i, 109) * 2.2;

    const grad = ctx.createLinearGradient(x, y, x - 3, y + len);
    grad.addColorStop(0, 'rgba(186, 230, 253, 0.05)');
    grad.addColorStop(0.75, 'rgba(224, 242, 254, 0.35)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.72)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = r;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 3, y + len);
    ctx.stroke();
  }

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Realistic Alstom MP14 exterior brushed carbody panel seams & louver grille texture */
export function createTrainBodyPanelTexture(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 256;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const ctx = cCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bctx = bCanvas.getContext('2d')!;

  ctx.fillStyle = '#F2F6FA';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#C8C8C8';
  bctx.fillRect(0, 0, size, size);

  // Brushed aluminum vertical panel seams & subtle specular sheen variation
  for (let x = 0; x < size; x += 64) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.14)';
    ctx.fillRect(x, 0, 2, size);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.fillRect(x + 2, 0, 1.5, size);

    bctx.fillStyle = '#484848';
    bctx.fillRect(x, 0, 2, size);
  }

  // Subtle horizontal trim seam + rivet dots
  ctx.fillStyle = 'rgba(30, 41, 59, 0.12)';
  ctx.fillRect(0, 128, size, 2);
  bctx.fillStyle = '#585858';
  bctx.fillRect(0, 128, size, 2);

  for (let x = 10; x < size; x += 32) {
    ctx.fillStyle = 'rgba(71, 85, 105, 0.28)';
    ctx.beginPath();
    ctx.arc(x, 120, 1.5, 0, Math.PI * 2);
    ctx.arc(x, 138, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    map: finalizeColorTex(cCanvas, maxAnisotropy, 6, 1),
    normalMap: createNormalMapFromHeightCanvas(bCanvas, 1.5, maxAnisotropy, 6, 1),
  };
}

/** Yellow & black French automated tunnel speed camera advance warning sign ("RADAR") */
export function createSpeedCameraSignTexture(
  limitKmh: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#FACC15';
  ctx.fillRect(0, 0, 256, 256);

  // Diagonal hazard border
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 14;
  ctx.strokeRect(7, 7, 242, 242);

  // Radar wave icon
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(128, 72, 28, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 72, 46, Math.PI * 0.18, Math.PI * 0.82);
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.beginPath();
  ctx.arc(128, 70, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = '900 42px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('RADAR', 128, 152);

  ctx.fillStyle = '#DC2626';
  ctx.font = '800 38px "JetBrains Mono", monospace';
  ctx.fillText(`${limitKmh} MAX`, 128, 206);

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Illuminated RATP station map & neighborhood info totem texture */
export function createStationTotemTexture(
  maxAnisotropy: number,
  lineMode: LineMode = 'metro14'
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const isRer = lineMode === 'rerA';

  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, 256, 512);

  ctx.fillStyle = COLORS.ratpBlue;
  ctx.fillRect(0, 0, 256, 76);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 28px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isRer ? 'PLAN RER A' : 'PLAN M 14', 128, 48);

  // Stylized Paris transit schematic lines
  ctx.strokeStyle = isRer ? COLORS.rerARed : COLORS.line14Purple;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(40, 140);
  ctx.lineTo(128, 256);
  ctx.lineTo(212, 390);
  ctx.stroke();

  ctx.strokeStyle = isRer ? COLORS.rerABlue : COLORS.ratpTurquoise;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(30, 320);
  ctx.lineTo(220, 210);
  ctx.stroke();

  // Bottom street map block grid
  ctx.fillStyle = '#CBD5E1';
  for (let y = 390; y < 485; y += 22) {
    ctx.fillRect(22, y, 212, 12);
  }

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Monumental La Defense Grande Arche architectural concrete coffer & aluminum panel texture */
export function createDefenseConcreteTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const ctx = cCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bctx = bCanvas.getContext('2d')!;

  ctx.fillStyle = '#CBD4E0';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#707070';
  bctx.fillRect(0, 0, size, size);

  const cell = 128;
  for (let y = 0; y < size; y += cell) {
    for (let x = 0; x < size; x += cell) {
      const n = hash2d(x + 3, y + 11);
      const v = Math.floor(204 + (n - 0.5) * 16);
      const grad = ctx.createLinearGradient(x, y, x + cell, y + cell);
      grad.addColorStop(0, `rgb(${v + 8}, ${v + 12}, ${v + 18})`);
      grad.addColorStop(1, `rgb(${v - 14}, ${v - 10}, ${v - 2})`);
      ctx.fillStyle = grad;
      ctx.fillRect(x + 5, y + 5, cell - 10, cell - 10);

      // Coffered architectural recess
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.fillRect(x + 16, y + 16, cell - 32, cell - 32);

      bctx.fillStyle = '#D8D8D8';
      bctx.fillRect(x + 4, y + 4, cell - 8, cell - 8);
      bctx.fillStyle = '#8A8A8A';
      bctx.fillRect(x + 16, y + 16, cell - 32, cell - 32);
    }
  }

  for (let i = 0; i < 1400; i++) {
    const px = Math.floor(hash2d(i, 121) * size);
    const py = Math.floor(hash2d(i, 127) * size);
    ctx.fillStyle = hash2d(i, 131) > 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)';
    ctx.fillRect(px, py, 2, 2);
  }

  return {
    map: finalizeColorTex(cCanvas, maxAnisotropy, 10, 2),
    normalMap: createNormalMapFromHeightCanvas(bCanvas, 2.2, maxAnisotropy, 10, 2),
  };
}

/** Classic Parisian suburban Vincennes warm stone & brick retaining embankment texture */
export function createSuburbanBrickMasonryTextures(maxAnisotropy: number): {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
} {
  const size = 512;
  const cCanvas = document.createElement('canvas');
  cCanvas.width = size;
  cCanvas.height = size;
  const ctx = cCanvas.getContext('2d')!;

  const bCanvas = document.createElement('canvas');
  bCanvas.width = size;
  bCanvas.height = size;
  const bctx = bCanvas.getContext('2d')!;

  ctx.fillStyle = '#8F877B';
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#383838';
  bctx.fillRect(0, 0, size, size);

  const rows = 16;
  const cols = 6;
  const rowH = size / rows;
  const colW = size / cols;

  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (colW * 0.5);
    const isLimestoneBand = r < 2 || r === 8;
    for (let c = -1; c <= cols; c++) {
      const x = c * colW + off;
      const y = r * rowH;
      const h = hash2d(c + 41, r + 53);

      if (isLimestoneBand) {
        const l = Math.floor(210 + (h - 0.5) * 18);
        ctx.fillStyle = `rgb(${l + 8}, ${l + 2}, ${l - 12})`;
      } else {
        const red = Math.floor(156 + (h - 0.5) * 32);
        const grn = Math.floor(96 + (h - 0.5) * 24);
        const blu = Math.floor(72 + (h - 0.5) * 20);
        ctx.fillStyle = `rgb(${red}, ${grn}, ${blu})`;
      }
      ctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);

      const bv = Math.floor(175 + h * 45);
      bctx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bctx.fillRect(x + 2, y + 2, colW - 4, rowH - 4);
    }
  }

  return {
    map: finalizeColorTex(cCanvas, maxAnisotropy, 12, 2),
    normalMap: createNormalMapFromHeightCanvas(bCanvas, 2.4, maxAnisotropy, 12, 2),
  };
}

/** Daylight suburban Parisian sky dome / open-cut horizon backdrop texture for Vincennes */
export function createSuburbanSkyTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#1D4ED8');
  grad.addColorStop(0.42, '#60A5FA');
  grad.addColorStop(0.78, '#BAE6FD');
  grad.addColorStop(1, '#F1F5F9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Soft sunlit cirrus clouds
  for (let i = 0; i < 18; i++) {
    const cx = hash2d(i, 211) * 512;
    const cy = 48 + hash2d(i, 223) * 115;
    const rx = 38 + hash2d(i, 227) * 68;
    const ry = 10 + hash2d(i, 229) * 16;
    const cGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, rx);
    cGrad.addColorStop(0, 'rgba(255, 255, 255, 0.52)');
    cGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = cGrad;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return finalizeColorTex(canvas, maxAnisotropy);
}

/** Steel-mullioned glazed marquise skylight texture for suburban RER A canopies */
export function createCanopyGlassTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#93C5FD';
  ctx.fillRect(0, 0, 256, 256);

  // Skylight glare bands
  const grad = ctx.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, 'rgba(255,255,255,0.45)');
  grad.addColorStop(0.5, 'rgba(224,242,254,0.2)');
  grad.addColorStop(1, 'rgba(255,255,255,0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#1E3A34';
  ctx.lineWidth = 10;
  for (let x = 0; x <= 256; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  ctx.lineWidth = 6;
  for (let y = 0; y <= 256; y += 128) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }

  return finalizeColorTex(canvas, maxAnisotropy, 12, 1);
}
