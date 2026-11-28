import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import type { SimulationState } from '../engine';
import { getDirectedRoute, isPositionOutdoor, type LineMode, type RouteDirection } from '../lines';
import { createMP14Train, type MP14TrainRig } from './trainModel';
import { createMetro3DWorld, type Metro3DWorld } from './worldBuilder';

export type CameraViewMode = 'side' | 'cab' | 'chase' | 'passenger';

export interface CameraTargetPose {
  posX: number;
  posY: number;
  posZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  fov: number;
}

/**
 * Pure deterministic camera pose solver for all 3 perspectives & both transit lines.
 * Exported for unit tests and consumed by Metro3DScene with smooth THREE.MathUtils.damp transitions.
 */
export function computeCameraTargetPose(
  viewMode: CameraViewMode,
  trainX: number,
  speedMs: number,
  accelMs2: number,
  timeSec: number,
  lineMode: LineMode = 'metro14'
): CameraTargetPose {
  const isRer = lineMode === 'rerA';
  const speedRatio = Math.min(1, Math.max(0, speedMs / (isRer ? 34 : 25)));
  // Realistic bogie micro-vibration scaled by speed
  const bounce =
    speedMs > 0.4
      ? Math.sin(timeSec * (11 + speedRatio * 14)) * (0.008 + speedRatio * 0.02)
      : 0;
  // Subtle cabin pitch during acceleration (nose lifts) vs braking (nose dips)
  const pitchOffsetY = Math.max(-0.28, Math.min(0.24, accelMs2 * 0.14));

  if (viewMode === 'cab') {
    // 1st-person Conductor Cab eye right behind panoramic windshield
    return {
      posX: trainX - (isRer ? 1.24 : 1.12),
      posY: (isRer ? 2.66 : 2.38) + bounce,
      posZ: 0.0,
      lookX: trainX + 58,
      lookY: (isRer ? 2.22 : 1.98) + pitchOffsetY * 4.5 + bounce * 1.4,
      lookZ: 0.0,
      fov: 60 + speedRatio * 12,
    };
  }

  if (viewMode === 'passenger') {
    // Seated/standing inside Car 1 beside the +Z panoramic windows, angled forward-outward
    // Placed cleanly clear of aisle chrome poles (z=0.15) and framed between window mullions
    const swayZ =
      speedMs > 0.4
        ? Math.sin(timeSec * (4.2 + speedRatio * 3.5)) * (0.004 + speedRatio * 0.008)
        : 0;
    const posX = trainX - (isRer ? 12.8 : 10.8);
    const posY = (isRer ? 3.08 : 2.22) + bounce * 0.85;
    const posZ = (isRer ? 0.34 : 0.26) + swayZ;
    return {
      posX,
      posY,
      posZ,
      lookX: trainX - (isRer ? 7.6 : 6.4),
      lookY: (isRer ? 3.04 : 2.18) + bounce * 0.6 + pitchOffsetY * 0.5,
      lookZ: 10.5,
      fov: (isRer ? 56 : 62) + speedRatio * 4,
    };
  }

  if (viewMode === 'chase') {
    // Dramatic 3/4 interior-tunnel follow cam positioned cleanly inside the twin-track bore below catenary wires
    return {
      posX: trainX - (isRer ? 20.5 : 15.5),
      posY: (isRer ? 3.88 : 4.15) + bounce * 0.7,
      posZ: isRer ? -2.25 : -2.95,
      lookX: trainX + 18,
      lookY: (isRer ? 2.42 : 2.05) + pitchOffsetY,
      lookZ: 0.35,
      fov: 54 + speedRatio * 10,
    };
  }

  // Classic modernized 3D Side-View cutaway tracking the front + center cars & alignment
  return {
    posX: trainX - (isRer ? 21.5 : 16.5) + speedRatio * 4.5,
    posY: isRer ? 3.18 : 2.75,
    posZ: isRer ? 15.6 : 12.6,
    lookX: trainX - (isRer ? 18.0 : 14.5) + speedRatio * 6.0,
    lookY: isRer ? 2.35 : 2.05,
    lookZ: 0.0,
    fov: 42 + speedRatio * 4,
  };
}

/**
 * Software-WebGL renderer detection (SwiftShader / llvmpipe / softpipe / Basic Render).
 * Used ONLY for rendering cost scaling & fenceSync frame pacing — never alters scene content.
 */
