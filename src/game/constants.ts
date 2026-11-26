export type StationArchStyle =
  | 'metro14_vault'
  | 'rer_vault'
  | 'la_defense'
  | 'vincennes'
  | 'suburban_outdoor';

export interface StationConfig {
  id: string;
  name: string;
  shortName: string;
  /** World X position in meters where the train's nose should stop for perfect alignment */
  stopX: number;
  /** Scheduled travel time in seconds from the previous station (0 for origin) */
  legScheduleSeconds: number;
  /** Platform length in meters */
  platformLength: number;
  /** Subtle architectural accent tint for each station */
  wallTint: string;
  vaultTint: string;
  /** Crowd density multiplier (0.7 to 1.6) */
  crowdDensity: number;
  /** Optional 3D architectural style preset for station generation */
  archStyle?: StationArchStyle;
  /** True for open-air above-ground / open-cut suburban stations */
  isOutdoor?: boolean;
}

export interface SpeedLimitZone {
  startX: number;
  endX: number;
  limitKmh: number;
}

export const COLORS = {
  line14Purple: '#62259D',
  line14PurpleLight: '#7E3CC0',
  rerARed: '#E3051C',
  rerARedLight: '#F43F5E',
  rerABlue: '#009EE0',
  ratpTurquoise: '#00AA91',
  ratpBlue: '#003B8E',
  cockpitDark: '#111827',
  cockpitDeep: '#0B1120',
  cockpitSurface: '#1E293B',
  safetyYellow: '#FACC15',
  signalGreen: '#10B981',
  signalRed: '#EF4444',
  warningAmber: '#F59E0B',
} as const;

/**
 * All 21 stations on Paris Metro Line 14 (Saint-Denis Pleyel ↔ Aéroport d'Orly).
 */
