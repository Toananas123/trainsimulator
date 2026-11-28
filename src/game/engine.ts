import { type StationConfig } from './constants';
import {
  buildEcoSnapshot,
  createInitialEcoState,
  stepEcoEnergy,
  type EcoEnergySnapshot,
  type EcoEnergyState,
} from './ecoEnergy';
import {
  getDirectedRoute,
  getLineDefinition,
  getNextSpeedLimitChangeForRoute,
  getSpeedLimitAtForRoute,
  type LineMode,
  type RouteDirection,
} from './lines';
import {
  evaluateSpeedCameras,
  type SpeedCameraTicket,
  type UpcomingSpeedCamera,
} from './speedCamera';

export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type DoorState = 'closed' | 'opening' | 'open' | 'closing_warning' | 'closing';

export type StopQuality = 'perfect' | 'good' | 'fair' | 'overshot';

export type PassengerMood = 'happy' | 'neutral' | 'annoyed';

export type WeatherType = 'clear' | 'rain' | 'fog';

export type RushHourPeriod = 'off_peak' | 'normal' | 'rush_hour';

export interface PassengerActor {
  id: number;
  /** World X position in meters */
  x: number;
  /** Depth lane (0 = near platform foreground, 1 = inside train door plane) */
  depth: number;
  role: 'waiting' | 'boarding' | 'alighting' | 'departed';
  /** Target door X position in meters */
  targetDoorX: number;
  walkSpeed: number;
  coatColor: string;
  pantsColor: string;
  heightScale: number;
  hasBag: boolean;
  walkPhase: number;
  opacity: number;
}

export interface StationStopRecord {
  stationId: string;
  stationName: string;
  alignmentErrorM: number;
  quality: StopQuality;
  scheduleDeltaSec: number;
  pointsAwarded: number;
  comfortAtStop: number;
  moodAtStop: PassengerMood;
}

export interface FeedbackBanner {
  id: number;
  title: string;
  detail: string;
  pointsDelta: number;
  tone: 'success' | 'warning' | 'danger' | 'info';
  remainingSec: number;
}

export interface SimulationState {
  phase: GamePhase;
  /** Selected transit line mode: Line 14 MP14 Metro vs RER A MI09 Double-Decker Express */
  lineMode: LineMode;
  /** Direction of travel along the corridor */
  direction: RouteDirection;
  /** Selected departure station index in the directed route (0..N-2) */
  startStationIndex: number;
  /** Train nose world X position in meters (0 = terminus departure stopX) */
  trainX: number;
  /** Forward velocity in m/s */
  speedMs: number;
  /** Current acceleration in m/s² */
  accelMs2: number;
  /** Previous acceleration for jerk/comfort calculations */
  prevAccelMs2: number;
  /**
   * Lever position:
   *  +1.0 = Full Traction Acceleration
   *   0.0 = Coast
   *  -0.75 = Full Service Brake
   *  -1.0 = Emergency Brake (engaged)
   */
  lever: number;
  emergencyBrake: boolean;

  /** Index of the next destination station (starts at startStationIndex + 1) */
  nextStationIndex: number;
  /** Set of station indices already completed */
  completedStations: number[];

  /** Door system */
  doorState: DoorState;
  /** 0 = closed, 1 = fully open */
  doorOpenProgress: number;
  doorTimer: number;
  /** 0..1 boarding completion progress at current stop */
  boardingProgress: number;
  boardingComplete: boolean;
  /** Seconds elapsed AFTER boarding completed while doors remain open (excess dwell) */
  excessDwellSec: number;
  /** Required boarding seconds for current stop (scaled by Rush Hour & Station Density) */
  currentRequiredBoardingSec: number;
  /** Whether the current target station has had doors opened & boarding started */
  servedCurrentStation: boolean;
  /** Whether arrival chime has played on entering current station */
  arrivalChimePlayedForIndex: number;

  /** Passenger Density & Rush Hour Precision System */
  rushHourPeriod: RushHourPeriod;
  rushHourCycleTimerSec: number;

  /** Scoring, Comfort & Passenger Mood */
  score: number;
  comfort: number; // 0..100
  passengerMood: PassengerMood;
  moodReason: string;
  /** Running average comfort samples across the trip */
  comfortSum: number;
  comfortSamples: number;
  /** Total elapsed service time in seconds */
  elapsedTimeSec: number;
  /** Time spent on the current inter-station leg */
  legElapsedSec: number;
  /** Cumulative schedule delta in seconds (negative = early, positive = delayed) */
  scheduleDeltaSec: number;
  /** Current speed limit in km/h */
  speedLimitKmh: number;
  isOverspeeding: boolean;
  overspeedTimeSec: number;
  overspeedPenaltyAccumulator: number;
  emergencyBrakeCount: number;
  overshootCount: number;

  /** Eco-Driving Energy Consumption State */
  eco: EcoEnergyState;

  /** Dynamic Weather & Track Friction System */
  weather: WeatherType;
  /** Smooth 0..1 intensity for visual fade-in of rain/fog effects */
  weatherIntensity: number;
  /** Countdown in seconds until automatic weather cycle transition */
  weatherCycleTimerSec: number;
  /** Dynamic track adhesion/friction multiplier (1.00 clear, 0.94 fog, 0.82 wet rain) affecting accel & braking */
  trackFrictionMultiplier: number;
  /** Braking grip multiplier synced to dynamic track friction */
  brakingGripMultiplier: number;

  /** Automated Tunnel Speed Camera System */
  triggeredSpeedCameraIds: string[];
  /** Remaining strobe flash duration (seconds) after radar trigger */
  speedCameraFlashSec: number;
  lastSpeedCameraTicket: SpeedCameraTicket | null;
  speedCameraTickets: SpeedCameraTicket[];
  upcomingSpeedCamera: UpcomingSpeedCamera | null;

  /** Per-station stop history */
  stopRecords: StationStopRecord[];
  /** Active floating feedback toast */
  feedback: FeedbackBanner | null;
  feedbackCounter: number;

  /** Animated station passengers keyed by station index */
  passengers: Record<number, PassengerActor[]>;

  /** Events triggered during the last step for Web Audio / UI */
  events: SimulationEvents;
}

export interface SimulationEvents {
  arrivalChime: boolean;
  doorOpening: boolean;
  doorClosingBuzzer: boolean;
  doorClosingSlide: boolean;
  stationScored: boolean;
  overshootWarning: boolean;
  emergencyTriggered: boolean;
  speedCameraFlashed: SpeedCameraTicket | null;
  lineCompleted: boolean;
  weatherChanged: WeatherType | null;
}

