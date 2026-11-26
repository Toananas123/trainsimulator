import * as THREE from 'three';
import { COLORS } from '../constants';
import { getDirectedRoute, getLineDefinition, type LineMode, type RouteDirection } from '../lines';
import {
  createCabCbtcScreenTexture,
  createCabCctvMonitorTexture,
  createTrainBodyPanelTexture,
  createTrainDestinationTexture,
} from './textures';

export interface SlidingDoorPair {
  leftLeaf: THREE.Mesh;
  rightLeaf: THREE.Mesh;
  baseLeftX: number;
  baseRightX: number;
  statusLedMat: THREE.MeshStandardMaterial;
}

export interface MP14TrainRig {
  root: THREE.Group;
  cabInterior: THREE.Group;
  exteriorFrontShell: THREE.Group;
  wiperPivot: THREE.Group;
  headlightSpot: THREE.SpotLight;
  headlightTarget: THREE.Object3D;
  headlightConeMat: THREE.MeshBasicMaterial;
  cabSignalMat: THREE.MeshStandardMaterial;
  doors: SlidingDoorPair[];
  wheels: THREE.Mesh[];
  update: (params: {
    trainX: number;
    doorOpenProgress: number;
    doorState: string;
    isCabView: boolean;
    weather: 'clear' | 'rain' | 'fog';
    weatherIntensity: number;
    signalAspect: 'green' | 'amber' | 'red';
    timeSec: number;
    speedMs: number;
    lever: number;
    emergencyBrake: boolean;
    speedCameraFlashIntensity?: number;
  }) => void;
  dispose: () => void;
}

/**
 * Builds an articulated 3D Paris Metro MP14 consist (3 cars + bellows)
 * featuring a hyper-detailed 1st-person Alstom MP14 Driver Cab:
 *  - Curved rubber windshield gaskets, tinted anti-glare top glass band, specular windshield glazing
 *  - Overhead stainless sun visor, recessed warm cab dome light & glowing ATP signal repeater bar
 *  - Left A-pillar mounted 3D Platform CCTV quad-monitor & Right A-pillar CBTC/SAET diagnostic screen
 *  - Multi-plane sloped gunmetal dashboard desk with 3D red mushroom Coup-de-Poing Emergency Stop,
 *    illuminated 3D green/red door pilot lamps, 3D animated traction/brake lever silhouette & grab rails
 *  - Articulated parked windshield wiper blade
 */
