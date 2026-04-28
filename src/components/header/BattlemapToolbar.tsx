import { Map, Move, PenTool, Search, Eraser, Grid, Trash2, X, Image as ImageIcon, Monitor, Palette, LineChart } from "lucide-react";
import { globalEventStore } from "@/lib/eventStore";
import { battlemapToolStore, Tool } from "@/lib/battlemapToolStore";
import { v4 as uuidv4 } from "uuid";

interface BattlemapToolbarProps {
    sessionId: string;
    userId: string;
    userRole: "GM" | "PLAYER";
    showToolbar: boolean;
    activeTool: Tool;
    penColor: string;
    isTheaterMode?: boolean;
    isSceneMode?: boolean;
}

export function BattlemapToolbar({
    sessionId,
    userId,
    userRole,
    showToolbar,
    activeTool,
    penColor,
    isTheaterMode = false,
    isSceneMode = false,
}: BattlemapToolbarProps) {
    const isTheaterSurface = isSceneMode || battlemapToolStore.activeSurfaceTab === "theater";

    if (isTheaterSurface) {
        return (
            <div className="battlemap-toolbar-container battlemap-toolbar-container--scene">
                <div className="battlemap-tools-strip">
                    {(["CAMADAS", "PERSONAGEM", "OBJETO", "CENARIO", "TEXTO"] as const).map((tool) => {
                        const isPassive = tool === "PERSONAGEM" || tool === "OBJETO" || tool === "TEXTO";
                        return (
                            <button
                                key={tool}
                                className={`tool-icon-btn theater-tool-btn ${battlemapToolStore.theaterTool === tool ? "active" : ""}`}
                                disabled={isPassive}
                                onClick={() => {
                                    battlemapToolStore.setTheaterTool(tool);
                                    if (tool === "CAMADAS") {
                                        battlemapToolStore.setTheaterLayersOpen(!battlemapToolStore.theaterLayersOpen);
                                    }
                                    if (tool === "CENARIO") {
                                        battlemapToolStore.openLibrary();
                                    }
                                }}
                                title={isPassive ? `${tool} (em breve)` : tool}
                            >
                                {tool}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div className="battlemap-toolbar-container">
            <button
                className={`player-toggle unified-sound-toggle ${showToolbar ? "playing" : ""}`}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    battlemapToolStore.toggleToolbar();
                }}
                title="Ferramentas do Battlemap"
                style={{
                    borderColor: showToolbar ? "var(--accent-color, #C5A059)" : undefined,
                }}
            >
                <Map size={16} />
            </button>

            {showToolbar && (
                <div className="battlemap-tools-strip">
                    <div className="tool-divider" />
                    <button
                        className={`tool-icon-btn ${activeTool === "MOVE" ? "active" : ""}`}
                        onClick={() => battlemapToolStore.setTool("MOVE")}
                        title="Ferramenta: Mover"
                    >
                        <Move size={14} />
                    </button>
                    <button
                        className={`tool-icon-btn ${activeTool === "PEN" ? "active" : ""}`}
                        onClick={() => battlemapToolStore.setTool("PEN")}
                        title="Ferramenta: Caneta"
                    >
                        <PenTool size={14} />
                    </button>
                    <button
                        className={`tool-icon-btn ${activeTool === "ZOOM" ? "active" : ""}`}
                        onClick={() => battlemapToolStore.setTool("ZOOM")}
                        title="Ferramenta: Zoom"
                    >
                        <Search size={14} />
                    </button>
                    <button
                        className={`tool-icon-btn ${activeTool === "ERASER" ? "active" : ""}`}
                        onClick={() => battlemapToolStore.setTool("ERASER")}
                        title="Ferramenta: Borracha"
                    >
                        <Eraser size={14} />
                    </button>

                    {activeTool === "PEN" && (
                        <input
                            type="color"
                            value={penColor}
                            onChange={(e) => battlemapToolStore.setPenColor(e.target.value)}
                            style={{
                                width: "20px",
                                height: "20px",
                                padding: 0,
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                            }}
                        />
                    )}

                    <div className="tool-divider" />
                    {!isTheaterSurface && (
                        <button
                            className={`tool-icon-btn ${isTheaterMode ? "active" : ""}`}
                            onClick={() => battlemapToolStore.toggleTheaterMode()}
                            title="Modo Cena (Ocultar Interface)"
                            style={{
                                color: isTheaterMode ? "var(--accent-color)" : undefined
                            }}
                        >
                            <Monitor size={14} />
                        </button>
                    )}

                    {userRole === "GM" && (
                        <>
                            <div className="tool-divider" />
                            <button
                                className="tool-icon-btn"
                                onClick={() => battlemapToolStore.openLibrary()}
                                title="Mudar Imagem de Fundo"
                            >
                                <ImageIcon size={14} />
                            </button>
                            <button
                                className="tool-icon-btn"
                                onClick={() => {
                                    const size = prompt("Tamanho da grade (px):", "50");
                                    if (size)
                                        globalEventStore.append({
                                            id: uuidv4(),
                                            sessionId,
                                            seq: 0,
                                            type: "BATTLEMAP_UPDATED",
                                            actorUserId: userId,
                                            createdAt: new Date().toISOString(),
                                            visibility: "PUBLIC",
                                            payload: { gridSize: parseInt(size) },
                                        } as any);
                                }}
                                title="Configurar Grade"
                            >
                                <Grid size={14} />
                            </button>
                            <button
                                className="tool-icon-btn"
                                onClick={() => {
                                    const color = prompt("Cor da grade (HEX ou RGBA):", "rgba(255,255,255,0.1)");
                                    if (color)
                                        globalEventStore.append({
                                            id: uuidv4(),
                                            sessionId,
                                            seq: 0,
                                            type: "BATTLEMAP_UPDATED",
                                            actorUserId: userId,
                                            createdAt: new Date().toISOString(),
                                            visibility: "PUBLIC",
                                            payload: { gridColor: color },
                                        } as any);
                                }}
                                title="Cor da Grade"
                            >
                                <Palette size={14} />
                            </button>
                            <button
                                className="tool-icon-btn"
                                onClick={() => {
                                    const thick = prompt("Espessura da grade (px):", "1");
                                    if (thick)
                                        globalEventStore.append({
                                            id: uuidv4(),
                                            sessionId,
                                            seq: 0,
                                            type: "BATTLEMAP_UPDATED",
                                            actorUserId: userId,
                                            createdAt: new Date().toISOString(),
                                            visibility: "PUBLIC",
                                            payload: { gridThickness: parseInt(thick) },
                                        } as any);
                                }}
                                title="Espessura da Grade"
                            >
                                <LineChart size={14} />
                            </button>
                            <button
                                className="tool-icon-btn"
                                onClick={() => {
                                    if (confirm("Limpar desenhos?"))
                                        globalEventStore.append({
                                            id: uuidv4(),
                                            sessionId,
                                            seq: 0,
                                            type: "BATTLEMAP_UPDATED",
                                            actorUserId: userId,
                                            createdAt: new Date().toISOString(),
                                            visibility: "PUBLIC",
                                            payload: { strokes: [] },
                                        } as any);
                                }}
                                title="Limpar Mapa"
                            >
                                <Trash2 size={14} color="#ff6b6b" />
                            </button>
                            <button
                                className="tool-icon-btn"
                                onClick={() => {
                                    globalEventStore.append({
                                        id: uuidv4(),
                                        sessionId,
                                        seq: 0,
                                        type: "BATTLEMAP_UPDATED",
                                        actorUserId: userId,
                                        createdAt: new Date().toISOString(),
                                        visibility: "PUBLIC",
                                        payload: { isActive: false },
                                    } as any);
                                }}
                                title="Desativar Battlemap"
                            >
                                <X size={14} color="#ff4444" />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
