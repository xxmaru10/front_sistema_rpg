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
import { ChevronLeft, ChevronRight, Star, Sparkles, Briefcase, Target, Dices } from "lucide-react";
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
    const [expandedExtra, setExpandedExtra] = useState<'stunts' | 'spells' | 'items' | 'skills' | null>(null);

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

    const activeSkills = Object.entries(character.skills || {}).filter(([_, v]) => v > 0);

    const accentColors: Record<string, string> = {
        "own-hero-card": "rgba(197, 160, 89, 0.8)",
        "hero-card": "rgba(100, 200, 255, 0.8)",
        "threat-card": "rgba(255, 68, 68, 0.8)",
        "npc-hero-card": "rgba(200, 200, 200, 0.8)",
    };
    const accentColor = accentColors[cardThemeClass] || "rgba(255, 255, 255, 0.2)";

    return (
        <div 
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '8px', 
                marginBottom: '12px',
                '--card-accent': accentColor 
            } as any}
        >
            {!isRestrictedThreatView && (
                <div className="combat-external-stress" style={{ marginLeft: '140px', marginBottom: '-10px', zIndex: 10 }}>
                    <CombatStressTracks
                        character={character}
                        canEditSelf={canEditSelf}
                        handleStressToggle={handleStressToggle}
                    />
                </div>
            )}

            <div
                className={`combat-card animate-reveal expanded-card ${cardThemeClass} ${isCurrentTurn ? 'active-turn' : ''}${isRestrictedThreatView ? ' restricted-threat-card' : ''}`}
                style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '140px 2fr 1.5fr', 
                    gap: '0', 
                    alignItems: 'stretch', 
                    padding: '0', 
                    minWidth: '550px',
                    borderRadius: '0 50px 0 0',
                    position: 'relative',
                    border: 'none',
                    background: `linear-gradient(110deg, #000 0%, #000 35%, ${accentColor.replace('0.8', '0.3')} 100%)`,
                    overflow: 'visible',
                    boxShadow: '30px 0 60px rgba(0,0,0,0.9), inset 5px 0 15px rgba(255,255,255,0.05)',
                    transform: 'skewX(-6deg)',
                    marginLeft: '10px'
                }}
            >
                {/* De-skew content container */}
                <div style={{ display: 'contents', transform: 'skewX(6deg)' }}>
                {/* Dice Roller Trigger */}
                {onToggleDiceRoller && isOwner && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleDiceRoller();
                        }}
                        style={{
                            position: 'absolute',
                            top: '12px',
                            right: '20px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.3)',
                            borderRadius: '4px',
                            color: '#fff',
                            padding: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s',
                            zIndex: 30,
                            transform: 'skewX(6deg)'
                        }}
                        className="combat-dice-trigger"
                        title="Abrir dados"
                    >
                        <Dices size={20} />
                    </button>
                )}

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
                {/* COLUNA 1: Imagem, Destino, Impulso Overlaid */}
                <div style={{ position: 'relative', width: '140px', height: '100%', minHeight: '180px', transform: 'skewX(6deg)', marginLeft: '-10px', overflow: 'hidden' }}>
                    <div style={{ width: '100%', height: '100%', background: '#000' }}>
                        {character.imageUrl ? (
                            <img src={character.imageUrl} alt="" style={{ width: '120%', height: '100%', objectFit: 'cover', opacity: 0.9, marginLeft: '-10%' }} />
                        ) : (
                            <span className="combat-portrait-fallback" style={{ fontSize: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#111' }}>{portraitInitials}</span>
                        )}
                    </div>
                    
                    {/* Persona slash effect overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.05) 45%, transparent 50%)', pointerEvents: 'none' }} />

                    {(isGM || isOwner) && !isRestrictedThreatView && (
                        <div style={{ position: 'absolute', bottom: '12px', left: '0', right: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '0 10px', zIndex: 5 }}>
                            <div className="combat-fate" style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.8)', borderRadius: '4px', padding: '4px 10px', gap: '12px', border: '1px solid var(--card-accent)' }}>
                                {canEditSelf && <button onClick={(e) => { e.stopPropagation(); handleFPChange(-1); }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px' }}>-</button>}
                                <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#fff', textShadow: '0 0 15px var(--card-accent)' }}>{character.fatePoints}</span>
                                {canEditSelf && <button onClick={(e) => { e.stopPropagation(); handleFPChange(1); }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer', padding: '0 4px' }}>+</button>}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '3px' }}>
                                    {impulseCount > 0 && Array.from({ length: impulseCount }).map((_, index) => <span key={`imp-${index}`} style={{ color: '#fff', fontSize: '0.7rem', filter: 'drop-shadow(0 0 5px var(--card-accent))' }}>➤</span>)}
                                </div>
                                {isGM && (
                                    <div style={{ display: 'flex', gap: '12px', opacity: 0.7 }}>
                                        <button onClick={(e) => { e.stopPropagation(); handleImpulseArrowsChange(-1); }} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }} disabled={impulseCount===0}>-</button>
                                        <button onClick={(e) => { e.stopPropagation(); handleImpulseArrowsChange(1); }} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>+</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* COLUNA 2: Nome, Conceito, Dificuldade, Expansíveis */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0, padding: '24px 20px', transform: 'skewX(6deg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <h3 className="combat-name" style={{ fontSize: '1.8rem', margin: 0, fontWeight: '900', letterSpacing: '-0.02em', textShadow: '4px 4px 0px rgba(0,0,0,0.5), 0 0 20px var(--card-accent)' }}>{character.name.toUpperCase()}</h3>
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
                            {/* LINHA DE ÍCONES EXPANSÍVEIS */}
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                {character.stunts && character.stunts.length > 0 && (
                                    <button 
                                        onClick={() => setExpandedExtra(expandedExtra === 'stunts' ? null : 'stunts')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', opacity: expandedExtra === 'stunts' ? 1 : 0.6 }}
                                        title="Façanhas"
                                    >
                                        <Star size={16} />
                                    </button>
                                )}
                                {character.spells && character.spells.length > 0 && (
                                    <button 
                                        onClick={() => setExpandedExtra(expandedExtra === 'spells' ? null : 'spells')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', opacity: expandedExtra === 'spells' ? 1 : 0.6 }}
                                        title="Magias"
                                    >
                                        <Sparkles size={16} />
                                    </button>
                                )}
                                {activeSkills.length > 0 && (
                                    <button 
                                        onClick={() => setExpandedExtra(expandedExtra === 'skills' ? null : 'skills')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', opacity: expandedExtra === 'skills' ? 1 : 0.6 }}
                                        title="Perícias"
                                    >
                                        <Target size={16} />
                                    </button>
                                )}
                                {mainInventoryItems.length > 0 && (
                                    <button 
                                        onClick={() => setExpandedExtra(expandedExtra === 'items' ? null : 'items')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', cursor: 'pointer', transition: 'all 0.2s', opacity: expandedExtra === 'items' ? 1 : 0.6 }}
                                        title="Itens"
                                    >
                                        <Briefcase size={16} />
                                    </button>
                                )}
                            </div>

                            {/* ZONA DE EXPANSÃO */}
                            {expandedExtra === 'stunts' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', padding: '8px', background: 'rgba(80, 166, 255, 0.05)', borderRadius: '4px', border: '1px solid rgba(80, 166, 255, 0.15)' }}>
                                    {character.stunts.map(stunt => (
                                        <div key={stunt.id} style={{ padding: '4px 6px', fontSize: '0.7rem', color: '#ccc', borderLeft: '2px solid rgba(80, 166, 255, 0.4)' }} title={stunt.description}>
                                            <span style={{ color: '#8bc8ff', fontWeight: 'bold' }}>{stunt.name}</span> <span style={{ color: '#888' }}>[{stunt.cost}]</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {expandedExtra === 'spells' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', padding: '8px', background: 'rgba(168, 85, 247, 0.05)', borderRadius: '4px', border: '1px solid rgba(168, 85, 247, 0.15)' }}>
                                    {character.spells.map(spell => (
                                        <div key={spell.id} style={{ padding: '4px 6px', fontSize: '0.7rem', color: '#ccc', borderLeft: '2px solid rgba(168, 85, 247, 0.4)' }} title={spell.description}>
                                            <span style={{ color: '#d7b6ff', fontWeight: 'bold' }}>{spell.name}</span> <span style={{ color: '#888' }}>[{spell.cost}]</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {expandedExtra === 'skills' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px', padding: '8px', background: 'rgba(230, 90, 90, 0.05)', borderRadius: '4px', border: '1px solid rgba(230, 90, 90, 0.15)' }}>
                                    {activeSkills.map(([skill, rank]) => (
                                        <div key={skill} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 6px', fontSize: '0.7rem', color: '#ccc', borderLeft: '2px solid rgba(230, 90, 90, 0.4)' }}>
                                            <span>{skill}</span> <span style={{ color: '#ffaaaa', fontWeight: 'bold' }}>+{rank}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {expandedExtra === 'items' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', padding: '8px', background: 'rgba(46, 204, 113, 0.05)', borderRadius: '4px', border: '1px solid rgba(46, 204, 113, 0.15)' }}>
                                    {mainInventoryItems.map(item => (
                                        <div key={item.id} style={{ padding: '4px 6px', fontSize: '0.7rem', color: '#ccc', borderLeft: '2px solid rgba(46, 204, 113, 0.4)' }} title={item.description}>
                                            <span style={{ color: '#7cfc00', fontWeight: 'bold' }}>{item.name}</span> {item.bonus > 0 && <span style={{ color: '#ffd700' }}>(+{item.bonus})</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* COLUNA 3: Consequencias */}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, paddingLeft: '12px', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingTop: '24px', paddingRight: '24px', transform: 'skewX(6deg)' }}>
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
                </div> {/* End De-skew */}
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