export function createMP14Train(
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  lineMode: LineMode = 'metro14',
  direction: RouteDirection = 'forward'
): MP14TrainRig {
  const isRer = lineMode === 'rerA';
  const lineDef = getLineDefinition(lineMode);
  const route = getDirectedRoute(lineMode, direction);
  const doorOffsets = lineDef.doorOffsetsM;

  const root = new THREE.Group();
  root.name = isRer ? 'mi09-rerA-train' : 'mp14-train';

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const bodyPanelTex = createTrainBodyPanelTexture(maxAnisotropy);
  trackTex(bodyPanelTex.map);
  trackTex(bodyPanelTex.normalMap);

  // --- Shared Exterior PBR Materials ---
  const whiteBodyMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: bodyPanelTex.map,
      normalMap: bodyPanelTex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0xeaf0f6,
      roughness: 0.24,
      metalness: 0.22,
    })
  );
  const turquoiseMat = trackMat(
    new THREE.MeshStandardMaterial({
      normalMap: bodyPanelTex.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      color: new THREE.Color(isRer ? COLORS.rerARed : COLORS.ratpTurquoise),
      roughness: 0.26,
      metalness: 0.24,
    })
  );
  const purpleAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(isRer ? COLORS.rerABlue : COLORS.line14Purple),
      roughness: 0.28,
      metalness: 0.24,
    })
  );
  const roofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRer ? 0x94a3b8 : 0xbac4d0,
      roughness: 0.5,
      metalness: 0.28,
    })
  );
  const darkUnderframeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x141a26,
      roughness: 0.84,
      metalness: 0.25,
    })
  );
  const rubberTireMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRer ? 0x64748b : 0x111318,
      roughness: isRer ? 0.34 : 0.94,
      metalness: isRer ? 0.86 : 0.04,
    })
  );
  const alloyHubMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.82,
    })
  );
  const smokedGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0x0b1526,
      roughness: 0.08,
      metalness: 0.12,
      transparent: true,
      opacity: isSoftwareGl ? 0.44 : 0.36,
      transmission: 0,
      reflectivity: 0.9,
    })
  );
  const doorFrameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRer ? 0xeef2f6 : 0xd5dfe9,
      roughness: 0.3,
      metalness: 0.58,
    })
  );
  const interiorGlowMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff4df,
      emissive: 0xffe8c2,
      emissiveIntensity: 0.9,
      roughness: 0.58,
    })
  );
  const seatMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRer ? 0x1d4ed8 : 0x3b1f66,
      roughness: 0.78,
      metalness: 0.05,
    })
  );
  const chromePoleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.16,
      metalness: 0.92,
    })
  );
  const headlightEmissiveMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffbeb,
      emissiveIntensity: 4.5,
      roughness: 0.1,
    })
  );
  const tailLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 2.8,
      roughness: 0.15,
    })
  );
  const bellowsMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1b212e,
      roughness: 0.9,
      metalness: 0.08,
    })
  );
  const servicePanelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x536273,
      roughness: 0.48,
      metalness: 0.62,
    })
  );
  const serviceGrilleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x101923,
      roughness: 0.82,
      metalness: 0.28,
    })
  );
  const fastenerMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xc2cbd4,
      roughness: 0.3,
      metalness: 0.88,
    })
  );

  const destTex = trackTex(
    createTrainDestinationTexture(maxAnisotropy, lineMode, route.terminusShortName)
  );
  const destLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: destTex,
      emissiveMap: destTex,
      emissive: 0xffffff,
      emissiveIntensity: 1.2,
      roughness: 0.25,
    })
  );

  const doors: SlidingDoorPair[] = [];
  const wheels: THREE.Mesh[] = [];

  const wheelRadius = isRer ? 0.45 : 0.42;
  const tireGeo = trackGeo(new THREE.CylinderGeometry(wheelRadius, wheelRadius, isRer ? 0.14 : 0.28, 16));
  tireGeo.rotateX(Math.PI / 2);
  const hubGeo = trackGeo(new THREE.CylinderGeometry(0.22, 0.22, isRer ? 0.18 : 0.31, 12));
  hubGeo.rotateX(Math.PI / 2);
  const bogieFrameGeo = trackGeo(new THREE.BoxGeometry(2.8, 0.36, isRer ? 1.82 : 1.95));
  const hvacGeo = trackGeo(new THREE.BoxGeometry(3.4, 0.26, 1.65));
  const poleGeo = trackGeo(new THREE.CylinderGeometry(0.03, 0.03, isRer ? 2.6 : 2.2, 8));
  const seatGeo = trackGeo(new THREE.BoxGeometry(1.4, 0.48, 0.45));
  const doorLeafGeo = trackGeo(new THREE.BoxGeometry(isRer ? 1.02 : 0.92, isRer ? 2.15 : 2.08, 0.07));
  const doorWindowGeo = trackGeo(new THREE.BoxGeometry(isRer ? 0.76 : 0.68, 1.05, 0.085));
  const ledGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.07, 0.06));
  const servicePanelGeo = trackGeo(new THREE.BoxGeometry(0.82, 0.34, 0.045));
  const serviceDoorGeo = trackGeo(new THREE.BoxGeometry(0.5, 0.28, 0.05));
  const ventBackingGeo = trackGeo(new THREE.BoxGeometry(0.68, 0.25, 0.035));
  const ventSlatGeo = trackGeo(new THREE.BoxGeometry(0.54, 0.024, 0.03));
  const serviceScrewGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 8));
  serviceScrewGeo.rotateX(Math.PI / 2);

  const carSpecs = isRer
    ? [
        { startX: -2.8, endX: -26.8 },
        { startX: -27.8, endX: -53.8 },
        { startX: -54.8, endX: -80.8 },
        { startX: -81.8, endX: -105.5 },
      ]
    : [
        { startX: -2.6, endX: -24.5 },
        { startX: -25.5, endX: -50.0 },
        { startX: -51.0, endX: -73.0 },
      ];

  const carWidth = isRer ? 2.74 : 2.48;
  const halfW = carWidth / 2;

  for (const spec of carSpecs) {
    const carLen = spec.startX - spec.endX;
    const midX = (spec.startX + spec.endX) / 2;

    const underMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(carLen, 0.46, carWidth - 0.14)),
      darkUnderframeMat
    );
    underMesh.position.set(midX, 0.56, 0);
    root.add(underMesh);

    // Underframe traction inverter cooling bays & pneumatic brake reservoirs
    const inverterBoxGeo = trackGeo(new THREE.BoxGeometry(3.2, 0.34, carWidth + 0.02));
    const airTankGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 10));
    airTankGeo.rotateZ(Math.PI / 2);
    const invBox = new THREE.Mesh(inverterBoxGeo, alloyHubMat);
    invBox.position.set(midX, 0.48, 0);
    root.add(invBox);
    for (const tzSide of [-1.04, 1.04]) {
      const tank = new THREE.Mesh(airTankGeo, darkUnderframeMat);
      tank.position.set(midX + 3.2, 0.46, tzSide);
      root.add(tank);
    }

    const lowerSide = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(carLen, isRer ? 0.44 : 0.72, carWidth)),
      turquoiseMat
    );
    lowerSide.position.set(midX, isRer ? 0.96 : 1.12, 0);
    lowerSide.castShadow = !isSoftwareGl;
    lowerSide.receiveShadow = !isSoftwareGl;
    root.add(lowerSide);

    // External service hatches, ventilation grilles and captive fasteners break up the long smooth side panels.
    const panelY = isRer ? 0.96 : 1.12;
    for (const side of [-1, 1]) {
      const surfaceZ = side * (halfW + 0.026);
      const frontZ = side * (halfW + 0.052);
      const ventX = midX - 4.1;
      const ventBacking = new THREE.Mesh(ventBackingGeo, serviceGrilleMat);
      ventBacking.position.set(ventX, panelY, frontZ);
      root.add(ventBacking);
      for (let slat = 0; slat < 5; slat++) {
        const louver = new THREE.Mesh(ventSlatGeo, servicePanelMat);
        louver.position.set(ventX, panelY - 0.085 + slat * 0.043, frontZ + side * 0.02);
        root.add(louver);
      }

      const accessPanel = new THREE.Mesh(servicePanelGeo, servicePanelMat);
      accessPanel.position.set(midX + 4.4, panelY, surfaceZ);
      root.add(accessPanel);
      const serviceDoor = new THREE.Mesh(serviceDoorGeo, darkUnderframeMat);
      serviceDoor.position.set(midX + 8.0, panelY, surfaceZ);
      root.add(serviceDoor);

      for (const dx of [-0.33, 0.33]) {
        for (const dy of [-0.11, 0.11]) {
          const screw = new THREE.Mesh(serviceScrewGeo, fastenerMat);
          screw.position.set(midX + 4.4 + dx, panelY + dy, frontZ + side * 0.025);
          root.add(screw);
        }
      }
      const latch = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.12, 0.045, 0.025)),
        fastenerMat
      );
      latch.position.set(midX + 8.0, panelY, frontZ + side * 0.025);
      root.add(latch);
    }

    const purpleStripe = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(carLen + 0.02, 0.14, carWidth + 0.02)),
      purpleAccentMat
    );
    purpleStripe.position.set(midX, isRer ? 2.18 : 1.48, 0);
    root.add(purpleStripe);

    if (isRer) {
      // MI09 Double-Decker: structural mid-deck floor belt & upper eaves band
      const midDeckBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen, 0.34, carWidth)),
        whiteBodyMat
      );
      midDeckBand.position.set(midX, 2.36, 0);
      root.add(midDeckBand);

      const upperBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen, 0.48, carWidth)),
        whiteBodyMat
      );
      upperBand.position.set(midX, 3.82, 0);
      upperBand.castShadow = !isSoftwareGl;
      root.add(upperBand);

      const roofMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen, 0.22, carWidth - 0.26)),
        roofMat
      );
      roofMesh.position.set(midX, 4.14, 0);
      root.add(roofMesh);

      const roofSpine = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.6, 0.06, 0.72)),
        darkUnderframeMat
      );
      roofSpine.position.set(midX, 4.27, 0);
      root.add(roofSpine);

      // Dual-level illuminated interior bays (Lower deck y=1.6 + Upper deck y=3.05)
      const lowerInterior = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.2, 0.85, 0.14)),
        interiorGlowMat
      );
      lowerInterior.position.set(midX, 1.62, -halfW + 0.18);
      root.add(lowerInterior);

      const upperInterior = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.2, 0.88, 0.14)),
        interiorGlowMat
      );
      upperInterior.position.set(midX, 3.06, -halfW + 0.18);
      root.add(upperInterior);

      const lowerCeiling = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.2, 0.06, carWidth - 0.35)),
        interiorGlowMat
      );
      lowerCeiling.position.set(midX, 2.02, 0);
      root.add(lowerCeiling);

      const upperCeiling = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.2, 0.06, carWidth - 0.35)),
        interiorGlowMat
      );
      upperCeiling.position.set(midX, 3.52, 0);
      root.add(upperCeiling);

      for (let sx = spec.endX + 2.4; sx < spec.startX - 2.0; sx += 4.2) {
        const seatLow = new THREE.Mesh(seatGeo, seatMat);
        seatLow.position.set(sx, 1.32, -halfW + 0.48);
        const seatUp = new THREE.Mesh(seatGeo, seatMat);
        seatUp.position.set(sx, 2.74, -halfW + 0.48);
        root.add(seatLow, seatUp);

        const pole = new THREE.Mesh(poleGeo, chromePoleMat);
        pole.position.set(sx + 1.1, 2.15, 0.15);
        root.add(pole);
      }

      // Lower & Upper Deck Smoked Windows
      for (const zSide of [halfW - 0.04, -halfW + 0.04]) {
        const lowWin = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(carLen - 0.1, 0.88, 0.04)),
          smokedGlassMat
        );
        lowWin.position.set(midX, 1.64, zSide);
        const upWin = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(carLen - 0.1, 0.92, 0.04)),
          smokedGlassMat
        );
        upWin.position.set(midX, 3.08, zSide);
        root.add(lowWin, upWin);
      }

      const pillarGeo = trackGeo(new THREE.BoxGeometry(0.46, 2.68, 0.08));
      for (let px = spec.endX + 0.5; px <= spec.startX - 0.4; px += 3.2) {
        const nearDoor = doorOffsets.some((dx) => Math.abs(px - dx) < 1.55);
        if (!nearDoor) {
          const pillarPos = new THREE.Mesh(pillarGeo, whiteBodyMat);
          pillarPos.position.set(px, 2.45, halfW - 0.01);
          root.add(pillarPos);
        }
        const pillarNeg = new THREE.Mesh(pillarGeo, whiteBodyMat);
        pillarNeg.position.set(px, 2.45, -halfW + 0.01);
        root.add(pillarNeg);
      }
    } else {
      const upperBand = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen, 0.56, carWidth)),
        whiteBodyMat
      );
      upperBand.position.set(midX, 3.16, 0);
      upperBand.castShadow = !isSoftwareGl;
      root.add(upperBand);

      const roofMesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen, 0.22, carWidth - 0.24)),
        roofMat
      );
      roofMesh.position.set(midX, 3.52, 0);
      root.add(roofMesh);

      // Central anti-slip roof equipment spine & recessed HVAC fan louvers
      const roofSpine = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.6, 0.06, 0.68)),
        darkUnderframeMat
      );
      roofSpine.position.set(midX, 3.65, 0);
      root.add(roofSpine);

      const hvacLouverGeo = trackGeo(new THREE.BoxGeometry(1.1, 0.05, 1.15));
      for (const frac of [-0.26, 0.26]) {
        const hvac = new THREE.Mesh(hvacGeo, roofMat);
        hvac.position.set(midX + carLen * frac, 3.74, 0);
        root.add(hvac);
        const louver = new THREE.Mesh(hvacLouverGeo, darkUnderframeMat);
        louver.position.set(midX + carLen * frac, 3.88, 0);
        root.add(louver);
      }

      const interiorBack = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.2, 1.48, 0.14)),
        interiorGlowMat
      );
      interiorBack.position.set(midX, 2.24, -halfW + 0.16);
      root.add(interiorBack);

      const interiorCeiling = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.2, 0.08, carWidth - 0.35)),
        interiorGlowMat
      );
      interiorCeiling.position.set(midX, 2.86, 0);
      root.add(interiorCeiling);

      for (let sx = spec.endX + 2.2; sx < spec.startX - 1.8; sx += 4.2) {
        const seat = new THREE.Mesh(seatGeo, seatMat);
        seat.position.set(sx, 1.38, -halfW + 0.48);
        root.add(seat);

        const pole = new THREE.Mesh(poleGeo, chromePoleMat);
        pole.position.set(sx + 1.1, 1.92, 0.15);
        root.add(pole);
      }

      const glassZPlus = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.1, 1.36, 0.04)),
        smokedGlassMat
      );
      glassZPlus.position.set(midX, 2.22, halfW - 0.04);
      root.add(glassZPlus);

      const glassZMinus = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(carLen - 0.1, 1.36, 0.04)),
        smokedGlassMat
      );
      glassZMinus.position.set(midX, 2.22, -halfW + 0.04);
      root.add(glassZMinus);

      const pillarGeo = trackGeo(new THREE.BoxGeometry(0.42, 1.42, 0.08));
      for (let px = spec.endX + 0.4; px <= spec.startX - 0.3; px += 3.2) {
        const nearDoor = doorOffsets.some((dx) => Math.abs(px - dx) < 1.35);
        if (!nearDoor) {
          const pillarPos = new THREE.Mesh(pillarGeo, whiteBodyMat);
          pillarPos.position.set(px, 2.22, halfW - 0.01);
          root.add(pillarPos);
        }
        const pillarNeg = new THREE.Mesh(pillarGeo, whiteBodyMat);
        pillarNeg.position.set(px, 2.22, -halfW + 0.01);
        root.add(pillarNeg);
      }
    }

    for (const bx of [spec.startX - 3.6, spec.endX + 3.6]) {
      const bogie = new THREE.Mesh(bogieFrameGeo, darkUnderframeMat);
      bogie.position.set(bx, wheelRadius, 0);
      root.add(bogie);

      for (const wxOff of [-0.95, 0.95]) {
        for (const wz of isRer ? [-0.76, 0.76] : [-0.98, 0.98]) {
          const wheel = new THREE.Mesh(tireGeo, rubberTireMat);
          wheel.position.set(bx + wxOff, wheelRadius, wz);
          const hub = new THREE.Mesh(hubGeo, alloyHubMat);
          wheel.add(hub);
          root.add(wheel);
          wheels.push(wheel);
        }
      }
    }
  }

  // Roof-mounted Single-Arm 1500V/25kV Pantographs for MI09 RER A contacting catenary wire at y=4.68
  if (isRer) {
    const pantoArmGeo = trackGeo(new THREE.BoxGeometry(1.15, 0.06, 0.08));
    const pantoBowGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.045, 1.35));
    const pantoBaseGeo = trackGeo(new THREE.BoxGeometry(1.4, 0.12, 1.1));
    for (const px of [-39, -67]) {
      const pBase = new THREE.Mesh(pantoBaseGeo, darkUnderframeMat);
      pBase.position.set(px, 4.26, 0);
      const lowArm = new THREE.Mesh(pantoArmGeo, turquoiseMat);
      lowArm.position.set(px - 0.2, 4.42, 0);
      lowArm.rotation.z = 0.22;
      const upArm = new THREE.Mesh(pantoArmGeo, alloyHubMat);
      upArm.position.set(px + 0.1, 4.58, 0);
      upArm.rotation.z = -0.18;
      const bow = new THREE.Mesh(pantoBowGeo, chromePoleMat);
      bow.position.set(px + 0.55, 4.68, 0);
      root.add(pBase, lowArm, upArm, bow);
    }
  }

  const bellowsXs = isRer ? [-27.3, -54.3, -81.3] : [-25.0, -50.5];
  for (const gapX of bellowsXs) {
    const bellows = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.1, isRer ? 3.25 : 2.7, carWidth - 0.28)),
      bellowsMat
    );
    bellows.position.set(gapX, isRer ? 2.3 : 2.02, 0);
    root.add(bellows);
  }

  for (const doorX of doorOffsets) {
    const statusLedMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 0.3,
        roughness: 0.2,
      })
    );

    const ledMesh = new THREE.Mesh(ledGeo, statusLedMat);
    ledMesh.position.set(doorX, isRer ? 3.18 : 3.02, halfW + 0.04);
    root.add(ledMesh);

    const leafSpanHalf = isRer ? 0.53 : 0.48;
    const leftLeaf = new THREE.Mesh(doorLeafGeo, doorFrameMat);
    leftLeaf.position.set(doorX - leafSpanHalf, isRer ? 1.92 : 1.88, halfW + 0.02);
    const leftWin = new THREE.Mesh(doorWindowGeo, smokedGlassMat);
    leftWin.position.set(0, 0.25, 0.01);
    leftLeaf.add(leftWin);
    root.add(leftLeaf);

    const rightLeaf = new THREE.Mesh(doorLeafGeo, doorFrameMat);
    rightLeaf.position.set(doorX + leafSpanHalf, isRer ? 1.92 : 1.88, halfW + 0.02);
    const rightWin = new THREE.Mesh(doorWindowGeo, smokedGlassMat);
    rightWin.position.set(0, 0.25, 0.01);
    rightLeaf.add(rightWin);
    root.add(rightLeaf);

    doors.push({
      leftLeaf,
      rightLeaf,
      baseLeftX: doorX - leafSpanHalf,
      baseRightX: doorX + leafSpanHalf,
      statusLedMat,
    });
  }

  // --- Sculpted Aerodynamic Front Nose (MP14 vs Taller MI09 RER A) ---
  const exteriorFrontShell = new THREE.Group();
  exteriorFrontShell.name = isRer ? 'mi09-front-exterior' : 'mp14-front-exterior';

  const frontApron = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.7, isRer ? 0.96 : 0.92, carWidth)),
    turquoiseMat
  );
  frontApron.position.set(-1.42, 1.02, 0);
  exteriorFrontShell.add(frontApron);

  const noseTopY = isRer ? 4.18 : 3.56;
  const noseStart = isRer ? -2.8 : -2.6;
  const noseWedgeShape = new THREE.Shape();
  noseWedgeShape.moveTo(noseStart, 0.56);
  noseWedgeShape.lineTo(-0.1, 0.56);
  noseWedgeShape.lineTo(0.0, 1.54);
  noseWedgeShape.lineTo(-0.82, noseTopY - 0.44);
  noseWedgeShape.lineTo(-1.45, noseTopY);
  noseWedgeShape.lineTo(noseStart, noseTopY);
  noseWedgeShape.closePath();

  const noseGeo = trackGeo(
    new THREE.ExtrudeGeometry(noseWedgeShape, {
      depth: carWidth - 0.04,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.05,
      bevelSegments: 2,
    })
  );
  noseGeo.translate(0, 0, -(carWidth - 0.04) / 2);
  const noseBody = new THREE.Mesh(noseGeo, whiteBodyMat);
  noseBody.castShadow = !isSoftwareGl;
  exteriorFrontShell.add(noseBody);

  const frontWindshield = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.14, isRer ? 1.88 : 1.56, carWidth - 0.3)),
    smokedGlassMat
  );
  frontWindshield.position.set(-0.48, isRer ? 2.66 : 2.34, 0);
  frontWindshield.rotation.z = 0.42;
  exteriorFrontShell.add(frontWindshield);

  const destPanel = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(1.85, 0.36)),
    destLedMat
  );
  destPanel.rotation.y = Math.PI / 2;
  destPanel.position.set(-0.82, isRer ? 3.74 : 3.18, 0);
  exteriorFrontShell.add(destPanel);

  const bumper = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.45, 0.34, 1.35)),
    darkUnderframeMat
  );
  bumper.position.set(0.06, 0.72, 0);
  exteriorFrontShell.add(bumper);

  const hlGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.22, 0.38));
  for (const hz of [-0.78, 0.78]) {
    const hl = new THREE.Mesh(hlGeo, headlightEmissiveMat);
    hl.position.set(0.02, 1.24, hz);
    exteriorFrontShell.add(hl);
  }
  root.add(exteriorFrontShell);

  // --- Rear Nose Cap with Red Tail Lights ---
  const rearX = isRer ? -106.75 : -74.25;
  const rearNose = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.5, isRer ? 3.55 : 2.95, carWidth)),
    whiteBodyMat
  );
  rearNose.position.set(rearX, isRer ? 2.34 : 2.02, 0);
  root.add(rearNose);
  const rearBand = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(2.54, 0.85, carWidth + 0.02)),
    turquoiseMat
  );
  rearBand.position.set(rearX, 1.05, 0);
  root.add(rearBand);
  for (const tz of [-0.78, 0.78]) {
    const tl = new THREE.Mesh(hlGeo, tailLightMat);
    tl.position.set(rearX - 1.27, 1.32, tz);
    root.add(tl);
  }

  // --- Intense Dual-Beam LED Headlight SpotLight + Volumetric Tunnel Beams ---
  const headlightSpot = new THREE.SpotLight(0xfff6e0, 165, 145, Math.PI * 0.3, 0.62, 1.25);
  headlightSpot.position.set(0.35, 1.48, 0);
  const headlightTarget = new THREE.Object3D();
  headlightTarget.position.set(48, 0.75, 0);
  root.add(headlightSpot);
  root.add(headlightTarget);
  headlightSpot.target = headlightTarget;

  const headlightConeMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0xfff5dc,
      transparent: true,
      opacity: 0.085,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  const coneGeo = trackGeo(new THREE.ConeGeometry(2.35, 19, 16, 1, true));
  coneGeo.rotateZ(Math.PI / 2);
  coneGeo.translate(9.5, 0, 0);
  for (const hz of [-0.72, 0.72]) {
    const cone = new THREE.Mesh(coneGeo, headlightConeMat);
    cone.position.set(0.15, 1.24, hz);
    root.add(cone);
  }

  // =========================================================================
  // HYPER-REALISTIC 3D ALSTOM MP14 CONDUCTOR CAB INTERIOR (Cab View)
  // Camera eye sits at (-1.15, 2.38, 0.0) looking forward along +X.
  // =========================================================================
  const cabInterior = new THREE.Group();
  cabInterior.name = 'mp14-cab-interior';
  cabInterior.visible = false;

  const cabShellMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x161d29,
      roughness: 0.62,
      metalness: 0.34,
    })
  );
  const cabAnodizedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x263142,
      roughness: 0.38,
      metalness: 0.62,
    })
  );
  const cabRubberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0b0e14,
      roughness: 0.92,
      metalness: 0.06,
    })
  );
  const cabLeatherMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x111722,
      roughness: 0.78,
      metalness: 0.14,
    })
  );
  const cabSignalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x00aa91,
      emissive: 0x00aa91,
      emissiveIntensity: 2.6,
      roughness: 0.18,
    })
  );
  const doorPilotGreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.25,
      roughness: 0.2,
    })
  );
  const doorPilotAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.15,
      roughness: 0.2,
    })
  );
  const emergButtonMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      emissive: 0x7f1d1d,
      emissiveIntensity: 0.55,
      roughness: 0.25,
      metalness: 0.15,
    })
  );
  const hazardCollarMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.42,
      metalness: 0.15,
    })
  );
  const sunTintGlassMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: 0x06101e,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );

  // Subtle warm cab instrument desk bounce light + speed camera flash strobe light inside cab
  const cabDeskLight = new THREE.PointLight(0xdbeafe, 2.5, 3.4, 1.4);
  cabDeskLight.position.set(-0.56, 2.18, 0);
  cabInterior.add(cabDeskLight);

  const cabFlashLight = new THREE.PointLight(0xf8fafc, 0, 6.5, 1.2);
  cabFlashLight.position.set(0.15, 2.55, 0);
  cabInterior.add(cabFlashLight);

  // 1) Structural Sloped A-Pillars + Thick Black Rubber Windshield Gaskets + Brushed Chrome Grab Rails
  const aPillarGeo = trackGeo(new THREE.BoxGeometry(0.18, 1.82, 0.16));
  const gasketGeo = trackGeo(new THREE.BoxGeometry(0.09, 1.74, 0.05));
  const grabGeo = trackGeo(new THREE.CylinderGeometry(0.016, 0.016, 0.68, 8));
  const cabSideGlassGeo = trackGeo(new THREE.BoxGeometry(0.75, 1.32, 0.03));

  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(aPillarGeo, cabShellMat);
    pillar.position.set(-0.18, 2.38, side * 1.18);
    pillar.rotation.z = 0.24;
    cabInterior.add(pillar);

    // Side cab quarter glazing framing behind A-pillars
    const sideGlass = new THREE.Mesh(cabSideGlassGeo, smokedGlassMat);
    sideGlass.position.set(-0.62, 2.42, side * 1.22);
    cabInterior.add(sideGlass);

    // Rubber weather-strip molding framing the panoramic glass
    const gasket = new THREE.Mesh(gasketGeo, cabRubberMat);
    gasket.position.set(-0.14, 2.38, side * 1.09);
    gasket.rotation.z = 0.24;
    cabInterior.add(gasket);

    // Vertical stainless steel conductor grab handle mounted to inner A-pillar
    const grab = new THREE.Mesh(grabGeo, chromePoleMat);
    grab.position.set(-0.34, 2.34, side * 1.07);
    grab.rotation.z = 0.24;
    cabInterior.add(grab);
  }

  // 2) Overhead Sculpted Cab Canopy, Perforated Sun-Visor & ATP Signal Repeater Strip
  const headerBar = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.65, 0.26, 2.68)),
    cabShellMat
  );
  headerBar.position.set(-0.46, 3.12, 0);
  cabInterior.add(headerBar);

  // Upper rubber windshield seal + tinted anti-glare top windshield strip (spans pillar-to-pillar)
  const topGasket = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.08, 0.06, 2.48)),
    cabRubberMat
  );
  topGasket.position.set(-0.14, 2.98, 0);
  cabInterior.add(topGasket);

  const sunTintStrip = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(2.56, 0.18)),
    sunTintGlassMat
  );
  sunTintStrip.position.set(-0.08, 2.91, 0);
  sunTintStrip.rotation.y = -Math.PI / 2;
  cabInterior.add(sunTintStrip);

  // Pull-down tinted acrylic sun visor (left-of-center overhead)
  const sunVisor = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.02, 0.16, 0.62)),
    cabAnodizedMat
  );
  sunVisor.position.set(-0.26, 2.94, -0.38);
  sunVisor.rotation.z = -0.35;
  cabInterior.add(sunVisor);

  // Overhead central cab ATP signal repeater housing & glowing LED bar
  const repeaterBezel = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.14, 0.13, 0.42)),
    cabAnodizedMat
  );
  repeaterBezel.position.set(-0.24, 3.01, 0);
  cabInterior.add(repeaterBezel);

  const cabRepeater = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.04, 0.065, 0.3)),
    cabSignalMat
  );
  cabRepeater.position.set(-0.31, 3.01, 0);
  cabInterior.add(cabRepeater);

  // 3) Left A-Pillar Mounted 3D Platform CCTV Quad-Screen (100% unclipped inside panoramic frame)
  const cctvTex = trackTex(createCabCctvMonitorTexture(maxAnisotropy, lineMode));
  const cctvMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: cctvTex,
      emissiveMap: cctvTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.22,
    })
  );
  const cctvGroup = new THREE.Group();
  cctvGroup.position.set(-0.18, 2.09, -0.74);
  cctvGroup.rotation.y = -Math.PI / 2 + 0.4; // faces driver eye cleanly
  cctvGroup.rotation.x = -0.08;

  const cctvHousing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.4, 0.265, 0.045)),
    cabAnodizedMat
  );
  const cctvScreen = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.365, 0.23)),
    cctvMat
  );
  cctvScreen.position.set(0, 0, 0.026);
  const cctvMountArm = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 6)),
    cabRubberMat
  );
  cctvMountArm.position.set(-0.26, 0, -0.06);
  cctvMountArm.rotation.z = Math.PI / 2;
  cctvGroup.add(cctvHousing, cctvScreen, cctvMountArm);
  cabInterior.add(cctvGroup);

  // 4) Right A-Pillar Mounted 3D CBTC / SACEM Radio Diagnostics Screen (100% unclipped)
  const cbtcTex = trackTex(createCabCbtcScreenTexture(maxAnisotropy, lineMode));
  const cbtcMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: cbtcTex,
      emissiveMap: cbtcTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.84,
      roughness: 0.22,
    })
  );
  const cbtcGroup = new THREE.Group();
  cbtcGroup.position.set(-0.18, 2.09, 0.74);
  cbtcGroup.rotation.y = -Math.PI / 2 - 0.4;
  cbtcGroup.rotation.x = -0.08;

  const cbtcHousing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.4, 0.265, 0.045)),
    cabAnodizedMat
  );
  const cbtcScreen = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.365, 0.23)),
    cbtcMat
  );
  cbtcScreen.position.set(0, 0, 0.026);
  const cbtcMountArm = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 6)),
    cabRubberMat
  );
  cbtcMountArm.position.set(0.26, 0, -0.06);
  cbtcMountArm.rotation.z = Math.PI / 2;
  cbtcGroup.add(cbtcHousing, cbtcScreen, cbtcMountArm);
  cabInterior.add(cbtcGroup);

  // 5) Multi-Tiered Sculpted Gunmetal Driver Desk (*Pupitre de Conduite*) — visible along lower windshield edge
  const dashLower = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.76, 0.28, 2.52)),
    cabLeatherMat
  );
  dashLower.position.set(-0.22, 1.72, 0);
  cabInterior.add(dashLower);

  // Angled metallic instrument binnacle rising cleanly into lower sightline
  const dashBinnacle = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.4, 0.11, 1.48)),
    cabAnodizedMat
  );
  dashBinnacle.position.set(-0.26, 1.86, 0);
  dashBinnacle.rotation.z = 0.16;
  cabInterior.add(dashBinnacle);

  // Brushed aluminum glare shield edge along desk crest
  const glareLip = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.06, 0.036, 2.34)),
    cabAnodizedMat
  );
  glareLip.position.set(-0.08, 1.87, 0);
  cabInterior.add(glareLip);

  // Bottom black rubber windshield seal
  const botGasket = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.07, 0.045, 2.34)),
    cabRubberMat
  );
  botGasket.position.set(0.02, 1.87, 0);
  cabInterior.add(botGasket);

  // Physical 3D Emergency Stop Mushroom Button ("Coup de Poing") on right-center desk!
  const emergBase = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.052, 0.058, 0.022, 14)),
    hazardCollarMat
  );
  emergBase.position.set(-0.22, 1.915, 0.34);
  const emergCap = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.042, 0.034, 0.038, 14)),
    emergButtonMat
  );
  emergCap.position.set(-0.22, 1.946, 0.34);
  cabInterior.add(emergBase, emergCap);

  // Physical 3D Illuminated Door Pilot Lamps on left-center desk
  const pilotGeo = trackGeo(new THREE.CylinderGeometry(0.022, 0.024, 0.022, 10));
  const pilotGreen = new THREE.Mesh(pilotGeo, doorPilotGreenMat);
  pilotGreen.position.set(-0.22, 1.918, -0.22);
  const pilotAmber = new THREE.Mesh(pilotGeo, doorPilotAmberMat);
  pilotAmber.position.set(-0.22, 1.918, -0.14);
  cabInterior.add(pilotGreen, pilotAmber);

  // Physical 3D Master Traction/Brake Lever moving live with `state.lever` on the desk!
  const deskLeverPivot = new THREE.Group();
  deskLeverPivot.position.set(-0.24, 1.88, -0.44);
  const leverSlot = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.2, 0.028, 0.08)),
    cabRubberMat
  );
  leverSlot.position.set(0, 0.02, 0);
  const leverStem = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.011, 0.013, 0.14, 8)),
    chromePoleMat
  );
  leverStem.position.set(0, 0.08, 0);
  const leverGrip = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10)),
    cabAnodizedMat
  );
  leverGrip.rotation.x = Math.PI / 2;
  leverGrip.position.set(0, 0.15, 0);
  const leverArmGroup = new THREE.Group();
  leverArmGroup.add(leverStem, leverGrip);
  deskLeverPivot.add(leverSlot, leverArmGroup);
  cabInterior.add(deskLeverPivot);

  // 6) Articulated Pantograph 3D Windshield Wiper (parked below sightline)
  const wiperPivot = new THREE.Group();
  wiperPivot.position.set(0.02, 1.63, -0.52);
  const wiperArm = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.028, 0.92, 0.032)),
    cabAnodizedMat
  );
  wiperArm.position.set(0, 0.46, 0);
  const wiperBlade = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.024, 0.64, 0.022)),
    rubberTireMat
  );
  wiperBlade.position.set(0.012, 0.62, 0);
  wiperPivot.add(wiperArm);
  wiperPivot.add(wiperBlade);
  wiperPivot.rotation.x = -1.52;
  cabInterior.add(wiperPivot);

  root.add(cabInterior);

  let wheelAngle = 0;

  return {
    root,
    cabInterior,
    exteriorFrontShell,
    wiperPivot,
    headlightSpot,
    headlightTarget,
    headlightConeMat,
    cabSignalMat,
    doors,
    wheels,
    update({
      trainX,
      doorOpenProgress,
      doorState,
      isCabView,
      weather,
      weatherIntensity,
      signalAspect,
      timeSec,
      lever,
      emergencyBrake,
      speedCameraFlashIntensity = 0,
    }) {
      root.position.set(trainX, 0, 0);
      cabFlashLight.intensity = speedCameraFlashIntensity * 28;

      cabInterior.visible = isCabView;
      exteriorFrontShell.visible = !isCabView;

      // Rotate wheels proportionally to world travel distance
      wheelAngle = -(trainX / wheelRadius);
      for (let i = 0; i < wheels.length; i++) {
        wheels[i].rotation.z = wheelAngle;
      }

      // Slide twin MP14 doors + pulse status LEDs
      const slideDist = doorOpenProgress * 0.72;
      const isWarning = doorState === 'closing_warning';
      const blinkOn = !isWarning || Math.floor(timeSec * 8) % 2 === 0;
      for (let i = 0; i < doors.length; i++) {
        const d = doors[i];
        d.leftLeaf.position.x = d.baseLeftX - slideDist;
        d.rightLeaf.position.x = d.baseRightX + slideDist;

        if (isWarning) {
          d.statusLedMat.color.setHex(0xf59e0b);
          d.statusLedMat.emissive.setHex(0xf59e0b);
          d.statusLedMat.emissiveIntensity = blinkOn ? 2.4 : 0.1;
        } else if (doorOpenProgress > 0.05) {
          d.statusLedMat.color.setHex(0x10b981);
          d.statusLedMat.emissive.setHex(0x10b981);
          d.statusLedMat.emissiveIntensity = 1.8;
        } else {
          d.statusLedMat.color.setHex(0x334155);
          d.statusLedMat.emissive.setHex(0x000000);
          d.statusLedMat.emissiveIntensity = 0;
        }
      }

      // Cab overhead ATP signal repeater lamp
      if (signalAspect === 'red') {
        cabSignalMat.color.setHex(0xef4444);
        cabSignalMat.emissive.setHex(0xef4444);
      } else if (signalAspect === 'amber') {
        cabSignalMat.color.setHex(0xf59e0b);
        cabSignalMat.emissive.setHex(0xf59e0b);
      } else {
        cabSignalMat.color.setHex(0x00aa91);
        cabSignalMat.emissive.setHex(0x00aa91);
      }

      // Physical 3D Cab Desk indicators (Door pilot lamps, Emergency mushroom glow, 3D Master Lever)
      doorPilotGreenMat.emissiveIntensity = doorOpenProgress > 0.05 ? 2.8 : 0.18;
      doorPilotAmberMat.emissiveIntensity = isWarning && blinkOn ? 3.2 : 0.12;
      emergButtonMat.emissiveIntensity = emergencyBrake ? 3.0 : 0.45;
      // Rotate 3D master controller stem forward for traction (+), backward for brake (-)
      leverArmGroup.rotation.z = -lever * 0.55;

      // Volumetric headlight cone intensifies in fog
      headlightConeMat.opacity =
        weather === 'fog' ? 0.085 + weatherIntensity * 0.095 : 0.075;

      wiperPivot.rotation.x = THREE.MathUtils.lerp(wiperPivot.rotation.x, -1.52, 0.1);
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
