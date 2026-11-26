import * as THREE from 'three';
import { COLORS, type StationArchStyle, type StationConfig } from '../constants';
import type { PassengerActor, SimulationState } from '../engine';
import {
  getDirectedRoute,
  getLineDefinition,
  isPositionOutdoor,
  type LineMode,
  type RouteDirection,
} from '../lines';
import { getSpeedCamerasForLine } from '../speedCamera';
import {
  createCanopyGlassTexture,
  createDefenseConcreteTextures,
  createDistantFacadeTexture,
  createDistanceMarkerTexture,
  createPlatformDeckTextures,
  createRubberTireTrackTexture,
  createSielBoardTexture,
  createSortieSignTexture,
  createSpeedCameraSignTexture,
  createSpeedLimitSignTexture,
  createStationMasonryTextures,
  createStationSignTexture,
  createStationTotemTexture,
  createStopMarkerTexture,
  createSuburbanBrickMasonryTextures,
  createSuburbanSkyTexture,
  createTunnelConcreteTextures,
} from './textures';

interface StationPsdPair {
  leftLeaf: THREE.Mesh;
  rightLeaf: THREE.Mesh;
  baseLeftX: number;
  baseRightX: number;
}

interface CommuterRig {
  group: THREE.Group;
  coatMesh: THREE.Mesh;
  coatMat: THREE.MeshStandardMaterial;
  skinMat: THREE.MeshStandardMaterial;
  hairMat: THREE.MeshStandardMaterial;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  bagMesh: THREE.Group;
}

interface StationSlot {
  stationIndex: number;
  archStyle: StationArchStyle;
  root: THREE.Group;
  nearWall: THREE.Mesh;
  nearVincennesSurround: THREE.Group;
  nearDefensePiers: THREE.Group;
  vaultGroup: THREE.Group;
  rerMezzanineGroup: THREE.Group;
  laDefenseGroup: THREE.Group;
  vincennesGroup: THREE.Group;
  subPortalRear: THREE.Group;
  subPortalFwd: THREE.Group;
  sielHangerGroup: THREE.Group;
  signMat: THREE.MeshStandardMaterial;
  sielMat: THREE.MeshStandardMaterial;
  psdPairs: StationPsdPair[];
  commuters: CommuterRig[];
}

export interface Metro3DWorld {
  root: THREE.Group;
  update: (state: SimulationState, isSideView: boolean, cameraPos: THREE.Vector3, dt: number) => void;
  dispose: () => void;
}

const _dummyObj = new THREE.Object3D();

function isInsideAnyStation(
  worldX: number,
  stations: StationConfig[],
  leadOffset: number,
  trailOffset: number
): boolean {
  for (let i = 0; i < stations.length; i++) {
    const sx = stations[i].stopX;
    if (worldX >= sx - leadOffset && worldX <= sx + trailOffset) {
      return true;
    }
  }
  return false;
}

/**
 * Procedural 3D Paris Transit World (Metro Line 14 MP14 & RER A MI09 Express):
 * - Concrete rubber-tire guideway (Line 14) OR crushed ballast steel rails + overhead catenary (RER A)
 * - Seamless camera-aware TBM tunnel rings, structural ribs, luminaires & SORTIE signs
 * - 2-slot dynamic 3D Vaulted Station Cavern pool (with PSDs for Line 14 or open express platforms for RER A)
 * - Trackside block signals, French speed limit discs, speed cameras, and 24-rig 3D commuter crowds
 */
