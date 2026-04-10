"use client";

import React from 'react';
import { Character } from "@/types/domain";
import { ConsequenceModal } from "@/components/ConsequenceModal";
import { useCombatCard } from "@/components/hooks/useCombatCard";
import { HazardCard } from "@/components/HazardCard";
import { CombatStressTracks } from "@/components/CombatStressTracks";
import { CombatConsequences } from "@/components/CombatConsequences";
import { CombatExtras } from "@/components/CombatExtras";

// Sub-components
import { useState } from 'react';
import { CombatHeader } from "./CombatHeader";
import { CombatAspects } from "./CombatAspects";
import { CombatCardStyles } from "./CombatCard.styles";

interface CombatCardProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    isGM?: boolean;
    onRemove?: () => void;
    isCurrentTurn?: boolean;
    isLinkedCharacter?: boolean;
    onToggleDiceRoller?: () => void;
    displayMode?: "expanded" | "compact";
    onToggleExpanded?: () => void;
    avatarSide?: "left" | "right";
}

function getPortraitInitials(name: string) {
    const parts = name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) return "??";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function isThreatCombatant(character: Character) {
    return character.arenaSide === "THREAT" || (character.isNPC && character.arenaSide !== "HERO");
}

function getCombatCardThemeClass(character: Character, isOwner: boolean) {
    const isNpcHero = character.isNPC && character.arenaSide === "HERO";
    const isThreat = isThreatCombatant(character);

    if (character.isHazard) return "hazard-card";
    if (isThreat) return "threat-card";
    if (isNpcHero) return "npc-hero-card";
    if (isOwner) return "own-hero-card";
    return "hero-card";
}

