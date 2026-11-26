import test from 'node:test';
import assert from 'node:assert/strict';
import { STATIONS } from './constants';
import { buildEcoSnapshot } from './ecoEnergy';
import {
  getDirectedRoute,
  getLineDefinition,
  getSpeedLimitAtForRoute,
  isPositionOutdoor,
} from './lines';
import { getSpeedCamerasForLine, SPEED_CAMERAS } from './speedCamera';
import {
  buildHudSnapshot,
  calculateMoodFinalBonus,
  calculateStationScore,
  canCloseDoors,
  canOpenDoors,
  CLEAR_TRACK_FRICTION_MULTIPLIER,
  computeFinalGrade,
  createInitialState,
  cycleWeather,
  derivePassengerMood,
  FOG_TRACK_FRICTION_MULTIPLIER,
  getAlignmentTolerances,
  requestCloseDoors,
  requestOpenDoors,
  setLever,
  setRushHourPeriod,
  setWeather,
  stepSimulation,
  triggerEmergencyBrake,
  WET_BRAKING_GRIP_MULTIPLIER,
} from './engine';

test('train accelerates smoothly on throttle and coasts naturally with drag', () => {
  const state = createInitialState('playing');
  setLever(state, 0.8);

  for (let i = 0; i < 60; i++) {
    stepSimulation(state, 0.05);
  }
  const speedAfterAccel = state.speedMs;
  assert.ok(speedAfterAccel > 2.5, 'train should build speed under throttle');
  assert.ok(state.trainX > 3, 'train should move forward');

  // Coasting should gradually slow down the train via drag
  setLever(state, 0);
  for (let i = 0; i < 40; i++) {
    stepSimulation(state, 0.05);
  }
  assert.ok(state.speedMs < speedAfterAccel, 'coasting drag should gently reduce speed');
});

test('doors stay locked while moving or outside alignment zone, and unlock at station stop', () => {
  const state = createInitialState('playing');
  // At Saint-Lazare (trainX = 0), next station is Madeleine (stopX = 540), so outside zone
  assert.equal(canOpenDoors(state), false);

  // Move right onto Madeleine stop mark while still moving
  state.trainX = STATIONS[1].stopX;
  state.speedMs = 5;
  assert.equal(canOpenDoors(state), false, 'doors must remain locked while train is moving');

  // Stop train cleanly inside alignment zone
  state.speedMs = 0;
  assert.equal(canOpenDoors(state), true, 'doors should unlock when stopped at Madeleine');

  const opened = requestOpenDoors(state);
  assert.equal(opened, true);
  assert.equal(state.doorState, 'opening');
  assert.ok(state.score > 0, 'opening doors at station should award stop points');

  // Cannot close doors until boarding completes
  assert.equal(canCloseDoors(state), false);
  for (let i = 0; i < 200; i++) {
    stepSimulation(state, 0.05);
  }
  assert.equal(state.boardingComplete, true);
  assert.equal(canCloseDoors(state), true);

  // Closing triggers warning buzzer then slides shut and advances to Pyramides
  assert.equal(requestCloseDoors(state), true);
  assert.equal(state.doorState, 'closing_warning');
  assert.equal(state.events.doorClosingBuzzer, true);

  for (let i = 0; i < 100; i++) {
    stepSimulation(state, 0.05);
  }
  assert.equal(state.doorState, 'closed');
  assert.equal(state.nextStationIndex, 2, 'should advance to Pyramides after closing doors');
});

