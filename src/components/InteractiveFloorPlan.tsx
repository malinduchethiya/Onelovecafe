import React, { useState, useRef } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Layers, MousePointerClick } from 'lucide-react';
import { CafeTable, SeatingZone, AvailabilitySlotRecord, ReservationRecord } from '../types/cafe';

interface InteractiveFloorPlanProps {
  tables: CafeTable[];
  zones: SeatingZone[];
  availability: AvailabilitySlotRecord[];
  reservations?: ReservationRecord[];
  selectedDate: string;
  selectedTime: string;
  partySize: number;
  selectedTableId: string | null;
  sessionId: string;
  onSelectTable: (table: CafeTable) => void;
  editable?: boolean;
  onMoveTable?: (tableId: string, newX: number, newY: number) => void;
  onCommitTablePosition?: (tableId: string, finalX: number, finalY: number) => void;
  floorPlanImageUrl?: string;
}

export const InteractiveFloorPlan: React.FC<InteractiveFloorPlanProps> = ({
  tables,
  zones,
  availability,
  reservations,
  selectedDate,
  selectedTime,
  partySize,
  selectedTableId,
  sessionId,
  onSelectTable,
  editable = false,
  onMoveTable,
  onCommitTablePosition,
  floorPlanImageUrl = '',
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeZoneFilter, setActiveZoneFilter] = useState<string>('all');
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  const [lastDraggedPos, setLastDraggedPos] = useState<{ id: string; x: number; y: number } | null>(null);
  const [showBlueprintOverlay, setShowBlueprintOverlay] = useState<boolean>(!floorPlanImageUrl);
  const [clickToPlaceMode, setClickToPlaceMode] = useState<boolean>(false);

  React.useEffect(() => {
    setShowBlueprintOverlay(!floorPlanImageUrl);
  }, [floorPlanImageUrl]);

  const planeRef = useRef<HTMLDivElement | null>(null);

  const normalizedTime = selectedTime.replace(/[^a-zA-Z0-9]/g, '-');
  const nowMs = Date.now();
  const hasDroneImage = Boolean(floorPlanImageUrl && floorPlanImageUrl.trim().length > 0);

  const getTableStatus = (
    table: CafeTable
  ): 'available' | 'reserved' | 'occupied' | 'held_other' | 'held_self' | 'capacity_mismatch' => {
    if (!table.isActive) return 'occupied';
    const slotId = `${selectedDate}_${normalizedTime}_${table.id}`;
    const slot = availability.find((s) => s.id === slotId);
    if (slot) {
      if (slot.status === 'reserved') {
        const matchingRes =
          reservations?.filter(
            (r) =>
              r.date === selectedDate &&
              r.tableId === table.id &&
              (r.time === selectedTime || r.time.replace(/[^a-zA-Z0-9]/g, '-') === normalizedTime)
          ) || [];
        const hasActive = matchingRes.some(
          (r) => r.status === 'confirmed' || r.status === 'seated'
        );
        const hasCancelledOrRejected = matchingRes.some(
          (r) => r.status === 'cancelled' || r.status === 'rejected'
        );

        if (hasCancelledOrRejected && !hasActive) {
          // Reservation was cancelled or rejected and no active booking exists: table is available!
        } else if (hasActive || matchingRes.length === 0) {
          return 'reserved';
        }
      } else if (slot.status === 'occupied') {
        return 'occupied';
      } else if (slot.status === 'held' && slot.holdExpiresAtMs > nowMs) {
        return slot.sessionId === sessionId ? 'held_self' : 'held_other';
      }
    }
    if (!editable && (partySize > table.capacity || partySize < table.minGuests)) {
      return 'capacity_mismatch';
    }
    return 'available';
  };

  // Find recommended table (smallest capacity >= partySize that is available)
  const recommendedTableId = React.useMemo(() => {
    const candidates = tables
      .filter((t) => {
        const st = getTableStatus(t);
        return (
          (st === 'available' || st === 'held_self') &&
          (activeZoneFilter === 'all' || t.zoneId === activeZoneFilter)
        );
      })
      .sort((a, b) => a.capacity - b.capacity);
    return candidates[0]?.id || null;
  }, [tables, availability, selectedDate, selectedTime, partySize, activeZoneFilter]);

  const computeRelativeCoords = (clientX: number, clientY: number) => {
    const targetEl = planeRef.current;
    if (!targetEl) return { x: 50, y: 50 };
    const rect = targetEl.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * 100;
    const relY = ((clientY - rect.top) / rect.height) * 100;
    return {
      x: Math.round(Math.max(5, Math.min(95, relX))),
      y: Math.round(Math.max(6, Math.min(94, relY))),
    };
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (draggingTableId) return;
    if (editable && clickToPlaceMode && selectedTableId) {
      const coords = computeRelativeCoords(e.clientX, e.clientY);
      if (onMoveTable) {
        onMoveTable(selectedTableId, coords.x, coords.y);
      }
      if (onCommitTablePosition) {
        onCommitTablePosition(selectedTableId, coords.x, coords.y);
      }
      return;
    }
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (editable && draggingTableId && onMoveTable) {
      const coords = computeRelativeCoords(e.clientX, e.clientY);
      setLastDraggedPos({ id: draggingTableId, x: coords.x, y: coords.y });
      onMoveTable(draggingTableId, coords.x, coords.y);
      return;
    }
    if (!isDraggingCanvas) return;
    setPan({
      x: Math.max(-180, Math.min(180, e.clientX - dragStart.x)),
      y: Math.max(-140, Math.min(140, e.clientY - dragStart.y)),
    });
  };

  const handleCanvasMouseUp = () => {
    if (editable && draggingTableId && lastDraggedPos && onCommitTablePosition) {
      onCommitTablePosition(lastDraggedPos.id, lastDraggedPos.x, lastDraggedPos.y);
    }
    setIsDraggingCanvas(false);
    setDraggingTableId(null);
    setLastDraggedPos(null);
  };

  const resetViewport = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="space-y-4 text-[#171513]">
      {/* Zone Filter Bar & Editor Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-[#EFE9DF] p-1 border border-[#E7DED3]">
          <button
            type="button"
            onClick={() => setActiveZoneFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeZoneFilter === 'all'
                ? 'bg-[#171513] text-[#F8F4EE]'
                : 'text-[#171513]/70 hover:text-[#171513]'
            }`}
          >
            All Sanctuary Zones
          </button>
          {zones
            .filter((z) => z.isActive)
            .map((zone) => (
              <button
                key={zone.id}
                type="button"
                onClick={() => setActiveZoneFilter(zone.id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeZoneFilter === zone.id
                    ? 'bg-[#171513] text-[#F8F4EE]'
                    : 'text-[#171513]/70 hover:text-[#171513]'
                }`}
              >
                {zone.name}
              </button>
            ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <button
              type="button"
              onClick={() => setClickToPlaceMode((v) => !v)}
              className={`px-3 py-1.5 text-xs font-medium border inline-flex items-center gap-1.5 transition-colors ${
                clickToPlaceMode
                  ? 'bg-[#C65B2B] text-white border-[#C65B2B]'
                  : 'bg-[#F8F4EE] text-[#171513] border-[#E7DED3] hover:border-[#171513]'
              }`}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
              {clickToPlaceMode
                ? 'Click-to-Place Active (Click anywhere on map)'
                : 'Enable Click-to-Place Table'}
            </button>
          )}

          {hasDroneImage && (
            <button
              type="button"
              onClick={() => setShowBlueprintOverlay((v) => !v)}
              className="px-3 py-1.5 text-xs font-medium bg-[#F8F4EE] text-[#171513] border border-[#E7DED3] hover:border-[#171513] inline-flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-[#C65B2B]" />
              {showBlueprintOverlay ? 'Hide Zone Outlines' : 'Show Zone Outlines'}
            </button>
          )}

          {recommendedTableId && !editable && (
            <div className="text-xs text-[#58644E] font-medium">
              Host Recommendation: {tables.find((t) => t.id === recommendedTableId)?.label} (Fits{' '}
              {partySize} Guests)
            </div>
          )}
        </div>
      </div>

      {/* Architectural Dark / Drone Shot Canvas */}
      <div
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        className={`relative w-full h-[480px] sm:h-[560px] bg-[#141210] border border-[#2C2622] overflow-hidden select-none ${
          editable && clickToPlaceMode
            ? 'cursor-crosshair'
            : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {/* Top-Right Viewport Controls */}
        <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
            title="Zoom in floor plan"
            className="w-9 h-9 bg-[#F8F4EE] text-[#171513] flex items-center justify-center hover:bg-[#C65B2B] hover:text-white transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, Number((z - 0.15).toFixed(2))))}
            title="Zoom out floor plan"
            className="w-9 h-9 bg-[#F8F4EE] text-[#171513] flex items-center justify-center hover:bg-[#C65B2B] hover:text-white transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={resetViewport}
            title="Reset floor plan view"
            className="w-9 h-9 bg-[#F8F4EE] text-[#171513] flex items-center justify-center hover:bg-[#C65B2B] hover:text-white transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Top-Left Live Indicator */}
        <div className="absolute top-4 left-4 z-20 px-3 py-1.5 bg-[#1F1C19]/90 border border-[#38312B] text-[11px] font-mono-tabular text-[#E7DED3]/90">
          {editable
            ? clickToPlaceMode
              ? 'Click anywhere on the floor plan / drone shot to place selected table'
              : 'Floor Plan Editor · Drag any table node to reposition (auto-saves)'
            : `${selectedDate} · ${selectedTime} · ${partySize} Guests`}
        </div>

        {/* Transformable Architectural Blueprint / Drone Shot Plane */}
        <div
          ref={planeRef}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          className="relative w-full h-full transition-transform duration-150 ease-out"
        >
          {/* Uploaded Drone Shot Image Layer */}
          {hasDroneImage && (
            <div className="absolute inset-0 pointer-events-none">
              <img
                src={floorPlanImageUrl}
                alt="OneLove Café Sigiriya aerial drone floor plan"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/25" />
            </div>
          )}

          {/* Architectural Zone Outlines (Shown when no drone image or when overlay toggled on) */}
          {(!hasDroneImage || showBlueprintOverlay) && (
            <svg
              viewBox="0 0 1000 600"
              className={`w-full h-full pointer-events-none ${
                hasDroneImage ? 'opacity-65' : 'opacity-100'
              }`}
              preserveAspectRatio="none"
            >
              {!hasDroneImage && (
                <>
                  <defs>
                    <pattern id="archGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                      <path
                        d="M 50 0 L 0 0 0 50"
                        fill="none"
                        stroke="#26211D"
                        strokeWidth="0.7"
                      />
                    </pattern>
                  </defs>
                  <rect width="1000" height="600" fill="url(#archGrid)" />
                </>
              )}

              {/* North Horizon Marker: Sigiriya Lion Rock Vista */}
              <line
                x1="100"
                y1="32"
                x2="900"
                y2="32"
                stroke="#58644E"
                strokeWidth="1"
                strokeDasharray="6 6"
              />
              <text
                x="500"
                y="22"
                textAnchor="middle"
                fill="#8A997C"
                fontSize="11"
                letterSpacing="3"
                fontFamily="JetBrains Mono, monospace"
              >
                NORTH VISTA · SIGIRIYA LION ROCK &amp; JUNGLE CANOPY
              </text>

              {/* Zone 1: Jungle Canopy Verandah */}
              <rect
                x="80"
                y="55"
                width="840"
                height="145"
                fill={hasDroneImage ? 'rgba(28,25,22,0.35)' : '#1C1916'}
                stroke="#3A322C"
                strokeWidth="1.5"
              />
              <text
                x="105"
                y="80"
                fill="#E7DED3"
                fillOpacity="0.7"
                fontSize="10"
                letterSpacing="2"
                fontFamily="JetBrains Mono, monospace"
              >
                01 · JUNGLE CANOPY VERANDAH (OPEN-AIR TEAK DECK)
              </text>

              {/* Zone 2: Laterite Stone Courtyard & Reflecting Lotus Pool */}
              <rect
                x="80"
                y="220"
                width="840"
                height="165"
                fill={hasDroneImage ? 'rgba(24,21,18,0.35)' : '#181512'}
                stroke="#3A322C"
                strokeWidth="1.5"
              />
              <text
                x="105"
                y="245"
                fill="#E7DED3"
                fillOpacity="0.7"
                fontSize="10"
                letterSpacing="2"
                fontFamily="JetBrains Mono, monospace"
              >
                02 · LATERITE STONE COURTYARD
              </text>
              {/* Reflecting Lotus Pool Feature */}
              <rect
                x="310"
                y="332"
                width="240"
                height="38"
                fill={hasDroneImage ? 'rgba(29,38,27,0.55)' : '#1D261B'}
                stroke="#58644E"
                strokeWidth="1"
                strokeOpacity="0.8"
              />
              <text
                x="430"
                y="355"
                textAnchor="middle"
                fill="#8A997C"
                fontSize="9"
                letterSpacing="2"
                fontFamily="JetBrains Mono, monospace"
              >
                LOTUS REFLECTING POOL
              </text>
              {/* Wood-Fired Hearth Feature */}
              <rect
                x="590"
                y="332"
                width="145"
                height="38"
                fill={hasDroneImage ? 'rgba(42,26,20,0.55)' : '#2A1A14'}
                stroke="#C65B2B"
                strokeWidth="1"
                strokeOpacity="0.8"
              />
              <text
                x="662"
                y="355"
                textAnchor="middle"
                fill="#E58D65"
                fontSize="9"
                letterSpacing="2"
                fontFamily="JetBrains Mono, monospace"
              >
                LIVE HEARTH GRILL
              </text>

              {/* Zone 3: Roastery & Brew Sanctuary */}
              <rect
                x="80"
                y="405"
                width="580"
                height="145"
                fill={hasDroneImage ? 'rgba(27,24,21,0.35)' : '#1B1815'}
                stroke="#3A322C"
                strokeWidth="1.5"
              />
              <text
                x="105"
                y="430"
                fill="#E7DED3"
                fillOpacity="0.7"
                fontSize="10"
                letterSpacing="2"
                fontFamily="JetBrains Mono, monospace"
              >
                03 · ROASTERY &amp; BREW SANCTUARY (COOLED INDOOR)
              </text>
              <rect
                x="105"
                y="505"
                width="210"
                height="32"
                fill={hasDroneImage ? 'rgba(35,30,26,0.55)' : '#231E1A'}
                stroke="#4A3F37"
                strokeWidth="1"
              />
              <text
                x="210"
                y="525"
                textAnchor="middle"
                fill="#E7DED3"
                fillOpacity="0.8"
                fontSize="9"
                letterSpacing="2"
                fontFamily="JetBrains Mono, monospace"
              >
                CEYLON SIPHON &amp; ESPRESSO BAR
              </text>

              {/* Zone 4: Lotus Private Pavilion */}
              <rect
                x="685"
                y="405"
                width="235"
                height="145"
                fill={hasDroneImage ? 'rgba(30,26,22,0.45)' : '#1E1A16'}
                stroke="#C65B2B"
                strokeWidth="1.2"
                strokeOpacity="0.8"
              />
              <text
                x="705"
                y="430"
                fill="#E58D65"
                fillOpacity="0.9"
                fontSize="10"
                letterSpacing="2"
                fontFamily="JetBrains Mono, monospace"
              >
                04 · LOTUS PAVILION (VIP)
              </text>
            </svg>
          )}

          {/* Interactive Table Nodes */}
          {tables.map((table) => {
            const isZoneDimmed = activeZoneFilter !== 'all' && table.zoneId !== activeZoneFilter;
            const status = getTableStatus(table);
            const isSelected = selectedTableId === table.id;
            const isRecommended = recommendedTableId === table.id && !isSelected;
            const isSelectable =
              editable || status === 'available' || status === 'held_self';

            // Visual styling by state
            let nodeColors = 'bg-[#F8F4EE] text-[#171513] border-[#E7DED3] hover:border-[#C65B2B] shadow-md';
            if (isSelected) {
              nodeColors = 'bg-[#C65B2B] text-white border-white ring-4 ring-[#C65B2B]/50 shadow-lg';
            } else if (status === 'reserved') {
              nodeColors = 'bg-[#3D201C] text-[#E58D65]/80 border-[#6E342C] cursor-not-allowed';
            } else if (status === 'occupied' || status === 'held_other') {
              nodeColors = 'bg-[#262320] text-[#E7DED3]/40 border-[#3A3530] cursor-not-allowed';
            } else if (status === 'capacity_mismatch') {
              nodeColors = 'bg-[#1F1C19] text-[#E7DED3]/35 border-[#332E29] cursor-not-allowed';
            } else if (isRecommended) {
              nodeColors = 'bg-[#F8F4EE] text-[#171513] border-[#58644E] ring-2 ring-[#58644E] shadow-md';
            }

            const shapeClasses =
              table.shape === 'round'
                ? 'w-12 h-12 rounded-full'
                : table.shape === 'diamond'
                ? 'w-11 h-11 rotate-45'
                : table.shape === 'rectangle'
                ? 'w-20 h-11 rounded-sm'
                : 'w-12 h-12 rounded-sm';

            return (
              <button
                key={table.id}
                type="button"
                disabled={!isSelectable}
                onMouseDown={(e) => {
                  if (editable) {
                    e.stopPropagation();
                    onSelectTable(table);
                    setDraggingTableId(table.id);
                    setLastDraggedPos({ id: table.id, x: table.x, y: table.y });
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSelectable) {
                    onSelectTable(table);
                  }
                }}
                style={{
                  left: `${table.x}%`,
                  top: `${table.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                title={`${table.label} · ${table.zoneName} · Seats ${table.minGuests}–${table.capacity} guests (${status.replace('_', ' ')})`}
                className={`absolute z-10 flex flex-col items-center justify-center border-2 transition-all duration-100 ${shapeClasses} ${nodeColors} ${
                  isZoneDimmed ? 'opacity-25' : 'opacity-100'
                } ${editable ? 'cursor-move' : ''}`}
              >
                <div
                  className={
                    table.shape === 'diamond'
                      ? '-rotate-45 text-center leading-none'
                      : 'text-center leading-none'
                  }
                >
                  <div className="text-[11px] font-bold font-mono-tabular">T{table.number}</div>
                  <div className="text-[9px] opacity-80 font-mono-tabular">{table.capacity}p</div>
                </div>
                {table.isVip && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#D49B4B] border border-[#141210] ${
                      table.shape === 'diamond' ? '-rotate-45' : ''
                    }`}
                    title="VIP Sanctuary Table"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Legend Bar inside Canvas */}
        <div className="absolute bottom-3 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#141210]/90 border border-[#2C2622] text-[11px] text-[#E7DED3]/80">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#F8F4EE] inline-block" /> Available
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#C65B2B] inline-block" /> Selected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#3D201C] border border-[#6E342C] inline-block" />{' '}
              Reserved
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#262320] border border-[#3A3530] inline-block" />{' '}
              Occupied / Size Filter
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#D49B4B] inline-block" /> VIP Table
            </span>
          </div>
          <span className="hidden sm:inline text-[#E7DED3]/50 font-mono-tabular">
            {editable
              ? 'Drag table nodes or use Click-to-Place to position on drone shot'
              : 'Drag to pan · Click table node to select'}
          </span>
        </div>
      </div>
    </div>
  );
};
