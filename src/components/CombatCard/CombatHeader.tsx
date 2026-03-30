"use client";

import React from 'react';
import { Dice5 } from "lucide-react";
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
    handleFPChange
}: CombatHeaderProps) {
    return (
        <div className="combat-header">
            <div className="combat-identity" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--accent-color)',
                        width: '20px',
                        height: '20px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        flexShrink: 0
                    }}
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
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(80, 166, 255, 0.1)',
                            border: '1px solid rgba(80, 166, 255, 0.5)',
                            color: '#50a6ff',
                            width: '28px',
                            height: '28px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginLeft: '8px',
                            transition: 'all 0.2s',
                            flexShrink: 0
                        }}
                        title="Abrir Zona de Rolagem"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.1)';
                            e.currentTarget.style.background = 'rgba(80, 166, 255, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.background = 'rgba(80, 166, 255, 0.1)';
                        }}
                    >
                        <Dice5 size={18} />
                    </button>
                )}
                {!isCollapsed && (isGM || isOwner) && (
                    <div className="combat-fate">
                        <span className="fate-label">{character.isNPC ? "PONTOS DE GM" : "PONTOS DE DESTINO"}</span>
                        <div className="fate-controls">
                            {canEditSelf && <button onClick={() => handleFPChange(-1)} className="fate-btn">-</button>}
                            <span className="fate-value">{character.fatePoints}</span>
                            {canEditSelf && <button onClick={() => handleFPChange(1)} className="fate-btn">+</button>}
                        </div>
                    </div>
                )}
            </div>
            {/* Remove Button */}
            {!isCollapsed && canEdit && onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Remover ${character.name} da arena?`)) {
                            onRemove();
                        }
                    }}
                    className="combat-remove-btn"
                    title="Remover personagem da arena"
                >
                    ✕
                </button>
            )}
        </div>
    );
}