export interface HudSnapshot {
  phase: GamePhase;
  lineMode: LineMode;
  direction: RouteDirection;
  startStationIndex: number;
  trainX: number;
  speedKmh: number;
  maxSpeedDisplayKmh: number;
  speedLimitKmh: number;
  nextSpeedChange: { distanceM: number; nextLimitKmh: number } | null;
  isOverspeeding: boolean;
  lever: number;
  emergencyBrake: boolean;
  score: number;
  comfort: number;
  passengerMood: PassengerMood;
  moodReason: string;
  rushHourPeriod: RushHourPeriod;
  effectiveCrowdMultiplier: number;
  perfectAlignM: number;
  maxAllowedAlignM: number;
  eco: EcoEnergySnapshot;
  weather: WeatherType;
  weatherIntensity: number;
  trackFrictionMultiplier: number;
  brakingGripMultiplier: number;
  speedCameraFlashIntensity: number;
  lastSpeedCameraTicket: SpeedCameraTicket | null;
  speedCameraInfractions: number;
  upcomingSpeedCamera: UpcomingSpeedCamera | null;
  elapsedTimeSec: number;
  scheduleDeltaSec: number;
  legRemainingSec: number;
  nextStationDueTimeSec: number;
  nextStationIndex: number;
  nextStationName: string;
  distanceToNextM: number;
  completedStations: number[];
  doorState: DoorState;
  doorOpenProgress: number;
  boardingProgress: number;
  boardingComplete: boolean;
  requiredBoardingSec: number;
  excessDwellSec: number;
  canOpenDoors: boolean;
  canCloseDoors: boolean;
  alignmentOffsetM: number | null;
  inStationZone: boolean;
  signalAspect: 'green' | 'amber' | 'red';
  feedback: FeedbackBanner | null;
  stopRecords: StationStopRecord[];
  finalGrade: FinalGradeSummary | null;
}

export interface FinalGradeSummary {
  lineMode: LineMode;
  direction: RouteDirection;
  terminusName: string;
  grade: 'S' | 'A' | 'B' | 'C';
  title: string;
  baseScore: number;
  moodBonus: number;
  ecoBonus: number;
  totalScore: number;
  finalMood: PassengerMood;
  ecoEfficiencyPct: number;
  ecoGrade: EcoEnergySnapshot['ecoGrade'];
  netEnergyKwh: number;
  coastingSharePct: number;
  averageAlignmentM: number;
  perfectStops: number;
  totalStops: number;
  finalScheduleDeltaSec: number;
  averageComfort: number;
  overspeedSeconds: number;
  emergencyBrakes: number;
  speedCameraInfractions: number;
}

export const WEATHER_SEQUENCE: WeatherType[] = ['clear', 'fog'];
export const WEATHER_CYCLE_INTERVAL_SEC = 600;
export const RUSH_HOUR_SEQUENCE: RushHourPeriod[] = ['off_peak', 'normal', 'rush_hour'];
export const RUSH_HOUR_CYCLE_INTERVAL_SEC = 900;
export const CLEAR_TRACK_FRICTION_MULTIPLIER = 1.0;
export const FOG_TRACK_FRICTION_MULTIPLIER = 0.94;
export const WET_BRAKING_GRIP_MULTIPLIER = 0.82;
export const WET_TRACTION_GRIP_MULTIPLIER = 0.86;
export const SPEED_CAMERA_FLASH_DURATION_SEC = 0.72;

const COAT_PALETTE = [
  '#1F2937', // charcoal coat
  '#334155', // slate trench
  '#1E3A5F', // Parisian navy
  '#4B5563', // wool grey
  '#7C2D12', // autumn rust
  '#3F3F46', // dark graphite
  '#365314', // olive parka
  '#581C87', // plum scarf/coat
  '#78350F', // camel coat
];

const PANTS_PALETTE = ['#111827', '#1E293B', '#27272A', '#374151', '#1F2937'];

/** Deterministic PRNG so passengers look lively & consistent without flicker */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Door X offsets relative to train nose (trainX) */
export const TRAIN_DOOR_OFFSETS_M = [-7.5, -17.5, -27.5, -39.5, -49.5, -59.5];

export function derivePassengerMood(comfort: number): PassengerMood {
  if (comfort >= 75) return 'happy';
  if (comfort >= 45) return 'neutral';
  return 'annoyed';
}

export function getTrackFrictionMultiplier(weather: WeatherType): number {
  if (weather === 'rain') return WET_BRAKING_GRIP_MULTIPLIER;
  if (weather === 'fog') return FOG_TRACK_FRICTION_MULTIPLIER;
  return CLEAR_TRACK_FRICTION_MULTIPLIER;
}

export function getWeatherGrip(weather: WeatherType): {
  friction: number;
  braking: number;
  traction: number;
} {
  if (weather === 'rain') {
    return {
      friction: WET_BRAKING_GRIP_MULTIPLIER,
      braking: WET_BRAKING_GRIP_MULTIPLIER,
      traction: WET_TRACTION_GRIP_MULTIPLIER,
    };
  }
  if (weather === 'fog') {
    return {
      friction: FOG_TRACK_FRICTION_MULTIPLIER,
      braking: FOG_TRACK_FRICTION_MULTIPLIER,
      traction: 0.96,
    };
  }
  return {
    friction: CLEAR_TRACK_FRICTION_MULTIPLIER,
    braking: CLEAR_TRACK_FRICTION_MULTIPLIER,
    traction: CLEAR_TRACK_FRICTION_MULTIPLIER,
  };
}

export function getRushHourMultiplier(period: RushHourPeriod): number {
  if (period === 'rush_hour') return 1.65;
  if (period === 'off_peak') return 0.72;
  return 1.0;
}

export function getAlignmentTolerances(
  lineMode: LineMode,
  rushHourPeriod: RushHourPeriod
): { perfectAlignM: number; goodAlignM: number; maxAllowedAlignM: number } {
  const phys = getLineDefinition(lineMode).physics;
  if (rushHourPeriod === 'rush_hour') {
    return {
      perfectAlignM: Number((phys.perfectAlignM * 0.65).toFixed(2)),
      goodAlignM: Number((phys.goodAlignM * 0.65).toFixed(2)),
      maxAllowedAlignM: Number((phys.maxAllowedAlignM * 0.6).toFixed(2)),
    };
  }
  return {
    perfectAlignM: phys.perfectAlignM,
    goodAlignM: phys.goodAlignM,
    maxAllowedAlignM: phys.maxAllowedAlignM,
  };
}

export function getEffectiveRequiredBoardingSec(
  station: StationConfig,
  lineMode: LineMode,
  rushHourPeriod: RushHourPeriod
): number {
  const base = getLineDefinition(lineMode).physics.baseBoardingDuration;
  return base * station.crowdDensity * getRushHourMultiplier(rushHourPeriod);
}

