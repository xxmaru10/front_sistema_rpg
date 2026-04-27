"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { Stroke, BattlemapObject, BattlemapLayer, BattlemapShape } from "@/types/domain";
import { v4 as uuidv4 } from "uuid";
import { ImageLibraryModal } from "./ImageLibraryModal";
import { battlemapToolStore, Tool, BattlemapShapeKind } from "@/lib/battlemapToolStore";
import { BattlemapObjects } from "./BattlemapObjects";
import { BattlemapLayersPanel } from "./BattlemapLayersPanel";

interface BattlemapProps {
    sessionId: string;
    userId: string;
    isActive: boolean;
    imageUrl: string;
    gridSize: number;
    gridColor?: string;
    gridThickness?: number;
    strokes: Stroke[];
    objects: BattlemapObject[];
    shapes?: BattlemapShape[];
    isGM: boolean;
    layers?: BattlemapLayer[];
    activeLayerId?: string;
}

// ── Hit-test helpers ──────────────────────────────────────────
function pointNearRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number, r: number): boolean {
    if (px < rx - r || px > rx + rw + r || py < ry - r || py > ry + rh + r) return false;
    if (px < rx || px > rx + rw || py < ry || py > ry + rh) return true;
    const minEdge = Math.min(px - rx, rx + rw - px, py - ry, ry + rh - py);
    return minEdge <= r;
}

