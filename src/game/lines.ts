import { STATIONS, type SpeedLimitZone, type StationArchStyle, type StationConfig } from './constants';

export type LineMode = 'metro14' | 'rerA';
export type RouteDirection = 'forward' | 'reverse';
export type { StationArchStyle };

export interface RouteTrackMetadata {
  trackType: 'rubber_tire' | 'steel_ballast';
  /** Meters between track expansion joints / fishplate rail joints */
  jointIntervalM: number;
  /** Bogie axle wheelbase in meters producing the twin wheel-over-joint double click */
  bogieWheelbaseM: number;
  /** Nominal track-click resonant frequency in Hz */
  clickToneHz: number;
  /** Track-click transient decay time in seconds */
  clickDecaySec: number;
  /** Acoustic echo multiplier when running outdoors vs inside underground bore */
  outdoorEchoFactor: number;
}

export interface LinePhysicsConfig {
  maxSpeedMs: number;
  maxSpeedKmhDisplay: number;
  maxAccelMs2: number;
  maxServiceBrakeMs2: number;
  emergencyBrakeMs2: number;
  rollingDrag: number;
  aeroDrag: number;
  stopThresholdMs: number;
  trainLengthM: number;
  perfectAlignM: number;
  goodAlignM: number;
  maxAllowedAlignM: number;
  doorOpenDuration: number;
  doorWarningDuration: number;
  doorCloseDuration: number;
  baseBoardingDuration: number;
}

export interface LineDefinition {
  mode: LineMode;
  badgeText: string;
  systemBadge: string;
  name: string;
  subtitle: string;
  trainModelName: string;
  primaryColor: string;
  accentColor: string;
  hasPlatformScreenDoors: boolean;
  hasOverheadCatenary: boolean;
  trackType: 'rubber_tire' | 'steel_ballast';
  trackMeta: RouteTrackMetadata;
  stations: StationConfig[];
  doorOffsetsM: number[];
  speedLimitZones: SpeedLimitZone[];
  physics: LinePhysicsConfig;
  masterTitle: string;
  seniorTitle: string;
}

/** Full 21-station Line 14 corridor (Saint-Denis Pleyel ↔ Aéroport d'Orly) */
export const METRO_14_STATIONS: StationConfig[] = STATIONS;

/**
 * Full 24-station RER A corridor (Saint-Germain-en-Laye ↔ Boissy-Saint-Léger),
 * featuring all west outdoor suburban stations (Saint-Germain → Nanterre-Université),
 * central underground express halls (Nanterre-Préfecture → Nation), and
 * all east outdoor suburban stations (Vincennes → Boissy-Saint-Léger).
 */