test('passenger mood tracks harsh braking, excess dwell time, and influences final score', () => {
  assert.equal(derivePassengerMood(85), 'happy');
  assert.equal(derivePassengerMood(60), 'neutral');
  assert.equal(derivePassengerMood(30), 'annoyed');

  // Emergency braking drops comfort & mood
  const state = createInitialState('playing');
  state.speedMs = 15;
  const comfortBefore = state.comfort;
  triggerEmergencyBrake(state);
  assert.ok(state.comfort < comfortBefore, 'emergency brake should reduce comfort');

  // Excess dwell time after boarding completes drains passenger comfort
  const dwellState = createInitialState('playing');
  dwellState.trainX = STATIONS[1].stopX;
  dwellState.speedMs = 0;
  requestOpenDoors(dwellState);
  for (let i = 0; i < 160; i++) {
    stepSimulation(dwellState, 0.05); // finish boarding
  }
  assert.equal(dwellState.boardingComplete, true);
  const comfortAfterBoard = dwellState.comfort;
  // Leave doors open for 10 more seconds
  for (let i = 0; i < 200; i++) {
    stepSimulation(dwellState, 0.05);
  }
  assert.ok(dwellState.comfort < comfortAfterBoard, 'excess dwell time should lower passenger comfort');
  assert.equal(dwellState.moodReason, 'Long dwell time');

  // Mood bonus influences final score
  const happyBonus = calculateMoodFinalBonus(92);
  const annoyedBonus = calculateMoodFinalBonus(30);
  assert.ok(happyBonus.bonus > 0, 'happy mood should grant positive final bonus');
  assert.ok(annoyedBonus.bonus < 0, 'annoyed mood should penalize final score');
});

test('dynamic weather cycles between clear and fog without rain, and fog reduces braking grip', () => {
  const dryState = createInitialState('playing');
  const fogState = createInitialState('playing');

  assert.equal(dryState.weather, 'clear');
  const nextW = cycleWeather(fogState);
  assert.equal(nextW, 'fog');
  assert.equal(fogState.trackFrictionMultiplier, FOG_TRACK_FRICTION_MULTIPLIER);

  // Compare deceleration from identical speed under full service brake
  dryState.speedMs = 18;
  fogState.speedMs = 18;
  setLever(dryState, -0.8);
  setLever(fogState, -0.8);

  for (let i = 0; i < 40; i++) {
    stepSimulation(dryState, 0.05);
    stepSimulation(fogState, 0.05);
  }

  assert.ok(
    fogState.speedMs > dryState.speedMs,
    'damp fog conditions should leave higher speed (longer stopping distance) under equal braking'
  );

  // Cycling again wraps cleanly back to clear (rain removed from active cycle)
  assert.equal(cycleWeather(fogState), 'clear');
});

test('scoring and end-of-line grading awards S grade for clean run at Aéroport d\'Orly', () => {
  const perfect = calculateStationScore(0.4, 1, 95);
  assert.equal(perfect.quality, 'perfect');
  assert.ok(perfect.points >= 850);

  const state = createInitialState('playing');
  state.score = 16000;
  state.comfort = 94;
  state.comfortSum = 940;
  state.comfortSamples = 10;
  state.nextStationIndex = STATIONS.length - 1;
  state.trainX = STATIONS[STATIONS.length - 1].stopX;
  state.speedMs = 0;

  requestOpenDoors(state);
  for (let i = 0; i < 200; i++) {
    stepSimulation(state, 0.05);
  }
  requestCloseDoors(state);
  for (let i = 0; i < 100; i++) {
    stepSimulation(state, 0.05);
  }

  assert.equal(state.phase, 'gameover', 'completing Aéroport d\'Orly should end Line 14');
  const summary = computeFinalGrade(state);
  assert.equal(summary.grade, 'S');
  assert.equal(summary.finalMood, 'happy');
  assert.ok(summary.totalScore > summary.baseScore, 'happy mood bonus should increase totalScore');
});

test('conductor cab perspective projection converges toward vanishing point with depth', async () => {
  const { projectCabPoint } = await import('./cabRenderer');
  const vpX = 720;
  const vpY = 260;
  const focal = 420;

  const nearLeft = projectCabPoint(-2, -2, 5, vpX, vpY, focal);
  const farLeft = projectCabPoint(-2, -2, 50, vpX, vpY, focal);

  assert.ok(nearLeft.scale > farLeft.scale, 'near objects must project larger than far objects');
  assert.ok(nearLeft.x < farLeft.x && farLeft.x < vpX, 'left platform should converge rightward toward vanishing point');
  assert.ok(nearLeft.y > farLeft.y && farLeft.y > vpY, 'floor points below eye height should converge upward toward horizon');
});

