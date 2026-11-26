import React from 'react';
import {
  getDirectedRoute,
  getLineDefinition,
  type LineMode,
  type RouteDirection,
} from '../game/lines';

interface RouteMapProps {
  lineMode: LineMode;
  direction?: RouteDirection;
  startStationIndex?: number;
  trainX: number;
  nextStationIndex: number;
  completedStations: number[];
}

export const RouteMap: React.FC<RouteMapProps> = React.memo(
  ({
    lineMode,
    direction = 'forward',
    startStationIndex = 0,
    trainX,
    nextStationIndex,
    completedStations,
  }) => {
    const lineDef = getLineDefinition(lineMode);
    const stations = getDirectedRoute(lineMode, direction).stations;
    const firstStopX = stations[0].stopX;
    const lastStopX = stations[stations.length - 1].stopX;
    const totalLength = Math.max(1, lastStopX - firstStopX);
    const progressPct = Math.max(0, Math.min(100, ((trainX - firstStopX) / totalLength) * 100));

    const isRer = lineMode === 'rerA';

    return (
      <div
        className="w-full bg-[#090E1A] border-t border-slate-800/90 px-4 sm:px-6 pt-2.5 pb-4 shrink-0"
        aria-label={`Paris ${lineDef.name} Route Map (${stations[startStationIndex]?.shortName ?? stations[0].shortName} to ${stations[stations.length - 1].shortName})`}
      >
        <div className="flex items-center gap-4">
          {/* Official Line 14 [M][14] or [RER][A] Badge */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`inline-flex items-center justify-center h-5 rounded-full border-2 border-slate-200 font-extrabold text-white ${
                isRer ? 'px-1.5 text-[8.5px]' : 'w-5 text-[10px]'
              }`}
            >
              {lineDef.systemBadge}
            </span>
            <span
              className="inline-flex items-center justify-center w-6 h-5 rounded text-[11px] font-extrabold text-white"
              style={{ backgroundColor: lineDef.primaryColor }}
            >
              {lineDef.badgeText}
            </span>
          </div>

          {/* Horizontal transit line with alternating top/bottom staggered labels */}
          <div className="relative flex-1 py-3">
            <div className="relative h-1.5 w-full rounded-full bg-slate-800">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: isRer ? '#F43F5E' : '#8B46D1',
                }}
              />
              {/* Full line color overlay track */}
              <div
                className="absolute inset-0 rounded-full opacity-45"
                style={{ backgroundColor: lineDef.primaryColor }}
              />

              {/* Live moving train marker */}
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 flex items-center justify-center"
                style={{ left: `${progressPct}%` }}
                title="Current Train Position"
              >
                <div
                  className="w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: lineDef.accentColor }}
                />
              </div>

              {/* All Line Stations positioned proportionally */}
              {stations.map((station, idx) => {
                const posPct = ((station.stopX - firstStopX) / totalLength) * 100;
                const isCompleted = completedStations.includes(idx);
                const isNext = idx === nextStationIndex;
                const placeAbove = idx % 2 === 0;
                const horizontalAlignClass =
                  idx === 0
                    ? 'left-0 translate-x-0'
                    : idx === stations.length - 1
                      ? 'left-full -translate-x-full'
                      : 'left-1/2 -translate-x-1/2';

                return (
                  <div
                    key={station.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                    style={{ left: `${posPct}%` }}
                  >
                    {/* Subtle tick stem connecting node to staggered label */}
                    <span
                      aria-hidden="true"
                      className={`absolute left-1/2 -translate-x-1/2 w-px h-1 bg-slate-600/80 ${
                        placeAbove ? 'bottom-2' : 'top-2'
                      }`}
                    />

                    {/* Staggered station label (even above, odd below) */}
                    <span
                      data-testid={`route-label-${idx}`}
                      className={`absolute ${
                        placeAbove ? 'bottom-3' : 'top-3'
                      } ${horizontalAlignClass} whitespace-nowrap text-[8.5px] sm:text-[9px] leading-none transition-colors ${
                        isNext
                          ? 'text-white font-bold'
                          : isCompleted
                            ? 'text-slate-400 font-medium'
                            : 'text-slate-300 font-medium'
                      }`}
                    >
                      {station.shortName}
                    </span>

                    {/* Station circle node */}
                    <div
                      className="w-2.5 h-2.5 rounded-full border-2 transition-colors"
                      style={{
                        backgroundColor: isNext
                          ? '#FACC15'
                          : isCompleted
                            ? '#FFFFFF'
                            : '#090E1A',
                        borderColor: isNext
                          ? '#FFFFFF'
                          : isCompleted
                            ? lineDef.primaryColor
                            : isRer
                              ? '#F43F5E'
                              : '#7E3CC0',
                        transform: isNext ? 'scale(1.18)' : undefined,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
RouteMap.displayName = 'RouteMap';
