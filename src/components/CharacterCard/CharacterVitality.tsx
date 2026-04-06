"use client";
import React, { useState } from "react";
import { StressBox } from "@/types/domain";

interface CharacterVitalityProps {
    stressPhysical: StressBox[];
    stressMental: StressBox[];
    fatePoints: number;
    refresh: number;
    isNPC: boolean;
    isGM: boolean;
    isCompact: boolean;
    canEditStressOrFP: boolean;
    onStressToggle: (track: "PHYSICAL" | "MENTAL", index: number, current: boolean) => void;
    onStressBoxValueChange: (track: "PHYSICAL" | "MENTAL", index: number, newValue: number) => void;
    onAddStressBox: (track: "PHYSICAL" | "MENTAL") => void;
    onRemoveStressBox: (track: "PHYSICAL" | "MENTAL") => void;
    onFPChange: (amount: number) => void;
    onRefreshChange: (delta: number) => void;
}

interface StressTrackProps {
    label: string;
    symbol: string;
    track: "PHYSICAL" | "MENTAL";
    boxes: StressBox[];
    isGM: boolean;
    isCompact: boolean;
    canEdit: boolean;
    onToggle: (index: number, current: boolean) => void;
    onValueChange: (index: number, newValue: number) => void;
    onAdd: () => void;
    onRemove: () => void;
}

function StressTrack({ label, symbol, track, boxes, isGM, isCompact, canEdit, onToggle, onValueChange, onAdd, onRemove }: StressTrackProps) {
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");

    const startEditing = (idx: number, val: number) => {
        if (!isGM) return;
        setEditValue(val.toString());
        setEditingIndex(idx);
    };

    const handleSave = (idx: number) => {
        const val = parseInt(editValue);
        if (!isNaN(val)) {
            onValueChange(idx, val);
        }
        setEditingIndex(null);
    };

    return (
        <div className="matrix-track-header">
            <div className="track-label-row">
                <span className="symbol">{symbol}</span>
                <span>{label}</span>
            </div>
            <div className="node-array-header">
                {boxes.map((box, i) => (
                    <div key={i} className="node-container-wrapper">
                        {editingIndex === i ? (
                            <input
                                autoFocus
                                className="stress-edit-input"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={() => handleSave(i)}
                                onKeyDown={e => {
                                    if (e.key === "Enter") handleSave(i);
                                    if (e.key === "Escape") setEditingIndex(null);
                                }}
                            />
                        ) : (
                            <button
                                className={`integrity-node-header ${box.checked ? "ruptured" : ""} ${isCompact ? "mini" : ""}`}
                                onClick={(e) => {
                                    // Clique no número edita (se GM), clique no resto alterna check
                                    const target = e.target as HTMLElement;
                                    if (isGM && (target.classList.contains("node-index") || target.parentElement?.classList.contains("node-index"))) {
                                        startEditing(i, box.value);
                                    } else if (canEdit) {
                                        onToggle(i, box.checked);
                                    }
                                }}
                                disabled={!canEdit && !isGM}
                            >
                                <span className="node-index" onClick={(e) => {
                                    if (isGM) {
                                        e.stopPropagation();
                                        startEditing(i, box.value);
                                    }
                                }}>
                                    {box.value}
                                </span>
                                <div className="node-glow" />
                            </button>
                        )}
                    </div>
                ))}
                {isGM && (
                    <div className="header-track-controls">
                        <button className="h-add-btn" onClick={onRemove}>-</button>
                        <button className="h-add-btn" onClick={onAdd}>+</button>
                    </div>
                )}
            </div>
            <style jsx>{`
                .node-container-wrapper {
                    position: relative;
                    display: flex;
                    align-items: center;
                }
                .stress-edit-input {
                    width: 32px;
                    height: 32px;
                    background: var(--accent-color);
                    color: black;
                    border: none;
                    text-align: center;
                    font-family: var(--font-header);
                    font-weight: bold;
                    font-size: 0.9rem;
                    outline: none;
                    box-shadow: 0 0 15px var(--accent-glow);
                }
            `}</style>
        </div>
    );
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
    onStressBoxValueChange,
    onAddStressBox,
    onRemoveStressBox,
    onFPChange,
    onRefreshChange,
}: CharacterVitalityProps) {

    return (
        <div className="char-core-info">
            <div className="header-stress-tracks">
                <StressTrack 
                    label="FÍSICO" symbol="🜃" track="PHYSICAL" 
                    boxes={stressPhysical} isGM={isGM} isCompact={isCompact} canEdit={canEditStressOrFP}
                    onToggle={(idx, curr) => onStressToggle("PHYSICAL", idx, curr)}
                    onValueChange={(idx, val) => onStressBoxValueChange("PHYSICAL", idx, val)}
                    onAdd={() => onAddStressBox("PHYSICAL")}
                    onRemove={() => onRemoveStressBox("PHYSICAL")}
                />
                
                <StressTrack 
                    label="MENTAL" symbol="🜁" track="MENTAL" 
                    boxes={stressMental} isGM={isGM} isCompact={isCompact} canEdit={canEditStressOrFP}
                    onToggle={(idx, curr) => onStressToggle("MENTAL", idx, curr)}
                    onValueChange={(idx, val) => onStressBoxValueChange("MENTAL", idx, val)}
                    onAdd={() => onAddStressBox("MENTAL")}
                    onRemove={() => onRemoveStressBox("MENTAL")}
                />
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