test('3D camera pose solver positions Side, Cab, Chase, and Passenger cameras cleanly', async () => {
  const { computeCameraTargetPose } = await import('./three/Metro3DScene');

  const cabSlow = computeCameraTargetPose('cab', 100, 0, 0, 0);
  const cabFast = computeCameraTargetPose('cab', 100, 22, 1.1, 1);
  assert.ok(cabSlow.lookX > cabSlow.posX, 'cab view must look forward along +X track');
  assert.ok(cabFast.fov > cabSlow.fov + 8, 'express speed must dynamically widen cab FOV');
  assert.ok(cabFast.lookY > cabSlow.lookY, 'positive acceleration should subtly lift cab pitch');

  const sidePose = computeCameraTargetPose('side', 100, 10, 0, 0);
  assert.ok(sidePose.posZ > 10, 'side 3D camera must sit on +Z cutaway side looking toward track');

  const chasePose = computeCameraTargetPose('chase', 100, 15, 0, 0);
  assert.ok(chasePose.posX < 100 && chasePose.lookX > 100, 'chase camera trails behind nose and looks ahead');
  assert.ok(chasePose.posZ < 0, 'chase camera sits inside twin-track bore on -Z side');

  const passMetro = computeCameraTargetPose('passenger', 100, 10, 0, 0, 'metro14');
  assert.ok(passMetro.posX < 100 && passMetro.posX > 75, 'MP14 passenger camera sits inside Car 1');
  assert.ok(Math.abs(passMetro.posZ) < 1.24, 'MP14 passenger camera sits inside carriage width');
  assert.ok(passMetro.lookZ > passMetro.posZ + 5, 'MP14 passenger camera looks out +Z side window');

  const passRer = computeCameraTargetPose('passenger', 100, 15, 0, 0, 'rerA');
  assert.ok(passRer.posX < 100 && passRer.posX > 73, 'MI09 passenger camera sits inside Car 1');
  assert.ok(passRer.posY > 2.6 && passRer.posY < 3.5, 'MI09 passenger camera sits on upper deck level');
  assert.ok(passRer.lookZ > passRer.posZ + 5, 'MI09 passenger camera looks out +Z upper-deck window');
});

test('MP14 acoustic solver scales inverter pitch, tire resonance, tunnel flutter, brake whisper, and cab/passenger filtering', async () => {
  const { computeTractionAcoustics } = await import('./audio');

  const idleStation = computeTractionAcoustics(0, 0, true, 'cab');
  const expressTunnel = computeTractionAcoustics(72, 0.9, false, 'side');
  const expressStation = computeTractionAcoustics(72, 0.9, true, 'side');
  const lowSpeedBrake = computeTractionAcoustics(14, -0.7, true, 'cab');
  const passengerCruise = computeTractionAcoustics(60, 0.4, false, 'passenger');

  assert.ok(expressTunnel.fundamentalHz > idleStation.fundamentalHz * 2, 'inverter pitch must rise significantly at express speed');
  assert.ok(expressTunnel.gearboxHz > idleStation.gearboxHz * 3, 'helical gearbox frequency must track speed');
  assert.ok(expressTunnel.tireCavityGain > 0.15, 'rubber-tired rollway resonance must engage strongly at express speed');
  assert.ok(expressTunnel.ribFlutterHz > expressStation.ribFlutterHz * 2, 'tunnel rib-pass flutter LFO must accelerate inside TBM tunnel');
  assert.ok(expressTunnel.tunnelWindGain > expressStation.tunnelWindGain * 2, 'narrow tunnel must amplify aerodynamic air-piston whoosh vs open station');
  assert.ok(expressStation.reverbWet > expressTunnel.reverbWet, 'vaulted stations should have richer cavern reverb than tight tunnel');
  assert.ok(lowSpeedBrake.brakeWhisperGain > 0 && expressTunnel.brakeWhisperGain === 0, 'composite brake whisper must only engage under low-speed braking');
  assert.ok(lowSpeedBrake.perspectiveCutoffHz < expressTunnel.perspectiveCutoffHz, 'insulated Conductor Cab must apply warmer glazing filter than exterior views');
  assert.ok(
    passengerCruise.perspectiveCutoffHz > lowSpeedBrake.perspectiveCutoffHz &&
      passengerCruise.perspectiveCutoffHz < expressTunnel.perspectiveCutoffHz,
    'passenger carriage glazing filters softly between cab and exterior views'
  );
});

