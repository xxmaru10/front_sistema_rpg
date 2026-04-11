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
import { useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown, Star, Sparkles, Briefcase, Target, Dices, Trash2 } from "lucide-react";
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
    displayMode?: "expanded" | "compact" | "strip";
    onToggleExpanded?: () => void;
    isPinned?: boolean;
    avatarSide?: "left" | "right";
    stripRank?: number;
    stripWidthPercent?: number;
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
    isPinned = false,
    avatarSide = "left",
    stripRank = 0,
    stripWidthPercent = 100,
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
    const accentColors: Record<string, string> = {
        "own-hero-card": "rgba(var(--accent-rgb), 0.86)",
        "hero-card": "rgba(var(--accent-rgb), 0.82)",
        "threat-card": "rgba(255, 68, 68, 0.82)",
        "npc-hero-card": "rgba(var(--accent-rgb), 0.76)",
    };
    const accentSoftColors: Record<string, string> = {
        "own-hero-card": "rgba(var(--accent-rgb), 0.46)",
        "hero-card": "rgba(var(--accent-rgb), 0.42)",
        "threat-card": "rgba(255, 68, 68, 0.42)",
        "npc-hero-card": "rgba(var(--accent-rgb), 0.36)",
    };
    const accentColor = accentColors[cardThemeClass] || "rgba(var(--accent-rgb), 0.72)";
    const accentSoftColor = accentSoftColors[cardThemeClass] || "rgba(var(--accent-rgb), 0.32)";
    const arenaFocusX = Math.max(0, Math.min(100, character.arenaPortraitFocus?.x ?? 50));
    const arenaFocusY = Math.max(0, Math.min(100, character.arenaPortraitFocus?.y ?? 30));
    const arenaFocusZoom = Math.max(1, Math.min(3, character.arenaPortraitFocus?.zoom ?? 1));

    const [isAspectsExpanded, setIsAspectsExpanded] = useState(false);
    const [expandedExtra, setExpandedExtra] = useState<'stunts' | 'spells' | 'items' | 'skills' | null>(null);
    const middleContentRef = useRef<HTMLDivElement | null>(null);
    const consequencesContentRef = useRef<HTMLDivElement | null>(null);
    const [dynamicCardHeight, setDynamicCardHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        const middleEl = middleContentRef.current;
        const consequencesEl = consequencesContentRef.current;
        if (!middleEl || !consequencesEl) {
            setDynamicCardHeight(null);
            return;
        }

        const recalc = () => {
            const middleHeight = Math.ceil(middleEl.scrollHeight || middleEl.offsetHeight || 0);
            const consequencesHeight = Math.ceil(consequencesEl.scrollHeight || consequencesEl.offsetHeight || 0);
            const consequencesWithMargin = Math.ceil(consequencesHeight * 1.02);
            const nextHeight = Math.max(middleHeight, consequencesWithMargin);
            const normalizedNextHeight = nextHeight > 0 ? nextHeight : null;
            setDynamicCardHeight((prevHeight) => {
                if (prevHeight === null && normalizedNextHeight === null) return prevHeight;
                if (prevHeight !== null && normalizedNextHeight !== null && Math.abs(prevHeight - normalizedNextHeight) <= 1) {
                    return prevHeight;
                }
                return normalizedNextHeight;
            });
        };

        recalc();

        const observer = new ResizeObserver(() => recalc());
        observer.observe(middleEl);
        observer.observe(consequencesEl);

        return () => observer.disconnect();
    }, [isAspectsExpanded, expandedExtra, character.consequences, character.stress, isRestrictedThreatView]);

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

    if (displayMode === "strip") {
        const stripStage = Math.min(5, Math.max(0, stripRank));
        return (
            <>
                <button
                    type="button"
                    className={`combat-strip-shell strip-stage-${stripStage} ${cardThemeClass} ${avatarSide === "right" ? "side-right" : "side-left"} ${isCurrentTurn ? "active-turn-avatar" : ""}`}
                    onClick={onToggleExpanded}
                    title={`Expandir card de ${character.name}`}
                    aria-label={`Expandir card de ${character.name}`}
                    data-strip-rank={stripStage}
                    style={{
                        '--card-accent': accentColor,
                        '--card-accent-soft': accentSoftColor,
                        '--strip-width': `${Math.max(16, Math.min(100, stripWidthPercent))}%`
                    } as any}
                >
                    <span className="combat-strip-image">
                        {character.imageUrl ? (
                            <img
                                src={character.imageUrl}
                                alt=""
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    objectPosition: `${arenaFocusX}% ${arenaFocusY}%`,
                                    opacity: 0.9,
                                    transform: `scale(${arenaFocusZoom})`,
                                    transformOrigin: `${arenaFocusX}% ${arenaFocusY}%`
                                }}
                            />
                        ) : (
                            <span className="combat-portrait-fallback">{portraitInitials}</span>
                        )}
                        <span className="combat-strip-vignette top" aria-hidden="true"></span>
                        <span className="combat-strip-vignette bottom" aria-hidden="true"></span>
                        <span className="combat-strip-vignette side" aria-hidden="true"></span>
                        <span className="combat-strip-vignette slash" aria-hidden="true"></span>
                    </span>
                    <span className="combat-strip-name">{character.name.toUpperCase()}</span>
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

    const isMirroredThreatLayout = isThreat;
    const isCompactThreatLayout = isThreat && isGM;
    const imageColumnWidth = isCompactThreatLayout ? "clamp(176px, 20vw, 236px)" : "clamp(224px, 28vw, 322px)";
    const cardGridTemplate = isMirroredThreatLayout
        ? (isCompactThreatLayout
            ? `minmax(126px, 0.86fr) minmax(0, 1.28fr) ${imageColumnWidth}`
            : `minmax(146px, 1fr) minmax(0, 1.55fr) ${imageColumnWidth}`)
        : (isCompactThreatLayout
            ? `${imageColumnWidth} minmax(0, 1.28fr) minmax(126px, 0.86fr)`
            : `${imageColumnWidth} minmax(0, 1.55fr) minmax(146px, 1fr)`);
    const outerSkew = isCompactThreatLayout
        ? (isMirroredThreatLayout ? 'skewX(3deg)' : 'skewX(-3deg)')
        : (isMirroredThreatLayout ? 'skewX(5deg)' : 'skewX(-5deg)');
    const innerSkew = isCompactThreatLayout
        ? (isMirroredThreatLayout ? 'skewX(-4deg)' : 'skewX(4deg)')
        : (isMirroredThreatLayout ? 'skewX(-6deg)' : 'skewX(6deg)');
    const imageSkew = isCompactThreatLayout
        ? (isMirroredThreatLayout ? 'skewX(-3deg)' : 'skewX(3deg)')
        : (isMirroredThreatLayout ? 'skewX(-5deg)' : 'skewX(5deg)');
    const imageNegativeOffset = isCompactThreatLayout ? '-14px' : '-24px';

    return (
        <div 
            className="combat-card-wrapper"
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1px', 
                marginBottom: '10px',
                position: 'relative',
                width: 'min(100%, 1375px)',
                '--card-accent': accentColor,
                '--card-accent-soft': accentSoftColor
            } as any}
        >
            {!isRestrictedThreatView && (
                <div className="combat-external-stress" style={{ marginBottom: '0px', zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: '1 1 220px' }}>
                        <h3 className="combat-name" style={{ fontSize: '1.05rem', margin: 0, fontWeight: '900', letterSpacing: '0.05em', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{character.name.toUpperCase()}</h3>
                        {character.difficulty !== undefined && (
                            <span style={{ fontSize: '0.7rem', padding: '2px 4px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '4px', color: '#d7b6ff', alignSelf: 'center' }}>
                                DIF {character.difficulty}
                            </span>
                        )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginLeft: 'auto', flex: '0 1 auto', flexWrap: 'wrap' }}>
                        <CombatStressTracks
                            character={character}
                            canEditSelf={canEditSelf}
                            handleStressToggle={handleStressToggle}
                        />
                        {/* Dice Roller Trigger - Right of Stress */}
                        {onToggleDiceRoller && isOwner && !isGM && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleDiceRoller();
                                }}
                                style={{
                                    background: 'rgba(255, 255, 255, 0.1)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '4px',
                                    color: '#fff',
                                    padding: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transition: 'all 0.2s',
                                }}
                                className="combat-dice-trigger-outer"
                                title="Abrir dados"
                            >
                                <Dices size={16} />
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div
                className={`combat-card animate-reveal expanded-card ${cardThemeClass} ${isCurrentTurn ? 'active-turn' : ''}${isRestrictedThreatView ? ' restricted-threat-card' : ''}`}
                style={{ 
                    display: 'grid', 
                    gridTemplateColumns: cardGridTemplate,
                    gap: '0', 
                    alignItems: 'stretch', 
                    padding: '0', 
                    height: 'auto',
                    minHeight: dynamicCardHeight ? `${dynamicCardHeight}px` : 'fit-content',
                    borderRadius: isMirroredThreatLayout ? '50px 0 0 0' : '0 50px 0 0',
                    position: 'relative',
                    border: 'none',
                    background: isMirroredThreatLayout
                        ? `linear-gradient(250deg, #000 0%, #000 38%, var(--card-accent-soft) 82%, transparent 100%)`
                        : `linear-gradient(110deg, #000 0%, #000 38%, var(--card-accent-soft) 82%, transparent 100%)`,
                    overflow: 'visible',
                    boxShadow: 'none',
                    transform: outerSkew,
                    marginLeft: '0px'
                }}
            >
                {/* De-skew content container */}
                <div style={{ display: 'contents', transform: innerSkew }}>
                {/* Remove Button for GM */}
                {canEdit && onRemove && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onRemove();
                        }}
                        style={isThreat
                            ? { position: 'absolute', top: '4px', left: '4px', color: '#ff8b8b', background: 'rgba(90, 8, 8, 0.72)', border: '1px solid rgba(255, 68, 68, 0.65)', borderRadius: '7px', cursor: 'pointer', zIndex: 40, width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
                            : { position: 'absolute', top: '4px', right: '4px', color: 'rgba(255,255,255,0.2)', background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 40 }
                        }
                        className={`combat-remove-btn${isThreat ? ' threat-remove-btn' : ''}`}
                        title="Remover personagem da arena"
                    >
                        {isThreat ? <Trash2 size={14} /> : 'X'}
                    </button>
                )}
                {onToggleExpanded && (
                    <>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpanded();
                            }}
                            style={{
                                position: 'absolute',
                                top: '4px',
                                ...(isMirroredThreatLayout
                                    ? { left: canEdit && onRemove ? '34px' : '4px' }
                                    : { right: canEdit && onRemove ? '34px' : '4px' }),
                                color: 'rgba(255,255,255,0.55)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                zIndex: 40,
                                fontSize: '1rem',
                                lineHeight: 1,
                                width: '27px',
                                height: '27px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            className="combat-pin-btn"
                            title={isPinned ? "Soltar card" : "Fixar card"}
                        >
                            {isPinned ? <ChevronDown size={18} /> : <ChevronLeft size={18} />}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleExpanded();
                            }}
                            style={{
                                position: 'absolute',
                                top: '4px',
                                ...(isMirroredThreatLayout
                                    ? { left: canEdit && onRemove ? '62px' : '32px' }
                                    : { right: canEdit && onRemove ? '62px' : '32px' }),
                                color: 'rgba(255,255,255,0.78)',
                                background: 'rgba(0,0,0,0.38)',
                                border: '1px solid rgba(255,255,255,0.28)',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                zIndex: 41,
                                fontSize: '1rem',
                                lineHeight: 1,
                                width: '24px',
                                height: '24px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            className="combat-pin-btn combat-mobile-minimize-btn"
                            title="Minimizar card"
                            aria-label="Minimizar card"
                        >
                            -
                        </button>
                    </>
                )}
                {/* COLUNA 1: Imagem, Destino, Impulso Overlaid */}
                <div
                    className={`combat-image-column${isMirroredThreatLayout ? ' mirrored' : ''}`}
                    style={{
                    gridColumn: isMirroredThreatLayout ? 3 : 1,
                    position: 'relative',
                    width: imageColumnWidth,
                    minWidth: imageColumnWidth,
                    minHeight: dynamicCardHeight ? `${Math.max(126, dynamicCardHeight)}px` : '154px',
                    height: dynamicCardHeight ? `${Math.max(126, dynamicCardHeight)}px` : '154px',
                    transform: imageSkew,
                    marginLeft: isMirroredThreatLayout ? 0 : imageNegativeOffset,
                    marginRight: isMirroredThreatLayout ? imageNegativeOffset : 0,
                    overflow: 'visible',
                    alignSelf: 'stretch',
                    zIndex: 6
                }}
                >
                    <div
                        className={`combat-image-frame${isMirroredThreatLayout ? ' mirrored' : ''}`}
                        style={{ position: 'absolute', inset: 0, background: '#000', overflow: 'hidden', zIndex: 2 }}
                    >
                        {character.imageUrl ? (
                            <img
                                src={character.imageUrl}
                                alt=""
                                className={`combat-image-portrait${isMirroredThreatLayout ? ' mirrored' : ''}`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    objectPosition: `${arenaFocusX}% ${arenaFocusY}%`,
                                    opacity: 0.9,
                                    transform: `skewX(3deg) scale(${arenaFocusZoom})`,
                                    transformOrigin: `${arenaFocusX}% ${arenaFocusY}%`
                                }}
                            />
                        ) : (
                            <span className="combat-portrait-fallback" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#111' }}>{portraitInitials}</span>
                        )}
                    </div>
                    
                    {/* Persona vignettes and slash effects */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 25%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 25%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', inset: 0, background: isMirroredThreatLayout ? 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, transparent 15%)' : 'linear-gradient(to left, rgba(0,0,0,0.6) 0%, transparent 15%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.05) 45%, transparent 50%)', pointerEvents: 'none' }} />

                    {(isGM || isOwner) && !isRestrictedThreatView && (
                        <>
                            {/* Impulse - Overlay */}
                            <div style={{
                                position: 'absolute',
                                top: '8px',
                                ...(isMirroredThreatLayout ? { right: 'calc(10px + 50%)' } : { left: 'calc(10px + 10%)' }),
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                zIndex: 65,
                                pointerEvents: 'auto'
                            }}>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                    {impulseCount > 0 && Array.from({ length: impulseCount }).map((_, index) => (
                                        <span key={`imp-${index}`} className="impulse-arrow-inline" style={{ color: '#fff', textShadow: '0 0 8px var(--card-accent)' }}>➤</span>
                                    ))}
                                </div>
                                {isGM && (
                                    <div style={{ display: 'flex', gap: '4px', opacity: 1, marginTop: '2px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.28)', borderRadius: '999px', padding: '1px 4px', width: 'fit-content' }}>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); handleImpulseArrowsChange(-1); }} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.24)', color: '#fff', fontSize: '0.82rem', lineHeight: 1, cursor: 'pointer', pointerEvents: 'auto', borderRadius: '6px', width: '18px', height: '16px', padding: 0 }} disabled={impulseCount===0}>-</button>
                                        <button type="button" onClick={(e) => { e.stopPropagation(); handleImpulseArrowsChange(1); }} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.24)', color: '#fff', fontSize: '0.82rem', lineHeight: 1, cursor: 'pointer', pointerEvents: 'auto', borderRadius: '6px', width: '18px', height: '16px', padding: 0 }}>+</button>
                                    </div>
                                )}
                            </div>

                            {/* Fate Points - Bottom Over Image */}
                            <div style={{
                                position: 'absolute',
                                bottom: '8px',
                                ...(isMirroredThreatLayout ? { left: '10px' } : { right: '10px' }),
                                display: 'flex',
                                justifyContent: isMirroredThreatLayout ? 'flex-start' : 'flex-end',
                                zIndex: 35
                            }}>
                                <div className="combat-fate" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fff', border: 'none', background: 'transparent', padding: 0 }}>
                                    {canEditSelf && <button onClick={(e) => { e.stopPropagation(); handleFPChange(-1); }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', opacity: 0.6, padding: 0 }}>-</button>}
                                    <span style={{ fontSize: '1.2rem', fontWeight: '900', textShadow: '0 0 10px rgba(255,255,255,0.5)' }}>{character.fatePoints}</span>
                                    {canEditSelf && <button onClick={(e) => { e.stopPropagation(); handleFPChange(1); }} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '0.8rem', cursor: 'pointer', opacity: 0.6, padding: 0 }}>+</button>}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div
                    className={`combat-main-column${isMirroredThreatLayout ? ' mirrored' : ''}`}
                    style={{ gridColumn: 2, display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, padding: '4px 12px', transform: isMirroredThreatLayout ? 'skewX(-5deg)' : 'skewX(5deg)', overflow: 'hidden', justifyContent: 'flex-start', position: 'relative', zIndex: 4 }}
                >
                    <div ref={middleContentRef} style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    {isRestrictedThreatView && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <h3 className="combat-name" style={{ fontSize: '1rem', margin: 0, fontWeight: '900', letterSpacing: '0.05em', textShadow: '2px 2px 4px rgba(0,0,0,0.5)', whiteSpace: 'normal', wordBreak: 'break-word' }}>{character.name.toUpperCase()}</h3>
                            {character.difficulty !== undefined && (
                                <span style={{ fontSize: '0.7rem', padding: '2px 4px', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '4px', color: '#d7b6ff' }}>
                                    DIF {character.difficulty}
                                </span>
                            )}
                        </div>
                    )}

                    {!isRestrictedThreatView && conceptAspect && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <span style={{ flex: 1, fontSize: '0.8rem', color: '#ccc', fontStyle: 'italic', whiteSpace: 'normal', wordBreak: 'break-word' }}>{conceptAspect.value}</span>
                                {otherAspects.length > 0 && (
                                    <button 
                                        onClick={() => setIsAspectsExpanded(!isAspectsExpanded)}
                                        style={{ background: 'transparent', border: 'none', color: 'var(--card-accent)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 4px', lineHeight: 1 }}
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
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
                </div>

                {/* COLUNA 3: Consequencias */}
                <div
                    className={`combat-cons-column${isMirroredThreatLayout ? ' mirrored' : ''}`}
                    style={{
                    gridColumn: isMirroredThreatLayout ? 1 : 3,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    paddingLeft: isMirroredThreatLayout ? '8px' : '8px',
                    borderLeft: isMirroredThreatLayout ? 'none' : '1px solid rgba(255,255,255,0.1)',
                    borderRight: isMirroredThreatLayout ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                    paddingRight: '8px',
                    transform: isMirroredThreatLayout ? 'skewX(-5deg)' : 'skewX(5deg)',
                    justifyContent: 'flex-start',
                    position: 'relative',
                    zIndex: 5
                }}
                >
                    {!isRestrictedThreatView && (
                        <div ref={consequencesContentRef} style={{ borderTop: 'none', paddingTop: 0 }}>
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
