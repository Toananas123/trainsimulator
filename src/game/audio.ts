/**
 * Photorealistic Multi-Layered Web Audio API Acoustic Engine
 * modeled on the Paris Metro Line 14 Alstom MP14 Rubber-Tired Metro ("Métro sur Pneus").
 *
 * Acoustic Signal Chain:
 *  1. Organic Alstom MP14 VVVF Inverter + Helical Gearbox Mesh:
 *     - Multi-stage stepping carrier progression (0 -> 14 -> 28 -> 46 -> 85 km/h)
 *     - Distinct Traction vs. Regenerative Braking harmonic profile
 *     - Soft-clipping WaveShaperNode stator saturation + dual aluminum-carbody formant filters
 *     - Subtle 6Hz electromechanical load shimmer (eliminates sterile synth feel)
 *  2. Authentic Rubber-Tired ("Métro sur Pneus") Rollway Signature:
 *     - Deep hollow pneumatic tire cavity resonance (95–210 Hz resonant bandpass)
 *     - Michelin tire tread / concrete beam hum + metallic guide-wheel rail sizzle
 *     - Distance-locked 22m rubber-bogie expansion-joint double-thumps
 *  3. Tunnel Aerodynamics & Rib-Pass Flutter:
 *     - Speed-locked LFO modulation (speedMs / 10m Hz) recreating passing TBM tunnel rings
 *     - Low-frequency pressure-wave boom upon crossing station/tunnel portals
 *  4. Composite Brake-Pad Friction Whisper (<24 km/h) & Pneumatic Stop-Hold Exhaust
 *  5. Authentic RATP Transit Soundscape:
 *     - Vibrating-diaphragm continuous RATP "Ronfleur" door-closing buzzer (462 Hz + 28 Hz reed AM)
 *     - Warm vibraphone-style RATP station arrival chime with stereo cavern reverb
 *     - Ambient vaulted station air/murmur bed fading in when doors open & sealing when closed
 *     - Multi-stage pneumatic door latch/slide/gasket seal + heavy emergency air-pipe dump
 */

import type { WeatherType } from './engine';
import { getLineDefinition, type LineMode, type RouteTrackMetadata } from './lines';

export type AudioPerspective = 'side' | 'cab' | 'chase' | 'passenger';

export interface WeatherAmbienceParams {
  weather: WeatherType;
  weatherIntensity: number;
  speedKmh: number;
  inStation: boolean;
  isOutdoor: boolean;
  perspective: AudioPerspective;
}

export interface WeatherAmbienceResult {
  breezeGain: number;
  breezeFreqHz: number;
  mistGain: number;
  mistFreqHz: number;
  rainPitterGain: number;
  rainFilterFreqHz: number;
  thunderGain: number;
}

/**
 * Pure deterministic environmental ambience solver driven by simulation weather state,
 * train speed, outdoor/underground location, and camera perspective.
 */
export function computeWeatherAmbience(params: WeatherAmbienceParams): WeatherAmbienceResult {
  const { weather, weatherIntensity, speedKmh, inStation, isOutdoor, perspective } = params;
  const clampedIntensity = Math.max(0, Math.min(1, weatherIntensity));
  const speedFactor = Math.min(1, Math.max(0, speedKmh) / 80);
  const outdoorFactor = isOutdoor ? 1.0 : inStation ? 0.42 : 0.28;
  const viewAttenuation =
    perspective === 'cab' ? 0.68 : perspective === 'passenger' ? 0.78 : 1.0;

  if (weather === 'rain') {
    const active = Math.max(0.15, clampedIntensity);
    const wetSpray = active * speedFactor * 0.065;
    return {
      breezeGain: 0.012 * outdoorFactor * viewAttenuation,
      breezeFreqHz: 520 + speedFactor * 360,
      mistGain: 0.014 * active * outdoorFactor * viewAttenuation,
      mistFreqHz: 410,
      rainPitterGain: (active * 0.072 + wetSpray) * outdoorFactor * viewAttenuation,
      rainFilterFreqHz: 1900 + speedFactor * 1450 + (isOutdoor ? 320 : -240),
      thunderGain: active * (isOutdoor ? 0.18 : 0.065) * viewAttenuation,
    };
  }

  if (weather === 'fog') {
    const active = Math.max(0.15, clampedIntensity);
    return {
      breezeGain: 0.008 * outdoorFactor * viewAttenuation,
      breezeFreqHz: 340 + speedFactor * 180,
      mistGain: (0.018 + active * 0.044) * outdoorFactor * viewAttenuation,
      mistFreqHz: 360 + (isOutdoor ? 140 : 40) + speedFactor * 120,
      rainPitterGain: 0,
      rainFilterFreqHz: 1800,
      thunderGain: 0,
    };
  }

  // Clear conditions: crisp outdoor air breeze vs muted subterranean ventilation drift
  return {
    breezeGain: (isOutdoor ? 0.022 : 0.007) * (0.7 + speedFactor * 0.5) * viewAttenuation,
    breezeFreqHz: (isOutdoor ? 560 : 320) + speedFactor * 260,
    mistGain: 0,
    mistFreqHz: 360,
    rainPitterGain: 0,
    rainFilterFreqHz: 1800,
    thunderGain: 0,
  };
}

export interface TrackClickCadenceParams {
  trainX: number;
  lastJointBucket: number;
  speedKmh: number;
  trackMeta: RouteTrackMetadata;
  isOutdoor: boolean;
  inStation: boolean;
}

export interface TrackClickCadenceResult {
  triggered: boolean;
  jointBucket: number;
  axleDelaySec: number;
  intensity: number;
  toneHz: number;
  decaySec: number;
  isMetallic: boolean;
  reverbRatio: number;
}

/**
 * Pure deterministic solver computing rhythmic wheel-over-joint track-click triggers
 * from live train speed and the active route's track metadata.
 */
export function computeTrackClickCadence(
  params: TrackClickCadenceParams
): TrackClickCadenceResult {
  const { trainX, lastJointBucket, speedKmh, trackMeta, isOutdoor, inStation } = params;
  const intervalM = Math.max(6, trackMeta.jointIntervalM);
  const jointBucket = Math.floor(trainX / intervalM);
  const speedMs = Math.max(0, speedKmh) / 3.6;
  const triggered = jointBucket !== lastJointBucket && speedKmh > 4;

  const isMetallic = trackMeta.trackType === 'steel_ballast';
  const clampedNormSpeed = Math.min(1, Math.max(0, speedKmh) / (isMetallic ? 120 : 85));
  const acousticScale = isOutdoor ? trackMeta.outdoorEchoFactor : inStation ? 0.92 : 1.0;

  return {
    triggered,
    jointBucket,
    axleDelaySec: Math.max(
      0.042,
      Math.min(0.24, trackMeta.bogieWheelbaseM / Math.max(2, speedMs))
    ),
    intensity: Math.min(0.18, (0.032 + clampedNormSpeed * 0.135) * acousticScale),
    toneHz: trackMeta.clickToneHz * (0.94 + clampedNormSpeed * 0.14),
    decaySec: trackMeta.clickDecaySec,
    isMetallic,
    reverbRatio: isOutdoor ? 0.25 : inStation ? 0.95 : 0.72,
  };
}