function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return true;
  }
}

const _fogClearColor = new THREE.Color(0x060b16);
const _fogRainColor = new THREE.Color(0x091524);
const _fogMistColor = new THREE.Color(0x1b293b);
const _skyOutdoorClearColor = new THREE.Color(0x7fb4e8);
const _skyOutdoorFogColor = new THREE.Color(0xcbd5e1);
const _hemiGroundUnderground = new THREE.Color(0x0e1422);
const _hemiGroundOutdoor = new THREE.Color(0x3a4d36);
const _currentFogColor = new THREE.Color(0x060b16);
const _sunlitKeyColor = new THREE.Color(0xffe7cc);
const _tunnelKeyColor = new THREE.Color(0xc5d9f4);

export interface Metro3DSceneCallbacks {
  getState: () => SimulationState;
  getViewMode: () => CameraViewMode;
  onTick: (dt: number) => void;
  onContextLostChange?: (lost: boolean) => void;
  onContextRestored?: () => void;
}

/**
 * Self-contained Three.js WebGL2 3D Viewport Engine for Paris Metro Line 14 Simulator.
 * Handles RoomEnvironment IBL, dynamic camera choreography, software-WebGL fenceSync pacing,
 * ResizeObserver responsiveness, and clean GPU resource disposal.
 */
export class Metro3DScene {
  private container: HTMLElement;
  private callbacks: Metro3DSceneCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private fog: THREE.FogExp2;
  private envRT: THREE.WebGLRenderTarget;
  private train: MP14TrainRig;
  private world: Metro3DWorld;
  private hemiLight: THREE.HemisphereLight;
  private keyDirLight: THREE.DirectionalLight;
  private keyLightTarget: THREE.Object3D;
  private fillLight: THREE.DirectionalLight;
  private composer: EffectComposer | null = null;
  private postProcessingPasses: Array<{ dispose: () => void }> = [];
  private isSoftwareGl: boolean;
  private maxAniso: number;
  private currentLineMode: LineMode;
  private currentDirection: RouteDirection;

  private ro: ResizeObserver;
  private rafId = 0;
  private timerId: number | null = null;
  private disposed = false;
  private contextLost = false;
  private lastTs = 0;
  private elapsedSec = 0;

  // Smoothed camera state for seamless damp transitions between Side / Cab / Chase
  private camPos = new THREE.Vector3(-16.5, 2.75, 12.6);
  private camLook = new THREE.Vector3(-14.5, 2.05, 0);
  private currentFov = 42;
  private lastViewMode: CameraViewMode;
  private hasSnappedInitial = false;