export function createStationPassengers(
  stationIndex: number,
  station: StationConfig,
  lineMode: LineMode = 'metro14',
  rushHourPeriod: RushHourPeriod = 'normal'
): PassengerActor[] {
  const rand = mulberry32((lineMode === 'rerA' ? 2400 : 1400) + stationIndex * 97);
  const doorOffsets = getLineDefinition(lineMode).doorOffsetsM;
  const densityMult = station.crowdDensity * getRushHourMultiplier(rushHourPeriod);
  const count = Math.min(24, Math.max(5, Math.round(10 * densityMult)));
  const list: PassengerActor[] = [];

  for (let i = 0; i < count; i++) {
    const doorIdx = i % doorOffsets.length;
    const doorWorldX = station.stopX + doorOffsets[doorIdx];
    const spread = (rand() - 0.5) * 6.5;
    list.push({
      id: stationIndex * 100 + i,
      x: doorWorldX + spread,
      depth: 0.14 + rand() * 0.28,
      role: 'waiting',
      targetDoorX: doorWorldX + (rand() - 0.5) * 0.8,
      walkSpeed: 1.4 + rand() * 0.9,
      coatColor: COAT_PALETTE[Math.floor(rand() * COAT_PALETTE.length)],
      pantsColor: PANTS_PALETTE[Math.floor(rand() * PANTS_PALETTE.length)],
      heightScale: 0.9 + rand() * 0.18,
      hasBag: rand() > 0.45,
      walkPhase: rand() * Math.PI * 2,
      opacity: 1,
    });
  }

  return list;
}

export interface InitialStateOptions {
  direction?: RouteDirection;
  startStationIndex?: number;
}

export function createInitialState(
  startPhase: GamePhase = 'title',
  lineMode: LineMode = 'metro14',
  options: InitialStateOptions = {}
): SimulationState {
  const direction: RouteDirection = options.direction ?? 'forward';
  const route = getDirectedRoute(lineMode, direction);
  const maxStartIdx = Math.max(0, route.stations.length - 2);
  const startStationIndex = Math.max(
    0,
    Math.min(maxStartIdx, Math.floor(options.startStationIndex ?? 0))
  );
  const startStation = route.stations[startStationIndex];
  const nextStationIdx = startStationIndex + 1;

  const rushHourPeriod: RushHourPeriod = 'normal';
  const passengers: Record<number, PassengerActor[]> = {};
  for (let i = 0; i < route.stations.length; i++) {
    passengers[i] = createStationPassengers(i, route.stations[i], lineMode, rushHourPeriod);
  }

  const completedStations: number[] = [];
  for (let i = 0; i <= startStationIndex; i++) {
    completedStations.push(i);
  }

  return {
    phase: startPhase,
    lineMode,
    direction,
    startStationIndex,
    trainX: startStation.stopX,
    speedMs: 0,
    accelMs2: 0,
    prevAccelMs2: 0,
    lever: 0,
    emergencyBrake: false,
    nextStationIndex: nextStationIdx,
    completedStations,
    doorState: 'closed',
    doorOpenProgress: 0,
    doorTimer: 0,
    boardingProgress: 0,
    boardingComplete: false,
    excessDwellSec: 0,
    currentRequiredBoardingSec: getEffectiveRequiredBoardingSec(
      route.stations[nextStationIdx],
      lineMode,
      rushHourPeriod
    ),
    servedCurrentStation: false,
    arrivalChimePlayedForIndex: startStationIndex,
    rushHourPeriod,
    rushHourCycleTimerSec: RUSH_HOUR_CYCLE_INTERVAL_SEC,
    score: 0,
    comfort: 92,
    passengerMood: 'happy',
    moodReason: 'Smooth ride',
    comfortSum: 92,
    comfortSamples: 1,
    elapsedTimeSec: 0,
    legElapsedSec: 0,
    scheduleDeltaSec: 0,
    speedLimitKmh: getSpeedLimitAtForRoute(startStation.stopX, lineMode, direction),
    isOverspeeding: false,
    overspeedTimeSec: 0,
    overspeedPenaltyAccumulator: 0,
    emergencyBrakeCount: 0,
    overshootCount: 0,
    eco: createInitialEcoState(),
    weather: 'clear',
    weatherIntensity: 0,
    weatherCycleTimerSec: WEATHER_CYCLE_INTERVAL_SEC,
    trackFrictionMultiplier: CLEAR_TRACK_FRICTION_MULTIPLIER,
    brakingGripMultiplier: CLEAR_TRACK_FRICTION_MULTIPLIER,
    triggeredSpeedCameraIds: [],
    speedCameraFlashSec: 0,
    lastSpeedCameraTicket: null,
    speedCameraTickets: [],
    upcomingSpeedCamera: null,
    stopRecords: [],
    feedback: null,
    feedbackCounter: 0,
    passengers,
    events: emptyEvents(),
  };
}

export function emptyEvents(): SimulationEvents {
  return {
    arrivalChime: false,
    doorOpening: false,
    doorClosingBuzzer: false,
    doorClosingSlide: false,
    stationScored: false,
    overshootWarning: false,
    emergencyTriggered: false,
    speedCameraFlashed: null,
    lineCompleted: false,
    weatherChanged: null,
  };
}

export function setRushHourPeriod(
  state: SimulationState,
  nextPeriod: RushHourPeriod,
  notify = true
): void {
  if (state.rushHourPeriod === nextPeriod) return;
  state.rushHourPeriod = nextPeriod;
  state.rushHourCycleTimerSec = RUSH_HOUR_CYCLE_INTERVAL_SEC;

  const route = getDirectedRoute(state.lineMode, state.direction);
  // Refresh waiting passenger counts for unserved upcoming stations
  for (let i = state.nextStationIndex; i < route.stations.length; i++) {
    if (i === state.nextStationIndex && state.servedCurrentStation) continue;
    state.passengers[i] = createStationPassengers(i, route.stations[i], state.lineMode, nextPeriod);
  }
  state.currentRequiredBoardingSec = getEffectiveRequiredBoardingSec(
    route.stations[state.nextStationIndex],
    state.lineMode,
    nextPeriod
  );

  if (notify && state.phase === 'playing') {
    const tol = getAlignmentTolerances(state.lineMode, nextPeriod);
    if (nextPeriod === 'rush_hour') {
      pushFeedback(
        state,
        'Passenger Density: RUSH HOUR',
        `Heavy platform crowds (+65% boarding wait) · Strict ±${tol.maxAllowedAlignM}m door alignment`,
        0,
        'warning'
      );
    } else if (nextPeriod === 'off_peak') {
      pushFeedback(
        state,
        'Passenger Density: Off-Peak',
        `Lighter platforms (−28% dwell time) · ±${tol.maxAllowedAlignM}m door alignment`,
        0,
        'success'
      );
    } else {
      pushFeedback(
        state,
        'Passenger Density: Standard Service',
        `Normal platform flow · ±${tol.maxAllowedAlignM}m door alignment window`,
        0,
        'info'
      );
    }
  }
}