export function CombatCard({
    character,
    sessionId,
    actorUserId,
    isGM = false,
    onRemove,
    isCurrentTurn = false,
    isLinkedCharacter = false,
    onToggleDiceRoller,
    displayMode = "expanded",
    onToggleExpanded,
    avatarSide = "left",
}: CombatCardProps) {
    const isOwner = (actorUserId && character.ownerUserId && actorUserId.trim().toLowerCase() === character.ownerUserId.trim().toLowerCase()) || isLinkedCharacter;
    const canEditSelf = isGM || isOwner;
    const canEdit = isGM;

    const {
        isCollapsed,
        setIsCollapsed,
        consequenceModal,
        setConsequenceModal,
        handleStressToggle,
        handleFPChange,
        openConsequenceModal,
        handleSaveConsequence,
        handleUpdateHazard,
        handleImpulseArrowsChange,
    } = useCombatCard({ character, sessionId, actorUserId, isGM });

    const isHazard = character.isHazard;
    const isThreat = isThreatCombatant(character);
    const isRestrictedThreatView = isThreat && !isGM && !isOwner;
    const cardThemeClass = getCombatCardThemeClass(character, isOwner);
    const portraitInitials = getPortraitInitials(character.name);

    const [isAspectsExpanded, setIsAspectsExpanded] = useState(false);
    const [expandedExtra, setExpandedExtra] = useState<'stunts' | 'spells' | 'items' | null>(null);

    if (isHazard) {
        return (
            <HazardCard
                character={character}
                isGM={isGM}
                isOwner={isOwner}
                canEditSelf={canEditSelf}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                onRemove={onRemove}
                handleUpdateHazard={handleUpdateHazard}
                handleImpulseArrowsChange={handleImpulseArrowsChange}
            />
        );
    }

    if (displayMode === "compact") {
        return (
            <>
                <button
                    type="button"
                    className={`combat-avatar-shell ${cardThemeClass} ${avatarSide === "right" ? "side-right" : "side-left"} ${isCurrentTurn ? "active-turn-avatar" : ""}`}
                    onClick={onToggleExpanded}
                    title={`Abrir card de ${character.name}`}
                    aria-label={`Abrir card de ${character.name}`}
                >
                    <span className="combat-avatar-halo" aria-hidden="true"></span>
                    <span className="combat-portrait-avatar">
                        {character.imageUrl ? (
                            <img src={character.imageUrl} alt="" />
                        ) : (
                            <span className="combat-portrait-fallback">{portraitInitials}</span>
                        )}
                    </span>
                </button>

                <CombatCardStyles isGM={isGM} />
            </>
        );
    }

    const validAspects = (character.sheetAspects || []).map((a, i) => ({ value: a, isTrouble: i === 3 })).filter(a => a.value && a.value.trim().length > 0);
    const conceptAspect = validAspects.length > 0 ? validAspects[0] : null;
    const otherAspects = validAspects.slice(1);

    const impulseCount = Math.max(0, Math.trunc(character.impulseArrows || 0));

    // Inventory main slots
    const mainInventoryItems = (character.inventory || []).filter(item => !item.isContainer && !character.inventory.some(c => c.contents?.includes(item)));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {!isRestrictedThreatView && (
                <div className="combat-external-stress">
                    <CombatStressTracks
                        character={character}
                        canEditSelf={canEditSelf}
                        handleStressToggle={handleStressToggle}
                    />
                </div>
            )}

            <div
                className={`combat-card animate-reveal expanded-card ${cardThemeClass} ${isCurrentTurn ? 'active-turn' : ''}${isRestrictedThreatView ? ' restricted-threat-card' : ''}`}
                style={{ display: 'grid', gridTemplateColumns: 'minmax(80px, 110px) 2fr 1fr', gap: '16px', alignItems: 'start', padding: '16px' }}
            >
                {/* Remove Button for GM */}
                {canEdit && onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        className="combat-remove-btn"
                        title="Remover personagem da arena"
                    >✕</button>
                )}

                {/* COLUNA 1: Imagem, Destino, Impulso */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                    <div className={`combat-header-portrait-frame ${cardThemeClass}`} style={{ width: '80px', height: '80px', margin: '0 auto', borderRadius: '16px', overflow: 'hidden' }} aria-hidden="true">
                        <span className="combat-portrait-avatar combat-header-portrait" style={{ width: '100%', height: '100%', display: 'block' }}>
                            {character.imageUrl ? (
                                <img src={character.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span className="combat-portrait-fallback" style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>{portraitInitials}</span>
                            )}
                        </span>
                    </div>

                    {(isGM || isOwner) && !isRestrictedThreatView && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <div className="combat-fate" style={{ flexDirection: 'column', padding: '4px 8px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', gap: '4px' }}>
                                <span className="fate-label" style={{ fontSize: '0.5rem' }}>{character.isNPC ? "PONTOS DE GM" : "DESTINO"}</span>
                                <div className="fate-controls" style={{ gap: '8px' }}>
                                    {canEditSelf && <button onClick={() => handleFPChange(-1)} className="fate-btn">-</button>}
                                    <span className="fate-value" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{character.fatePoints}</span>
                                    {canEditSelf && <button onClick={() => handleFPChange(1)} className="fate-btn">+</button>}
                                </div>
                            </div>
                            <div className="impulse-cluster" style={{ flexDirection: 'column', padding: '4px 8px', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', gap: '4px' }}>
                                <span className="impulse-label" style={{ fontSize: '0.5rem' }}>IMPULSO</span>
                                <div className="impulse-arrows-row" style={{ minHeight: '16px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>
                                    {impulseCount === 0 ? <span className="impulse-empty">—</span> : Array.from({ length: impulseCount }).map((_, index) => <span key={`imp-${index}`} className="impulse-arrow">➤</span>)}
                                </div>
                                {isGM && (
                                    <div className="impulse-controls">
                                        <button onClick={() => handleImpulseArrowsChange(-1)} className="fate-btn" disabled={impulseCount===0}>-</button>
                                        <button onClick={() => handleImpulseArrowsChange(1)} className="fate-btn">+</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUNA 2: Nome, Conceito, Dificuldade, Expansíveis */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 className="combat-name" style={{ fontSize: '1.2rem', margin: 0 }}>{character.name.toUpperCase()}</h3>
                        {character.difficulty !== undefined && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '4px', color: '#d7b6ff' }}>
                                DIF {character.difficulty}
                            </span>
                        )}
                    </div>

                    {!isRestrictedThreatView && conceptAspect && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <span style={{ flex: 1, fontSize: '0.8rem', color: '#ccc', fontStyle: 'italic' }}>{conceptAspect.value}</span>
                                {otherAspects.length > 0 && (
                                    <button 
                                        onClick={() => setIsAspectsExpanded(!isAspectsExpanded)}
                                        style={{ background: 'transparent', border: 'none', color: '#c5a059', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', lineHeight: 1 }}
                                    >
                                        {isAspectsExpanded ? '-' : '+'}
                                    </button>
                                )}
                            </div>
                            {isAspectsExpanded && otherAspects.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                    {otherAspects.map((asp, idx) => (
                                        <div key={idx} style={{ fontSize: '0.75rem', color: asp.isTrouble ? '#ffaaaa' : '#aaa' }}>
                                            • {asp.value}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {!isRestrictedThreatView && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                            {/* Stunts Button */}
                            {character.stunts && character.stunts.length > 0 && (
                                <div>
                                    <button 
                                        onClick={() => setExpandedExtra(expandedExtra === 'stunts' ? null : 'stunts')}
                                        style={{ width: '100%', textAlign: 'left', padding: '6px 8px', background: 'rgba(80, 166, 255, 0.1)', border: '1px solid rgba(80, 166, 255, 0.3)', borderRadius: '4px', color: '#8bc8ff', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}
                                    >
                                        <span>FAÇANHAS ({character.stunts.length})</span>
                                        <span>{expandedExtra === 'stunts' ? '▼' : '▶'}</span>
                                    </button>
                                    {expandedExtra === 'stunts' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                            {character.stunts.map(stunt => (
                                                <div key={stunt.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '4px 6px', fontSize: '0.7rem', color: '#ccc', borderLeft: '2px solid rgba(80, 166, 255, 0.4)' }} title={stunt.description}>
                                                    <span style={{ color: '#8bc8ff', fontWeight: 'bold' }}>{stunt.name}</span> <span style={{ color: '#888' }}>[{stunt.cost}]</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Spells Button */}
                            {character.spells && character.spells.length > 0 && (
                                <div>
                                    <button 
                                        onClick={() => setExpandedExtra(expandedExtra === 'spells' ? null : 'spells')}
                                        style={{ width: '100%', textAlign: 'left', padding: '6px 8px', background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '4px', color: '#d7b6ff', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}
                                    >
                                        <span>MAGIAS ({character.spells.length})</span>
                                        <span>{expandedExtra === 'spells' ? '▼' : '▶'}</span>
                                    </button>
                                    {expandedExtra === 'spells' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                            {character.spells.map(spell => (
                                                <div key={spell.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '4px 6px', fontSize: '0.7rem', color: '#ccc', borderLeft: '2px solid rgba(168, 85, 247, 0.4)' }} title={spell.description}>
                                                    <span style={{ color: '#d7b6ff', fontWeight: 'bold' }}>{spell.name}</span> <span style={{ color: '#888' }}>[{spell.cost}]</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Items Button */}
                            {mainInventoryItems.length > 0 && (
                                <div>
                                    <button 
                                        onClick={() => setExpandedExtra(expandedExtra === 'items' ? null : 'items')}
                                        style={{ width: '100%', textAlign: 'left', padding: '6px 8px', background: 'rgba(46, 204, 113, 0.1)', border: '1px solid rgba(46, 204, 113, 0.3)', borderRadius: '4px', color: '#7cfc00', fontSize: '0.75rem', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between' }}
                                    >
                                        <span>ITENS EQUIPADOS ({mainInventoryItems.length})</span>
                                        <span>{expandedExtra === 'items' ? '▼' : '▶'}</span>
                                    </button>
                                    {expandedExtra === 'items' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                                            {mainInventoryItems.map(item => (
                                                <div key={item.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '4px 6px', fontSize: '0.7rem', color: '#ccc', borderLeft: '2px solid rgba(46, 204, 113, 0.4)' }} title={item.description}>
                                                    <span style={{ color: '#7cfc00', fontWeight: 'bold' }}>{item.name}</span> {item.bonus > 0 && <span style={{ color: '#ffd700' }}>(+{item.bonus})</span>}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* COLUNA 3: Consequencias */}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingLeft: '8px', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                    {!isRestrictedThreatView && (
                        <div style={{ borderTop: 'none', paddingTop: 0 }}>
                            <CombatConsequences
                                character={character}
                                isGM={isGM}
                                openConsequenceModal={openConsequenceModal}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {!isRestrictedThreatView && consequenceModal && (
                <ConsequenceModal
                    isOpen={!!consequenceModal}
                    initialText={consequenceModal.current}
                    initialDebuffSkill={consequenceModal.debuffSkill}
                    initialDebuffValue={consequenceModal.debuffValue}
                    onSave={handleSaveConsequence}
                    onCancel={() => setConsequenceModal(null)}
                />
            )}

            <CombatCardStyles isGM={isGM} />
        </div>
    );
}
