import { COLORS, PHYSICS, SPEED_LIMIT_ZONES, STATIONS, type StationConfig } from './constants';
import {
  classifyAlignment,
  getAlignmentOffsetM,
  isTrainStopped,
  type SimulationState,
} from './engine';

export interface PerspectivePoint {
  x: number;
  y: number;
  scale: number;
}

/**
 * Projects a 3D world offset relative to the cab camera into 2D canvas coordinates.
 * worldXOffset: lateral offset in meters (negative = left platform, positive = right wall)
 * worldYOffset: vertical offset in meters relative to cab eye height (positive = up, negative = down)
 * depthZ: forward distance ahead of cab windshield in meters (> 0.5)
 */
export function projectCabPoint(
  worldXOffset: number,
  worldYOffset: number,
  depthZ: number,
  vpX: number,
  vpY: number,
  focalPx: number
): PerspectivePoint {
  const safeZ = Math.max(0.5, depthZ);
  const scale = focalPx / safeZ;
  return {
    x: vpX + worldXOffset * scale,
    y: vpY - worldYOffset * scale,
    scale,
  };
}

interface CabRainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

/**
 * First-person Conductor / Cab View renderer for the Paris Metro MP14 on Line 14.
 * Renders true 1-point perspective tunnels, vaulted modern stations, Platform Screen Doors,
 * trackside signals & signs, dynamic weather with animated windshield wipers,
 * MP14 cab A-pillars, overhead LED cab display, and an in-cab Platform CCTV monitor.
 */
export class CabViewRenderer {
  private animTime = 0;
  private wiperPhase = 0;
  private rainPool: CabRainDrop[] = [];

  constructor() {
    for (let i = 0; i < 85; i++) {
      this.rainPool.push({
        x: Math.random(),
        y: Math.random(),
        len: 10 + Math.random() * 18,
        speed: 0.45 + Math.random() * 0.65,
        alpha: 0.18 + Math.random() * 0.28,
      });
    }
  }

  public render(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState,
    dt: number
  ): void {
    this.animTime += dt;

    // Subtle realistic rubber-tired cab suspension bounce & lateral sway scaled by speed
    const speedRatio = Math.min(1, state.speedMs / PHYSICS.maxSpeedMs);
    const bounceY =
      state.phase === 'playing' && state.speedMs > 0.2
        ? Math.sin(this.animTime * (9 + speedRatio * 14)) * (1.2 + speedRatio * 2.6)
        : 0;
    const swayX =
      state.phase === 'playing' && state.speedMs > 0.2
        ? Math.cos(this.animTime * (3.2 + speedRatio * 4.5)) * (1.0 + speedRatio * 2.2)
        : 0;

    const vpX = width * 0.5 + swayX;
    const vpY = height * 0.44 + bounceY;
    const focalPx = Math.min(width, height) * 0.72;

    // Eye height is ~2.1m above trackbed; tunnel radius ~3.8m
    const eyeH = 2.15;

    ctx.save();

    // 1. Deep dark tunnel vanishing backdrop
    ctx.fillStyle = '#04070E';
    ctx.fillRect(0, 0, width, height);

    // 2. Perspective Tunnel Geometry (concrete rings, cables, overhead lamps, trackbed)
    this.drawPerspectiveTunnel(ctx, width, height, state, vpX, vpY, focalPx, eyeH);

    // 3. Perspective Vaulted Line 14 Stations (far to near)
    const visibleStations: Array<{ station: StationConfig; index: number; distToStop: number }> = [];
    for (let i = 0; i < STATIONS.length; i++) {
      const station = STATIONS[i];
      const distToStop = station.stopX - state.trainX;
      // Station spans [stopX - 96, stopX + 24]
      if (distToStop > -35 && distToStop < 240) {
        visibleStations.push({ station, index: i, distToStop });
      }
    }
    visibleStations.sort((a, b) => b.distToStop - a.distToStop);
    for (const item of visibleStations) {
      this.drawPerspectiveStation(ctx, width, height, state, item.station, item.index, vpX, vpY, focalPx, eyeH);
    }

    // 4. Trackbed, Concrete Running Beams, Steel Guide Rails & Sleepers
    this.drawPerspectiveTrackbed(ctx, width, height, state, vpX, vpY, focalPx, eyeH);

    // 5. Trackside Signals, Speed Limit Signs & Distance Countdown Boards (depth sorted far->near)
    this.drawPerspectiveTracksideObjects(ctx, width, height, state, vpX, vpY, focalPx, eyeH);

    // 6. Volumetric Headlight Illumination & Dynamic Weather (Rain / Fog / Wiper)
    this.drawCabWeatherAndHeadlights(ctx, width, height, state, dt, vpX, vpY);

    // 7. Realistic MP14 Cab Frame: Sloped A-Pillars, Sun Visor LED Readout, & Left Platform CCTV Monitor
    this.drawCabInteriorFrame(ctx, width, height, state);

    ctx.restore();
  }

