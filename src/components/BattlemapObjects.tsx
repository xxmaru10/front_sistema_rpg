
import { BattlemapObject } from "@/types/domain";

interface BattlemapObjectsProps {
    objects: BattlemapObject[];
    onUpdateObject: (id: string, patch: Partial<BattlemapObject>) => void;
    onDeleteObject: (id: string) => void;
    isGM: boolean;
    zoom: number;
}

export function BattlemapObjects({ objects, onUpdateObject, onDeleteObject, isGM, zoom }: BattlemapObjectsProps) {
    return (
        <>
            {objects.map((obj) => (
                <div
                    key={obj.id}
                    style={{
                        position: "absolute",
                        left: obj.x,
                        top: obj.y,
                        width: obj.width,
                        height: obj.height,
                        transform: `rotate(${obj.rotation}deg)`,
                        cursor: isGM && !obj.locked ? "move" : "default",
                        pointerEvents: "auto",
                        border: "2px solid transparent",
                        transition: "border 0.2s"
                    }}
                    onMouseEnter={(e) => {
                        if (isGM) e.currentTarget.style.borderColor = "rgba(var(--accent-rgb), 0.5)";
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "transparent";
                    }}
                >
                    <img 
                        src={obj.imageUrl} 
                        alt="Map Object" 
                        style={{ width: "100%", height: "100%", display: "block", userSelect: "none" }}
                        draggable={false}
                    />
                    {isGM && !obj.locked && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onDeleteObject(obj.id); }}
                            style={{
                                position: "absolute",
                                top: -10,
                                right: -10,
                                background: "#ff4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: "50%",
                                width: "20px",
                                height: "20px",
                                cursor: "pointer",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                pointerEvents: "auto",
                                zIndex: 10
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            ))}
        </>
    );
}
