"use client";

interface CharacterVitalityProps {
    stressPhysical: boolean[];
    stressMental: boolean[];
    fatePoints: number;
    refresh: number;
    isNPC: boolean;
    isGM: boolean;
    isCompact: boolean;
    canEditStressOrFP: boolean;
    onStressToggle: (track: "PHYSICAL" | "MENTAL", index: number, current: boolean) => void;
    onAddStressBox: (track: "PHYSICAL" | "MENTAL") => void;
    onRemoveStressBox: (track: "PHYSICAL" | "MENTAL") => void;
    onFPChange: (amount: number) => void;
    onRefreshChange: (delta: number) => void;
}

export function CharacterVitality({
    stressPhysical,
    stressMental,
    fatePoints,
    refresh,
    isNPC,
    isGM,
    isCompact,
    canEditStressOrFP,
    onStressToggle,
    onAddStressBox,
    onRemoveStressBox,
    onFPChange,
    onRefreshChange,
}: CharacterVitalityProps) {
    return (
        <div className="char-core-info">
            <div className="header-stress-tracks">
                {/* Physical Track */}
                <div className="matrix-track-header">
                    <div className="track-label-row">
                        <span className="symbol">🜃</span>
                        <span>FÍSICO</span>
                    </div>
                    <div className="node-array-header">
                        {stressPhysical.map((box, i) => (
                            <button
                                key={i}
                                className={`integrity-node-header ${box ? "ruptured" : ""} ${isCompact ? "mini" : ""}`}
                                onClick={() => canEditStressOrFP && onStressToggle("PHYSICAL", i, box)}
                                disabled={!canEditStressOrFP}
                            >
                                <span className="node-index">1</span>
                                <div className="node-glow" />
                            </button>
                        ))}
                        {isGM && (
                            <div className="header-track-controls">
                                <button className="h-add-btn" onClick={() => onRemoveStressBox("PHYSICAL")}>-</button>
                                <button className="h-add-btn" onClick={() => onAddStressBox("PHYSICAL")}>+</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Mental Track */}
                <div className="matrix-track-header">
                    <div className="track-label-row">
                        <span className="symbol">🜁</span>
                        <span>MENTAL</span>
                    </div>
                    <div className="node-array-header">
                        {stressMental.map((box, i) => (
                            <button
                                key={i}
                                className={`integrity-node-header ${box ? "ruptured" : ""} ${isCompact ? "mini" : ""}`}
                                onClick={() => canEditStressOrFP && onStressToggle("MENTAL", i, box)}
                                disabled={!canEditStressOrFP}
                            >
                                <span className="node-index">1</span>
                                <div className="node-glow" />
                            </button>
                        ))}
                        {isGM && (
                            <div className="header-track-controls">
                                <button className="h-add-btn" onClick={() => onRemoveStressBox("MENTAL")}>-</button>
                                <button className="h-add-btn" onClick={() => onAddStressBox("MENTAL")}>+</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fate Reserve — hidden from players for NPCs */}
            {!(isNPC && !isGM) && (
                <div className="fate-reserve">
                    <div className="reserve-label">{isCompact ? "DESTINO" : "RESERVA DESTINO"}</div>
                    <div className="reserve-value">
                        <span className="symbol">🜂</span>
                        <span>{fatePoints}</span>
                        <span className="refresh-value">/ {refresh ?? 3}</span>

                        {isGM && !isCompact && (
                            <div className="reserve-actions">
                                <button onClick={() => onFPChange(-1)} className="reserve-btn">－</button>
                                <button onClick={() => onFPChange(1)} className="reserve-btn">＋</button>
                                <div className="refresh-controls">
                                    <button onClick={() => onRefreshChange(-1)} className="reserve-btn refresh" title="Reduzir Recarga">v</button>
                                    <button onClick={() => onRefreshChange(1)} className="reserve-btn refresh" title="Aumentar Recarga">^</button>
                                </div>
                            </div>
                        )}

                        {!isGM && !isCompact && canEditStressOrFP && (
                            <div className="reserve-actions">
                                <button onClick={() => onFPChange(-1)} className="reserve-btn">－</button>
                                <button onClick={() => onFPChange(1)} className="reserve-btn">＋</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
