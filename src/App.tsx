import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Armchair,
  Camera,
  Eye,
  Pause,
  Play,
  RotateCcw,
  TrainFront,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { CockpitHUD } from './components/CockpitHUD';
import { PauseModal, SummaryModal, TitleOverlay } from './components/GameModals';
import { ViewportOverlays } from './components/ViewportOverlays';
import { MetroAudioEngine } from './game/audio';
import {
  buildHudSnapshot,
  createInitialState,
  cycleRushHourPeriod,
  cycleWeather,
  requestCloseDoors,
  requestOpenDoors,
  setLever,
  stepSimulation,
  toggleDoors,
  triggerEmergencyBrake,
  type GamePhase,
  type HudSnapshot,
  type SimulationState,
} from './game/engine';
import {
  getDirectedRoute,
  getLineDefinition,
  isPositionOutdoor,
  type LineMode,
  type RouteDirection,
} from './game/lines';
import { Metro3DScene, type CameraViewMode } from './game/three/Metro3DScene';

export type { CameraViewMode };

export const VIEW_CYCLE_ORDER: CameraViewMode[] = ['cab', 'chase', 'side', 'passenger'];

function getInitialQueryConfig(): {
  autostart: boolean;
  view: CameraViewMode;
  lineMode: LineMode;
  direction: RouteDirection;
  startStationIndex: number;
} {
  if (typeof window === 'undefined') {
    return {
      autostart: false,
      view: 'cab',
      lineMode: 'metro14',
      direction: 'forward',
      startStationIndex: 0,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const v = params.get('view');
  const view: CameraViewMode =
    v === 'side'
      ? 'side'
      : v === 'chase'
        ? 'chase'
        : v === 'passenger'
          ? 'passenger'
          : 'cab';
  const lineMode: LineMode = params.get('line') === 'rerA' ? 'rerA' : 'metro14';
  const direction: RouteDirection = params.get('dir') === 'reverse' ? 'reverse' : 'forward';
  const rawStart = Number(params.get('start') ?? '0');
  const maxIdx = Math.max(0, getDirectedRoute(lineMode, direction).stations.length - 2);
  const startStationIndex = Number.isFinite(rawStart)
    ? Math.max(0, Math.min(maxIdx, Math.floor(rawStart)))
    : 0;
  return {
    autostart: params.get('autostart') === '1',
    view,
    lineMode,
    direction,
    startStationIndex,
  };
}

export default function App() {
  const initialQuery = getInitialQueryConfig();
  const initialPhase: GamePhase = initialQuery.autostart ? 'playing' : 'title';

  const stateRef = useRef<SimulationState>(
    createInitialState(initialPhase, initialQuery.lineMode, {
      direction: initialQuery.direction,
      startStationIndex: initialQuery.startStationIndex,
    })
  );
  const audioRef = useRef<MetroAudioEngine | null>(null);
  const webglMountRef = useRef<HTMLDivElement | null>(null);
  const scene3dRef = useRef<Metro3DScene | null>(null);
  const keysHeldRef = useRef<Set<string>>(new Set());

  const [selectedLineMode, setSelectedLineMode] = useState<LineMode>(initialQuery.lineMode);
  const selectedLineModeRef = useRef<LineMode>(initialQuery.lineMode);
  const [selectedDirection, setSelectedDirection] = useState<RouteDirection>(
    initialQuery.direction
  );
  const selectedDirectionRef = useRef<RouteDirection>(initialQuery.direction);
  const [selectedStartStationIndex, setSelectedStartStationIndex] = useState<number>(
    initialQuery.startStationIndex
  );
  const selectedStartStationRef = useRef<number>(initialQuery.startStationIndex);
  const [viewMode, setViewMode] = useState<CameraViewMode>(initialQuery.view);
  const viewModeRef = useRef<CameraViewMode>(initialQuery.view);
  const [showEcoOverlay, setShowEcoOverlay] = useState(true);
  const [hud, setHud] = useState<HudSnapshot>(() => buildHudSnapshot(stateRef.current));
  const [muted, setMuted] = useState(false);
  const [webglLost, setWebglLost] = useState(false);

  const handleSetViewMode = useCallback((mode: CameraViewMode) => {
    viewModeRef.current = mode;
    setViewMode(mode);
  }, []);

  const handleCycleViewMode = useCallback(() => {
    const idx = VIEW_CYCLE_ORDER.indexOf(viewModeRef.current);
    const next = VIEW_CYCLE_ORDER[(idx + 1) % VIEW_CYCLE_ORDER.length];
    viewModeRef.current = next;
    setViewMode(next);
  }, []);

  // Sync game state, view mode, active line & direction to document.body.dataset
  useEffect(() => {
    document.body.dataset.state = hud.phase;
    document.body.dataset.view = viewMode;
    document.body.dataset.line = hud.lineMode;
    document.body.dataset.direction = hud.direction;
  }, [hud.phase, viewMode, hud.lineMode, hud.direction]);

  const syncHudImmediate = useCallback(() => {
    setHud(buildHudSnapshot(stateRef.current));
  }, []);

  const ensureAudioUnlocked = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new MetroAudioEngine();
    }
    audioRef.current.unlock();
  }, []);

  const rebuildRouteState = useCallback(
    (
      phase: GamePhase,
      mode: LineMode,
      direction: RouteDirection,
      startStationIndex: number
    ) => {
      keysHeldRef.current.clear();
      stateRef.current = createInitialState(phase, mode, {
        direction,
        startStationIndex,
      });
      document.body.dataset.line = mode;
      document.body.dataset.direction = direction;
      syncHudImmediate();
    },
    [syncHudImmediate]
  );

  const handleSelectLineMode = useCallback(
    (mode: LineMode) => {
      selectedLineModeRef.current = mode;
      setSelectedLineMode(mode);
      selectedStartStationRef.current = 0;
      setSelectedStartStationIndex(0);
      rebuildRouteState(stateRef.current.phase, mode, selectedDirectionRef.current, 0);
    },
    [rebuildRouteState]
  );

  const handleSelectDirection = useCallback(
    (direction: RouteDirection) => {
      selectedDirectionRef.current = direction;
      setSelectedDirection(direction);
      selectedStartStationRef.current = 0;
      setSelectedStartStationIndex(0);
      rebuildRouteState(stateRef.current.phase, selectedLineModeRef.current, direction, 0);
    },
    [rebuildRouteState]
  );

  const handleSelectStartStation = useCallback(
    (idx: number) => {
      const maxIdx = Math.max(
        0,
        getDirectedRoute(selectedLineModeRef.current, selectedDirectionRef.current).stations.length -
          2
      );
      const clamped = Math.max(0, Math.min(maxIdx, idx));
      selectedStartStationRef.current = clamped;
      setSelectedStartStationIndex(clamped);
      rebuildRouteState(
        stateRef.current.phase,
        selectedLineModeRef.current,
        selectedDirectionRef.current,
        clamped
      );
    },
    [rebuildRouteState]
  );

  const handleStart = useCallback(() => {
    ensureAudioUnlocked();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    keysHeldRef.current.clear();
    const st = stateRef.current;
    if (st.phase === 'gameover') {
      stateRef.current = createInitialState('playing', selectedLineModeRef.current, {
        direction: selectedDirectionRef.current,
        startStationIndex: selectedStartStationRef.current,
      });
    } else {
      st.phase = 'playing';
    }
    document.body.dataset.state = 'playing';
    syncHudImmediate();
  }, [ensureAudioUnlocked, syncHudImmediate]);

  const handleRestart = useCallback(() => {
    ensureAudioUnlocked();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    keysHeldRef.current.clear();
    stateRef.current = createInitialState('playing', selectedLineModeRef.current, {
      direction: selectedDirectionRef.current,
      startStationIndex: selectedStartStationRef.current,
    });
    document.body.dataset.state = 'playing';
    syncHudImmediate();
  }, [ensureAudioUnlocked, syncHudImmediate]);

  const handleTogglePause = useCallback(() => {
    const st = stateRef.current;
    if (st.phase === 'playing') {
      st.phase = 'paused';
      keysHeldRef.current.clear();
      audioRef.current?.silenceLoops();
      document.body.dataset.state = 'paused';
      syncHudImmediate();
    } else if (st.phase === 'paused') {
      ensureAudioUnlocked();
      st.phase = 'playing';
      document.body.dataset.state = 'playing';
      syncHudImmediate();
    }
  }, [ensureAudioUnlocked, syncHudImmediate]);

  const handleReturnTitle = useCallback(() => {
    keysHeldRef.current.clear();
    audioRef.current?.silenceLoops();
    stateRef.current = createInitialState('title', selectedLineModeRef.current, {
      direction: selectedDirectionRef.current,
      startStationIndex: selectedStartStationRef.current,
    });
    document.body.dataset.state = 'title';
    syncHudImmediate();
  }, [syncHudImmediate]);

  const handleToggleMute = useCallback(() => {
    ensureAudioUnlocked();
    setMuted((prev) => {
      const next = !prev;
      audioRef.current?.setMuted(next);
      return next;
    });
  }, [ensureAudioUnlocked]);

  const handleLeverChange = useCallback(
    (value: number) => {
      ensureAudioUnlocked();
      const prevZone =
        stateRef.current.lever > 0.05 ? 1 : stateRef.current.lever < -0.05 ? -1 : 0;
      setLever(stateRef.current, value);
      const nextZone =
        stateRef.current.lever > 0.05 ? 1 : stateRef.current.lever < -0.05 ? -1 : 0;
      if (prevZone !== nextZone) {
        audioRef.current?.playLeverClick();
      }
      if (stateRef.current.events.emergencyTriggered) {
        audioRef.current?.playEmergencyBrake();
      }
      syncHudImmediate();
    },
    [ensureAudioUnlocked, syncHudImmediate]
  );

  const handleEmergencyBrake = useCallback(() => {
    ensureAudioUnlocked();
    triggerEmergencyBrake(stateRef.current);
    audioRef.current?.playEmergencyBrake();
    syncHudImmediate();
  }, [ensureAudioUnlocked, syncHudImmediate]);

  const handleOpenDoors = useCallback(() => {
    ensureAudioUnlocked();
    if (requestOpenDoors(stateRef.current)) {
      audioRef.current?.playDoorSlide();
      syncHudImmediate();
    }
  }, [ensureAudioUnlocked, syncHudImmediate]);

  const handleCloseDoors = useCallback(() => {
    ensureAudioUnlocked();
    if (requestCloseDoors(stateRef.current)) {
      audioRef.current?.playDoorClosingBuzzer(stateRef.current.lineMode);
      syncHudImmediate();
    }
  }, [ensureAudioUnlocked, syncHudImmediate]);

  const handleCycleWeather = useCallback(() => {
    ensureAudioUnlocked();
    cycleWeather(stateRef.current);
    syncHudImmediate();
  }, [ensureAudioUnlocked, syncHudImmediate]);

  const handleCycleRushHour = useCallback(() => {
    ensureAudioUnlocked();
    cycleRushHourPeriod(stateRef.current);
    syncHudImmediate();
  }, [ensureAudioUnlocked, syncHudImmediate]);

  const handleToggleEcoOverlay = useCallback(() => {
    setShowEcoOverlay((prev) => !prev);
  }, []);

  const handleCabHorn = useCallback(() => {
    ensureAudioUnlocked();
    audioRef.current?.playCabHorn();
  }, [ensureAudioUnlocked]);

  // Unified Keyboard & Window Focus Listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const st = stateRef.current;

      if (e.code === 'KeyV' && !e.repeat) {
        e.preventDefault();
        handleCycleViewMode();
        return;
      }

      // Title screen start handshake via Enter or Space
      if (st.phase === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          handleStart();
        }
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (st.phase === 'playing' || st.phase === 'paused') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (e.code === 'KeyM') {
        e.preventDefault();
        handleToggleMute();
        return;
      }

      if (e.code === 'KeyR' && (st.phase === 'playing' || st.phase === 'paused')) {
        e.preventDefault();
        handleRestart();
        return;
      }

      if (st.phase !== 'playing') return;

      if (e.code === 'KeyH' && !e.repeat) {
        e.preventDefault();
        handleCabHorn();
        return;
      }

      if (e.code === 'KeyE' && !e.repeat) {
        e.preventDefault();
        handleToggleEcoOverlay();
        return;
      }

      if (e.code === 'KeyW' || e.code === 'ArrowUp' || e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        ensureAudioUnlocked();
        keysHeldRef.current.add(e.code);
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) {
          ensureAudioUnlocked();
          const prevDoorState = st.doorState;
          if (toggleDoors(st)) {
            if (prevDoorState === 'closed') {
              audioRef.current?.playDoorSlide();
            } else {
              audioRef.current?.playDoorClosingBuzzer(st.lineMode);
            }
            syncHudImmediate();
          }
        }
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        if (!e.repeat) {
          handleEmergencyBrake();
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const clearInputs = () => {
      keysHeldRef.current.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    document.addEventListener('visibilitychange', clearInputs);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      document.removeEventListener('visibilitychange', clearInputs);
    };
  }, [
    ensureAudioUnlocked,
    handleCabHorn,
    handleCycleViewMode,
    handleEmergencyBrake,
    handleRestart,
    handleStart,
    handleToggleEcoOverlay,
    handleToggleMute,
    handleTogglePause,
    syncHudImmediate,
  ]);

  // Isolated Three.js WebGL 3D Scene & Simulation Loop (Mounted once; zero 60Hz React re-renders)
  useEffect(() => {
    const mount = webglMountRef.current;
    if (!mount) return;

    let hudSyncAccum = 0;

    const scene3d = new Metro3DScene(mount, {
      getState: () => stateRef.current,
      getViewMode: () => viewModeRef.current,
      onContextLostChange: (lost) => setWebglLost(lost),
      onTick: (dt) => {
        const st = stateRef.current;

        // Apply held keyboard throttle/brake smoothly
        if (st.phase === 'playing') {
          const keys = keysHeldRef.current;
          const accelHeld = keys.has('KeyW') || keys.has('ArrowUp');
          const brakeHeld = keys.has('KeyS') || keys.has('ArrowDown');
          if (accelHeld && !brakeHeld) {
            setLever(st, st.lever + 1.15 * dt);
          } else if (brakeHeld && !accelHeld) {
            const next = Math.max(-0.88, st.lever - 1.25 * dt);
            setLever(st, next);
          }
        }

        // Advance physics & state machine
        const prevPhase = st.phase;
        const prevDoor = st.doorState;
        const prevStation = st.nextStationIndex;
        const prevWeather = st.weather;

        stepSimulation(st, dt);

        // Dispatch Web Audio events & continuous multi-layered MP14 acoustics
        if (audioRef.current) {
          if (st.events.arrivalChime) audioRef.current.playArrivalChime();
          if (st.events.doorClosingSlide) audioRef.current.playDoorSlide();
          if (st.events.emergencyTriggered) audioRef.current.playEmergencyBrake();
          if (st.events.speedCameraFlashed) audioRef.current.playSpeedCameraFlash();

          const route = getDirectedRoute(st.lineMode, st.direction);
          const lineStations = route.stations;
          const inStation = lineStations.some(
            (s) => st.trainX >= s.stopX - 115 && st.trainX <= s.stopX + 35
          );
          const isOutdoor = isPositionOutdoor(st.trainX, lineStations);
          const rainLevel = st.weather === 'rain' ? st.weatherIntensity : 0;
          audioRef.current.updateContinuous(
            st.speedMs * 3.6,
            st.lever,
            st.phase === 'playing',
            rainLevel,
            {
              trainX: st.trainX,
              inStation,
              isOutdoor,
              weather: st.weather,
              weatherIntensity: st.weatherIntensity,
              trackMeta: route.trackMeta,
              doorOpenProgress: st.doorOpenProgress,
              isOverspeeding: st.isOverspeeding,
              perspective: viewModeRef.current,
              lineMode: st.lineMode,
              dt,
            }
          );
        }

        // Throttle HUD React updates to ~14 Hz (or immediately on discrete state transitions)
        hudSyncAccum += dt;
        const discreteChanged =
          st.phase !== prevPhase ||
          st.doorState !== prevDoor ||
          st.nextStationIndex !== prevStation ||
          st.weather !== prevWeather ||
          st.events.stationScored ||
          st.events.overshootWarning ||
          Boolean(st.events.speedCameraFlashed);

        if (discreteChanged || hudSyncAccum >= 0.075) {
          hudSyncAccum = 0;
          setHud(buildHudSnapshot(st));
        }
      },
    });

    scene3dRef.current = scene3d;

    return () => {
      scene3d.dispose();
      scene3dRef.current = null;
      audioRef.current?.silenceLoops();
    };
  }, []);

  return (
    <main className="h-screen w-screen flex flex-col bg-[#0B1120] overflow-hidden select-none">
      {/* TOP ~65% VIEWPORT: Real-Time Three.js 3D Viewport (Side / Conductor Cab / Chase 3D) */}
      <div
        className="relative flex-1 min-h-0 w-full bg-[#060B16] overflow-hidden"
        data-testid="metro-viewport"
      >
        {/* Isolated WebGL mount node (never re-rendered by HUD siblings) */}
        <div ref={webglMountRef} className="w-full h-full" />

        {/* Lightweight Zero-Blur Station Alignment Guide, Eco Dashboard, Radar Flash & Door Quick-Controls */}
        <ViewportOverlays
          hud={hud}
          viewMode={viewMode}
          showEcoOverlay={showEcoOverlay}
          onOpenDoors={handleOpenDoors}
          onCloseDoors={handleCloseDoors}
        />

        {/* WebGL Context Lost Notice */}
        {webglLost && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#060B16]/95 text-slate-200">
            <div className="rounded-xl border border-slate-700 bg-[#111827] px-6 py-4 text-center">
              <div className="text-sm font-bold text-amber-300">Restoring 3D Graphics Context...</div>
              <div className="mt-1 text-xs text-slate-400">
                Your {getLineDefinition(hud.lineMode).name} train position and score are preserved.
              </div>
            </div>
          </div>
        )}

        {/* Top-Right Compact Utility Controls + Segmented 3D Perspective Switcher */}
        {hud.phase !== 'title' && (
          <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
            {/* Segmented 3D Camera View Switcher */}
            <div
              className="flex items-center p-1 rounded-full border border-slate-600/80"
              style={{ backgroundColor: 'rgba(11, 17, 32, 0.94)' }}
              role="group"
              aria-label="Switch 3D Camera Perspective"
            >
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSetViewMode('side');
                }}
                aria-pressed={viewMode === 'side'}
                title="3D Side-View Cutaway [V]"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'side'
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Side</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSetViewMode('cab');
                }}
                aria-pressed={viewMode === 'cab'}
                title="3D Conductor Cab View [V]"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'cab'
                    ? 'bg-[#00AA91] text-slate-950'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <TrainFront className="w-3.5 h-3.5" />
                <span>Cab</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-testid="btn-view-chase"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSetViewMode('chase');
                }}
                aria-pressed={viewMode === 'chase'}
                title="3D Chase Follow Camera [V]"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'chase'
                    ? 'bg-[#62259D] text-white'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Chase</span>
              </button>
              <button
                type="button"
                tabIndex={-1}
                data-testid="btn-view-passenger"
                onClick={(e) => {
                  e.currentTarget.blur();
                  handleSetViewMode('passenger');
                }}
                aria-pressed={viewMode === 'passenger'}
                title="3D Passenger Window View [V]"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  viewMode === 'passenger'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                <Armchair className="w-3.5 h-3.5" />
                <span>Passenger [V]</span>
              </button>
            </div>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleToggleMute();
              }}
              aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
              title="Toggle Sound [M]"
              className="w-10 h-10 rounded-full hover:bg-slate-800 border border-slate-600/80 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(11, 17, 32, 0.94)' }}
            >
              {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleTogglePause();
              }}
              aria-label={hud.phase === 'paused' ? 'Resume Simulation' : 'Pause Simulation'}
              title="Pause / Resume [P]"
              className="w-10 h-10 rounded-full hover:bg-slate-800 border border-slate-600/80 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(11, 17, 32, 0.94)' }}
            >
              {hud.phase === 'paused' ? (
                <Play className="w-4 h-4 fill-current" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                handleRestart();
              }}
              aria-label="Restart Route"
              title={`Restart at ${getDirectedRoute(hud.lineMode, hud.direction).stations[hud.startStationIndex]?.shortName ?? getDirectedRoute(hud.lineMode, hud.direction).originShortName} [R]`}
              className="w-10 h-10 rounded-full hover:bg-slate-800 border border-slate-600/80 text-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(11, 17, 32, 0.94)' }}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Floating Event Feedback Banner (Station Score, Weather Shift, Emergency Brake) */}
        {hud.phase === 'playing' && hud.feedback && (
          <div
            data-testid="hud-feedback"
            className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-lg border text-center shadow-lg ${
              hud.feedback.tone === 'success'
                ? 'bg-[#06281E]/95 border-emerald-500/80 text-emerald-100'
                : hud.feedback.tone === 'warning'
                  ? 'bg-[#2A1C07]/95 border-amber-500/80 text-amber-100'
                  : hud.feedback.tone === 'danger'
                    ? 'bg-[#2D0A0A]/95 border-red-500/80 text-red-100'
                    : 'bg-[#0B1120]/95 border-purple-500/80 text-slate-100'
            }`}
          >
            <div className="text-xs font-bold">{hud.feedback.title}</div>
            <div className="text-[11px] opacity-90 font-mono-tabular">{hud.feedback.detail}</div>
          </div>
        )}

        {/* Title Overlay anchored inside top 65% viewport so cockpit & route map stay crystal clear */}
        {hud.phase === 'title' && (
          <TitleOverlay
            lineMode={selectedLineMode}
            onSelectLineMode={handleSelectLineMode}
            direction={selectedDirection}
            onSelectDirection={handleSelectDirection}
            startStationIndex={selectedStartStationIndex}
            onSelectStartStation={handleSelectStartStation}
            viewMode={viewMode}
            onSelectViewMode={handleSetViewMode}
            onStart={handleStart}
          />
        )}
      </div>

      {/* BOTTOM ~35% VIEWPORT: Modern Matte Dark-Slate Cockpit HUD + Line 14 / RER A Route Map */}
      <CockpitHUD
        hud={hud}
        showEcoOverlay={showEcoOverlay}
        onLeverChange={handleLeverChange}
        onEmergencyBrake={handleEmergencyBrake}
        onOpenDoors={handleOpenDoors}
        onCloseDoors={handleCloseDoors}
        onCycleWeather={handleCycleWeather}
        onCycleRushHour={handleCycleRushHour}
        onToggleEcoOverlay={handleToggleEcoOverlay}
        onHorn={handleCabHorn}
      />

      {/* GAME STATE MODALS */}
      {hud.phase === 'paused' && (
        <PauseModal
          lineMode={hud.lineMode}
          direction={hud.direction}
          startStationIndex={hud.startStationIndex}
          onResume={handleTogglePause}
          onRestart={handleRestart}
          onTitle={handleReturnTitle}
        />
      )}

      {hud.phase === 'gameover' && hud.finalGrade && (
        <SummaryModal
          summary={hud.finalGrade}
          records={hud.stopRecords}
          onRestart={handleRestart}
        />
      )}
    </main>
  );
}
