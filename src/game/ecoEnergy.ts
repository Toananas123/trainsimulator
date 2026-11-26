import type { LineMode } from './lines';

export type EnergyDriveMode = 'IDLE' | 'TRACTION' | 'COAST' | 'REGEN' | 'FRICTION';
export type EcoGrade = 'A+' | 'A' | 'B' | 'C';

export interface EcoEnergyState {
  /** Cumulative net energy drawn from 3rd rail / catenary (kWh) */
  netEnergyKwh: number;
  /** Gross energy drawn during traction (kWh) */
  tractionEnergyKwh: number;
  /** Kinetic energy recovered back via regenerative braking (kWh) */
  regeneratedEnergyKwh: number;
  /** Instantaneous electrical power (+kW draw, -kW regen) */
  instantPowerKw: number;
  /** Active driving energy regime */
  driveMode: EnergyDriveMode;
  /** Distance traveled in traction / coasting / braking (m) */
  tractionDistanceM: number;
  coastingDistanceM: number;
  movingDistanceM: number;
  /** Seconds spent pushing heavy traction (>72% lever) above 25 km/h */
  heavyNotchSec: number;
  /** Efficiency score 0..100 */
  efficiencyPct: number;
  ecoGrade: EcoGrade;
  /** Concise eco-driving advice string */
  advice: string;
}

export interface EcoEnergySnapshot {
  netEnergyKwh: number;
  regeneratedEnergyKwh: number;
  instantPowerKw: number;
  driveMode: EnergyDriveMode;
  coastingSharePct: number;
  kwhPerKm: number;
  efficiencyPct: number;
  ecoGrade: EcoGrade;
  advice: string;
}

export function createInitialEcoState(): EcoEnergyState {
  return {
    netEnergyKwh: 0,
    tractionEnergyKwh: 0,
    regeneratedEnergyKwh: 0,
    instantPowerKw: 0,
    driveMode: 'IDLE',
    tractionDistanceM: 0,
    coastingDistanceM: 0,
    movingDistanceM: 0,
    heavyNotchSec: 0,
    efficiencyPct: 92,
    ecoGrade: 'A+',
    advice: 'Smooth notch & coast ahead',
  };
}

export function deriveEcoGrade(efficiencyPct: number): EcoGrade {
  if (efficiencyPct >= 88) return 'A+';
  if (efficiencyPct >= 74) return 'A';
  if (efficiencyPct >= 56) return 'B';
  return 'C';
}

/**
 * Pure deterministic Eco-Driving Energy Simulation step:
 * - Models realistic quadratic I²R traction losses when slamming >72% throttle at speed
 * - Rewards Coasting (0 kW draw while rolling > 5 km/h) to boost Coasting Share % & Efficiency
 * - Recovers ~38% kinetic energy during smooth Regenerative Service Braking
 * - Emergency braking wastes energy to friction shoes with 0 kW regeneration
 */