  private drawPerspectiveTunnel(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState,
    vpX: number,
    vpY: number,
    focalPx: number,
    eyeH: number
  ): void {
    // Subtle dark concrete ceiling/wall gradient (lightweight linear gradient for fast 60 FPS)
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#070B14');
    bgGrad.addColorStop(0.45, '#03060C');
    bgGrad.addColorStop(1, '#111827');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Tunnel lining arches every 7m from z=135m down to z=2m
    const ringStepM = 7;
    const baseRingX = Math.floor(state.trainX / ringStepM) * ringStepM;
    const maxDrawZ = state.weather === 'fog' ? 95 : 140;

    for (let wx = baseRingX + maxDrawZ; wx >= state.trainX + 1.5; wx -= ringStepM) {
      if (this.isInsideAnyStation(wx)) continue;
      const z = wx - state.trainX;
      if (z < 1.5) continue;

      const fade = Math.max(0, Math.min(1, 1 - z / maxDrawZ));
      const pCenter = projectCabPoint(0, 0.75, z, vpX, vpY, focalPx);
      const rx = 4.2 * pCenter.scale;
      const ry = 3.55 * pCenter.scale;

      // Arched concrete segment rib
      ctx.strokeStyle = `rgba(51, 65, 85, ${(0.12 + fade * 0.42).toFixed(3)})`;
      ctx.lineWidth = Math.max(1.2, pCenter.scale * 0.24);
      ctx.beginPath();
      ctx.ellipse(pCenter.x, pCenter.y, rx, ry, 0, Math.PI * 0.92, Math.PI * 2.08);
      ctx.stroke();

      // Overhead warm-white tunnel luminaire every 21m
      if (Math.abs(Math.round(wx / ringStepM)) % 3 === 0) {
        const pLamp = projectCabPoint(0, 3.85 - eyeH, z, vpX, vpY, focalPx);
        const lampW = Math.max(2, 0.55 * pLamp.scale);
        const lampH = Math.max(1.5, 0.14 * pLamp.scale);

        ctx.fillStyle = `rgba(226, 232, 240, ${(0.15 + fade * 0.65).toFixed(3)})`;
        ctx.fillRect(pLamp.x - lampW / 2, pLamp.y - lampH / 2, lampW, lampH);

        // Soft ceiling reflection halo
        ctx.fillStyle = `rgba(226, 232, 240, ${(0.04 + fade * 0.14).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(pLamp.x, pLamp.y, lampW * 2.2, lampH * 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Converging side power conduit cables (right & left tunnel walls)
    const cableCoords = [
      { x: 3.7, y: 0.7 },
      { x: 3.75, y: 0.35 },
      { x: 3.8, y: 0.0 },
      { x: -3.7, y: 0.65 },
      { x: -3.75, y: 0.3 },
    ];
    ctx.strokeStyle = 'rgba(71, 85, 105, 0.48)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const c of cableCoords) {
      const pFar = projectCabPoint(c.x, c.y, maxDrawZ, vpX, vpY, focalPx);
      const pNear = projectCabPoint(c.x, c.y, 1.8, vpX, vpY, focalPx);
      ctx.moveTo(pFar.x, pFar.y);
      ctx.lineTo(pNear.x, pNear.y);
    }
    ctx.stroke();
  }

  private drawPerspectiveStation(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    state: SimulationState,
    station: StationConfig,
    stationIndex: number,
    vpX: number,
    vpY: number,
    focalPx: number,
    eyeH: number
  ): void {
    const startWX = station.stopX - 96;
    const endWX = station.stopX + 22;

    const zStart = Math.max(1.4, startWX - state.trainX);
    const zEnd = Math.max(1.6, endWX - state.trainX);
    if (zEnd <= 1.6) return;

    const isActiveStop = stationIndex === state.nextStationIndex;
    const psdOpen = isActiveStop ? state.doorOpenProgress : 0;

    // 1. Bright Vaulted Concrete Station Shell (far end portal to near entry)
    const pFarCenter = projectCabPoint(-1.4, 1.3, zEnd, vpX, vpY, focalPx);
    const pNearCenter = projectCabPoint(-1.4, 1.3, zStart, vpX, vpY, focalPx);

    // Fill warm-lit vaulted station interior (clamped radii for crisp fast rasterization)
    const nearRx = Math.min(1600, 6.2 * pNearCenter.scale);
    const nearRy = Math.min(1200, 4.6 * pNearCenter.scale);

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(pNearCenter.x, pNearCenter.y, nearRx, nearRy, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(pNearCenter.x + nearRx, projectCabPoint(0, -eyeH, zStart, vpX, vpY, focalPx).y);
    ctx.lineTo(pNearCenter.x - nearRx, projectCabPoint(0, -eyeH, zStart, vpX, vpY, focalPx).y);
    ctx.closePath();

    const vaultGrad = ctx.createLinearGradient(0, Math.max(-200, pNearCenter.y - nearRy), 0, Math.min(1000, pNearCenter.y + nearRy * 0.4));
    vaultGrad.addColorStop(0, station.vaultTint);
    vaultGrad.addColorStop(0.55, station.wallTint);
    vaultGrad.addColorStop(1, '#94A3B8');
    ctx.fillStyle = vaultGrad;
    ctx.fill();

    // Dark tunnel exit mouth at the far end of the station (gives dramatic depth!)
    const pExitMouth = projectCabPoint(0, 0.75, zEnd, vpX, vpY, focalPx);
    const exitRx = Math.min(900, 3.85 * pExitMouth.scale);
    const exitRy = Math.min(750, 3.25 * pExitMouth.scale);
    ctx.fillStyle = '#050811';
    ctx.beginPath();
    ctx.ellipse(pExitMouth.x, pExitMouth.y, exitRx, exitRy, 0, Math.PI * 0.92, Math.PI * 2.08);
    ctx.lineTo(pExitMouth.x + exitRx, projectCabPoint(0, -eyeH, zEnd, vpX, vpY, focalPx).y);
    ctx.lineTo(pExitMouth.x - exitRx, projectCabPoint(0, -eyeH, zEnd, vpX, vpY, focalPx).y);
    ctx.closePath();
    ctx.fill();
    void pFarCenter;

    // Helper to draw a true tapered 3D perspective wall band between zEnd (far) and zStart (near)
    const drawWallQuad = (
      xLat: number,
      yTop: number,
      yBot: number,
      fill: string
    ) => {
      const a = projectCabPoint(xLat, yTop, zEnd, vpX, vpY, focalPx);
      const b = projectCabPoint(xLat, yTop, zStart, vpX, vpY, focalPx);
      const c = projectCabPoint(xLat, yBot, zStart, vpX, vpY, focalPx);
      const d = projectCabPoint(xLat, yBot, zEnd, vpX, vpY, focalPx);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    };

    // 2. Curved Structural Vault Ribs, Ceiling Architectural Strips & Warm Cove Lights
    const ribStep = 9;
    for (let rx = endWX - 2; rx >= startWX; rx -= ribStep) {
      const z = rx - state.trainX;
      if (z < 1.8 || z > 155) continue;
      const pRib = projectCabPoint(-0.8, 1.35, z, vpX, vpY, focalPx);
      const rX = Math.min(1400, 6.0 * pRib.scale);
      const rY = Math.min(1100, 4.45 * pRib.scale);

      ctx.strokeStyle = '#2B2928';
      ctx.lineWidth = Math.max(1.5, Math.min(14, pRib.scale * 0.19));
      ctx.beginPath();
      ctx.ellipse(pRib.x, pRib.y, rX, rY, 0, Math.PI * 1.04, Math.PI * 1.96);
      ctx.stroke();

      // Overhead warm fluorescent fixture recessed into vault ceiling
      const pLight = projectCabPoint(-0.8, 5.25 - eyeH, z, vpX, vpY, focalPx);
      const lw = Math.max(4, Math.min(220, 2.2 * pLight.scale));
      const lh = Math.max(1.5, Math.min(16, 0.14 * pLight.scale));
      ctx.fillStyle = '#FEF9C3';
      ctx.fillRect(pLight.x - lw / 2, pLight.y - lh / 2, lw, lh);
      ctx.fillStyle = 'rgba(254, 249, 195, 0.22)';
      ctx.fillRect(pLight.x - lw * 0.7, pLight.y - lh * 1.4, lw * 1.4, lh * 2.8);
    }

    // 2b. Right-Side Concrete Retaining Wall & Opposite Tunnel Apron (gives balanced architectural enclosure!)
    const platHeight = 1.05 - eyeH;
    drawWallQuad(2.25, 1.65 - eyeH, -eyeH, '#2B3342');
    drawWallQuad(2.25, 1.85 - eyeH, 1.65 - eyeH, '#475569');
    drawWallQuad(3.6, 3.6 - eyeH, 1.85 - eyeH, '#64748B');
    // Line 14 purple trim stripe along right wall
    drawWallQuad(3.55, 2.65 - eyeH, 2.42 - eyeH, COLORS.line14Purple);

    // Subtle vertical concrete panel joints along right wall
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.28)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let jx = endWX - 4; jx >= startWX; jx -= 8) {
      const z = jx - state.trainX;
      if (z < 1.8 || z > 130) continue;
      const pTop = projectCabPoint(2.25, 1.65 - eyeH, z, vpX, vpY, focalPx);
      const pBot = projectCabPoint(2.25, -eyeH, z, vpX, vpY, focalPx);
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBot.x, pBot.y);
    }
    ctx.stroke();

    // 3. Left Station Platform Deck & Back Wall (stretching cleanly in perspective)
    const pPlatFarInner = projectCabPoint(-1.95, platHeight, zEnd, vpX, vpY, focalPx);
    const pPlatFarOuter = projectCabPoint(-6.8, platHeight, zEnd, vpX, vpY, focalPx);
    const pPlatNearInner = projectCabPoint(-1.95, platHeight, zStart, vpX, vpY, focalPx);
    const pPlatNearOuter = projectCabPoint(-6.8, platHeight, zStart, vpX, vpY, focalPx);
    const pPlatFarTrack = projectCabPoint(-1.95, -eyeH, zEnd, vpX, vpY, focalPx);
    const pPlatNearTrack = projectCabPoint(-1.95, -eyeH, zStart, vpX, vpY, focalPx);

    // Left rear tiled station wall
    drawWallQuad(-6.6, 4.4 - eyeH, platHeight, '#C9CFD9');
    // Tapered Line 14 Purple Frieze along left rear wall
    drawWallQuad(-6.55, 3.25 - eyeH, 2.92 - eyeH, COLORS.line14Purple);

    // Platform top surface
    ctx.fillStyle = state.weather === 'rain' ? '#252E3D' : '#313846';
    ctx.beginPath();
    ctx.moveTo(pPlatFarInner.x, pPlatFarInner.y);
    ctx.lineTo(pPlatFarOuter.x, pPlatFarOuter.y);
    ctx.lineTo(pPlatNearOuter.x, pPlatNearOuter.y);
    ctx.lineTo(pPlatNearInner.x, pPlatNearInner.y);
    ctx.closePath();
    ctx.fill();

    // Tactile safety strip along left platform deck edge
    const pEdgeFarA = projectCabPoint(-2.22, platHeight + 0.01, zEnd, vpX, vpY, focalPx);
    const pEdgeFarB = projectCabPoint(-2.36, platHeight + 0.01, zEnd, vpX, vpY, focalPx);
    const pEdgeNearB = projectCabPoint(-2.36, platHeight + 0.01, zStart, vpX, vpY, focalPx);
    const pEdgeNearA = projectCabPoint(-2.22, platHeight + 0.01, zStart, vpX, vpY, focalPx);
    ctx.fillStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.beginPath();
    ctx.moveTo(pEdgeFarA.x, pEdgeFarA.y);
    ctx.lineTo(pEdgeFarB.x, pEdgeFarB.y);
    ctx.lineTo(pEdgeNearB.x, pEdgeNearB.y);
    ctx.lineTo(pEdgeNearA.x, pEdgeNearA.y);
    ctx.closePath();
    ctx.fill();

    // Platform vertical apron wall beside track
    ctx.fillStyle = '#141923';
    ctx.beginPath();
    ctx.moveTo(pPlatFarInner.x, pPlatFarInner.y);
    ctx.lineTo(pPlatNearInner.x, pPlatNearInner.y);
    ctx.lineTo(pPlatNearTrack.x, pPlatNearTrack.y);
    ctx.lineTo(pPlatFarTrack.x, pPlatFarTrack.y);
    ctx.closePath();
    ctx.fill();

    // 4. Platform Screen Doors (PSDs) along the left platform edge as true tapered perspective quads!
    const psdTopYWorld = 3.25 - eyeH;
    // Semi-transparent PSD glass wall
    drawWallQuad(-1.98, psdTopYWorld, platHeight, 'rgba(203, 213, 225, 0.24)');
    // Anodized aluminum PSD top header beam (tapers cleanly!)
    drawWallQuad(-1.98, psdTopYWorld + 0.16, psdTopYWorld - 0.04, '#CBD5E1');
    drawWallQuad(-1.98, psdTopYWorld - 0.04, psdTopYWorld - 0.09, '#475569');
    // Lower kickplate rail
    drawWallQuad(-1.98, platHeight + 0.22, platHeight, '#334155');
    // Signature horizontal Yellow Safety Stripe across PSD glass (tapers cleanly!)
    drawWallQuad(-1.98, 2.18 - eyeH, 2.02 - eyeH, COLORS.safetyYellow);

    // Individual PSD vertical aluminum mullions + animated open doorway gaps
    for (let px = endWX - 4; px >= startWX + 4; px -= 8) {
      const z = px - state.trainX;
      if (z < 1.6 || z > 140) continue;
      const pTop = projectCabPoint(-1.98, psdTopYWorld, z, vpX, vpY, focalPx);
      const pBot = projectCabPoint(-1.98, platHeight, z, vpX, vpY, focalPx);

      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = Math.max(1.2, Math.min(10, pTop.scale * 0.1));
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBot.x, pBot.y);
      ctx.stroke();

      // If doors are open, draw warm dark doorway gap beside post
      if (psdOpen > 0.1 && z < 45) {
        const zGap = Math.max(1.5, z - 2.6 * psdOpen);
        const pGapTop = projectCabPoint(-1.98, psdTopYWorld - 0.15, zGap, vpX, vpY, focalPx);
        const pGapBot = projectCabPoint(-1.98, platHeight, zGap, vpX, vpY, focalPx);
        ctx.fillStyle = 'rgba(254, 243, 199, 0.34)';
        ctx.beginPath();
        ctx.moveTo(pTop.x, pTop.y);
        ctx.lineTo(pGapTop.x, pGapTop.y);
        ctx.lineTo(pGapBot.x, pGapBot.y);
        ctx.lineTo(pBot.x, pBot.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 4b. Station Exit Departure Signal right beside the dark tunnel portal!
    if (zEnd > 2.2 && zEnd < 130) {
      const pSig = projectCabPoint(2.05, 0.65, zEnd, vpX, vpY, focalPx);
      const sw = Math.max(6, Math.min(26, 0.42 * pSig.scale));
      const sh = Math.max(14, Math.min(58, 1.05 * pSig.scale));
      const isClear = state.doorState === 'closed' && !state.emergencyBrake;

      ctx.fillStyle = '#090D16';
      ctx.fillRect(pSig.x - sw / 2, pSig.y - sh / 2, sw, sh);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(pSig.x - sw / 2, pSig.y - sh / 2, sw, sh);

      const lampR = Math.max(2.2, sw * 0.32);
      ctx.fillStyle = isClear ? 'rgba(0, 170, 145, 0.3)' : 'rgba(239, 68, 68, 0.3)';
      ctx.beginPath();
      ctx.arc(pSig.x, pSig.y - sh * 0.2, lampR * 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isClear ? COLORS.ratpTurquoise : COLORS.signalRed;
      ctx.beginPath();
      ctx.arc(pSig.x, pSig.y - sh * 0.2, lampR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(pSig.x, pSig.y + sh * 0.22, lampR * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Waiting Commuter Silhouettes behind the PSDs on the left platform
    const actors = state.passengers[stationIndex] ?? [];
    for (let i = 0; i < actors.length; i++) {
      const actor = actors[i];
      if (actor.role === 'departed' || actor.opacity <= 0.05) continue;
      const z = actor.x - state.trainX;
      if (z < 2.2 || z > 95) continue;

      const latX = -2.65 - (1 - actor.depth) * 1.4;
      const pFoot = projectCabPoint(latX, platHeight, z, vpX, vpY, focalPx);
      const hPx = 1.72 * actor.heightScale * pFoot.scale;
      const wPx = 0.44 * pFoot.scale;

      ctx.save();
      ctx.globalAlpha = actor.opacity * Math.min(1, 1 - z / 110);
      ctx.fillStyle = actor.coatColor;
      ctx.fillRect(pFoot.x - wPx / 2, pFoot.y - hPx * 0.82, wPx, hPx * 0.56);
      ctx.fillStyle = '#D6B69C';
      ctx.beginPath();
      ctx.arc(pFoot.x, pFoot.y - hPx * 0.91, Math.max(1.5, wPx * 0.34), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 6. Parisian Enamel Blue Station Signboard & Hanging SIEL Board
    const signZ = station.stopX - 24 - state.trainX;
    if (signZ > 2.2 && signZ < 110) {
      const pSign = projectCabPoint(-3.8, 3.65 - eyeH, signZ, vpX, vpY, focalPx);
      const sw = Math.max(36, 3.6 * pSign.scale);
      const sh = Math.max(12, 0.85 * pSign.scale);

      ctx.fillStyle = COLORS.ratpBlue;
      ctx.fillRect(pSign.x - sw / 2, pSign.y - sh / 2, sw, sh);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, sh * 0.08);
      ctx.strokeRect(pSign.x - sw / 2 + 2, pSign.y - sh / 2 + 2, sw - 4, sh - 4);

      if (sh >= 14) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 ${Math.min(18, Math.max(8, sh * 0.44))}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(station.shortName.toUpperCase(), pSign.x, pSign.y + 0.5);
      }
    }

    // 7. Prominent Yellow ARRÊT Stopping Marker right at station.stopX!
    const stopZ = station.stopX - state.trainX;
    if (stopZ > 1.2 && stopZ < 120) {
      // Glowing yellow stripe across the trackbed at exact stop point
      const pLeft = projectCabPoint(-1.95, -eyeH + 0.05, stopZ, vpX, vpY, focalPx);
      const pRight = projectCabPoint(1.95, -eyeH + 0.05, stopZ, vpX, vpY, focalPx);
      ctx.strokeStyle = COLORS.safetyYellow;
      ctx.lineWidth = Math.max(2.5, pLeft.scale * 0.24);
      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.stroke();

      // Trackside ARRÊT yellow diamond board mounted at eye level on the left PSD end
      const pBoard = projectCabPoint(-2.05, 0.35, stopZ, vpX, vpY, focalPx);
      const bw = Math.max(18, 1.3 * pBoard.scale);
      const bh = Math.max(10, 0.52 * pBoard.scale);
      ctx.fillStyle = COLORS.safetyYellow;
      ctx.fillRect(pBoard.x - bw / 2, pBoard.y - bh / 2, bw, bh);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(pBoard.x - bw / 2, pBoard.y - bh / 2, bw, bh);

      if (bh >= 11) {
        ctx.fillStyle = '#0F172A';
        ctx.font = `800 ${Math.min(14, Math.max(8, bh * 0.52))}px "Plus Jakarta Sans", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('ARRÊT', pBoard.x, pBoard.y + 0.5);
      }
    }

    ctx.restore();
  }

