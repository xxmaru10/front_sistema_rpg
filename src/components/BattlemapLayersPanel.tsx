import { useState, useRef } from "react";
import { GripVertical, Eye, EyeOff, Trash2, Image, PenTool, Users, Plus } from "lucide-react";
import { BattlemapLayer, BattlemapLayerKind } from "@/types/domain";
import { v4 as uuidv4 } from "uuid";
import { globalEventStore } from "@/lib/eventStore";

interface BattlemapLayersPanelProps {
    sessionId: string;
    userId: string;
    layers: BattlemapLayer[];
    activeLayerId: string;
    onSelectLayer: (id: string) => void;
}

const KIND_LABELS: Record<BattlemapLayerKind, string> = {
    BACKGROUND_COLOR: "Fundo",
    IMAGE: "Imagem",
    DRAWING: "Desenho",
    OBJECTS: "Tokens",
};

function LayerThumb({ layer }: { layer: BattlemapLayer }) {
    if (layer.kind === "BACKGROUND_COLOR") {
        return (
            <div
                className="battlemap-layer-thumb"
                style={{ backgroundColor: layer.color || "#1a1a1a" }}
            />
        );
    }
    if (layer.kind === "IMAGE" && layer.imageUrl) {
        return (
            <div className="battlemap-layer-thumb">
                <img src={layer.imageUrl} alt="" />
            </div>
        );
    }
    const Icon =
        layer.kind === "IMAGE" ? Image :
        layer.kind === "DRAWING" ? PenTool :
        Users;
    return (
        <div className="battlemap-layer-thumb">
            <Icon size={14} />
        </div>
    );
}

function emitLayersUpdate(sessionId: string, userId: string, layers: BattlemapLayer[], extra?: object) {
    globalEventStore.append({
        id: uuidv4(),
        sessionId,
        seq: 0,
        type: "BATTLEMAP_UPDATED",
        actorUserId: userId,
        createdAt: new Date().toISOString(),
        visibility: "PUBLIC",
        payload: { layers, ...extra },
    } as any);
}

export function BattlemapLayersPanel({
    sessionId,
    userId,
    layers,
    activeLayerId,
    onSelectLayer,
}: BattlemapLayersPanelProps) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    // Render top-to-bottom = highest order first (Canva convention)
    const sorted = [...layers].sort((a, b) => b.order - a.order);

    const handleDragStart = (index: number) => {
        dragItem.current = index;
    };

    const handleDragEnter = (index: number) => {
        dragOverItem.current = index;
    };

    const handleDragEnd = () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        if (dragItem.current === dragOverItem.current) return;

        const reordered = [...sorted];
        const [moved] = reordered.splice(dragItem.current, 1);
        reordered.splice(dragOverItem.current, 0, moved);

        const withNewOrder = reordered.map((layer, i) => ({
            ...layer,
            order: reordered.length - 1 - i,
        }));

        dragItem.current = null;
        dragOverItem.current = null;
        emitLayersUpdate(sessionId, userId, withNewOrder);
    };

    const toggleVisibility = (layer: BattlemapLayer) => {
        const updated = layers.map(l =>
            l.id === layer.id ? { ...l, visible: !l.visible } : l
        );
        emitLayersUpdate(sessionId, userId, updated);
    };

    const deleteLayer = (layer: BattlemapLayer) => {
        if (layer.locked) return;
        const updated = layers.filter(l => l.id !== layer.id);
        const extra = layer.id === activeLayerId ? { activeLayerId: "layer-drawings" } : {};
        emitLayersUpdate(sessionId, userId, updated, extra);
    };

    const commitRename = (layer: BattlemapLayer) => {
        if (!editingName.trim()) {
            setEditingId(null);
            return;
        }
        const updated = layers.map(l =>
            l.id === layer.id ? { ...l, name: editingName.trim() } : l
        );
        emitLayersUpdate(sessionId, userId, updated);
        setEditingId(null);
    };

    const addDrawingLayer = () => {
        const newId = uuidv4();
        const maxOrder = layers.reduce((m, l) => Math.max(m, l.order), 0);
        const newLayer: BattlemapLayer = {
            id: newId,
            kind: "DRAWING",
            name: "Nova Camada",
            order: maxOrder + 1,
            visible: true,
            locked: false,
            strokeIds: [],
        };
        emitLayersUpdate(sessionId, userId, [...layers, newLayer], { activeLayerId: newId });
        onSelectLayer(newId);
    };

    return (
        <div className="battlemap-layers-panel">
            <div className="battlemap-layers-header">
                <span>Camadas</span>
                <button
                    className="battlemap-layers-add-btn"
                    onClick={addDrawingLayer}
                    title="Nova camada de desenho"
                >
                    <Plus size={11} />
                    <span>Nova</span>
                </button>
            </div>

            <div className="battlemap-layers-list">
                {sorted.map((layer, index) => (
                    <div
                        key={layer.id}
                        className={`battlemap-layer-item${layer.id === activeLayerId ? " active" : ""}`}
                        onClick={() => onSelectLayer(layer.id)}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragEnter={() => handleDragEnter(index)}
                        onDragEnd={handleDragEnd}
                        onDragOver={e => e.preventDefault()}
                    >
                        <span
                            className="battlemap-layer-drag-handle"
                            onMouseDown={e => e.stopPropagation()}
                        >
                            <GripVertical size={12} />
                        </span>

                        <LayerThumb layer={layer} />

                        <div className="battlemap-layer-info">
                            {editingId === layer.id ? (
                                <input
                                    className="battlemap-layer-name-input"
                                    value={editingName}
                                    autoFocus
                                    onChange={e => setEditingName(e.target.value)}
                                    onBlur={() => commitRename(layer)}
                                    onKeyDown={e => {
                                        if (e.key === "Enter") commitRename(layer);
                                        if (e.key === "Escape") setEditingId(null);
                                    }}
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <>
                                    <div
                                        className="battlemap-layer-name"
                                        onDoubleClick={e => {
                                            e.stopPropagation();
                                            setEditingId(layer.id);
                                            setEditingName(layer.name);
                                        }}
                                    >
                                        {layer.name}
                                    </div>
                                    <div className="battlemap-layer-kind">
                                        {KIND_LABELS[layer.kind]}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="battlemap-layer-actions">
                            <button
                                className={`battlemap-layer-action-btn${layer.visible ? " eye-active" : ""}`}
                                title={layer.visible ? "Ocultar camada" : "Mostrar camada"}
                                onClick={e => { e.stopPropagation(); toggleVisibility(layer); }}
                            >
                                {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                            </button>
                            <button
                                className="battlemap-layer-action-btn delete"
                                title={layer.locked ? "Camada bloqueada" : "Apagar camada"}
                                disabled={layer.locked}
                                onClick={e => { e.stopPropagation(); deleteLayer(layer); }}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
