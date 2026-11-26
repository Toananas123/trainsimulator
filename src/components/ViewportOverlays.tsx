import React from 'react';
import { DoorClosed, DoorOpen, Leaf, Zap } from 'lucide-react';
import { getLineDefinition } from '../game/lines';
import type { HudSnapshot } from '../game/engine';
import type { CameraViewMode } from '../game/three/Metro3DScene';

interface ViewportOverlaysProps {
  hud: HudSnapshot;
  viewMode: CameraViewMode;
  showEcoOverlay: boolean;
  onOpenDoors: () => void;
  onCloseDoors: () => void;
}

function formatDueClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Lightweight, zero-blur DOM HUD overlays anchored inside the 3D WebGL viewport:
 * 1. Top-left compact Line 14 / RER A cab telemetry badge + upcoming speed camera notice
 * 2. Crisp Station Alignment Guide with Rush Hour strict tolerances & Open/Close Doors buttons
 * 3. Top-right (below utility pills) Eco-Driving Energy Consumption Efficiency Dashboard Overlay
 * 4. Automated Speed Camera Flash strobe overlay when flashed overspeeding
 */
export const ViewportOverlays: React.FC<ViewportOverlaysProps> = ({
  hud,
  viewMode,
  showEcoOverlay,
  onOpenDoors,
  onCloseDoors,
}) => {
  if (hud.phase !== 'playing') return null;

  const lineDef = getLineDefinition(hud.lineMode);
  const isRer = hud.lineMode === 'rerA';

  const showAlignment =
    hud.inStationZone && hud.alignmentOffsetM !== null && Math.abs(hud.alignmentOffsetM) <= 85;
  const offsetM = hud.alignmentOffsetM ?? 0;
  const absOffset = Math.abs(offsetM);
  const inPerfect = absOffset <= hud.perfectAlignM;
  const inAllowed = absOffset <= hud.maxAllowedAlignM;
  const isStopped = hud.speedKmh < 0.35;

  // Map offset (-45m..+45m) to 0..100% slider bar
  const clampedOffset = Math.max(-45, Math.min(45, offsetM));
  const markerPct = ((clampedOffset + 45) / 90) * 100;
  const allowedLeftPct = ((45 - hud.maxAllowedAlignM) / 90) * 100;
  const allowedWidthPct = ((hud.maxAllowedAlignM * 2) / 90) * 100;
  const perfectLeftPct = ((45 - hud.perfectAlignM) / 90) * 100;
  const perfectWidthPct = ((hud.perfectAlignM * 2) / 90) * 100;

  let alignStatus = `${Math.abs(Math.round(offsetM))} m to ARRÊT`;
  let statusColor = 'text-amber-300';
  if (hud.doorState !== 'closed') {
    alignStatus = hud.boardingComplete ? 'BOARDING COMPLETE · CLOSE DOORS [SPACE]' : 'BOARDING IN PROGRESS';
    statusColor = 'text-teal-300';
  } else if (isStopped && inAllowed) {
    alignStatus = inPerfect
      ? 'PERFECT ALIGNMENT · OPEN DOORS [SPACE]'
      : 'ALIGNED · OPEN DOORS [SPACE]';
    statusColor = 'text-emerald-400';
  } else if (offsetM > hud.maxAllowedAlignM) {
    alignStatus = `OVERSHOT +${offsetM.toFixed(1)} m`;
    statusColor = 'text-red-400';
  } else if (absOffset <= hud.maxAllowedAlignM) {
    alignStatus = 'IN ALIGNMENT ZONE · STOP HERE';
    statusColor = 'text-emerald-300';
  }

  const showStationDoorActions =
    (isStopped && inAllowed) || hud.doorState !== 'closed';
  const flashIntensity = hud.speedCameraFlashIntensity;

  const eco = hud.eco;
  const ecoGradeStyle =
    eco.ecoGrade === 'A+'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/70'
      : eco.ecoGrade === 'A'
        ? 'bg-teal-500/20 text-teal-300 border-teal-400/70'
        : eco.ecoGrade === 'B'
          ? 'bg-amber-500/20 text-amber-300 border-amber-400/70'
          : 'bg-red-500/20 text-red-300 border-red-400/70';

  const regimeBadgeStyle =
    eco.driveMode === 'REGEN'
      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60'
      : eco.driveMode === 'COAST'
        ? 'bg-teal-500/20 text-teal-300 border-teal-500/60'
        : eco.driveMode === 'TRACTION'
          ? 'bg-amber-500/20 text-amber-300 border-amber-500/60'
          : eco.driveMode === 'FRICTION'
            ? 'bg-red-500/20 text-red-300 border-red-500/60'
            : 'bg-slate-700/60 text-slate-300 border-slate-600/70';

  const peakPowerRef = isRer ? 2400 : 1400;
  const powerBarPct = Math.min(100, Math.round((Math.abs(eco.instantPowerKw) / peakPowerRef) * 100));

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3">
      {/* Automated Speed Camera Flash Strobe Layer */}
      {flashIntensity > 0.01 && (
        <div
          data-testid="speed-camera-flash"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30"
          style={{
            background:
              'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.95) 0%, rgba(224,242,254,0.82) 45%, rgba(239,68,68,0.28) 100%)',
            opacity: Math.min(0.88, Math.pow(flashIntensity, 0.65) * 0.88),
          }}
        />
      )}

      {/* Top Row: Compact Left Perspective + Interlock Stack & Centered Station Alignment Guide */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col items-start gap-1.5">
          {/* Compact Line 14 / RER A Camera Telemetry Pill (Top-Left) */}
          <div
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700/85 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200"
            style={{ backgroundColor: 'rgba(11, 17, 32, 0.90)' }}
          >
            <span
              className="inline-flex items-center justify-center px-1.5 min-w-[20px] h-5 rounded text-[10px] font-extrabold text-white"
              style={{ backgroundColor: lineDef.primaryColor }}
            >
              {isRer ? 'RER A' : '14'}
            </span>
            <span data-testid="viewport-view-label" className="uppercase tracking-wider text-slate-300">
              {viewMode === 'cab'
                ? 'Conductor Cab 3D'
                : viewMode === 'passenger'
                  ? 'Passenger Window 3D'
                  : viewMode === 'chase'
                    ? 'Chase Cam 3D'
                    : 'Side View 3D'}
            </span>
            <span className="text-slate-600">·</span>
            <span className="font-mono-tabular text-teal-300">
              {Math.round(hud.speedKmh)} km/h
            </span>
          </div>

          {/* Cab Door/Signaling Interlock & Next Speed Limit */}
          {viewMode === 'cab' && (
            <div
              className="rounded-lg border border-slate-700/85 px-2.5 py-1 text-[10px] font-mono-tabular text-slate-300"
              style={{ backgroundColor: 'rgba(11, 17, 32, 0.88)' }}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    hud.doorState === 'closed' ? 'bg-teal-400' : 'bg-amber-400'
                  }`}
                />
                <span className="font-bold text-slate-200 uppercase">
                  {isRer ? 'KVB / QUAI OUVERT' : 'PSD INTERLOCK'}
                </span>
                <span className="text-slate-400">
                  {hud.doorState === 'closed'
                    ? 'LOCKED'
                    : hud.doorState === 'open'
                      ? 'OPEN'
                      : hud.doorState.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              {hud.nextSpeedChange && hud.nextSpeedChange.distanceM < 260 && (
                <div className="mt-0.5 text-amber-300">
                  NEXT LIMIT {hud.nextSpeedChange.nextLimitKmh} km/h IN{' '}
                  {Math.round(hud.nextSpeedChange.distanceM)}m
                </div>
              )}
            </div>
          )}

          {/* Upcoming Automated Speed Camera Radar Warning Badge */}
          {hud.upcomingSpeedCamera && (
            <div
              data-testid="radar-warning-badge"
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/85 px-2.5 py-1 text-[10px] font-mono-tabular font-bold text-amber-200"
              style={{ backgroundColor: 'rgba(38, 22, 6, 0.92)' }}
            >
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>
                RADAR · {hud.upcomingSpeedCamera.limitKmh} MAX IN{' '}
                {Math.round(hud.upcomingSpeedCamera.distanceM)}m
              </span>
            </div>
          )}
        </div>

        {/* Station Approach Alignment Guide + Direct Door Action Buttons (Center-Top) */}
        {showAlignment && (
          <div
            data-testid="alignment-guide"
            className="mx-auto w-[330px] sm:w-[400px] rounded-lg border border-slate-600/90 px-3.5 py-2 shadow-lg"
            style={{ backgroundColor: 'rgba(11, 17, 32, 0.92)' }}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-white truncate">
                {hud.nextStationName}{' '}
                <span className="font-mono-tabular text-[10px] text-sky-300 font-semibold">
                  · DUE {formatDueClock(hud.nextStationDueTimeSec)}
                </span>
              </span>
              <span className={`font-mono-tabular whitespace-nowrap ml-2 ${statusColor}`}>
                {alignStatus}
              </span>
            </div>

            {hud.rushHourPeriod === 'rush_hour' && (
              <div className="mt-1 flex items-center justify-between text-[10px] font-mono-tabular font-bold text-amber-300">
                <span>RUSH HOUR · STRICT ±{hud.maxAllowedAlignM.toFixed(1)}m</span>
                <span>DWELL {hud.requiredBoardingSec.toFixed(1)}s</span>
              </div>
            )}

            {/* Alignment Bar with Dynamic Green/Yellow Sweet-Spot & Live Train Nose Pip */}
            <div className="relative mt-2 h-2.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/35"
                style={{ left: `${allowedLeftPct}%`, width: `${allowedWidthPct}%` }}
              />
              <div
                className="absolute top-0 bottom-0 bg-amber-400/90"
                style={{ left: `${perfectLeftPct}%`, width: `${perfectWidthPct}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-1.5 -ml-[3px] rounded-full bg-white shadow-[0_0_6px_#fff]"
                style={{ left: `${markerPct}%` }}
              />
            </div>

            {/* Explicit Clickable Open Doors & Close Doors Quick-Buttons when Stopped at Platform */}
            {showStationDoorActions && (
              <div className="pointer-events-auto mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={!hud.canOpenDoors}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onOpenDoors();
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                    hud.canOpenDoors
                      ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-300 text-white shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                      : 'bg-slate-800/80 border-slate-700 text-slate-500'
                  }`}
                >
                  <DoorOpen className="w-3.5 h-3.5" />
                  <span>Open Doors</span>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  disabled={!hud.canCloseDoors}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onCloseDoors();
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed ${
                    hud.canCloseDoors
                      ? 'bg-red-600 hover:bg-red-500 border-red-300 text-white shadow-[0_0_12px_rgba(239,68,68,0.45)]'
                      : 'bg-slate-800/80 border-slate-700 text-slate-500'
                  }`}
                >
                  <DoorClosed className="w-3.5 h-3.5" />
                  <span>Close Doors</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Right spacer so top-right utility controls remain clean */}
        <div className="w-[238px] hidden sm:block" aria-hidden="true" />
      </div>

      {/* Eco-Driving Energy Consumption Efficiency Dashboard Overlay (Top-Right below utility bar) */}
      {showEcoOverlay && (
        <aside
          data-testid="eco-dashboard-overlay"
          aria-label="Eco-Driving Energy Consumption Efficiency"
          className="pointer-events-none absolute top-16 right-3 z-20 w-[238px] rounded-lg border border-slate-700/85 px-3 py-2 text-slate-100 shadow-xl"
          style={{ backgroundColor: 'rgba(11, 17, 32, 0.92)' }}
        >
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <Leaf className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-200">
                Eco Drive [E]
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                data-testid="eco-grade-badge"
                className={`px-1.5 py-0.5 rounded border text-[10px] font-extrabold font-mono-tabular leading-none ${ecoGradeStyle}`}
              >
                {eco.ecoGrade}
              </span>
              <span
                data-testid="eco-efficiency-pct"
                className="text-xs font-extrabold font-mono-tabular text-white"
              >
                {eco.efficiencyPct}%
              </span>
            </div>
          </div>

          {/* Instantaneous Electrical Power Draw vs Regenerative Recovery */}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Zap
                className={`w-3.5 h-3.5 shrink-0 ${
                  eco.driveMode === 'REGEN'
                    ? 'text-emerald-400'
                    : eco.driveMode === 'TRACTION'
                      ? 'text-amber-400'
                      : 'text-teal-400'
                }`}
              />
              <span
                data-testid="eco-instant-kw"
                className={`text-sm font-extrabold font-mono-tabular ${
                  eco.instantPowerKw < 0
                    ? 'text-emerald-400'
                    : eco.driveMode === 'COAST'
                      ? 'text-teal-300'
                      : 'text-amber-300'
                }`}
              >
                {eco.instantPowerKw >= 0 ? `+${eco.instantPowerKw}` : eco.instantPowerKw} kW
              </span>
            </div>
            <span
              data-testid="eco-drive-mode"
              className={`px-1.5 py-0.5 rounded border text-[9.5px] font-extrabold tracking-wider font-mono-tabular leading-none ${regimeBadgeStyle}`}
            >
              {eco.driveMode}
            </span>
          </div>

          <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{
                width: `${powerBarPct}%`,
                backgroundColor:
                  eco.driveMode === 'REGEN'
                    ? '#10B981'
                    : eco.driveMode === 'COAST'
                      ? '#00AA91'
                      : eco.driveMode === 'FRICTION'
                        ? '#EF4444'
                        : '#F59E0B',
              }}
            />
          </div>

          {/* Compact Energy Telemetry Grid */}
          <div className="mt-2 grid grid-cols-2 gap-x-2.5 gap-y-1 text-[10px] border-t border-slate-800/90 pt-1.5">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Coast</span>
              <span className="font-mono-tabular font-bold text-teal-300">
                {eco.coastingSharePct}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Net</span>
              <span className="font-mono-tabular font-bold text-slate-100">
                {eco.netEnergyKwh.toFixed(2)} kWh
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Regen</span>
              <span className="font-mono-tabular font-bold text-emerald-400">
                {eco.regeneratedEnergyKwh.toFixed(2)} kWh
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Rate</span>
              <span className="font-mono-tabular font-bold text-slate-200">
                {eco.kwhPerKm.toFixed(1)} kWh/km
              </span>
            </div>
          </div>

          <div className="mt-1.5 pt-1 border-t border-slate-800/80 text-[10px] font-medium text-slate-300 truncate">
            {eco.advice}
          </div>
        </aside>
      )}
    </div>
  );
};