export function cycleRushHourPeriod(state: SimulationState): RushHourPeriod {
  const idx = RUSH_HOUR_SEQUENCE.indexOf(state.rushHourPeriod);
  const next = RUSH_HOUR_SEQUENCE[(idx + 1) % RUSH_HOUR_SEQUENCE.length];
  setRushHourPeriod(state, next, true);
  return next;
}

export function setWeather(state: SimulationState, nextWeather: WeatherType, notify = true): void {
  if (state.weather === nextWeather) return;
  state.weather = nextWeather;
  state.weatherCycleTimerSec = WEATHER_CYCLE_INTERVAL_SEC;
  const grip = getWeatherGrip(nextWeather);
  state.trackFrictionMultiplier = grip.friction;
  state.brakingGripMultiplier = grip.braking;
  state.events.weatherChanged = nextWeather;

  if (notify && state.phase === 'playing') {
    if (nextWeather === 'rain') {
      pushFeedback(
        state,
        'Weather: Heavy Tunnel Rain',
        'Wet guideway — track friction 0.82× (longer braking & gentler traction)',
        0,
        'warning'
      );
    } else if (nextWeather === 'fog') {
      pushFeedback(
        state,
        'Weather: Dense Mist & Condensation',
        'Damp rails — track friction 0.94× & reduced forward visibility',
        0,
        'info'
      );
    } else {
      pushFeedback(
        state,
        'Weather: Clear Conditions',
        'Dry concrete & steel — full 1.00× track friction restored',
        0,
        'success'
      );
    }
  }
}

export function cycleWeather(state: SimulationState): WeatherType {
  const idx = WEATHER_SEQUENCE.indexOf(state.weather);
  const next = WEATHER_SEQUENCE[(idx + 1) % WEATHER_SEQUENCE.length];
  setWeather(state, next, true);
  return next;
}

export function isTrainStopped(state: SimulationState): boolean {
  const phys = getLineDefinition(state.lineMode).physics;
  return state.speedMs <= phys.stopThresholdMs;
}

/**
 * Signed offset in meters: negative = before stop mark (undershot), positive = past stop mark (overshot).
 */
export function getAlignmentOffsetM(state: SimulationState): number {
  const stations = getDirectedRoute(state.lineMode, state.direction).stations;
  const targetStation = stations[state.nextStationIndex];
  return state.trainX - targetStation.stopX;
}

export function isWithinAlignmentZone(state: SimulationState): boolean {
  const offset = Math.abs(getAlignmentOffsetM(state));
  const { maxAllowedAlignM } = getAlignmentTolerances(state.lineMode, state.rushHourPeriod);
  return offset <= maxAllowedAlignM;
}

export function canOpenDoors(state: SimulationState): boolean {
  return (
    state.phase === 'playing' &&
    isTrainStopped(state) &&
    state.doorState === 'closed' &&
    !state.servedCurrentStation &&
    isWithinAlignmentZone(state)
  );
}

export function canCloseDoors(state: SimulationState): boolean {
  return (
    state.phase === 'playing' &&
    (state.doorState === 'open' || state.doorState === 'opening') &&
    state.boardingComplete
  );
}

export function classifyAlignment(
  absOffsetM: number,
  tolerances: { perfectAlignM: number; goodAlignM: number; maxAllowedAlignM: number } = {
    perfectAlignM: 1.5,
    goodAlignM: 3.8,
    maxAllowedAlignM: 7.5,
  }
): StopQuality {
  if (absOffsetM <= tolerances.perfectAlignM) return 'perfect';
  if (absOffsetM <= tolerances.goodAlignM) return 'good';
  if (absOffsetM <= tolerances.maxAllowedAlignM) return 'fair';
  return 'overshot';
}

export function calculateStationScore(
  absOffsetM: number,
  legDeltaSec: number,
  comfort: number,
  tolerances?: { perfectAlignM: number; goodAlignM: number; maxAllowedAlignM: number }
): { quality: StopQuality; points: number; alignmentBonus: number; punctualityBonus: number; comfortBonus: number } {
  const quality = classifyAlignment(absOffsetM, tolerances);
  let alignmentBonus = 0;
  if (quality === 'perfect') {
    alignmentBonus = 500;
  } else if (quality === 'good') {
    alignmentBonus = 320;
  } else if (quality === 'fair') {
    alignmentBonus = 160;
  } else {
    alignmentBonus = -150;
  }

  // Timetable precision: retain a demanding target without making a longer leg
  // disproportionately harder to score than a short metro hop.
  const absTimeErr = Math.abs(legDeltaSec);
  let punctualityBonus = 0;
  if (absTimeErr <= 8) {
    punctualityBonus = 250;
  } else if (absTimeErr <= 20) {
    punctualityBonus = Math.round(250 - (absTimeErr - 8) * 14);
  } else {
    punctualityBonus = Math.max(0, Math.round(82 - (absTimeErr - 20) * 4));
  }

  // Comfort & Mood bonus (0..150)
  const comfortBonus = Math.round((Math.max(0, Math.min(100, comfort)) / 100) * 150);

  return {
    quality,
    points: alignmentBonus + punctualityBonus + comfortBonus,
    alignmentBonus,
    punctualityBonus,
    comfortBonus,
  };
}

/**
 * Calculates passenger mood bonus/penalty applied to the final score at terminus.
 */
export function calculateMoodFinalBonus(averageComfort: number): { mood: PassengerMood; bonus: number } {
  const mood = derivePassengerMood(averageComfort);
  if (mood === 'happy') {
    const bonus = Math.round(350 + ((Math.min(100, averageComfort) - 75) / 25) * 250);
    return { mood, bonus };
  }
  if (mood === 'neutral') {
    const bonus = Math.round(((averageComfort - 45) / 30) * 200);
    return { mood, bonus };
  }
  const bonus = -Math.round(150 + ((45 - Math.max(0, averageComfort)) / 45) * 150);
  return { mood, bonus };
}

