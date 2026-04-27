import { useEffect, useRef } from "react";
import { PenTool, Square, Circle, Diamond, Triangle } from "lucide-react";
import { battlemapToolStore, BattlemapShapeKind } from "@/lib/battlemapToolStore";

interface BattlemapShapesMenuProps {
    activeShape: BattlemapShapeKind;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLElement | null>;
}

const SHAPES: { kind: BattlemapShapeKind; label: string; Icon: React.ElementType }[] = [
    { kind: "FREEHAND", label: "Traço livre", Icon: PenTool },
    { kind: "RECT", label: "Retângulo", Icon: Square },
    { kind: "CIRCLE", label: "Círculo", Icon: Circle },
    { kind: "DIAMOND", label: "Losango", Icon: Diamond },
    { kind: "TRIANGLE", label: "Triângulo", Icon: Triangle },
];

export function BattlemapShapesMenu({ activeShape, onClose, anchorRef }: BattlemapShapesMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                menuRef.current && !menuRef.current.contains(e.target as Node) &&
                anchorRef.current && !anchorRef.current.contains(e.target as Node)
            ) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [onClose, anchorRef]);

    const select = (kind: BattlemapShapeKind) => {
        battlemapToolStore.setActiveShape(kind);
        battlemapToolStore.setTool("PEN");
        onClose();
    };

    return (
        <div ref={menuRef} className="bm-shapes-menu">
            {SHAPES.map(({ kind, label, Icon }) => (
                <button
                    key={kind}
                    className={`bm-shapes-item${activeShape === kind ? " active" : ""}`}
                    onClick={() => select(kind)}
                    title={label}
                >
                    <Icon size={13} />
                    <span>{label}</span>
                </button>
            ))}
        </div>
    );
}

export function ShapeIcon({ kind, size = 12 }: { kind: BattlemapShapeKind; size?: number }) {
    switch (kind) {
        case "RECT": return <Square size={size} />;
        case "CIRCLE": return <Circle size={size} />;
        case "DIAMOND": return <Diamond size={size} />;
        case "TRIANGLE": return <Triangle size={size} />;
        default: return <PenTool size={size} />;
    }
}
