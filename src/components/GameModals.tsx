import React from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { COLORS } from '../game/constants';
import type { FinalGradeSummary, StationStopRecord } from '../game/engine';
import {
  getDirectedRoute,
  getLineDefinition,
  type LineMode,
  type RouteDirection,
} from '../game/lines';
import { MoodFaceIcon } from './CockpitHUD';

import type { CameraViewMode } from '../game/three/Metro3DScene';

interface TitleOverlayProps {
  lineMode: LineMode;
  onSelectLineMode: (mode: LineMode) => void;
  direction: RouteDirection;
  onSelectDirection: (direction: RouteDirection) => void;
  startStationIndex: number;
  onSelectStartStation: (index: number) => void;
  viewMode: CameraViewMode;
  onSelectViewMode: (mode: CameraViewMode) => void;
  onStart: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  lineMode,
  onSelectLineMode,
  direction,
  onSelectDirection,
  startStationIndex,
  onSelectStartStation,
  viewMode,
  onSelectViewMode,
  onStart,
}) => {
  const lineDef = getLineDefinition(lineMode);
  const forwardRoute = getDirectedRoute(lineMode, 'forward');
  const reverseRoute = getDirectedRoute(lineMode, 'reverse');
  const activeRoute = direction === 'reverse' ? reverseRoute : forwardRoute;
  const isRer = lineMode === 'rerA';
  const departureStations = activeRoute.stations.slice(0, -1);

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col justify-between pointer-events-none"
      role="dialog"
      aria-label={`Paris ${lineDef.name} Simulator Title Screen`}
    >
      {/* Left-weighted dark scrim preserving crisp 3D view of terminus station & rolling stock */}
      <div
        className="absolute inset-0 pointer-events-none remaster-title-scrim"
      />

      {/* Asymmetric left-third RATP Transit Plaque Lockup */}
      <div className="relative z-10 flex-1 flex items-center px-6 sm:px-12 lg:px-16">
        <div className="max-w-xl pointer-events-auto remaster-title-panel">
          <div className="remaster-kicker">
            <span>RATP · OPERATIONS SIMULATOR</span>
            <span className="remaster-kicker-status"><i /> SYSTEM READY</span>
          </div>

          {/* Bespoke inline SVG Transit Emblem (M14 or RER A) */}
          <svg
            viewBox="0 0 490 56"
            className="w-[440px] max-w-full h-12 mb-2.5"
            aria-label={`${lineDef.name} ${lineDef.subtitle}`}
          >
            {/* System Circle Badge */}
            <circle
              cx="26"
              cy="28"
              r="21"
              fill="#0B1120"
              stroke="#F8FAFC"
              strokeWidth="3.5"
            />
            <text
              x="26"
              y={isRer ? '33' : '35'}
              textAnchor="middle"
              fill="#F8FAFC"
              fontSize={isRer ? '13.5' : '24'}
              fontWeight="800"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {lineDef.systemBadge}
            </text>
            {/* Line Color Square */}
            <rect
              x="58"
              y="7"
              width="48"
              height="42"
              rx="8"
              fill={lineDef.primaryColor}
            />
            <text
              x="82"
              y="36"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="24"
              fontWeight="800"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {lineDef.badgeText}
            </text>
            {/* Route subtitle bar */}
            <line
              x1="120"
              y1="28"
              x2="480"
              y2="28"
              stroke={lineDef.accentColor}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <text
              x="120"
              y="19"
              fill="#F1F5F9"
              fontSize="11.5"
              fontWeight="700"
              letterSpacing="1.0"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {activeRoute.subtitle}
            </text>
            <text
              x="120"
              y="45"
              fill="#94A3B8"
              fontSize="9.8"
              fontWeight="600"
              letterSpacing="0.45"
              fontFamily="Plus Jakarta Sans, sans-serif"
            >
              {isRer
                ? `3D MI09 DOUBLE-DECKER · ${activeRoute.stations.length} STATIONS · 120 KM/H EXPRESS`
                : `3D MP14 · ${activeRoute.stations.length} STATIONS · PARIS METRO`}
            </text>
          </svg>

          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.06]"
            style={{ textWrap: 'balance' }}
          >
            {isRer ? 'Paris RER A Simulator' : 'Paris Metro Simulator'}
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md">
            {isRer
              ? 'Pilot a double-decker 3D MI09 express under 1500V catenary wires across outdoor western & eastern suburban lines and central underground halls including La Défense.'
              : 'Drive an articulated 3D MP14 train through all 21 Line 14 stations and ribbed TBM tunnels. Switch live between Side, Conductor Cab, and Chase 3D views.'}
          </p>

          <div className="remaster-spec-strip" aria-label="Train specifications">
            <div><span>ROLLING STOCK</span><strong>{isRer ? 'MI09 · 2-LEVEL' : 'MP14 · 8-CAR'}</strong></div>
            <div><span>NETWORK</span><strong>{isRer ? 'RER A' : 'METRO 14'}</strong></div>
            <div><span>CAMERAS</span><strong>04 PERSPECTIVES</strong></div>
          </div>

          {/* Service Line Selector (Metro 14 vs RER A Express) */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center p-1 rounded-lg bg-[#0B1120] border border-slate-700"
              role="group"
              aria-label="Service Line Selector"
            >
              <button
                type="button"
                data-testid="btn-line-metro14"
                onClick={() => onSelectLineMode('metro14')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  lineMode === 'metro14'
                    ? 'bg-[#62259D] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>M 14 · Metro MP14</span>
              </button>
              <button
                type="button"
                data-testid="btn-line-rerA"
                onClick={() => onSelectLineMode('rerA')}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  lineMode === 'rerA'
                    ? 'bg-[#E3051C] text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>RER A · MI09 Double-Decker</span>
              </button>
            </div>
          </div>

          {/* Route Direction & Starting Station Pickers */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <div
              className="inline-flex items-center p-1 rounded-lg bg-[#0B1120] border border-slate-700"
              role="group"
              aria-label="Route Direction Selector"
            >
              <button
                type="button"
                data-testid="btn-dir-forward"
                onClick={() => onSelectDirection('forward')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  direction === 'forward'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {forwardRoute.originShortName} → {forwardRoute.terminusShortName}
              </button>
              <button
                type="button"
                data-testid="btn-dir-reverse"
                onClick={() => onSelectDirection('reverse')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  direction === 'reverse'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {reverseRoute.originShortName} → {reverseRoute.terminusShortName}
              </button>
            </div>

            <label className="inline-flex items-center gap-2 rounded-lg bg-[#0B1120] border border-slate-700 px-2.5 py-1.5 text-xs">
              <span className="text-slate-400 font-semibold whitespace-nowrap">Depart:</span>
              <select
                data-testid="select-start-station"
                aria-label="Starting Station"
                value={startStationIndex}
                onChange={(e) => onSelectStartStation(Number(e.target.value))}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
              >
                {departureStations.map((st, idx) => (
                  <option key={st.id} value={idx} className="bg-[#0B1120] text-white">
                    {st.shortName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* Segmented Starting 3D Camera Picker + Start CTA */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg text-sm font-bold text-white shadow-lg transition-transform active:scale-[0.98] cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: lineDef.primaryColor }}
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Service</span>
            </button>

            <div
              className="inline-flex items-center p-1 rounded-lg bg-[#0B1120] border border-slate-700"
              role="group"
              aria-label="Camera View Selector"
            >
              <button
                type="button"
                onClick={() => onSelectViewMode('side')}
                className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'side'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Side 3D
              </button>
              <button
                type="button"
                onClick={() => onSelectViewMode('cab')}
                className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'cab'
                    ? 'bg-[#00AA91] text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Conductor Cab
              </button>
              <button
                type="button"
                onClick={() => onSelectViewMode('chase')}
                className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'chase'
                    ? 'bg-[#62259D] text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Chase 3D
              </button>
              <button
                type="button"
                data-testid="btn-title-view-passenger"
                onClick={() => onSelectViewMode('passenger')}
                className={`px-3 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'passenger'
                    ? 'bg-sky-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Passenger
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Single flat, borderless control hint line in bottom safe margin of viewport */}
      <div className="relative z-10 px-6 sm:px-12 lg:px-16 pb-4 text-xs text-slate-200/90 font-medium tracking-wide">
        W / S or ↑ / ↓ Traction &amp; Brake · Space Doors · V Cycle 3D Views · E Eco HUD · H Horn · B Emergency · P Pause · M Mute
      </div>
    </div>
  );
};

interface PauseModalProps {
  lineMode: LineMode;
  direction: RouteDirection;
  startStationIndex: number;
  onResume: () => void;
  onRestart: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  lineMode,
  direction,
  startStationIndex,
  onResume,
  onRestart,
  onTitle,
}) => {
  const lineDef = getLineDefinition(lineMode);
  const route = getDirectedRoute(lineMode, direction);
  const originName = route.stations[startStationIndex]?.shortName ?? route.originShortName;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Service Paused"
    >
      <div className="w-full max-w-sm rounded-xl bg-[#111827] border border-slate-700 p-6 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-2">
          <span
            className="inline-flex items-center justify-center px-2 min-w-[28px] h-6 rounded text-xs font-extrabold text-white"
            style={{ backgroundColor: lineDef.primaryColor }}
          >
            {lineDef.badgeText}
          </span>
          <h2 className="text-xl font-bold text-white">Service Paused</h2>
        </div>
        <p className="text-sm text-slate-400 mb-6">
          {lineDef.name} simulation is halted. Resume when ready to continue your route.
        </p>

        <div className="flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-bold text-white transition-colors cursor-pointer"
            style={{ backgroundColor: COLORS.ratpTurquoise }}
          >
            Resume Driving
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Restart at {originName}
          </button>
          <button
            type="button"
            onClick={onTitle}
            className="w-full py-2.5 px-4 rounded-lg text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Return to Title Screen
          </button>
        </div>
      </div>
    </div>
  );
};

interface SummaryModalProps {
  summary: FinalGradeSummary;
  records: StationStopRecord[];
  onRestart: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({ summary, records, onRestart }) => {
  const lineDef = getLineDefinition(summary.lineMode);
  const terminusName = summary.terminusName;

  const gradeColor =
    summary.grade === 'S'
      ? '#10B981'
      : summary.grade === 'A'
        ? '#00AA91'
        : summary.grade === 'B'
          ? '#F59E0B'
          : '#94A3B8';

  const moodText =
    summary.finalMood === 'happy'
      ? 'Happy Commuters'
      : summary.finalMood === 'neutral'
        ? 'Neutral Commuters'
        : 'Annoyed Commuters';

  const scheduleText =
    Math.abs(summary.finalScheduleDeltaSec) <= 5
      ? 'On Time'
      : summary.finalScheduleDeltaSec < 0
        ? `${Math.abs(summary.finalScheduleDeltaSec)}s Early`
        : `+${summary.finalScheduleDeltaSec}s Late`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`End of Line Summary at ${terminusName}`}
    >
      <div className="w-full max-w-2xl rounded-xl bg-[#111827] border border-slate-700 p-6 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header with Grade Crest */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="text-xs font-semibold text-slate-400">
              Terminus Reached · {terminusName} ({lineDef.name})
            </div>
            <h2 className="text-2xl font-extrabold text-white mt-0.5">{summary.title}</h2>
          </div>

          <div
            className="flex flex-col items-center justify-center w-16 h-16 rounded-xl border-2 shrink-0"
            style={{
              borderColor: gradeColor,
              backgroundColor: 'rgba(11, 17, 32, 0.9)',
            }}
            data-testid="summary-grade"
          >
            <span className="text-[10px] font-bold uppercase text-slate-400 leading-none">
              Grade
            </span>
            <span
              className="text-3xl font-extrabold leading-tight font-mono-tabular"
              style={{ color: gradeColor }}
            >
              {summary.grade}
            </span>
          </div>
        </div>

        {/* Core Mastery KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-slate-800">
          <div className="rounded-lg bg-[#0B1120] p-3">
            <div className="text-[11px] text-slate-400">Final Score</div>
            <div className="text-xl font-extrabold text-white font-mono-tabular mt-0.5">
              {summary.totalScore}
            </div>
            <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
              Base {summary.baseScore} {summary.moodBonus >= 0 ? '+' : ''}
              {summary.moodBonus} mood {summary.ecoBonus >= 0 ? '+' : ''}
              {summary.ecoBonus} eco
            </div>
          </div>

          <div className="rounded-lg bg-[#0B1120] p-3">
            <div className="text-[11px] text-slate-400">Passenger Mood</div>
            <div className="flex items-center gap-2 mt-1">
              <MoodFaceIcon mood={summary.finalMood} className="w-6 h-6 shrink-0" />
              <span className="text-sm font-bold text-white leading-tight">{moodText}</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
              Avg Comfort {summary.averageComfort}%
            </div>
          </div>

          <div className="rounded-lg bg-[#0B1120] p-3">
            <div className="text-[11px] text-slate-400">Stop Accuracy &amp; Eco</div>
            <div className="text-xl font-extrabold text-teal-300 font-mono-tabular mt-0.5">
              {summary.averageAlignmentM}m · {summary.ecoGrade}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {summary.perfectStops}/{summary.totalStops} Perfect · {summary.ecoEfficiencyPct}% Eco ({summary.netEnergyKwh} kWh)
            </div>
          </div>

          <div className="rounded-lg bg-[#0B1120] p-3">
            <div className="text-[11px] text-slate-400">Schedule &amp; Radar</div>
            <div className="text-xl font-extrabold text-amber-300 font-mono-tabular mt-0.5">
              {scheduleText}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Overspeed {summary.overspeedSeconds}s · Radar {summary.speedCameraInfractions}
            </div>
          </div>
        </div>

        {/* Station-by-Station Log */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1.5 min-h-[120px]">
          {records.map((rec) => (
            <div
              key={rec.stationId}
              className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-[#0B1120]/80"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <MoodFaceIcon mood={rec.moodAtStop} className="w-4 h-4 shrink-0" />
                <span className="font-semibold text-slate-100 truncate">{rec.stationName}</span>
                <span className="text-slate-500">·</span>
                <span
                  className={
                    rec.quality === 'perfect'
                      ? 'text-emerald-400 font-semibold'
                      : rec.quality === 'good'
                        ? 'text-teal-300'
                        : rec.quality === 'overshot'
                          ? 'text-red-400 font-semibold'
                          : 'text-amber-300'
                  }
                >
                  {rec.quality === 'overshot'
                    ? 'Overshot'
                    : `${Math.abs(rec.alignmentErrorM).toFixed(1)}m (${rec.quality})`}
                </span>
              </div>
              <span
                className={`font-mono-tabular font-bold shrink-0 ml-2 ${
                  rec.pointsAwarded >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {rec.pointsAwarded >= 0 ? `+${rec.pointsAwarded}` : rec.pointsAwarded} pts
              </span>
            </div>
          ))}
        </div>

        {/* Primary Action */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            data-start="true"
            onClick={onRestart}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-white transition-transform active:scale-[0.98] cursor-pointer whitespace-nowrap"
            style={{ backgroundColor: lineDef.primaryColor }}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Drive {lineDef.name} Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