export function computeFinalGrade(state: SimulationState): FinalGradeSummary {
  const line = getLineDefinition(state.lineMode);
  const route = getDirectedRoute(state.lineMode, state.direction);
  const records = state.stopRecords;
  const totalStops = records.length || 1;
  const avgAlign =
    records.reduce((acc, r) => acc + Math.abs(r.alignmentErrorM), 0) / totalStops;
  const perfectStops = records.filter((r) => r.quality === 'perfect').length;

  const avgComfort =
    state.comfortSamples > 0
      ? state.comfortSum / state.comfortSamples
      : state.comfort;

  const { mood: finalMood, bonus: moodBonus } = calculateMoodFinalBonus(avgComfort);
  const ecoSnap = buildEcoSnapshot(state.eco);
  const ecoBonus = Math.round((ecoSnap.efficiencyPct - 50) * 6);
  const baseScore = Math.round(state.score);
  const totalScore = Math.max(0, baseScore + moodBonus + ecoBonus);

  const fullStopCount = Math.max(1, route.stations.length - 1);
  const activeStopCount = Math.max(1, fullStopCount - state.startStationIndex);

  const sThreshold = Math.round(740 * activeStopCount + 200);
  const aThreshold = Math.round(560 * activeStopCount + 100);
  const bThreshold = Math.round(380 * activeStopCount);

  let grade: 'S' | 'A' | 'B' | 'C' = 'C';
  let title = 'Apprentice Conductor';

  if (
    totalScore >= sThreshold &&
    finalMood === 'happy' &&
    state.overshootCount === 0 &&
    state.overspeedTimeSec < 4
  ) {
    grade = 'S';
    title = line.masterTitle;
  } else if (totalScore >= aThreshold && avgComfort >= 65) {
    grade = 'A';
    title = line.seniorTitle;
  } else if (totalScore >= bThreshold) {
    grade = 'B';
    title = 'Certified Operator';
  }

  return {
    lineMode: state.lineMode,
    direction: state.direction,
    terminusName: route.terminusShortName,
    grade,
    title,
    baseScore,
    moodBonus,
    ecoBonus,
    totalScore,
    finalMood,
    ecoEfficiencyPct: ecoSnap.efficiencyPct,
    ecoGrade: ecoSnap.ecoGrade,
    netEnergyKwh: ecoSnap.netEnergyKwh,
    coastingSharePct: ecoSnap.coastingSharePct,
    averageAlignmentM: Number(avgAlign.toFixed(2)),
    perfectStops,
    totalStops: records.length,
    finalScheduleDeltaSec: Math.round(state.scheduleDeltaSec),
    averageComfort: Math.round(avgComfort),
    overspeedSeconds: Number(state.overspeedTimeSec.toFixed(1)),
    emergencyBrakes: state.emergencyBrakeCount,
    speedCameraInfractions: state.speedCameraTickets.length,
  };
}

export function setLever(state: SimulationState, value: number): void {
  const clamped = Math.max(-1, Math.min(1, value));
  const wasEmergency = state.emergencyBrake;
  state.lever = clamped;
  state.emergencyBrake = clamped <= -0.92;
  if (state.emergencyBrake && !wasEmergency && state.speedMs > 1.5) {
    state.emergencyBrakeCount += 1;
    state.comfort = Math.max(0, state.comfort - 20);
    state.passengerMood = derivePassengerMood(state.comfort);
    state.moodReason = 'Emergency stop!';
    state.score = Math.max(0, state.score - 80);
    state.events.emergencyTriggered = true;
    pushFeedback(state, 'Emergency Brake Engaged', 'Passengers jolted (-80 pts)', -80, 'danger');
  }
}

export function triggerEmergencyBrake(state: SimulationState): void {
  setLever(state, -1);
}

export function pushFeedback(
  state: SimulationState,
  title: string,
  detail: string,
  pointsDelta: number,
  tone: FeedbackBanner['tone']
): void {
  state.feedbackCounter += 1;
  state.feedback = {
    id: state.feedbackCounter,
    title,
    detail,
    pointsDelta,
    tone,
    remainingSec: 5.2,
  };
}

export function requestOpenDoors(state: SimulationState): boolean {
  if (!canOpenDoors(state)) {
    return false;
  }

  const line = getLineDefinition(state.lineMode);
  const route = getDirectedRoute(state.lineMode, state.direction);
  const stationIdx = state.nextStationIndex;
  const station = route.stations[stationIdx];
  const rushMult = getRushHourMultiplier(state.rushHourPeriod);

  state.doorState = 'opening';
  state.doorTimer = 0;
  state.boardingProgress = 0;
  state.boardingComplete = false;
  state.excessDwellSec = 0;
  state.currentRequiredBoardingSec = getEffectiveRequiredBoardingSec(
    station,
    state.lineMode,
    state.rushHourPeriod
  );
  state.servedCurrentStation = true;
  state.events.doorOpening = true;

  // Spawn alighting passengers inside the doors + assign waiting passengers to walk toward doors
  const actors = state.passengers[stationIdx] ?? [];

  for (const p of actors) {
    if (p.role === 'waiting') {
      p.role = 'boarding';
    }
  }

  const rand = mulberry32(9900 + stationIdx * 53);
  const alightCount = Math.min(10, Math.round(4 * station.crowdDensity * rushMult));
  const doorOffsets = line.doorOffsetsM;
  for (let i = 0; i < alightCount; i++) {
    const doorOffset = doorOffsets[i % doorOffsets.length];
    const doorX = state.trainX + doorOffset;
    actors.push({
      id: 50000 + stationIdx * 100 + i,
      x: doorX + (rand() - 0.5) * 0.6,
      depth: 0.92,
      role: 'alighting',
      targetDoorX: doorX + (rand() > 0.5 ? 1 : -1) * (4.5 + rand() * 5),
      walkSpeed: 1.5 + rand() * 0.8,
      coatColor: COAT_PALETTE[Math.floor(rand() * COAT_PALETTE.length)],
      pantsColor: PANTS_PALETTE[Math.floor(rand() * PANTS_PALETTE.length)],
      heightScale: 0.92 + rand() * 0.16,
      hasBag: rand() > 0.5,
      walkPhase: rand() * Math.PI * 2,
      opacity: 0.1,
    });
  }
  state.passengers[stationIdx] = actors;

  // Score the stop right when doors open cleanly using current Rush Hour alignment tolerances!
  const tolerances = getAlignmentTolerances(state.lineMode, state.rushHourPeriod);
  const offsetM = getAlignmentOffsetM(state);
  const absOffset = Math.abs(offsetM);
  const legDelta = state.legElapsedSec - station.legScheduleSeconds;
  state.scheduleDeltaSec += legDelta;

  const result = calculateStationScore(absOffset, legDelta, state.comfort, tolerances);
  state.score = Math.max(0, state.score + result.points);
  state.events.stationScored = true;

  state.stopRecords.push({
    stationId: station.id,
    stationName: station.name,
    alignmentErrorM: Number(offsetM.toFixed(2)),
    quality: result.quality,
    scheduleDeltaSec: Math.round(legDelta),
    pointsAwarded: result.points,
    comfortAtStop: Math.round(state.comfort),
    moodAtStop: derivePassengerMood(state.comfort),
  });

  const qualityLabel =
    result.quality === 'perfect'
      ? 'Perfect Alignment'
      : result.quality === 'good'
        ? 'Good Alignment'
        : 'Acceptable Stop';

  const deltaText =
    Math.abs(Math.round(legDelta)) <= 3
      ? 'On Time'
      : legDelta < 0
        ? `${Math.abs(Math.round(legDelta))}s Early`
        : `+${Math.round(legDelta)}s Delayed`;

  pushFeedback(
    state,
    `${station.name} — ${qualityLabel}`,
    `Offset ${absOffset.toFixed(1)}m · ${deltaText} · +${result.points} pts`,
    result.points,
    result.quality === 'perfect' ? 'success' : 'info'
  );

  return true;
}

