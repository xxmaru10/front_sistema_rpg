"use client";

import { Character } from "@/types/domain";
import { LinkedNotes } from "@/features/session-notes/components/LinkedNotes";
import { InventorySection } from "./InventorySection";
import { SkillsSection } from "./SkillsSection";
import { useCharacterCard } from "./useCharacterCard";
import { ImageCropper } from "@/components/ImageCropper/ImageCropper";
import { CharacterPortrait } from "./CharacterPortrait";
import { CharacterLore } from "./CharacterLore";
import { CharacterVitality } from "./CharacterVitality";
import { CharacterConsequences } from "./CharacterConsequences";
import { PowerTabsSection } from "./PowerTabsSection";

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
            className={`char-artifact tarot-card ${
                character.isNPC ? "threat-arcano" : "operative-arcano"
            } ${isCompact ? "compact" : ""}`}
        >

            <div className="tarot-inner">
                <div className="top-layout-grid">
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
                        isImageProcessing={hook.isImageProcessing}
                    />

                    <CharacterLore
                        biography={character.biography || ""}
                        sheetAspects={character.sheetAspects}
                        religionName={mentionEntities?.find(e => e.id === character.religionId)?.name}
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
                </div>

                <CharacterVitality
                    stressPhysical={character.stress.physical}
                    stressMental={character.stress.mental}
                    stressValuesPhysical={character.stressValues?.physical || []}
                    stressValuesMental={character.stressValues?.mental || []}
                    fatePoints={character.fatePoints}
                    refresh={character.refresh ?? 3}
                    isNPC={!!character.isNPC}
                    isGM={isGM}
                    isCompact={isCompact}
                    canEditStressOrFP={canEditStressOrFP}
                    onStressToggle={hook.handleStressToggle}
                    onAddStressBox={hook.handleAddStressBox}
                    onRemoveStressBox={hook.handleRemoveStressBox}
                    onUpdateStressBoxValue={hook.handleUpdateStressBoxValue}
                    onFPChange={hook.handleFPChange}
                    onRefreshChange={hook.handleRefreshChange}
                />


                <div className="lower-content-grid">
                    <div className="lower-col-left">
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

                        <PowerTabsSection
                            character={character}
                            sessionId={sessionId}
                            actorUserId={actorUserId}
                            canEdit={canEdit}
                            isGM={isGM}
                            magicLevel={character.magicLevel || 0}
                            onMagicLevelChange={hook.handleMagicLevelChange}
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

                {hook.isCropping && hook.tempCropSrc && (
                    <ImageCropper
                        src={hook.tempCropSrc}
                        aspectRatio={1}
                        outputWidth={600}
                        outputHeight={600}
                        onConfirm={hook.handleCropConfirm}
                        onCancel={hook.handleCropCancel}
                    />
                )}

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
        </div>
    );
}