export const RER_A_STATIONS: StationConfig[] = [
  {
    id: 'saint-germain-en-laye',
    name: 'Saint-Germain-en-Laye',
    shortName: 'St-Germain',
    stopX: 0,
    legScheduleSeconds: 0,
    platformLength: 160,
    wallTint: '#E4E7E4',
    vaultTint: '#CFD5CF',
    crowdDensity: 1.15,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'le-vesinet-le-pecq',
    name: 'Le Vésinet – Le Pecq',
    shortName: 'Vésinet–Pecq',
    stopX: 780,
    legScheduleSeconds: 48,
    platformLength: 160,
    wallTint: '#E5E7E2',
    vaultTint: '#D2D6CE',
    crowdDensity: 0.9,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'le-vesinet-centre',
    name: 'Le Vésinet-Centre',
    shortName: 'Vésinet-Ctr',
    stopX: 1500,
    legScheduleSeconds: 46,
    platformLength: 160,
    wallTint: '#E4E7E4',
    vaultTint: '#CFD5CF',
    crowdDensity: 0.85,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'chatou-croissy',
    name: 'Chatou – Croissy',
    shortName: 'Chatou–Croissy',
    stopX: 2260,
    legScheduleSeconds: 47,
    platformLength: 160,
    wallTint: '#E6E4DC',
    vaultTint: '#D4D0C4',
    crowdDensity: 0.95,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'rueil-malmaison',
    name: 'Rueil-Malmaison',
    shortName: 'Rueil-Malm.',
    stopX: 3060,
    legScheduleSeconds: 49,
    platformLength: 160,
    wallTint: '#E3E6E8',
    vaultTint: '#CFD4D8',
    crowdDensity: 1.2,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'nanterre-ville',
    name: 'Nanterre-Ville',
    shortName: 'Nanterre-Ville',
    stopX: 3860,
    legScheduleSeconds: 48,
    platformLength: 160,
    wallTint: '#E5E4DE',
    vaultTint: '#D2D0C8',
    crowdDensity: 1.05,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'nanterre-universite',
    name: 'Nanterre-Université',
    shortName: 'Nanterre-Univ',
    stopX: 4660,
    legScheduleSeconds: 48,
    platformLength: 160,
    wallTint: '#E1E6EC',
    vaultTint: '#CCD4DF',
    crowdDensity: 1.3,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'nanterre-prefecture',
    name: 'Nanterre-Préfecture',
    shortName: 'Nanterre-Préf',
    stopX: 5520,
    legScheduleSeconds: 51,
    platformLength: 160,
    wallTint: '#DFE4EC',
    vaultTint: '#CAD2E0',
    crowdDensity: 1.25,
    archStyle: 'rer_vault',
    isOutdoor: false,
  },
  {
    id: 'la-defense',
    name: 'La Défense (Grande Arche)',
    shortName: 'La Défense',
    stopX: 6460,
    legScheduleSeconds: 54,
    platformLength: 160,
    wallTint: '#DCE4EE',
    vaultTint: '#C8D2E0',
    crowdDensity: 1.5,
    archStyle: 'la_defense',
    isOutdoor: false,
  },
  {
    id: 'etoile',
    name: 'Charles de Gaulle – Étoile',
    shortName: 'CDG–Étoile',
    stopX: 7640,
    legScheduleSeconds: 58,
    platformLength: 160,
    wallTint: '#E2E0D8',
    vaultTint: '#CECBBF',
    crowdDensity: 1.3,
    archStyle: 'rer_vault',
    isOutdoor: false,
  },
  {
    id: 'auber',
    name: 'Auber',
    shortName: 'Auber',
    stopX: 8580,
    legScheduleSeconds: 50,
    platformLength: 160,
    wallTint: '#E4E7EC',
    vaultTint: '#CFD4DE',
    crowdDensity: 1.35,
    archStyle: 'rer_vault',
    isOutdoor: false,
  },
  {
    id: 'chatelet-les-halles',
    name: 'Châtelet – Les Halles',
    shortName: 'Châtelet–H.',
    stopX: 9520,
    legScheduleSeconds: 52,
    platformLength: 160,
    wallTint: '#E5E2DD',
    vaultTint: '#D2CEC7',
    crowdDensity: 1.6,
    archStyle: 'rer_vault',
    isOutdoor: false,
  },
  {
    id: 'rer-gare-de-lyon',
    name: 'Gare de Lyon (RER)',
    shortName: 'Gare de Lyon',
    stopX: 10640,
    legScheduleSeconds: 56,
    platformLength: 160,
    wallTint: '#EAE3D5',
    vaultTint: '#D8CFC0',
    crowdDensity: 1.5,
    archStyle: 'rer_vault',
    isOutdoor: false,
  },
  {
    id: 'nation',
    name: 'Nation',
    shortName: 'Nation',
    stopX: 11740,
    legScheduleSeconds: 55,
    platformLength: 160,
    wallTint: '#E0E5EC',
    vaultTint: '#CCD4DF',
    crowdDensity: 1.35,
    archStyle: 'rer_vault',
    isOutdoor: false,
  },
  {
    id: 'vincennes',
    name: 'Vincennes',
    shortName: 'Vincennes',
    stopX: 12920,
    legScheduleSeconds: 58,
    platformLength: 160,
    wallTint: '#E4E7E4',
    vaultTint: '#CFD5CF',
    crowdDensity: 1.2,
    archStyle: 'vincennes',
    isOutdoor: true,
  },
  {
    id: 'fontenay-sous-bois',
    name: 'Fontenay-sous-Bois',
    shortName: 'Fontenay-Bois',
    stopX: 13740,
    legScheduleSeconds: 49,
    platformLength: 160,
    wallTint: '#E5E7E2',
    vaultTint: '#D2D6CE',
    crowdDensity: 0.95,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'nogent-sur-marne',
    name: 'Nogent-sur-Marne',
    shortName: 'Nogent-Marne',
    stopX: 14560,
    legScheduleSeconds: 49,
    platformLength: 160,
    wallTint: '#E6E4DC',
    vaultTint: '#D4D0C4',
    crowdDensity: 1.0,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'joinville-le-pont',
    name: 'Joinville-le-Pont',
    shortName: 'Joinville-Pont',
    stopX: 15380,
    legScheduleSeconds: 49,
    platformLength: 160,
    wallTint: '#E4E7E6',
    vaultTint: '#CFD6D5',
    crowdDensity: 1.05,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'saint-maur-creteil',
    name: 'Saint-Maur – Créteil',
    shortName: 'St-Maur–Cr.',
    stopX: 16220,
    legScheduleSeconds: 50,
    platformLength: 160,
    wallTint: '#E2E6EA',
    vaultTint: '#CED5DC',
    crowdDensity: 1.15,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'le-parc-de-saint-maur',
    name: 'Le Parc de Saint-Maur',
    shortName: 'Parc St-Maur',
    stopX: 17020,
    legScheduleSeconds: 48,
    platformLength: 160,
    wallTint: '#E5E7E2',
    vaultTint: '#D2D6CE',
    crowdDensity: 0.9,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'champigny',
    name: 'Champigny',
    shortName: 'Champigny',
    stopX: 17840,
    legScheduleSeconds: 49,
    platformLength: 160,
    wallTint: '#E5E4DE',
    vaultTint: '#D2D0C8',
    crowdDensity: 1.0,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'la-varenne-chennevieres',
    name: 'La Varenne – Chennevières',
    shortName: 'La Varenne',
    stopX: 18680,
    legScheduleSeconds: 50,
    platformLength: 160,
    wallTint: '#E4E7E4',
    vaultTint: '#CFD5CF',
    crowdDensity: 0.95,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'sucy-bonneuil',
    name: 'Sucy – Bonneuil',
    shortName: 'Sucy–Bonn.',
    stopX: 19540,
    legScheduleSeconds: 51,
    platformLength: 160,
    wallTint: '#E3E6E8',
    vaultTint: '#CFD4D8',
    crowdDensity: 1.0,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
  {
    id: 'boissy-saint-leger',
    name: 'Boissy-Saint-Léger',
    shortName: 'Boissy-St-L.',
    stopX: 20440,
    legScheduleSeconds: 52,
    platformLength: 160,
    wallTint: '#E4E7E4',
    vaultTint: '#CFD5CF',
    crowdDensity: 1.15,
    archStyle: 'suburban_outdoor',
    isOutdoor: true,
  },
];

/**
 * Determines whether a given world X position along `stations` is open-air outdoors
 * vs inside an underground bored tunnel or underground cavern station.
 */
export function isPositionOutdoor(worldX: number, stations: StationConfig[]): boolean {
  if (stations.length === 0) return false;
  if (worldX <= stations[0].stopX) return Boolean(stations[0].isOutdoor);
  const last = stations[stations.length - 1];
  if (worldX >= last.stopX) return Boolean(last.isOutdoor);

  for (let i = 0; i < stations.length - 1; i++) {
    const cur = stations[i];
    const next = stations[i + 1];
    if (worldX >= cur.stopX && worldX <= next.stopX) {
      const curOut = Boolean(cur.isOutdoor);
      const nextOut = Boolean(next.isOutdoor);
      if (curOut && nextOut) return true;
      if (!curOut && !nextOut) return false;
      // Mixed underground <-> outdoor portal transition cleanly outside station bounds
      if (curOut && !nextOut) {
        return worldX <= cur.stopX + 135;
      }
      return worldX >= next.stopX - 135;
    }
  }
  return false;
}

function buildZonesForStations(stations: StationConfig[], isRer: boolean): SpeedLimitZone[] {
  const zones: SpeedLimitZone[] = [];
  const stationLimit = isRer ? 50 : 40;
  const approachLimit = isRer ? 80 : 60;

  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    const entryLead = isRer ? 90 : 65;
    const exitTrail = isRer ? 45 : 35;

    zones.push({
      startX: station.stopX - entryLead,
      endX: station.stopX + exitTrail,
      limitKmh: stationLimit,
    });

    if (i < stations.length - 1) {
      const next = stations[i + 1];
      const departStart = station.stopX + exitTrail;
      const departEnd = station.stopX + (isRer ? 190 : 125);
      const approachStart = next.stopX - (isRer ? 290 : 185);
      const approachEnd = next.stopX - (isRer ? 90 : 65);

      zones.push({
        startX: departStart,
        endX: Math.min(departEnd, approachStart),
        limitKmh: approachLimit,
      });

      if (approachStart > departEnd) {
        let expressLimit = isRer ? 120 : 80;
        if (isRer) {
          expressLimit = station.id === 'auber' || station.id === 'etoile' ? 100 : 120;
        } else if (station.id === 'madeleine' || station.id === 'bercy') {
          expressLimit = 70;
        }
        zones.push({
          startX: departEnd,
          endX: approachStart,
          limitKmh: expressLimit,
        });
      }

      zones.push({
        startX: approachStart,
        endX: approachEnd,
        limitKmh: approachLimit,
      });
    }
  }

  return zones;
}

