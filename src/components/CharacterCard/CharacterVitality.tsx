"use client";

import { useState } from "react";

interface CharacterVitalityProps {
    stressPhysical: boolean[];
    stressMental: boolean[];
    stressValuesPhysical: number[];
    stressValuesMental: number[];
    fatePoints: number;
    refresh: number;
    isNPC: boolean;
    isGM: boolean;
    isCompact: boolean;
    canEditStressOrFP: boolean;
    onStressToggle: (track: "PHYSICAL" | "MENTAL", index: number, current: boolean) => void;
    onAddStressBox: (track: "PHYSICAL" | "MENTAL", value?: number) => void;
    onRemoveStressBox: (track: "PHYSICAL" | "MENTAL") => void;
    onUpdateStressBoxValue: (track: "PHYSICAL" | "MENTAL", boxIndex: number, value: number) => void;
    onFPChange: (amount: number) => void;
    onRefreshChange: (delta: number) => void;
}



export function CharacterVitality({
    stressPhysical,
    stressMental,
    stressValuesPhysical,
    stressValuesMental,
    fatePoints,
    refresh,
    isNPC,
    isGM,
    isCompact,
    canEditStressOrFP,
    onStressToggle,
    onAddStressBox,
    onRemoveStressBox,
    onUpdateStressBoxValue,
    onFPChange,
    onRefreshChange,
}: CharacterVitalityProps) {
    const clampStressValue = (value: number) => Math.max(1, Math.min(1000, Math.trunc(value || 1)));
    const getResolvedValue = (values: number[], index: number) => clampStressValue(values[index] ?? (index + 1));
    const [newPhysicalValue, setNewPhysicalValue] = useState("1");
    const [newMentalValue, setNewMentalValue] = useState("1");
    const [draftValues, setDraftValues] = useState<Record<string, string>>({});

    const getDraftKey = (track: "PHYSICAL" | "MENTAL", index: number) => `${track}-${index}`;
    const getDraftValue = (track: "PHYSICAL" | "MENTAL", index: number, fallback: number) => {
        const key = getDraftKey(track, index);
        return draftValues[key] ?? String(fallback);
    };

    const setDraftValue = (track: "PHYSICAL" | "MENTAL", index: number, value: string) => {
        const key = getDraftKey(track, index);
        setDraftValues(prev => ({ ...prev, [key]: value }));
    };

    const commitDraftValue = (track: "PHYSICAL" | "MENTAL", index: number, fallback: number) => {
        const key = getDraftKey(track, index);
        const raw = draftValues[key];
        const parsed = Number(raw);
        const next = Number.isFinite(parsed) ? clampStressValue(parsed) : fallback;

        onUpdateStressBoxValue(track, index, next);
        setDraftValues(prev => ({ ...prev, [key]: String(next) }));
    };

    const handleAddStress = (track: "PHYSICAL" | "MENTAL") => {
        const raw = track === "PHYSICAL" ? newPhysicalValue : newMentalValue;
        const parsed = Number(raw);
        const next = Number.isFinite(parsed) ? clampStressValue(parsed) : 1;
        onAddStressBox(track, next);
        if (track === "PHYSICAL") setNewPhysicalValue(String(next));
        if (track === "MENTAL") setNewMentalValue(String(next));
    };


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
                            <div key={i} className="integrity-node-wrap">
                                <button
                                    className={`integrity-node-header ${box ? "ruptured" : ""} ${isCompact ? "mini" : ""}`}
                                    onClick={() => canEditStressOrFP && onStressToggle("PHYSICAL", i, box)}
                                    disabled={!canEditStressOrFP}
                                >
                                    <span className="node-index">{getResolvedValue(stressValuesPhysical, i)}</span>
                                    <div className="node-glow" />
                                </button>
                                {isGM && !isCompact && (
                                    <input
                                        className="stress-value-editor"
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={getDraftValue("PHYSICAL", i, getResolvedValue(stressValuesPhysical, i))}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setDraftValue("PHYSICAL", i, e.target.value)}
                                        onBlur={() => commitDraftValue("PHYSICAL", i, getResolvedValue(stressValuesPhysical, i))}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                (e.currentTarget as HTMLInputElement).blur();
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                        {isGM && !isCompact && (
                            <div className="header-track-controls">
                                <button className="h-add-btn" onClick={() => onRemoveStressBox("PHYSICAL")}>-</button>
                                <button className="h-add-btn" onClick={() => handleAddStress("PHYSICAL")}>+</button>
                                <input
                                    className="h-value-input"
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={newPhysicalValue}
                                    onChange={(e) => setNewPhysicalValue(e.target.value)}
                                    title="Valor da próxima caixa física"
                                />
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
                            <div key={i} className="integrity-node-wrap">
                                <button
                                    className={`integrity-node-header ${box ? "ruptured" : ""} ${isCompact ? "mini" : ""}`}
                                    onClick={() => canEditStressOrFP && onStressToggle("MENTAL", i, box)}
                                    disabled={!canEditStressOrFP}
                                >
                                    <span className="node-index">{getResolvedValue(stressValuesMental, i)}</span>
                                    <div className="node-glow" />
                                </button>
                                {isGM && !isCompact && (
                                    <input
                                        className="stress-value-editor"
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={getDraftValue("MENTAL", i, getResolvedValue(stressValuesMental, i))}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => setDraftValue("MENTAL", i, e.target.value)}
                                        onBlur={() => commitDraftValue("MENTAL", i, getResolvedValue(stressValuesMental, i))}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                (e.currentTarget as HTMLInputElement).blur();
                                            }
                                        }}
                                    />
                                )}
                            </div>
                        ))}
                        {isGM && !isCompact && (
                            <div className="header-track-controls">
                                <button className="h-add-btn" onClick={() => onRemoveStressBox("MENTAL")}>-</button>
                                <button className="h-add-btn" onClick={() => handleAddStress("MENTAL")}>+</button>
                                <input
                                    className="h-value-input"
                                    type="number"
                                    min={1}
                                    max={1000}
                                    value={newMentalValue}
                                    onChange={(e) => setNewMentalValue(e.target.value)}
                                    title="Valor da próxima caixa mental"
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {!(isNPC && !isGM) && (
                <div className="vitality-resources-row single">
                    <div className="fate-reserve">
                        <div className="reserve-label">{isCompact ? "DESTINO" : "PONTOS DE DESTINO"}</div>
                        <div className="reserve-value">
                            <span className="symbol">🜂</span>
                            <span>{fatePoints}</span>
                            <span className="refresh-value">/ {refresh ?? 3}</span>

                            {canEditStressOrFP && (
                                <div className="reserve-actions">
                                    <button onClick={() => onFPChange(-1)} className="reserve-btn">－</button>
                                    <button onClick={() => onFPChange(1)} className="reserve-btn">＋</button>
                                    {isGM && !isCompact && (
                                        <div className="refresh-controls">
                                            <button onClick={() => onRefreshChange(-1)} className="reserve-btn refresh" title="Reduzir Recarga">v</button>
                                            <button onClick={() => onRefreshChange(1)} className="reserve-btn refresh" title="Aumentar Recarga">^</button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


