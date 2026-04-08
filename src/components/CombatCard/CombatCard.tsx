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

function getCombatCardThemeClass(character: Character, isOwner: boolean) {
    const isNpcHero = character.isNPC && character.arenaSide === "HERO";
    const isThreat = character.arenaSide === "THREAT" || (character.isNPC && character.arenaSide !== "HERO");

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
    const cardThemeClass = getCombatCardThemeClass(character, isOwner);
    const portraitInitials = getPortraitInitials(character.name);

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

    return (
        <div
            className={`combat-card animate-reveal expanded-card ${cardThemeClass} ${isCurrentTurn ? 'active-turn' : ''}`}
        >
            <CombatHeader
                character={character}
                isOwner={isOwner}
                isGM={isGM}
                canEditSelf={canEditSelf}
                canEdit={canEdit}
                onToggleDiceRoller={onToggleDiceRoller}
                onRemove={onRemove}
                handleFPChange={handleFPChange}
                handleImpulseArrowsChange={handleImpulseArrowsChange}
                onToggleExpanded={onToggleExpanded}
                avatarSide={avatarSide}
                themeClass={cardThemeClass}
            />

            <CombatAspects character={character} />

            <CombatStressTracks
                character={character}
                canEditSelf={canEditSelf}
                handleStressToggle={handleStressToggle}
            />

            <CombatConsequences
                character={character}
                isGM={isGM}
                openConsequenceModal={openConsequenceModal}
            />

            <CombatExtras
                character={character}
                isGM={isGM}
                isOwner={isOwner}
            />

            {/* Modal */}
            {consequenceModal && (
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