  private drawPerspectiveTrackbed(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    state: SimulationState,
    vpX: number,
    vpY: number,
    focalPx: number,
    eyeH: number
  ): void {
    const maxZ = state.weather === 'fog' ? 95 : 145;
    const minZ = 1.1;

    // Concrete trackbed floor trapezoid
    const pFL = projectCabPoint(-2.1, -eyeH, maxZ, vpX, vpY, focalPx);
    const pFR = projectCabPoint(2.1, -eyeH, maxZ, vpX, vpY, focalPx);
    const pNL = projectCabPoint(-2.1, -eyeH, minZ, vpX, vpY, focalPx);
    const pNR = projectCabPoint(2.1, -eyeH, minZ, vpX, vpY, focalPx);

    const floorGrad = ctx.createLinearGradient(0, pFL.y, 0, pNL.y);
    floorGrad.addColorStop(0, '#070B13');
    floorGrad.addColorStop(0.5, '#18202F');
    floorGrad.addColorStop(1, '#0F1522');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.moveTo(pFL.x, pFL.y);
    ctx.lineTo(pFR.x, pFR.y);
    ctx.lineTo(pNR.x, pNR.y);
    ctx.lineTo(pNL.x, pNL.y);
    ctx.closePath();
    ctx.fill();

    // Rubber-tire concrete running tracks (characteristic of Paris Metro MP14!)
    const drawBeam = (x1: number, x2: number, color: string) => {
      const a = projectCabPoint(x1, -eyeH + 0.04, maxZ, vpX, vpY, focalPx);
      const b = projectCabPoint(x2, -eyeH + 0.04, maxZ, vpX, vpY, focalPx);
      const c = projectCabPoint(x2, -eyeH + 0.04, minZ, vpX, vpY, focalPx);
      const d = projectCabPoint(x1, -eyeH + 0.04, minZ, vpX, vpY, focalPx);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    };

    // Outer rubber-tire running strips
    drawBeam(-1.42, -1.04, '#2A3344');
    drawBeam(1.04, 1.42, '#2A3344');

    // Scrolling concrete crossties / sleepers
    const sleeperStep = 2.6;
    const firstSleeper = Math.floor(state.trainX / sleeperStep) * sleeperStep + sleeperStep;
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
    ctx.beginPath();
    for (let sx = firstSleeper; sx < state.trainX + 85; sx += sleeperStep) {
      const z = sx - state.trainX;
      if (z < 1.3) continue;
      const pL = projectCabPoint(-1.02, -eyeH + 0.02, z, vpX, vpY, focalPx);
      const pR = projectCabPoint(1.02, -eyeH + 0.02, z, vpX, vpY, focalPx);
      ctx.moveTo(pL.x, pL.y);
      ctx.lineTo(pR.x, pR.y);
    }
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gleaming inner steel safety/guidance rails
    const drawSteelRail = (rx: number) => {
      const pFar = projectCabPoint(rx, -eyeH + 0.08, maxZ, vpX, vpY, focalPx);
      const pNear = projectCabPoint(rx, -eyeH + 0.08, minZ, vpX, vpY, focalPx);
      ctx.strokeStyle = state.weather === 'rain' ? '#94A3B8' : '#CBD5E1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(pFar.x, pFar.y);
      ctx.lineTo(pNear.x, pNear.y);
      ctx.stroke();
    };

    drawSteelRail(-0.74);
    drawSteelRail(0.74);
  }

