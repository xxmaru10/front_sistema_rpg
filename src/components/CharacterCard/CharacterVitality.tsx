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
                                <button className="h-add-btn" onClick={() => onRemoveStressBox("PHYSICAL")} title="Remover última caixa física">-</button>
                                <button className="h-add-btn" onClick={() => handleAddStress("PHYSICAL")} title="Adicionar caixa física">+</button>
                                <div className="stress-next-value-group">
                                    <span className="stress-next-value-label">NOVA</span>
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
                                <button className="h-add-btn" onClick={() => onRemoveStressBox("MENTAL")} title="Remover última caixa mental">-</button>
                                <button className="h-add-btn" onClick={() => handleAddStress("MENTAL")} title="Adicionar caixa mental">+</button>
                                <div className="stress-next-value-group">
                                    <span className="stress-next-value-label">NOVA</span>
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

            <style jsx>{`
                .char-core-info .integrity-node-wrap {
                    gap: 6px;
                }

                .char-core-info .stress-value-editor,
                .char-core-info .h-value-input {
                    appearance: textfield;
                    -moz-appearance: textfield;
                }

                .char-core-info .stress-value-editor::-webkit-outer-spin-button,
                .char-core-info .stress-value-editor::-webkit-inner-spin-button,
                .char-core-info .h-value-input::-webkit-outer-spin-button,
                .char-core-info .h-value-input::-webkit-inner-spin-button {
                    -webkit-appearance: none;
                    margin: 0;
                }

                .char-core-info .stress-value-editor {
                    width: 44px;
                    height: 20px;
                    border: 1px solid rgba(var(--accent-rgb), 0.4);
                    border-radius: 4px;
                    background: linear-gradient(180deg, rgba(30, 30, 30, 0.95), rgba(12, 12, 12, 0.95));
                    color: #f8eac2;
                    font-family: var(--font-header);
                    font-size: 0.68rem;
                    text-align: center;
                    box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.6);
                    outline: none;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    padding: 0 2px;
                }

                .char-core-info .stress-value-editor:focus {
                    border-color: var(--accent-color);
                    box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.25), inset 0 0 8px rgba(0, 0, 0, 0.65);
                }

                .char-core-info .header-track-controls {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-left: 14px;
                    padding: 4px 8px;
                    border-radius: 999px;
                    border: 1px solid rgba(var(--accent-rgb), 0.22);
                    background: rgba(0, 0, 0, 0.4);
                }

                .char-core-info .header-track-controls .h-add-btn {
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    border: 1px solid rgba(var(--accent-rgb), 0.45);
                    background: radial-gradient(circle at 30% 30%, rgba(var(--accent-rgb), 0.2), rgba(0, 0, 0, 0.55));
                    color: var(--accent-color);
                    font-size: 1rem;
                    line-height: 1;
                    cursor: pointer;
                    transition: transform 0.15s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                }

                .char-core-info .header-track-controls .h-add-btn:hover {
                    transform: translateY(-1px);
                    border-color: var(--accent-color);
                    box-shadow: 0 0 10px rgba(var(--accent-rgb), 0.25);
                    background: radial-gradient(circle at 35% 30%, rgba(var(--accent-rgb), 0.35), rgba(0, 0, 0, 0.45));
                }

                .char-core-info .stress-next-value-group {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    border-left: 1px solid rgba(var(--accent-rgb), 0.2);
                    padding-left: 8px;
                }

                .char-core-info .stress-next-value-label {
                    font-family: var(--font-header);
                    font-size: 0.52rem;
                    letter-spacing: 0.14em;
                    color: rgba(var(--accent-rgb), 0.75);
                }

                .char-core-info .h-value-input {
                    width: 62px;
                    height: 26px;
                    border: 1px solid rgba(var(--accent-rgb), 0.42);
                    border-radius: 5px;
                    background: linear-gradient(180deg, rgba(28, 28, 28, 0.95), rgba(10, 10, 10, 0.95));
                    color: #fff2cc;
                    font-family: var(--font-header);
                    font-size: 0.74rem;
                    text-align: center;
                    outline: none;
                    box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.55);
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    padding: 0 4px;
                }

                .char-core-info .h-value-input:focus {
                    border-color: var(--accent-color);
                    box-shadow: 0 0 12px rgba(var(--accent-rgb), 0.3), inset 0 0 8px rgba(0, 0, 0, 0.7);
                }

                @media (max-width: 980px) {
                    .char-core-info .header-track-controls {
                        margin-left: 0;
                    }
                }
            `}</style>
        </div>
    );
}