export interface TractionAcoustics {
  fundamentalHz: number;
  harmonicHz: number;
  pwmCarrierHz: number;
  gearboxHz: number;
  motorGain: number;
  pwmGain: number;
  tireCavityFreqHz: number;
  tireCavityGain: number;
  steelRailGain: number;
  rumbleFreqHz: number;
  rumbleGain: number;
  tunnelWindFreqHz: number;
  tunnelWindGain: number;
  ribFlutterHz: number;
  brakeWhisperGain: number;
  reverbWet: number;
  perspectiveCutoffHz: number;
}

/**
 * Pure deterministic acoustic solver for MP14 (rubber-tired) & RER A MI09 (steel-wheel express)
 * inverter steps, rollway resonance, tunnel rib-pass flutter, brake whisper, and cab glazing.
 */
export function computeTractionAcoustics(
  speedKmh: number,
  lever: number,
  inStation: boolean,
  perspective: AudioPerspective,
  lineMode: LineMode = 'metro14'
): TractionAcoustics {
  const isRer = lineMode === 'rerA';
  const maxRefKmh = isRer ? 125 : 85;
  const clampedSpeed = Math.max(0, Math.min(isRer ? 132 : 95, speedKmh));
  const speedRatio = clampedSpeed / maxRefKmh;
  const speedMs = clampedSpeed / 3.6;
  const absLever = Math.min(1, Math.abs(lever));
  const isAccelerating = lever > 0.03;
  const isRegenBraking = lever < -0.03 && clampedSpeed > 5.5;
  const isFrictionBraking = lever < -0.05 && clampedSpeed > 1.2 && clampedSpeed < 24;

  // VVVF stepping fundamental & gearbox mesh (MI09 RER A runs deeper heavier stator harmonics)
  const fundamentalHz = isRer
    ? 54 + speedRatio * 375 + (isAccelerating ? absLever * 26 : isRegenBraking ? -14 * absLever : 0)
    : 68 + speedRatio * 340 + (isAccelerating ? absLever * 22 : isRegenBraking ? -12 * absLever : 0);
  const harmonicHz = fundamentalHz * (isRegenBraking ? 1.498 : isRer ? 2.008 : 2.003);
  const gearboxHz = isRer ? 115 + speedRatio * 840 : 140 + speedRatio * 740;

  // Stepped IGBT PWM carrier frequency jumps
  let pwmCarrierHz = (isRer ? 680 : 860) + speedRatio * 420;
  if (clampedSpeed > 14 && clampedSpeed <= 32) {
    pwmCarrierHz = (isRer ? 590 : 720) + ((clampedSpeed - 14) / 18) * 540;
  } else if (clampedSpeed > 32 && clampedSpeed <= 58) {
    pwmCarrierHz = (isRer ? 820 : 940) + ((clampedSpeed - 32) / 26) * 680;
  } else if (clampedSpeed > 58) {
    pwmCarrierHz = (isRer ? 1140 : 1280) + ((clampedSpeed - 58) / 68) * 780;
  }

  const activeLoad = isAccelerating || isRegenBraking ? 0.048 + absLever * 0.082 : 0.015;
  const motorGain =
    clampedSpeed > 0.35
      ? Math.min(0.185, 0.018 + speedRatio * 0.052 + activeLoad)
      : 0.006;

  const pwmGain =
    clampedSpeed > 1.0 && (isAccelerating || isRegenBraking)
      ? Math.min(0.048, (0.012 + absLever * 0.034) * Math.min(1, clampedSpeed / 10))
      : 0;

  // MP14: hollow rubber-tired Michelin cavity resonance; RER A: metallic steel-rail flange hiss
  const tireCavityFreqHz = isRer ? 1580 + speedRatio * 1120 : 96 + speedRatio * 135;
  const tireCavityGain =
    !isRer && clampedSpeed > 0.8
      ? Math.min(0.24, 0.018 + Math.pow(speedRatio, 0.85) * 0.21)
      : 0;
  const steelRailGain =
    isRer && clampedSpeed > 1.2
      ? Math.min(0.12, 0.014 + Math.pow(speedRatio, 0.92) * 0.105)
      : 0;

  // Low-end guideway / ballast bogie sub-rumble
  const rumbleFreqHz =
    (isRer ? 84 : 66) + speedRatio * (isRer ? 215 : 165) + (inStation ? -14 : 18);
  const rumbleGain =
    clampedSpeed > 0.5 ? Math.min(0.27, 0.022 + Math.pow(speedRatio, 0.88) * 0.235) : 0;

  // Aerodynamic tunnel air-piston whoosh + passing tunnel rib flutter
  const tunnelFactor = inStation ? 0.24 : 1.0;
  const tunnelWindFreqHz = 240 + speedRatio * (isRer ? 920 : 760);
  const tunnelWindGain =
    clampedSpeed > 4
      ? Math.min(0.2, Math.pow(speedRatio, 1.5) * (isRer ? 0.185 : 0.165) * tunnelFactor)
      : 0;
  const ribFlutterHz = inStation ? 0.6 : Math.max(0.8, speedMs / (isRer ? 12 : 10));

  // Subtle composite brake-pad metallic whisper while slowing into stations
  const brakeBandFactor = isFrictionBraking
    ? Math.sin(((clampedSpeed - 1.2) / 22.8) * Math.PI)
    : 0;
  const brakeWhisperGain = brakeBandFactor * absLever * (isRer ? 0.032 : 0.024);

  const reverbWet = inStation ? (isRer ? 0.46 : 0.42) : 0.24;
  const perspectiveCutoffHz =
    perspective === 'cab' ? 3800 : perspective === 'passenger' ? 4600 : 10800;

  return {
    fundamentalHz,
    harmonicHz,
    pwmCarrierHz,
    gearboxHz,
    motorGain,
    pwmGain,
    tireCavityFreqHz,
    tireCavityGain,
    steelRailGain,
    rumbleFreqHz,
    rumbleGain,
    tunnelWindFreqHz,
    tunnelWindGain,
    ribFlutterHz,
    brakeWhisperGain,
    reverbWet,
    perspectiveCutoffHz,
  };
}

/** Soft asymmetric saturation curve giving traction oscillators organic electromagnetic warmth */
function createStatorSaturationCurve(): Float32Array<ArrayBuffer> {
  const samples = 512;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = Math.tanh(x * 2.2) * 0.85;
  }
  return curve;
}

