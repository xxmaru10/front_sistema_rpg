"use client";

import { Character } from "@/types/domain";
import { LinkedNotes } from "@/components/SessionNotesTabs/LinkedNotes";
import "./CharacterCard.css";
import { InventorySection } from "@/components/CharacterCard/InventorySection";
import { StuntsSpellsSection } from "@/components/CharacterCard/StuntsSpellsSection";
import { SkillsSection } from "@/components/CharacterCard/SkillsSection";
import { useCharacterCard } from "@/components/CharacterCard/useCharacterCard";
import { CharacterPortrait } from "@/components/CharacterCard/CharacterPortrait";
import { CharacterLore } from "@/components/CharacterCard/CharacterLore";
import { CharacterVitality } from "@/components/CharacterCard/CharacterVitality";
import { CharacterConsequences } from "@/components/CharacterCard/CharacterConsequences";

interface CharacterCardProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    isGM?: boolean;
    isCompact?: boolean;
    isLinkedCharacter?: boolean;
    mentionEntities?: any[];
    hideInventory?: boolean;
}

export function CharacterCard({
    character,
    sessionId,
    actorUserId,
    isGM = false,
    isCompact = false,
    isLinkedCharacter = false,
    mentionEntities = [],
    hideInventory = false,
}: CharacterCardProps) {
    const isOwner =
        (actorUserId &&
            character.ownerUserId &&
            actorUserId.trim().toLowerCase() === character.ownerUserId.trim().toLowerCase()) ||
        isLinkedCharacter;
    const canEdit = isGM || isOwner;
    const canEditStressOrFP = isGM || isOwner;

    const hook = useCharacterCard({
        character,
        sessionId,
        actorUserId,
        isGM,
        isOwner: !!isOwner,
        canEdit,
        canEditStressOrFP,
    });

    return (
        <div
            className={`char-artifact tarot-card animate-reveal ${
                character.isNPC ? "threat-arcano" : "operative-arcano"
            } ${isCompact ? "compact" : ""}`}
        >
            <div className="tarot-inner">
                <div className="top-layout-grid">
                    {/* [CLAUDE_CUT_START:Portrait] */}
                    <CharacterPortrait
                        name={character.name}
                        imageUrl={character.imageUrl}
                        isGM={isGM}
                        isCompact={isCompact}
                        isEditingName={hook.isEditingName}
                        tempName={hook.tempName}
                        onTempNameChange={hook.setTempName}
                        onStartEditingName={hook.startEditingName}
                        onSaveName={hook.handleSaveName}
                        onCancelEditName={() => hook.setIsEditingName(false)}
                        onImageUpload={hook.handleImageUpload}
                    />
                    {/* [CLAUDE_CUT_END:Portrait] */}

                    {/* [CLAUDE_CUT_START:Lore] */}
                    <CharacterLore
                        biography={character.biography || ""}
                        sheetAspects={character.sheetAspects}
                        canEdit={canEdit}
                        showLore={hook.showLore}
                        onToggleLore={() => hook.setShowLore(!hook.showLore)}
                        isEditingBio={hook.isEditingBio}
                        tempBio={hook.tempBio}
                        onTempBioChange={hook.setTempBio}
                        onStartEditingBio={hook.startEditingBio}
                        onSaveBio={hook.handleSaveBio}
                        onCancelBio={() => hook.setIsEditingBio(false)}
                        editingAspectIndex={hook.editingAspectIndex}
                        tempAspect={hook.tempAspect}
                        onTempAspectChange={hook.setTempAspect}
                        onStartEditingAspect={hook.startEditingAspect}
                        onSaveAspect={hook.handleSaveAspect}
                        onCancelAspect={() => hook.setEditingAspectIndex(null)}
                    />
                    {/* [CLAUDE_CUT_END:Lore] */}
                </div>

                {/* [CLAUDE_CUT_START:Vitality] */}
                <CharacterVitality
                    stressPhysical={character.stress.physical}
                    stressMental={character.stress.mental}
                    fatePoints={character.fatePoints}
                    refresh={character.refresh ?? 3}
                    isNPC={!!character.isNPC}
                    isGM={isGM}
                    isCompact={isCompact}
                    canEditStressOrFP={canEditStressOrFP}
                    onStressToggle={hook.handleStressToggle}
                    onAddStressBox={hook.handleAddStressBox}
                    onRemoveStressBox={hook.handleRemoveStressBox}
                    onFPChange={hook.handleFPChange}
                    onRefreshChange={hook.handleRefreshChange}
                />
                {/* [CLAUDE_CUT_END:Vitality] */}

                {!hideInventory && (
                    <InventorySection
                        character={character}
                        sessionId={sessionId}
                        actorUserId={actorUserId}
                        canEdit={canEdit}
                        isGM={isGM}
                    />
                )}

                <div className="lower-content-grid">
                    <div className="lower-col-left">
                        {/* [CLAUDE_CUT_START:Consequences] */}
                        <CharacterConsequences
                            character={character}
                            isGM={isGM}
                            consequenceModal={hook.consequenceModal}
                            showAddConsequenceModal={hook.showAddConsequenceModal}
                            onConsequenceClick={(slot) => hook.handleConsequenceChange(slot as any, null)}
                            onSaveConsequence={hook.handleSaveConsequence}
                            onCancelConsequenceModal={() => hook.setConsequenceModal(null)}
                            onDeleteConsequence={hook.handleDeleteConsequence}
                            onAddConsequence={hook.handleAddConsequence}
                            onOpenAddModal={() => hook.setShowAddConsequenceModal(true)}
                            onCloseAddModal={() => hook.setShowAddConsequenceModal(false)}
                        />
                        {/* [CLAUDE_CUT_END:Consequences] */}

                        <StuntsSpellsSection
                            character={character}
                            sessionId={sessionId}
                            actorUserId={actorUserId}
                            canEdit={canEdit}
                        />
                        <SkillsSection
                            character={character}
                            sessionId={sessionId}
                            actorUserId={actorUserId}
                            canEdit={canEdit}
                        />
                    </div>

                    <div style={{ padding: "0 25px 25px 25px", width: "100%" }}>
                        <LinkedNotes
                            notes={character.linkedNotes || []}
                            onAddNote={hook.handleAddNote}
                            onDeleteNote={hook.handleDeleteNote}
                            mentionEntities={mentionEntities}
                            hideTitle={false}
                            userId={actorUserId}
                            userRole={isGM ? "GM" : "PLAYER"}
                        />
                    </div>
                </div>

                {/* GM Delete Control */}
                {isGM && (
                    <div className="gm-delete-control">
                        <button
                            onClick={hook.handleDeleteCharacter}
                            title="DELETAR FICHA (Requer Confirmação)"
                            className="gm-delete-btn"
                        >
                            🗑
                        </button>
                    </div>
                )}
            </div>

            <style jsx>{`
                .gm-delete-control {
                    position: absolute;
                    top: 140px;
                    right: 12px;
                    z-index: 100;
                }

                .gm-delete-btn {
                    background: rgba(0, 0, 0, 0.6);
                    border: 1px solid #f44;
                    color: #f44;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    opacity: 0.6;
                    font-size: 1rem;
                    border-radius: 4px;
                    transition: all 0.2s;
                }

                .gm-delete-btn:hover {
                    opacity: 1;
                    background: rgba(100, 0, 0, 0.2);
                }
            `}</style>
        </div>
    );
}