export const STATIONS: StationConfig[] = [
  {
    id: 'saint-denis-pleyel',
    name: 'Saint-Denis Pleyel',
    shortName: 'St-Denis Pleyel',
    stopX: 0,
    legScheduleSeconds: 0,
    platformLength: 120,
    wallTint: '#E2E8F0',
    vaultTint: '#CBD5E1',
    crowdDensity: 1.25,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'mairie-de-saint-ouen',
    name: 'Mairie de Saint-Ouen',
    shortName: 'Mairie St-Ouen',
    stopX: 540,
    legScheduleSeconds: 42,
    platformLength: 120,
    wallTint: '#E5E7EB',
    vaultTint: '#D1D5DB',
    crowdDensity: 1.15,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'saint-ouen',
    name: 'Saint-Ouen',
    shortName: 'Saint-Ouen',
    stopX: 1080,
    legScheduleSeconds: 42,
    platformLength: 120,
    wallTint: '#E4E6EB',
    vaultTint: '#D0D5DE',
    crowdDensity: 1.1,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'porte-de-clichy',
    name: 'Porte de Clichy',
    shortName: 'Pte de Clichy',
    stopX: 1640,
    legScheduleSeconds: 43,
    platformLength: 120,
    wallTint: '#E6E4DD',
    vaultTint: '#D6D2C8',
    crowdDensity: 1.2,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'pont-cardinet',
    name: 'Pont Cardinet',
    shortName: 'Pont Cardinet',
    stopX: 2200,
    legScheduleSeconds: 43,
    platformLength: 120,
    wallTint: '#E3E6EC',
    vaultTint: '#CFD5E0',
    crowdDensity: 1.05,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'saint-lazare',
    name: 'Saint-Lazare',
    shortName: 'Saint-Lazare',
    stopX: 2780,
    legScheduleSeconds: 44,
    platformLength: 120,
    wallTint: '#E6E2D8',
    vaultTint: '#D8D3C8',
    crowdDensity: 1.35,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'madeleine',
    name: 'Madeleine',
    shortName: 'Madeleine',
    stopX: 3320,
    legScheduleSeconds: 42,
    platformLength: 120,
    wallTint: '#E3E6EB',
    vaultTint: '#D2D8E0',
    crowdDensity: 1.0,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'pyramides',
    name: 'Pyramides',
    shortName: 'Pyramides',
    stopX: 3840,
    legScheduleSeconds: 40,
    platformLength: 120,
    wallTint: '#E5E1DA',
    vaultTint: '#D7D1C6',
    crowdDensity: 0.95,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'chatelet',
    name: 'Châtelet',
    shortName: 'Châtelet',
    stopX: 4460,
    legScheduleSeconds: 46,
    platformLength: 120,
    wallTint: '#E2E5E9',
    vaultTint: '#CFD5DC',
    crowdDensity: 1.45,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'gare-de-lyon',
    name: 'Gare de Lyon',
    shortName: 'Gare de Lyon',
    stopX: 5200,
    legScheduleSeconds: 52,
    platformLength: 120,
    wallTint: '#EAE4D7',
    vaultTint: '#DBD3C2',
    crowdDensity: 1.4,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'bercy',
    name: 'Bercy',
    shortName: 'Bercy',
    stopX: 5800,
    legScheduleSeconds: 44,
    platformLength: 120,
    wallTint: '#E4E7EC',
    vaultTint: '#D4D9E2',
    crowdDensity: 1.05,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'cour-saint-emilion',
    name: 'Cour Saint-Émilion',
    shortName: 'Cour St-Émilion',
    stopX: 6380,
    legScheduleSeconds: 43,
    platformLength: 120,
    wallTint: '#ECE6DC',
    vaultTint: '#DDD5C8',
    crowdDensity: 0.95,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'bfm',
    name: 'Bibliothèque François Mitterrand',
    shortName: 'Bib. F. Mitt.',
    stopX: 7020,
    legScheduleSeconds: 47,
    platformLength: 120,
    wallTint: '#E0E6EC',
    vaultTint: '#CED7E0',
    crowdDensity: 1.25,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'olympiades',
    name: 'Olympiades',
    shortName: 'Olympiades',
    stopX: 7600,
    legScheduleSeconds: 45,
    platformLength: 120,
    wallTint: '#E5E2EA',
    vaultTint: '#D5D0DE',
    crowdDensity: 1.15,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'maison-blanche',
    name: 'Maison Blanche',
    shortName: 'Maison Blanche',
    stopX: 8200,
    legScheduleSeconds: 45,
    platformLength: 120,
    wallTint: '#E6E4DF',
    vaultTint: '#D6D2CB',
    crowdDensity: 1.05,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'hopital-bicetre',
    name: 'Hôpital Bicêtre',
    shortName: 'Hôp. Bicêtre',
    stopX: 8820,
    legScheduleSeconds: 46,
    platformLength: 120,
    wallTint: '#E2E8EB',
    vaultTint: '#CFD9DF',
    crowdDensity: 0.95,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'villejuif-gustave-roussy',
    name: 'Villejuif – Gustave Roussy',
    shortName: 'Villejuif GR',
    stopX: 9460,
    legScheduleSeconds: 47,
    platformLength: 120,
    wallTint: '#DFE5EC',
    vaultTint: '#CBD5E1',
    crowdDensity: 1.2,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'lhay-les-roses',
    name: "L'Haÿ-les-Roses",
    shortName: "L'Haÿ-Roses",
    stopX: 10080,
    legScheduleSeconds: 46,
    platformLength: 120,
    wallTint: '#E6E5DE',
    vaultTint: '#D7D5CA',
    crowdDensity: 0.9,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'chevilly-larue',
    name: 'Chevilly-Larue',
    shortName: 'Chevilly-Larue',
    stopX: 10700,
    legScheduleSeconds: 46,
    platformLength: 120,
    wallTint: '#E3E6E9',
    vaultTint: '#D0D6DC',
    crowdDensity: 0.9,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'thiais-orly',
    name: 'Thiais – Orly',
    shortName: 'Thiais – Orly',
    stopX: 11320,
    legScheduleSeconds: 46,
    platformLength: 120,
    wallTint: '#E4E7EC',
    vaultTint: '#D2D8E2',
    crowdDensity: 1.0,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
  {
    id: 'aeroport-dorly',
    name: "Aéroport d'Orly",
    shortName: "Aéroport d'Orly",
    stopX: 11980,
    legScheduleSeconds: 49,
    platformLength: 120,
    wallTint: '#E0E7EE',
    vaultTint: '#CBD5E1',
    crowdDensity: 1.35,
    archStyle: 'metro14_vault',
    isOutdoor: false,
  },
];

/** Physics & train geometry constants (MP14 rubber-tired metro characteristics) */
export const PHYSICS = {
  /** Max achievable speed in m/s (~90 km/h) */
  maxSpeedMs: 90 / 3.6,
  /** Rubber-tired strong low-end traction acceleration (m/s²) */
  maxAccelMs2: 1.35,
  /** Smooth electric/pneumatic service brake deceleration (m/s²) */
  maxServiceBrakeMs2: 1.55,
  /** Emergency brake deceleration (m/s²) — fast stop, penalizes comfort */
  emergencyBrakeMs2: 2.85,
  /** Rolling resistance coefficient (m/s²) */
  rollingDrag: 0.055,
  /** Aerodynamic tunnel drag coefficient */
  aeroDrag: 0.00055,
  /** Speed threshold below which the train is considered stopped (m/s) */
  stopThresholdMs: 0.08,
  /** Train length in meters (visible multi-car consist) */
  trainLengthM: 76,
  /** Alignment tolerance thresholds (meters from exact stopX) */
  perfectAlignM: 1.5,
  goodAlignM: 3.8,
  maxAllowedAlignM: 7.5,
  /** Door animation durations (seconds) */
  doorOpenDuration: 1.4,
  doorWarningDuration: 1.6,
  doorCloseDuration: 1.3,
  /** Base boarding duration (seconds), scaled by station crowd density */
  baseBoardingDuration: 4.5,
} as const;

/**
 * Generates realistic speed-limit zones along the entire Line 14 corridor:
 * - Station platforms & immediate entry/exit: 40 km/h
 * - Approach & departure transitions: 60 km/h
 * - Open inter-station tunnel express segments: 80 km/h
 */
export function buildSpeedLimitZones(): SpeedLimitZone[] {
  const zones: SpeedLimitZone[] = [];

  for (let i = 0; i < STATIONS.length; i++) {
    const station = STATIONS[i];
    // Station zone: 40 km/h from 65m before stopX to 35m after stopX
    zones.push({
      startX: station.stopX - 65,
      endX: station.stopX + 35,
      limitKmh: 40,
    });

    if (i < STATIONS.length - 1) {
      const next = STATIONS[i + 1];
      const departStart = station.stopX + 35;
      const departEnd = station.stopX + 125;
      const approachStart = next.stopX - 185;
      const approachEnd = next.stopX - 65;

      // Departure ramp: 60 km/h
      zones.push({
        startX: departStart,
        endX: Math.min(departEnd, approachStart),
        limitKmh: 60,
      });

      // Open tunnel express section: 80 km/h (or 60 km/h on tighter curves like Pyramides)
      if (approachStart > departEnd) {
        const isCurvedTunnel = station.id === 'madeleine' || station.id === 'bercy';
        zones.push({
          startX: departEnd,
          endX: approachStart,
          limitKmh: isCurvedTunnel ? 70 : 80,
        });
      }

      // Station approach zone: 60 km/h
      zones.push({
        startX: approachStart,
        endX: approachEnd,
        limitKmh: 60,
      });
    }
  }

  return zones;
}

export const SPEED_LIMIT_ZONES: SpeedLimitZone[] = buildSpeedLimitZones();

export function getSpeedLimitAt(x: number): number {
  for (let i = 0; i < SPEED_LIMIT_ZONES.length; i++) {
    const z = SPEED_LIMIT_ZONES[i];
    if (x >= z.startX && x <= z.endX) {
      return z.limitKmh;
    }
  }
  return 40;
}

export function getNextSpeedLimitChange(x: number): { distanceM: number; nextLimitKmh: number } | null {
  const currentLimit = getSpeedLimitAt(x);
  for (let i = 0; i < SPEED_LIMIT_ZONES.length; i++) {
    const z = SPEED_LIMIT_ZONES[i];
    if (z.startX > x && z.limitKmh !== currentLimit) {
      return {
        distanceM: z.startX - x,
        nextLimitKmh: z.limitKmh,
      };
    }
  }
  return null;
}