/** Synthesizes a realistic stereo underground metro cavern impulse response */
function createCavernImpulseResponse(ctx: AudioContext, durationSec = 1.55): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const decay = Math.pow(1 - t, 2.55);
      const white = Math.random() * 2 - 1;
      lp = lp * 0.76 + white * 0.24;
      data[i] = lp * decay * 0.68;
    }

    // Distinct concrete vault early reflections
    const taps = [
      { ms: 14 + ch * 2, amp: 0.46 },
      { ms: 29 + ch * 3, amp: 0.34 },
      { ms: 49 - ch * 2, amp: 0.24 },
      { ms: 76 + ch * 4, amp: 0.16 },
    ];
    for (const tap of taps) {
      const idx = Math.floor((tap.ms / 1000) * ctx.sampleRate);
      if (idx < length) {
        data[idx] += tap.amp;
      }
    }
  }
  return buffer;
}

export class MetroAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private perspectiveFilter: BiquadFilterNode | null = null;
  private dryBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private brownNoiseBuffer: AudioBuffer | null = null;

  // 1. Organic MP14 VVVF Inverter + Helical Gearbox
  private motorOscFundamental: OscillatorNode | null = null;
  private motorOscHarmonic: OscillatorNode | null = null;
  private motorOscGearbox: OscillatorNode | null = null;
  private motorOscPwm: OscillatorNode | null = null;
  private motorFilter: BiquadFilterNode | null = null;
  private motorGain: GainNode | null = null;
  private pwmFilter: BiquadFilterNode | null = null;
  private pwmGain: GainNode | null = null;

  // 2. Idle Auxiliary Static Converter & Cabin Ventilation
  private auxGain: GainNode | null = null;

  // 3. Rubber-Tired Rollway (Hollow Tire Cavity + Low Concrete Rumble)
  private tireCavityFilter: BiquadFilterNode | null = null;
  private tireCavityGain: GainNode | null = null;
  private rumbleFilter: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;

  // 4. Tunnel Air-Piston Whoosh + Speed-Locked Tunnel Rib Flutter LFO
  private windFilter: BiquadFilterNode | null = null;
  private windBaseGain: GainNode | null = null;
  private ribFlutterOsc: OscillatorNode | null = null;
  private ribFlutterDepth: GainNode | null = null;

  // 5. Composite Brake-Pad Friction Whisper (<24 km/h)
  private brakeWhisperFilter: BiquadFilterNode | null = null;
  private brakeWhisperGain: GainNode | null = null;

  // 6. Station Ambient Platform Air/Murmur Bed (fades in when doors open)
  private stationAmbienceGain: GainNode | null = null;

  // 7. Dynamic Weather Ambience (Rain Pitter-Patter / Fog Mist / Clear Breeze)
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;
  private envWindFilter: BiquadFilterNode | null = null;
  private envWindGain: GainNode | null = null;

  private muted = false;
  private initialized = false;

  // Procedural state edge trackers
  private lastJointBucket = 0;
  private prevSpeedKmh = 0;
  private prevInStation = true;
  private overspeedBeepCooldown = 0;
  private thunderCooldownSec = 4.5;

  public unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.initialized) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Master dynamics stage preventing any clipping across rich acoustic layers
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -9;
      compressor.knee.value = 16;
      compressor.ratio.value = 3.8;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.16;

      const perspectiveFilter = ctx.createBiquadFilter();
      perspectiveFilter.type = 'lowpass';
      perspectiveFilter.frequency.value = 4200;
      perspectiveFilter.Q.value = 0.65;

      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.54;

      perspectiveFilter.connect(compressor);
      compressor.connect(master);
      master.connect(ctx.destination);

      this.perspectiveFilter = perspectiveFilter;
      this.masterGain = master;

      const dryBus = ctx.createGain();
      dryBus.gain.value = 1.0;
      dryBus.connect(perspectiveFilter);
      this.dryBus = dryBus;

      const reverbNode = ctx.createConvolver();
      reverbNode.buffer = createCavernImpulseResponse(ctx, 1.55);

      const reverbSend = ctx.createGain();
      reverbSend.gain.value = 0.34;
      reverbSend.connect(reverbNode);
      reverbNode.connect(perspectiveFilter);
      this.reverbSend = reverbSend;

      // Pre-generate pink noise & deep brown noise buffers (4s loop = seamless, zero periodicity)
      const bufferSize = ctx.sampleRate * 4;
      const pinkBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const brownBuf = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const pinkOut = pinkBuf.getChannelData(0);
      const brownOut = brownBuf.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, brown = 0;
      for (let i = 0; i < bufferSize; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + w * 0.029;
        b1 = 0.985 * b1 + w * 0.032;
        b2 = 0.950 * b2 + w * 0.048;
        pinkOut[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + w * 0.15) * 1.35));

        brown = (brown + 0.028 * w) / 1.028;
        brownOut[i] = Math.max(-1, Math.min(1, brown * 4.2));
      }
      this.noiseBuffer = pinkBuf;
      this.brownNoiseBuffer = brownBuf;

      // --- Layer 1: Organic MP14 VVVF Inverter + Helical Gearbox through Stator Saturation & Carbody Formants ---
      const statorShaper = ctx.createWaveShaper();
      statorShaper.curve = createStatorSaturationCurve();
      statorShaper.oversample = '2x';

      // Carbody mechanical acoustic resonance (285Hz floor mode + 790Hz steel bogie resonance)
      const bodyFormant1 = ctx.createBiquadFilter();
      bodyFormant1.type = 'peaking';
      bodyFormant1.frequency.value = 285;
      bodyFormant1.Q.value = 2.2;
      bodyFormant1.gain.value = 4.5;

      const bodyFormant2 = ctx.createBiquadFilter();
      bodyFormant2.type = 'peaking';
      bodyFormant2.frequency.value = 790;
      bodyFormant2.Q.value = 2.6;
      bodyFormant2.gain.value = 3.2;

      const motorFilter = ctx.createBiquadFilter();
      motorFilter.type = 'lowpass';
      motorFilter.frequency.value = 1400;
      motorFilter.Q.value = 1.4;

      const motorGain = ctx.createGain();
      motorGain.gain.value = 0;

      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle';
      osc1.frequency.value = 74;

      const osc2 = ctx.createOscillator();
      osc2.type = 'sawtooth';
      osc2.frequency.value = 148;
      const osc2Gain = ctx.createGain();
      osc2Gain.gain.value = 0.22;

      // Helical gearbox whine (gives authentic heavy electric rail mechanical character)
      const oscGear = ctx.createOscillator();
      oscGear.type = 'sine';
      oscGear.frequency.value = 160;
      const gearGain = ctx.createGain();
      gearGain.gain.value = 0.18;

      // Subtle 6Hz electromechanical shimmer LFO modulating fundamental slightly
      const shimmerLfo = ctx.createOscillator();
      shimmerLfo.frequency.value = 5.8;
      const shimmerDepth = ctx.createGain();
      shimmerDepth.gain.value = 1.4;
      shimmerLfo.connect(shimmerDepth);
      shimmerDepth.connect(osc1.frequency);

      osc1.connect(statorShaper);
      osc2.connect(osc2Gain);
      osc2Gain.connect(statorShaper);
      oscGear.connect(gearGain);
      gearGain.connect(statorShaper);

      statorShaper.connect(bodyFormant1);
      bodyFormant1.connect(bodyFormant2);
      bodyFormant2.connect(motorFilter);
      motorFilter.connect(motorGain);
      motorGain.connect(dryBus);
      motorGain.connect(reverbSend);

      // Stepping IGBT PWM Carrier Whine
      const oscPwm = ctx.createOscillator();
      oscPwm.type = 'triangle';
      oscPwm.frequency.value = 920;

      const pwmFilter = ctx.createBiquadFilter();
      pwmFilter.type = 'bandpass';
      pwmFilter.frequency.value = 1100;
      pwmFilter.Q.value = 4.2;

      const pwmGain = ctx.createGain();
      pwmGain.gain.value = 0;

      oscPwm.connect(pwmFilter);
      pwmFilter.connect(pwmGain);
      pwmGain.connect(dryBus);
      pwmGain.connect(reverbSend);

      osc1.start();
      osc2.start();
      oscGear.start();
      shimmerLfo.start();
      oscPwm.start();

      this.motorOscFundamental = osc1;
      this.motorOscHarmonic = osc2;
      this.motorOscGearbox = oscGear;
      this.motorOscPwm = oscPwm;
      this.motorFilter = motorFilter;
      this.motorGain = motorGain;
      this.pwmFilter = pwmFilter;
      this.pwmGain = pwmGain;

      // --- Layer 2: Auxiliary 50Hz Static Converter & Cabin HVAC Airflow ---
      const auxOsc = ctx.createOscillator();
      auxOsc.type = 'sine';
      auxOsc.frequency.value = 100;
      const auxAirSrc = ctx.createBufferSource();
      auxAirSrc.buffer = brownBuf;
      auxAirSrc.loop = true;
      const auxAirFilter = ctx.createBiquadFilter();
      auxAirFilter.type = 'bandpass';
      auxAirFilter.frequency.value = 260;
      auxAirFilter.Q.value = 1.0;

      const auxOscGain = ctx.createGain();
      auxOscGain.gain.value = 0.25;
      const auxGain = ctx.createGain();
      auxGain.gain.value = 0;

      auxOsc.connect(auxOscGain);
      auxOscGain.connect(auxGain);
      auxAirSrc.connect(auxAirFilter);
      auxAirFilter.connect(auxGain);
      auxGain.connect(dryBus);

      auxOsc.start();
      auxAirSrc.start();
      this.auxGain = auxGain;

      // --- Layer 3A: Iconic Hollow Rubber-Tired Michelin Rollway Resonance ---
      const tireSrc = ctx.createBufferSource();
      tireSrc.buffer = pinkBuf;
      tireSrc.loop = true;

      const tireCavityFilter = ctx.createBiquadFilter();
      tireCavityFilter.type = 'bandpass';
      tireCavityFilter.frequency.value = 130;
      tireCavityFilter.Q.value = 2.6;

      const tireCavityGain = ctx.createGain();
      tireCavityGain.gain.value = 0;

      tireSrc.connect(tireCavityFilter);
      tireCavityFilter.connect(tireCavityGain);
      tireCavityGain.connect(dryBus);
      tireCavityGain.connect(reverbSend);
      tireSrc.start();

      this.tireCavityFilter = tireCavityFilter;
      this.tireCavityGain = tireCavityGain;

      // --- Layer 3B: Deep Concrete Guideway Bogie Sub-Rumble ---
      const rumbleSrc = ctx.createBufferSource();
      rumbleSrc.buffer = brownBuf;
      rumbleSrc.loop = true;

      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 95;
      rumbleFilter.Q.value = 1.2;

      const rumbleGain = ctx.createGain();
      rumbleGain.gain.value = 0;

      rumbleSrc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(dryBus);
      rumbleSrc.start();

      this.rumbleFilter = rumbleFilter;
      this.rumbleGain = rumbleGain;

      // --- Layer 4: Tunnel Air-Piston Whoosh with Speed-Synced Tunnel Rib Flutter ---
      const windSrc = ctx.createBufferSource();
      windSrc.buffer = pinkBuf;
      windSrc.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 420;
      windFilter.Q.value = 0.9;

      const windFlutterVca = ctx.createGain();
      windFlutterVca.gain.value = 1.0;

      const ribFlutterOsc = ctx.createOscillator();
      ribFlutterOsc.type = 'sine';
      ribFlutterOsc.frequency.value = 1.2;
      const ribFlutterDepth = ctx.createGain();
      ribFlutterDepth.gain.value = 0.28;
      ribFlutterOsc.connect(ribFlutterDepth);
      ribFlutterDepth.connect(windFlutterVca.gain);

      const windBaseGain = ctx.createGain();
      windBaseGain.gain.value = 0;

      windSrc.connect(windFilter);
      windFilter.connect(windFlutterVca);
      windFlutterVca.connect(windBaseGain);
      windBaseGain.connect(dryBus);
      windBaseGain.connect(reverbSend);

      windSrc.start();
      ribFlutterOsc.start();

      this.windFilter = windFilter;
      this.windBaseGain = windBaseGain;
      this.ribFlutterOsc = ribFlutterOsc;
      this.ribFlutterDepth = ribFlutterDepth;

      // --- Layer 5: Subtle Composite Brake-Pad Friction Whisper (<24 km/h) ---
      const brakeSrc = ctx.createBufferSource();
      brakeSrc.buffer = pinkBuf;
      brakeSrc.loop = true;

      const brakeWhisperFilter = ctx.createBiquadFilter();
      brakeWhisperFilter.type = 'bandpass';
      brakeWhisperFilter.frequency.value = 2850;
      brakeWhisperFilter.Q.value = 18;

      const brakeWhisperGain = ctx.createGain();
      brakeWhisperGain.gain.value = 0;

      brakeSrc.connect(brakeWhisperFilter);
      brakeWhisperFilter.connect(brakeWhisperGain);
      brakeWhisperGain.connect(dryBus);
      brakeWhisperGain.connect(reverbSend);
      brakeSrc.start();

      this.brakeWhisperFilter = brakeWhisperFilter;
      this.brakeWhisperGain = brakeWhisperGain;

      // --- Layer 6: Vaulted Station Platform Murmur & Ventilation (opens with doors) ---
      const stationSrc = ctx.createBufferSource();
      stationSrc.buffer = pinkBuf;
      stationSrc.loop = true;

      const stationFilter = ctx.createBiquadFilter();
      stationFilter.type = 'bandpass';
      stationFilter.frequency.value = 540;
      stationFilter.Q.value = 0.8;

      const stationAmbienceGain = ctx.createGain();
      stationAmbienceGain.gain.value = 0;

      stationSrc.connect(stationFilter);
      stationFilter.connect(stationAmbienceGain);
      stationAmbienceGain.connect(reverbSend);
      stationSrc.start();

      this.stationAmbienceGain = stationAmbienceGain;

      // --- Layer 7: Weather Environmental Ambience (Rain Pitter-Patter + Fog/Clear Wind) ---
      const rainSrc = ctx.createBufferSource();
      rainSrc.buffer = pinkBuf;
      rainSrc.loop = true;

      const rainFilter = ctx.createBiquadFilter();
      rainFilter.type = 'bandpass';
      rainFilter.frequency.value = 2100;
      rainFilter.Q.value = 0.7;

      const rainGain = ctx.createGain();
      rainGain.gain.value = 0;

      rainSrc.connect(rainFilter);
      rainFilter.connect(rainGain);
      rainGain.connect(dryBus);
      rainSrc.start();

      const envWindSrc = ctx.createBufferSource();
      envWindSrc.buffer = brownBuf;
      envWindSrc.loop = true;

      const envWindFilter = ctx.createBiquadFilter();
      envWindFilter.type = 'lowpass';
      envWindFilter.frequency.value = 420;
      envWindFilter.Q.value = 0.85;

      const envWindGain = ctx.createGain();
      envWindGain.gain.value = 0;

      envWindSrc.connect(envWindFilter);
      envWindFilter.connect(envWindGain);
      envWindGain.connect(dryBus);
      envWindGain.connect(reverbSend);
      envWindSrc.start();

      this.rainFilter = rainFilter;
      this.rainGain = rainGain;
      this.envWindFilter = envWindFilter;
      this.envWindGain = envWindGain;

      this.initialized = true;
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.54, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public silenceLoops(): void {
    if (
      !this.ctx ||
      !this.motorGain ||
      !this.pwmGain ||
      !this.auxGain ||
      !this.tireCavityGain ||
      !this.rumbleGain ||
      !this.windBaseGain ||
      !this.brakeWhisperGain ||
      !this.stationAmbienceGain ||
      !this.rainGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    this.motorGain.gain.setTargetAtTime(0, now, 0.06);
    this.pwmGain.gain.setTargetAtTime(0, now, 0.06);
    this.auxGain.gain.setTargetAtTime(0, now, 0.08);
    this.tireCavityGain.gain.setTargetAtTime(0, now, 0.06);
    this.rumbleGain.gain.setTargetAtTime(0, now, 0.06);
    this.windBaseGain.gain.setTargetAtTime(0, now, 0.06);
    this.brakeWhisperGain.gain.setTargetAtTime(0, now, 0.05);
    this.stationAmbienceGain.gain.setTargetAtTime(0, now, 0.12);
    this.rainGain.gain.setTargetAtTime(0, now, 0.08);
    if (this.envWindGain) {
      this.envWindGain.gain.setTargetAtTime(0, now, 0.08);
    }
  }

  /**
   * Real-time acoustic modulation across all 7 continuous layers + physical edge triggers
   * (portal pressure boom, bogie joint thumps, pneumatic stop-hold exhaust, ATP overspeed chirp).
   */
  public updateContinuous(
    speedKmh: number,
    lever: number,
    isPlaying: boolean,
    rainIntensity: number,
    options?: {
      trainX?: number;
      inStation?: boolean;
      isOutdoor?: boolean;
      weather?: WeatherType;
      weatherIntensity?: number;
      trackMeta?: RouteTrackMetadata;
      doorOpenProgress?: number;
      isOverspeeding?: boolean;
      perspective?: AudioPerspective;
      lineMode?: LineMode;
      dt?: number;
    }
  ): void {
    if (
      !this.ctx ||
      !this.motorOscFundamental ||
      !this.motorOscHarmonic ||
      !this.motorOscGearbox ||
      !this.motorOscPwm ||
      !this.motorFilter ||
      !this.motorGain ||
      !this.pwmFilter ||
      !this.pwmGain ||
      !this.auxGain ||
      !this.tireCavityFilter ||
      !this.tireCavityGain ||
      !this.rumbleFilter ||
      !this.rumbleGain ||
      !this.windFilter ||
      !this.windBaseGain ||
      !this.ribFlutterOsc ||
      !this.ribFlutterDepth ||
      !this.brakeWhisperFilter ||
      !this.brakeWhisperGain ||
      !this.stationAmbienceGain ||
      !this.rainFilter ||
      !this.rainGain ||
      !this.reverbSend ||
      !this.perspectiveFilter
    ) {
      return;
    }

    if (!isPlaying || this.muted) {
      this.silenceLoops();
      return;
    }

    const now = this.ctx.currentTime;
    const trainX = options?.trainX ?? 0;
    const inStation = options?.inStation ?? false;
    const isOutdoor = options?.isOutdoor ?? false;
    const doorOpenProgress = options?.doorOpenProgress ?? 0;
    const isOverspeeding = options?.isOverspeeding ?? false;
    const perspective = options?.perspective ?? 'cab';
    const lineMode = options?.lineMode ?? 'metro14';
    const weather: WeatherType =
      options?.weather ?? (rainIntensity > 0.05 ? 'rain' : 'clear');
    const weatherIntensity = options?.weatherIntensity ?? rainIntensity;
    const trackMeta = options?.trackMeta ?? getLineDefinition(lineMode).trackMeta;
    const dt = options?.dt ?? 0.016;

    const ac = computeTractionAcoustics(speedKmh, lever, inStation, perspective, lineMode);
    const weatherAmb = computeWeatherAmbience({
      weather,
      weatherIntensity,
      speedKmh,
      inStation,
      isOutdoor,
      perspective,
    });

    // 1. Multi-Stage VVVF Inverter & Helical Gearbox
    this.motorOscFundamental.frequency.setTargetAtTime(ac.fundamentalHz, now, 0.055);
    this.motorOscHarmonic.frequency.setTargetAtTime(ac.harmonicHz, now, 0.055);
    this.motorOscGearbox.frequency.setTargetAtTime(ac.gearboxHz, now, 0.055);
    this.motorOscPwm.frequency.setTargetAtTime(ac.pwmCarrierHz, now, 0.04);

    this.motorFilter.frequency.setTargetAtTime(
      lever < -0.05 ? 1680 : 1180 + Math.min(1, speedKmh / (lineMode === 'rerA' ? 125 : 85)) * 740,
      now,
      0.08
    );
    this.motorGain.gain.setTargetAtTime(ac.motorGain, now, 0.075);
    this.pwmFilter.frequency.setTargetAtTime(ac.pwmCarrierHz, now, 0.05);
    this.pwmGain.gain.setTargetAtTime(ac.pwmGain, now, 0.07);

    // 2. Idle Auxiliary Static Converter & Cabin HVAC Airflow
    this.auxGain.gain.setTargetAtTime(lineMode === 'rerA' ? 0.028 : 0.024, now, 0.22);

    // 3. MP14 Rubber Tire Cavity vs. RER A Steel Rail Flange Roll + Sub-Rumble
    this.tireCavityFilter.frequency.setTargetAtTime(ac.tireCavityFreqHz, now, 0.08);
    this.tireCavityGain.gain.setTargetAtTime(
      lineMode === 'rerA' ? ac.steelRailGain : ac.tireCavityGain,
      now,
      0.08
    );
    this.rumbleFilter.frequency.setTargetAtTime(ac.rumbleFreqHz, now, 0.08);
    this.rumbleGain.gain.setTargetAtTime(ac.rumbleGain, now, 0.08);

    // 4. Tunnel Air-Piston Whoosh + Speed-Locked Tunnel Rib Flutter
    this.windFilter.frequency.setTargetAtTime(ac.tunnelWindFreqHz, now, 0.09);
    this.windBaseGain.gain.setTargetAtTime(ac.tunnelWindGain, now, 0.12);
    this.ribFlutterOsc.frequency.setTargetAtTime(ac.ribFlutterHz, now, 0.08);
    this.ribFlutterDepth.gain.setTargetAtTime(inStation ? 0.06 : 0.34, now, 0.15);

    // 5. Composite Brake-Pad Friction Whisper while braking into platform
    this.brakeWhisperFilter.frequency.setTargetAtTime(
      2650 + Math.min(1, speedKmh / 24) * 520,
      now,
      0.08
    );
    this.brakeWhisperGain.gain.setTargetAtTime(ac.brakeWhisperGain, now, 0.08);

    // 6. Vaulted Station Platform Murmur (swells warmly when doors slide open)
    const stationOpenAmb = inStation ? 0.012 + doorOpenProgress * 0.048 : 0;
    this.stationAmbienceGain.gain.setTargetAtTime(stationOpenAmb, now, 0.25);

    // 7. Cavern Reverb Send & Cab Acoustic Glazing Filter (tighter reverberation outdoors)
    const outdoorReverbScale = isOutdoor ? 0.42 : 1.0;
    this.reverbSend.gain.setTargetAtTime(ac.reverbWet * outdoorReverbScale, now, 0.18);
    this.perspectiveFilter.frequency.setTargetAtTime(ac.perspectiveCutoffHz, now, 0.12);

    // 8. Dynamic Weather Ambience (Clear Breeze / Fog Mist / Rain Pitter-Patter + Thunder Rolls)
    this.rainFilter.frequency.setTargetAtTime(weatherAmb.rainFilterFreqHz, now, 0.15);
    this.rainGain.gain.setTargetAtTime(weatherAmb.rainPitterGain, now, 0.2);

    if (this.envWindFilter && this.envWindGain) {
      const targetWindFreq =
        weather === 'fog' ? weatherAmb.mistFreqHz : weatherAmb.breezeFreqHz;
      const targetWindGain =
        weather === 'fog'
          ? weatherAmb.mistGain + weatherAmb.breezeGain * 0.5
          : weatherAmb.breezeGain + weatherAmb.mistGain * 0.4;
      this.envWindFilter.frequency.setTargetAtTime(targetWindFreq, now, 0.22);
      this.envWindGain.gain.setTargetAtTime(targetWindGain, now, 0.25);
    }

    if (weatherAmb.thunderGain > 0.01) {
      this.thunderCooldownSec -= dt;
      if (this.thunderCooldownSec <= 0) {
        this.thunderCooldownSec = 9 + Math.random() * 8;
        this.playThunderRoll(weatherAmb.thunderGain);
      }
    }

    // 9. Tunnel Portal Crossing Aerodynamic Pressure-Wave Boom!
    if (inStation !== this.prevInStation && speedKmh > 14 && !isOutdoor) {
      this.playPortalPressureWave(speedKmh, !inStation);
    }
    this.prevInStation = inStation;

    // 10. Speed & Route-Metadata-Driven Rhythmic Track-Click Over Track Joints
    const clickEval = computeTrackClickCadence({
      trainX,
      lastJointBucket: this.lastJointBucket,
      speedKmh,
      trackMeta,
      isOutdoor,
      inStation,
    });
    if (clickEval.triggered) {
      this.lastJointBucket = clickEval.jointBucket;
      this.playTrackClick({
        speedKmh,
        trackMeta,
        isOutdoor,
        inStation,
      });
    } else if (speedKmh <= 4) {
      this.lastJointBucket = clickEval.jointBucket;
    }

    // 11. Pneumatic Holding-Brake Exhaust Hiss when smoothly stopping at 0 km/h
    if (this.prevSpeedKmh > 0.75 && speedKmh <= 0.35 && lever < -0.05) {
      this.playBrakeStopHiss();
    }
    this.prevSpeedKmh = speedKmh;

    // 12. Subtle Cab ATP Overspeed Double-Chirp
    this.overspeedBeepCooldown = Math.max(0, this.overspeedBeepCooldown - dt);
    if (isOverspeeding && this.overspeedBeepCooldown <= 0) {
      this.overspeedBeepCooldown = 1.65;
      this.playOverspeedAlert();
    }
  }

  /** Aerodynamic pressure-wave sub-thump when plunging into or bursting out of a tunnel portal */
  private playPortalPressureWave(speedKmh: number, enteringTunnel: boolean): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || !this.brownNoiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const scale = Math.min(1, speedKmh / 65);

    // Low-frequency air-compression thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(enteringTunnel ? 62 : 48, now);
    osc.frequency.exponentialRampToValueAtTime(24, now + 0.32);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18 * scale, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.38);

    osc.connect(gain);
    gain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.42);

    // Passing portal air-shear whoosh
    const src = this.ctx.createBufferSource();
    src.buffer = this.brownNoiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(enteringTunnel ? 360 : 520, now);
    f.frequency.exponentialRampToValueAtTime(140, now + 0.45);
    f.Q.value = 1.1;

    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.14 * scale, now + 0.06);
    ng.gain.exponentialRampToValueAtTime(0.0008, now + 0.5);

    src.connect(f);
    f.connect(ng);
    ng.connect(this.dryBus);
    ng.connect(this.reverbSend);
    src.start(now, Math.random() * 1.5, 0.55);
  }

  /**
   * Rhythmic wheel-over-joint "track-click" effect scaled dynamically by train speed
   * and the active route's track metadata (pneumatic expansion joint vs steel fishplate double-clack).
   */
  public playTrackClick(params: {
    speedKmh: number;
    trackMeta: RouteTrackMetadata;
    isOutdoor?: boolean;
    inStation?: boolean;
  }): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || this.muted) return;
    const { speedKmh, trackMeta, isOutdoor = false, inStation = false } = params;
    const cadence = computeTrackClickCadence({
      trainX: trackMeta.jointIntervalM,
      lastJointBucket: 0,
      speedKmh,
      trackMeta,
      isOutdoor,
      inStation,
    });
    const now = this.ctx.currentTime;

    for (const delay of [0, cadence.axleDelaySec]) {
      const t = now + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = cadence.isMetallic ? 'triangle' : 'sine';
      const jitter = 0.94 + Math.random() * 0.12;
      osc.frequency.setValueAtTime(cadence.toneHz * jitter, t);
      osc.frequency.exponentialRampToValueAtTime(
        cadence.isMetallic ? 56 : 32,
        t + cadence.decaySec * 0.75
      );

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(cadence.intensity, t + (cadence.isMetallic ? 0.004 : 0.007));
      gain.gain.exponentialRampToValueAtTime(0.0005, t + cadence.decaySec);

      osc.connect(gain);
      gain.connect(this.dryBus);

      if (cadence.isMetallic || cadence.reverbRatio > 0.35) {
        const revTap = this.ctx.createGain();
        revTap.gain.value = cadence.reverbRatio;
        gain.connect(revTap);
        revTap.connect(this.reverbSend);
      }

      osc.start(t);
      osc.stop(t + cadence.decaySec + 0.015);

      // High-frequency steel flange click transient on steel ballast corridors
      if (cadence.isMetallic && this.noiseBuffer) {
        const clickSrc = this.ctx.createBufferSource();
        clickSrc.buffer = this.noiseBuffer;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'bandpass';
        hp.frequency.value = 1850 + Math.random() * 350;
        hp.Q.value = 2.4;

        const cg = this.ctx.createGain();
        cg.gain.setValueAtTime(0.001, t);
        cg.gain.linearRampToValueAtTime(cadence.intensity * 0.52, t + 0.002);
        cg.gain.exponentialRampToValueAtTime(0.0005, t + 0.026);

        clickSrc.connect(hp);
        hp.connect(cg);
        cg.connect(this.dryBus);
        clickSrc.start(t, Math.random() * 1.2, 0.032);
      }
    }
  }

  /** Subtle distant low-frequency thunder roll synthesized when rain weather ambience is active */
  private playThunderRoll(peakGain: number): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || !this.brownNoiseBuffer || this.muted) {
      return;
    }
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.brownNoiseBuffer;

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(135, now);
    lp.frequency.exponentialRampToValueAtTime(48, now + 2.4);
    lp.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0008, now);
    gain.gain.linearRampToValueAtTime(Math.min(0.22, peakGain), now + 0.28);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 2.8);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbSend);
    src.start(now, Math.random() * 1.0, 2.9);
  }

  /** Authentic pneumatic holding-brake exhaust hiss right as the train settles to 0 km/h */
  private playBrakeStopHiss(): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(880, now + 0.48);
    filter.Q.value = 1.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.52);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbSend);
    src.start(now, Math.random() * 1.5, 0.56);
  }

  /** Tactile mechanical master-controller detent click on lever notch crossing */
  public playLeverClick(): void {
    if (!this.ctx || !this.dryBus || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(185, now + 0.024);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.036);
  }

  /** Subtle Parisian ATP cab overspeed double-chirp */
  private playOverspeedAlert(): void {
    if (!this.ctx || !this.dryBus || this.muted) return;
    const now = this.ctx.currentTime;
    for (const offset of [0, 0.13]) {
      const start = now + offset;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1480;

      gain.gain.setValueAtTime(0.0005, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0005, start + 0.09);

      osc.connect(gain);
      gain.connect(this.dryBus);
      osc.start(start);
      osc.stop(start + 0.1);
    }
  }

  /** Warm reverberant Parisian RATP electric-vibraphone station arrival chime */
  public playArrivalChime(): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.dryBus || !this.reverbSend) return;
      const start = now + idx * 0.145;

      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = freq;

      // Subtle detuned bell partial for authentic celesta/vibraphone warmth
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.value = freq * 2.002;
      const partialGain = this.ctx.createGain();
      partialGain.gain.value = 0.14;

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.11, start + 0.014);
      env.gain.exponentialRampToValueAtTime(0.0001, start + 0.82);

      osc1.connect(env);
      osc2.connect(partialGain);
      partialGain.connect(env);
      env.connect(this.dryBus);
      env.connect(this.reverbSend);

      osc1.start(start);
      osc2.start(start);
      osc1.stop(start + 0.85);
      osc2.stop(start + 0.85);
    });
  }

  /**
   * Authentic Paris Metro RATP "Ronfleur" door-closing buzzer (Line 14)
   * or RER A MI09 alternating 2-tone SNCF/RATP warning chime + buzzer.
   */
  public playDoorClosingBuzzer(lineMode: LineMode = 'metro14'): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || this.muted) return;
    const now = this.ctx.currentTime;

    if (lineMode === 'rerA') {
      // Distinctive RER A MI09 alternating bi-tone warning (G#5 -> E5 -> G#5 -> E5)
      const notes = [830.6, 659.25, 830.6, 659.25];
      notes.forEach((freq, idx) => {
        if (!this.ctx || !this.dryBus || !this.reverbSend) return;
        const start = now + idx * 0.36;
        const osc = this.ctx.createOscillator();
        const over = this.ctx.createOscillator();
        osc.type = 'triangle';
        over.type = 'sine';
        osc.frequency.value = freq;
        over.frequency.value = freq * 2;
        const overG = this.ctx.createGain();
        overG.gain.value = 0.25;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0001, start);
        env.gain.linearRampToValueAtTime(0.125, start + 0.015);
        env.gain.setValueAtTime(0.11, start + 0.26);
        env.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);

        osc.connect(env);
        over.connect(overG);
        overG.connect(env);
        env.connect(this.dryBus);
        env.connect(this.reverbSend);
        osc.start(start);
        over.start(start);
        osc.stop(start + 0.35);
        over.stop(start + 0.35);
      });
      return;
    }

    const dur = 1.52;

    const oscBase = this.ctx.createOscillator();
    const oscDetune = this.ctx.createOscillator();
    const oscThird = this.ctx.createOscillator();
    oscBase.type = 'sawtooth';
    oscDetune.type = 'square';
    oscThird.type = 'sawtooth';

    // Real RATP ronfleur hovers right around 464 Hz (B♭4) with strong 3rd harmonic horn bite
    oscBase.frequency.value = 464;
    oscDetune.frequency.value = 468.5;
    oscThird.frequency.value = 1392;

    const thirdGain = this.ctx.createGain();
    thirdGain.gain.value = 0.34;

    // Dual nasal metallic horn formants (1150 Hz + 2050 Hz)
    const hornBand1 = this.ctx.createBiquadFilter();
    hornBand1.type = 'bandpass';
    hornBand1.frequency.value = 1180;
    hornBand1.Q.value = 2.8;

    const hornPeak = this.ctx.createBiquadFilter();
    hornPeak.type = 'peaking';
    hornPeak.frequency.value = 2050;
    hornPeak.Q.value = 3.0;
    hornPeak.gain.value = 5.5;

    // 28 Hz electromagnetic diaphragm vibration amplitude modulation
    const reedVca = this.ctx.createGain();
    reedVca.gain.value = 0.82;
    const reedLfo = this.ctx.createOscillator();
    reedLfo.type = 'sine';
    reedLfo.frequency.value = 28;
    const reedDepth = this.ctx.createGain();
    reedDepth.gain.value = 0.18;
    reedLfo.connect(reedDepth);
    reedDepth.connect(reedVca.gain);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.14, now + 0.025);
    env.gain.setValueAtTime(0.135, now + dur - 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    oscBase.connect(hornBand1);
    oscDetune.connect(hornBand1);
    oscThird.connect(thirdGain);
    thirdGain.connect(hornBand1);

    hornBand1.connect(hornPeak);
    hornPeak.connect(reedVca);
    reedVca.connect(env);
    env.connect(this.dryBus);
    env.connect(this.reverbSend);

    oscBase.start(now);
    oscDetune.start(now);
    oscThird.start(now);
    reedLfo.start(now);

    oscBase.stop(now + dur + 0.04);
    oscDetune.stop(now + dur + 0.04);
    oscThird.stop(now + dur + 0.04);
    reedLfo.stop(now + dur + 0.04);
  }

  /** Multi-stage pneumatic door mechanism: latch unlock clack + air actuator slide + rubber gasket thud */
  public playDoorSlide(): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. Mechanical pneumatic latch unlock clack
    const latch = this.ctx.createOscillator();
    const latchGain = this.ctx.createGain();
    latch.type = 'triangle';
    latch.frequency.setValueAtTime(340, now);
    latch.frequency.exponentialRampToValueAtTime(88, now + 0.055);
    latchGain.gain.setValueAtTime(0.1, now);
    latchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    latch.connect(latchGain);
    latchGain.connect(this.dryBus);
    latch.start(now);
    latch.stop(now + 0.075);

    // 2. Pressurized actuator rail slide (train + PSD doors synchronized)
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1450, now + 0.04);
    filter.frequency.linearRampToValueAtTime(2150, now + 0.45);
    filter.frequency.linearRampToValueAtTime(1180, now + 0.92);
    filter.Q.value = 1.65;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now + 0.03);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.14);
    gain.gain.setValueAtTime(0.07, now + 0.68);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.98);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.dryBus);
    gain.connect(this.reverbSend);
    src.start(now + 0.03, Math.random() * 1.4, 1.02);

    // 3. Soft heavy rubber-gasket end-of-travel thud
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(104, now + 0.9);
    thud.frequency.exponentialRampToValueAtTime(38, now + 1.02);
    thudGain.gain.setValueAtTime(0.001, now + 0.9);
    thudGain.gain.linearRampToValueAtTime(0.095, now + 0.915);
    thudGain.gain.exponentialRampToValueAtTime(0.0005, now + 1.05);
    thud.connect(thudGain);
    thudGain.connect(this.dryBus);
    thud.start(now + 0.9);
    thud.stop(now + 1.08);
  }

  /** Dramatic high-pressure main-pipe air dump + bogie jolt on Emergency Brake */
  public playEmergencyBrake(): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    const airSrc = this.ctx.createBufferSource();
    airSrc.buffer = this.noiseBuffer;

    const airFilter = this.ctx.createBiquadFilter();
    airFilter.type = 'bandpass';
    airFilter.frequency.setValueAtTime(2950, now);
    airFilter.frequency.exponentialRampToValueAtTime(540, now + 1.05);
    airFilter.Q.value = 0.85;

    const airGain = this.ctx.createGain();
    airGain.gain.setValueAtTime(0.001, now);
    airGain.gain.linearRampToValueAtTime(0.28, now + 0.018);
    airGain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

    airSrc.connect(airFilter);
    airFilter.connect(airGain);
    airGain.connect(this.dryBus);
    airGain.connect(this.reverbSend);
    airSrc.start(now, 0, 1.2);

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(105, now + 0.44);
    oscGain.gain.setValueAtTime(0.13, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(oscGain);
    oscGain.connect(this.dryBus);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  /** Authentic Parisian MP14 dual-tone brassy cab warning klaxon with underground tunnel reverb */
  public playCabHorn(): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || this.muted) return;
    const now = this.ctx.currentTime;
    const freqs = [392.0, 493.88]; // G4 + B4 French transit bi-tone klaxon

    for (const freq of freqs) {
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq * 0.982, now);
      osc.frequency.linearRampToValueAtTime(freq, now + 0.035);

      sub.type = 'triangle';
      sub.frequency.value = freq * 2;
      const subGain = this.ctx.createGain();
      subGain.gain.value = 0.22;

      filter.type = 'lowpass';
      filter.frequency.value = 1480;
      filter.Q.value = 1.65;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.115, now + 0.028);
      gain.gain.setValueAtTime(0.105, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);

      osc.connect(filter);
      sub.connect(subGain);
      subGain.connect(filter);
      filter.connect(gain);
      gain.connect(this.dryBus);
      gain.connect(this.reverbSend);

      osc.start(now);
      sub.start(now);
      osc.stop(now + 0.62);
      sub.stop(now + 0.62);
    }
  }

  /** Crisp automated speed camera xenon strobe discharge + mechanical shutter + radar alert chime */
  public playSpeedCameraFlash(): void {
    if (!this.ctx || !this.dryBus || !this.reverbSend || !this.noiseBuffer || this.muted) return;
    const now = this.ctx.currentTime;

    // 1. High-voltage xenon flash capacitor pop + shutter snap
    const popOsc = this.ctx.createOscillator();
    const popGain = this.ctx.createGain();
    popOsc.type = 'triangle';
    popOsc.frequency.setValueAtTime(1950, now);
    popOsc.frequency.exponentialRampToValueAtTime(140, now + 0.045);
    popGain.gain.setValueAtTime(0.16, now);
    popGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.055);
    popOsc.connect(popGain);
    popGain.connect(this.dryBus);
    popOsc.start(now);
    popOsc.stop(now + 0.06);

    // Filtered crisp shutter transient
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this.noiseBuffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3400;
    bp.Q.value = 1.4;
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.001, now);
    ng.gain.linearRampToValueAtTime(0.14, now + 0.008);
    ng.gain.exponentialRampToValueAtTime(0.0005, now + 0.14);
    noiseSrc.connect(bp);
    bp.connect(ng);
    ng.connect(this.dryBus);
    ng.connect(this.reverbSend);
    noiseSrc.start(now, Math.random() * 1.2, 0.16);

    // 2. Cab SAET radar infraction descending double-beep
    const tones = [1760, 1174.66];
    tones.forEach((freq, idx) => {
      if (!this.ctx || !this.dryBus) return;
      const t = now + 0.06 + idx * 0.11;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0005, t);
      gain.gain.linearRampToValueAtTime(0.085, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.1);
      osc.connect(gain);
      gain.connect(this.dryBus);
      osc.start(t);
      osc.stop(t + 0.11);
    });
  }
}