export function requestCloseDoors(state: SimulationState): boolean {
  if (!canCloseDoors(state)) {
    return false;
  }
  state.doorState = 'closing_warning';
  state.doorTimer = 0;
  state.events.doorClosingBuzzer = true;
  return true;
}

export function toggleDoors(state: SimulationState): boolean {
  if (canOpenDoors(state)) {
    return requestOpenDoors(state);
  }
  if (canCloseDoors(state)) {
    return requestCloseDoors(state);
  }
  return false;
}

function advanceToNextStation(state: SimulationState): void {
  const stations = getDirectedRoute(state.lineMode, state.direction).stations;
  const completedIdx = state.nextStationIndex;
  if (!state.completedStations.includes(completedIdx)) {
    state.completedStations = [...state.completedStations, completedIdx];
  }

  if (completedIdx >= stations.length - 1) {
    state.phase = 'gameover';
    state.events.lineCompleted = true;
    return;
  }

  state.nextStationIndex = completedIdx + 1;
  state.servedCurrentStation = false;
  state.boardingProgress = 0;
  state.boardingComplete = false;
  state.excessDwellSec = 0;
  state.currentRequiredBoardingSec = getEffectiveRequiredBoardingSec(
    stations[state.nextStationIndex],
    state.lineMode,
    state.rushHourPeriod
  );
  state.legElapsedSec = 0;
  state.comfort = Math.min(100, state.comfort + 6);
  state.passengerMood = derivePassengerMood(state.comfort);
  state.moodReason = 'Fresh departure';
}

/**
 * Advances the simulation by `rawDt` seconds (clamped to <= 0.05s for stability).
 */
