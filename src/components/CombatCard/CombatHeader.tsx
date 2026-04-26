"use client";

import React from 'react';
import { ChevronLeft, ChevronRight, Dice5 } from "lucide-react";
import { Character } from "@/types/domain";

interface CombatHeaderProps {
    character: Character;
    isOwner: boolean;
    isGM: boolean;
    canEditSelf: boolean;
    canEdit: boolean;
    onToggleDiceRoller?: () => void;
    onRemove?: () => void;
    handleFPChange: (amount: number) => void;
    handleImpulseArrowsChange: (delta: number) => void;
    onToggleExpanded?: () => void;
    avatarSide?: "left" | "right";
    themeClass: string;
    showPortrait?: boolean;
    portraitInitials?: string;
}

export function CombatHeader({
    character,
    isOwner,
    isGM,
    canEditSelf,
    canEdit,
    onToggleDiceRoller,
    onRemove,
    handleFPChange,
    handleImpulseArrowsChange,
    onToggleExpanded,
    avatarSide = "left",
    themeClass,
    showPortrait = false,
    portraitInitials = "??",
}: CombatHeaderProps) {
    const impulseCount = Math.max(0, Math.trunc(character.impulseArrows || 0));
    const returnButton = onToggleExpanded ? (
        <button
            type="button"
            className={`combat-return-toggle ${themeClass} ${avatarSide === "right" ? "side-right" : "side-left"}`}
            onClick={(e) => {
                e.stopPropagation();
                onToggleExpanded();
            }}
            title={`Recolher card de ${character.name}`}
            aria-label={`Recolher card de ${character.name}`}
        >
            <span className="combat-return-icon" aria-hidden="true">
                {avatarSide === "right" ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </span>
        </button>
    ) : null;

    const portrait = showPortrait ? (
        <div className={`combat-header-portrait-frame ${themeClass}`} aria-hidden="true">
            <span className="combat-portrait-avatar combat-header-portrait">
                {character.imageUrl ? (
                    <img src={character.imageUrl} alt="" />
                ) : (
                    <span className="combat-portrait-fallback">{portraitInitials}</span>
                )}
            </span>
        </div>
    ) : null;

    return (
        <div className={`combat-header ${avatarSide === "right" ? "portrait-right" : "portrait-left"}${showPortrait ? " with-portrait" : ""}`}>
            {avatarSide !== "right" && returnButton}
            {portrait}

            <div className="combat-identity">
                <div className="combat-top-row">
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
                </div>

                {(isGM || isOwner) && (
                    <div className="combat-resource-row">
                        <div className="combat-fate">
                            <span className="fate-label">{character.isNPC ? "PONTOS DE GM" : "DESTINO"}</span>
                            <div className="fate-controls">
                                {canEditSelf && <button onClick={() => handleFPChange(-1)} className="fate-btn">-</button>}
                                <span className="fate-value">{character.fatePoints ?? 0}</span>
                                {canEditSelf && <button onClick={() => handleFPChange(1)} className="fate-btn">+</button>}
                            </div>
                        </div>

                        <div className="impulse-cluster">
                            <span className="impulse-label">IMPULSO</span>
                            <div className="impulse-arrows-row">
                                {impulseCount === 0 ? (
                                    <span className="impulse-empty">—</span>
                                ) : (
                                    Array.from({ length: impulseCount }).map((_, index) => (
                                        <span key={`${character.id}-impulse-${index}`} className="impulse-arrow">➤</span>
                                    ))
                                )}
                            </div>
                            {isGM && (
                                <div className="impulse-controls">
                                    <button
                                        onClick={() => handleImpulseArrowsChange(-1)}
                                        className="fate-btn"
                                        disabled={impulseCount === 0}
                                    >
                                        -
                                    </button>
                                    <button onClick={() => handleImpulseArrowsChange(1)} className="fate-btn">+</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {avatarSide === "right" && returnButton}

            {/* Remove Button */}
            {canEdit && onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
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