test('dynamic track friction varies across clear, fog, and rain and alters both acceleration and braking distances', () => {
  const clearSt = createInitialState('playing');
  const fogSt = createInitialState('playing');
  const rainSt = createInitialState('playing');

  setWeather(clearSt, 'clear');
  setWeather(fogSt, 'fog');
  setWeather(rainSt, 'rain');

  assert.equal(clearSt.trackFrictionMultiplier, CLEAR_TRACK_FRICTION_MULTIPLIER);
  assert.equal(fogSt.trackFrictionMultiplier, FOG_TRACK_FRICTION_MULTIPLIER);
  assert.equal(rainSt.trackFrictionMultiplier, WET_BRAKING_GRIP_MULTIPLIER);

  // 1) Identical positive traction lever should yield lower speed/distance on wet/fog tracks
  setLever(clearSt, 1.0);
  setLever(fogSt, 1.0);
  setLever(rainSt, 1.0);
  for (let i = 0; i < 60; i++) {
    stepSimulation(clearSt, 0.05);
    stepSimulation(fogSt, 0.05);
    stepSimulation(rainSt, 0.05);
  }
  assert.ok(
    clearSt.speedMs > fogSt.speedMs && fogSt.speedMs > rainSt.speedMs,
    'acceleration speed must decrease cleanly from Clear -> Fog -> Rain due to reduced wheel-track friction'
  );

  // 2) Identical braking from 20 m/s should result in longer stopping distance in Fog & Rain
  const stopTest = (weather: 'clear' | 'fog' | 'rain'): number => {
    const st = createInitialState('playing');
    setWeather(st, weather);
    st.trainX = 100;
    st.speedMs = 20;
    setLever(st, -0.75);
    for (let i = 0; i < 400; i++) {
      stepSimulation(st, 0.05);
      if (st.speedMs <= 0.01) break;
    }
    return st.trainX - 100;
  };

  const clearDist = stopTest('clear');
  const fogDist = stopTest('fog');
  const rainDist = stopTest('rain');

  assert.ok(
    fogDist > clearDist && rainDist > fogDist,
    `stopping distance must grow with lower track friction (clear=${clearDist.toFixed(1)}m, fog=${fogDist.toFixed(1)}m, rain=${rainDist.toFixed(1)}m)`
  );
});

test('speed camera triggers automated overspeed flash and penalty once above limit, and ignores compliant speed', () => {
  const cam = SPEED_CAMERAS[0];

  // Compliant pass: within limit -> no flash, no penalty
  const safeState = createInitialState('playing');
  safeState.trainX = cam.triggerX - 2;
  safeState.speedMs = (cam.limitKmh - 2) / 3.6;
  setLever(safeState, 0);
  stepSimulation(safeState, 0.05);
  assert.equal(safeState.events.speedCameraFlashed, null);
  assert.equal(safeState.speedCameraTickets.length, 0);
  assert.equal(safeState.speedCameraFlashSec, 0);

  // Overspeed pass: exceeds limit + tolerance -> triggers flash, sound event, and deducts penalty points once
  const fastState = createInitialState('playing');
  fastState.score = 1000;
  fastState.trainX = cam.triggerX - 1.5;
  fastState.speedMs = (cam.limitKmh + 14) / 3.6;
  setLever(fastState, 0.5);

  stepSimulation(fastState, 0.1);
  assert.ok(fastState.events.speedCameraFlashed, 'crossing radar gate above speed limit should fire flash event');
  assert.equal(fastState.events.speedCameraFlashed.cameraId, cam.id);
  assert.equal(fastState.speedCameraTickets.length, 1);
  assert.equal(fastState.score, 1000 - cam.penaltyPoints);
  assert.ok(fastState.speedCameraFlashSec > 0.5, 'radar strobe timer should activate on flash');
  assert.ok(fastState.comfort < 100, 'speed camera infraction should reduce passenger comfort');

  // Stepping again right past the same gate must not double-penalize the same camera
  stepSimulation(fastState, 0.1);
  assert.equal(fastState.events.speedCameraFlashed, null);
  assert.equal(fastState.speedCameraTickets.length, 1);
});