// ── SVG shape helpers ─────────────────────────────────────────
function renderShapeEl(s: BattlemapShape) {
    const { id, kind, color, strokeWidth, x, y, width, height } = s;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const base = { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
    switch (kind) {
        case "RECT":    return <rect key={id} x={x} y={y} width={width} height={height} {...base} />;
        case "CIRCLE":  return <ellipse key={id} cx={cx} cy={cy} rx={Math.abs(width / 2)} ry={Math.abs(height / 2)} {...base} />;
        case "DIAMOND": return <polygon key={id} points={`${cx},${y} ${x+width},${cy} ${cx},${y+height} ${x},${cy}`} {...base} />;
        case "TRIANGLE":return <polygon key={id} points={`${cx},${y} ${x+width},${y+height} ${x},${y+height}`} {...base} />;
        default:        return null;
    }
}

function drawPath(pts: { x: number; y: number }[]) {
    if (pts.length === 0) return "";
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    return d;
}

export function Battlemap({
    sessionId, userId, isActive,
    imageUrl, gridSize,
    gridColor = "rgba(255,255,255,0.1)",
    gridThickness = 1,
    strokes, objects, shapes = [], isGM,
    layers = [], activeLayerId = "layer-drawings",
}: BattlemapProps) {

    // ── Rendering state ──────────────────────────────────────
    const [localZoom, setLocalZoom] = useState(1);
    const [localOffset, setLocalOffset] = useState({ x: 0, y: 0 });
    const [activeTool, setActiveTool] = useState<Tool>(battlemapToolStore.activeTool);
    const [activeShape, setActiveShape] = useState<BattlemapShapeKind>(battlemapToolStore.activeShape);
    const [penColor, setPenColor] = useState(battlemapToolStore.penColor);
    const [showLibrary, setShowLibrary] = useState(battlemapToolStore.showLibrary);
    const [showLayersPanel, setShowLayersPanel] = useState(battlemapToolStore.showLayersPanel);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [previewShape, setPreviewShape] = useState<BattlemapShape | null>(null);
    const [localActiveLayerId, setLocalActiveLayerId] = useState(activeLayerId);
    const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(null);

    // ── Refs for event handlers (always fresh, no stale closure) ─
    const isDraggingRef = useRef(false);
    const isDrawingRef  = useRef(false);
    const isShapingRef  = useRef(false);
    const isErasingRef  = useRef(false);
    const currentStrokeRef = useRef<Stroke | null>(null);
    const previewShapeRef  = useRef<BattlemapShape | null>(null);
    const eraserRemovedStrokeIds = useRef<Set<string>>(new Set());
    const eraserRemovedShapeIds  = useRef<Set<string>>(new Set());
    const lastPos       = useRef({ x: 0, y: 0 });
    const shapeDragStart= useRef({ x: 0, y: 0 });
    const containerRef  = useRef<HTMLDivElement>(null);

    // Stable refs so callbacks can always read latest prop values
    const strokesRef    = useRef(strokes);
    const shapesRef     = useRef(shapes);
    const layersRef     = useRef(layers);
    const sessionIdRef  = useRef(sessionId);
    const userIdRef     = useRef(userId);
    const localZoomRef  = useRef(localZoom);
    const localOffsetRef= useRef(localOffset);
    const activeToolRef = useRef(activeTool);
    const activeShapeRef= useRef(activeShape);
    const penColorRef   = useRef(penColor);
    const activeLayerIdRef = useRef(localActiveLayerId);

    useEffect(() => { strokesRef.current     = strokes;  }, [strokes]);
    useEffect(() => { shapesRef.current      = shapes;   }, [shapes]);
    useEffect(() => { layersRef.current      = layers;   }, [layers]);
    useEffect(() => { sessionIdRef.current   = sessionId;}, [sessionId]);
    useEffect(() => { userIdRef.current      = userId;   }, [userId]);
    useEffect(() => { localZoomRef.current   = localZoom;}, [localZoom]);
    useEffect(() => { localOffsetRef.current = localOffset; }, [localOffset]);
    useEffect(() => { activeToolRef.current  = activeTool;  }, [activeTool]);
    useEffect(() => { activeShapeRef.current = activeShape; }, [activeShape]);
    useEffect(() => { penColorRef.current    = penColor;    }, [penColor]);
    useEffect(() => { activeLayerIdRef.current = localActiveLayerId; }, [localActiveLayerId]);

    useEffect(() => { setLocalActiveLayerId(activeLayerId); }, [activeLayerId]);

    useEffect(() => {
        const unsub = battlemapToolStore.subscribe(() => {
            setActiveTool(battlemapToolStore.activeTool);
            setActiveShape(battlemapToolStore.activeShape);
            setPenColor(battlemapToolStore.penColor);
            setShowLibrary(battlemapToolStore.showLibrary);
            setShowLayersPanel(battlemapToolStore.showLayersPanel);
            activeToolRef.current  = battlemapToolStore.activeTool;
            activeShapeRef.current = battlemapToolStore.activeShape;
            penColorRef.current    = battlemapToolStore.penColor;
        });
        return unsub;
    }, []);

    if (!isActive) return null;

    // ── Helpers ───────────────────────────────────────────────
    const getCanvasPos = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const zoom = localZoomRef.current;
        const off  = localOffsetRef.current;
        return { x: (clientX - rect.left - off.x) / zoom, y: (clientY - rect.top - off.y) / zoom };
    };

    const resolveTargetLayer = (): BattlemapLayer | null => {
        const ls = layersRef.current;
        const aid = activeLayerIdRef.current;
        const active = ls.find(l => l.id === aid && l.kind === "DRAWING");
        if (active) return active;
        return [...ls].filter(l => l.kind === "DRAWING").sort((a, b) => b.order - a.order)[0] || null;
    };

    const emitBattlemapUpdate = (payload: object) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId: sessionIdRef.current,
            seq: 0,
            type: "BATTLEMAP_UPDATED",
            actorUserId: userIdRef.current,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload,
        } as any);
    };

    // ── Pointer handlers (use refs — never stale) ─────────────
    const handleWheel = (e: React.WheelEvent) => {
        if (activeToolRef.current !== "MOVE") return;
        e.preventDefault();
        const zoom = localZoomRef.current;
        const newZoom = Math.max(0.1, Math.min(5, zoom + e.deltaY * -0.001));
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const sc = newZoom - zoom;
            setLocalOffset(prev => ({
                x: prev.x - (mx - prev.x) * (sc / zoom),
                y: prev.y - (my - prev.y) * (sc / zoom),
            }));
        }
        setLocalZoom(newZoom);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.target instanceof HTMLSelectElement ||
            e.target instanceof HTMLButtonElement  ||
            e.target instanceof HTMLInputElement) return;

        containerRef.current?.setPointerCapture(e.pointerId);
        const tool  = activeToolRef.current;
        const shape = activeShapeRef.current;

        if (tool === "MOVE" || e.button === 1) {
            isDraggingRef.current = true;
            lastPos.current = { x: e.clientX, y: e.clientY };

        } else if (tool === "ZOOM") {
            const zoom = localZoomRef.current;
            const factor = (e.button === 2 || e.shiftKey) ? 0.7 : 1.4;
            const newZoom = Math.max(0.1, Math.min(5, zoom * factor));
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                const sc = newZoom - zoom;
                setLocalOffset(prev => ({
                    x: prev.x - (mx - prev.x) * (sc / zoom),
                    y: prev.y - (my - prev.y) * (sc / zoom),
                }));
            }
            setLocalZoom(newZoom);

        } else if (tool === "ERASER") {
            isErasingRef.current = true;
            eraserRemovedStrokeIds.current = new Set();
            eraserRemovedShapeIds.current  = new Set();

        } else if (tool === "PEN" && e.button === 0) {
            const pos = getCanvasPos(e.clientX, e.clientY);
            if (shape === "FREEHAND") {
                const stroke: Stroke = {
                    id: uuidv4(),
                    color: penColorRef.current,
                    width: 4,
                    points: [pos],
                };
                currentStrokeRef.current = stroke;
                isDrawingRef.current = true;
                setCurrentStroke(stroke);
            } else {
                const id = uuidv4();
                shapeDragStart.current = pos;
                const ps: BattlemapShape = {
                    id, kind: shape as Exclude<BattlemapShapeKind, "FREEHAND">,
                    color: penColorRef.current, strokeWidth: 4,
                    x: pos.x, y: pos.y, width: 0, height: 0,
                };
                previewShapeRef.current = ps;
                isShapingRef.current = true;
                setPreviewShape(ps);
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDraggingRef.current) {
            const dx = e.clientX - lastPos.current.x;
            const dy = e.clientY - lastPos.current.y;
            lastPos.current = { x: e.clientX, y: e.clientY };
            setLocalOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));

        } else if (isDrawingRef.current && currentStrokeRef.current) {
            const pos = getCanvasPos(e.clientX, e.clientY);
            const updated = { ...currentStrokeRef.current, points: [...currentStrokeRef.current.points, pos] };
            currentStrokeRef.current = updated;
            setCurrentStroke({ ...updated });

        } else if (isShapingRef.current && previewShapeRef.current) {
            const pos  = getCanvasPos(e.clientX, e.clientY);
            const start = shapeDragStart.current;
            const updated: BattlemapShape = {
                ...previewShapeRef.current,
                x: Math.min(start.x, pos.x),
                y: Math.min(start.y, pos.y),
                width:  Math.abs(pos.x - start.x),
                height: Math.abs(pos.y - start.y),
            };
            previewShapeRef.current = updated;
            setPreviewShape({ ...updated });

        }

        // Eraser cursor tracking (always, no button required)
        if (activeToolRef.current === "ERASER" && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setEraserCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }

        // Eraser hit accumulation (only while button held)
        if (isErasingRef.current && e.buttons === 1) {
            const pos = getCanvasPos(e.clientX, e.clientY);
            const r = 20 / localZoomRef.current;
            layersRef.current
                .filter(l => l.kind === "DRAWING" && l.visible)
                .forEach(l => {
                    (l.strokeIds || []).forEach(sid => {
                        if (eraserRemovedStrokeIds.current.has(sid)) return;
                        const s = strokesRef.current.find(s => s.id === sid);
                        if (s && s.points.some(p => {
                            const dx = p.x - pos.x, dy = p.y - pos.y;
                            return dx * dx + dy * dy < r * r;
                        })) eraserRemovedStrokeIds.current.add(sid);
                    });
                    (l.shapeIds || []).forEach(shid => {
                        if (eraserRemovedShapeIds.current.has(shid)) return;
                        const sh = shapesRef.current.find(s => s.id === shid);
                        if (sh && pointNearRect(pos.x, pos.y, sh.x, sh.y, sh.width, sh.height, r)) {
                            eraserRemovedShapeIds.current.add(shid);
                        }
                    });
                });
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        containerRef.current?.releasePointerCapture(e.pointerId);
        isDraggingRef.current = false;

        if (isDrawingRef.current && currentStrokeRef.current) {
            isDrawingRef.current = false;
            const stroke = currentStrokeRef.current;
            currentStrokeRef.current = null;
            setCurrentStroke(null);

            if (stroke.points.length > 1) {
                const targetLayer = resolveTargetLayer();
                const newStrokes = [...strokesRef.current, stroke];
                const updatedLayers = targetLayer
                    ? layersRef.current.map(l => l.id === targetLayer.id
                        ? { ...l, strokeIds: [...(l.strokeIds || []), stroke.id] }
                        : l)
                    : layersRef.current;
                emitBattlemapUpdate({ strokes: newStrokes, layers: updatedLayers });
            }
        }

        if (isShapingRef.current && previewShapeRef.current) {
            isShapingRef.current = false;
            const ps = previewShapeRef.current;
            previewShapeRef.current = null;
            setPreviewShape(null);

            if (Math.abs(ps.width) > 3 && Math.abs(ps.height) > 3) {
                const targetLayer = resolveTargetLayer();
                const newShapes = [...shapesRef.current, ps];
                const updatedLayers = targetLayer
                    ? layersRef.current.map(l => l.id === targetLayer.id
                        ? { ...l, shapeIds: [...(l.shapeIds || []), ps.id] }
                        : l)
                    : layersRef.current;
                emitBattlemapUpdate({ shapes: newShapes, layers: updatedLayers });
            }
        }

        if (isErasingRef.current) {
            isErasingRef.current = false;
            const removedStrokes = eraserRemovedStrokeIds.current;
            const removedShapes  = eraserRemovedShapeIds.current;
            eraserRemovedStrokeIds.current = new Set();
            eraserRemovedShapeIds.current  = new Set();

            if (removedStrokes.size > 0 || removedShapes.size > 0) {
                const newStrokes = strokesRef.current.filter(s => !removedStrokes.has(s.id));
                const newShapes  = shapesRef.current.filter(s  => !removedShapes.has(s.id));
                const updatedLayers = layersRef.current.map(l =>
                    l.kind === "DRAWING" ? {
                        ...l,
                        strokeIds: (l.strokeIds || []).filter(id => !removedStrokes.has(id)),
                        shapeIds:  (l.shapeIds  || []).filter(id => !removedShapes.has(id)),
                    } : l
                );
                emitBattlemapUpdate({ strokes: newStrokes, shapes: newShapes, layers: updatedLayers });
            }
        }
    };

    const handleSelectImage = (url: string) => {
        const updatedLayers = layers.map(l => l.kind === "IMAGE" ? { ...l, imageUrl: url, visible: true } : l);
        emitBattlemapUpdate({ imageUrl: url, layers: updatedLayers });
        battlemapToolStore.closeLibrary();
    };

    // ── Render helpers ────────────────────────────────────────
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
    const assignedStrokeIds = new Set(layers.flatMap(l => l.strokeIds || []));
    const assignedShapeIds  = new Set(layers.flatMap(l => l.shapeIds  || []));
    const orphanStrokes = strokes.filter(s => !assignedStrokeIds.has(s.id));
    const orphanShapes  = shapes.filter(s  => !assignedShapeIds.has(s.id));

    const renderDrawingLayer = (layer: BattlemapLayer) => {
        const ls = layer.strokeIds ? strokes.filter(s => layer.strokeIds!.includes(s.id)) : [];
        const ss = layer.shapeIds  ? shapes.filter(s  => layer.shapeIds!.includes(s.id))  : [];
        return (
            <svg key={layer.id} className="battlemap-svg-layer">
                {ls.map(s => <path key={s.id} d={drawPath(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
                {ss.map(s => renderShapeEl(s))}
            </svg>
        );
    };

    // ── JSX ───────────────────────────────────────────────────
    return (
        <div className="battlemap-container">
            <div
                ref={containerRef}
                className="battlemap-canvas-area"
                style={{ cursor: activeTool === "ERASER" ? "none" : isDraggingRef.current ? "grabbing" : activeTool === "MOVE" ? "grab" : "crosshair" }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={(e) => { handlePointerUp(e); setEraserCursor(null); }}
                onContextMenu={e => e.preventDefault()}
            >
                <div
                    className="battlemap-transform-layer"
                    style={{ transform: `translate(${localOffset.x}px, ${localOffset.y}px) scale(${localZoom})` }}
                >
                    {layers.length === 0 ? (
                        /* Legacy mode — no layers yet */
                        <>
                            {imageUrl && <img src={imageUrl} alt="Map" className="battlemap-background-img" draggable={false} />}
                            <BattlemapObjects
                                objects={objects} isGM={isGM} zoom={localZoom}
                                onUpdateObject={(id, patch) => emitBattlemapUpdate({ objects: objects.map(o => o.id === id ? { ...o, ...patch } : o) })}
                                onDeleteObject={(id) => emitBattlemapUpdate({ objects: objects.filter(o => o.id !== id) })}
                            />
                            <svg className="battlemap-svg-layer">
                                {strokes.map(s => <path key={s.id} d={drawPath(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
                                {shapes.map(s => renderShapeEl(s))}
                            </svg>
                        </>
                    ) : (
                        sortedLayers.map(layer => {
                            if (!layer.visible) return null;
                            if (layer.kind === "BACKGROUND_COLOR") return (
                                <div key={layer.id} style={{ position: "absolute", inset: 0, backgroundColor: layer.color || "#1a1a1a", pointerEvents: "none" }} />
                            );
                            if (layer.kind === "IMAGE") {
                                const src = layer.imageUrl || imageUrl;
                                return src ? <img key={layer.id} src={src} alt="Map" className="battlemap-background-img" draggable={false} /> : null;
                            }
                            if (layer.kind === "OBJECTS") {
                                const layerObjs = layer.objectIds ? objects.filter(o => layer.objectIds!.includes(o.id)) : objects;
                                return (
                                    <BattlemapObjects
                                        key={layer.id}
                                        objects={layerObjs} isGM={isGM} zoom={localZoom}
                                        onUpdateObject={(id, patch) => emitBattlemapUpdate({ objects: objects.map(o => o.id === id ? { ...o, ...patch } : o) })}
                                        onDeleteObject={(id) => {
                                            emitBattlemapUpdate({
                                                objects: objects.filter(o => o.id !== id),
                                                layers: layers.map(l => l.kind === "OBJECTS" ? { ...l, objectIds: (l.objectIds || []).filter(oid => oid !== id) } : l),
                                            });
                                        }}
                                    />
                                );
                            }
                            if (layer.kind === "DRAWING") return renderDrawingLayer(layer);
                            return null;
                        })
                    )}

                    {/* Orphan strokes/shapes from sessions without layers */}
                    {(orphanStrokes.length > 0 || orphanShapes.length > 0) && (
                        <svg className="battlemap-svg-layer">
                            {orphanStrokes.map(s => <path key={s.id} d={drawPath(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
                            {orphanShapes.map(s => renderShapeEl(s))}
                        </svg>
                    )}

                    {/* Live freehand preview */}
                    {currentStroke && (
                        <svg className="battlemap-svg-layer" style={{ zIndex: 99 }}>
                            <path d={drawPath(currentStroke.points)} stroke={currentStroke.color} strokeWidth={currentStroke.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}

                    {/* Live shape preview */}
                    {previewShape && (
                        <svg className="battlemap-svg-layer" style={{ zIndex: 99 }}>
                            {renderShapeEl(previewShape)}
                        </svg>
                    )}

                    {gridSize > 0 && (
                        <div
                            className="battlemap-grid-layer"
                            style={{
                                backgroundSize: `${gridSize}px ${gridSize}px`,
                                backgroundImage: `linear-gradient(to right, ${gridColor} ${gridThickness}px, transparent ${gridThickness}px), linear-gradient(to bottom, ${gridColor} ${gridThickness}px, transparent ${gridThickness}px)`,
                            }}
                        />
                    )}
                </div>
            </div>

            {activeTool === "ERASER" && eraserCursor && (
                <svg
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 100, overflow: "visible" }}
                >
                    <circle
                        cx={eraserCursor.x} cy={eraserCursor.y} r={20}
                        fill="rgba(255,255,255,0.08)"
                        stroke="rgba(255,255,255,0.65)"
                        strokeWidth={1.5}
                        strokeDasharray="5 3"
                    />
                </svg>
            )}

            {isGM && showLayersPanel && layers.length > 0 && (
                <BattlemapLayersPanel
                    sessionId={sessionId} userId={userId}
                    layers={layers} activeLayerId={localActiveLayerId}
                    onSelectLayer={(id) => {
                        setLocalActiveLayerId(id);
                        activeLayerIdRef.current = id;
                        emitBattlemapUpdate({ activeLayerId: id });
                    }}
                />
            )}

            {showLibrary && (
                <ImageLibraryModal
                    isOpen={showLibrary}
                    onClose={() => battlemapToolStore.closeLibrary()}
                    onSelect={handleSelectImage}
                />
            )}
        </div>
    );
}