  constructor(container: HTMLElement, callbacks: Metro3DSceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.lastViewMode = callbacks.getViewMode();
    const initState = callbacks.getState();
    this.currentLineMode = initState.lineMode;
    this.currentDirection = initState.direction;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(320, container.clientWidth || 1280);
    const height = Math.max(200, container.clientHeight || 540);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    if (!this.isSoftwareGl) {
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }

    const domEl = this.renderer.domElement;
    domEl.style.width = '100%';
    domEl.style.height = '100%';
    domEl.style.display = 'block';
    domEl.dataset.testid = 'metro-canvas';
    container.appendChild(domEl);

    // WebGL Context Loss & Restoration listeners
    domEl.addEventListener('webglcontextlost', this.handleContextLost, false);
    domEl.addEventListener('webglcontextrestored', this.handleContextRestored, false);

    this.scene = new THREE.Scene();
    this.scene.background = _fogClearColor.clone();
    this.fog = new THREE.FogExp2(0x050912, 0.0052);
    this.scene.fog = this.fog;

    // Studio IBL via RoomEnvironment on EVERY device (authentic metallic glints without washing out tunnels)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.56;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.15, 460);

    // Dynamic Transit Lighting Rig (adapts smoothly between underground tunnels and outdoor suburban daylight)
    this.hemiLight = new THREE.HemisphereLight(0xb8cff5, 0x0e1422, 0.45);
    this.scene.add(this.hemiLight);

    this.keyDirLight = new THREE.DirectionalLight(0xfff1dc, 1.05);
    this.keyLightTarget = new THREE.Object3D();
    this.keyLightTarget.position.set(initState.trainX, 0, 0);
    this.keyDirLight.target = this.keyLightTarget;
    this.keyDirLight.position.set(initState.trainX + 18, 26, 22);
    this.scene.add(this.keyLightTarget);
    if (!this.isSoftwareGl) {
      this.keyDirLight.castShadow = true;
      this.keyDirLight.shadow.mapSize.set(4096, 4096);
      this.keyDirLight.shadow.camera.near = 1;
      this.keyDirLight.shadow.camera.far = 150;
      this.keyDirLight.shadow.camera.left = -46;
      this.keyDirLight.shadow.camera.right = 46;
      this.keyDirLight.shadow.camera.top = 34;
      this.keyDirLight.shadow.camera.bottom = -34;
      this.keyDirLight.shadow.camera.updateProjectionMatrix();
      this.keyDirLight.shadow.bias = -0.00012;
      this.keyDirLight.shadow.normalBias = 0.035;
      this.keyDirLight.shadow.radius = 4;
    }
    this.scene.add(this.keyDirLight);

    // Cool secondary bounce light adds shape to the train without flattening tunnel contrast.
    this.fillLight = new THREE.DirectionalLight(0xb9d3f2, 0.16);
    this.fillLight.position.set(-22, 9, -18);
    this.scene.add(this.fillLight);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.maxAniso = maxAniso;
    this.world = createMetro3DWorld(
      this.isSoftwareGl,
      maxAniso,
      this.currentLineMode,
      this.currentDirection
    );
    this.scene.add(this.world.root);
    this.applyRealtimeShadows(this.world.root);

    this.train = createMP14Train(
      this.isSoftwareGl,
      maxAniso,
      this.currentLineMode,
      this.currentDirection
    );
    this.scene.add(this.train.root);
    this.applyRealtimeShadows(this.train.root);
    this.setupPostProcessing(width, height);

    this.ro = new ResizeObserver(() => this.handleResize());
    this.ro.observe(container);

    this.lastTs = performance.now();
    // Paint Frame 0 immediately so the Title Screen & first paint never flash black
    this.renderCurrentFrame(0.016);
    this.scheduleNextTick();
  }

