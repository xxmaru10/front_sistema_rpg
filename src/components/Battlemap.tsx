import { useState, useRef, useEffect } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { Stroke, BattlemapObject, BattlemapScene, BattlemapBackgroundTransform } from "@/types/domain";
import { v4 as uuidv4 } from "uuid";
import { ImageLibraryModal } from "./ImageLibraryModal";
import { battlemapToolStore, Tool } from "@/lib/battlemapToolStore";
import { BattlemapObjects } from "./BattlemapObjects";
import { BattlemapSceneManager } from "./BattlemapSceneManager";
import { BattlemapLayersPanel } from "./BattlemapLayersPanel";
import { BattlemapBackgroundEditor } from "./BattlemapBackgroundEditor";

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
    scenes?: BattlemapScene[];
    activeSceneId?: string;
    isGM: boolean;
    mode?: "combat" | "theater";
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
    scenes,
    activeSceneId,
    isGM,
    mode = "combat",
}: BattlemapProps) {
    const [localZoom, setLocalZoom] = useState(1);
    const [localOffset, setLocalOffset] = useState({ x: 0, y: 0 });
    const [activeTool, setActiveTool] = useState<Tool>(battlemapToolStore.activeTool);
    const [penColor, setPenColor] = useState(battlemapToolStore.penColor);
    const [showLibrary, setShowLibrary] = useState(battlemapToolStore.showLibrary);
    const [isBackgroundEditing, setIsBackgroundEditing] = useState(false);
    const [draftBackgroundUrl, setDraftBackgroundUrl] = useState<string | null>(null);
    const [draftTransform, setDraftTransform] = useState<BattlemapBackgroundTransform>({ x: 0, y: 0, width: 1280, height: 720 });
    const [isDragging, setIsDragging] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

    useEffect(() => {
        const unsub = battlemapToolStore.subscribe(() => {
            setActiveTool(battlemapToolStore.activeTool);
            setPenColor(battlemapToolStore.penColor);
            setShowLibrary(battlemapToolStore.showLibrary);
        });
        return unsub;
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);
    const lastPos = useRef({ x: 0, y: 0 });

    if (!isActive) return null;

    const fallbackScene: BattlemapScene = {
        id: "scene-1",
        name: "Cena 1",
        backgroundColor: "#0d0907",
        backgroundImage: mode === "theater" ? undefined : imageUrl || undefined,
        backgroundTransform: { x: 0, y: 0, width: 1280, height: 720 },
        layers: [
            { id: "layer-bg-scene-1", type: "BACKGROUND", name: "Background" },
            ...objects.map((obj) => ({
                id: `layer-object-${obj.id}`,
                type: "OBJECT" as const,
                name: "Objeto",
                objectId: obj.id,
                thumbnailUrl: obj.imageUrl,
            })),
        ],
        strokes,
        objects,
    };
    const resolvedScenes: BattlemapScene[] = scenes && scenes.length > 0 ? scenes : [fallbackScene];
    const resolvedActiveSceneId = activeSceneId || resolvedScenes[0]?.id;
    const activeScene = resolvedScenes.find((scene) => scene.id === resolvedActiveSceneId) || fallbackScene;
    const sceneBackgroundImage = mode === "theater" && activeScene.backgroundImage === imageUrl
        ? undefined
        : activeScene.backgroundImage;
    const displayedBackgroundImage = mode === "theater"
        ? sceneBackgroundImage
        : (sceneBackgroundImage || imageUrl);

    // Helper: Convert screen coordinates to canvas coordinates
    const getCanvasPos = (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        // Mouse relative to container
        const rx = clientX - rect.left;
        const ry = clientY - rect.top;
        // Undo zoom and pan
        const cx = (rx - localOffset.x) / localZoom;
        const cy = (ry - localOffset.y) / localZoom;
        return { x: cx, y: cy };
    };

    const handleWheel = (e: React.WheelEvent) => {
        if (activeTool !== "MOVE") return; // Optional: restrict zoom to move tool
        e.preventDefault();
        const delta = e.deltaY * -0.001;
        const newZoom = Math.max(0.1, Math.min(5, localZoom + delta));
        
        // Zoom towards mouse pointer
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const scaleChange = newZoom - localZoom;
            const offsetX = -(mouseX - localOffset.x) * (scaleChange / localZoom);
            const offsetY = -(mouseY - localOffset.y) * (scaleChange / localZoom);

            setLocalOffset(prev => ({
                x: prev.x + offsetX,
                y: prev.y + offsetY
            }));
        }

        setLocalZoom(newZoom);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLInputElement) return;
        
        containerRef.current?.setPointerCapture(e.pointerId);
        
        if (activeTool === "MOVE" || e.button === 1) { // Middle click always pans
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
                const offsetX = -(mouseX - localOffset.x) * (scaleChange / localZoom);
                const offsetY = -(mouseY - localOffset.y) * (scaleChange / localZoom);

                setLocalOffset(prev => ({
                    x: prev.x + offsetX,
                    y: prev.y + offsetY
                }));
            }
            setLocalZoom(newZoom);
        } else if (activeTool === "PEN" && e.button === 0) {
            setIsDrawing(true);
            const pos = getCanvasPos(e.clientX, e.clientY);
            setCurrentStroke({
                id: uuidv4(),
                color: penColor,
                width: 4 / localZoom, // Pen size scales inversely so it looks uniform? No, let's keep it fixed relative to canvas.
                points: [pos]
            });
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
            setCurrentStroke(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    points: [...prev.points, pos]
                };
            });
        } else if (activeTool === "ERASER" && e.buttons === 1) {
            const pos = getCanvasPos(e.clientX, e.clientY);
            // Simple hit test for eraser
            const eraseRadius = 20 / localZoom;
            const strokesToKeep = strokes.filter(s => {
                // If any point in stroke is near eraser pos, delete stroke
                const hit = s.points.some(p => {
                    const dx = p.x - pos.x;
                    const dy = p.y - pos.y;
                    return (dx*dx + dy*dy) < eraseRadius*eraseRadius;
                });
                return !hit;
            });

            if (strokesToKeep.length !== strokes.length) {
                globalEventStore.append({
                    id: uuidv4(),
                    sessionId,
                    seq: 0,
                    type: "BATTLEMAP_UPDATED",
                    actorUserId: userId,
                    createdAt: new Date().toISOString(),
                    visibility: "PUBLIC",
                    payload: { strokes: strokesToKeep }
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
                globalEventStore.append({
                    id: uuidv4(),
                    sessionId,
                    seq: 0,
                    type: "BATTLEMAP_UPDATED",
                    actorUserId: userId,
                    createdAt: new Date().toISOString(),
                    visibility: "PUBLIC",
                    payload: { strokes: [...strokes, currentStroke] }
                } as any);
            }
            setCurrentStroke(null);
        }
    };

    const handleUpdateSettings = (updates: any) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "BATTLEMAP_UPDATED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: updates
        } as any);
    };

    const drawPath = (pts: {x:number, y:number}[]) => {
        if (pts.length === 0) return "";
        const start = pts[0];
        let d = `M ${start.x} ${start.y}`;
        for(let i=1; i<pts.length; i++) {
            d += ` L ${pts[i].x} ${pts[i].y}`;
        }
        return d;
    };

    const handleSelectImage = (url: string) => {
        if (mode === "theater") {
            setDraftBackgroundUrl(url);
            setDraftTransform(activeScene.backgroundTransform || { x: 0, y: 0, width: 1280, height: 720 });
            setIsBackgroundEditing(true);
            battlemapToolStore.setTheaterBackgroundEditing(true);
            battlemapToolStore.closeLibrary();
            return;
        }
        const choice = confirm("Clique em OK para definir como FUNDO ou CANCELAR para adicionar como OBJETO (token).");
        if (choice) {
            handleUpdateSettings({ imageUrl: url });
        } else {
            const newObj: BattlemapObject = {
                id: uuidv4(),
                imageUrl: url,
                x: 100,
                y: 100,
                width: 100,
                height: 100,
                rotation: 0,
                locked: false
            };
            handleUpdateSettings({ objects: [...objects, newObj] });
        }
        battlemapToolStore.closeLibrary();
    };

    const handleSceneUpdate = (patch: Partial<BattlemapScene>) => {
        const updatedScenes = resolvedScenes.map((scene) => scene.id === activeScene.id ? { ...scene, ...patch } : scene);
        handleUpdateSettings({ scenes: updatedScenes, activeSceneId: activeScene.id });
    };

    return (
        <div className="battlemap-container">
            {mode === "theater" && (
                <BattlemapSceneManager
                    scenes={resolvedScenes}
                    activeSceneId={resolvedActiveSceneId}
                    onSelectScene={(sceneId) => handleUpdateSettings({ activeSceneId: sceneId })}
                    onCreateScene={() => {
                        if (resolvedScenes.length >= 5) return;
                        const sceneId = uuidv4();
                        const newScene: BattlemapScene = {
                            id: sceneId,
                            name: `Cena ${resolvedScenes.length + 1}`,
                            backgroundColor: "#0d0907",
                            backgroundTransform: { x: 0, y: 0, width: 1280, height: 720 },
                            layers: [{ id: `layer-bg-${sceneId}`, type: "BACKGROUND", name: "Background" }],
                            strokes: [],
                            objects: [],
                        };
                        handleUpdateSettings({ scenes: [...resolvedScenes, newScene], activeSceneId: sceneId });
                    }}
                />
            )}
            <div 
                ref={containerRef}
                className="battlemap-canvas-area"
                style={{
                    cursor: activeTool === "MOVE" ? (isDragging ? "grabbing" : "grab") : "crosshair",
                    background: activeScene.backgroundColor,
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
                    style={{
                        transform: `translate(${localOffset.x}px, ${localOffset.y}px) scale(${localZoom})`,
                    }}
                >
                    {displayedBackgroundImage && (
                        <img 
                            src={displayedBackgroundImage} 
                            alt="Map" 
                            className="battlemap-background-img" 
                            draggable={false}
                        />
                    )}

                    <BattlemapObjects 
                        objects={activeScene.objects || objects} 
                        isGM={isGM}
                        zoom={localZoom}
                        onUpdateObject={(id, patch) => {
                            const newObjects = (activeScene.objects || objects).map(o => o.id === id ? { ...o, ...patch } : o);
                            if (mode === "theater") {
                                handleSceneUpdate({ objects: newObjects });
                            } else {
                                handleUpdateSettings({ objects: newObjects });
                            }
                        }}
                        onDeleteObject={(id) => {
                            const newObjects = (activeScene.objects || objects).filter(o => o.id !== id);
                            if (mode === "theater") {
                                handleSceneUpdate({ objects: newObjects, layers: activeScene.layers.filter((layer) => layer.objectId !== id) });
                            } else {
                                handleUpdateSettings({ objects: newObjects });
                            }
                        }}
                    />

                    <svg className="battlemap-svg-layer">
                        {(activeScene.strokes || strokes).map(s => (
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
                        {currentStroke && (
                            <path 
                                d={drawPath(currentStroke.points)} 
                                stroke={currentStroke.color} 
                                strokeWidth={currentStroke.width}
                                fill="none"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        )}
                    </svg>

                    {gridSize > 0 && (
                        <div 
                            className="battlemap-grid-layer"
                            style={{ 
                                backgroundSize: `${gridSize}px ${gridSize}px`,
                                backgroundImage: `
                                    linear-gradient(to right, ${gridColor} ${gridThickness}px, transparent ${gridThickness}px),
                                    linear-gradient(to bottom, ${gridColor} ${gridThickness}px, transparent ${gridThickness}px)
                                `
                            }} 
                        />
                    )}
                </div>
            </div>

            {showLibrary && (
                <ImageLibraryModal 
                    isOpen={showLibrary} 
                    onClose={() => battlemapToolStore.closeLibrary()} 
                    onSelect={handleSelectImage}
                />
            )}

            {mode === "theater" && battlemapToolStore.theaterLayersOpen && (
                <BattlemapLayersPanel
                    scene={activeScene}
                    onBackgroundColorChange={(color) => handleSceneUpdate({ backgroundColor: color })}
                    onReorderLayer={(sourceId, targetId) => {
                        const dynamicLayers = activeScene.layers.filter((l) => l.type !== "BACKGROUND");
                        const srcIndex = dynamicLayers.findIndex((l) => l.id === sourceId);
                        const tgtIndex = dynamicLayers.findIndex((l) => l.id === targetId);
                        if (srcIndex < 0 || tgtIndex < 0) return;
                        const reordered = [...dynamicLayers];
                        const [moved] = reordered.splice(srcIndex, 1);
                        reordered.splice(tgtIndex, 0, moved);
                        handleSceneUpdate({ layers: [activeScene.layers[0], ...reordered] });
                    }}
                />
            )}

            {mode === "theater" && isBackgroundEditing && draftBackgroundUrl && (
                <BattlemapBackgroundEditor
                    imageUrl={draftBackgroundUrl}
                    transform={draftTransform}
                    onChange={setDraftTransform}
                    onConfirm={() => {
                        handleSceneUpdate({
                            backgroundImage: draftBackgroundUrl,
                            backgroundTransform: draftTransform,
                            layers: activeScene.layers.some((l) => l.id === `layer-bgimg-${activeScene.id}`)
                                ? activeScene.layers
                                : [
                                    ...activeScene.layers,
                                    { id: `layer-bgimg-${activeScene.id}`, type: "OBJECT", name: "Cenario", thumbnailUrl: draftBackgroundUrl },
                                ],
                        });
                        setIsBackgroundEditing(false);
                        setDraftBackgroundUrl(null);
                        battlemapToolStore.setTheaterBackgroundEditing(false);
                    }}
                    onCancel={() => {
                        setIsBackgroundEditing(false);
                        setDraftBackgroundUrl(null);
                        battlemapToolStore.setTheaterBackgroundEditing(false);
                    }}
                />
            )}
        </div>
    );
}
