import React from 'react';
import { COLORS } from '../game/constants';

interface SpeedometerProps {
  speedKmh: number;
  speedLimitKmh: number;
  isOverspeeding: boolean;
  maxSpeedKmh?: number;
}

const DEFAULT_MAX_SPEED = 90;
const START_ANGLE = -225;
const SWEEP_ANGLE = 270;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export const Speedometer: React.FC<SpeedometerProps> = React.memo(
  ({ speedKmh, speedLimitKmh, isOverspeeding, maxSpeedKmh = DEFAULT_MAX_SPEED }) => {
    const maxDialSpeed = Math.max(60, maxSpeedKmh);
    const clampedSpeed = Math.max(0, Math.min(maxDialSpeed, speedKmh));
    const speedAngle = START_ANGLE + (clampedSpeed / maxDialSpeed) * SWEEP_ANGLE;
    const limitAngle =
      START_ANGLE + (Math.min(maxDialSpeed, speedLimitKmh) / maxDialSpeed) * SWEEP_ANGLE;

    const cx = 100;
    const cy = 100;
    const radius = 80;

    const ticks: React.ReactNode[] = [];
    for (let v = 0; v <= maxDialSpeed; v += 5) {
      const angle = START_ANGLE + (v / maxDialSpeed) * SWEEP_ANGLE;
      const isMajor = v % 10 === 0;
      const innerR = isMajor ? 64 : 71;
      const outerR = 78;
      const p1 = polarToCartesian(cx, cy, innerR, angle);
      const p2 = polarToCartesian(cx, cy, outerR, angle);

      ticks.push(
        <line
          key={`t-${v}`}
          x1={p1.x}
          y1={p1.y}
          x2={p2.x}
          y2={p2.y}
          stroke={v > speedLimitKmh ? '#EF4444' : isMajor ? '#F1F5F9' : '#64748B'}
          strokeWidth={isMajor ? 2.2 : 1.15}
          strokeLinecap="round"
        />
      );

      if (isMajor && v % 20 === 0) {
        const labelPos = polarToCartesian(cx, cy, 51, angle);
        ticks.push(
          <text
            key={`l-${v}`}
            x={labelPos.x}
            y={labelPos.y + 3.5}
            textAnchor="middle"
            fill={v > speedLimitKmh ? '#FCA5A5' : '#CBD5E1'}
            fontSize={maxDialSpeed > 100 ? '9.8' : '10.5'}
            fontWeight="700"
            className="font-mono-tabular"
          >
            {v}
          </text>
        );
      }
    }

    const needleTip = polarToCartesian(cx, cy, 69, speedAngle);
    const needleTail = polarToCartesian(cx, cy, 18, speedAngle + 180);

    return (
      <div
        className={`relative flex items-center justify-center rounded-lg bg-gradient-to-b from-[#0E1420] to-[#070B13] border transition-colors shadow-[inset_0_3px_12px_rgba(0,0,0,0.85)] ${
          isOverspeeding ? 'border-red-500 overspeed-flash' : 'border-slate-700/80'
        } px-2.5 py-1.5 h-full`}
        aria-label={`Speedometer ${Math.round(clampedSpeed)} kilometers per hour, limit ${speedLimitKmh}`}
      >
        {/* Corner instrument housing hex bolts */}
        <span className="pointer-events-none absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80 shadow-inner" />
        <span className="pointer-events-none absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80 shadow-inner" />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80 shadow-inner" />
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-slate-600/80 shadow-inner" />

        <svg viewBox="0 0 200 186" className="h-full max-h-[156px] w-auto overflow-visible">
          <defs>
            <linearGradient id="bezelRing" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="45%" stopColor="#1E293B" />
              <stop offset="100%" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="dialGlass" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.09" />
              <stop offset="42%" stopColor="#FFFFFF" stopOpacity="0.01" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Machined anodized metallic outer bezel + deep matte dial well */}
          <circle cx={cx} cy={cy} r={92} fill="url(#bezelRing)" />
          <circle cx={cx} cy={cy} r={86} fill="#080C15" stroke="#0F172A" strokeWidth="2" />

          {/* Recessed dial track arc */}
          <path
            d={describeArc(cx, cy, radius, START_ANGLE, START_ANGLE + SWEEP_ANGLE)}
            fill="none"
            stroke="#162032"
            strokeWidth="7.5"
            strokeLinecap="round"
          />

          {/* Authorized CBTC speed envelope arc (RATP Turquoise) */}
          <path
            d={describeArc(cx, cy, radius, START_ANGLE, limitAngle)}
            fill="none"
            stroke={COLORS.ratpTurquoise}
            strokeWidth="5"
            strokeLinecap="round"
            opacity="0.82"
          />

          {/* Overspeed intervention zone arc */}
          {speedLimitKmh < maxDialSpeed && (
            <path
              d={describeArc(cx, cy, radius, limitAngle, START_ANGLE + SWEEP_ANGLE)}
              fill="none"
              stroke="#EF4444"
              strokeWidth="5"
              strokeLinecap="round"
              opacity={isOverspeeding ? '0.96' : '0.42'}
            />
          )}

          {/* Tick marks & numerals */}
          {ticks}

          {/* Luminous V-MAX yellow target pin */}
          {(() => {
            const pA = polarToCartesian(cx, cy, 75, limitAngle);
            const pB = polarToCartesian(cx, cy, 86, limitAngle);
            return (
              <line
                x1={pA.x}
                y1={pA.y}
                x2={pB.x}
                y2={pB.y}
                stroke="#FACC15"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            );
          })()}

          {/* Physical backlit tachometer needle */}
          <line
            x1={needleTail.x}
            y1={needleTail.y}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={isOverspeeding ? '#EF4444' : '#38BDF8'}
            strokeWidth="7.5"
            strokeLinecap="round"
            opacity="0.24"
          />
          <line
            x1={needleTail.x}
            y1={needleTail.y}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke={isOverspeeding ? '#F87171' : '#E0F2FE'}
            strokeWidth="2.8"
            strokeLinecap="round"
          />

          {/* Metallic hub ring & crisp digital readout */}
          <circle cx={cx} cy={cy} r="28" fill="#0A101C" stroke="#334155" strokeWidth="2.4" />
          <circle cx={cx} cy={cy} r="25" fill="none" stroke="#1E293B" strokeWidth="1" />
          <text
            x={cx}
            y={cy + 4}
            textAnchor="middle"
            fill={isOverspeeding ? '#F87171' : '#F8FAFC'}
            fontSize="23"
            fontWeight="800"
            className="font-mono-tabular"
          >
            {Math.round(clampedSpeed)}
          </text>
          <text
            x={cx}
            y={cy + 17}
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="8.2"
            fontWeight="700"
            letterSpacing="0.5"
          >
            km/h
          </text>

          {/* Subtle anti-glare curved glass reflection */}
          <ellipse cx={cx} cy={62} rx={62} ry={34} fill="url(#dialGlass)" pointerEvents="none" />

          {/* Bottom CBTC limit badge */}
          <text
            x={cx}
            y={175}
            textAnchor="middle"
            fill={isOverspeeding ? '#F87171' : '#94A3B8'}
            fontSize="9.8"
            fontWeight="800"
            letterSpacing="0.6"
            className="font-mono-tabular"
          >
            {isOverspeeding ? `OVERSPEED (${speedLimitKmh})` : `LIMIT ${speedLimitKmh} KM/H`}
          </text>
        </svg>
      </div>
    );
  }
);
Speedometer.displayName = 'Speedometer';