export const METRO_14_LINE: LineDefinition = {
  mode: 'metro14',
  badgeText: '14',
  systemBadge: 'M',
  name: 'Line 14',
  subtitle: "ST-DENIS PLEYEL → AÉROPORT D'ORLY",
  trainModelName: 'MP14 Rubber-Tired Metro',
  primaryColor: '#62259D',
  accentColor: '#00AA91',
  hasPlatformScreenDoors: true,
  hasOverheadCatenary: false,
  trackType: 'rubber_tire',
  trackMeta: {
    trackType: 'rubber_tire',
    jointIntervalM: 22,
    bogieWheelbaseM: 2.2,
    clickToneHz: 118,
    clickDecaySec: 0.085,
    outdoorEchoFactor: 0.8,
  },
  stations: METRO_14_STATIONS,
  doorOffsetsM: [-7.5, -17.5, -27.5, -39.5, -49.5, -59.5],
  speedLimitZones: buildZonesForStations(METRO_14_STATIONS, false),
  physics: {
    maxSpeedMs: 90 / 3.6,
    maxSpeedKmhDisplay: 90,
    maxAccelMs2: 1.35,
    maxServiceBrakeMs2: 1.55,
    emergencyBrakeMs2: 2.85,
    rollingDrag: 0.055,
    aeroDrag: 0.00055,
    stopThresholdMs: 0.08,
    trainLengthM: 76,
    perfectAlignM: 1.5,
    goodAlignM: 3.8,
    maxAllowedAlignM: 7.5,
    doorOpenDuration: 1.4,
    doorWarningDuration: 1.6,
    doorCloseDuration: 1.3,
    baseBoardingDuration: 4.5,
  },
  masterTitle: 'Master of Line 14',
  seniorTitle: 'Senior RATP Metro Driver',
};

