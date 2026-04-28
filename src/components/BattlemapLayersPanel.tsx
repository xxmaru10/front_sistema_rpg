import { BattlemapLayer, BattlemapScene } from "@/types/domain";
import type { DragEvent } from "react";

interface BattlemapLayersPanelProps {
    scene: BattlemapScene;
    onBackgroundColorChange: (color: string) => void;
    onReorderLayer: (sourceId: string, targetId: string) => void;
}

export function BattlemapLayersPanel({ scene, onBackgroundColorChange, onReorderLayer }: BattlemapLayersPanelProps) {
    const movePayload = (event: DragEvent<HTMLDivElement>, layerId: string) => {
        event.dataTransfer.setData("text/layer-id", layerId);
    };

    const dropPayload = (event: DragEvent<HTMLDivElement>, layerId: string) => {
        event.preventDefault();
        const sourceId = event.dataTransfer.getData("text/layer-id");
        if (!sourceId || sourceId === layerId) return;
        onReorderLayer(sourceId, layerId);
    };

    return (
        <aside className="battlemap-layers-panel">
            <h3>Camadas</h3>
            <div className="battlemap-layer background">
                <span>Background</span>
                <input type="color" value={scene.backgroundColor} onChange={(e) => onBackgroundColorChange(e.target.value)} />
            </div>
            {scene.layers.filter((l) => l.type !== "BACKGROUND").map((layer: BattlemapLayer) => (
                <div
                    key={layer.id}
                    className="battlemap-layer"
                    draggable
                    onDragStart={(e) => movePayload(e, layer.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => dropPayload(e, layer.id)}
                >
                    <span>{layer.name}</span>
                    {layer.thumbnailUrl ? <img src={layer.thumbnailUrl} alt="thumb" /> : <span className="empty-thumb" />}
                </div>
            ))}
        </aside>
    );
}
