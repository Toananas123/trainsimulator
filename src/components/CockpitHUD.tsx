import React from 'react';
import { Bell, CloudFog, DoorClosed, DoorOpen, Leaf, Sun, Users } from 'lucide-react';
import { COLORS } from '../game/constants';
import type { HudSnapshot, PassengerMood, RushHourPeriod, WeatherType } from '../game/engine';
import { getDirectedRoute } from '../game/lines';
import { RouteMap } from './RouteMap';
import { Speedometer } from './Speedometer';
import { TractionLever } from './TractionLever';

interface CockpitHUDProps {
  hud: HudSnapshot;
  showEcoOverlay: boolean;
  onLeverChange: (value: number) => void;
  onEmergencyBrake: () => void;
  onOpenDoors: () => void;
  onCloseDoors: () => void;
  onCycleWeather: () => void;
  onCycleRushHour: () => void;
  onToggleEcoOverlay: () => void;
  onHorn: () => void;
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const MoodFaceIcon: React.FC<{ mood: PassengerMood; className?: string }> = ({
  mood,
  className = 'w-6 h-6',
}) => {
  if (mood === 'happy') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#064E3B" stroke="#10B981" strokeWidth="1.8" />
        <circle cx="8.5" cy="9.5" r="1.4" fill="#6EE7B7" />
        <circle cx="15.5" cy="9.5" r="1.4" fill="#6EE7B7" />
        <path
          d="M7.8 14.2C8.8 16.4 10.3 17.2 12 17.2C13.7 17.2 15.2 16.4 16.2 14.2"
          fill="none"
          stroke="#6EE7B7"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (mood === 'neutral') {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="#451A03" stroke="#F59E0B" strokeWidth="1.8" />
        <circle cx="8.5" cy="9.5" r="1.4" fill="#FDE68A" />
        <circle cx="15.5" cy="9.5" r="1.4" fill="#FDE68A" />
        <line
          x1="8.2"
          y1="15.4"
          x2="15.8"
          y2="15.4"
          stroke="#FDE68A"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#450A0A" stroke="#EF4444" strokeWidth="1.8" />
      <path d="M7.2 8.2L10 9.6" stroke="#FCA5A5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M16.8 8.2L14 9.6" stroke="#FCA5A5" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="8.8" cy="10.8" r="1.2" fill="#FCA5A5" />
      <circle cx="15.2" cy="10.8" r="1.2" fill="#FCA5A5" />
      <path
        d="M8.2 16.8C9.2 14.9 10.6 14.3 12 14.3C13.4 14.3 14.8 14.9 15.8 16.8"
        fill="none"
        stroke="#FCA5A5"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
};

function getWeatherMeta(weather: WeatherType) {
  if (weather === 'fog') {
    return {
      label: 'Fog',
      color: 'text-slate-300',
      Icon: CloudFog,
    };
  }
  return {
    label: 'Clear',
    color: 'text-amber-300',
    Icon: Sun,
  };
}

function getRushHourMeta(period: RushHourPeriod) {
  if (period === 'rush_hour') {
    return {
      label: 'Rush Hour',
      mult: '1.7×',
      color: 'text-amber-300',
    };
  }
  if (period === 'off_peak') {
    return {
      label: 'Off-Peak',
      mult: '0.7×',
      color: 'text-emerald-300',
    };
  }
  return {
    label: 'Normal',
    mult: '1.0×',
    color: 'text-slate-300',
  };
}

export const CockpitHUD: React.FC<CockpitHUDProps> = ({
  hud,
  showEcoOverlay,
  onLeverChange,
  onEmergencyBrake,
  onOpenDoors,
  onCloseDoors,
  onCycleWeather,
  onCycleRushHour,
  onToggleEcoOverlay,
  onHorn,
}) => {
  const isPlaying = hud.phase === 'playing';

  // Punctuality status
  const delta = hud.scheduleDeltaSec;
  const punctualityText =
    Math.abs(delta) <= 3
      ? 'On Time'
      : delta < 0
        ? `${Math.abs(delta)}s Early`
        : `+${delta}s Delayed`;
  const punctualityColor =
    Math.abs(delta) <= 3
      ? 'text-emerald-400'
      : delta < 0
        ? 'text-sky-400'
        : 'text-amber-400';

  const moodLabel =
    hud.passengerMood === 'happy'
      ? 'Happy'
      : hud.passengerMood === 'neutral'
        ? 'Neutral'
        : 'Annoyed';
  const moodColor =
    hud.passengerMood === 'happy'
      ? 'text-emerald-400'
      : hud.passengerMood === 'neutral'
        ? 'text-amber-400'
        : 'text-red-400';
  const comfortBarColor =
    hud.comfort >= 75 ? '#10B981' : hud.comfort >= 45 ? '#F59E0B' : '#EF4444';

  const weatherMeta = getWeatherMeta(hud.weather);
  const WeatherIcon = weatherMeta.Icon;
  const rushMeta = getRushHourMeta(hud.rushHourPeriod);

  const startStopX =
    getDirectedRoute(hud.lineMode, hud.direction).stations[hud.startStationIndex]?.stopX ?? 0;

  const doorStatusLabel =
    hud.doorState === 'closed'
      ? hud.canOpenDoors
        ? 'Aligned · Ready to Open'
        : hud.speedKmh < 0.3
          ? Math.abs(hud.trainX - startStopX) < 5
            ? 'Ready to Depart'
            : 'Outside Alignment Zone'
          : 'Locked in Motion'
      : hud.doorState === 'opening'
        ? 'Opening Doors...'
        : hud.doorState === 'open'
          ? hud.boardingComplete
            ? hud.excessDwellSec > 3.5
              ? 'Depart Now! Dwell Delay'
              : 'Boarding Complete · Close'
            : `Boarding ${Math.round(hud.boardingProgress * 100)}%`
          : hud.doorState === 'closing_warning'
            ? 'Warning Buzzer...'
            : 'Closing Doors...';

  return (
    <section
      aria-label="Metro Train Cockpit Controls"
      className="w-full bg-gradient-to-b from-[#202938] via-[#151C28] to-[#0C111B] border-t-[3px] border-slate-500/80 shadow-[inset_0_2px_0_rgba(255,255,255,0.14),inset_0_-8px_20px_rgba(0,0,0,0.65)] flex flex-col justify-between shrink-0"
      style={{ height: '35vh', minHeight: '225px', maxHeight: '320px' }}
    >
      {/* Main 4-Module Physical RATP Driver Desk (Pupitre de Conduite) */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-2.5 px-3 sm:px-4 py-2">
        {/* MODULE 1 (LEFT): Recessed Alstom DMI (Driver Machine Interface) Telemetry Display */}
        <div className="relative col-span-5 lg:col-span-4 rounded-lg bg-[#070B13] border-2 border-slate-700/90 shadow-[inset_0_3px_12px_rgba(0,0,0,0.9),0_1px_0_rgba(255,255,255,0.08)] px-3 py-2 flex flex-col justify-between min-w-0">
          {/* Top Row: Schedule Clock, Score & Speed Limit Sign */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-baseline gap-2.5">
                <span
                  data-testid="hud-clock"
                  className="text-lg sm:text-xl font-bold font-mono-tabular text-amber-300 leading-none"
                >
                  {formatClock(hud.elapsedTimeSec)}
                </span>
                <span className={`text-xs font-semibold whitespace-nowrap ${punctualityColor}`}>
                  {punctualityText}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                <span>
                  Score{' '}
                  <strong data-testid="hud-score" className="text-white font-mono-tabular text-sm">
                    {hud.score}
                  </strong>
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="btn-weather"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onCycleWeather();
                  }}
                  title="Cycle dynamic weather (Clear / Fog) — updates track friction"
                  aria-label={`Weather ${weatherMeta.label}, Track Grip ${hud.trackFrictionMultiplier.toFixed(2)}x. Click to cycle weather`}
                  className="inline-flex items-center gap-1 text-xs hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  <WeatherIcon className={`w-3.5 h-3.5 ${weatherMeta.color}`} />
                  <span className={`font-semibold ${weatherMeta.color}`}>{weatherMeta.label}</span>
                  <span
                    data-testid="hud-track-friction"
                    className="font-mono-tabular text-[11px] text-slate-300"
                  >
                    {hud.trackFrictionMultiplier.toFixed(2)}×
                  </span>
                </button>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  data-testid="btn-rush-hour"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onCycleRushHour();
                  }}
                  title="Cycle passenger density (Off-Peak / Normal / Rush Hour) — affects boarding dwell time & strict door alignment"
                  aria-label={`Passenger Density ${rushMeta.label} ${rushMeta.mult}. Click to cycle`}
                  className="inline-flex items-center gap-1 text-xs hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Users className={`w-3.5 h-3.5 ${rushMeta.color}`} />
                  <span className={`font-semibold ${rushMeta.color}`}>{rushMeta.label}</span>
                  <span className="font-mono-tabular text-[11px] text-slate-300">
                    {rushMeta.mult}
                  </span>
                </button>
                {hud.speedCameraInfractions > 0 && (
                  <>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span
                      data-testid="hud-radar-count"
                      className="text-[11px] font-bold font-mono-tabular text-red-400 whitespace-nowrap"
                    >
                      Radar ×{hud.speedCameraInfractions}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Active Speed Limit Sign + Signal Aspect Lamp */}
            <div className="flex items-center gap-2 shrink-0">
              <div
                data-testid="hud-speed-limit"
                className={`flex flex-col items-center justify-center w-12 h-12 rounded-full bg-slate-100 border-[3px] shadow-md ${
                  hud.isOverspeeding
                    ? 'border-red-500 overspeed-flash'
                    : 'border-red-600'
                }`}
                title={`Active Speed Limit: ${hud.speedLimitKmh} km/h`}
              >
                <span className="text-slate-950 font-extrabold text-sm leading-none font-mono-tabular">
                  {hud.speedLimitKmh}
                </span>
                <span className="text-[8px] font-bold text-slate-700 leading-none mt-0.5">
                  km/h
                </span>
              </div>

              {/* Dual Signal Aspect Repeater Lamp */}
              <div
                className="flex flex-col items-center gap-1.5 bg-[#04070D] border border-slate-700 rounded-md px-1.5 py-1.5 shadow-inner"
                aria-label={`Track Signal ${hud.signalAspect}`}
              >
                <span
                  className="w-3 h-3 rounded-full transition-colors"
                  style={{
                    backgroundColor:
                      hud.signalAspect === 'green'
                        ? COLORS.ratpTurquoise
                        : hud.signalAspect === 'amber'
                          ? COLORS.warningAmber
                          : '#1E293B',
                    boxShadow:
                      hud.signalAspect === 'green'
                        ? '0 0 8px rgba(0, 170, 145, 0.85)'
                        : hud.signalAspect === 'amber'
                          ? '0 0 8px rgba(245, 158, 11, 0.85)'
                          : 'none',
                  }}
                />
                <span
                  className="w-3 h-3 rounded-full transition-colors"
                  style={{
                    backgroundColor: hud.signalAspect === 'red' ? '#EF4444' : '#1E293B',
                    boxShadow:
                      hud.signalAspect === 'red' ? '0 0 8px rgba(239, 68, 68, 0.85)' : 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Middle Row: Next Station, Target Arrival Time & Live Distance Countdown */}
          <div className="flex items-center justify-between gap-2 border-t border-slate-800/90 pt-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider">
                <span className="text-slate-400">Next Station</span>
                <span
                  data-testid="hud-next-station-eta"
                  className={`font-mono-tabular font-bold normal-case tracking-normal whitespace-nowrap ${
                    hud.legRemainingSec < 0
                      ? 'text-red-400'
                      : hud.legRemainingSec <= 10
                        ? 'text-amber-300'
                        : 'text-sky-300'
                  }`}
                >
                  Due {formatClock(hud.nextStationDueTimeSec)} ·{' '}
                  {hud.legRemainingSec >= 0
                    ? `${hud.legRemainingSec}s`
                    : `+${Math.abs(hud.legRemainingSec)}s late`}
                </span>
              </div>
              <div
                data-testid="hud-next-station"
                className="text-sm sm:text-[15px] font-bold text-white truncate"
              >
                {hud.nextStationName}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Distance
              </div>
              <div
                data-testid="hud-distance"
                className="text-sm sm:text-base font-bold font-mono-tabular text-teal-300"
              >
                {hud.distanceToNextM >= 0
                  ? `${Math.round(hud.distanceToNextM)} m`
                  : `+${Math.abs(hud.distanceToNextM).toFixed(1)} m`}
              </div>
            </div>
          </div>

          {/* Bottom Row: Passenger Comfort Meter & Expressive Mood Indicator */}
          <div className="border-t border-slate-800/90 pt-1.5 flex items-center gap-2.5">
            <div className="shrink-0" data-testid="hud-mood-face">
              <MoodFaceIcon mood={hud.passengerMood} className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[11px] leading-tight mb-1">
                <span className="text-slate-300 font-medium truncate">
                  Comfort{' '}
                  <strong className={`font-semibold ${moodColor}`} data-testid="hud-mood-label">
                    {moodLabel}
                  </strong>
                  <span className="hidden md:inline text-slate-500"> · {hud.moodReason}</span>
                </span>
                <span className="font-mono-tabular font-bold text-slate-200 ml-1 shrink-0">
                  {hud.comfort}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${hud.comfort}%`,
                    backgroundColor: comfortBarColor,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* MODULE 2 (CENTER-LEFT): Brushed-Metal Industrial Door Pushbutton Bay & Cab Klaxon */}
        <div className="relative col-span-3 lg:col-span-3 rounded-lg bg-gradient-to-b from-[#171F2E] to-[#0C111B] border border-slate-700/85 shadow-[inset_0_2px_10px_rgba(0,0,0,0.72)] px-3 py-2 flex flex-col justify-between">
          {/* Corner fasteners */}
          <span className="pointer-events-none absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80" />
          <span className="pointer-events-none absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80" />

          <div className="flex items-center justify-between gap-2 pl-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300 whitespace-nowrap">
              Doors [Space]
            </span>
            <span
              className={`text-[11px] font-semibold truncate ${
                hud.canOpenDoors
                  ? 'text-emerald-400'
                  : hud.canCloseDoors
                    ? 'text-amber-300'
                    : 'text-slate-400'
              }`}
            >
              {doorStatusLabel}
            </span>
          </div>

          {/* Physical Industrial Backlit Transit Pushbuttons with Metallic Collar Rings */}
          <div className="grid grid-cols-2 gap-2.5 my-1">
            <button
              type="button"
              tabIndex={-1}
              data-testid="btn-open-doors"
              disabled={!isPlaying || !hud.canOpenDoors}
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenDoors();
              }}
              aria-label="Open Doors"
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 py-2 px-2 transition-all cursor-pointer disabled:cursor-not-allowed shadow-[0_3px_8px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.22)] active:translate-y-[1px] ${
                hud.canOpenDoors
                  ? 'bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 border-emerald-200 text-white shadow-[0_0_18px_rgba(16,185,129,0.5)]'
                  : 'bg-gradient-to-b from-[#132922] to-[#0A1713] border-slate-600/75 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full border border-black/40 shadow-inner ${
                    hud.canOpenDoors ? 'bg-emerald-200 shadow-[0_0_8px_#a7f3d0]' : 'bg-slate-700'
                  }`}
                />
                <DoorOpen className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-extrabold whitespace-nowrap">Open Doors</span>
            </button>

            <button
              type="button"
              tabIndex={-1}
              data-testid="btn-close-doors"
              disabled={!isPlaying || !hud.canCloseDoors}
              onClick={(e) => {
                e.currentTarget.blur();
                onCloseDoors();
              }}
              aria-label="Close Doors"
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 py-2 px-2 transition-all cursor-pointer disabled:cursor-not-allowed shadow-[0_3px_8px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.22)] active:translate-y-[1px] ${
                hud.canCloseDoors
                  ? 'bg-gradient-to-b from-red-500 to-red-700 hover:from-red-400 hover:to-red-600 border-red-200 text-white shadow-[0_0_18px_rgba(239,68,68,0.5)]'
                  : 'bg-gradient-to-b from-[#291317] to-[#170A0D] border-slate-600/75 text-slate-500'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`w-2.5 h-2.5 rounded-full border border-black/40 shadow-inner ${
                    hud.canCloseDoors ? 'bg-red-200 shadow-[0_0_8px_#fecaca]' : 'bg-slate-700'
                  }`}
                />
                <DoorClosed className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-extrabold whitespace-nowrap">Close Doors</span>
            </button>
          </div>

          {/* Boarding Progress Bar + Tactile Cab Warning Klaxon Switch */}
          <div className="flex items-end gap-2.5">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                <span>Passenger Boarding</span>
                <span className="font-mono-tabular text-slate-200">
                  {hud.doorState === 'closed'
                    ? '—'
                    : `${Math.round(hud.boardingProgress * 100)}%`}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-900 border border-slate-700/70 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${hud.doorState === 'closed' ? 0 : Math.round(hud.boardingProgress * 100)}%`,
                    backgroundColor: hud.boardingComplete ? '#FACC15' : COLORS.ratpTurquoise,
                  }}
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                tabIndex={-1}
                data-testid="btn-eco-toggle"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleEcoOverlay();
                }}
                aria-pressed={showEcoOverlay}
                aria-label="Toggle Eco Energy Dashboard Overlay"
                title="Toggle Eco-Driving Energy Dashboard [E]"
                className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md border text-[10px] font-bold shadow-sm transition-colors cursor-pointer whitespace-nowrap ${
                  showEcoOverlay
                    ? 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300 hover:bg-emerald-900/90'
                    : 'bg-slate-800 border-slate-600 text-slate-300 hover:text-white'
                }`}
              >
                <Leaf className="w-3 h-3" />
                <span>Eco [E]</span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                disabled={!isPlaying}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onHorn();
                }}
                aria-label="Sound Cab Horn"
                title="Sound Cab Warning Horn [H]"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 active:from-amber-600 active:to-amber-700 border border-slate-500 text-[10px] font-bold text-slate-100 shadow-sm transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Bell className="w-3 h-3 text-amber-300" />
                <span>Horn [H]</span>
              </button>
            </div>
          </div>
        </div>

        {/* MODULE 3 (CENTER-RIGHT): Machined CBTC Analog / Digital Speedometer */}
        <div className="col-span-2 lg:col-span-2 min-h-0">
          <Speedometer
            speedKmh={hud.speedKmh}
            speedLimitKmh={hud.speedLimitKmh}
            isOverspeeding={hud.isOverspeeding}
            maxSpeedKmh={hud.maxSpeedDisplayKmh}
          />
        </div>

        {/* MODULE 4 (RIGHT): Brushed-Steel Master Traction & Brake Controller */}
        <div className="col-span-2 lg:col-span-3 min-h-0">
          <TractionLever
            lever={hud.lever}
            emergencyBrake={hud.emergencyBrake}
            disabled={!isPlaying}
            onChange={onLeverChange}
            onEmergency={onEmergencyBrake}
          />
        </div>
      </div>

      {/* BOTTOM STRIP: Interactive Line 14 / RER A Route Map */}
      <RouteMap
        lineMode={hud.lineMode}
        direction={hud.direction}
        startStationIndex={hud.startStationIndex}
        trainX={hud.trainX}
        nextStationIndex={hud.nextStationIndex}
        completedStations={hud.completedStations}
      />
    </section>
  );
};