  /** Enable PBR shadow reception and opaque-object casting on hardware GPUs. */
  private applyRealtimeShadows(root: THREE.Object3D): void {
    if (this.isSoftwareGl) return;
    root.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
        const mats = Array.isArray(object.material) ? object.material : [object.material];
        const pbr = mats.some((material) =>
          material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial
        );
        object.receiveShadow = pbr;
        object.castShadow = pbr && mats.every((material) => !material.transparent);
      }
    });
  }

  /** Hardware-only post stack: contact shading, restrained light bloom and final AA. */
  private setupPostProcessing(width: number, height: number): void {
    if (this.isSoftwareGl) return;

    const composer = new EffectComposer(this.renderer);
    composer.setPixelRatio(this.renderer.getPixelRatio());
    composer.setSize(width, height);
    composer.addPass(new RenderPass(this.scene, this.camera));

    const ssao = new SSAOPass(this.scene, this.camera, width, height, 24);
    ssao.kernelRadius = 9;
    ssao.minDistance = 0.0005;
    ssao.maxDistance = 0.085;
    ssao.output = SSAOPass.OUTPUT.Default;

    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.18, 0.28, 0.86);
    const output = new OutputPass();
    const smaa = new SMAAPass();
    composer.addPass(ssao);
    composer.addPass(bloom);
    composer.addPass(output);
    composer.addPass(smaa);

    this.composer = composer;
    this.postProcessingPasses = [ssao, bloom, output, smaa];
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.callbacks.onContextLostChange?.(true);
  };

  private handleContextRestored = () => {
    this.contextLost = false;
    this.callbacks.onContextRestored?.();
    this.callbacks.onContextLostChange?.(false);
    this.lastTs = performance.now();
    this.scheduleNextTick();
  };

  private handleResize(): void {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(200, Math.floor(rect.height));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    if (this.hasSnappedInitial && !this.contextLost) {
      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  /**
   * Software-WebGL GPU completion pacing via WebGL2 fenceSync so SwiftShader
   * never queues unbounded frames or stalls browser interaction/screenshots.
   */
  private afterDraw(fn: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync !== 'function') {
      this.timerId = window.setTimeout(fn, 16);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!sync) {
      this.timerId = window.setTimeout(fn, 16);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      if (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) {
        this.timerId = window.setTimeout(poll, 4);
      } else {
        gl.deleteSync(sync);
        this.timerId = window.setTimeout(fn, 16);
      }
    };
    poll();
  }

  private scheduleNextTick(): void {
    if (this.disposed || this.contextLost) return;
    this.rafId = window.requestAnimationFrame(this.tick);
  }

  private renderCurrentFrame(dt: number): void {
    const state = this.callbacks.getState();
    const viewMode = this.callbacks.getViewMode();

    // Rebuild 3D train & world cleanly if user switches line mode or route direction
    let switchedRoute = false;
    if (state.lineMode !== this.currentLineMode || state.direction !== this.currentDirection) {
      this.currentLineMode = state.lineMode;
      this.currentDirection = state.direction;
      switchedRoute = true;

      this.scene.remove(this.train.root);
      this.train.dispose();
      this.scene.remove(this.world.root);
      this.world.dispose();

      this.world = createMetro3DWorld(
        this.isSoftwareGl,
        this.maxAniso,
        this.currentLineMode,
        this.currentDirection
      );
      this.scene.add(this.world.root);
      this.applyRealtimeShadows(this.world.root);
      this.train = createMP14Train(
        this.isSoftwareGl,
        this.maxAniso,
        this.currentLineMode,
        this.currentDirection
      );
      this.scene.add(this.train.root);
      this.applyRealtimeShadows(this.train.root);
    }

    // 1) Compute target camera pose & smoothly damp transitions
    const targetPose = computeCameraTargetPose(
      viewMode,
      state.trainX,
      state.speedMs,
      state.accelMs2,
      this.elapsedSec,
      this.currentLineMode
    );

    // Snap cleanly on initial frame, route switch, station teleport, or camera perspective change
    const largeTeleport = Math.abs(targetPose.posX - this.camPos.x) > 40;
    const switchedPerspective = viewMode !== this.lastViewMode || switchedRoute || largeTeleport;

    if (!this.hasSnappedInitial || switchedPerspective) {
      this.camPos.set(targetPose.posX, targetPose.posY, targetPose.posZ);
      this.camLook.set(targetPose.lookX, targetPose.lookY, targetPose.lookZ);
      this.currentFov = targetPose.fov;
      this.hasSnappedInitial = true;
    } else {
      const lambda = viewMode === 'cab' || viewMode === 'passenger' ? 18 : 10;
      this.camPos.x = THREE.MathUtils.damp(this.camPos.x, targetPose.posX, lambda, dt);
      this.camPos.y = THREE.MathUtils.damp(this.camPos.y, targetPose.posY, lambda, dt);
      this.camPos.z = THREE.MathUtils.damp(this.camPos.z, targetPose.posZ, lambda, dt);
      this.camLook.x = THREE.MathUtils.damp(this.camLook.x, targetPose.lookX, lambda, dt);
      this.camLook.y = THREE.MathUtils.damp(this.camLook.y, targetPose.lookY, lambda, dt);
      this.camLook.z = THREE.MathUtils.damp(this.camLook.z, targetPose.lookZ, lambda, dt);
      this.currentFov = THREE.MathUtils.damp(this.currentFov, targetPose.fov, 6, dt);
    }
    this.lastViewMode = viewMode;

    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    // 2) Dynamic Weather & Outdoor Daylight vs Underground Tunnel Atmosphere
    const activeRoute = getDirectedRoute(this.currentLineMode, this.currentDirection);
    const outdoor = isPositionOutdoor(state.trainX, activeRoute.stations);

    let targetDensity = outdoor ? 0.0018 : 0.0042;
    let targetColor = outdoor ? _skyOutdoorClearColor : _fogClearColor;
    if (state.weather === 'rain') {
      targetDensity = THREE.MathUtils.lerp(
        outdoor ? 0.0036 : 0.0042,
        outdoor ? 0.0082 : 0.0088,
        state.weatherIntensity
      );
      targetColor = outdoor ? _skyOutdoorFogColor : _fogRainColor;
    } else if (state.weather === 'fog') {
      targetDensity = THREE.MathUtils.lerp(
        outdoor ? 0.0024 : 0.0042,
        outdoor ? 0.0135 : 0.025,
        state.weatherIntensity
      );
      targetColor = outdoor ? _skyOutdoorFogColor : _fogMistColor;
    }

    this.fog.density = THREE.MathUtils.damp(this.fog.density, targetDensity, 3.6, dt);
    _currentFogColor.lerp(targetColor, Math.min(1, dt * 4.0));
    this.fog.color.copy(_currentFogColor);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(_currentFogColor);
    }

    // Keep the sun and its shadow frustum centred on the moving train instead of
    // leaving shadows behind at the origin after the first few hundred metres.
    this.keyDirLight.position.set(state.trainX + 18, 26, 22);
    this.keyLightTarget.position.set(state.trainX, 0, 0);

    const targetHemi = outdoor ? (state.weather === 'fog' ? 0.92 : 1.18) : 0.45;
    const targetKey = outdoor ? (state.weather === 'fog' ? 1.15 : 1.65) : 1.05;
    const targetEnv = outdoor ? 0.76 : 0.48;
    const targetFill = outdoor ? (state.weather === 'fog' ? 0.5 : 0.38) : 0.16;
    this.hemiLight.intensity = THREE.MathUtils.damp(this.hemiLight.intensity, targetHemi, 3.8, dt);
    this.keyDirLight.intensity = THREE.MathUtils.damp(this.keyDirLight.intensity, targetKey, 3.8, dt);
    this.keyDirLight.color.lerp(outdoor ? _sunlitKeyColor : _tunnelKeyColor, Math.min(1, dt * 2.6));
    this.fillLight.intensity = THREE.MathUtils.damp(this.fillLight.intensity, targetFill, 3.2, dt);
    this.scene.environmentIntensity = THREE.MathUtils.damp(
      this.scene.environmentIntensity,
      targetEnv,
      3.8,
      dt
    );
    this.hemiLight.groundColor.lerp(
      outdoor ? _hemiGroundOutdoor : _hemiGroundUnderground,
      Math.min(1, dt * 3.8)
    );

    // 3) Derive active signal aspect for cab repeater & track signals
    const isRer = this.currentLineMode === 'rerA';
    const signalAspect: 'green' | 'amber' | 'red' =
      state.doorState !== 'closed' || state.emergencyBrake || state.isOverspeeding
        ? 'red'
        : state.speedLimitKmh <= (isRer ? 50 : 40)
          ? 'amber'
          : 'green';

    // 4) Update 3D MP14 Train & 3D Line 14 World
    this.train.update({
      trainX: state.trainX,
      doorOpenProgress: state.doorOpenProgress,
      doorState: state.doorState,
      isCabView: viewMode === 'cab',
      weather: state.weather,
      weatherIntensity: state.weatherIntensity,
      signalAspect,
      timeSec: this.elapsedSec,
      speedMs: state.speedMs,
      lever: state.lever,
      emergencyBrake: state.emergencyBrake,
      speedCameraFlashIntensity:
        state.speedCameraFlashSec > 0 ? Math.min(1, state.speedCameraFlashSec / 0.72) : 0,
    });

    this.world.update(state, viewMode === 'side', this.camPos, dt);

    // 5) Render frame
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private tick = (now: number): void => {
    if (this.disposed || this.contextLost) return;

    const rawDt = (now - this.lastTs) / 1000;
    this.lastTs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.1);
    this.elapsedSec += dt;

    // Advance physics, audio & throttled HUD via App callback
    this.callbacks.onTick(dt);

    // Update 3D scene & render
    this.renderCurrentFrame(dt);

    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed && !this.contextLost) {
          this.rafId = window.requestAnimationFrame(this.tick);
        }
      });
    } else {
      this.rafId = window.requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.rafId);
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.ro.disconnect();

    const domEl = this.renderer.domElement;
    domEl.removeEventListener('webglcontextlost', this.handleContextLost);
    domEl.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.train.dispose();
    this.world.dispose();
    this.composer?.dispose();
    this.postProcessingPasses.forEach((pass) => pass.dispose());
    this.postProcessingPasses = [];
    this.composer = null;
    this.envRT.dispose();
    this.renderer.dispose();

    if (domEl.parentNode === this.container) {
      this.container.removeChild(domEl);
    }
  }
}
