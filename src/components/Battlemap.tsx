import { useState, useRef, useEffect } from "react";
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

// ── SVG shape renderer ────────────────────────────────────────
function renderShape(s: BattlemapShape) {
    const { id, kind, color, strokeWidth, x, y, width, height } = s;
    const cx = x + width / 2;
    const cy = y + height / 2;
    const base = { fill: "none", stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

    switch (kind) {
        case "RECT":
            return <rect key={id} x={x} y={y} width={width} height={height} {...base} />;
        case "CIRCLE":
            return <ellipse key={id} cx={cx} cy={cy} rx={Math.abs(width / 2)} ry={Math.abs(height / 2)} {...base} />;
        case "DIAMOND": {
            const pts = `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
            return <polygon key={id} points={pts} {...base} />;
        }
        case "TRIANGLE": {
            const pts = `${cx},${y} ${x + width},${y + height} ${x},${y + height}`;
            return <polygon key={id} points={pts} {...base} />;
        }
        default:
            return null;
    }
}

// Preview overlay for shape being drawn
function ShapePreview({ shape, drawPath }: { shape: BattlemapShape | null; drawPath: (pts: { x: number; y: number }[]) => string }) {
    if (!shape) return null;
    return (
        <svg className="battlemap-svg-layer" style={{ zIndex: 100, pointerEvents: "none" }}>
            {renderShape(shape)}
        </svg>
    );
}

export function Battlemap({
    sessionId,
    userId,
    isActive,
    imageUrl,
    gridSize,
    gridColor = "rgba(255,255,255,0.1)",
    gridThickness = 1,
    strokes,
    objects,
    shapes = [],
    isGM,
    layers = [],
    activeLayerId = "layer-drawings",
}: BattlemapProps) {
    const [localZoom, setLocalZoom] = useState(1);
    const [localOffset, setLocalOffset] = useState({ x: 0, y: 0 });
    const [activeTool, setActiveTool] = useState<Tool>(battlemapToolStore.activeTool);
    const [activeShape, setActiveShape] = useState<BattlemapShapeKind>(battlemapToolStore.activeShape);
    const [penColor, setPenColor] = useState(battlemapToolStore.penColor);
    const [showLibrary, setShowLibrary] = useState(battlemapToolStore.showLibrary);
    const [showLayersPanel, setShowLayersPanel] = useState(battlemapToolStore.showLayersPanel);
    const [isDragging, setIsDragging] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isShaping, setIsShaping] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
    const [previewShape, setPreviewShape] = useState<BattlemapShape | null>(null);
    const [localActiveLayerId, setLocalActiveLayerId] = useState(activeLayerId);

    useEffect(() => { setLocalActiveLayerId(activeLayerId); }, [activeLayerId]);

    useEffect(() => {
        const unsub = battlemapToolStore.subscribe(() => {
            setActiveTool(battlemapToolStore.activeTool);
            setActiveShape(battlemapToolStore.activeShape);
            setPenColor(battlemapToolStore.penColor);
            setShowLibrary(battlemapToolStore.showLibrary);
            setShowLayersPanel(battlemapToolStore.showLayersPanel);
        });
        return unsub;
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);
    const lastPos = useRef({ x: 0, y: 0 });
    const shapeDragStart = useRef({ x: 0, y: 0 });
    const shapeDraftId = useRef<string>("");

    if (!isActive) return null;

    const getCanvasPos = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        return {
            x: (clientX - rect.left - localOffset.x) / localZoom,
            y: (clientY - rect.top - localOffset.y) / localZoom,
        };
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (activeTool !== "MOVE") return;
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        const newZoom = Math.max(0.1, Math.min(5, localZoom + delta));
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const scaleChange = newZoom - localZoom;
            setLocalOffset(prev => ({
                x: prev.x - (mouseX - prev.x) * (scaleChange / localZoom),
                y: prev.y - (mouseY - prev.y) * (scaleChange / localZoom),
            }));
        }
        setLocalZoom(newZoom);
    };

    const resolveTargetLayer = (): BattlemapLayer | null => {
        const active = layers.find(l => l.id === localActiveLayerId && l.kind === "DRAWING");
        if (active) return active;
        return [...layers].filter(l => l.kind === "DRAWING").sort((a, b) => b.order - a.order)[0] || null;
    };

    const buildPreviewShape = (start: { x: number; y: number }, cur: { x: number; y: number }, kind: Exclude<BattlemapShapeKind, "FREEHAND">): BattlemapShape => {
        const x = Math.min(start.x, cur.x);
        const y = Math.min(start.y, cur.y);
        const width = Math.abs(cur.x - start.x);
        const height = Math.abs(cur.y - start.y);
        return { id: shapeDraftId.current, kind, color: penColor, strokeWidth: 4, x, y, width, height };
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
        containerRef.current?.setPointerCapture(e.pointerId);

        if (activeTool === "MOVE" || e.button === 1) {
            setIsDragging(true);
            lastPos.current = { x: e.clientX, y: e.clientY };
        } else if (activeTool === "ZOOM") {
            const isZoomOut = e.button === 2 || e.shiftKey;
            const factor = isZoomOut ? 0.7 : 1.4;
            const newZoom = Math.max(0.1, Math.min(5, localZoom * factor));
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const scaleChange = newZoom - localZoom;
                setLocalOffset(prev => ({
                    x: prev.x - (mouseX - prev.x) * (scaleChange / localZoom),
                    y: prev.y - (mouseY - prev.y) * (scaleChange / localZoom),
                }));
            }
            setLocalZoom(newZoom);
        } else if (activeTool === "PEN" && e.button === 0) {
            const pos = getCanvasPos(e.clientX, e.clientY);
            if (activeShape === "FREEHAND") {
                setIsDrawing(true);
                setCurrentStroke({ id: uuidv4(), color: penColor, width: 4 / localZoom, points: [pos] });
            } else {
                shapeDraftId.current = uuidv4();
                shapeDragStart.current = pos;
                setIsShaping(true);
                setPreviewShape(buildPreviewShape(pos, pos, activeShape as Exclude<BattlemapShapeKind, "FREEHAND">));
            }
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (isDragging) {
            const dx = e.clientX - lastPos.current.x;
            const dy = e.clientY - lastPos.current.y;
            setLocalOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            lastPos.current = { x: e.clientX, y: e.clientY };
        } else if (isDrawing && currentStroke) {
            const pos = getCanvasPos(e.clientX, e.clientY);
            setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos] } : prev);
        } else if (isShaping && activeShape !== "FREEHAND") {
            const pos = getCanvasPos(e.clientX, e.clientY);
            setPreviewShape(buildPreviewShape(shapeDragStart.current, pos, activeShape as Exclude<BattlemapShapeKind, "FREEHAND">));
        } else if (activeTool === "ERASER" && e.buttons === 1) {
            const pos = getCanvasPos(e.clientX, e.clientY);
            const eraseRadius = 20 / localZoom;

            const drawingLayerStrokeIds = new Set(
                layers.filter(l => l.kind === "DRAWING").flatMap(l => l.strokeIds || [])
            );
            const strokesToKeep = strokes.filter(s => {
                if (!drawingLayerStrokeIds.has(s.id)) return true;
                return !s.points.some(p => {
                    const dx = p.x - pos.x;
                    const dy = p.y - pos.y;
                    return (dx * dx + dy * dy) < eraseRadius * eraseRadius;
                });
            });

            if (strokesToKeep.length !== strokes.length) {
                const removedIds = new Set(strokes.map(s => s.id));
                strokesToKeep.forEach(s => removedIds.delete(s.id));
                const updatedLayers = layers.map(l =>
                    l.kind === "DRAWING"
                        ? { ...l, strokeIds: (l.strokeIds || []).filter(id => !removedIds.has(id)) }
                        : l
                );
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0,
                    type: "BATTLEMAP_UPDATED",
                    actorUserId: userId,
                    createdAt: new Date().toISOString(),
                    visibility: "PUBLIC",
                    payload: { strokes: strokesToKeep, layers: updatedLayers },
                } as any);
            }
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        containerRef.current?.releasePointerCapture(e.pointerId);
        setIsDragging(false);

        if (isDrawing && currentStroke) {
            setIsDrawing(false);
            if (currentStroke.points.length > 1) {
                const targetLayer = resolveTargetLayer();
                const newStrokes = [...strokes, currentStroke];
                const updatedLayers = targetLayer
                    ? layers.map(l => l.id === targetLayer.id
                        ? { ...l, strokeIds: [...(l.strokeIds || []), currentStroke.id] }
                        : l)
                    : layers;
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0,
                    type: "BATTLEMAP_UPDATED",
                    actorUserId: userId,
                    createdAt: new Date().toISOString(),
                    visibility: "PUBLIC",
                    payload: { strokes: newStrokes, layers: updatedLayers },
                } as any);
            }
            setCurrentStroke(null);
        }

        if (isShaping && previewShape) {
            setIsShaping(false);
            const { width, height } = previewShape;
            if (Math.abs(width) > 3 && Math.abs(height) > 3) {
                const targetLayer = resolveTargetLayer();
                const newShapes = [...shapes, previewShape];
                const updatedLayers = targetLayer
                    ? layers.map(l => l.id === targetLayer.id
                        ? { ...l, shapeIds: [...(l.shapeIds || []), previewShape.id] }
                        : l)
                    : layers;
                globalEventStore.append({
                    id: uuidv4(), sessionId, seq: 0,
                    type: "BATTLEMAP_UPDATED",
                    actorUserId: userId,
                    createdAt: new Date().toISOString(),
                    visibility: "PUBLIC",
                    payload: { shapes: newShapes, layers: updatedLayers },
                } as any);
            }
            setPreviewShape(null);
        }
    };

    const handleUpdateSettings = (updates: object) => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "BATTLEMAP_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: updates,
        } as any);
    };

    const drawPath = (pts: { x: number; y: number }[]) => {
        if (pts.length === 0) return "";
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
        return d;
    };

    const handleSelectImage = (url: string) => {
        const updatedLayers = layers.map(l =>
            l.kind === "IMAGE" ? { ...l, imageUrl: url, visible: true } : l
        );
        handleUpdateSettings({ imageUrl: url, layers: updatedLayers });
        battlemapToolStore.closeLibrary();
    };

    // ── Layer rendering helpers ───────────────────────────────
    const sortedLayers = [...layers].sort((a, b) => a.order - b.order);
    const assignedStrokeIds = new Set(layers.flatMap(l => l.strokeIds || []));
    const assignedShapeIds = new Set(layers.flatMap(l => l.shapeIds || []));
    const orphanStrokes = strokes.filter(s => !assignedStrokeIds.has(s.id));
    const orphanShapes = shapes.filter(s => !assignedShapeIds.has(s.id));

    const renderDrawingLayer = (layer: BattlemapLayer) => {
        const layerStrokes = layer.strokeIds
            ? strokes.filter(s => layer.strokeIds!.includes(s.id))
            : [];
        const layerShapes = layer.shapeIds
            ? shapes.filter(s => layer.shapeIds!.includes(s.id))
            : [];
        return (
            <svg key={layer.id} className="battlemap-svg-layer">
                {layerStrokes.map(s => (
                    <path
                        key={s.id}
                        d={drawPath(s.points)}
                        stroke={s.color}
                        strokeWidth={s.width}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}
                {layerShapes.map(s => renderShape(s))}
            </svg>
        );
    };

    return (
        <div className="battlemap-container">
            <div
                ref={containerRef}
                className="battlemap-canvas-area"
                style={{
                    cursor: activeTool === "MOVE" ? (isDragging ? "grabbing" : "grab") :
                            activeTool === "ERASER" ? "cell" : "crosshair",
                }}
                onWheel={handleWheel}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onContextMenu={e => e.preventDefault()}
            >
                <div
                    className="battlemap-transform-layer"
                    style={{ transform: `translate(${localOffset.x}px, ${localOffset.y}px) scale(${localZoom})` }}
                >
                    {layers.length === 0 ? (
                        <>
                            {imageUrl && <img src={imageUrl} alt="Map" className="battlemap-background-img" draggable={false} />}
                            <BattlemapObjects
                                objects={objects}
                                isGM={isGM}
                                zoom={localZoom}
                                onUpdateObject={(id, patch) => handleUpdateSettings({ objects: objects.map(o => o.id === id ? { ...o, ...patch } : o) })}
                                onDeleteObject={(id) => handleUpdateSettings({ objects: objects.filter(o => o.id !== id) })}
                            />
                            <svg className="battlemap-svg-layer">
                                {strokes.map(s => (
                                    <path key={s.id} d={drawPath(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                ))}
                                {shapes.map(s => renderShape(s))}
                            </svg>
                        </>
                    ) : (
                        sortedLayers.map(layer => {
                            if (!layer.visible) return null;

                            if (layer.kind === "BACKGROUND_COLOR") {
                                return (
                                    <div
                                        key={layer.id}
                                        style={{ position: "absolute", inset: 0, backgroundColor: layer.color || "#1a1a1a", pointerEvents: "none" }}
                                    />
                                );
                            }
                            if (layer.kind === "IMAGE") {
                                const src = layer.imageUrl || imageUrl;
                                if (!src) return null;
                                return <img key={layer.id} src={src} alt="Map" className="battlemap-background-img" draggable={false} />;
                            }
                            if (layer.kind === "OBJECTS") {
                                const layerObjects = layer.objectIds
                                    ? objects.filter(o => layer.objectIds!.includes(o.id))
                                    : objects;
                                return (
                                    <BattlemapObjects
                                        key={layer.id}
                                        objects={layerObjects}
                                        isGM={isGM}
                                        zoom={localZoom}
                                        onUpdateObject={(id, patch) => handleUpdateSettings({ objects: objects.map(o => o.id === id ? { ...o, ...patch } : o) })}
                                        onDeleteObject={(id) => {
                                            const newObjects = objects.filter(o => o.id !== id);
                                            const updatedLayers = layers.map(l =>
                                                l.kind === "OBJECTS"
                                                    ? { ...l, objectIds: (l.objectIds || []).filter(oid => oid !== id) }
                                                    : l
                                            );
                                            handleUpdateSettings({ objects: newObjects, layers: updatedLayers });
                                        }}
                                    />
                                );
                            }
                            if (layer.kind === "DRAWING") {
                                return renderDrawingLayer(layer);
                            }
                            return null;
                        })
                    )}

                    {/* Orphan strokes/shapes (legacy, not yet assigned to a layer) */}
                    {(orphanStrokes.length > 0 || orphanShapes.length > 0) && (
                        <svg className="battlemap-svg-layer">
                            {orphanStrokes.map(s => (
                                <path key={s.id} d={drawPath(s.points)} stroke={s.color} strokeWidth={s.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            ))}
                            {orphanShapes.map(s => renderShape(s))}
                        </svg>
                    )}

                    {/* Active freehand stroke preview */}
                    {currentStroke && (
                        <svg className="battlemap-svg-layer" style={{ zIndex: 99 }}>
                            <path
                                d={drawPath(currentStroke.points)}
                                stroke={currentStroke.color}
                                strokeWidth={currentStroke.width}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}

                    {/* Shape drag preview */}
                    <ShapePreview shape={previewShape} drawPath={drawPath} />

                    {gridSize > 0 && (
                        <div
                            className="battlemap-grid-layer"
                            style={{
                                backgroundSize: `${gridSize}px ${gridSize}px`,
                                backgroundImage: `
                                    linear-gradient(to right, ${gridColor} ${gridThickness}px, transparent ${gridThickness}px),
                                    linear-gradient(to bottom, ${gridColor} ${gridThickness}px, transparent ${gridThickness}px)
                                `,
                            }}
                        />
                    )}
                </div>
            </div>

            {isGM && showLayersPanel && layers.length > 0 && (
                <BattlemapLayersPanel
                    sessionId={sessionId}
                    userId={userId}
                    layers={layers}
                    activeLayerId={localActiveLayerId}
                    onSelectLayer={(id) => {
                        setLocalActiveLayerId(id);
                        handleUpdateSettings({ activeLayerId: id });
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