  private drawPerspectiveTracksideObjects(
    ctx: CanvasRenderingContext2D,
    _width: number,
    _height: number,
    state: SimulationState,
    vpX: number,
    vpY: number,
    focalPx: number,
    eyeH: number
  ): void {
    const nextStation = STATIONS[state.nextStationIndex];
    const maxZ = state.weather === 'fog' ? 92 : 145;

    // 1. Distance Countdown Boards (300m, 200m, 100m, 50m) on right tunnel wall
    for (const dist of [300, 200, 100, 50]) {
      const wx = nextStation.stopX - dist;
      const z = wx - state.trainX;
      if (z < 2 || z > maxZ || this.isInsideAnyStation(wx)) continue;

      const p = projectCabPoint(2.55, 0.25, z, vpX, vpY, focalPx);
      const bw = Math.max(16, 1.35 * p.scale);
      const bh = Math.max(9, 0.62 * p.scale);

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(p.x - bw / 2, p.y - bh / 2, bw, bh);
      ctx.strokeStyle = COLORS.line14PurpleLight;
      ctx.lineWidth = Math.max(1, p.scale * 0.07);
      ctx.strokeRect(p.x - bw / 2, p.y - bh / 2, bw, bh);

      if (bh >= 10) {
        ctx.fillStyle = '#F8FAFC';
        ctx.font = `700 ${Math.min(15, Math.max(8, bh * 0.52))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${dist}m`, p.x, p.y + 0.5);
      }
    }