export const RER_A_LINE: LineDefinition = {
  mode: 'rerA',
  badgeText: 'A',
  systemBadge: 'RER',
  name: 'RER A',
  subtitle: 'ST-GERMAIN → BOISSY-ST-LÉGER',
  trainModelName: 'MI09 Double-Decker Express',
  primaryColor: '#E3051C',
  accentColor: '#009EE0',
  hasPlatformScreenDoors: false,
  hasOverheadCatenary: true,
  trackType: 'steel_ballast',
  trackMeta: {
    trackType: 'steel_ballast',
    jointIntervalM: 18,
    bogieWheelbaseM: 2.5,
    clickToneHz: 275,
    clickDecaySec: 0.068,
    outdoorEchoFactor: 0.72,
  },
  stations: RER_A_STATIONS,
  doorOffsetsM: [-8.5, -19.5, -33.5, -45.5, -60.5, -72.5, -87.5, -99.5],
  speedLimitZones: buildZonesForStations(RER_A_STATIONS, true),
  physics: {
    maxSpeedMs: 120 / 3.6,
    maxSpeedKmhDisplay: 130,
    maxAccelMs2: 0.98,
    maxServiceBrakeMs2: 1.18,
    emergencyBrakeMs2: 2.25,
    rollingDrag: 0.036,
    aeroDrag: 0.00038,
    stopThresholdMs: 0.08,
    trainLengthM: 108,
    perfectAlignM: 1.6,
    goodAlignM: 4.0,
    maxAllowedAlignM: 7.5,
    doorOpenDuration: 1.6,
    doorWarningDuration: 1.8,
    doorCloseDuration: 1.5,
    baseBoardingDuration: 5.4,
  },
  masterTitle: 'Master of RER A',
  seniorTitle: 'Senior RATP/SNCF RER Driver',
};

