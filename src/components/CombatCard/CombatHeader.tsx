"use client";

import React, { useState } from 'react';
import { Dice5, ArrowDown } from "lucide-react";
import { Character } from "@/types/domain";

interface CombatHeaderProps {
    character: Character;
    isCollapsed: boolean;
    setIsCollapsed: (v: boolean) => void;
    isOwner: boolean;
    isGM: boolean;
    canEditSelf: boolean;
    canEdit: boolean;
    onToggleDiceRoller?: () => void;
    onRemove?: () => void;
    handleFPChange: (amount: number) => void;
    onAddImpulse: () => void;
    onRemoveImpulse: () => void;
}


export function CombatHeader({
    character,
    isCollapsed,
    setIsCollapsed,
    isOwner,
    isGM,
    canEditSelf,
    canEdit,
    onToggleDiceRoller,
    onRemove,
    handleFPChange,
    onAddImpulse,
    onRemoveImpulse
}: CombatHeaderProps) {
    const [pendingRemove, setPendingRemove] = useState(false);

    const handleRemoveClick = () => {
        if (pendingRemove) {
            onRemove?.();
            setPendingRemove(false);
        } else {
            setPendingRemove(true);
            setTimeout(() => setPendingRemove(false), 3000);
        }
    };

    return (
        <div className="combat-header">
            <div className="combat-header-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="header-collapse-btn"
                        title={isCollapsed ? "Expandir" : "Recolher"}
                    >
                        {isCollapsed ? "+" : "−"}
                    </button>
                    <h3 className="combat-name">{character.name.toUpperCase()}</h3>
                    {onToggleDiceRoller && isOwner && !isGM && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleDiceRoller();
                            }}
                            className="header-dice-btn"
                            title="Abrir Zona de Rolagem"
                        >
                            <Dice5 size={16} />
                        </button>
                    )}
                </div>

                {!isCollapsed && canEdit && onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveClick();
                        }}
                        className="combat-remove-btn"
                        title={pendingRemove ? "Clique novamente para confirmar" : "Remover personagem da arena"}
                    >
                        {pendingRemove ? "✓" : "✕"}
                    </button>
                )}
            </div>

            {!isCollapsed && (isGM || isOwner) && (
                <div className="combat-header-bottom">
                    <div className="combat-fate">
                        <span className="fate-label">{character.isNPC ? "GM" : "PD"}</span>
                        <div className="fate-controls">
                            {canEditSelf && <button onClick={() => handleFPChange(-1)} className="fate-btn">-</button>}
                            <span className="fate-value">{character.fatePoints}</span>
                            {canEditSelf && <button onClick={() => handleFPChange(1)} className="fate-btn">+</button>}
                        </div>
                    </div>

                    <div className="combat-impulses">
                        <span className="impulse-label">IMPULSO</span>
                        <div className="impulse-controls">
                            <div className="impulse-display">
                                {Array.from({ length: character.impulses || 0 }).map((_, i) => (
                                    <span
                                        key={i}
                                        className="impulse-arrow"
                                        onClick={onRemoveImpulse}
                                        title="Remover impulso"
                                        style={{ cursor: 'pointer' }}
                                    >▼</span>
                                ))}
                                {(character.impulses || 0) === 0 && <span className="impulse-empty">—</span>}
                            </div>
                            {isGM && (
                                <button onClick={onAddImpulse} className="impulse-add-btn" title="Adicionar impulso">
                                    <ArrowDown size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <style jsx>{`
                .combat-header {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                }
                .combat-header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                }
                .combat-header-bottom {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    padding-bottom: 4px;
                }
                .header-collapse-btn {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: var(--accent-color);
                    width: 20px;
                    height: 20px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.8rem;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .header-dice-btn {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(80, 166, 255, 0.1);
                    border: 1px solid rgba(80, 166, 255, 0.4);
                    color: #50a6ff;
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .combat-impulses {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .impulse-label {
                    font-size: 0.5rem;
                    color: rgba(255,255,255,0.3);
                    letter-spacing: 0.1em;
                }
                .impulse-controls {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .impulse-add-btn {
                    background: none;
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #666;
                    width: 18px;
                    height: 18px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    flex-shrink: 0;
                }
                .impulse-add-btn:hover {
                    color: var(--accent-color);
                    border-color: var(--accent-color);
                }
                .impulse-display {
                    display: flex;
                    gap: 2px;
                }
                .impulse-arrow {
                    color: #fff;
                    font-size: 0.9rem;
                    text-shadow: 0 0 10px #fff, 0 0 20px var(--accent-color);
                    animation: pulseGlow 2s infinite;
                }
                .impulse-empty {
                    color: rgba(255,255,255,0.1);
                    font-size: 0.7rem;
                }
                @keyframes pulseGlow {
                    0% { opacity: 0.7; transform: scale(1); }
                    50% { opacity: 1; transform: scale(1.1); }
                    100% { opacity: 0.7; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}