test('eco-driving rewards coasting & regenerative braking over sustained heavy throttle', () => {
  const ecoCoast = createInitialState('playing');
  const heavyRun = createInitialState('playing');

  // Bring both up to cruising speed moderately
  setLever(ecoCoast, 0.55);
  setLever(heavyRun, 0.95);
  for (let i = 0; i < 160; i++) {
    stepSimulation(ecoCoast, 0.05);
    stepSimulation(heavyRun, 0.05);
  }

  // Eco driver switches to Coast (0 kW traction), heavy driver keeps slamming >85% notch
  setLever(ecoCoast, 0);
  setLever(heavyRun, 0.95);
  for (let i = 0; i < 120; i++) {
    stepSimulation(ecoCoast, 0.05);
    stepSimulation(heavyRun, 0.05);
  }
  assert.equal(ecoCoast.eco.driveMode, 'COAST');
  assert.ok(
    ecoCoast.eco.efficiencyPct > heavyRun.eco.efficiencyPct,
    `coasting (${ecoCoast.eco.efficiencyPct.toFixed(1)}%) should outperform heavy throttle (${heavyRun.eco.efficiencyPct.toFixed(1)}%)`
  );

  // Service braking above 10 km/h engages regenerative braking (negative kW draw & recovered kWh)
  setLever(ecoCoast, -0.6);
  for (let i = 0; i < 15; i++) {
    stepSimulation(ecoCoast, 0.1);
  }
  const snap = buildEcoSnapshot(ecoCoast.eco);
  assert.equal(snap.driveMode, 'REGEN');
  assert.ok(snap.instantPowerKw < 0, 'regenerative braking must report negative net kW draw');
  assert.ok(snap.regeneratedEnergyKwh > 0, 'regenerative braking must accumulate recovered kWh');
});

test('passenger density Rush Hour increases dwell time, crowd count, and tightens alignment tolerances', () => {
  const normalState = createInitialState('playing');
  const rushState = createInitialState('playing');
  setRushHourPeriod(rushState, 'rush_hour', false);

  // 1) Crowd count & required boarding duration scale up cleanly in Rush Hour
  const normalWaiting = normalState.passengers[1].length;
  const rushWaiting = rushState.passengers[1].length;
  assert.ok(
    rushWaiting > normalWaiting,
    `rush hour crowd (${rushWaiting}) must exceed normal service (${normalWaiting})`
  );
  assert.ok(
    Math.abs(
      rushState.currentRequiredBoardingSec / normalState.currentRequiredBoardingSec - 1.65
    ) < 0.01,
    'rush hour must increase required boarding dwell time by 1.65x'
  );

  // 2) Alignment tolerance tightens from +/-7.5m (normal) to +/-4.5m (rush hour)
  const normalTol = getAlignmentTolerances('metro14', 'normal');
  const rushTol = getAlignmentTolerances('metro14', 'rush_hour');
  assert.equal(normalTol.maxAllowedAlignM, 7.5);
  assert.equal(rushTol.maxAllowedAlignM, 4.5);

  // Stopping +6.0m past stop mark is accepted in normal service but rejected in Rush Hour
  normalState.trainX = STATIONS[1].stopX + 6.0;
  normalState.speedMs = 0;
  rushState.trainX = STATIONS[1].stopX + 6.0;
  rushState.speedMs = 0;

  assert.equal(canOpenDoors(normalState), true, '+6.0m should fit normal +/-7.5m door window');
  assert.equal(canOpenDoors(rushState), false, '+6.0m must be rejected under Rush Hour +/-4.5m window');
});

