import { BattlemapBackgroundTransform } from "@/types/domain";

interface BattlemapBackgroundEditorProps {
    imageUrl: string;
    transform: BattlemapBackgroundTransform;
    onChange: (next: BattlemapBackgroundTransform) => void;
    onConfirm: () => void;
    onCancel: () => void;
}

export function BattlemapBackgroundEditor({
    imageUrl,
    transform,
    onChange,
    onConfirm,
    onCancel,
}: BattlemapBackgroundEditorProps) {
    return (
        <div className="battlemap-bg-editor-overlay">
            <div className="battlemap-bg-editor-stage">
                <img
                    src={imageUrl}
                    alt="Cenario"
                    style={{
                        width: `${transform.width}px`,
                        height: `${transform.height}px`,
                        transform: `translate(${transform.x}px, ${transform.y}px)`,
                    }}
                />
                <div className="battlemap-bg-handles">
                    <span />
                    <span />
                    <span />
                    <span />
                </div>
            </div>
            <div className="battlemap-bg-editor-controls">
                <label>Largura <input type="range" min={200} max={2400} value={transform.width} onChange={(e) => onChange({ ...transform, width: Number(e.target.value) })} /></label>
                <label>Altura <input type="range" min={150} max={1400} value={transform.height} onChange={(e) => onChange({ ...transform, height: Number(e.target.value) })} /></label>
                <button type="button" onClick={onConfirm}>Finalizado</button>
                <button type="button" onClick={onCancel}>X</button>
            </div>
        </div>
    );
}