export interface DirectedRoute {
  mode: LineMode;
  direction: RouteDirection;
  stations: StationConfig[];
  speedLimitZones: SpeedLimitZone[];
  trackMeta: RouteTrackMetadata;
  originName: string;
  originShortName: string;
  terminusName: string;
  terminusShortName: string;
  subtitle: string;
  totalDistanceM: number;
}

function buildReversedStations(stations: StationConfig[]): StationConfig[] {
  const n = stations.length;
  const totalDistanceM = stations[n - 1].stopX;
  const reversed: StationConfig[] = [];
  for (let k = 0; k < n; k++) {
    const orig = stations[n - 1 - k];
    reversed.push({
      ...orig,
      stopX: totalDistanceM - orig.stopX,
      legScheduleSeconds: k === 0 ? 0 : stations[n - k].legScheduleSeconds,
    });
  }
  return reversed;
}

function createDirectedRoute(mode: LineMode, direction: RouteDirection): DirectedRoute {
  const line = getLineDefinition(mode);
  const isRer = mode === 'rerA';
  const stations =
    direction === 'reverse' ? buildReversedStations(line.stations) : line.stations;
  const speedLimitZones =
    direction === 'reverse'
      ? buildZonesForStations(stations, isRer)
      : line.speedLimitZones;
  const origin = stations[0];
  const terminus = stations[stations.length - 1];
  return {
    mode,
    direction,
    stations,
    speedLimitZones,
    trackMeta: line.trackMeta,
    originName: origin.name,
    originShortName: origin.shortName,
    terminusName: terminus.name,
    terminusShortName: terminus.shortName,
    subtitle: `${origin.shortName.toUpperCase()} → ${terminus.shortName.toUpperCase()}`,
    totalDistanceM: terminus.stopX,
  };
}

const DIRECTED_ROUTES: Record<LineMode, Record<RouteDirection, DirectedRoute>> = {
  metro14: {
    forward: createDirectedRoute('metro14', 'forward'),
    reverse: createDirectedRoute('metro14', 'reverse'),
  },
  rerA: {
    forward: createDirectedRoute('rerA', 'forward'),
    reverse: createDirectedRoute('rerA', 'reverse'),
  },
};

export function getLineDefinition(mode: LineMode): LineDefinition {
  return mode === 'rerA' ? RER_A_LINE : METRO_14_LINE;
}

export function getDirectedRoute(
  mode: LineMode,
  direction: RouteDirection = 'forward'
): DirectedRoute {
  return DIRECTED_ROUTES[mode][direction];
}

export function getSpeedLimitAtForRoute(
  x: number,
  mode: LineMode,
  direction: RouteDirection = 'forward'
): number {
  const zones = getDirectedRoute(mode, direction).speedLimitZones;
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (x >= z.startX && x <= z.endX) {
      return z.limitKmh;
    }
  }
  return mode === 'rerA' ? 50 : 40;
}

export function getNextSpeedLimitChangeForRoute(
  x: number,
  mode: LineMode,
  direction: RouteDirection = 'forward'
): { distanceM: number; nextLimitKmh: number } | null {
  const zones = getDirectedRoute(mode, direction).speedLimitZones;
  const currentLimit = getSpeedLimitAtForRoute(x, mode, direction);
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    if (z.startX > x && z.limitKmh !== currentLimit) {
      return {
        distanceM: z.startX - x,
        nextLimitKmh: z.limitKmh,
      };
    }
  }
  return null;
}

export function getSpeedLimitAtForLine(x: number, mode: LineMode): number {
  return getSpeedLimitAtForRoute(x, mode, 'forward');
}

export function getNextSpeedLimitChangeForLine(
  x: number,
  mode: LineMode
): { distanceM: number; nextLimitKmh: number } | null {
  return getNextSpeedLimitChangeForRoute(x, mode, 'forward');
}