test('Metro 14 (21 stations) & RER A (24 stations) include full lines, outdoor sections, and MI09 express physics', () => {
  const metroLine = getLineDefinition('metro14');
  assert.equal(metroLine.stations.length, 21);
  assert.equal(metroLine.stations[0].shortName, 'St-Denis Pleyel');
  assert.equal(metroLine.stations[metroLine.stations.length - 1].shortName, "Aéroport d'Orly");
  assert.ok(metroLine.stations.every((s) => !s.isOutdoor), 'all Line 14 stations are underground');

  const rerLine = getLineDefinition('rerA');
  assert.equal(rerLine.stations.length, 24);
  assert.equal(rerLine.stations[0].shortName, 'St-Germain');
  assert.equal(rerLine.stations[rerLine.stations.length - 1].shortName, 'Boissy-St-L.');
  assert.equal(rerLine.stations[rerLine.stations.length - 1].stopX, 20440);
  assert.equal(rerLine.hasPlatformScreenDoors, false);
  assert.equal(rerLine.hasOverheadCatenary, true);
  assert.equal(rerLine.physics.maxSpeedKmhDisplay, 130);
  assert.equal(Math.round(rerLine.physics.maxSpeedMs * 3.6), 120);

  const rerState = createInitialState('playing', 'rerA');
  assert.equal(rerState.lineMode, 'rerA');

  // Compare braking distance from 22 m/s between heavier MI09 RER A and lighter MP14 Metro 14
  const brakeDist = (mode: 'metro14' | 'rerA'): number => {
    const st = createInitialState('playing', mode);
    st.trainX = 200;
    st.speedMs = 22;
    setLever(st, -0.75);
    for (let i = 0; i < 400; i++) {
      stepSimulation(st, 0.05);
      if (st.speedMs <= 0.01) break;
    }
    return st.trainX - 200;
  };

  const metroDist = brakeDist('metro14');
  const rerDist = brakeDist('rerA');
  assert.ok(
    rerDist > metroDist + 20,
    `heavier MI09 double-decker (${rerDist.toFixed(1)}m) must require longer stopping distance than MP14 (${metroDist.toFixed(1)}m)`
  );
});

test('RER A stations assign outdoor flags and distinct architectural styles across suburban & central sections', () => {
  const rerLine = getLineDefinition('rerA');
  const byId = new Map(rerLine.stations.map((s) => [s.id, s]));

  // West suburban outdoor stations
  assert.equal(byId.get('saint-germain-en-laye')?.archStyle, 'suburban_outdoor');
  assert.equal(byId.get('saint-germain-en-laye')?.isOutdoor, true);
  assert.equal(byId.get('nanterre-universite')?.isOutdoor, true);

  // Central underground express halls
  assert.equal(byId.get('nanterre-prefecture')?.isOutdoor, false);
  assert.equal(byId.get('la-defense')?.archStyle, 'la_defense');
  assert.equal(byId.get('la-defense')?.isOutdoor, false);
  assert.equal(byId.get('auber')?.archStyle, 'rer_vault');
  assert.equal(byId.get('nation')?.isOutdoor, false);

  // East suburban outdoor stations
  assert.equal(byId.get('vincennes')?.archStyle, 'vincennes');
  assert.equal(byId.get('vincennes')?.isOutdoor, true);
  assert.equal(byId.get('fontenay-sous-bois')?.archStyle, 'suburban_outdoor');
  assert.equal(byId.get('boissy-saint-leger')?.isOutdoor, true);

  // isPositionOutdoor detects open-air corridors vs underground bore & portal boundaries
  assert.equal(isPositionOutdoor(400, rerLine.stations), true, 'west suburban corridor is open air');
  assert.equal(isPositionOutdoor(4660, rerLine.stations), true, 'Nanterre-Université is open air');
  assert.equal(isPositionOutdoor(5100, rerLine.stations), false, 'tunnel after portal to Nanterre-Préfecture is underground');
  assert.equal(isPositionOutdoor(9000, rerLine.stations), false, 'central Paris trunk is underground');
  assert.equal(isPositionOutdoor(12920, rerLine.stations), true, 'Vincennes emerging portal is open air');
  assert.equal(isPositionOutdoor(17500, rerLine.stations), true, 'east suburban corridor is open air');

  const metroLine = getLineDefinition('metro14');
  assert.ok(metroLine.stations.every((s) => s.archStyle === 'metro14_vault'));
});