export function createMetro3DWorld(
  isSoftwareGl: boolean,
  maxAnisotropy: number,
  lineMode: LineMode = 'metro14',
  direction: RouteDirection = 'forward'
): Metro3DWorld {
  const lineDef = getLineDefinition(lineMode);
  const route = getDirectedRoute(lineMode, direction);
  const isRer = lineMode === 'rerA';
  const stations = route.stations;
  const speedLimitZones = route.speedLimitZones;
  const speedCameras = getSpeedCamerasForLine(lineMode, direction);
  const stationLeadM = isRer ? 124 : 96;
  const stationTrailM = 24;

  const root = new THREE.Group();
  root.name = isRer ? 'rerA-world' : 'line14-world';

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

  // --- Shared Procedural PBR Textures (Albedo + Bump + Normal + Roughness) ---
  const masonryTex = createStationMasonryTextures(maxAnisotropy);
  trackTex(masonryTex.map);
  trackTex(masonryTex.bumpMap);
  trackTex(masonryTex.normalMap);

  const defenseTex = createDefenseConcreteTextures(maxAnisotropy);
  trackTex(defenseTex.map);
  trackTex(defenseTex.normalMap);

  const suburbanBrickTex = createSuburbanBrickMasonryTextures(maxAnisotropy);
  trackTex(suburbanBrickTex.map);
  trackTex(suburbanBrickTex.normalMap);

  const suburbanSkyTex = trackTex(createSuburbanSkyTexture(maxAnisotropy));
  const distantFacadeTex = createDistantFacadeTexture(maxAnisotropy);
  trackTex(distantFacadeTex.map);
  trackTex(distantFacadeTex.normalMap);
  const canopyGlassTex = trackTex(createCanopyGlassTexture(maxAnisotropy));

  const tunnelTex = createTunnelConcreteTextures(maxAnisotropy);
  trackTex(tunnelTex.map);
  trackTex(tunnelTex.bumpMap);
  trackTex(tunnelTex.normalMap);
  trackTex(tunnelTex.roughnessMap);

  const platformTex = createPlatformDeckTextures(maxAnisotropy);
  trackTex(platformTex.map);
  trackTex(platformTex.bumpMap);
  trackTex(platformTex.normalMap);
  trackTex(platformTex.roughnessMap);

  const tireTrackTex = trackTex(createRubberTireTrackTexture(maxAnisotropy));
  const stopMarkerTex = trackTex(createStopMarkerTexture(maxAnisotropy));
  const sortieTex = trackTex(createSortieSignTexture(maxAnisotropy));
  const totemTex = trackTex(createStationTotemTexture(maxAnisotropy, lineMode));

  // Pre-build station plaque & SIEL textures for all stations on this directed route
  const stationSignTextures = stations.map((s) =>
    trackTex(createStationSignTexture(s.name, maxAnisotropy, lineMode))
  );
  const stationSielTextures = stations.map((s) =>
    trackTex(createSielBoardTexture(s.name, maxAnisotropy, lineMode, route.terminusShortName))
  );

  // Speed limit disc textures (covering both Metro 14 & RER A speeds)
  const speedTexMap: Record<number, THREE.CanvasTexture> = {
    40: trackTex(createSpeedLimitSignTexture(40, maxAnisotropy)),
    50: trackTex(createSpeedLimitSignTexture(50, maxAnisotropy)),
    60: trackTex(createSpeedLimitSignTexture(60, maxAnisotropy)),
    70: trackTex(createSpeedLimitSignTexture(70, maxAnisotropy)),
    80: trackTex(createSpeedLimitSignTexture(80, maxAnisotropy)),
    90: trackTex(createSpeedLimitSignTexture(90, maxAnisotropy)),
    100: trackTex(createSpeedLimitSignTexture(100, maxAnisotropy)),
    120: trackTex(createSpeedLimitSignTexture(120, maxAnisotropy)),
  };

  // Speed camera advance warning sign textures keyed by limit
  const radarSignTexMap: Record<number, THREE.CanvasTexture> = {
    60: trackTex(createSpeedCameraSignTexture(60, maxAnisotropy)),
    70: trackTex(createSpeedCameraSignTexture(70, maxAnisotropy)),
    80: trackTex(createSpeedCameraSignTexture(80, maxAnisotropy)),
    100: trackTex(createSpeedCameraSignTexture(100, maxAnisotropy)),
  };

  // Distance marker textures
  const distValues = [300, 200, 100, 50];
  const distTexMap: Record<number, THREE.CanvasTexture> = {};
  for (const d of distValues) {
    distTexMap[d] = trackTex(createDistanceMarkerTexture(d, maxAnisotropy));
  }

  // --- Shared World PBR Materials (High realism, deep weathered contrast) ---
  const trackBedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: isRer ? 0x262b34 : 0x111620,
      roughness: 0.94,
      metalness: 0.04,
    })
  );
  const concreteBeamMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tireTrackTex,
      roughness: 0.68,
      metalness: 0.16,
    })
  );
  const steelRailMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xb8c4d0,
      roughness: 0.2,
      metalness: 0.9,
    })
  );
  const sleeperMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x262e3d,
      roughness: 0.9,
      metalness: 0.06,
    })
  );
  const tunnelLiningMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tunnelTex.map,
      bumpMap: tunnelTex.bumpMap,
      bumpScale: 0.08,
      normalMap: tunnelTex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: tunnelTex.roughnessMap,
      roughness: 0.9,
      metalness: 0.08,
      side: THREE.BackSide,
    })
  );
  const tunnelRibMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0b1019,
      roughness: 0.62,
      metalness: 0.42,
    })
  );
  const tunnelLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffedd5,
      emissive: 0xfde68a,
      emissiveIntensity: 2.6,
      roughness: 0.2,
    })
  );
  const sortieMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: sortieTex,
      emissiveMap: sortieTex,
      emissive: 0x34d399,
      emissiveIntensity: 1.05,
      roughness: 0.3,
    })
  );
  const stationVaultMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: masonryTex.map,
      bumpMap: masonryTex.bumpMap,
      bumpScale: 0.05,
      normalMap: masonryTex.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      color: 0xd9d4ca,
      roughness: 0.82,
      metalness: 0.05,
      side: THREE.BackSide,
    })
  );
  const stationWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: masonryTex.map,
      bumpMap: masonryTex.bumpMap,
      bumpScale: 0.05,
      normalMap: masonryTex.normalMap,
      normalScale: new THREE.Vector2(0.75, 0.75),
      color: 0xd4cfc5,
      roughness: 0.8,
      metalness: 0.06,
    })
  );
  const stationArchRibMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1d2430,
      roughness: 0.36,
      metalness: 0.65,
    })
  );
  const platformDeckMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: platformTex.map,
      bumpMap: platformTex.bumpMap,
      bumpScale: 0.03,
      normalMap: platformTex.normalMap,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: platformTex.roughnessMap,
      color: 0xb0bac8,
      roughness: 0.72,
      metalness: 0.14,
    })
  );
  const yellowSafetyMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.safetyYellow),
      emissive: 0x713f12,
      emissiveIntensity: 0.25,
      roughness: 0.42,
      metalness: 0.08,
    })
  );
  const purpleFasciaMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(lineDef.primaryColor),
      roughness: 0.34,
      metalness: 0.22,
    })
  );
  const coveLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfff8eb,
      emissive: 0xfff1d6,
      emissiveIntensity: 1.9,
      roughness: 0.2,
    })
  );
  const psdFrameMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xdbe2ec,
      roughness: 0.3,
      metalness: 0.65,
    })
  );
  const psdGlassMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: 0xbfdbfe,
      roughness: 0.08,
      metalness: 0.05,
      transparent: true,
      opacity: isSoftwareGl ? 0.26 : 0.22,
      transmission: 0,
      reflectivity: 0.9,
      depthWrite: false,
    })
  );
  const stopBoardMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: stopMarkerTex,
      emissiveMap: stopMarkerTex,
      emissive: 0xfacc15,
      emissiveIntensity: 0.32,
      roughness: 0.35,
    })
  );
  const benchMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.82,
    })
  );
  const darkMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.5,
      metalness: 0.6,
    })
  );

  // Tactile warning tiles: raised studs and seams catch station lighting at platform level.
  const tactileCanvas = document.createElement('canvas');
  tactileCanvas.width = 256;
  tactileCanvas.height = 128;
  const tactileCtx = tactileCanvas.getContext('2d')!;
  tactileCtx.fillStyle = '#d7ad34';
  tactileCtx.fillRect(0, 0, 256, 128);
  tactileCtx.strokeStyle = 'rgba(68, 48, 17, 0.52)';
  tactileCtx.lineWidth = 3;
  for (let x = 0; x <= 256; x += 64) {
    tactileCtx.beginPath();
    tactileCtx.moveTo(x, 0);
    tactileCtx.lineTo(x, 128);
    tactileCtx.stroke();
  }
  for (let y = 0; y <= 128; y += 64) {
    tactileCtx.beginPath();
    tactileCtx.moveTo(0, y);
    tactileCtx.lineTo(256, y);
    tactileCtx.stroke();
  }
  for (let y = 16; y < 128; y += 32) {
    for (let x = 16; x < 256; x += 32) {
      tactileCtx.beginPath();
      tactileCtx.arc(x, y, 5.5, 0, Math.PI * 2);
      tactileCtx.fillStyle = '#f1d16d';
      tactileCtx.fill();
      tactileCtx.strokeStyle = 'rgba(86, 61, 22, 0.5)';
      tactileCtx.lineWidth = 1.3;
      tactileCtx.stroke();
    }
  }
  const tactileTex = trackTex(new THREE.CanvasTexture(tactileCanvas));
  tactileTex.colorSpace = THREE.SRGBColorSpace;
  tactileTex.wrapS = THREE.RepeatWrapping;
  tactileTex.wrapT = THREE.RepeatWrapping;
  tactileTex.repeat.set(18, 1);
  tactileTex.anisotropy = maxAnisotropy;
  const tactileTileMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: tactileTex,
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.02,
    })
  );

  // Reusable station poster artwork, framed like backlit transit advertising panels.
  const posterCanvas = document.createElement('canvas');
  posterCanvas.width = 512;
  posterCanvas.height = 320;
  const posterCtx = posterCanvas.getContext('2d')!;
  const posterGradient = posterCtx.createLinearGradient(0, 0, 512, 320);
  posterGradient.addColorStop(0, '#172f4a');
  posterGradient.addColorStop(1, '#071321');
  posterCtx.fillStyle = posterGradient;
  posterCtx.fillRect(0, 0, 512, 320);
  posterCtx.fillStyle = '#00aa91';
  posterCtx.fillRect(0, 0, 512, 16);
  posterCtx.fillStyle = '#e5edf6';
  posterCtx.font = '700 24px Arial, sans-serif';
  posterCtx.fillText('RÉSEAU DE PARIS', 32, 58);
  posterCtx.font = '800 43px Arial, sans-serif';
  posterCtx.fillText('LA VILLE', 32, 126);
  posterCtx.fillText('EN MOUVEMENT', 32, 174);
  posterCtx.fillStyle = '#d7ad34';
  posterCtx.fillRect(32, 202, 448, 4);
  posterCtx.fillStyle = '#9fb2c8';
  posterCtx.font = '600 17px Arial, sans-serif';
  posterCtx.fillText('Une nouvelle façon de parcourir Paris', 32, 242);
  posterCtx.fillStyle = 'rgba(0, 170, 145, 0.18)';
  posterCtx.beginPath();
  posterCtx.arc(425, 80, 48, 0, Math.PI * 2);
  posterCtx.fill();
  const posterTex = trackTex(new THREE.CanvasTexture(posterCanvas));
  posterTex.colorSpace = THREE.SRGBColorSpace;
  const posterMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: posterTex,
      emissiveMap: posterTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.22,
      roughness: 0.48,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );
  const cameraLensMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x07111e,
      emissive: 0x0b2940,
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.32,
    })
  );


  // Unique RER A Architecture Materials (La Défense Grande Arche & Vincennes Suburban Trench)
  const defenseConcreteMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: defenseTex.map,
      normalMap: defenseTex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0xdce4ee,
      roughness: 0.65,
      metalness: 0.14,
    })
  );
  const defenseSkylightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf0f9ff,
      emissive: 0xdbeafe,
      emissiveIntensity: 2.3,
      roughness: 0.15,
    })
  );
  const defenseBlueAccentMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.rerABlue),
      roughness: 0.28,
      metalness: 0.3,
    })
  );
  const rerCeramicBandMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xd97706,
      roughness: 0.28,
      metalness: 0.15,
    })
  );
  const suburbanBrickMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: suburbanBrickTex.map,
      normalMap: suburbanBrickTex.normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      color: 0xe6dcd2,
      roughness: 0.82,
      metalness: 0.05,
    })
  );
  const suburbanSkyMat = trackMat(
    new THREE.MeshBasicMaterial({
      map: suburbanSkyTex,
      side: THREE.DoubleSide,
      fog: false,
    })
  );
  const distantFacadeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: distantFacadeTex.map,
      normalMap: distantFacadeTex.normalMap,
      normalScale: new THREE.Vector2(0.72, 0.72),
      color: 0xf5ead8,
      roughness: 0.82,
      metalness: 0.02,
    })
  );
  const canopyIronMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e3a34,
      roughness: 0.42,
      metalness: 0.65,
    })
  );
  const canopyGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: canopyGlassTex,
      emissiveMap: canopyGlassTex,
      emissive: 0xbae6fd,
      emissiveIntensity: 0.45,
      roughness: 0.22,
      metalness: 0.2,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    })
  );
  const turfMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x365314,
      roughness: 0.94,
      metalness: 0.02,
    })
  );
  const trunkMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x452c1e,
      roughness: 0.92,
    })
  );
  const foliageLightMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      roughness: 0.84,
      metalness: 0.02,
    })
  );
  const foliageDeepMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.86,
      metalness: 0.02,
    })
  );
  const suburbanFacadeMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xe5dec9,
      roughness: 0.78,
      metalness: 0.04,
    })
  );
  const slateRoofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.62,
      metalness: 0.22,
    })
  );
  const warmLanternMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfde68a,
      emissiveIntensity: 2.2,
      roughness: 0.18,
    })
  );

  // =========================================================================
  // 1. CONTINUOUS TWIN-TRACK GUIDEWAY (Follows trainX smoothly)
  // =========================================================================
  const trackGroup = new THREE.Group();
  const CORRIDOR_LEN = 380;

  // Base concrete invert slab + foreground cutaway ground apron (prevents sky bleed below near platform in Side View)
  const slab = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(CORRIDOR_LEN, 0.4, 10.6)),
    trackBedMat
  );
  slab.position.set(70, -0.25, -1.6);
  slab.receiveShadow = !isSoftwareGl;
  trackGroup.add(slab);

  const sideGroundApron = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(CORRIDOR_LEN, 0.42, 14.8)),
    trackBedMat
  );
  sideGroundApron.position.set(70, -0.26, 11.1);
  sideGroundApron.receiveShadow = !isSoftwareGl;
  trackGroup.add(sideGroundApron);

  // Guideway / Trackbed: Rubber-tired concrete rollway beams (Line 14) vs Steel Ballast (RER A)
  const beamGeo = trackGeo(new THREE.BoxGeometry(CORRIDOR_LEN, 0.16, 0.38));
  const railGeo = trackGeo(new THREE.BoxGeometry(CORRIDOR_LEN, 0.16, 0.1));
  for (const trackZ of [0, -3.6]) {
    if (!isRer) {
      for (const offset of [-0.98, 0.98]) {
        const beam = new THREE.Mesh(beamGeo, concreteBeamMat);
        beam.position.set(70, -0.02, trackZ + offset);
        trackGroup.add(beam);
      }
    }
    for (const railOff of [-0.72, 0.72]) {
      const rail = new THREE.Mesh(railGeo, steelRailMat);
      rail.position.set(70, 0.03, trackZ + railOff);
      trackGroup.add(rail);
    }
  }

  // RER A Overhead 1500V/25kV Catenary Wires + Messenger Cable + Instanced Support Portals
  const catenaryPortalCount = 12;
  let catenaryPortalInst: THREE.InstancedMesh | null = null;
  if (lineDef.hasOverheadCatenary) {
    const contactWireMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xb45309,
        roughness: 0.35,
        metalness: 0.78,
      })
    );
    const contactWireGeo = trackGeo(new THREE.BoxGeometry(CORRIDOR_LEN, 0.018, 0.018));
    const messengerWireGeo = trackGeo(new THREE.BoxGeometry(CORRIDOR_LEN, 0.015, 0.015));
    for (const trackZ of [0, -3.6]) {
      const cw = new THREE.Mesh(contactWireGeo, contactWireMat);
      cw.position.set(70, 4.68, trackZ);
      const mw = new THREE.Mesh(messengerWireGeo, steelRailMat);
      mw.position.set(70, 5.28, trackZ);
      trackGroup.add(cw, mw);
    }

    const portalArmGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.18, 6.2));
    catenaryPortalInst = new THREE.InstancedMesh(portalArmGeo, darkMetalMat, catenaryPortalCount);
    catenaryPortalInst.frustumCulled = false;
    root.add(catenaryPortalInst);
  }

  root.add(trackGroup);

  // Instanced Concrete / Ballast Sleepers across both tracks
  const SLEEPER_COUNT = 190;
  const sleeperGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.12, 2.35));
  const sleeperInstanced = new THREE.InstancedMesh(sleeperGeo, sleeperMat, SLEEPER_COUNT * 2);
  sleeperInstanced.frustumCulled = false;
  root.add(sleeperInstanced);

  // =========================================================================
  // 2. RECYCLED TBM TUNNEL RINGS, RIBS, LUMINAIRES & SORTIE MARKERS
  // =========================================================================
  const RING_STEP = 10;
  const RING_COUNT = 38; // 380m span
  const BORE_RADIUS = isRer ? 6.15 : 5.45;
  const BORE_CENTER_Y = isRer ? 2.92 : 2.55;
  const BORE_CENTER_Z = -1.35;

  // Split cylinder into FAR half (always visible in tunnel) and NEAR +Z half (hidden in Side View cutaway)
  // CylinderGeometry axis is Y by default; rotateZ(-PI/2) puts axis along X.
  // After rotateZ(-PI/2): local +X becomes -Y, local +Z stays +Z.
  // Let's build clean explicit arc shells using CylinderGeometry(r, r, len, segs, 1, true, thetaStart, thetaLength)
  // With rotateZ(Math.PI / 2):
  //   theta=0 -> (0, +r) -> stays +Z! Wait: in Three.js CylinderGeometry:
  //   x = r * sin(theta), z = r * cos(theta).
  //   After rotateZ(Math.PI / 2): x' = -y (along tunnel length), y' = x = r*sin(theta), z' = z = r*cos(theta).
  //   So:
  //     theta = 0       -> y' = 0,  z' = +r (NEAR +Z wall)
  //     theta = PI/2    -> y' = +r, z' = 0  (CROWN top)
  //     theta = PI      -> y' = 0,  z' = -r (FAR -Z wall)
  //     theta = 3*PI/2  -> y' = -r, z' = 0  (FLOOR invert)
  //   Therefore:
  //     FAR + CROWN cutaway arc = theta from 0.25*PI (upper-near shoulder) to 1.25*PI (lower-far floor)!
  //     NEAR cutaway arc        = theta from -0.25*PI to +0.25*PI (purely the +Z side wall)!

  const farShellGeo = trackGeo(
    new THREE.CylinderGeometry(
      BORE_RADIUS,
      BORE_RADIUS,
      RING_STEP + 0.15,
      18,
      1,
      true,
      Math.PI * 0.24,
      Math.PI * 1.04
    )
  );
  farShellGeo.rotateZ(Math.PI / 2);

  const nearShellGeo = trackGeo(
    new THREE.CylinderGeometry(
      BORE_RADIUS,
      BORE_RADIUS,
      RING_STEP + 0.15,
      8,
      1,
      true,
      -Math.PI * 0.24,
      Math.PI * 0.49
    )
  );
  nearShellGeo.rotateZ(Math.PI / 2);

  const farTunnelInst = new THREE.InstancedMesh(farShellGeo, tunnelLiningMat, RING_COUNT);
  farTunnelInst.frustumCulled = false;
  root.add(farTunnelInst);

  const nearTunnelInst = new THREE.InstancedMesh(nearShellGeo, tunnelLiningMat, RING_COUNT);
  nearTunnelInst.frustumCulled = false;
  root.add(nearTunnelInst);

  // Structural tunnel steel ribs (matching the far+crown arc so Side View sees bold repeating ribs)
  const ribGeo = trackGeo(
    new THREE.TorusGeometry(BORE_RADIUS - 0.14, 0.14, 6, 18, Math.PI * 1.05)
  );
  // Default Torus is in XY plane; rotateY(Math.PI/2) puts it in YZ plane!
  ribGeo.rotateY(Math.PI / 2);
  const ribInst = new THREE.InstancedMesh(ribGeo, tunnelRibMat, RING_COUNT);
  ribInst.frustumCulled = false;
  root.add(ribInst);

  // Warm overhead tunnel fluorescent luminaires
  const tunnelLightGeo = trackGeo(new THREE.BoxGeometry(2.6, 0.12, 0.28));
  const tunnelLightInst = new THREE.InstancedMesh(tunnelLightGeo, tunnelLightMat, RING_COUNT);
  tunnelLightInst.frustumCulled = false;
  root.add(tunnelLightInst);

  // Glowing green SORTIE emergency markers along far tunnel wall every 40m
  const SORTIE_COUNT = 10;
  const sortieGeo = trackGeo(new THREE.BoxGeometry(1.5, 0.56, 0.08));
  const sortieInst = new THREE.InstancedMesh(sortieGeo, sortieMat, SORTIE_COUNT);
  sortieInst.frustumCulled = false;
  root.add(sortieInst);

  // Tunnel utility pipes (red fire-main, dark cable conduits, yellow signal tray) — only inside tunnels!
  const fireMainMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      roughness: 0.44,
      metalness: 0.45,
    })
  );
  const fireMainSegGeo = trackGeo(new THREE.CylinderGeometry(0.085, 0.085, RING_STEP + 0.1, 8));
  fireMainSegGeo.rotateZ(Math.PI / 2);
  const fireMainInst = new THREE.InstancedMesh(fireMainSegGeo, fireMainMat, RING_COUNT);
  fireMainInst.frustumCulled = false;
  root.add(fireMainInst);

  const conduitSegGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.055, RING_STEP + 0.1, 6));
  conduitSegGeo.rotateZ(Math.PI / 2);
  const conduitInst = new THREE.InstancedMesh(conduitSegGeo, darkMetalMat, RING_COUNT * 2);
  conduitInst.frustumCulled = false;
  root.add(conduitInst);

  const cableTraySegGeo = trackGeo(new THREE.BoxGeometry(RING_STEP + 0.1, 0.06, 0.24));
  const cableTrayInst = new THREE.InstancedMesh(cableTraySegGeo, yellowSafetyMat, RING_COUNT);
  cableTrayInst.frustumCulled = false;
  root.add(cableTrayInst);

  // Blue RATP Emergency Telephone alcoves along far tunnel wall every 90m
  const PHONE_COUNT = 5;
  const phoneBoxGeo = trackGeo(new THREE.BoxGeometry(0.55, 0.92, 0.28));
  const phoneBoxMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0055a4,
      emissive: 0x003f7d,
      emissiveIntensity: 0.42,
      roughness: 0.36,
      metalness: 0.28,
    })
  );
  const phoneInst = new THREE.InstancedMesh(phoneBoxGeo, phoneBoxMat, PHONE_COUNT);
  phoneInst.frustumCulled = false;
  root.add(phoneInst);

  // =========================================================================
  // 2B. CONTINUOUS OUTDOOR SUBURBAN CORRIDOR POOL (RER A Outdoor Sections)
  // =========================================================================
  const outdoorCorridorSkyGroup = new THREE.Group();
  const outSkyFar = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(420, 56)),
    suburbanSkyMat
  );
  outSkyFar.position.set(60, 24, -28);
  const outSkyZenith = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(420, 66)),
    suburbanSkyMat
  );
  outSkyZenith.position.set(60, 32, -2);
  outSkyZenith.rotation.x = Math.PI / 2;
  const outSkyAhead = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(110, 44)),
    suburbanSkyMat
  );
  outSkyAhead.position.set(255, 22, -4);
  outSkyAhead.rotation.y = -Math.PI / 2;
  outdoorCorridorSkyGroup.add(outSkyFar, outSkyZenith, outSkyAhead);
  outdoorCorridorSkyGroup.visible = false;
  root.add(outdoorCorridorSkyGroup);

  const outGrassGeo = trackGeo(new THREE.BoxGeometry(RING_STEP + 0.25, 0.4, 15));
  const outWallGeo = trackGeo(new THREE.BoxGeometry(RING_STEP + 0.25, 2.6, 0.45));
  const outRailGeo = trackGeo(new THREE.BoxGeometry(RING_STEP + 0.25, 0.14, 0.14));
  const outTrunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 3.0, 6));
  const outFoliageGeo = trackGeo(new THREE.IcosahedronGeometry(1.75, 2));
  const outFoliageSubGeo = trackGeo(new THREE.IcosahedronGeometry(1.1, 2));
  const skylineBuildingGeo = trackGeo(new THREE.BoxGeometry(14, 14, 5.2));
  const skylineRoofGeo = trackGeo(new THREE.BoxGeometry(14.8, 0.65, 6.0));
  const outMastGeo = trackGeo(new THREE.BoxGeometry(0.24, 5.7, 0.24));

  const outTurfFarInst = new THREE.InstancedMesh(outGrassGeo, turfMat, RING_COUNT);
  const outWallFarInst = new THREE.InstancedMesh(outWallGeo, suburbanBrickMat, RING_COUNT);
  const outRailFarInst = new THREE.InstancedMesh(outRailGeo, canopyIronMat, RING_COUNT);
  const outTurfNearInst = new THREE.InstancedMesh(outGrassGeo, turfMat, RING_COUNT);
  const outWallNearInst = new THREE.InstancedMesh(outWallGeo, suburbanBrickMat, RING_COUNT);
  const outTreeTrunkInst = new THREE.InstancedMesh(outTrunkGeo, trunkMat, RING_COUNT);
  const outTreeCanopyInst = new THREE.InstancedMesh(outFoliageGeo, foliageDeepMat, RING_COUNT);
  const outTreeTrunkNearInst = new THREE.InstancedMesh(outTrunkGeo, trunkMat, RING_COUNT);
  const outTreeCanopyNearInst = new THREE.InstancedMesh(outFoliageGeo, foliageLightMat, RING_COUNT);
  const outTreeCanopyDetailFarInst = new THREE.InstancedMesh(outFoliageSubGeo, foliageLightMat, RING_COUNT);
  const outTreeCanopyDetailNearInst = new THREE.InstancedMesh(outFoliageSubGeo, foliageDeepMat, RING_COUNT);
  const SKYLINE_COUNT = 20;
  const skylineFarInst = new THREE.InstancedMesh(skylineBuildingGeo, distantFacadeMat, SKYLINE_COUNT);
  const skylineNearInst = new THREE.InstancedMesh(skylineBuildingGeo, distantFacadeMat, SKYLINE_COUNT);
  const skylineRoofFarInst = new THREE.InstancedMesh(skylineRoofGeo, slateRoofMat, SKYLINE_COUNT);
  const skylineRoofNearInst = new THREE.InstancedMesh(skylineRoofGeo, slateRoofMat, SKYLINE_COUNT);
  const outCatMastInst = new THREE.InstancedMesh(outMastGeo, darkMetalMat, catenaryPortalCount);

  for (const inst of [
    outTurfFarInst,
    outWallFarInst,
    outRailFarInst,
    outTurfNearInst,
    outWallNearInst,
    outTreeTrunkInst,
    outTreeCanopyInst,
    outTreeTrunkNearInst,
    outTreeCanopyNearInst,
    outTreeCanopyDetailFarInst,
    outTreeCanopyDetailNearInst,
    skylineFarInst,
    skylineNearInst,
    skylineRoofFarInst,
    skylineRoofNearInst,
    outCatMastInst,
  ]) {
    inst.frustumCulled = false;
    root.add(inst);
  }

  // =========================================================================
  // 3. TRACKSIDE SIGNALS, SPEED LIMIT SIGNS & DISTANCE COUNTDOWN BOARDS
  // =========================================================================
  // Active forward block signal mast (moves ahead of train every 160m)
  const signalGroup = new THREE.Group();
  const sigMast = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.08, 0.1, 3.6, 8)),
    darkMetalMat
  );
  sigMast.position.set(0, 1.8, 0);
  signalGroup.add(sigMast);
  const sigHousing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.32, 1.15, 0.42)),
    darkMetalMat
  );
  sigHousing.position.set(0, 3.3, 0);
  signalGroup.add(sigHousing);

  const sigGreenMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x00aa91,
      emissive: 0x00aa91,
      emissiveIntensity: 3.0,
      roughness: 0.2,
    })
  );
  const sigAmberMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.1,
      roughness: 0.2,
    })
  );
  const sigRedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.1,
      roughness: 0.2,
    })
  );
  const lensGeo = trackGeo(new THREE.SphereGeometry(0.11, 10, 10));
  const lensG = new THREE.Mesh(lensGeo, sigGreenMat);
  lensG.position.set(-0.14, 3.62, 0);
  const lensA = new THREE.Mesh(lensGeo, sigAmberMat);
  lensA.position.set(-0.14, 3.3, 0);
  const lensR = new THREE.Mesh(lensGeo, sigRedMat);
  lensR.position.set(-0.14, 2.98, 0);
  signalGroup.add(lensG, lensA, lensR);
  root.add(signalGroup);

  // Next Speed Limit Signpost
  const speedSignGroup = new THREE.Group();
  const signPost = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 2.6, 8)),
    darkMetalMat
  );
  signPost.position.set(0, 1.3, 0);
  speedSignGroup.add(signPost);
  const speedDiscMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: speedTexMap[60],
      emissiveMap: speedTexMap[60],
      emissive: 0xffffff,
      emissiveIntensity: 0.45,
      transparent: true,
      roughness: 0.35,
    })
  );
  const speedDiscMesh = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.92, 0.92)),
    speedDiscMat
  );
  speedDiscMesh.position.set(-0.08, 2.45, 0);
  speedDiscMesh.rotation.y = -Math.PI / 2; // faces approaching train (-X)
  speedSignGroup.add(speedDiscMesh);
  // Back-side readable disc for Side View
  const speedDiscSide = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.85, 0.85)),
    speedDiscMat
  );
  speedDiscSide.position.set(0, 2.45, 0.06);
  speedSignGroup.add(speedDiscSide);
  root.add(speedSignGroup);

  // Station approach distance countdown boards (300m, 200m, 100m, 50m)
  const distBoardMeshes: { distM: number; group: THREE.Group }[] = [];
  const distPlaneGeo = trackGeo(new THREE.PlaneGeometry(1.15, 0.58));
  for (const d of distValues) {
    const g = new THREE.Group();
    const post = new THREE.Mesh(
      trackGeo(new THREE.CylinderGeometry(0.045, 0.05, 2.1, 6)),
      darkMetalMat
    );
    post.position.set(0, 1.05, 0);
    g.add(post);

    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        map: distTexMap[d],
        emissiveMap: distTexMap[d],
        emissive: 0xffffff,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      })
    );
    const faceFront = new THREE.Mesh(distPlaneGeo, mat);
    faceFront.position.set(-0.06, 2.05, 0);
    faceFront.rotation.y = -Math.PI / 2;
    g.add(faceFront);

    const faceSide = new THREE.Mesh(distPlaneGeo, mat);
    faceSide.position.set(0, 2.05, 0.05);
    g.add(faceSide);

    root.add(g);
    distBoardMeshes.push({ distM: d, group: g });
  }

  // =========================================================================
  // 3B. 3D AUTOMATED TUNNEL SPEED CAMERA GANTRY & ADVANCE RADAR SIGNPOST
  // =========================================================================
  const radarWarningGroup = new THREE.Group();
  const radarWarnPost = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.05, 0.06, 2.5, 8)),
    darkMetalMat
  );
  radarWarnPost.position.set(0, 1.25, 0);
  radarWarningGroup.add(radarWarnPost);

  const radarSignMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: radarSignTexMap[60],
      emissiveMap: radarSignTexMap[60],
      emissive: 0xffffff,
      emissiveIntensity: 0.42,
      roughness: 0.35,
    })
  );
  const radarSignFront = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.88, 0.88)),
    radarSignMat
  );
  radarSignFront.position.set(-0.07, 2.38, 0);
  radarSignFront.rotation.y = -Math.PI / 2;
  const radarSignSide = new THREE.Mesh(
    trackGeo(new THREE.PlaneGeometry(0.84, 0.84)),
    radarSignMat
  );
  radarSignSide.position.set(0, 2.38, 0.05);
  radarWarningGroup.add(radarSignFront, radarSignSide);
  root.add(radarWarningGroup);

  // 3D Speed Camera Gantry & Sensor Unit with Strobe Bulb + PointLight
  const radarGantryGroup = new THREE.Group();
  const gantryPole = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.07, 0.085, 3.65, 8)),
    darkMetalMat
  );
  gantryPole.position.set(0, 1.825, 0);
  radarGantryGroup.add(gantryPole);

  const gantryArm = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.14, 0.14, 1.1)),
    darkMetalMat
  );
  gantryArm.position.set(0, 3.45, 0.45);
  radarGantryGroup.add(gantryArm);

  const radarHousing = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.55, 0.68, 0.44)),
    darkMetalMat
  );
  radarHousing.position.set(0, 3.25, 0.92);
  radarGantryGroup.add(radarHousing);

  const radarHazardTrim = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.57, 0.14, 0.46)),
    yellowSafetyMat
  );
  radarHazardTrim.position.set(0, 3.55, 0.92);
  radarGantryGroup.add(radarHazardTrim);

  const radarLensMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.08,
      metalness: 0.85,
    })
  );
  const radarLens = new THREE.Mesh(
    trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12)),
    radarLensMat
  );
  radarLens.rotation.z = Math.PI / 2;
  radarLens.position.set(-0.29, 3.12, 0.92);
  radarGantryGroup.add(radarLens);

  const radarBulbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.35,
      roughness: 0.12,
    })
  );
  const radarStrobeBulb = new THREE.Mesh(
    trackGeo(new THREE.BoxGeometry(0.08, 0.16, 0.26)),
    radarBulbMat
  );
  radarStrobeBulb.position.set(-0.29, 3.36, 0.92);
  radarGantryGroup.add(radarStrobeBulb);

  const radarFlashLight = new THREE.PointLight(0xf0f9ff, 0, 58, 1.25);
  radarFlashLight.position.set(-0.4, 3.36, 0.92);
  radarGantryGroup.add(radarFlashLight);

  root.add(radarGantryGroup);

  // =========================================================================
  // 4. TWO-SLOT VAULTED STATION CAVERN POOL (PSDs on M14, Open Express Platforms on RER A)
  // =========================================================================
  const STATION_LEN = isRer ? 148 : 120; // x = -124..+24 (RER A) or -96..+24 (M14)
  const STATION_CENTER_OFFSET = isRer ? -50 : -36;

  const headGeo = trackGeo(new THREE.SphereGeometry(0.14, 16, 12));
  const torsoGeo = trackGeo(new THREE.CapsuleGeometry(0.18, 0.34, 4, 10));
  const legGeo = trackGeo(new THREE.CapsuleGeometry(0.068, 0.46, 3, 8));
  const armGeo = trackGeo(new THREE.CapsuleGeometry(0.052, 0.4, 3, 8));
  const neckGeo = trackGeo(new THREE.CylinderGeometry(0.055, 0.065, 0.13, 10));
  const hairCapGeo = trackGeo(new THREE.SphereGeometry(0.146, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56));
  const eyeGeo = trackGeo(new THREE.SphereGeometry(0.012, 8, 6));
  const noseGeo = trackGeo(new THREE.SphereGeometry(0.024, 8, 6));
  const mouthGeo = trackGeo(new THREE.SphereGeometry(0.018, 8, 6));
  const shoeGeo = trackGeo(new THREE.SphereGeometry(0.085, 10, 8));
  const handGeo = trackGeo(new THREE.SphereGeometry(0.058, 9, 7));
  const fringeGeo = trackGeo(new THREE.SphereGeometry(0.105, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.38));
  const bagGeo = trackGeo(new THREE.BoxGeometry(0.32, 0.34, 0.16));
  const bagStrapGeo = trackGeo(new THREE.BoxGeometry(0.055, 0.38, 0.035));
  const bagPocketGeo = trackGeo(new THREE.BoxGeometry(0.22, 0.12, 0.045));
  const collarGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.1, 0.2));
  const faceDetailMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x201a18, roughness: 0.72 }));
  const shirtMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd9e0e8, roughness: 0.82 }));
  const shoePalette = [0x111820, 0x262a31, 0x463b34, 0x313c48];
  const coatPalette = [0x24374c, 0x59616b, 0x4c3d58, 0x34534f, 0x714d3d, 0x29333c, 0x6c4650, 0x7a705e, 0x36465c, 0x8b593b, 0x465d70, 0x3d4b3e];
  const trouserPalette = [0x172536, 0x343b45, 0x4a4c51, 0x4b3d35, 0x243b3a, 0x55565a];
  const skinPalette = [0xf0c9a7, 0xdca77f, 0xb97853, 0x8f5b43, 0x684331, 0xe8b995, 0xc78d6a, 0xf3d3b6];
  const hairPalette = [0x171719, 0x3a281f, 0x694a32, 0x9b784e, 0x5a5d61, 0x211c24, 0x8a4632];
  const bagPalette = [0x202a35, 0x3a4147, 0x65503b, 0x273c43, 0x4a384d];

  function buildStationSlot(): StationSlot {
    const sRoot = new THREE.Group();

    // --- STYLE GROUP A: Vaulted Underground Cavern (Line 14 & Standard RER A) ---
    const vaultGroup = new THREE.Group();

    const vaultGeo = trackGeo(
      new THREE.CylinderGeometry(
        7.8,
        7.8,
        STATION_LEN,
        24,
        1,
        true,
        Math.PI * 0.18,
        Math.PI * 0.96
      )
    );
    vaultGeo.rotateZ(Math.PI / 2);
    const vaultMesh = new THREE.Mesh(vaultGeo, stationVaultMat);
    vaultMesh.position.set(STATION_CENTER_OFFSET, 1.4, 0.2);
    vaultGroup.add(vaultMesh);

    const stRibGeo = trackGeo(new THREE.TorusGeometry(7.62, 0.18, 6, 22, Math.PI * 0.95));
    stRibGeo.rotateY(Math.PI / 2);
    for (let rx = -104; rx <= 22; rx += 12) {
      const rib = new THREE.Mesh(stRibGeo, stationArchRibMat);
      rib.position.set(rx, 1.4, 0.2);
      rib.rotation.x = -Math.PI * 0.18;
      vaultGroup.add(rib);
    }

    const coveGeo = trackGeo(new THREE.BoxGeometry(STATION_LEN - 4, 0.2, 0.35));
    const coveFar = new THREE.Mesh(coveGeo, coveLightMat);
    coveFar.position.set(STATION_CENTER_OFFSET, 5.75, -5.0);
    vaultGroup.add(coveFar);
    const coveNear = new THREE.Mesh(coveGeo, coveLightMat);
    coveNear.position.set(STATION_CENTER_OFFSET, 6.25, 3.6);
    vaultGroup.add(coveNear);

    const farWall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 4.4, 0.4)),
      stationWallMat
    );
    farWall.position.set(STATION_CENTER_OFFSET, 2.2, -6.3);
    vaultGroup.add(farWall);

    const farPurpleStripe = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 0.24, 0.08)),
      purpleFasciaMat
    );
    farPurpleStripe.position.set(STATION_CENTER_OFFSET, 4.15, -6.08);
    vaultGroup.add(farPurpleStripe);

    const baffleGeo = trackGeo(new THREE.BoxGeometry(0.28, 0.42, 9.6));
    for (let rx = -98; rx <= 16; rx += 12) {
      const baffle = new THREE.Mesh(baffleGeo, stationArchRibMat);
      baffle.position.set(rx, 6.75, -0.6);
      vaultGroup.add(baffle);
    }
    sRoot.add(vaultGroup);

    // --- STYLE GROUP B: RER A 1970s Central Cavern Extras (Mezzanine Bridges + Ceramic Band) ---
    const rerMezzanineGroup = new THREE.Group();
    rerMezzanineGroup.visible = false;
    const ceramicBand = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 2, 0.42, 0.09)),
      rerCeramicBandMat
    );
    ceramicBand.position.set(STATION_CENTER_OFFSET, 3.76, -6.07);
    rerMezzanineGroup.add(ceramicBand);

    const footbridgeDeckGeo = trackGeo(new THREE.BoxGeometry(5.2, 0.38, 12.6));
    const footbridgeRailGeo = trackGeo(new THREE.BoxGeometry(0.14, 1.05, 12.6));
    for (const fx of [-84, -22]) {
      const deck = new THREE.Mesh(footbridgeDeckGeo, benchMetalMat);
      deck.position.set(fx, 5.72, -0.3);
      const railL = new THREE.Mesh(footbridgeRailGeo, darkMetalMat);
      railL.position.set(fx - 2.45, 6.4, -0.3);
      const railR = new THREE.Mesh(footbridgeRailGeo, darkMetalMat);
      railR.position.set(fx + 2.45, 6.4, -0.3);
      const underGlow = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.6, 0.08, 11.4)),
        coveLightMat
      );
      underGlow.position.set(fx, 5.5, -0.3);
      rerMezzanineGroup.add(deck, railL, railR, underGlow);
    }
    if (!lineDef.hasPlatformScreenDoors) {
      const canopyBeam = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(STATION_LEN - 6, 0.22, 0.28)),
        purpleFasciaMat
      );
      canopyBeam.position.set(STATION_CENTER_OFFSET, 4.95, 2.6);
      rerMezzanineGroup.add(canopyBeam);
    }
    sRoot.add(rerMezzanineGroup);

    // --- STYLE GROUP C: La Défense (Grande Arche) Monumental Coffered Concrete Hall ---
    const laDefenseGroup = new THREE.Group();
    laDefenseGroup.visible = false;

    // Flat coffered brutalist ceiling slab (open slightly higher at y=8.55)
    const defCeiling = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 0.45, 13.8)),
      defenseConcreteMat
    );
    defCeiling.position.set(STATION_CENTER_OFFSET, 8.6, 0.0);
    laDefenseGroup.add(defCeiling);

    // Far monumental architectural wall + brushed aluminum cornice + RER blue ribbon
    const defFarWall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 8.6, 0.45)),
      defenseConcreteMat
    );
    defFarWall.position.set(STATION_CENTER_OFFSET, 4.3, -6.32);
    laDefenseGroup.add(defFarWall);

    const defBlueBand = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 0.3, 0.12)),
      defenseBlueAccentMat
    );
    defBlueBand.position.set(STATION_CENTER_OFFSET, 4.2, -6.06);
    laDefenseGroup.add(defBlueBand);

    // Upper mezzanine glass gallery balcony along far side (z=-4.8, y=4.95)
    const defMezzSlab = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 8, 0.35, 2.2)),
      defenseConcreteMat
    );
    defMezzSlab.position.set(STATION_CENTER_OFFSET, 4.95, -5.15);
    const defMezzGlass = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 8, 1.15, 0.08)),
      psdGlassMat
    );
    defMezzGlass.position.set(STATION_CENTER_OFFSET, 5.7, -4.12);
    const defMezzRail = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 8, 0.12, 0.16)),
      benchMetalMat
    );
    defMezzRail.position.set(STATION_CENTER_OFFSET, 6.28, -4.12);
    laDefenseGroup.add(defMezzSlab, defMezzGlass, defMezzRail);

    // Monumental dark-steel structural I-beam cross-trusses + glowing atrium skylights
    const defTrussGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.72, 13.4));
    const defSkylightGeo = trackGeo(new THREE.BoxGeometry(8.5, 0.14, 5.6));
    const vPierGeo = trackGeo(new THREE.BoxGeometry(0.62, 7.8, 0.72));
    for (let dx = -108; dx <= 16; dx += 14) {
      const truss = new THREE.Mesh(defTrussGeo, stationArchRibMat);
      truss.position.set(dx, 8.02, 0.0);
      laDefenseGroup.add(truss);

      if (dx + 7 <= 16) {
        const skylight = new THREE.Mesh(defSkylightGeo, defenseSkylightMat);
        skylight.position.set(dx + 7, 8.32, -0.4);
        laDefenseGroup.add(skylight);
      }

      // Iconic splayed V-piers along far platform wall
      const farPierL = new THREE.Mesh(vPierGeo, defenseConcreteMat);
      farPierL.position.set(dx - 0.85, 4.35, -5.65);
      farPierL.rotation.z = -0.18;
      const farPierR = new THREE.Mesh(vPierGeo, defenseConcreteMat);
      farPierR.position.set(dx + 0.85, 4.35, -5.65);
      farPierR.rotation.z = 0.18;
      laDefenseGroup.add(farPierL, farPierR);
    }

    // Near-side La Défense structural wall & piers (hidden in Side View cutaway so camera stays unobstructed)
    const nearDefensePiers = new THREE.Group();
    const nearDefWall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 8.6, 0.45)),
      defenseConcreteMat
    );
    nearDefWall.position.set(STATION_CENTER_OFFSET, 4.3, 6.75);
    const nearDefBlueBand = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 0.3, 0.12)),
      defenseBlueAccentMat
    );
    nearDefBlueBand.position.set(STATION_CENTER_OFFSET, 4.2, 6.49);
    nearDefensePiers.add(nearDefWall, nearDefBlueBand);

    for (let dx = -108; dx <= 16; dx += 14) {
      const nearPierL = new THREE.Mesh(vPierGeo, defenseConcreteMat);
      nearPierL.position.set(dx - 0.85, 4.35, 5.85);
      nearPierL.rotation.z = -0.18;
      const nearPierR = new THREE.Mesh(vPierGeo, defenseConcreteMat);
      nearPierR.position.set(dx + 0.85, 4.35, 5.85);
      nearPierR.rotation.z = 0.18;
      nearDefensePiers.add(nearPierL, nearPierR);
    }
    laDefenseGroup.add(nearDefensePiers);
    sRoot.add(laDefenseGroup);

    // --- STYLE GROUP D: Vincennes Open-Cut Suburban Daylight Trench ---
    const vincennesGroup = new THREE.Group();
    vincennesGroup.visible = false;

    // Bright Parisian open daytime sky dome/surround (far -Z wall, overhead zenith, +X/-X horizon planes)
    const skyBackdrop = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(290, 44)),
      suburbanSkyMat
    );
    skyBackdrop.position.set(STATION_CENTER_OFFSET, 20, -24);
    vincennesGroup.add(skyBackdrop);

    const skyZenith = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(290, 54)),
      suburbanSkyMat
    );
    skyZenith.position.set(STATION_CENTER_OFFSET, 27, 0);
    skyZenith.rotation.x = Math.PI / 2;
    vincennesGroup.add(skyZenith);

    const skyForwardEnd = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(80, 24)),
      suburbanSkyMat
    );
    skyForwardEnd.position.set(94, 22.0, 0);
    skyForwardEnd.rotation.y = -Math.PI / 2;
    const skyRearEnd = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(80, 24)),
      suburbanSkyMat
    );
    skyRearEnd.position.set(-194, 22.0, 0);
    skyRearEnd.rotation.y = Math.PI / 2;
    vincennesGroup.add(skyForwardEnd, skyRearEnd);

    // Suburban warm brick & limestone retaining embankment walls
    const subFarWall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN + 24, 4.8, 0.55)),
      suburbanBrickMat
    );
    subFarWall.position.set(STATION_CENTER_OFFSET, 2.4, -6.4);
    vincennesGroup.add(subFarWall);

    // Upper wrought-iron suburban trench guardrail atop far embankment
    const ironRailGeo = trackGeo(new THREE.BoxGeometry(STATION_LEN + 24, 0.12, 0.12));
    const subFarRail = new THREE.Mesh(ironRailGeo, canopyIronMat);
    subFarRail.position.set(STATION_CENTER_OFFSET, 5.45, -6.3);
    vincennesGroup.add(subFarRail);

    // Grass embankment terrace behind far wall + suburban trees + Parisian Haussmann buildings
    const turfTerrace = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN + 48, 0.35, 11.5)),
      turfMat
    );
    turfTerrace.position.set(STATION_CENTER_OFFSET, 4.75, -12.1);
    vincennesGroup.add(turfTerrace);

    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.18, 0.28, 2.8, 7));
    const canopyMainGeo = trackGeo(new THREE.IcosahedronGeometry(1.55, 1));
    const canopySubGeo = trackGeo(new THREE.IcosahedronGeometry(1.15, 1));
    for (let tx = -118; tx <= 32; tx += 15) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(tx, 6.2, -9.2);
      const leaf1 = new THREE.Mesh(
        canopyMainGeo,
        Math.abs(tx) % 30 < 15 ? foliageDeepMat : foliageLightMat
      );
      leaf1.position.set(tx, 8.2, -9.2);
      const leaf2 = new THREE.Mesh(canopySubGeo, foliageLightMat);
      leaf2.position.set(tx + 0.9, 7.6, -9.5);
      const leaf3 = new THREE.Mesh(canopySubGeo, foliageDeepMat);
      leaf3.position.set(tx - 0.85, 7.75, -8.9);
      vincennesGroup.add(trunk, leaf1, leaf2, leaf3);
    }

    // Suburban Parisian apartment blocks & pitched slate roofs rising behind the trench (-Z)
    const bldgHeights = [7.4, 9.2, 6.8, 8.5, 9.6, 7.2];
    for (let bi = 0; bi < bldgHeights.length; bi++) {
      const bx = -108 + bi * 26;
      const bh = bldgHeights[bi];
      const bWidth = 18.5;
      const facade = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(bWidth, bh, 4.8)),
        suburbanFacadeMat
      );
      facade.position.set(bx, 4.9 + bh * 0.5, -15.4);
      const mansard = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(bWidth + 0.4, 2.2, 5.1)),
        slateRoofMat
      );
      mansard.position.set(bx, 4.9 + bh + 1.0, -15.4);
      vincennesGroup.add(facade, mansard);
    }

    // Limestone bridge overpasses shown ONLY at outdoor <-> tunnel portal mouths
    const portalDeckGeo = trackGeo(new THREE.BoxGeometry(8.0, 1.35, 24));
    const portalParapetGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.95, 24));
    const portalWingGeo = trackGeo(new THREE.BoxGeometry(4.8, 9.5, 4.4));

    const buildPortalBridge = (px: number): THREE.Group => {
      const pg = new THREE.Group();
      const deck = new THREE.Mesh(portalDeckGeo, suburbanBrickMat);
      deck.position.set(px, 9.25, -0.8);
      const parapet = new THREE.Mesh(portalParapetGeo, canopyIronMat);
      parapet.position.set(px + (px > 0 ? -3.8 : 3.8), 10.35, -0.8);
      const wingL = new THREE.Mesh(portalWingGeo, suburbanBrickMat);
      wingL.position.set(px, 4.7, -9.5);
      const wingR = new THREE.Mesh(portalWingGeo, suburbanBrickMat);
      wingR.position.set(px, 4.7, 8.8);
      pg.add(deck, parapet, wingL, wingR);

      for (const tz of [-7.5, 0, 7.5]) {
        const pTrunk = new THREE.Mesh(trunkGeo, trunkMat);
        pTrunk.position.set(px + (px > 0 ? 4.2 : -4.2), 11.0, tz);
        const pLeaf = new THREE.Mesh(canopyMainGeo, foliageLightMat);
        pLeaf.position.set(px + (px > 0 ? 4.2 : -4.2), 13.0, tz);
        pg.add(pTrunk, pLeaf);
      }
      const bridgeRoof = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(10, 6.2, 24)),
        suburbanFacadeMat
      );
      bridgeRoof.position.set(px + (px > 0 ? 15 : -15), 12.8, -0.5);
      const bridgeMansard = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(10.5, 2.2, 24.4)),
        slateRoofMat
      );
      bridgeMansard.position.set(px + (px > 0 ? 15 : -15), 16.9, -0.5);
      pg.add(bridgeRoof, bridgeMansard);
      return pg;
    };

    const subPortalFwd = buildPortalBridge(28.0);
    const subPortalRear = buildPortalBridge(-128.0);
    vincennesGroup.add(subPortalFwd, subPortalRear);

    // Cantilevered Steel & Glazed Suburban Marquise Canopy over main platform (+Z)
    const canopyRoofMain = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 6, 0.14, 4.65)),
      canopyGlassMat
    );
    canopyRoofMain.position.set(STATION_CENTER_OFFSET, 5.25, 4.15);
    canopyRoofMain.rotation.x = -0.09;
    vincennesGroup.add(canopyRoofMain);

    const canopyEdgeTrim = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 6, 0.24, 0.14)),
      canopyIronMat
    );
    canopyEdgeTrim.position.set(STATION_CENTER_OFFSET, 5.04, 1.85);
    vincennesGroup.add(canopyEdgeTrim);

    // Matching far-platform shelter canopy (-Z)
    const canopyRoofFar = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 10, 0.12, 2.1)),
      canopyGlassMat
    );
    canopyRoofFar.position.set(STATION_CENTER_OFFSET, 4.7, -5.35);
    canopyRoofFar.rotation.x = 0.08;
    vincennesGroup.add(canopyRoofFar);

    const canopyColGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.15, 4.35, 8));
    const canopyBracketGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.22, 4.2));
    const lanternGeo = trackGeo(new THREE.SphereGeometry(0.22, 10, 8));
    for (let cx = -106; cx <= 16; cx += 14) {
      const col = new THREE.Mesh(canopyColGeo, canopyIronMat);
      col.position.set(cx, 3.02, 4.65);
      const bracket = new THREE.Mesh(canopyBracketGeo, canopyIronMat);
      bracket.position.set(cx, 5.12, 3.9);
      bracket.rotation.x = -0.09;
      const lantern = new THREE.Mesh(lanternGeo, warmLanternMat);
      lantern.position.set(cx, 4.78, 2.4);
      vincennesGroup.add(col, bracket, lantern);
    }

    // Near-side (+Z) Vincennes embankment, trees, Haussmann facades & sky backdrop (hidden in Side View!)
    const nearVincennesSurround = new THREE.Group();
    const nearBrickWall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN + 24, 4.8, 0.55)),
      suburbanBrickMat
    );
    nearBrickWall.position.set(STATION_CENTER_OFFSET, 2.4, 6.8);
    const nearRail = new THREE.Mesh(ironRailGeo, canopyIronMat);
    nearRail.position.set(STATION_CENTER_OFFSET, 5.45, 6.7);
    const nearTerrace = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN + 48, 0.35, 11.5)),
      turfMat
    );
    nearTerrace.position.set(STATION_CENTER_OFFSET, 4.75, 12.5);
    const skyBackdropNear = new THREE.Mesh(
      trackGeo(new THREE.PlaneGeometry(290, 44)),
      suburbanSkyMat
    );
    skyBackdropNear.position.set(STATION_CENTER_OFFSET, 20, 24);
    nearVincennesSurround.add(nearBrickWall, nearRail, nearTerrace, skyBackdropNear);

    for (let tx = -118; tx <= 32; tx += 15) {
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(tx, 6.2, 9.6);
      const leaf = new THREE.Mesh(canopyMainGeo, foliageDeepMat);
      leaf.position.set(tx, 8.2, 9.6);
      nearVincennesSurround.add(trunk, leaf);
    }
    for (let bi = 0; bi < bldgHeights.length; bi++) {
      const bx = -108 + bi * 26;
      const bh = bldgHeights[bi];
      const bWidth = 18.5;
      const facade = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(bWidth, bh, 4.8)),
        suburbanFacadeMat
      );
      facade.position.set(bx, 4.9 + bh * 0.5, 15.8);
      const mansard = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(bWidth + 0.4, 2.2, 5.1)),
        slateRoofMat
      );
      mansard.position.set(bx, 4.9 + bh + 1.0, 15.8);
      nearVincennesSurround.add(facade, mansard);
    }

    vincennesGroup.add(nearVincennesSurround);
    sRoot.add(vincennesGroup);

    // --- COMMON STATION INFRASTRUCTURE (All Styles) ---
    const farPlatform = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 0.9, 1.8)),
      platformDeckMat
    );
    farPlatform.position.set(STATION_CENTER_OFFSET, 0.4, -5.4);
    sRoot.add(farPlatform);

    // 3) Parisian RATP Blue Enamel Station Nameplates (3 along far wall)
    const signMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: stationSignTextures[0],
        emissiveMap: stationSignTextures[0],
        emissive: 0xffffff,
        emissiveIntensity: 0.28,
        roughness: 0.24,
        metalness: 0.12,
      })
    );
    const signGeo = trackGeo(new THREE.BoxGeometry(5.6, 1.35, 0.12));
    for (const sx of [-64, -34, -6]) {
      const plaque = new THREE.Mesh(signGeo, signMat);
      plaque.position.set(sx, 3.05, -6.02);
      sRoot.add(plaque);
    }

    // Modern metallic benches along far platform + illuminated RATP plan totems
    const benchGeo = trackGeo(new THREE.BoxGeometry(2.6, 0.45, 0.65));
    for (const bx of [-74, -50, -20, 4]) {
      const bench = new THREE.Mesh(benchGeo, benchMetalMat);
      bench.position.set(bx, 1.08, -5.65);
      sRoot.add(bench);

      // Seat supports, end cheeks and a narrow back rail make the furniture read as a real bench.
      const benchLegGeo = trackGeo(new THREE.BoxGeometry(0.12, 0.34, 0.12));
      const benchBackGeo = trackGeo(new THREE.BoxGeometry(2.5, 0.07, 0.09));
      for (const lx of [-0.94, 0.94]) {
        const leg = new THREE.Mesh(benchLegGeo, darkMetalMat);
        leg.position.set(bx + lx, 0.69, -5.65);
        sRoot.add(leg);
      }
      const backRail = new THREE.Mesh(benchBackGeo, benchMetalMat);
      backRail.position.set(bx, 1.34, -5.94);
      sRoot.add(backRail);
      for (let slat = 0; slat < 5; slat++) {
        const backSlat = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(2.3, 0.035, 0.045)),
          benchMetalMat
        );
        backSlat.position.set(bx, 1.13 + slat * 0.045, -5.93);
        sRoot.add(backSlat);
      }
    }

    const totemMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: totemTex,
        emissiveMap: totemTex,
        emissive: 0xffffff,
        emissiveIntensity: 0.25,
        roughness: 0.3,
      })
    );
    const totemFrameGeo = trackGeo(new THREE.BoxGeometry(0.95, 2.1, 0.16));
    const totemFaceGeo = trackGeo(new THREE.PlaneGeometry(0.82, 1.72));
    for (const txOff of [-58, -12]) {
      const totemGroup = new THREE.Group();
      totemGroup.position.set(txOff, 1.9, -5.85);
      const tBody = new THREE.Mesh(totemFrameGeo, darkMetalMat);
      const tFace = new THREE.Mesh(totemFaceGeo, totemMat);
      tFace.position.set(0, 0.08, 0.09);
      totemGroup.add(tBody, tFace);
      sRoot.add(totemGroup);
    }

    // 4) Main Foreground Platform Deck (+Z = +1.42 .. +6.8, y = 0.85)
    const mainPlatform = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 0.9, 5.4)),
      platformDeckMat
    );
    mainPlatform.position.set(STATION_CENTER_OFFSET, 0.4, 4.12);
    mainPlatform.receiveShadow = !isSoftwareGl;
    sRoot.add(mainPlatform);

    // Yellow tactile platform edge safety stripe
    const edgeStripe = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 0.03, 0.22)),
      yellowSafetyMat
    );
    edgeStripe.position.set(STATION_CENTER_OFFSET, 0.86, 1.72);
    sRoot.add(edgeStripe);

    // Raised tactile paving behind the warning stripe, with a repeated studded surface texture.
    const tactileStrip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 1.5, 0.035, 0.52)),
      tactileTileMat
    );
    tactileStrip.position.set(STATION_CENTER_OFFSET, 0.87, 2.15);
    tactileStrip.receiveShadow = !isSoftwareGl;
    sRoot.add(tactileStrip);

    const farTactileStrip = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN - 1.5, 0.035, 0.42)),
      tactileTileMat
    );
    farTactileStrip.position.set(STATION_CENTER_OFFSET, 0.87, -4.84);
    sRoot.add(farTactileStrip);

    // Small expansion joints and recessed service covers on the platform surface.
    const platformJointGeo = trackGeo(new THREE.BoxGeometry(0.035, 0.012, 4.8));
    const platformJointMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x566171, roughness: 0.82, metalness: 0.12 })
    );
    for (let jointX = -104; jointX <= 28; jointX += 16) {
      const joint = new THREE.Mesh(platformJointGeo, platformJointMat);
      joint.position.set(jointX, 0.858, 4.16);
      sRoot.add(joint);
    }

    // Yellow ARRÊT target bar painted across platform + upright ARRÊT board right at x = 0 (stopX)
    const targetStripe = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.45, 0.035, 2.4)),
      yellowSafetyMat
    );
    targetStripe.position.set(0, 0.865, 2.8);
    sRoot.add(targetStripe);

    // Near-side (+Z) station wall + purple trim (enclosed in Cab/Chase views, hidden in Side cutaway)
    const nearWall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(STATION_LEN, 5.8, 0.4)),
      stationWallMat
    );
    nearWall.position.set(STATION_CENTER_OFFSET, 3.0, 6.75);
    sRoot.add(nearWall);

    // Wall-mounted campaign panels and compact CCTV domes give each station a lived-in scale.
    const posterFrameGeo = trackGeo(new THREE.BoxGeometry(3.35, 1.96, 0.14));
    const posterFaceGeo = trackGeo(new THREE.PlaneGeometry(3.08, 1.68));
    for (const posterX of [-88, -48, -8]) {
      const posterFrame = new THREE.Mesh(posterFrameGeo, darkMetalMat);
      posterFrame.position.set(posterX, 3.15, 6.47);
      const posterFace = new THREE.Mesh(posterFaceGeo, posterMat);
      posterFace.position.set(posterX, 3.15, 6.385);
      posterFace.rotation.y = Math.PI;
      sRoot.add(posterFrame, posterFace);
    }

    const cctvBodyGeo = trackGeo(new THREE.BoxGeometry(0.42, 0.22, 0.3));
    const cctvArmGeo = trackGeo(new THREE.BoxGeometry(0.09, 0.34, 0.1));
    const cctvLensGeo = trackGeo(new THREE.CylinderGeometry(0.075, 0.075, 0.08, 12));
    for (const cameraX of [-96, -36, 22]) {
      const cameraBody = new THREE.Mesh(cctvBodyGeo, benchMetalMat);
      cameraBody.position.set(cameraX, 5.42, 6.45);
      const cameraArm = new THREE.Mesh(cctvArmGeo, darkMetalMat);
      cameraArm.position.set(cameraX, 5.2, 6.57);
      const cameraLens = new THREE.Mesh(cctvLensGeo, cameraLensMat);
      cameraLens.rotation.x = Math.PI / 2;
      cameraLens.position.set(cameraX, 5.42, 6.27);
      sRoot.add(cameraBody, cameraArm, cameraLens);

      // Small perforated speaker / PA housing beside the camera.
      const paBox = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.48, 0.16, 0.1)),
        darkMetalMat
      );
      paBox.position.set(cameraX + 2.1, 5.36, 6.5);
      sRoot.add(paBox);
      for (let grille = 0; grille < 5; grille++) {
        const grilleSlot = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.025, 0.095, 0.012)),
          cameraLensMat
        );
        grilleSlot.position.set(cameraX + 1.93 + grille * 0.085, 5.36, 6.44);
        sRoot.add(grilleSlot);
      }
    }

    const stopBoard = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(0.12, 0.56, 1.05)),
      stopBoardMat
    );
    stopBoard.position.set(0.1, 2.55, 2.15);
    sRoot.add(stopBoard);

    // Side-readable ARRÊT flag above PSD header at x=0
    const stopBoardSide = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(1.38, 0.62, 0.12)),
      stopBoardMat
    );
    stopBoardSide.position.set(0, 3.62, 1.55);
    sRoot.add(stopBoardSide);

    // 5) Hanging SIEL Overhead Departure LED Displays
    const sielMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: stationSielTextures[0],
        emissiveMap: stationSielTextures[0],
        emissive: 0xffffff,
        emissiveIntensity: 0.75,
        roughness: 0.25,
      })
    );
    const sielBoxGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.88, 2.2));
    const hangerGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6));
    hangerGeo.translate(0, 0.5, 0);
    const sielHangerGroup = new THREE.Group();
    sielHangerGroup.position.set(0, 4.88, 0);
    sRoot.add(sielHangerGroup);
    for (const sielX of [-56, -24, 4]) {
      const siel = new THREE.Mesh(sielBoxGeo, sielMat);
      siel.position.set(sielX, 4.45, 2.9);
      sRoot.add(siel);

      const h1 = new THREE.Mesh(hangerGeo, darkMetalMat);
      h1.position.set(sielX, 0, 2.25);
      const h2 = new THREE.Mesh(hangerGeo, darkMetalMat);
      h2.position.set(sielX, 0, 3.55);
      sielHangerGroup.add(h1, h2);
    }

    // 6) Platform Screen Doors (Line 14 MP14 only; RER A uses open express platforms)
    const psdPairs: StationPsdPair[] = [];
    if (lineDef.hasPlatformScreenDoors) {
      const psdLen = 80;
      const psdCenterX = -34.5;

      const psdHeader = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(psdLen, 0.26, 0.24)),
        psdFrameMat
      );
      psdHeader.position.set(psdCenterX, 3.22, 1.48);
      sRoot.add(psdHeader);

      const psdPurpleCap = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(psdLen, 0.09, 0.26)),
        purpleFasciaMat
      );
      psdPurpleCap.position.set(psdCenterX, 3.39, 1.48);
      sRoot.add(psdPurpleCap);

      const psdDoorGeo = trackGeo(new THREE.BoxGeometry(0.96, 2.22, 0.06));
      const psdStripeGeo = trackGeo(new THREE.BoxGeometry(0.94, 0.09, 0.075));
      const psdPostGeo = trackGeo(new THREE.BoxGeometry(0.14, 2.4, 0.16));

      for (const doorX of lineDef.doorOffsetsM) {
        const postL = new THREE.Mesh(psdPostGeo, psdFrameMat);
        postL.position.set(doorX - 1.12, 2.02, 1.48);
        const postR = new THREE.Mesh(psdPostGeo, psdFrameMat);
        postR.position.set(doorX + 1.12, 2.02, 1.48);
        sRoot.add(postL, postR);

        const leftLeaf = new THREE.Mesh(psdDoorGeo, psdGlassMat);
        leftLeaf.position.set(doorX - 0.5, 1.98, 1.48);
        const leftStripe = new THREE.Mesh(psdStripeGeo, yellowSafetyMat);
        leftStripe.position.set(0, -0.02, 0);
        leftLeaf.add(leftStripe);
        sRoot.add(leftLeaf);

        const rightLeaf = new THREE.Mesh(psdDoorGeo, psdGlassMat);
        rightLeaf.position.set(doorX + 0.5, 1.98, 1.48);
        const rightStripe = new THREE.Mesh(psdStripeGeo, yellowSafetyMat);
        rightStripe.position.set(0, -0.02, 0);
        rightLeaf.add(rightStripe);
        sRoot.add(rightLeaf);

        psdPairs.push({
          leftLeaf,
          rightLeaf,
          baseLeftX: doorX - 0.5,
          baseRightX: doorX + 0.5,
        });
      }

      const sortedDoors = [...lineDef.doorOffsetsM].sort((a, b) => a - b);
      const segments: [number, number][] = [];
      let cursor = -74;
      for (const dx of sortedDoors) {
        if (dx - 1.18 > cursor + 0.5) {
          segments.push([cursor, dx - 1.18]);
        }
        cursor = dx + 1.18;
      }
      if (cursor < 5) {
        segments.push([cursor, 5]);
      }

      for (const [s0, s1] of segments) {
        const segW = s1 - s0;
        const mid = (s0 + s1) / 2;
        const fixedGlass = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(segW, 2.26, 0.05)),
          psdGlassMat
        );
        fixedGlass.position.set(mid, 1.98, 1.48);
        sRoot.add(fixedGlass);

        const fixedYellow = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(segW, 0.08, 0.065)),
          yellowSafetyMat
        );
        fixedYellow.position.set(mid, 1.96, 1.48);
        sRoot.add(fixedYellow);

        const fixedKick = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(segW, 0.24, 0.1)),
          psdFrameMat
        );
        fixedKick.position.set(mid, 0.96, 1.48);
        sRoot.add(fixedKick);
      }
    }

    // 7) Detailed commuter pool with distinct outfits, hair, footwear and accessories.
    const commuters: CommuterRig[] = [];
    for (let i = 0; i < 24; i++) {
      const cg = new THREE.Group();
      cg.visible = false;
      const coatMat = trackMat(new THREE.MeshStandardMaterial({ color: coatPalette[i % coatPalette.length], roughness: 0.88, metalness: 0.015 }));
      const pantsMat = trackMat(new THREE.MeshStandardMaterial({ color: trouserPalette[(i * 5 + 2) % trouserPalette.length], roughness: 0.91 }));
      const skinMat = trackMat(new THREE.MeshStandardMaterial({ color: skinPalette[(i * 3 + 1) % skinPalette.length], roughness: 0.82 }));
      const hairMat = trackMat(new THREE.MeshStandardMaterial({ color: hairPalette[(i * 5 + 3) % hairPalette.length], roughness: 0.9 }));
      const bagMat = trackMat(new THREE.MeshStandardMaterial({ color: bagPalette[(i * 3) % bagPalette.length], roughness: 0.86 }));
      const shoeMat = trackMat(new THREE.MeshStandardMaterial({ color: shoePalette[i % shoePalette.length], roughness: 0.78 }));

      const leftLeg = new THREE.Mesh(legGeo, pantsMat);
      leftLeg.position.set(-0.08, 0.36, 0);
      const rightLeg = new THREE.Mesh(legGeo, pantsMat);
      rightLeg.position.set(0.08, 0.36, 0);
      const leftShoe = new THREE.Mesh(shoeGeo, shoeMat);
      leftShoe.position.set(-0.08, 0.075, 0.045);
      leftShoe.scale.set(0.82, 0.48, 1.45);
      const rightShoe = new THREE.Mesh(shoeGeo, shoeMat);
      rightShoe.position.set(0.08, 0.075, 0.045);
      rightShoe.scale.copy(leftShoe.scale);

      const coatMesh = new THREE.Mesh(torsoGeo, coatMat);
      coatMesh.position.set(0, 1.05, 0);
      coatMesh.castShadow = !isSoftwareGl;
      const collar = new THREE.Mesh(collarGeo, shirtMat);
      collar.position.set(0, 1.39, 0.018);
      const leftArm = new THREE.Mesh(armGeo, coatMat);
      leftArm.position.set(-0.235, 1.03, 0.005);
      leftArm.rotation.z = -0.08;
      const rightArm = new THREE.Mesh(armGeo, coatMat);
      rightArm.position.set(0.235, 1.03, 0.005);
      rightArm.rotation.z = 0.08;
      const leftHand = new THREE.Mesh(handGeo, skinMat);
      leftHand.position.set(-0.245, 0.76, 0.015);
      const rightHand = new THREE.Mesh(handGeo, skinMat);
      rightHand.position.set(0.245, 0.76, 0.015);

      const neck = new THREE.Mesh(neckGeo, skinMat);
      neck.position.set(0, 1.47, 0);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.set(0, 1.59, 0);
      head.scale.set(0.98, 1.12, 0.96);
      const hair = new THREE.Mesh(hairCapGeo, hairMat);
      hair.position.set(0, 1.64, -0.006);
      const fringe = new THREE.Mesh(fringeGeo, hairMat);
      fringe.position.set(0, 1.58, 0.075);
      const eyeL = new THREE.Mesh(eyeGeo, faceDetailMat);
      eyeL.position.set(-0.045, 1.61, 0.124);
      const eyeR = new THREE.Mesh(eyeGeo, faceDetailMat);
      eyeR.position.set(0.045, 1.61, 0.124);
      const nose = new THREE.Mesh(noseGeo, skinMat);
      nose.position.set(0, 1.565, 0.133);
      nose.scale.set(0.65, 0.8, 0.55);
      const mouth = new THREE.Mesh(mouthGeo, faceDetailMat);
      mouth.position.set(0, 1.525, 0.128);
      mouth.scale.set(1.0, 0.28, 0.3);

      const bagMesh = new THREE.Group();
      const backpack = new THREE.Mesh(bagGeo, bagMat);
      backpack.position.set(0.27, 0.69, -0.085);
      const pocket = new THREE.Mesh(bagPocketGeo, darkMetalMat);
      pocket.position.set(0.27, 0.65, -0.17);
      const strap = new THREE.Mesh(bagStrapGeo, bagMat);
      strap.position.set(0.19, 0.98, -0.045);
      strap.rotation.z = -0.16;
      bagMesh.add(backpack, pocket, strap);

      cg.add(leftLeg, rightLeg, leftShoe, rightShoe, coatMesh, collar, leftArm, rightArm, leftHand, rightHand, neck, head, hair, fringe, eyeL, eyeR, nose, mouth, bagMesh);
      sRoot.add(cg);
      commuters.push({ group: cg, coatMesh, coatMat, skinMat, hairMat, leftLeg, rightLeg, leftArm, rightArm, bagMesh });
    }

    root.add(sRoot);

    return {
      stationIndex: -1,
      archStyle: 'metro14_vault',
      root: sRoot,
      nearWall,
      nearVincennesSurround,
      nearDefensePiers,
      vaultGroup,
      rerMezzanineGroup,
      laDefenseGroup,
      vincennesGroup,
      subPortalRear,
      subPortalFwd,
      sielHangerGroup,
      signMat,
      sielMat,
      psdPairs,
      commuters,
    };
  }

  const stationSlots: StationSlot[] = [buildStationSlot(), buildStationSlot()];

  function assignStationSlot(slot: StationSlot, stationIndex: number): void {
    if (slot.stationIndex === stationIndex) return;
    slot.stationIndex = stationIndex;
    const cfg = stations[stationIndex];
    const style: StationArchStyle =
      cfg.archStyle ?? (isRer ? 'rer_vault' : 'metro14_vault');
    const isSuburbanOutdoor = style === 'vincennes' || style === 'suburban_outdoor';
    slot.archStyle = style;
    slot.root.position.set(cfg.stopX, 0, 0);

    slot.vaultGroup.visible = style === 'metro14_vault' || style === 'rer_vault';
    slot.rerMezzanineGroup.visible = style === 'rer_vault';
    slot.laDefenseGroup.visible = style === 'la_defense';
    slot.vincennesGroup.visible = isSuburbanOutdoor;

    if (isSuburbanOutdoor) {
      const prevUnderground = stationIndex > 0 && !stations[stationIndex - 1].isOutdoor;
      const nextUnderground =
        stationIndex < stations.length - 1 && !stations[stationIndex + 1].isOutdoor;
      slot.subPortalRear.visible = prevUnderground;
      slot.subPortalFwd.visible = nextUnderground;
    }

    slot.sielHangerGroup.scale.y = isSuburbanOutdoor ? 0.34 : style === 'la_defense' ? 3.55 : 2.2;

    slot.signMat.map = stationSignTextures[stationIndex];
    slot.signMat.emissiveMap = stationSignTextures[stationIndex];
    slot.signMat.needsUpdate = true;
    slot.sielMat.map = stationSielTextures[stationIndex];
    slot.sielMat.emissiveMap = stationSielTextures[stationIndex];
    slot.sielMat.needsUpdate = true;
  }

  // =========================================================================
  // 5. WARM ARCHITECTURAL STATION LIGHTING POOL (Rich moody contrast)
  // =========================================================================
  const stationLights: THREE.PointLight[] = [];
  for (let i = 0; i < 3; i++) {
    const pl = new THREE.PointLight(0xffeed6, 85, 68, 1.45);
    root.add(pl);
    stationLights.push(pl);
  }

  let lastSpeedSignLimit = 60;
  let lastRadarSignLimit = 60;

  return {
    root,
    update(state, isSideView, _cameraPos, _dt) {
      const tx = state.trainX;
      const trainOutdoor = isPositionOutdoor(tx, stations);

      // 1) Move continuous track slab/rails & recycle sleepers cleanly
      trackGroup.position.x = tx;
      outdoorCorridorSkyGroup.position.x = tx;
      outdoorCorridorSkyGroup.visible = trainOutdoor;
      outSkyAhead.visible = isPositionOutdoor(tx + 180, stations);

      const sleeperOrigin = Math.floor((tx - 95) / 2) * 2;
      let sIdx = 0;
      for (let i = 0; i < SLEEPER_COUNT; i++) {
        const sx = sleeperOrigin + i * 2;
        _dummyObj.position.set(sx, -0.02, 0);
        _dummyObj.rotation.set(0, 0, 0);
        _dummyObj.scale.set(1, 1, 1);
        _dummyObj.updateMatrix();
        sleeperInstanced.setMatrixAt(sIdx++, _dummyObj.matrix);

        _dummyObj.position.set(sx, -0.02, -3.6);
        _dummyObj.updateMatrix();
        sleeperInstanced.setMatrixAt(sIdx++, _dummyObj.matrix);
      }
      sleeperInstanced.instanceMatrix.needsUpdate = true;

      // Overhead catenary portal arms & outdoor support masts every 35m (RER A)
      if (catenaryPortalInst) {
        const portalOrigin = Math.floor((tx - 90) / 35) * 35;
        for (let i = 0; i < catenaryPortalCount; i++) {
          const px = portalOrigin + i * 35;
          _dummyObj.position.set(px, 5.42, -1.8);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(1, 1, 1);
          _dummyObj.updateMatrix();
          catenaryPortalInst.setMatrixAt(i, _dummyObj.matrix);

          if (isPositionOutdoor(px, stations) && !isInsideAnyStation(px, stations, stationLeadM, stationTrailM)) {
            _dummyObj.position.set(px, 2.85, -4.95);
            _dummyObj.scale.set(1, 1, 1);
          } else {
            _dummyObj.position.set(px, -100, 0);
            _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
          }
          _dummyObj.updateMatrix();
          outCatMastInst.setMatrixAt(i, _dummyObj.matrix);
        }
        catenaryPortalInst.instanceMatrix.needsUpdate = true;
        outCatMastInst.instanceMatrix.needsUpdate = true;
      } else {
        for (let i = 0; i < catenaryPortalCount; i++) {
          _dummyObj.position.set(0, -100, 0);
          _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
          _dummyObj.updateMatrix();
          outCatMastInst.setMatrixAt(i, _dummyObj.matrix);
        }
        outCatMastInst.instanceMatrix.needsUpdate = true;
      }

      // 2) Update recycled 3D TBM tunnel rings vs Outdoor Suburban Trackside Corridors
      const ringOrigin = Math.floor((tx - 110) / RING_STEP) * RING_STEP;
      nearTunnelInst.visible = !isSideView;
      outTurfNearInst.visible = !isSideView;
      outWallNearInst.visible = !isSideView;
      outTreeTrunkNearInst.visible = !isSideView;
      outTreeCanopyNearInst.visible = !isSideView;
      outTreeCanopyDetailNearInst.visible = !isSideView;
      skylineNearInst.visible = !isSideView;
      skylineRoofNearInst.visible = !isSideView;

      for (let i = 0; i < RING_COUNT; i++) {
        const rx = ringOrigin + i * RING_STEP;
        const inStation = isInsideAnyStation(rx, stations, stationLeadM, stationTrailM);
        const rxOutdoor = isPositionOutdoor(rx, stations);

        if (inStation || rxOutdoor) {
          _dummyObj.position.set(rx, -100, 0);
          _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.updateMatrix();
          farTunnelInst.setMatrixAt(i, _dummyObj.matrix);
          nearTunnelInst.setMatrixAt(i, _dummyObj.matrix);
          ribInst.setMatrixAt(i, _dummyObj.matrix);
          tunnelLightInst.setMatrixAt(i, _dummyObj.matrix);
          fireMainInst.setMatrixAt(i, _dummyObj.matrix);
          cableTrayInst.setMatrixAt(i, _dummyObj.matrix);
          conduitInst.setMatrixAt(i * 2, _dummyObj.matrix);
          conduitInst.setMatrixAt(i * 2 + 1, _dummyObj.matrix);
        } else {
          _dummyObj.position.set(rx, BORE_CENTER_Y, BORE_CENTER_Z);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(1, 1, 1);
          _dummyObj.updateMatrix();
          farTunnelInst.setMatrixAt(i, _dummyObj.matrix);
          nearTunnelInst.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.position.set(rx - RING_STEP * 0.45, BORE_CENTER_Y, BORE_CENTER_Z);
          _dummyObj.rotation.set(-Math.PI * 0.22, 0, 0);
          _dummyObj.scale.set(1, 1, 1);
          _dummyObj.updateMatrix();
          ribInst.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(1, 1, 1);
          _dummyObj.position.set(rx, 1.38, -5.82);
          _dummyObj.updateMatrix();
          fireMainInst.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.position.set(rx, 3.12, -5.65);
          _dummyObj.updateMatrix();
          cableTrayInst.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.position.set(rx, 1.88, -5.85);
          _dummyObj.updateMatrix();
          conduitInst.setMatrixAt(i * 2, _dummyObj.matrix);

          _dummyObj.position.set(rx, 2.34, -5.85);
          _dummyObj.updateMatrix();
          conduitInst.setMatrixAt(i * 2 + 1, _dummyObj.matrix);

          if (Math.round(rx / RING_STEP) % 2 === 0) {
            _dummyObj.position.set(rx, BORE_CENTER_Y + BORE_RADIUS - 0.55, BORE_CENTER_Z + 0.6);
            _dummyObj.rotation.set(0, 0, 0);
            _dummyObj.scale.set(1, 1, 1);
            _dummyObj.updateMatrix();
            tunnelLightInst.setMatrixAt(i, _dummyObj.matrix);
          } else {
            _dummyObj.position.set(rx, -100, 0);
            _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
            _dummyObj.updateMatrix();
            tunnelLightInst.setMatrixAt(i, _dummyObj.matrix);
          }
        }

        // Continuous Outdoor Suburban Embankment & Trees between consecutive outdoor stations
        if (rxOutdoor && !inStation) {
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(1, 1, 1);

          _dummyObj.position.set(rx, 1.3, -6.2);
          _dummyObj.updateMatrix();
          outWallFarInst.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.position.set(rx, 2.75, -6.15);
          _dummyObj.updateMatrix();
          outRailFarInst.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.position.set(rx, 2.35, -13.6);
          _dummyObj.updateMatrix();
          outTurfFarInst.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.position.set(rx, 1.3, 6.2);
          _dummyObj.updateMatrix();
          outWallNearInst.setMatrixAt(i, _dummyObj.matrix);

          _dummyObj.position.set(rx, 2.35, 13.6);
          _dummyObj.updateMatrix();
          outTurfNearInst.setMatrixAt(i, _dummyObj.matrix);

          if (Math.round(rx / RING_STEP) % 2 === 0) {
            _dummyObj.position.set(rx, 4.05, -9.8);
            _dummyObj.updateMatrix();
            outTreeTrunkInst.setMatrixAt(i, _dummyObj.matrix);
            _dummyObj.position.set(rx, 6.2, -9.8);
            _dummyObj.scale.set(1.05, 1.12, 1.0);
            _dummyObj.updateMatrix();
            outTreeCanopyInst.setMatrixAt(i, _dummyObj.matrix);
            _dummyObj.position.set(rx - 0.92, 5.85, -9.35);
            _dummyObj.scale.set(0.78, 0.7, 0.78);
            _dummyObj.updateMatrix();
            outTreeCanopyDetailFarInst.setMatrixAt(i, _dummyObj.matrix);

            _dummyObj.position.set(rx + 4, 4.05, 9.8);
            _dummyObj.updateMatrix();
            outTreeTrunkNearInst.setMatrixAt(i, _dummyObj.matrix);
            _dummyObj.position.set(rx + 4, 6.2, 9.8);
            _dummyObj.scale.set(1.0, 1.06, 1.0);
            _dummyObj.updateMatrix();
            outTreeCanopyNearInst.setMatrixAt(i, _dummyObj.matrix);
            _dummyObj.position.set(rx + 3.1, 5.88, 9.42);
            _dummyObj.scale.set(0.72, 0.68, 0.75);
            _dummyObj.updateMatrix();
            outTreeCanopyDetailNearInst.setMatrixAt(i, _dummyObj.matrix);
          } else {
            _dummyObj.position.set(rx, -100, 0);
            _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
            _dummyObj.updateMatrix();
            outTreeTrunkInst.setMatrixAt(i, _dummyObj.matrix);
            outTreeCanopyInst.setMatrixAt(i, _dummyObj.matrix);
            outTreeTrunkNearInst.setMatrixAt(i, _dummyObj.matrix);
            outTreeCanopyNearInst.setMatrixAt(i, _dummyObj.matrix);
            outTreeCanopyDetailFarInst.setMatrixAt(i, _dummyObj.matrix);
            outTreeCanopyDetailNearInst.setMatrixAt(i, _dummyObj.matrix);
          }
        } else {
          _dummyObj.position.set(rx, -100, 0);
          _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.updateMatrix();
          outWallFarInst.setMatrixAt(i, _dummyObj.matrix);
          outRailFarInst.setMatrixAt(i, _dummyObj.matrix);
          outTurfFarInst.setMatrixAt(i, _dummyObj.matrix);
          outWallNearInst.setMatrixAt(i, _dummyObj.matrix);
          outTurfNearInst.setMatrixAt(i, _dummyObj.matrix);
          outTreeTrunkInst.setMatrixAt(i, _dummyObj.matrix);
          outTreeCanopyInst.setMatrixAt(i, _dummyObj.matrix);
          outTreeTrunkNearInst.setMatrixAt(i, _dummyObj.matrix);
          outTreeCanopyNearInst.setMatrixAt(i, _dummyObj.matrix);
          outTreeCanopyDetailFarInst.setMatrixAt(i, _dummyObj.matrix);
          outTreeCanopyDetailNearInst.setMatrixAt(i, _dummyObj.matrix);
        }
      }

      // Distant Parisian roofline recycled in 20m blocks behind the tree corridor.
      const skylineOrigin = Math.floor((tx - 190) / 20) * 20;
      for (let i = 0; i < SKYLINE_COUNT; i++) {
        const bx = skylineOrigin + i * 20;
        const visible = isPositionOutdoor(bx, stations) && !isInsideAnyStation(bx, stations, stationLeadM, stationTrailM);
        if (visible) {
          const h = 9.5 + ((Math.floor(bx / 20) % 5 + 5) % 5) * 1.65;
          const widthScale = 0.82 + (i % 3) * 0.12;
          _dummyObj.position.set(bx, 2.3 + h * 0.5, -27 - (i % 3) * 2.6);
          _dummyObj.rotation.set(0, (i % 2 ? 0.012 : -0.012), 0);
          _dummyObj.scale.set(widthScale, h / 14, 1.08);
          _dummyObj.updateMatrix(); skylineFarInst.setMatrixAt(i, _dummyObj.matrix);
          _dummyObj.position.set(bx, 2.3 + h * 0.5, 27 + ((i + 1) % 3) * 2.4);
          _dummyObj.rotation.set(0, (i % 2 ? -0.01 : 0.01), 0);
          _dummyObj.updateMatrix(); skylineNearInst.setMatrixAt(i, _dummyObj.matrix);
          _dummyObj.position.set(bx, 2.3 + h + 0.35, -27 - (i % 3) * 2.6);
          _dummyObj.scale.set(widthScale * 1.02, 1, 1.1); _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.updateMatrix(); skylineRoofFarInst.setMatrixAt(i, _dummyObj.matrix);
          _dummyObj.position.set(bx, 2.3 + h + 0.35, 27 + ((i + 1) % 3) * 2.4);
          _dummyObj.updateMatrix(); skylineRoofNearInst.setMatrixAt(i, _dummyObj.matrix);
        } else {
          _dummyObj.position.set(0, -100, 0); _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
          _dummyObj.rotation.set(0, 0, 0); _dummyObj.updateMatrix();
          skylineFarInst.setMatrixAt(i, _dummyObj.matrix); skylineNearInst.setMatrixAt(i, _dummyObj.matrix);
          skylineRoofFarInst.setMatrixAt(i, _dummyObj.matrix); skylineRoofNearInst.setMatrixAt(i, _dummyObj.matrix);
        }
      }
      farTunnelInst.instanceMatrix.needsUpdate = true;
      nearTunnelInst.instanceMatrix.needsUpdate = true;
      ribInst.instanceMatrix.needsUpdate = true;
      tunnelLightInst.instanceMatrix.needsUpdate = true;
      fireMainInst.instanceMatrix.needsUpdate = true;
      cableTrayInst.instanceMatrix.needsUpdate = true;
      conduitInst.instanceMatrix.needsUpdate = true;
      outWallFarInst.instanceMatrix.needsUpdate = true;
      outRailFarInst.instanceMatrix.needsUpdate = true;
      outTurfFarInst.instanceMatrix.needsUpdate = true;
      outWallNearInst.instanceMatrix.needsUpdate = true;
      outTurfNearInst.instanceMatrix.needsUpdate = true;
      outTreeTrunkInst.instanceMatrix.needsUpdate = true;
      outTreeCanopyInst.instanceMatrix.needsUpdate = true;
      outTreeTrunkNearInst.instanceMatrix.needsUpdate = true;
      outTreeCanopyNearInst.instanceMatrix.needsUpdate = true;
      outTreeCanopyDetailFarInst.instanceMatrix.needsUpdate = true;
      outTreeCanopyDetailNearInst.instanceMatrix.needsUpdate = true;
      skylineFarInst.instanceMatrix.needsUpdate = true;
      skylineNearInst.instanceMatrix.needsUpdate = true;
      skylineRoofFarInst.instanceMatrix.needsUpdate = true;
      skylineRoofNearInst.instanceMatrix.needsUpdate = true;

      // Glowing green SORTIE tunnel markers every 40m (tunnel-only)
      const sortieOrigin = Math.floor((tx - 60) / 40) * 40;
      for (let i = 0; i < SORTIE_COUNT; i++) {
        const sx = sortieOrigin + i * 40;
        if (isInsideAnyStation(sx, stations, stationLeadM, stationTrailM) || isPositionOutdoor(sx, stations)) {
          _dummyObj.position.set(sx, -100, 0);
          _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
        } else {
          _dummyObj.position.set(sx, 2.35, -5.7);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(1, 1, 1);
        }
        _dummyObj.updateMatrix();
        sortieInst.setMatrixAt(i, _dummyObj.matrix);
      }
      sortieInst.instanceMatrix.needsUpdate = true;

      // Blue Emergency Telephone boxes every 90m (tunnel-only)
      const phoneOrigin = Math.floor((tx - 80) / 90) * 90;
      for (let i = 0; i < PHONE_COUNT; i++) {
        const px = phoneOrigin + i * 90;
        if (isInsideAnyStation(px, stations, stationLeadM, stationTrailM) || isPositionOutdoor(px, stations)) {
          _dummyObj.position.set(px, -100, 0);
          _dummyObj.scale.set(0.0001, 0.0001, 0.0001);
        } else {
          _dummyObj.position.set(px, 1.55, -5.72);
          _dummyObj.rotation.set(0, 0, 0);
          _dummyObj.scale.set(1, 1, 1);
        }
        _dummyObj.updateMatrix();
        phoneInst.setMatrixAt(i, _dummyObj.matrix);
      }
      phoneInst.instanceMatrix.needsUpdate = true;

      // 3) Trackside Block Signal & Speed Limit Disc
      const nextSigX = Math.ceil((tx + 8) / 140) * 140;
      signalGroup.position.set(nextSigX, 0, -1.78);
      signalGroup.visible = !isInsideAnyStation(nextSigX, stations, stationLeadM, stationTrailM);

      const nextSt = stations[state.nextStationIndex];
      const distToNext = nextSt.stopX - tx;
      let aspect: 'green' | 'amber' | 'red' = 'green';
      if (state.doorState !== 'closed' || state.emergencyBrake || state.isOverspeeding) {
        aspect = 'red';
      } else if (distToNext < 140 || state.speedLimitKmh <= (isRer ? 50 : 40)) {
        aspect = 'amber';
      }
      sigGreenMat.emissiveIntensity = aspect === 'green' ? 3.2 : 0.08;
      sigAmberMat.emissiveIntensity = aspect === 'amber' ? 3.2 : 0.08;
      sigRedMat.emissiveIntensity = aspect === 'red' ? 3.2 : 0.08;

      // Place Speed Limit Signpost at the next upcoming zone change
      let foundZone = speedLimitZones[0];
      for (let i = 0; i < speedLimitZones.length; i++) {
        if (speedLimitZones[i].startX > tx - 10) {
          foundZone = speedLimitZones[i];
          break;
        }
      }
      speedSignGroup.position.set(foundZone.startX, 0, -1.92);
      if (foundZone.limitKmh !== lastSpeedSignLimit && speedTexMap[foundZone.limitKmh]) {
        lastSpeedSignLimit = foundZone.limitKmh;
        speedDiscMat.map = speedTexMap[foundZone.limitKmh];
        speedDiscMat.emissiveMap = speedTexMap[foundZone.limitKmh];
        speedDiscMat.needsUpdate = true;
      }

      // 3B) Nearest Speed Camera Gantry + Advance RADAR Warning Sign + Strobe Flash
      let activeCam = speedCameras[speedCameras.length - 1];
      for (let i = 0; i < speedCameras.length; i++) {
        if (speedCameras[i].triggerX >= tx - 35) {
          activeCam = speedCameras[i];
          break;
        }
      }
      radarWarningGroup.position.set(activeCam.warningSignX, 0, -2.02);
      radarWarningGroup.visible =
        activeCam.warningSignX > tx - 25 && activeCam.warningSignX < tx + 240;

      if (activeCam.limitKmh !== lastRadarSignLimit && radarSignTexMap[activeCam.limitKmh]) {
        lastRadarSignLimit = activeCam.limitKmh;
        radarSignMat.map = radarSignTexMap[activeCam.limitKmh];
        radarSignMat.emissiveMap = radarSignTexMap[activeCam.limitKmh];
        radarSignMat.needsUpdate = true;
      }

      radarGantryGroup.position.set(activeCam.triggerX, 0, -2.25);
      radarGantryGroup.visible =
        activeCam.triggerX > tx - 45 && activeCam.triggerX < tx + 260;

      const flashNorm =
        state.speedCameraFlashSec > 0
          ? Math.min(1, state.speedCameraFlashSec / 0.72)
          : 0;
      const strobePulse = flashNorm > 0 ? Math.pow(flashNorm, 0.55) : 0;
      radarBulbMat.emissiveIntensity = 0.35 + strobePulse * 14;
      radarFlashLight.intensity = strobePulse * 280;

      // Distance countdown boards before next station
      for (let i = 0; i < distBoardMeshes.length; i++) {
        const b = distBoardMeshes[i];
        const bx = nextSt.stopX - b.distM;
        b.group.position.set(bx, 0, -1.86);
        b.group.visible =
          bx > tx - 30 &&
          bx < tx + 240 &&
          !isInsideAnyStation(bx, stations, stationLeadM, stationTrailM);
      }

      // 4) Assign 2 closest stations to the 2-slot Station Cavern pool
      const prevIdx = Math.max(0, state.nextStationIndex - 1);
      const nextIdx = state.nextStationIndex;
      assignStationSlot(stationSlots[0], prevIdx);
      assignStationSlot(stationSlots[1], nextIdx);

      // Update PSD sliding doors + near-side cutaway visibility + 3D animated commuters
      for (let s = 0; s < stationSlots.length; s++) {
        const slot = stationSlots[s];
        const isOutdoorStation =
          slot.archStyle === 'vincennes' || slot.archStyle === 'suburban_outdoor';
        slot.nearWall.visible =
          !isSideView && (slot.archStyle === 'metro14_vault' || slot.archStyle === 'rer_vault');
        slot.nearVincennesSurround.visible = !isSideView && isOutdoorStation;
        slot.nearDefensePiers.visible = !isSideView && slot.archStyle === 'la_defense';
        const isCurrentTarget = slot.stationIndex === state.nextStationIndex;
        const slideOffset = isCurrentTarget ? state.doorOpenProgress * 0.72 : 0;

        for (let p = 0; p < slot.psdPairs.length; p++) {
          const pair = slot.psdPairs[p];
          pair.leftLeaf.position.x = pair.baseLeftX - slideOffset;
          pair.rightLeaf.position.x = pair.baseRightX + slideOffset;
        }

        const actors: PassengerActor[] = state.passengers[slot.stationIndex] ?? [];
        const stationStopX = stations[slot.stationIndex].stopX;
        for (let c = 0; c < slot.commuters.length; c++) {
          const rig = slot.commuters[c];
          const actor = actors[c];
          if (!actor || actor.role === 'departed' || actor.opacity < 0.06) {
            rig.group.visible = false;
            continue;
          }
          rig.group.visible = true;
          const localX = actor.x - stationStopX;
          const localZ = THREE.MathUtils.lerp(3.15, 0.85, actor.depth);
          rig.group.position.set(localX, 0.85, localZ);
          rig.group.scale.setScalar(actor.heightScale);
          rig.coatMat.color.set(actor.coatColor);
          rig.bagMesh.visible = actor.hasBag;

          const isMoving = actor.role === 'boarding' || actor.role === 'alighting';
          const swing = isMoving ? Math.sin(actor.walkPhase) * 0.42 : 0;
          rig.leftLeg.rotation.z = swing;
          rig.rightLeg.rotation.z = -swing;
          rig.leftArm.rotation.z = -0.08 - swing * 0.34;
          rig.rightArm.rotation.z = 0.08 + swing * 0.34;

          rig.group.rotation.y = actor.role === 'alighting' ? 0 : Math.PI;
        }
      }

      // 5) Snap the 3 Station PointLights to whichever station is closest & adapt hue to architecture
      const prevSt = stations[prevIdx];
      const nearestSt =
        Math.abs(tx - prevSt.stopX) < Math.abs(tx - nextSt.stopX) ? prevSt : nextSt;
      const nearestStyle = nearestSt.archStyle ?? (isRer ? 'rer_vault' : 'metro14_vault');
      const nearestOutdoor =
        nearestStyle === 'vincennes' || nearestStyle === 'suburban_outdoor';
      const lightColorHex = nearestOutdoor
        ? 0xfff8e7
        : nearestStyle === 'la_defense'
          ? 0xe8f1ff
          : 0xffeed6;
      const lightIntensity = nearestOutdoor ? 145 : nearestStyle === 'la_defense' ? 115 : 85;
      const lightDist = nearestOutdoor ? 105 : nearestStyle === 'la_defense' ? 88 : 68;
      const lightOffsets = isRer ? [-82, -40, 0] : [-64, -30, 0];
      for (let i = 0; i < stationLights.length; i++) {
        const pl = stationLights[i];
        pl.color.setHex(lightColorHex);
        pl.intensity = lightIntensity;
        pl.distance = lightDist;
        pl.position.set(
          nearestSt.stopX + lightOffsets[i],
          nearestStyle === 'la_defense' ? 6.8 : 5.4,
          1.8
        );
      }
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
