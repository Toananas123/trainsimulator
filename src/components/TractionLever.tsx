import React, { useCallback, useRef } from 'react';

interface TractionLeverProps {
  lever: number; // +1 (Accel) to -1 (Emergency)
  emergencyBrake: boolean;
  disabled?: boolean;
  onChange: (value: number) => void;
  onEmergency: () => void;
}

function getLeverLabel(lever: number, emergencyBrake: boolean): { text: string; toneClass: string } {
  if (emergencyBrake || lever <= -0.92) {
    return { text: 'FU · EMERG', toneClass: 'text-red-400' };
  }
  if (lever > 0.05) {
    return { text: `TRACTION ${Math.round(lever * 100)}%`, toneClass: 'text-emerald-400' };
  }
  if (lever < -0.05) {
    const pct = Math.min(100, Math.round((Math.abs(lever) / 0.92) * 100));
    return { text: `FREIN ${pct}%`, toneClass: 'text-amber-400' };
  }
  return { text: 'COAST · 0', toneClass: 'text-slate-300' };
}

export const TractionLever: React.FC<TractionLeverProps> = React.memo(
  ({ lever, emergencyBrake, disabled = false, onChange, onEmergency }) => {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);

    const updateFromClientY = useCallback(
      (clientY: number) => {
        if (disabled || !trackRef.current) return;
        const rect = trackRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        let nextVal = 1 - ratio * 2;
        if (Math.abs(nextVal) < 0.07) {
          nextVal = 0;
        }
        onChange(nextVal);
      },
      [disabled, onChange]
    );

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      draggingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      updateFromClientY(e.clientY);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      updateFromClientY(e.clientY);
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture was already released
      }
    };

    const handleTopPct = 6 + ((1 - lever) / 2) * 88;
    const status = getLeverLabel(lever, emergencyBrake);

    return (
      <div className="relative flex items-stretch justify-between gap-2.5 rounded-lg bg-gradient-to-b from-[#171F2E] to-[#0C111B] border border-slate-700/85 shadow-[inset_0_2px_10px_rgba(0,0,0,0.72)] px-3 py-2 h-full">
        {/* Corner fasteners */}
        <span className="pointer-events-none absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80" />
        <span className="pointer-events-none absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80" />

        {/* Left engraved quadrant detent controls + physical Coup-de-Poing Emergency Stop */}
        <div className="flex flex-col justify-between text-[11px] font-bold tracking-tight py-0.5 min-w-[84px]">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onChange(1);
            }}
            className="text-left text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Traction +
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onChange(0);
            }}
            className="text-left text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Coast 0
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onChange(-0.55);
            }}
            className="text-left text-amber-400 hover:text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            Service −
          </button>

          {/* Iconic French red mushroom Emergency Stop with yellow hazard collar */}
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onEmergency();
            }}
            aria-label="Engage Emergency Brake"
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border-2 text-[10px] font-extrabold transition-all cursor-pointer whitespace-nowrap shadow-md ${
              emergencyBrake
                ? 'bg-red-600 border-yellow-400 text-white shadow-[0_0_12px_rgba(239,68,68,0.65)]'
                : 'bg-gradient-to-b from-red-700 to-red-900 border-yellow-500/80 text-red-50 hover:from-red-600 hover:to-red-800'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-red-300 border border-red-950 shadow-inner shrink-0" />
            <span>EMERG [B]</span>
          </button>
        </div>

        {/* Machined vertical Master Controller slot & knurled aluminum T-bar */}
        <div className="flex flex-col items-center justify-between flex-1">
          <div
            ref={trackRef}
            role="slider"
            aria-label="Traction and Brake Lever"
            aria-valuemin={-100}
            aria-valuemax={100}
            aria-valuenow={Math.round(lever * 100)}
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                e.preventDefault();
                onChange(Math.min(1, lever + 0.15));
              } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                onChange(Math.max(-1, lever - 0.15));
              }
            }}
            className="relative w-14 flex-1 min-h-[110px] flex items-center justify-center touch-none cursor-ns-resize select-none"
          >
            {/* Brushed steel gate plate */}
            <div className="pointer-events-none absolute inset-y-0 w-10 rounded-md bg-gradient-to-b from-[#253042] via-[#1B2434] to-[#111827] border border-slate-600/60 shadow-inner" />

            {/* Deep recessed mechanical lever slot */}
            <div className="relative w-3.5 h-[92%] rounded-full bg-[#05080F] border border-slate-700 shadow-[inset_0_2px_6px_rgba(0,0,0,0.95)] overflow-hidden">
              {lever > 0.02 && (
                <div
                  className="absolute left-0 right-0 bg-emerald-500/80"
                  style={{
                    bottom: '50%',
                    height: `${(lever / 2) * 100}%`,
                  }}
                />
              )}
              {lever < -0.02 && (
                <div
                  className={`absolute left-0 right-0 ${emergencyBrake ? 'bg-red-500' : 'bg-amber-500/85'}`}
                  style={{
                    top: '50%',
                    height: `${(Math.abs(lever) / 2) * 100}%`,
                  }}
                />
              )}
              {/* Center Coast physical detent bar */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-slate-300" />
            </div>

            {/* Engraved metallic notch index marks on both sides */}
            <div className="pointer-events-none absolute inset-y-2 left-0.5 w-2 flex flex-col justify-between">
              <span className="h-[2px] w-full bg-emerald-400/75" />
              <span className="h-[1px] w-1.5 bg-emerald-400/40" />
              <span className="h-[2px] w-full bg-slate-300" />
              <span className="h-[1px] w-1.5 bg-amber-400/45" />
              <span className="h-[2px] w-full bg-amber-400/80" />
              <span className="h-[2px] w-full bg-red-500" />
            </div>

            {/* Sculpted brushed-aluminum Master Controller T-handle grip */}
            <div
              className={`pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-6 rounded-md border shadow-[0_4px_10px_rgba(0,0,0,0.75)] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                emergencyBrake
                  ? 'bg-gradient-to-b from-red-500 to-red-700 border-red-200'
                  : lever > 0.05
                    ? 'bg-gradient-to-b from-slate-500 via-slate-700 to-slate-800 border-emerald-400'
                    : lever < -0.05
                      ? 'bg-gradient-to-b from-slate-500 via-slate-700 to-slate-800 border-amber-400'
                      : 'bg-gradient-to-b from-slate-500 via-slate-700 to-slate-800 border-slate-300'
              }`}
              style={{ top: `${handleTopPct}%` }}
            >
              <div className="w-8 h-[1.5px] bg-white/75 rounded-full" />
              <div className="w-6 h-[1.5px] bg-slate-950/60 rounded-full" />
            </div>
          </div>

          <div className={`text-[10px] font-bold font-mono-tabular mt-1 whitespace-nowrap ${status.toneClass}`}>
            {status.text}
          </div>
        </div>
      </div>
    );
  }
);
TractionLever.displayName = 'TractionLever';