test('getDirectedRoute reverses 24-station RER A schedules, outdoor segments, speed zones, and speed cameras', () => {
  const fwd = getDirectedRoute('rerA', 'forward');
  const rev = getDirectedRoute('rerA', 'reverse');

  assert.equal(rev.stations.length, fwd.stations.length);
  assert.equal(rev.stations[0].id, 'boissy-saint-leger');
  assert.equal(rev.stations[0].stopX, 0);
  assert.equal(rev.stations[0].legScheduleSeconds, 0);
  assert.equal(rev.stations[rev.stations.length - 1].id, 'saint-germain-en-laye');
  assert.equal(rev.stations[rev.stations.length - 1].stopX, 20440);
  assert.equal(rev.terminusShortName, 'St-Germain');

  // Monotonically increasing stopX and positive legScheduleSeconds
  for (let i = 1; i < rev.stations.length; i++) {
    assert.ok(rev.stations[i].stopX > rev.stations[i - 1].stopX);
    assert.ok(rev.stations[i].legScheduleSeconds > 0);
  }

  // Outdoor continuity remains symmetric when reversed (Boissy -> Vincennes outdoor, then central tunnel)
  assert.equal(isPositionOutdoor(1000, rev.stations), true);
  assert.equal(isPositionOutdoor(11000, rev.stations), false);
  assert.equal(isPositionOutdoor(19000, rev.stations), true);

  // Station approach/platform zone enforces 50 km/h on RER A
  assert.equal(getSpeedLimitAtForRoute(rev.stations[0].stopX, 'rerA', 'reverse'), 50);
  assert.equal(getSpeedLimitAtForRoute(rev.stations[10].stopX, 'rerA', 'reverse'), 50);

  // Speed cameras mirror along +X in ascending triggerX order
  const revCams = getSpeedCamerasForLine('rerA', 'reverse');
  const fwdCams = getSpeedCamerasForLine('rerA', 'forward');
  assert.equal(revCams.length, fwdCams.length);
  for (let i = 0; i < revCams.length; i++) {
    assert.ok(revCams[i].triggerX > 0 && revCams[i].triggerX < 20440);
    if (i > 0) {
      assert.ok(revCams[i].triggerX > revCams[i - 1].triggerX);
    }
  }
});

test('starting station & direction selection spawns accurately, computes cumulative due time, and scales final grade', () => {
  // Forward mid-line departure from Auber (index 10 -> targeting Châtelet–Halles index 11)
  const fwdMid = createInitialState('playing', 'rerA', {
    direction: 'forward',
    startStationIndex: 10,
  });
  const fwdRoute = getDirectedRoute('rerA', 'forward');
  assert.equal(fwdMid.trainX, fwdRoute.stations[10].stopX);
  assert.equal(fwdMid.nextStationIndex, 11);
  assert.equal(fwdMid.completedStations.length, 11);
  const fwdHud = buildHudSnapshot(fwdMid);
  assert.equal(fwdHud.nextStationName, 'Châtelet – Les Halles');
  assert.equal(fwdHud.nextStationDueTimeSec, 52);

  // Reverse departure from Gare de Lyon (reverse index 11 -> targeting Châtelet–Halles index 12)
  const revMid = createInitialState('playing', 'rerA', {
    direction: 'reverse',
    startStationIndex: 11,
  });
  const revRoute = getDirectedRoute('rerA', 'reverse');
  assert.equal(revMid.direction, 'reverse');
  assert.equal(revMid.startStationIndex, 11);
  assert.equal(revMid.trainX, revRoute.stations[11].stopX);
  assert.equal(revMid.nextStationIndex, 12);
  const revHud1 = buildHudSnapshot(revMid);
  assert.equal(revHud1.nextStationName, 'Châtelet – Les Halles');
  assert.equal(revHud1.nextStationDueTimeSec, 56);

  // Serving Châtelet–Halles advances due time cumulatively for next stop (Auber: 56 + 52 = 108s)
  revMid.trainX = revRoute.stations[12].stopX;
  revMid.speedMs = 0;
  assert.equal(requestOpenDoors(revMid), true);
  for (let i = 0; i < 240; i++) {
    stepSimulation(revMid, 0.05);
  }
  assert.equal(requestCloseDoors(revMid), true);
  for (let i = 0; i < 100; i++) {
    stepSimulation(revMid, 0.05);
  }
  assert.equal(revMid.nextStationIndex, 13);
  const revHud2 = buildHudSnapshot(revMid);
  assert.equal(revHud2.nextStationName, 'Auber');
  assert.equal(revHud2.nextStationDueTimeSec, 56 + 52);

  // Reaching terminus at St-Germain scales S-grade threshold cleanly for partial-line start (12 stops remaining)
  revMid.score = 9200;
  revMid.comfort = 95;
  revMid.comfortSum = 950;
  revMid.comfortSamples = 10;
  revMid.overspeedTimeSec = 0;
  revMid.overshootCount = 0;
  revMid.nextStationIndex = revRoute.stations.length - 1;
  revMid.trainX = revRoute.stations[revRoute.stations.length - 1].stopX;
  revMid.speedMs = 0;
  assert.equal(requestOpenDoors(revMid), true);
  for (let i = 0; i < 240; i++) {
    stepSimulation(revMid, 0.05);
  }
  assert.equal(requestCloseDoors(revMid), true);
  for (let i = 0; i < 100; i++) {
    stepSimulation(revMid, 0.05);
  }
  assert.equal(revMid.phase, 'gameover');
  const summary = computeFinalGrade(revMid);
  assert.equal(summary.direction, 'reverse');
  assert.equal(summary.terminusName, 'St-Germain');
  assert.equal(summary.grade, 'S');
});

