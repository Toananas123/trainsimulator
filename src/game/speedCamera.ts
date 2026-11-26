import {
  getDirectedRoute,
  getLineDefinition,
  getSpeedLimitAtForLine,
  getSpeedLimitAtForRoute,
  type LineMode,
  type RouteDirection,
} from './lines';

export interface SpeedCameraZone {
  id: string;
  label: string;
  /** World X position (m) where the radar sensor beam captures train speed */
  triggerX: number;
  /** Advance warning sign X position (m) ahead of the camera */
  warningSignX: number;
  /** Enforced speed limit at the camera gate (km/h) */
  limitKmh: number;
  /** Score points deducted when flashed */
  penaltyPoints: number;
  /** Passenger comfort penalty when harshly flashed */
  comfortPenalty: number;
}

export interface SpeedCameraTicket {
  cameraId: string;
  cameraName: string;
  measuredKmh: number;
  limitKmh: number;
  penaltyPoints: number;
  timestampSec: number;
}

export interface UpcomingSpeedCamera {
  id: string;
  label: string;
  distanceM: number;
  limitKmh: number;
}

function buildLineCameras(mode: LineMode): SpeedCameraZone[] {
  const isRer = mode === 'rerA';
  const stations = getLineDefinition(mode).stations;
  const cams: SpeedCameraZone[] = [];

  for (let i = 1; i < stations.length; i++) {
    const prev = stations[i - 1];
    const next = stations[i];
    // Place automated radar gates on roughly every second leg plus major central/airport approaches
    const shouldPlace =
      i % 2 === 1 ||
      next.id === 'la-defense' ||
      next.id === 'chatelet-les-halles' ||
      next.id === 'vincennes' ||
      next.id === 'aeroport-dorly';
    if (!shouldPlace) continue;

    const triggerOffset = isRer ? 210 : 145;
    const warningAdvance = isRer ? 140 : 100;
    const triggerX = Math.max(prev.stopX + 160, next.stopX - triggerOffset);
    const warningSignX = triggerX - warningAdvance;
    const limitKmh = getSpeedLimitAtForLine(triggerX, mode);

    cams.push({
      id: `${isRer ? 'rer' : 'm14'}-cam-${next.id}`,
      label: `${next.shortName} Approach`,
      triggerX,
      warningSignX,
      limitKmh,
      penaltyPoints: isRer ? 140 : 120,
      comfortPenalty: isRer ? 8 : 7,
    });
  }

  return cams;
}

const METRO_14_CAMERAS: SpeedCameraZone[] = buildLineCameras('metro14');
const RER_A_CAMERAS: SpeedCameraZone[] = buildLineCameras('rerA');

function buildReversedCameras(
  cameras: SpeedCameraZone[],
  mode: LineMode
): SpeedCameraZone[] {
  const totalDist = getDirectedRoute(mode, 'forward').totalDistanceM;
  return [...cameras].reverse().map((cam) => {
    const triggerX = totalDist - cam.triggerX;
    const advanceOffset = Math.max(100, cam.triggerX - cam.warningSignX);
    const warningSignX = triggerX - advanceOffset;
    return {
      ...cam,
      id: `${cam.id}-rev`,
      triggerX,
      warningSignX,
      limitKmh: getSpeedLimitAtForRoute(triggerX, mode, 'reverse'),
    };
  });
}

const METRO_14_CAMERAS_REV: SpeedCameraZone[] = buildReversedCameras(METRO_14_CAMERAS, 'metro14');
const RER_A_CAMERAS_REV: SpeedCameraZone[] = buildReversedCameras(RER_A_CAMERAS, 'rerA');

export const SPEED_CAMERAS: SpeedCameraZone[] = METRO_14_CAMERAS;

export function getSpeedCamerasForLine(
  mode: LineMode,
  direction: RouteDirection = 'forward'
): SpeedCameraZone[] {
  if (direction === 'reverse') {
    return mode === 'rerA' ? RER_A_CAMERAS_REV : METRO_14_CAMERAS_REV;
  }
  return mode === 'rerA' ? RER_A_CAMERAS : METRO_14_CAMERAS;
}

/** Tolerance above posted limit (km/h) before radar triggers an automated flash */
export const SPEED_CAMERA_TOLERANCE_KMH = 2;

export interface SpeedCameraEvaluationResult {
  triggeredTicket: SpeedCameraTicket | null;
  upcomingCamera: UpcomingSpeedCamera | null;
}

/**
 * Pure deterministic Speed Camera Logic component:
 * - Detects when the train's nose crosses an active radar gate between prevTrainX and trainX
 * - Triggers an automated overspeed ticket + flash when speedKmh > limitKmh + tolerance
 * - Reports any upcoming radar gate within 210m for HUD & cab anticipation
 */
export function evaluateSpeedCameras(params: {
  prevTrainX: number;
  trainX: number;
  speedKmh: number;
  elapsedTimeSec: number;
  triggeredIds: readonly string[];
  lineMode?: LineMode;
  direction?: RouteDirection;
}): SpeedCameraEvaluationResult {
  const {
    prevTrainX,
    trainX,
    speedKmh,
    elapsedTimeSec,
    triggeredIds,
    lineMode = 'metro14',
    direction = 'forward',
  } = params;

  const cameras = getSpeedCamerasForLine(lineMode, direction);
  let triggeredTicket: SpeedCameraTicket | null = null;
  let upcomingCamera: UpcomingSpeedCamera | null = null;

  for (let i = 0; i < cameras.length; i++) {
    const cam = cameras[i];
    const alreadyTriggered = triggeredIds.includes(cam.id);

    const crossedGate =
      (prevTrainX <= cam.triggerX && trainX >= cam.triggerX) ||
      (trainX >= cam.triggerX - 2 && trainX <= cam.triggerX + 4);

    if (!alreadyTriggered && crossedGate) {
      const effectiveLimit = getSpeedLimitAtForRoute(cam.triggerX, lineMode, direction);
      if (speedKmh > effectiveLimit + SPEED_CAMERA_TOLERANCE_KMH) {
        triggeredTicket = {
          cameraId: cam.id,
          cameraName: cam.label,
          measuredKmh: Math.round(speedKmh),
          limitKmh: effectiveLimit,
          penaltyPoints: cam.penaltyPoints,
          timestampSec: elapsedTimeSec,
        };
      }
    }

    const distM = cam.triggerX - trainX;
    if (distM > 0 && distM <= 210) {
      if (!upcomingCamera || distM < upcomingCamera.distanceM) {
        upcomingCamera = {
          id: cam.id,
          label: cam.label,
          distanceM: distM,
          limitKmh: cam.limitKmh,
        };
      }
    }
  }

  return {
    triggeredTicket,
    upcomingCamera,
  };
}
