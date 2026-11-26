import { COLORS, PHYSICS, SPEED_LIMIT_ZONES, STATIONS, type StationConfig } from './constants';
import {
  TRAIN_DOOR_OFFSETS_M,
  classifyAlignment,
  getAlignmentOffsetM,
  isTrainStopped,
  type PassengerActor,
  type SimulationState,
} from './engine';

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
}

interface GlassDroplet {
  x: number;
  y: number;
  r: number;
  slideSpeed: number;
  alpha: number;
}

/**
 * High-craft 60 FPS Canvas2D renderer for Paris Metro Line 14.
 * Zero per-frame array allocations for weather particles via pre-allocated pools.
 */
export class MetroCanvasRenderer {
  private rainPool: RainDrop[] = [];
  private glassDrops: GlassDroplet[] = [];
  private animTime = 0;

  constructor() {
    // Pre-allocate weather particle pools (zero-GC during rAF)
    for (let i = 0; i < 95; i++) {
      this.rainPool.push({
        x: Math.random(),
        y: Math.random(),
        len: 14 + Math.random() * 22,
        speed: 0.75 + Math.random() * 0.65,
        alpha: 0.14 + Math.random() * 0.24,
      });
    }
    for (let i = 0; i < 28; i++) {
      this.glassDrops.push({
        x: Math.random(),
        y: Math.random(),
        r: 1.5 + Math.random() * 2.5,
        slideSpeed: 0.04 + Math.random() * 0.08,
        alpha: 0.12 + Math.random() * 0.18,
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

    // Camera calibration: train nose sits at 67% of canvas width
    const ppm = Math.max(13, Math.min(24, width / 56));
    const noseScreenX = width * 0.67;
    const worldToScreenX = (wx: number) => noseScreenX + (wx - state.trainX) * ppm;

    // Vertical layout proportions
    const trackY = height * 0.83;
    const platformY = height * 0.81;
    const trainHeight = Math.min(height * 0.36, ppm * 6.4);
    const trainBottomY = trackY - 6;
    const trainTopY = trainBottomY - trainHeight;

    ctx.save();

    // 1. Deep Tunnel Background & Parallax Architecture
    this.drawTunnelBackdrop(ctx, width, height, state, ppm, worldToScreenX, trackY);

    // 2. Visible Stations (Vault, Nameplates, Benches, Rear Wall)
    for (let i = 0; i < STATIONS.length; i++) {
      const station = STATIONS[i];
      const stLeftX = worldToScreenX(station.stopX - 96);
      const stRightX = worldToScreenX(station.stopX + 26);
      if (stRightX < -120 || stLeftX > width + 120) continue;

      this.drawStationArchitecture(
        ctx,
        station,
        i,
        stLeftX,
        stRightX,
        width,
        height,
        platformY,
        trainTopY,
        ppm,
        worldToScreenX,
        state
      );
    }

    // 3. Trackbed & Concrete Guideway
    this.drawTrackbed(ctx, width, height, state, ppm, trackY);

    // 4. Trackside Distance Markers, Speed Signs & Block Signals
    this.drawTunnelSignageAndSignals(ctx, width, height, state, ppm, worldToScreenX, trackY);

    // 5. Sleek Modern MP14 / MP05 Paris Metro Train
    this.drawMetroTrain(
      ctx,
      width,
      height,
      state,
      ppm,
      noseScreenX,
      trainTopY,
      trainBottomY,
      trainHeight
    );

    // 6. Platform Foreground Deck, Yellow Alignment Target, Platform Screen Doors & Passengers
    for (let i = 0; i < STATIONS.length; i++) {
      const station = STATIONS[i];
      const stLeftX = worldToScreenX(station.stopX - 96);
      const stRightX = worldToScreenX(station.stopX + 26);
      if (stRightX < -120 || stLeftX > width + 120) continue;

      this.drawStationForegroundAndPSDs(
        ctx,
        station,
        i,
        stLeftX,
        stRightX,
        height,
        platformY,
        trainTopY,
        trainBottomY,
        ppm,
        worldToScreenX,
        state
      );
    }

    // 7. Dynamic Weather Overlay (Fog Mist / Rain Streaks & Glass Droplets)
    this.drawWeatherEffects(ctx, width, height, state, dt, noseScreenX, trainTopY + trainHeight * 0.65);

    // 8. Top-Left Classic Mini-Train Overview & On-Screen Station Alignment Guide
    this.drawMiniOverview(ctx, state);
    if (state.phase === 'playing') {
      this.drawAlignmentGuide(ctx, width, state);
    }

    ctx.restore();
  }

  private drawTunnelBackdrop(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState,
    ppm: number,
    worldToScreenX: (wx: number) => number,
    trackY: number
  ): void {
    // Base dark tunnel gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#050811');
    bgGrad.addColorStop(0.55, '#0B1220');
    bgGrad.addColorStop(1, '#070B14');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Parallax far tunnel lining rings (slower parallax = 0.65x)
    const ringSpacingM = 16;
    const farOffset = ((state.trainX * 0.65) % ringSpacingM + ringSpacingM) % ringSpacingM;
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.24)';
    ctx.lineWidth = 3;
    for (let wx = -farOffset - ringSpacingM; wx * ppm < width + ringSpacingM * ppm; wx += ringSpacingM) {
      const sx = width - wx * ppm;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.quadraticCurveTo(sx - 28, height * 0.42, sx, trackY);
      ctx.stroke();
    }

    // Near structural tunnel concrete ribs (1:1 world space)
    const ribSpacingM = 18;
    const firstRib = Math.floor((state.trainX - 65) / ribSpacingM) * ribSpacingM;
    const lastRib = state.trainX + 60;

    for (let rx = firstRib; rx <= lastRib; rx += ribSpacingM) {
      const sx = worldToScreenX(rx);
      if (sx < -60 || sx > width + 60) continue;

      // Skip ribs inside station vaults
      if (this.isInsideAnyStation(rx)) continue;

      // Rib pillar
      ctx.fillStyle = '#111827';
      ctx.fillRect(sx - 5, 0, 10, trackY);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.fillRect(sx - 5, 0, 2, trackY);

      // Overhead warm-white tunnel luminaire every 36m
      if (Math.abs(Math.round(rx / ribSpacingM)) % 2 === 0) {
        const lampY = height * 0.14;
        const glow = ctx.createRadialGradient(sx, lampY, 2, sx, lampY, 52);
        glow.addColorStop(0, 'rgba(226, 232, 240, 0.34)');
        glow.addColorStop(0.45, 'rgba(148, 163, 184, 0.10)');
        glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(sx, lampY, 52, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(sx - 12, lampY - 2, 24, 4);
      }
    }

    // Passing high-voltage & signal cables with subtle catenary sag
    const cableSpanM = 18;
    const startCable = Math.floor((state.trainX - 70) / cableSpanM) * cableSpanM;
    const cableHeights = [height * 0.28, height * 0.33, height * 0.37];

    cableHeights.forEach((cy, idx) => {
      ctx.strokeStyle = idx === 0 ? 'rgba(71, 85, 105, 0.55)' : 'rgba(51, 65, 85, 0.42)';
      ctx.lineWidth = idx === 0 ? 2.2 : 1.5;
      ctx.beginPath();
      let started = false;
      for (let cx = startCable; cx <= state.trainX + 65; cx += cableSpanM) {
        const sx1 = worldToScreenX(cx);
        const sx2 = worldToScreenX(cx + cableSpanM);
        const midX = (sx1 + sx2) * 0.5;
        if (!started) {
          ctx.moveTo(sx1, cy);
          started = true;
        }
        ctx.quadraticCurveTo(midX, cy + 5 + idx * 2, sx2, cy);
      }
      ctx.stroke();
    });
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

  private drawStationArchitecture(
    ctx: CanvasRenderingContext2D,
    station: StationConfig,
    stationIndex: number,
    leftX: number,
    rightX: number,
    _width: number,
    _height: number,
    platformY: number,
    trainTopY: number,
    ppm: number,
    worldToScreenX: (wx: number) => number,
    _state: SimulationState
  ): void {
    const stW = rightX - leftX;
    const vaultTopY = 0;

    ctx.save();
    ctx.beginPath();
    ctx.rect(leftX, vaultTopY, stW, platformY);
    ctx.clip();

    // 1. Modern Curved Concrete / Limestone Vaulted Wall (inspired by Line 14 architecture)
    const vaultGrad = ctx.createLinearGradient(0, 0, 0, platformY);
    vaultGrad.addColorStop(0, station.vaultTint);
    vaultGrad.addColorStop(0.42, station.wallTint);
    vaultGrad.addColorStop(0.75, '#C8CDD5');
    vaultGrad.addColorStop(1, '#94A3B8');
    ctx.fillStyle = vaultGrad;
    ctx.fillRect(leftX, 0, stW, platformY);

    // Subtle stone/tile masonry courses across the vault (batched into ONE path for 60 FPS)
    const tileH = 16;
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let ty = 14; ty < trainTopY + 12; ty += tileH) {
      ctx.moveTo(leftX, ty);
      ctx.lineTo(rightX, ty);
    }
    for (let wx = station.stopX - 96; wx < station.stopX + 26; wx += 2.6) {
      const sx = worldToScreenX(wx);
      if (sx < -20 || sx > _width + 20) continue;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, trainTopY + 10);
    }
    ctx.stroke();

    // 2. Curved Dark Steel Structural Ribs (signature Line 14 vault ribs from reference)
    const ribStepM = 15;
    for (let rx = station.stopX - 90; rx <= station.stopX + 22; rx += ribStepM) {
      const sx = worldToScreenX(rx);
      if (sx < -80 || sx > _width + 80) continue;
      ctx.strokeStyle = '#332F2D';
      ctx.lineWidth = Math.max(5, ppm * 0.42);
      ctx.beginPath();
      ctx.moveTo(sx - ppm * 1.4, trainTopY + 8);
      ctx.quadraticCurveTo(sx - ppm * 0.2, trainTopY * 0.45, sx + ppm * 1.1, 0);
      ctx.stroke();

      // Lightweight warm architectural uplight wash beside each rib
      ctx.fillStyle = 'rgba(255, 244, 214, 0.24)';
      ctx.beginPath();
      ctx.ellipse(sx, trainTopY - 12, ppm * 2.8, ppm * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Dark Horizontal Canopy Beam, Warm Indirect Cove Strip & Line 14 Purple Frieze
    const beamY = trainTopY - 16;
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(leftX, beamY, stW, 18);
    // Warm architectural LED cove glow just above canopy beam
    ctx.fillStyle = 'rgba(254, 243, 199, 0.65)';
    ctx.fillRect(leftX, beamY - 2, stW, 2.5);
    ctx.fillStyle = COLORS.line14Purple;
    ctx.fillRect(leftX, beamY + 14, stW, 4);

    // 3b. Authentic RATP SIEL Hanging Next-Train LED Display suspended from station ceiling
    const sielOffsets = [-34, -4];
    for (const so of sielOffsets) {
      const sx = worldToScreenX(station.stopX + so);
      if (sx < -100 || sx > _width + 100) continue;
      const sw = 104;
      const sh = 26;
      const sy = Math.max(8, beamY - 78);

      // Suspension rods
      ctx.fillStyle = '#334155';
      ctx.fillRect(sx - 34, 0, 2, sy);
      ctx.fillRect(sx + 32, 0, 2, sy);

      // SIEL dark housing
      ctx.fillStyle = '#0B1120';
      ctx.fillRect(sx - sw / 2, sy, sw, sh);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - sw / 2, sy, sw, sh);

      // Line 14 badge + amber LED next train readout
      ctx.fillStyle = COLORS.line14Purple;
      ctx.fillRect(sx - sw / 2 + 4, sy + 5, 16, 16);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('14', sx - sw / 2 + 12, sy + 13.5);

      ctx.fillStyle = '#FACC15';
      ctx.font = '700 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('OLYMPIADES', sx - sw / 2 + 24, sy + 10);
      ctx.fillStyle = '#5EEAD4';
      ctx.fillText(stationIndex === _state.nextStationIndex ? 'À QUAI' : '02 MIN', sx - sw / 2 + 24, sy + 20);
    }

    // 4. Crisp Parisian Dark Blue Enamel Station Nameplates (repeated along platform)
    const nameplateOffsets = [-74, -46, -18, 8];
    const plateH = Math.max(24, Math.min(34, ppm * 1.65));
    const plateY = Math.max(18, beamY - plateH - 14);

    for (const offset of nameplateOffsets) {
      const px = worldToScreenX(station.stopX + offset);
      const label = station.shortName.toUpperCase();
      ctx.font = `700 ${Math.max(11, Math.min(15, ppm * 0.72))}px "Plus Jakarta Sans", sans-serif`;
      const textW = ctx.measureText(label).width;
      const plateW = Math.max(118, textW + 34);

      // Subtle shadow
      ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
      ctx.fillRect(px - plateW / 2 + 2, plateY + 3, plateW, plateH);

      // Parisian RATP enamel blue plaque
      ctx.fillStyle = COLORS.ratpBlue;
      ctx.fillRect(px - plateW / 2, plateY, plateW, plateH);

      // Crisp white inner frame
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - plateW / 2 + 3, plateY + 3, plateW - 6, plateH - 6);

      // Station name text
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px, plateY + plateH / 2 + 0.5);
    }

    // 5. Rear Platform Wall Benches & Metro Maps (visible behind/between PSDs)
    const benchOffsets = [-62, -32, -4];
    for (const bo of benchOffsets) {
      const bx = worldToScreenX(station.stopX + bo);
      const benchW = ppm * 3.8;
      const benchY = platformY - ppm * 1.15;

      // Backlit Line 14 info board above bench
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(bx - benchW * 0.42, benchY - ppm * 2.1, benchW * 0.84, ppm * 1.45);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bx - benchW * 0.42, benchY - ppm * 2.1, benchW * 0.84, ppm * 1.45);
      ctx.fillStyle = COLORS.line14Purple;
      ctx.fillRect(bx - benchW * 0.36, benchY - ppm * 1.5, benchW * 0.72, 3);

      // Modern RATP metallic bench
      ctx.fillStyle = '#334155';
      ctx.fillRect(bx - benchW / 2, benchY, benchW, 6);
      ctx.fillStyle = '#64748B';
      ctx.fillRect(bx - benchW / 2 + 4, benchY + 6, 4, ppm * 0.8);
      ctx.fillRect(bx + benchW / 2 - 8, benchY + 6, 4, ppm * 0.8);
    }

    ctx.restore();

    // 6. Curved Tunnel Portal Hoods at Station Entry & Exit (smooth transition from dark tunnel)
    this.drawPortalHood(ctx, leftX, platformY, 'left');
    this.drawPortalHood(ctx, rightX, platformY, 'right');

    // Subtle station number plaque near exit portal
    if (stationIndex === STATIONS.length - 1) {
      // Terminus buffer stop light at Olympiades
      const bufX = worldToScreenX(station.stopX + 14);
      ctx.fillStyle = '#B91C1C';
      ctx.fillRect(bufX, platformY - 26, 8, 26);
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(bufX + 4, platformY - 18, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPortalHood(
    ctx: CanvasRenderingContext2D,
    edgeX: number,
    platformY: number,
    side: 'left' | 'right'
  ): void {
    const dir = side === 'right' ? 1 : -1;
    ctx.save();
    ctx.fillStyle = '#181D27';
    ctx.beginPath();
    ctx.moveTo(edgeX, 0);
    ctx.lineTo(edgeX + dir * 24, 0);
    ctx.quadraticCurveTo(edgeX - dir * 10, platformY * 0.48, edgeX + dir * 6, platformY);
    ctx.lineTo(edgeX - dir * 12, platformY);
    ctx.quadraticCurveTo(edgeX - dir * 24, platformY * 0.48, edgeX, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawTrackbed(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState,
    ppm: number,
    trackY: number
  ): void {
    // Concrete track deck
    const deckGrad = ctx.createLinearGradient(0, trackY, 0, height);
    deckGrad.addColorStop(0, '#1E2532');
    deckGrad.addColorStop(0.25, '#111622');
    deckGrad.addColorStop(1, '#090D16');
    ctx.fillStyle = deckGrad;
    ctx.fillRect(0, trackY, width, height - trackY);

    // Metallic guide rails
    ctx.fillStyle = '#64748B';
    ctx.fillRect(0, trackY - 2, width, 3);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, trackY + 6, width, 4);

    // Scrolling concrete track sleepers (gives crisp sense of speed in tunnels)
    const sleeperStepM = 2.4;
    const offsetM = ((state.trainX % sleeperStepM) + sleeperStepM) % sleeperStepM;
    ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
    for (let sx = -offsetM * ppm; sx < width + 40; sx += sleeperStepM * ppm) {
      ctx.fillRect(sx, trackY + 12, Math.max(4, ppm * 0.35), 6);
    }
  }

  private drawTunnelSignageAndSignals(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState,
    ppm: number,
    worldToScreenX: (wx: number) => number,
    trackY: number
  ): void {
    const nextStation = STATIONS[state.nextStationIndex];

    // 1. Station Distance Countdown Boards in tunnel (300m, 200m, 100m, 50m)
    const markers = [300, 200, 100, 50];
    for (const dist of markers) {
      const markerWorldX = nextStation.stopX - dist;
      const sx = worldToScreenX(markerWorldX);
      if (sx < -60 || sx > width + 60) continue;
      if (this.isInsideAnyStation(markerWorldX)) continue;

      const boardY = height * 0.48;
      // Bracket post
      ctx.fillStyle = '#334155';
      ctx.fillRect(sx - 2, boardY + 22, 4, trackY - boardY - 22);

      // Reflective Parisian distance sign
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(sx - 26, boardY, 52, 24);
      ctx.strokeStyle = COLORS.line14PurpleLight;
      ctx.lineWidth = 2;
      ctx.strokeRect(sx - 26, boardY, 52, 24);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '700 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${dist}m`, sx, boardY + 12);
    }

    // 2. Speed Limit Trackside Signs at zone transitions
    for (let i = 0; i < SPEED_LIMIT_ZONES.length; i++) {
      const zone = SPEED_LIMIT_ZONES[i];
      const sx = worldToScreenX(zone.startX);
      if (sx < -50 || sx > width + 50) continue;
      if (this.isInsideAnyStation(zone.startX)) continue;

      const signY = height * 0.36;
      ctx.fillStyle = '#475569';
      ctx.fillRect(sx - 1.5, signY + 20, 3, trackY - signY - 20);

      // Circular French speed limit disc
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.arc(sx, signY + 10, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${zone.limitKmh}`, sx, signY + 10.5);
    }

    // 3. Glowing Paris Metro Block Signal Lights every 150m in tunnels
    const signalStep = 150;
    const firstSig = Math.floor((state.trainX - 60) / signalStep) * signalStep;
    for (let sigX = firstSig; sigX <= state.trainX + 80; sigX += signalStep) {
      if (sigX < 40 || this.isInsideAnyStation(sigX)) continue;
      const sx = worldToScreenX(sigX);
      if (sx < -40 || sx > width + 40) continue;

      const distToNext = nextStation.stopX - sigX;
      const isAmber = distToNext > 0 && distToNext < 160;
      const signalColor = isAmber ? COLORS.warningAmber : COLORS.signalGreen;
      const sigY = height * 0.44;

      // Signal mast & dark housing
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(sx - 2, sigY + 26, 4, trackY - sigY - 26);
      ctx.fillStyle = '#090D16';
      ctx.fillRect(sx - 7, sigY - 12, 14, 38);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 7, sigY - 12, 14, 38);

      // Signal glow halo (softened/enlarged in fog)
      const glowRadius = state.weather === 'fog' ? 38 : 24;
      const halo = ctx.createRadialGradient(sx, sigY, 2, sx, sigY, glowRadius);
      halo.addColorStop(0, isAmber ? 'rgba(245, 158, 11, 0.7)' : 'rgba(16, 185, 129, 0.7)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(sx, sigY, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // Active lamp + inactive lamp
      ctx.fillStyle = signalColor;
      ctx.beginPath();
      ctx.arc(sx, sigY, 4.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1F2937';
      ctx.beginPath();
      ctx.arc(sx, sigY + 14, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Subtle illuminated green Paris Metro tunnel emergency exit markers (SORTIE) every 220m
    const sortieStep = 220;
    const firstSortie = Math.floor((state.trainX - 60) / sortieStep) * sortieStep;
    for (let ex = firstSortie; ex <= state.trainX + 80; ex += sortieStep) {
      if (ex < 90 || this.isInsideAnyStation(ex)) continue;
      const sx = worldToScreenX(ex);
      if (sx < -50 || sx > width + 50) continue;
      const ey = height * 0.56;
      ctx.fillStyle = '#065F46';
      ctx.fillRect(sx - 22, ey, 44, 15);
      ctx.strokeStyle = '#34D399';
      ctx.lineWidth = 1;
      ctx.strokeRect(sx - 22, ey, 44, 15);
      ctx.fillStyle = '#ECFDF5';
      ctx.font = '700 8px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('SORTIE →', sx, ey + 7.5);
    }
    void ppm;
  }

  private drawMetroTrain(
    ctx: CanvasRenderingContext2D,
    width: number,
    _height: number,
    state: SimulationState,
    ppm: number,
    noseScreenX: number,
    trainTopY: number,
    trainBottomY: number,
    trainHeight: number
  ): void {
    const trainLengthPx = PHYSICS.trainLengthM * ppm;
    const tailScreenX = noseScreenX - trainLengthPx;
    const noseCurveW = ppm * 2.6;

    // Subtle rubber-tired suspension micro-bounce at speed
    const suspensionY =
      state.phase === 'playing' && state.speedMs > 0.4
        ? Math.sin(this.animTime * (8 + state.speedMs * 0.6)) * Math.min(1.6, state.speedMs * 0.08)
        : 0;
    const bodyTopY = trainTopY + suspensionY;
    const bodyBottomY = trainBottomY + suspensionY;

    // 0. Sleek Roof HVAC & Traction Resistor Equipment Pods (authentic MP14 roof profile)
    const podOffsets = [-12, -26, -46, -60];
    for (const po of podOffsets) {
      const px = noseScreenX + po * ppm;
      const pw = ppm * 5.2;
      if (px + pw < -40 || px - pw > width + 40) continue;
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(px - pw / 2, bodyTopY - 5, pw, 6, [3, 3, 0, 0]);
      ctx.fill();
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(px - pw / 2 + 4, bodyTopY - 4, pw - 8, 1.5);
    }

    // 1. Volumetric LED Headlight Cone projecting forward into dark tunnel / fog
    const headlightX = noseScreenX - 3;
    const headlightY = bodyBottomY - trainHeight * 0.28;
    const coneLen = Math.min(width - noseScreenX + 120, state.weather === 'fog' ? 240 : 340);
    const coneAlpha = state.weather === 'fog' ? 0.32 : 0.2;

    const beamGrad = ctx.createLinearGradient(headlightX, headlightY, headlightX + coneLen, headlightY);
    beamGrad.addColorStop(0, `rgba(248, 250, 252, ${coneAlpha + 0.16})`);
    beamGrad.addColorStop(0.35, `rgba(224, 242, 254, ${coneAlpha})`);
    beamGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(headlightX, headlightY - 7);
    ctx.lineTo(headlightX + coneLen, headlightY - 62);
    ctx.lineTo(headlightX + coneLen, headlightY + 52);
    ctx.lineTo(headlightX, headlightY + 8);
    ctx.closePath();
    ctx.fill();

    // 2. Underframe & Rubber-Tired Bogies with distance-synced wheel rotation
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(Math.max(-20, tailScreenX), bodyBottomY - 8, noseScreenX - Math.max(-20, tailScreenX) - 10, 11);

    const wheelAngle = (state.trainX / 0.45) % (Math.PI * 2);
    const bogieOffsets = [-6, -24, -36, -54, -68];
    for (const bo of bogieOffsets) {
      const bx = noseScreenX + bo * ppm;
      if (bx < -80 || bx > width + 80) continue;
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(bx - ppm * 1.6, bodyBottomY - 6, ppm * 3.2, 8);
      // Rubber tires with rotating hub lug
      for (const wx of [bx - ppm * 0.9, bx + ppm * 0.9]) {
        ctx.fillStyle = '#090D16';
        ctx.beginPath();
        ctx.arc(wx, trainBottomY + 2, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#64748B';
        ctx.beginPath();
        ctx.arc(wx, trainBottomY + 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(wx - Math.cos(wheelAngle) * 3.5, trainBottomY + 2 - Math.sin(wheelAngle) * 3.5);
        ctx.lineTo(wx + Math.cos(wheelAngle) * 3.5, trainBottomY + 2 + Math.sin(wheelAngle) * 3.5);
        ctx.stroke();
      }
    }

    // Use suspension-adjusted top/bottom for the carriage body below
    trainTopY = bodyTopY;
    trainBottomY = bodyBottomY;

    // 3. Main Sleek MP14 Articulated Body Silhouette
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(tailScreenX, trainBottomY - 4);
    ctx.lineTo(tailScreenX, trainTopY + 6);
    ctx.quadraticCurveTo(tailScreenX, trainTopY, tailScreenX + 8, trainTopY);
    ctx.lineTo(noseScreenX - noseCurveW, trainTopY);
    // Aerodynamic sloped MP14 nose profile
    ctx.quadraticCurveTo(noseScreenX - noseCurveW * 0.18, trainTopY + trainHeight * 0.08, noseScreenX, trainBottomY - trainHeight * 0.24);
    ctx.quadraticCurveTo(noseScreenX + 2, trainBottomY - 4, noseScreenX - 10, trainBottomY - 4);
    ctx.closePath();

    // Pearl white / light metallic upper body fill
    const bodyGrad = ctx.createLinearGradient(0, trainTopY, 0, trainBottomY);
    bodyGrad.addColorStop(0, '#F1F5F9');
    bodyGrad.addColorStop(0.55, '#E2E8F0');
    bodyGrad.addColorStop(1, '#CBD5E1');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Clip livery details inside train silhouette
    ctx.clip();

    // Roofline RATP Turquoise Accent Band (#00AA91)
    ctx.fillStyle = COLORS.ratpTurquoise;
    ctx.fillRect(tailScreenX, trainTopY, trainLengthPx + 10, Math.max(6, trainHeight * 0.085));

    // Lower RATP Turquoise Skirt Band + Line 14 Purple Pin-Stripe
    const skirtY = trainBottomY - trainHeight * 0.24;
    ctx.fillStyle = COLORS.ratpTurquoise;
    ctx.fillRect(tailScreenX, skirtY, trainLengthPx + 10, trainHeight * 0.14);
    ctx.fillStyle = COLORS.line14Purple;
    ctx.fillRect(tailScreenX, skirtY - 3, trainLengthPx + 10, 3);

    // Smoked Panoramic Window Band
    const winTopY = trainTopY + trainHeight * 0.18;
    const winH = trainHeight * 0.42;
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(tailScreenX, winTopY, trainLengthPx - noseCurveW * 0.35, winH);

    // Warm Illuminated Interior Cabin Glow + Stanchions + Seated Commuters
    const interiorGrad = ctx.createLinearGradient(0, winTopY, 0, winTopY + winH);
    interiorGrad.addColorStop(0, '#FEF3C7');
    interiorGrad.addColorStop(0.35, '#FDE68A');
    interiorGrad.addColorStop(1, '#94A3B8');

    // Articulation gangway divider between cars
    const gangwayOffsetM = -33.5;
    const gangwayX = noseScreenX + gangwayOffsetM * ppm;

    // Draw passenger windows between doors
    const windowSpans = [
      [-15.2, -10.0],
      [-25.2, -20.0],
      [-47.2, -42.0],
      [-57.2, -52.0],
      [-69.0, -62.0],
    ];

    for (const [wStart, wEnd] of windowSpans) {
      const wx1 = noseScreenX + wStart * ppm;
      const wx2 = noseScreenX + wEnd * ppm;
      const ww = wx2 - wx1;
      if (wx2 < -40 || wx1 > width + 40) continue;

      // Lit cabin window
      ctx.fillStyle = interiorGrad;
      ctx.fillRect(wx1 + 2, winTopY + 3, ww - 4, winH - 6);

      // Interior vertical grab pole
      ctx.fillStyle = 'rgba(71, 85, 105, 0.55)';
      ctx.fillRect(wx1 + ww * 0.5, winTopY + 3, 2, winH - 6);

      // Subtle seated passenger silhouettes inside the warm lit carriage
      ctx.fillStyle = 'rgba(30, 41, 59, 0.42)';
      ctx.beginPath();
      ctx.arc(wx1 + ww * 0.26, winTopY + winH * 0.52, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(wx1 + ww * 0.26 - 6, winTopY + winH * 0.62, 12, winH * 0.36);

      ctx.beginPath();
      ctx.arc(wx1 + ww * 0.74, winTopY + winH * 0.55, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(wx1 + ww * 0.74 - 6, winTopY + winH * 0.65, 12, winH * 0.33);

      // Glass diagonal sheen reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.beginPath();
      ctx.moveTo(wx1 + 6, winTopY + 3);
      ctx.lineTo(wx1 + 18, winTopY + 3);
      ctx.lineTo(wx1 + 8, winTopY + winH - 3);
      ctx.lineTo(wx1 + 2, winTopY + winH - 3);
      ctx.closePath();
      ctx.fill();
    }

    // Gangway dark accordion bellow between Car 1 and Car 2
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(gangwayX - ppm * 1.1, trainTopY + 4, ppm * 2.2, trainHeight - 8);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    for (let gx = gangwayX - ppm * 0.8; gx <= gangwayX + ppm * 0.8; gx += 5) {
      ctx.beginPath();
      ctx.moveTo(gx, trainTopY + 6);
      ctx.lineTo(gx, trainBottomY - 6);
      ctx.stroke();
    }

    // 4. Animated Dual-Leaf Sliding Train Doors
    const doorW = ppm * 3.1;
    const doorTopY = trainTopY + trainHeight * 0.14;
    const doorH = trainHeight * 0.78;
    const openSlidePx = state.doorOpenProgress * (doorW * 0.44);

    for (const dOffset of TRAIN_DOOR_OFFSETS_M) {
      const dx = noseScreenX + dOffset * ppm;
      if (dx + doorW < -40 || dx - doorW > width + 40) continue;

      const dLeft = dx - doorW / 2;

      // Illuminated cabin doorway interior (revealed when doors slide open)
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(dLeft, doorTopY, doorW, doorH);
      // Warm interior doorway floor shadow
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(dLeft, doorTopY + doorH - 12, doorW, 12);

      // Left sliding leaf
      const leafW = doorW / 2 - 1;
      const leftLeafX = dLeft - openSlidePx;
      const rightLeafX = dx + 1 + openSlidePx;

      for (const lx of [leftLeafX, rightLeafX]) {
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(lx, doorTopY, leafW, doorH);
        // Door window
        ctx.fillStyle = '#334155';
        ctx.fillRect(lx + 4, doorTopY + 6, leafW - 8, doorH * 0.46);
        // Turquoise lower band on door leaf
        ctx.fillStyle = COLORS.ratpTurquoise;
        ctx.fillRect(lx, skirtY, leafW, trainHeight * 0.14);
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 1;
        ctx.strokeRect(lx, doorTopY, leafW, doorH);
      }

      // Door frame outline & status LED above door
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(dLeft, doorTopY, doorW, doorH);

      // Flashing amber/red warning lamp during door closing buzzer
      if (state.doorState === 'closing_warning' || state.doorState === 'closing') {
        const blinkOn = Math.floor(this.animTime * 8) % 2 === 0;
        if (blinkOn) {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(dx, doorTopY - 4, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. Front Cab Windshield & Line 14 Destination Matrix
    ctx.fillStyle = '#090E1A';
    ctx.beginPath();
    ctx.moveTo(noseScreenX - noseCurveW * 0.95, winTopY);
    ctx.lineTo(noseScreenX - noseCurveW * 0.2, winTopY);
    ctx.lineTo(noseScreenX - 4, winTopY + winH);
    ctx.lineTo(noseScreenX - noseCurveW * 0.95, winTopY + winH);
    ctx.closePath();
    ctx.fill();

    // Glowing Line 14 purple badge inside front cab top corner
    ctx.fillStyle = COLORS.line14Purple;
    ctx.fillRect(noseScreenX - noseCurveW * 0.85, winTopY + 4, 18, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('14', noseScreenX - noseCurveW * 0.85 + 9, winTopY + 10.5);

    ctx.restore();

    // 6. Glowing Front LED Headlight Cluster
    const lampGlow = ctx.createRadialGradient(headlightX, headlightY, 1, headlightX, headlightY, 18);
    lampGlow.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    lampGlow.addColorStop(0.5, 'rgba(186, 230, 253, 0.45)');
    lampGlow.addColorStop(1, 'rgba(186, 230, 253, 0)');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(headlightX, headlightY, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(headlightX - 1, headlightY, 3.2, 5.5, -0.25, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawStationForegroundAndPSDs(
    ctx: CanvasRenderingContext2D,
    station: StationConfig,
    stationIndex: number,
    leftX: number,
    rightX: number,
    height: number,
    platformY: number,
    trainTopY: number,
    trainBottomY: number,
    ppm: number,
    worldToScreenX: (wx: number) => number,
    state: SimulationState
  ): void {
    const stW = rightX - leftX;
    const psdTopY = trainTopY + 6;
    const psdBottomY = platformY;
    const psdH = psdBottomY - psdTopY;

    // 1. Platform Screen Doors (PSDs) rendered in front of train (signature Line 14 feature!)
    const isActiveStop = stationIndex === state.nextStationIndex;
    const psdOpen = isActiveStop ? state.doorOpenProgress : 0;

    // Top anodized aluminum PSD header rail spanning the station
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(leftX, psdTopY - 8, stW, 9);
    ctx.fillStyle = '#64748B';
    ctx.fillRect(leftX, psdTopY + 1, stW, 2);

    // Fixed glass bulkhead panels + sliding PSD doors aligned to station.stopX + TRAIN_DOOR_OFFSETS_M
    const doorW = ppm * 3.25;
    const openSlidePx = psdOpen * (doorW * 0.45);

    // Subtle continuous frosted glass reflection along fixed PSD walls
    ctx.fillStyle = 'rgba(226, 232, 240, 0.12)';
    ctx.fillRect(leftX, psdTopY + 3, stW, psdH - 3);

    // Lower metallic red-brown/charcoal kickplate segments between doors (subtle nod to reference)
    ctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
    ctx.fillRect(leftX, psdBottomY - 12, stW, 12);

    for (const dOffset of TRAIN_DOOR_OFFSETS_M) {
      const doorCenterX = worldToScreenX(station.stopX + dOffset);
      const dLeft = doorCenterX - doorW / 2;
      const dRight = doorCenterX + doorW / 2;

      // Vertical aluminum structural mullions framing each PSD gateway
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(dLeft - 5, psdTopY, 5, psdH);
      ctx.fillRect(dRight, psdTopY, 5, psdH);
      ctx.fillStyle = '#475569';
      ctx.fillRect(dLeft - 5, psdTopY, 1.5, psdH);
      ctx.fillRect(dRight + 3.5, psdTopY, 1.5, psdH);

      // Sliding PSD glass leaves with signature horizontal yellow safety stripe (#FACC15)
      const leafW = doorW / 2 - 1;
      const leftLeafX = dLeft - openSlidePx;
      const rightLeafX = doorCenterX + 1 + openSlidePx;

      for (const lx of [leftLeafX, rightLeafX]) {
        // Semi-transparent PSD glass panel
        ctx.fillStyle = 'rgba(203, 213, 225, 0.24)';
        ctx.fillRect(lx, psdTopY + 3, leafW, psdH - 5);

        // Aluminum leaf frame
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(lx + 1, psdTopY + 4, leafW - 2, psdH - 7);

        // Iconic horizontal yellow safety stripe across PSD glass
        ctx.fillStyle = COLORS.safetyYellow;
        ctx.fillRect(lx + 2, psdTopY + psdH * 0.52, leafW - 4, 4.5);
      }

      // Subtle alignment target triangle above active station's front PSD
      if (isActiveStop && dOffset === TRAIN_DOOR_OFFSETS_M[0]) {
        ctx.fillStyle = COLORS.safetyYellow;
        ctx.beginPath();
        ctx.moveTo(doorCenterX, psdTopY - 16);
        ctx.lineTo(doorCenterX - 6, psdTopY - 24);
        ctx.lineTo(doorCenterX + 6, psdTopY - 24);
        ctx.closePath();
        ctx.fill();
      }
    }

    // 2. Platform Foreground Deck
    const platGrad = ctx.createLinearGradient(0, platformY, 0, height);
    platGrad.addColorStop(0, '#272C36');
    platGrad.addColorStop(0.18, '#1C2029');
    platGrad.addColorStop(1, '#12151C');
    ctx.fillStyle = platGrad;
    ctx.fillRect(leftX, platformY, stW, height - platformY);

    // Subtle wet sheen reflection on platform during Rain weather
    if (state.weather === 'rain' && state.weatherIntensity > 0.05) {
      ctx.fillStyle = `rgba(148, 163, 184, ${0.12 * state.weatherIntensity})`;
      ctx.fillRect(leftX, platformY + 2, stW, (height - platformY) * 0.55);
    }

    // Platform end red warning ramp strip (matches reference right-hand platform edge)
    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.moveTo(rightX - 4, platformY);
    ctx.lineTo(rightX + 2, platformY);
    ctx.lineTo(rightX + 18, height);
    ctx.lineTo(rightX + 11, height);
    ctx.closePath();
    ctx.fill();

    // Subtle white safety line along platform
    ctx.fillStyle = 'rgba(226, 232, 240, 0.35)';
    ctx.fillRect(leftX, platformY + 6, stW, 2);

    // 3. Clear Yellow Stopping Target Stripe on Platform Floor at station.stopX
    const targetX = worldToScreenX(station.stopX);
    ctx.fillStyle = COLORS.safetyYellow;
    ctx.beginPath();
    ctx.moveTo(targetX - 4, platformY + 1);
    ctx.lineTo(targetX + 4, platformY + 1);
    ctx.lineTo(targetX + 16, height);
    ctx.lineTo(targetX + 5, height);
    ctx.closePath();
    ctx.fill();

    // Stop marker plaque ("ARRÊT") on the PSD rail at stopX
    ctx.fillStyle = COLORS.safetyYellow;
    ctx.fillRect(targetX - 18, psdTopY - 22, 36, 13);
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 8px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ARRÊT', targetX, psdTopY - 15);

    // 4. Animated Commuter Silhouettes on Platform
    const actors = state.passengers[stationIndex] ?? [];
    for (let i = 0; i < actors.length; i++) {
      this.drawPassenger(ctx, actors[i], worldToScreenX, platformY, trainBottomY, ppm);
    }
  }

  private drawPassenger(
    ctx: CanvasRenderingContext2D,
    p: PassengerActor,
    worldToScreenX: (wx: number) => number,
    platformY: number,
    _trainBottomY: number,
    ppm: number
  ): void {
    if (p.role === 'departed' || p.opacity <= 0.03) return;

    const sx = worldToScreenX(p.x);
    const scale = Math.max(0.75, Math.min(1.25, ppm / 19)) * p.heightScale;
    // Depth shifts passenger vertically slightly toward the PSD doorway
    const footY = platformY + (1 - p.depth) * 26 + 4;
    const isMoving = p.role === 'boarding' || p.role === 'alighting';
    const bob = isMoving ? Math.abs(Math.sin(p.walkPhase)) * 3 * scale : Math.sin(p.walkPhase) * 0.6;
    const stride = isMoving ? Math.sin(p.walkPhase) * 5 * scale : 0;

    ctx.save();
    ctx.globalAlpha = p.opacity;

    // Ground contact shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(sx, footY + 2, 10 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs
    ctx.strokeStyle = p.pantsColor;
    ctx.lineWidth = 4.2 * scale;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - 2 * scale, footY - 22 * scale - bob);
    ctx.lineTo(sx - 3 * scale - stride, footY);
    ctx.moveTo(sx + 2 * scale, footY - 22 * scale - bob);
    ctx.lineTo(sx + 3 * scale + stride, footY);
    ctx.stroke();

    // Torso / Parisian coat silhouette
    ctx.fillStyle = p.coatColor;
    ctx.beginPath();
    ctx.roundRect(sx - 8 * scale, footY - 48 * scale - bob, 16 * scale, 29 * scale, 5 * scale);
    ctx.fill();

    // Optional commuter bag / briefcase
    if (p.hasBag) {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(sx + 7 * scale, footY - 26 * scale - bob, 7 * scale, 9 * scale);
    }

    // Head
    ctx.fillStyle = '#D6B69C';
    ctx.beginPath();
    ctx.arc(sx, footY - 55 * scale - bob, 5.4 * scale, 0, Math.PI * 2);
    ctx.fill();

    // Hair cap
    ctx.fillStyle = '#1E1B18';
    ctx.beginPath();
    ctx.arc(sx, footY - 56.5 * scale - bob, 5.5 * scale, Math.PI, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawWeatherEffects(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    state: SimulationState,
    dt: number,
    headlightX: number,
    headlightY: number
  ): void {
    const intensity = state.weatherIntensity;
    if (intensity <= 0.01) return;

    ctx.save();

    if (state.weather === 'rain') {
      // Cool rainy atmospheric cast
      ctx.fillStyle = `rgba(15, 23, 42, ${0.14 * intensity})`;
      ctx.fillRect(0, 0, width, height);

      // Slanted rain streaks driven by train speed + wind
      const speedSlant = 0.25 + (state.speedMs / 25) * 0.55;
      ctx.strokeStyle = `rgba(186, 230, 253, ${0.38 * intensity})`;
      ctx.lineWidth = 1.25;

      for (let i = 0; i < this.rainPool.length; i++) {
        const drop = this.rainPool[i];
        drop.y += drop.speed * dt;
        drop.x -= (0.28 + state.speedMs * 0.025) * dt;
        if (drop.y > 1.05) {
          drop.y = -0.05;
          drop.x = Math.random() * 1.25;
        }
        if (drop.x < -0.1) {
          drop.x = 1.05;
        }

        const px = drop.x * width;
        const py = drop.y * height;
        ctx.globalAlpha = drop.alpha * intensity;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - drop.len * speedSlant, py + drop.len);
        ctx.stroke();
      }

      // Subtle water droplets sliding down the cab/viewport window glass
      for (let i = 0; i < this.glassDrops.length; i++) {
        const g = this.glassDrops[i];
        g.y += g.slideSpeed * dt;
        g.x -= state.speedMs * 0.0025 * dt;
        if (g.y > 1.02) {
          g.y = -0.02;
          g.x = Math.random();
        }
        if (g.x < -0.02) g.x = 1.02;

        const gx = g.x * width;
        const gy = g.y * height;
        ctx.globalAlpha = g.alpha * intensity;
        ctx.fillStyle = 'rgba(224, 242, 254, 0.85)';
        ctx.beginPath();
        ctx.ellipse(gx, gy, g.r * 0.75, g.r * 1.45, 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (state.weather === 'fog') {
      // Dense tunnel & station mist reducing far visibility ahead
      const fogGrad = ctx.createLinearGradient(0, 0, width, 0);
      fogGrad.addColorStop(0, `rgba(203, 213, 225, ${0.18 * intensity})`);
      fogGrad.addColorStop(0.55, `rgba(203, 213, 225, ${0.26 * intensity})`);
      fogGrad.addColorStop(1, `rgba(226, 232, 240, ${0.52 * intensity})`);
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, width, height);

      // Drifting horizontal mist banks
      const drift = (this.animTime * 22 + state.trainX * 3) % (width * 0.8);
      for (let i = 0; i < 3; i++) {
        const mx = ((i * width * 0.45 - drift) % (width + 320) + (width + 320)) % (width + 320) - 160;
        const my = height * (0.28 + i * 0.22);
        const mist = ctx.createRadialGradient(mx, my, 20, mx, my, 220);
        mist.addColorStop(0, `rgba(226, 232, 240, ${0.22 * intensity})`);
        mist.addColorStop(1, 'rgba(226, 232, 240, 0)');
        ctx.fillStyle = mist;
        ctx.beginPath();
        ctx.arc(mx, my, 220, 0, Math.PI * 2);
        ctx.fill();
      }

      // Soft fog bloom around headlights
      const bloom = ctx.createRadialGradient(headlightX + 40, headlightY, 6, headlightX + 40, headlightY, 150);
      bloom.addColorStop(0, `rgba(241, 245, 249, ${0.28 * intensity})`);
      bloom.addColorStop(1, 'rgba(241, 245, 249, 0)');
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.arc(headlightX + 40, headlightY, 150, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Compact top-left live train overview strip (modernized tribute to the classic reference screenshot).
   */
  private drawMiniOverview(ctx: CanvasRenderingContext2D, state: SimulationState): void {
    const boxX = 14;
    const boxY = 12;
    const boxW = 148;
    const boxH = 40;

    ctx.save();
    ctx.fillStyle = 'rgba(11, 17, 32, 0.88)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Clip interior
    ctx.beginPath();
    ctx.roundRect(boxX + 1, boxY + 1, boxW - 2, boxH - 2, 7);
    ctx.clip();

    const nextStation = STATIONS[state.nextStationIndex];
    const dist = nextStation.stopX - state.trainX;
    const inStation = Math.abs(dist) < 85 || state.trainX < 40;

    // Background tint: bright station vs dark tunnel
    ctx.fillStyle = inStation ? '#CBD5E1' : '#090E1A';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    if (inStation) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(boxX, boxY + 14, boxW, 2);
    }

    // Mini MP14 train sprite
    const miniTrainW = 74;
    const miniTrainX = boxX + 20;
    const miniTrainY = boxY + 18;
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(miniTrainX, miniTrainY, miniTrainW, 13);
    ctx.fillStyle = COLORS.ratpTurquoise;
    ctx.fillRect(miniTrainX, miniTrainY, miniTrainW, 3);
    ctx.fillRect(miniTrainX, miniTrainY + 10, miniTrainW, 3);
    ctx.fillStyle = '#1E293B';
    for (let wx = miniTrainX + 6; wx < miniTrainX + miniTrainW - 8; wx += 11) {
      ctx.fillRect(wx, miniTrainY + 4, 7, 5);
    }

    // Mini headlight
    ctx.fillStyle = '#FEF08A';
    ctx.fillRect(miniTrainX + miniTrainW - 1, miniTrainY + 7, 3, 3);

    // Line 14 indicator badge
    ctx.fillStyle = COLORS.line14Purple;
    ctx.fillRect(boxX + boxW - 24, boxY + 6, 18, 13);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('14', boxX + boxW - 15, boxY + 13);

    ctx.restore();
  }

  /**
   * Subtle, crisp station alignment guide that fades in smoothly when entering a station (< 85m).
   */
  private drawAlignmentGuide(ctx: CanvasRenderingContext2D, width: number, state: SimulationState): void {
    const offsetM = getAlignmentOffsetM(state); // negative = before stop mark, 0 = perfect, positive = past
    const distToStop = -offsetM;

    if (distToStop > 85 || distToStop < -25) return;

    const fadeAlpha = distToStop > 65 ? Math.max(0, (85 - distToStop) / 20) : 1;
    const panelW = Math.min(340, width - 320);
    if (panelW < 180) return;

    const panelH = 54;
    const px = (width - panelW) / 2;
    const py = 12;

    ctx.save();
    ctx.globalAlpha = fadeAlpha;

    // Matte dark slate backing (no backdrop-blur)
    ctx.fillStyle = 'rgba(11, 17, 32, 0.92)';
    ctx.beginPath();
    ctx.roundRect(px, py, panelW, panelH, 10);
    ctx.fill();

    const absOff = Math.abs(offsetM);
    const quality = classifyAlignment(absOff);
    const stopped = isTrainStopped(state);
    const inZone = absOff <= PHYSICS.maxAllowedAlignM;

    const borderColor =
      inZone && quality === 'perfect'
        ? '#10B981'
        : inZone
          ? COLORS.safetyYellow
          : offsetM > PHYSICS.maxAllowedAlignM
            ? '#EF4444'
            : 'rgba(148, 163, 184, 0.35)';

    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Header text row
    const stationName = STATIONS[state.nextStationIndex].shortName;
    ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
    ctx.fillStyle = '#E2E8F0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Align PSD · ${stationName}`, px + 12, py + 15);

    // Offset readout right-aligned
    let statusText = `${distToStop.toFixed(1)} m`;
    let statusColor = '#F8FAFC';
    if (inZone && stopped && state.doorState === 'closed' && !state.servedCurrentStation) {
      statusText = 'READY — OPEN DOORS';
      statusColor = '#10B981';
    } else if (state.doorState === 'open' && state.boardingComplete) {
      statusText = 'BOARDING DONE — CLOSE';
      statusColor = '#FACC15';
    } else if (state.doorState !== 'closed') {
      statusText = 'DOORS ACTIVE';
      statusColor = '#38BDF8';
    } else if (absOff <= PHYSICS.perfectAlignM) {
      statusText = `PERFECT (${offsetM >= 0 ? '+' : ''}${offsetM.toFixed(1)}m)`;
      statusColor = '#10B981';
    } else if (offsetM > PHYSICS.maxAllowedAlignM) {
      statusText = `OVERSHOT +${offsetM.toFixed(1)}m`;
      statusColor = '#EF4444';
    }

    ctx.font = '700 11px "JetBrains Mono", monospace';
    ctx.fillStyle = statusColor;
    ctx.textAlign = 'right';
    ctx.fillText(statusText, px + panelW - 12, py + 15);

    // Alignment track bar (-30m .. +12m mapped to bar)
    const barX = px + 14;
    const barY = py + 34;
    const barW = panelW - 28;
    const barH = 8;

    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 4);
    ctx.fill();

    // Map range [-30m, +10m] -> [0, 1]
    const mapOffset = (m: number) => Math.max(0, Math.min(1, (m + 30) / 40));
    const zoneStartPx = barX + mapOffset(-PHYSICS.maxAllowedAlignM) * barW;
    const zoneEndPx = barX + mapOffset(PHYSICS.maxAllowedAlignM) * barW;
    const perfStartPx = barX + mapOffset(-PHYSICS.perfectAlignM) * barW;
    const perfEndPx = barX + mapOffset(PHYSICS.perfectAlignM) * barW;
    const targetCenterPx = barX + mapOffset(0) * barW;

    // Allowed zone (yellow)
    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.fillRect(zoneStartPx, barY, zoneEndPx - zoneStartPx, barH);

    // Perfect zone (emerald)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.72)';
    ctx.fillRect(perfStartPx, barY, perfEndPx - perfStartPx, barH);

    // Exact center target line
    ctx.fillStyle = COLORS.safetyYellow;
    ctx.fillRect(targetCenterPx - 1, barY - 3, 2, barH + 6);

    // Live train nose marker
    const noseMarkerX = barX + mapOffset(offsetM) * barW;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(noseMarkerX, barY - 4);
    ctx.lineTo(noseMarkerX + 5, barY + barH + 4);
    ctx.lineTo(noseMarkerX - 5, barY + barH + 4);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