    // 2. Trackside French Speed Limit Discs on right tunnel wall
    for (let i = 0; i < SPEED_LIMIT_ZONES.length; i++) {
      const zone = SPEED_LIMIT_ZONES[i];
      const z = zone.startX - state.trainX;
      if (z < 2 || z > maxZ || this.isInsideAnyStation(zone.startX)) continue;

      const p = projectCabPoint(2.4, 1.05, z, vpX, vpY, focalPx);
      const r = Math.max(5, 0.45 * p.scale);

      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = Math.max(1.5, r * 0.22);
      ctx.stroke();

      if (r >= 9) {
        ctx.fillStyle = '#0F172A';
        ctx.font = `800 ${Math.min(15, Math.max(8, r * 0.85))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${zone.limitKmh}`, p.x, p.y + 0.5);
      }
    }

    // 3. Glowing Paris Metro Block Signal Masts every 150m on right wall
    const signalStep = 150;
    const firstSig = Math.floor(state.trainX / signalStep) * signalStep + signalStep;
    for (let sigX = firstSig; sigX <= state.trainX + maxZ; sigX += signalStep) {
      if (sigX < 40 || this.isInsideAnyStation(sigX)) continue;
      const z = sigX - state.trainX;
      if (z < 2) continue;

      const distToNext = nextStation.stopX - sigX;
      const isAmber = distToNext > 0 && distToNext < 160;
      const color = isAmber ? COLORS.warningAmber : COLORS.signalGreen;

      const pTop = projectCabPoint(2.15, 0.7, z, vpX, vpY, focalPx);
      const pBase = projectCabPoint(2.15, -eyeH, z, vpX, vpY, focalPx);
      const boxW = Math.max(5, 0.44 * pTop.scale);
      const boxH = Math.max(12, 1.15 * pTop.scale);

      // Signal mast
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = Math.max(1.5, boxW * 0.24);
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y + boxH * 0.5);
      ctx.lineTo(pBase.x, pBase.y);
      ctx.stroke();

      // Signal housing
      ctx.fillStyle = '#090D16';
      ctx.fillRect(pTop.x - boxW / 2, pTop.y - boxH / 2, boxW, boxH);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(pTop.x - boxW / 2, pTop.y - boxH / 2, boxW, boxH);

      // Luminous signal bloom
      const lampR = Math.max(2.5, boxW * 0.34);
      const bloomR = lampR * (state.weather === 'fog' ? 6.5 : 4.2);
      ctx.fillStyle = isAmber ? 'rgba(245, 158, 11, 0.26)' : 'rgba(16, 185, 129, 0.26)';
      ctx.beginPath();
      ctx.arc(pTop.x, pTop.y - boxH * 0.18, bloomR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pTop.x, pTop.y - boxH * 0.18, lampR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(pTop.x, pTop.y + boxH * 0.22, lampR * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawCabWeatherAndHeadlights(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState,
    dt: number,
    vpX: number,
    vpY: number
  ): void {
    // Twin forward LED headlight wash illuminating the lower tunnel tracks (lightweight trapezoid glow)
    const fogBoost = state.weather === 'fog' ? state.weatherIntensity * 0.16 : 0;
    const beamGrad = ctx.createLinearGradient(0, height, 0, vpY);
    beamGrad.addColorStop(0, `rgba(224, 242, 254, ${(0.2 + fogBoost).toFixed(3)})`);
    beamGrad.addColorStop(0.55, `rgba(186, 230, 253, ${(0.08 + fogBoost * 0.5).toFixed(3)})`);
    beamGrad.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(vpX - width * 0.34, height);
    ctx.lineTo(vpX - width * 0.08, vpY);
    ctx.lineTo(vpX + width * 0.08, vpY);
    ctx.lineTo(vpX + width * 0.34, height);
    ctx.closePath();
    ctx.fill();

    const intensity = state.weatherIntensity;
    if (intensity <= 0.01) return;

    if (state.weather === 'fog') {
      // Dense mist shrouding the horizon & reducing tunnel sightlines
      const fogGrad = ctx.createLinearGradient(0, 0, 0, height);
      fogGrad.addColorStop(0, `rgba(148, 163, 184, ${(0.24 * intensity).toFixed(3)})`);
      fogGrad.addColorStop(0.45, `rgba(203, 213, 225, ${(0.58 * intensity).toFixed(3)})`);
      fogGrad.addColorStop(1, `rgba(15, 23, 42, ${(0.16 * intensity).toFixed(3)})`);
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, width, height);
    } else if (state.weather === 'rain') {
      // Rain streaks streaming outward from vanishing point + droplets on cab windshield!
      ctx.save();
      ctx.strokeStyle = `rgba(186, 230, 253, ${(0.42 * intensity).toFixed(3)})`;
      ctx.lineWidth = 1.4;

      const speedBoost = 1 + (state.speedMs / 25) * 1.4;
      for (let i = 0; i < this.rainPool.length; i++) {
        const drop = this.rainPool[i];
        drop.y += drop.speed * speedBoost * dt;
        if (drop.y > 1.05) {
          drop.y = -0.05;
          drop.x = Math.random();
        }
        const px = drop.x * width;
        const py = drop.y * height;
        const dx = (px - vpX) * 0.035;
        ctx.globalAlpha = drop.alpha * intensity;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + dx, py + drop.len);
        ctx.stroke();
      }
      ctx.restore();

      // Animated Cab Windshield Wiper sweeping smoothly across the glass during Rain!
      this.wiperPhase += dt * 2.4;
      const wiperAngle = -Math.PI * 0.14 - (Math.sin(this.wiperPhase) * 0.5 + 0.5) * Math.PI * 0.62;
      const pivotX = width * 0.52;
      const pivotY = height + 10;
      const armLen = Math.min(width * 0.42, height * 0.78);

      const tipX = pivotX + Math.cos(wiperAngle) * armLen;
      const tipY = pivotY + Math.sin(wiperAngle) * armLen;

      ctx.save();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Draws realistic MP14 driver cab interior framing:
   * - Angled dark structural A-pillars & upper windshield visor
   * - Overhead amber/white LED cab telemetry bar
   * - Right-side in-cab Platform CCTV / Alignment Monitor
   */
  private drawCabInteriorFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState
  ): void {
    const pillarTopW = Math.max(42, width * 0.055);
    const pillarBotW = Math.max(82, width * 0.095);
    const visorH = Math.max(36, height * 0.095);

    ctx.save();

    // Subtle glass top tint strip
    const tintGrad = ctx.createLinearGradient(0, visorH, 0, visorH + 34);
    tintGrad.addColorStop(0, 'rgba(15, 23, 42, 0.48)');
    tintGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = tintGrad;
    ctx.fillRect(0, visorH, width, 34);

    // Left A-pillar
    ctx.fillStyle = '#0A0F1B';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(pillarTopW + 18, 0);
    ctx.lineTo(pillarBotW, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Right A-pillar
    ctx.beginPath();
    ctx.moveTo(width, 0);
    ctx.lineTo(width - pillarTopW - 18, 0);
    ctx.lineTo(width - pillarBotW, height);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Inner metallic rubber seal bevel on both pillars
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pillarTopW + 18, 0);
    ctx.lineTo(pillarBotW, height);
    ctx.moveTo(width - pillarTopW - 18, 0);
    ctx.lineTo(width - pillarBotW, height);
    ctx.stroke();

    // Upper MP14 Cab Visor Console
    ctx.fillStyle = '#0A0F1B';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.lineTo(width - pillarTopW, visorH);
    ctx.lineTo(pillarTopW, visorH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pillarTopW, visorH);
    ctx.lineTo(width - pillarTopW, visorH);
    ctx.stroke();

    // Lower dashboard glare hood lip
    const lipH = 14;
    ctx.fillStyle = '#090E1A';
    ctx.fillRect(0, height - lipH, width, lipH);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(pillarBotW, height - lipH, width - pillarBotW * 2, 2);

    // Overhead Center LED Cab Strip (Diegetic MP14 Conductor Display)
    const nextStation = STATIONS[state.nextStationIndex];
    const distToStop = nextStation.stopX - state.trainX;
    const ledW = Math.min(350, width - 380);
    if (ledW >= 180) {
      const lx = (width - ledW) / 2;
      const ly = 7;
      const lh = visorH - 13;

      ctx.fillStyle = '#04070E';
      ctx.beginPath();
      ctx.roundRect(lx, ly, ledW, lh, 6);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Line 14 badge inside overhead display
      ctx.fillStyle = COLORS.line14Purple;
      ctx.fillRect(lx + 8, ly + 4, 22, lh - 8);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('14', lx + 19, ly + lh / 2 + 0.5);

      // Station & distance telemetry in crisp cab LED amber/white
      ctx.font = '700 11.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'left';
      ctx.fillText(`NEXT: ${nextStation.shortName.toUpperCase()}`, lx + 38, ly + lh / 2 + 0.5);

      ctx.textAlign = 'right';
      ctx.fillStyle = distToStop < 85 ? COLORS.safetyYellow : '#5EEAD4';
      const distLabel =
        distToStop >= 0 ? `${Math.round(distToStop)}m` : `+${Math.abs(distToStop).toFixed(1)}m`;
      ctx.fillText(distLabel, lx + ledW - 10, ly + lh / 2 + 0.5);
    }

    // In-Cab Platform CCTV & Alignment Monitor (mounted lower-left beside A-pillar)
    if (state.phase === 'playing') {
      this.drawCabCctvMonitor(ctx, width, height, state);
    }

    ctx.restore();
  }

  private drawCabCctvMonitor(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState
  ): void {
    const monW = Math.min(184, width * 0.16);
    const monH = 74;
    const mx = Math.max(14, width * 0.015);
    const my = height - monH - 22;

    ctx.save();
    // Monitor bezel
    ctx.fillStyle = '#0B1120';
    ctx.beginPath();
    ctx.roundRect(mx, my, monW, monH, 8);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Screen header
    ctx.fillStyle = '#94A3B8';
    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('CAB CCTV · PSD ALIGN', mx + 8, my + 6);

    const offsetM = getAlignmentOffsetM(state);
    const distToStop = -offsetM;
    const inStation = distToStop <= 85 && distToStop >= -25;

    if (inStation) {
      const absOff = Math.abs(offsetM);
      const quality = classifyAlignment(absOff);
      const stopped = isTrainStopped(state);
      const inZone = absOff <= PHYSICS.maxAllowedAlignM;

      // Alignment bar inside CCTV monitor
      const bx = mx + 8;
      const by = my + 24;
      const bw = monW - 16;
      const bh = 10;

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.fill();

      const mapOff = (m: number) => Math.max(0, Math.min(1, (m + 30) / 40));
      const z1 = bx + mapOff(-PHYSICS.maxAllowedAlignM) * bw;
      const z2 = bx + mapOff(PHYSICS.maxAllowedAlignM) * bw;
      const p1 = bx + mapOff(-PHYSICS.perfectAlignM) * bw;
      const p2 = bx + mapOff(PHYSICS.perfectAlignM) * bw;
      const cX = bx + mapOff(0) * bw;

      ctx.fillStyle = 'rgba(250, 204, 21, 0.42)';
      ctx.fillRect(z1, by, z2 - z1, bh);
      ctx.fillStyle = 'rgba(16, 185, 129, 0.8)';
      ctx.fillRect(p1, by, p2 - p1, bh);
      ctx.fillStyle = COLORS.safetyYellow;
      ctx.fillRect(cX - 1, by - 2, 2, bh + 4);

      const noseX = bx + mapOff(offsetM) * bw;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(noseX, by - 3);
      ctx.lineTo(noseX + 4, by + bh + 3);
      ctx.lineTo(noseX - 4, by + bh + 3);
      ctx.closePath();
      ctx.fill();

      // Status text inside CCTV
      let msg = `${distToStop.toFixed(1)}m TO MARK`;
      let col = '#E2E8F0';
      if (state.doorState === 'open') {
        msg = state.boardingComplete ? 'CLOSE DOORS [SPACE]' : `BOARDING ${Math.round(state.boardingProgress * 100)}%`;
        col = state.boardingComplete ? COLORS.safetyYellow : '#38BDF8';
      } else if (inZone && stopped && !state.servedCurrentStation) {
        msg = 'OPEN DOORS [SPACE]';
        col = '#10B981';
      } else if (quality === 'perfect') {
        msg = `PERFECT (${offsetM >= 0 ? '+' : ''}${offsetM.toFixed(1)}m)`;
        col = '#10B981';
      } else if (offsetM > PHYSICS.maxAllowedAlignM) {
        msg = `OVERSHOT +${offsetM.toFixed(1)}m`;
        col = '#EF4444';
      }

      ctx.fillStyle = col;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(msg, mx + 8, my + 44);

      // Door state indicator dots
      ctx.fillStyle = state.doorOpenProgress > 0.1 ? '#10B981' : '#475569';
      ctx.fillText(
        state.doorOpenProgress > 0.1 ? 'PSD: OPEN' : 'PSD: CLOSED',
        mx + 8,
        my + 58
      );
    } else {
      // Tunnel cruise monitor mode
      ctx.fillStyle = '#334155';
      ctx.fillRect(mx + 8, my + 24, monW - 16, 1);

      ctx.fillStyle = '#5EEAD4';
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.fillText(`CRUISE · ${Math.round(state.speedMs * 3.6)} KM/H`, mx + 8, my + 32);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      const weatherText =
        state.weather === 'rain'
          ? 'WIPER ON · WET RAIL'
          : state.weather === 'fog'
            ? 'FOG LIGHTS ACTIVE'
            : 'TRACK CLEAR';
      ctx.fillText(weatherText, mx + 8, my + 50);
    }

    ctx.restore();
  }

  private isInsideAnyStation(worldX: number): boolean {
    for (let i = 0; i < STATIONS.length; i++) {
      const s = STATIONS[i];
      if (worldX >= s.stopX - 96 && worldX <= s.stopX + 26) {
        return true;
      }
    }
    return false;
  }
}