export function stepSimulation(state: SimulationState, rawDt: number): void {
  state.events = emptyEvents();

  if (state.phase !== 'playing') {
    return;
  }

  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return;

  state.elapsedTimeSec += dt;
  state.legElapsedSec += dt;

  // Decay floating feedback banner
  if (state.feedback) {
    state.feedback.remainingSec -= dt;
    if (state.feedback.remainingSec <= 0) {
      state.feedback = null;
    }
  }

  const line = getLineDefinition(state.lineMode);
  const phys = line.physics;
  const stations = getDirectedRoute(state.lineMode, state.direction).stations;

  // --- 0. Dynamic Weather Cycle, Rush Hour Cycle, Track Friction & Speed Camera Flash ---
  state.weatherCycleTimerSec -= dt;
  if (state.weatherCycleTimerSec <= 0) {
    cycleWeather(state);
  }
  state.rushHourCycleTimerSec -= dt;
  if (state.rushHourCycleTimerSec <= 0) {
    cycleRushHourPeriod(state);
  }

  const targetIntensity = state.weather === 'clear' ? 0 : 1;
  state.weatherIntensity += (targetIntensity - state.weatherIntensity) * Math.min(1, dt * 1.4);
  const grip = getWeatherGrip(state.weather);
  state.trackFrictionMultiplier = grip.friction;
  state.brakingGripMultiplier = grip.braking;

  if (state.speedCameraFlashSec > 0) {
    state.speedCameraFlashSec = Math.max(0, state.speedCameraFlashSec - dt);
  }

  // --- 1. Door State Machine & Passenger Boarding / Dwell Time ---
  const targetStation = stations[state.nextStationIndex];
  const isDoorsBlockingTraction = state.doorState !== 'closed';
  let dwellComfortDrain = false;

  if (state.doorState === 'opening') {
    state.doorTimer += dt;
    state.doorOpenProgress = Math.min(1, state.doorTimer / phys.doorOpenDuration);
    if (state.doorOpenProgress >= 1) {
      state.doorState = 'open';
      state.doorTimer = 0;
    }
  } else if (state.doorState === 'open') {
    const requiredBoardingSec = getEffectiveRequiredBoardingSec(
      targetStation,
      state.lineMode,
      state.rushHourPeriod
    );
    state.currentRequiredBoardingSec = requiredBoardingSec;
    if (!state.boardingComplete) {
      state.boardingProgress = Math.min(1, state.boardingProgress + dt / requiredBoardingSec);
      if (state.boardingProgress >= 1) {
        state.boardingComplete = true;
      }
    } else {
      state.excessDwellSec += dt;
      if (state.excessDwellSec > 8) {
        dwellComfortDrain = true;
        state.comfort = Math.max(0, state.comfort - 4.2 * dt);
        state.moodReason = 'Long dwell time';
      } else {
        state.moodReason = 'Ready to depart';
      }
    }
  } else if (state.doorState === 'closing_warning') {
    state.doorTimer += dt;
    if (state.doorTimer >= phys.doorWarningDuration) {
      state.doorState = 'closing';
      state.doorTimer = 0;
      state.events.doorClosingSlide = true;
    }
  } else if (state.doorState === 'closing') {
    state.doorTimer += dt;
    state.doorOpenProgress = Math.max(0, 1 - state.doorTimer / phys.doorCloseDuration);
    if (state.doorOpenProgress <= 0) {
      state.doorState = 'closed';
      state.doorOpenProgress = 0;
      state.doorTimer = 0;
      advanceToNextStation(state);
    }
  }

  updatePassengers(state, dt);

  if (state.phase !== 'playing') {
    return;
  }

  // --- 2. Train Physics (MP14 Rubber-Tire vs MI09 Heavy Steel-Wheel Express) ---
  let netAccel = 0;
  const prevTrainX = state.trainX;

  if (isDoorsBlockingTraction) {
    state.speedMs = 0;
    netAccel = 0;
  } else {
    const speedRatio = state.speedMs / phys.maxSpeedMs;
    const drag = phys.rollingDrag + phys.aeroDrag * state.speedMs * state.speedMs;

    if (state.emergencyBrake || state.lever <= -0.92) {
      const effectiveEmergency = phys.emergencyBrakeMs2 * grip.braking;
      netAccel = state.speedMs > 0 ? -(effectiveEmergency + drag) : 0;
    } else if (state.lever > 0.02) {
      const torqueFactor = Math.max(0.18, 1 - speedRatio * 0.65);
      const traction = state.lever * phys.maxAccelMs2 * torqueFactor * grip.traction;
      netAccel = traction - (state.speedMs > 0.01 ? drag : 0);
    } else if (state.lever < -0.02) {
      const brakeIntensity = Math.min(1, Math.abs(state.lever) / 0.92);
      const brakeDecel = brakeIntensity * phys.maxServiceBrakeMs2 * grip.braking;
      netAccel = state.speedMs > 0 ? -(brakeDecel + drag) : 0;
    } else {
      netAccel = state.speedMs > 0 ? -drag : 0;
    }

    const nextSpeed = state.speedMs + netAccel * dt;
    if (nextSpeed <= 0) {
      state.speedMs = 0;
      netAccel = 0;
    } else if (nextSpeed >= phys.maxSpeedMs) {
      state.speedMs = phys.maxSpeedMs;
      netAccel = 0;
    } else {
      state.speedMs = nextSpeed;
    }

    state.trainX += state.speedMs * dt;
  }

  // --- 2B. Eco-Driving Energy Consumption & Regen Tracking ---
  stepEcoEnergy(state.eco, {
    dt,
    speedMs: state.speedMs,
    lever: state.lever,
    emergencyBrake: state.emergencyBrake,
    doorsOpen: isDoorsBlockingTraction,
    lineMode: state.lineMode,
  });

  // --- 3. Passenger Comfort & Mood (Acceleration, Braking, Jerk & Dwell) ---
  state.prevAccelMs2 = state.accelMs2;
  state.accelMs2 = netAccel;

  if (!dwellComfortDrain) {
    if (state.speedMs > 0.4) {
      const jerk = Math.abs(state.accelMs2 - state.prevAccelMs2) / dt;
      if (state.accelMs2 < -1.25) {
        const harshness = Math.abs(state.accelMs2) - 1.25;
        state.comfort = Math.max(0, state.comfort - harshness * 11.0 * dt);
        state.moodReason = 'Harsh braking';
      } else if (state.accelMs2 > 1.18) {
        const surge = state.accelMs2 - 1.18;
        state.comfort = Math.max(0, state.comfort - surge * 6.5 * dt);
        state.moodReason = 'Abrupt acceleration';
      } else if (jerk > 3.0) {
        state.comfort = Math.max(0, state.comfort - (jerk - 3.0) * 1.1 * dt);
        state.moodReason = 'Jerky control';
      } else {
        state.comfort = Math.min(100, state.comfort + 2.2 * dt);
        state.moodReason = 'Smooth ride';
      }
    } else if (
      state.doorState === 'closed' &&
      state.legElapsedSec > 10 &&
      state.trainX > stations[state.startStationIndex].stopX + 20
    ) {
      state.comfort = Math.max(0, state.comfort - 2.4 * dt);
      state.moodReason = 'Unscheduled halt';
    } else if (state.doorState === 'open' && !state.boardingComplete) {
      state.moodReason = 'Boarding passengers';
    }
  }

  state.passengerMood = derivePassengerMood(state.comfort);
  state.comfortSum += state.comfort * dt;
  state.comfortSamples += dt;

  // --- 4. Speed Limit & Overspeed Monitoring ---
  const currentLimit = getSpeedLimitAtForRoute(state.trainX, state.lineMode, state.direction);
  state.speedLimitKmh = currentLimit;
  const speedKmh = state.speedMs * 3.6;

  if (speedKmh > currentLimit + 2) {
    state.isOverspeeding = true;
    state.overspeedTimeSec += dt;
    state.overspeedPenaltyAccumulator += dt;
    state.comfort = Math.max(0, state.comfort - 2.5 * dt);
    state.passengerMood = derivePassengerMood(state.comfort);
    state.moodReason = 'Excessive speed';
    if (state.overspeedPenaltyAccumulator >= 0.5) {
      state.overspeedPenaltyAccumulator -= 0.5;
      state.score = Math.max(0, state.score - 8);
    }
  } else {
    state.isOverspeeding = false;
    state.overspeedPenaltyAccumulator = 0;
  }

  // --- 4B. Automated Tunnel Speed Camera Logic Component ---
  const camEval = evaluateSpeedCameras({
    prevTrainX,
    trainX: state.trainX,
    speedKmh,
    elapsedTimeSec: state.elapsedTimeSec,
    triggeredIds: state.triggeredSpeedCameraIds,
    lineMode: state.lineMode,
    direction: state.direction,
  });
  state.upcomingSpeedCamera = camEval.upcomingCamera;

  if (camEval.triggeredTicket) {
    const ticket = camEval.triggeredTicket;
    state.triggeredSpeedCameraIds = [...state.triggeredSpeedCameraIds, ticket.cameraId];
    state.speedCameraTickets = [...state.speedCameraTickets, ticket];
    state.lastSpeedCameraTicket = ticket;
    state.speedCameraFlashSec = SPEED_CAMERA_FLASH_DURATION_SEC;
    state.score = Math.max(0, state.score - ticket.penaltyPoints);
    state.comfort = Math.max(0, state.comfort - 7);
    state.passengerMood = derivePassengerMood(state.comfort);
    state.moodReason = 'Speed camera infraction';
    state.events.speedCameraFlashed = ticket;
    pushFeedback(
      state,
      `RADAR FLASH · ${ticket.cameraName}`,
      `Captured at ${ticket.measuredKmh} km/h in ${ticket.limitKmh} km/h zone (−${ticket.penaltyPoints} pts)`,
      -ticket.penaltyPoints,
      'danger'
    );
  }

  // --- 5. Station Arrival Chime & Overshoot Recovery ---
  const currentTarget = stations[state.nextStationIndex];
  const distToStop = currentTarget.stopX - state.trainX;

  if (
    distToStop <= 65 &&
    distToStop > 0 &&
    state.arrivalChimePlayedForIndex !== state.nextStationIndex
  ) {
    state.arrivalChimePlayedForIndex = state.nextStationIndex;
    state.events.arrivalChime = true;
  }

  const tolerances = getAlignmentTolerances(state.lineMode, state.rushHourPeriod);
  if (distToStop < -tolerances.maxAllowedAlignM && !state.servedCurrentStation) {
    const isTerminus = state.nextStationIndex === stations.length - 1;
    if (isTerminus) {
      state.trainX = currentTarget.stopX + tolerances.maxAllowedAlignM;
      state.speedMs = 0;
      state.lever = -0.8;
      state.events.overshootWarning = true;
      pushFeedback(
        state,
        'Terminus Buffer Stop',
        `Stopped at ${currentTarget.shortName} end-of-line — open doors to complete service`,
        -100,
        'danger'
      );
      state.score = Math.max(0, state.score - 100);
      state.overshootCount += 1;
    } else if (distToStop < -22) {
      const legDelta = state.legElapsedSec - currentTarget.legScheduleSeconds;
      state.scheduleDeltaSec += legDelta;
      state.overshootCount += 1;
      state.score = Math.max(0, state.score - 250);
      state.comfort = Math.max(0, state.comfort - 15);
      state.passengerMood = derivePassengerMood(state.comfort);
      state.moodReason = 'Missed station!';
      state.events.overshootWarning = true;

      state.stopRecords.push({
        stationId: currentTarget.id,
        stationName: currentTarget.name,
        alignmentErrorM: Number((-distToStop).toFixed(1)),
        quality: 'overshot',
        scheduleDeltaSec: Math.round(legDelta),
        pointsAwarded: -250,
        comfortAtStop: Math.round(state.comfort),
        moodAtStop: state.passengerMood,
      });

      pushFeedback(
        state,
        `Overshot ${currentTarget.name}!`,
        'Missed platform alignment (-250 pts) — proceeding to next station',
        -250,
        'danger'
      );

      advanceToNextStation(state);
    }
  }
}