test('MetroAudioEngine ambient weather solver adjusts gains cleanly across clear, fog, rain, and outdoor air', async () => {
  const { computeWeatherAmbience } = await import('./audio');

  const clearUnderground = computeWeatherAmbience({
    weather: 'clear',
    weatherIntensity: 0,
    speedKmh: 60,
    inStation: false,
    isOutdoor: false,
    perspective: 'side',
  });
  const clearOutdoor = computeWeatherAmbience({
    weather: 'clear',
    weatherIntensity: 0,
    speedKmh: 60,
    inStation: false,
    isOutdoor: true,
    perspective: 'side',
  });
  const fogOutdoor = computeWeatherAmbience({
    weather: 'fog',
    weatherIntensity: 0.9,
    speedKmh: 60,
    inStation: false,
    isOutdoor: true,
    perspective: 'side',
  });
  const rainOutdoor = computeWeatherAmbience({
    weather: 'rain',
    weatherIntensity: 0.9,
    speedKmh: 60,
    inStation: false,
    isOutdoor: true,
    perspective: 'side',
  });
  const rainCab = computeWeatherAmbience({
    weather: 'rain',
    weatherIntensity: 0.9,
    speedKmh: 60,
    inStation: false,
    isOutdoor: true,
    perspective: 'cab',
  });

  assert.ok(clearOutdoor.breezeGain > clearUnderground.breezeGain, 'open-air track should have stronger breeze than bored tunnel');
  assert.ok(fogOutdoor.mistGain > clearOutdoor.mistGain, 'fog state must raise damp mist ambient level');
  assert.ok(rainOutdoor.rainPitterGain > 0.05 && rainOutdoor.thunderGain > 0.1, 'rain state enables rain pitter-patter & thunder attenuation levels');
  assert.ok(rainCab.rainPitterGain < rainOutdoor.rainPitterGain, 'enclosed driver cab dampens exterior weather ambience');
});

test('MetroAudioEngine track-click cadence triggers periodically from speed and route track metadata', async () => {
  const { computeTrackClickCadence } = await import('./audio');
  const metroMeta = getLineDefinition('metro14').trackMeta;
  const rerMeta = getLineDefinition('rerA').trackMeta;

  // Below 4 km/h -> does not trigger joint click
  const stationary = computeTrackClickCadence({
    trainX: 50,
    lastJointBucket: 1,
    speedKmh: 2,
    trackMeta: rerMeta,
    isOutdoor: true,
    inStation: false,
  });
  assert.equal(stationary.triggered, false);

  // Crossing RER A 18m steel rail joint triggers metallic click with bogie wheelbase echo
  const rerFast = computeTrackClickCadence({
    trainX: 185,
    lastJointBucket: 9,
    speedKmh: 90,
    trackMeta: rerMeta,
    isOutdoor: false,
    inStation: false,
  });
  assert.equal(rerFast.triggered, true);
  assert.equal(rerFast.jointBucket, 10);
  assert.equal(rerFast.isMetallic, true);

  // Metro 14 22m rubber-tire expansion joint uses lower tone & rubber-tire metadata
  const metroCruise = computeTrackClickCadence({
    trainX: 225,
    lastJointBucket: 9,
    speedKmh: 72,
    trackMeta: metroMeta,
    isOutdoor: false,
    inStation: false,
  });
  assert.equal(metroCruise.triggered, true);
  assert.equal(metroCruise.jointBucket, 10);
  assert.equal(metroCruise.isMetallic, false);
  assert.ok(rerFast.toneHz > metroCruise.toneHz, 'RER steel rail joint click must resonate higher than Metro 14 rubber-tire joint thump');
});