export function stepEcoEnergy(
  eco: EcoEnergyState,
  params: {
    dt: number;
    speedMs: number;
    lever: number;
    emergencyBrake: boolean;
    doorsOpen: boolean;
    lineMode: LineMode;
  }
): void {
  const { dt, speedMs, lever, emergencyBrake, doorsOpen, lineMode } = params;
  if (dt <= 0) return;

  // Peak rated power: MP14 (~1400 kW) vs heavier double-decker MI09 RER A (~2400 kW)
  const ratedPowerKw = lineMode === 'rerA' ? 2400 : 1400;
  const idleHotelLoadKw = doorsOpen ? 38 : 26;
  const speedKmh = speedMs * 3.6;
  const distStepM = speedMs * dt;

  let instantPowerKw = idleHotelLoadKw;
  let driveMode: EnergyDriveMode = 'IDLE';

  if (speedMs > 0.25) {
    eco.movingDistanceM += distStepM;
  }

  if (doorsOpen || speedMs <= 0.15) {
    // Auxiliaries + HVAC when parked
    if (lever > 0.05 && !doorsOpen) {
      // Starting torque draw from standstill
      instantPowerKw = idleHotelLoadKw + lever * ratedPowerKw * 0.28;
      driveMode = 'TRACTION';
      eco.tractionEnergyKwh += (instantPowerKw * dt) / 3600;
      eco.netEnergyKwh += (instantPowerKw * dt) / 3600;
    } else {
      instantPowerKw = idleHotelLoadKw;
      driveMode = 'IDLE';
      eco.netEnergyKwh += (instantPowerKw * dt) / 3600;
    }
  } else if (emergencyBrake || lever <= -0.92) {
    // Pneumatic friction dump — zero electrical regen
    instantPowerKw = idleHotelLoadKw;
    driveMode = 'FRICTION';
    eco.netEnergyKwh += (instantPowerKw * dt) / 3600;
    eco.heavyNotchSec += dt * 1.4;
  } else if (lever > 0.04) {
    // Traction draw scales with lever * speed factor + quadratic heavy-notch I²R penalty
    const speedLoadFactor = 0.25 + 0.75 * Math.min(1, speedKmh / (lineMode === 'rerA' ? 95 : 70));
    const heavyPenaltyFactor = lever > 0.72 ? 1 + (lever - 0.72) * 1.35 : 1.0;
    const tractionKw = lever * ratedPowerKw * speedLoadFactor * heavyPenaltyFactor;

    instantPowerKw = idleHotelLoadKw + tractionKw;
    driveMode = 'TRACTION';
    eco.tractionDistanceM += distStepM;

    const kwh = (instantPowerKw * dt) / 3600;
    eco.tractionEnergyKwh += kwh;
    eco.netEnergyKwh += kwh;

    if (lever > 0.75 && speedKmh > 25) {
      eco.heavyNotchSec += dt;
    }
  } else if (lever < -0.04) {
    // Regenerative electric braking recovers ~38% down to 8 km/h, blending to friction below
    if (speedKmh > 6) {
      const brakeFrac = Math.min(1, Math.abs(lever) / 0.92);
      const speedFactor = Math.min(1, speedKmh / 65);
      const regenKw = ratedPowerKw * 0.44 * brakeFrac * speedFactor;
      const netKw = idleHotelLoadKw - regenKw;
      instantPowerKw = netKw;
      driveMode = 'REGEN';

      const regenKwh = (regenKw * dt) / 3600;
      eco.regeneratedEnergyKwh += regenKwh;
      eco.netEnergyKwh = Math.max(0, eco.netEnergyKwh + (netKw * dt) / 3600);
    } else {
      instantPowerKw = idleHotelLoadKw;
      driveMode = 'FRICTION';
      eco.netEnergyKwh += (idleHotelLoadKw * dt) / 3600;
    }
  } else {
    // Coasting on momentum: zero traction draw!
    instantPowerKw = idleHotelLoadKw;
    driveMode = 'COAST';
    eco.coastingDistanceM += distStepM;
    eco.netEnergyKwh += (idleHotelLoadKw * dt) / 3600;
  }

  eco.instantPowerKw = instantPowerKw;
  eco.driveMode = driveMode;

  // Compute dynamic Eco Efficiency (0..100) from coasting share, regen recovery, & heavy-notch discipline
  const coastRatio =
    eco.movingDistanceM > 30 ? eco.coastingDistanceM / eco.movingDistanceM : 0.35;
  const regenRatio =
    eco.tractionEnergyKwh > 0.05
      ? Math.min(0.45, eco.regeneratedEnergyKwh / eco.tractionEnergyKwh)
      : 0.18;
  const heavyPenalty = Math.min(35, eco.heavyNotchSec * 1.45);

  const rawScore = 62 + coastRatio * 34 + regenRatio * 48 - heavyPenalty;
  const targetEff = Math.max(15, Math.min(100, rawScore));
  eco.efficiencyPct = eco.efficiencyPct + (targetEff - eco.efficiencyPct) * Math.min(1, dt * 1.6);
  eco.ecoGrade = deriveEcoGrade(eco.efficiencyPct);

  if (driveMode === 'COAST') {
    eco.advice = 'Coasting · 0 kW traction draw';
  } else if (driveMode === 'REGEN') {
    eco.advice = `Regenerating +${Math.round(Math.max(0, -instantPowerKw))} kW`;
  } else if (driveMode === 'FRICTION') {
    eco.advice = 'Friction brake · energy lost';
  } else if (driveMode === 'TRACTION' && lever > 0.78 && speedKmh > 40) {
    eco.advice = 'Heavy notch · ease to Coast [0]';
  } else if (driveMode === 'TRACTION') {
    eco.advice = 'Accelerating cleanly';
  } else {
    eco.advice = 'Auxiliary hotel load';
  }
}

export function buildEcoSnapshot(eco: EcoEnergyState): EcoEnergySnapshot {
  const km = Math.max(0.05, eco.movingDistanceM / 1000);
  const kwhPerKm = eco.movingDistanceM > 40 ? eco.netEnergyKwh / km : 0;
  const coastingSharePct =
    eco.movingDistanceM > 20
      ? Math.round((eco.coastingDistanceM / eco.movingDistanceM) * 100)
      : 0;

  return {
    netEnergyKwh: Number(eco.netEnergyKwh.toFixed(2)),
    regeneratedEnergyKwh: Number(eco.regeneratedEnergyKwh.toFixed(2)),
    instantPowerKw: Math.round(eco.instantPowerKw),
    driveMode: eco.driveMode,
    coastingSharePct,
    kwhPerKm: Number(kwhPerKm.toFixed(1)),
    efficiencyPct: Math.round(eco.efficiencyPct),
    ecoGrade: eco.ecoGrade,
    advice: eco.advice,
  };
}