function updatePassengers(state: SimulationState, dt: number): void {
  const activeIdx = state.nextStationIndex;
  const actors = state.passengers[activeIdx];
  if (!actors) return;

  const doorsAccessible = state.doorOpenProgress > 0.35;

  for (const p of actors) {
    if (p.role === 'waiting') {
      p.walkPhase += dt * 1.1;
    } else if (p.role === 'boarding' && doorsAccessible) {
      const dx = p.targetDoorX - p.x;
      if (Math.abs(dx) > 0.25) {
        p.x += Math.sign(dx) * Math.min(Math.abs(dx), p.walkSpeed * dt);
        p.walkPhase += dt * 7.5;
      } else {
        p.depth = Math.min(1, p.depth + dt * 0.9);
        p.opacity = Math.max(0, 1 - (p.depth - 0.35) / 0.6);
        p.walkPhase += dt * 6;
        if (p.depth >= 0.95) {
          p.role = 'departed';
          p.opacity = 0;
        }
      }
    } else if (p.role === 'alighting' && doorsAccessible) {
      if (p.depth > 0.18) {
        p.depth = Math.max(0.18, p.depth - dt * 0.85);
        p.opacity = Math.min(1, p.opacity + dt * 2.2);
        p.walkPhase += dt * 6;
      } else {
        const dx = p.targetDoorX - p.x;
        if (Math.abs(dx) > 0.25) {
          p.x += Math.sign(dx) * Math.min(Math.abs(dx), p.walkSpeed * dt);
          p.walkPhase += dt * 7;
        } else {
          p.opacity = Math.max(0, p.opacity - dt * 1.2);
          if (p.opacity <= 0.02) {
            p.role = 'departed';
          }
        }
      }
    }
  }
}

export function buildHudSnapshot(state: SimulationState): HudSnapshot {
  const line = getLineDefinition(state.lineMode);
  const route = getDirectedRoute(state.lineMode, state.direction);
  const nextStation = route.stations[state.nextStationIndex];
  const distanceToNextM = nextStation.stopX - state.trainX;
  const speedKmh = state.speedMs * 3.6;
  const inStationZone = Math.abs(distanceToNextM) <= (state.lineMode === 'rerA' ? 110 : 85);
  const alignmentOffsetM = inStationZone ? -distanceToNextM : null;
  const tolerances = getAlignmentTolerances(state.lineMode, state.rushHourPeriod);

  let nextStationDueTimeSec = 0;
  for (let i = state.startStationIndex + 1; i <= state.nextStationIndex; i++) {
    nextStationDueTimeSec += route.stations[i].legScheduleSeconds;
  }

  let signalAspect: 'green' | 'amber' | 'red' = 'green';
  if (state.doorState !== 'closed' || state.emergencyBrake || state.isOverspeeding) {
    signalAspect = 'red';
  } else if (distanceToNextM < (state.lineMode === 'rerA' ? 220 : 140) || state.speedLimitKmh <= 50) {
    signalAspect = 'amber';
  }

  return {
    phase: state.phase,
    lineMode: state.lineMode,
    direction: state.direction,
    startStationIndex: state.startStationIndex,
    trainX: state.trainX,
    speedKmh,
    maxSpeedDisplayKmh: line.physics.maxSpeedKmhDisplay,
    speedLimitKmh: state.speedLimitKmh,
    nextSpeedChange: getNextSpeedLimitChangeForRoute(
      state.trainX,
      state.lineMode,
      state.direction
    ),
    isOverspeeding: state.isOverspeeding,
    lever: state.lever,
    emergencyBrake: state.emergencyBrake,
    score: Math.round(state.score),
    comfort: Math.round(state.comfort),
    passengerMood: state.passengerMood,
    moodReason: state.moodReason,
    rushHourPeriod: state.rushHourPeriod,
    effectiveCrowdMultiplier: Number(
      (nextStation.crowdDensity * getRushHourMultiplier(state.rushHourPeriod)).toFixed(2)
    ),
    perfectAlignM: tolerances.perfectAlignM,
    maxAllowedAlignM: tolerances.maxAllowedAlignM,
    eco: buildEcoSnapshot(state.eco),
    weather: state.weather,
    weatherIntensity: state.weatherIntensity,
    trackFrictionMultiplier: state.trackFrictionMultiplier,
    brakingGripMultiplier: state.brakingGripMultiplier,
    speedCameraFlashIntensity:
      state.speedCameraFlashSec > 0
        ? Math.min(1, state.speedCameraFlashSec / SPEED_CAMERA_FLASH_DURATION_SEC)
        : 0,
    lastSpeedCameraTicket: state.lastSpeedCameraTicket,
    speedCameraInfractions: state.speedCameraTickets.length,
    upcomingSpeedCamera: state.upcomingSpeedCamera,
    elapsedTimeSec: state.elapsedTimeSec,
    scheduleDeltaSec: Math.round(state.scheduleDeltaSec),
    legRemainingSec: Math.round(nextStation.legScheduleSeconds - state.legElapsedSec),
    nextStationDueTimeSec,
    nextStationIndex: state.nextStationIndex,
    nextStationName: nextStation.name,
    distanceToNextM,
    completedStations: state.completedStations,
    doorState: state.doorState,
    doorOpenProgress: state.doorOpenProgress,
    boardingProgress: state.boardingProgress,
    boardingComplete: state.boardingComplete,
    requiredBoardingSec: Number(state.currentRequiredBoardingSec.toFixed(1)),
    excessDwellSec: state.excessDwellSec,
    canOpenDoors: canOpenDoors(state),
    canCloseDoors: canCloseDoors(state),
    alignmentOffsetM,
    inStationZone,
    signalAspect,
    feedback: state.feedback ? { ...state.feedback } : null,
    stopRecords: state.stopRecords,
    finalGrade: state.phase === 'gameover' ? computeFinalGrade(state) : null,
  };
}
