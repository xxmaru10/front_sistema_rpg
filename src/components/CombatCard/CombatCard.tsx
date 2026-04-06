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
}

export function CombatCard({ 
    character, 
    sessionId, 
    actorUserId, 
    isGM = false, 
    onRemove, 
    isCurrentTurn = false, 
    isLinkedCharacter = false, 
    onToggleDiceRoller 
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
        handleAddImpulse,
        handleRemoveImpulse,
    } = useCombatCard({ character, sessionId, actorUserId, isGM });


    const isNpcHero = character.isNPC && character.arenaSide === 'HERO';
    const isThreat = character.arenaSide === 'THREAT' || (character.isNPC && character.arenaSide !== 'HERO');
    const isHazard = character.isHazard;

    const cardThemeClass = isHazard ? 'hazard-card' : isThreat ? 'threat-card' : isOwner ? 'own-hero-card' : 'hero-card';

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
            />
        );
    }

    return (
        <div
            className={`combat-card animate-reveal ${cardThemeClass} ${isCurrentTurn ? 'active-turn' : ''} ${isCollapsed ? 'collapsed' : ''} ${(!isGM && !isOwner && isCollapsed) ? 'dimmed' : ''}`}
        >
            <CombatHeader 
                character={character}
                isCollapsed={isCollapsed}
                setIsCollapsed={setIsCollapsed}
                isOwner={isOwner}
                isGM={isGM}
                canEditSelf={canEditSelf}
                canEdit={canEdit}
                onToggleDiceRoller={onToggleDiceRoller}
                onRemove={onRemove}
                handleFPChange={handleFPChange}
                onAddImpulse={handleAddImpulse}
                onRemoveImpulse={handleRemoveImpulse}
            />

            {!isCollapsed && (
                <>
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
                </>
            )}

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
