"use client";

import { useState } from "react";
import { Character } from "@/types/domain";
import { LinkedNotes } from "@/features/session-notes/components/LinkedNotes";
import { InventorySection } from "./InventorySection";
import { SkillsSection } from "./SkillsSection";
import { useCharacterCard } from "./useCharacterCard";
import { ImageCropper } from "@/components/ImageCropper/ImageCropper";
import { CharacterPortrait } from "./CharacterPortrait";
import { CharacterLore } from "./CharacterLore";
import { PowerTabsSection } from "./PowerTabsSection";
import { CharacterSummarySection } from "./CharacterSummarySection";

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

type CharacterCardTab = "lore" | "powers" | "inventory" | "notes";

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
    const [activeTab, setActiveTab] = useState<CharacterCardTab>("lore");

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

    const showInventoryTab = !hideInventory;

    return (
        <div
            className={`char-artifact tarot-card ${
                character.isNPC ? "threat-arcano" : "operative-arcano"
            } ${isCompact ? "compact" : ""}`}
        >
            <div className="tarot-inner">
                <CharacterSummarySection
                    character={character}
                    isGM={isGM}
                    isCompact={isCompact}
                    canEditStressOrFP={canEditStressOrFP}
                    isEditingName={hook.isEditingName}
                    tempName={hook.tempName}
                    onTempNameChange={hook.setTempName}
                    onStartEditingName={hook.startEditingName}
                    onSaveName={hook.handleSaveName}
                    onCancelEditName={() => hook.setIsEditingName(false)}
                    onStressToggle={hook.handleStressToggle}
                    onAddStressBox={hook.handleAddStressBox}
                    onRemoveStressBox={hook.handleRemoveStressBox}
                    onUpdateStressBoxValue={hook.handleUpdateStressBoxValue}
                    onFPChange={hook.handleFPChange}
                    onRefreshChange={hook.handleRefreshChange}
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

                <div className="character-main-tabs-shell">
                    <div className="character-main-tabs-header">
                        <button
                            className={`character-main-tab-btn ${activeTab === "lore" ? "active" : ""}`}
                            onClick={() => setActiveTab("lore")}
                            type="button"
                        >
                            LORE
                        </button>
                        <button
                            className={`character-main-tab-btn ${activeTab === "powers" ? "active" : ""}`}
                            onClick={() => setActiveTab("powers")}
                            type="button"
                        >
                            FAÇANHAS & MAGIA
                        </button>
                        {showInventoryTab && (
                            <button
                                className={`character-main-tab-btn ${activeTab === "inventory" ? "active" : ""}`}
                                onClick={() => setActiveTab("inventory")}
                                type="button"
                            >
                                INVENTÁRIO
                            </button>
                        )}
                        <button
                            className={`character-main-tab-btn ${activeTab === "notes" ? "active" : ""}`}
                            onClick={() => setActiveTab("notes")}
                            type="button"
                        >
                            NOTAS PRIVADAS
                        </button>
                    </div>

                    <div className="character-main-tab-body">
                        <section
                            className={`character-main-tab-panel ${activeTab === "lore" ? "active" : ""}`}
                            aria-hidden={activeTab !== "lore"}
                        >
                            <div className="top-layout-grid lore-tab-layout">
                                <CharacterPortrait
                                    name={character.name}
                                    imageUrl={character.imageUrl}
                                    isGM={isGM}
                                    isCompact={isCompact}
                                    showName={false}
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
                                    religionName={mentionEntities?.find((e) => e.id === character.religionId)?.name}
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
                        </section>

                        <section
                            className={`character-main-tab-panel character-powers-tab ${activeTab === "powers" ? "active" : ""}`}
                            aria-hidden={activeTab !== "powers"}
                        >
                            <PowerTabsSection
                                character={character}
                                sessionId={sessionId}
                                actorUserId={actorUserId}
                                canEdit={canEdit}
                                isGM={isGM}
                                magicLevel={character.magicLevel || 0}
                                onMagicLevelChange={hook.handleMagicLevelChange}
                                includeInventory={false}
                            />

                            <SkillsSection
                                character={character}
                                sessionId={sessionId}
                                actorUserId={actorUserId}
                                canEdit={canEdit}
                            />
                        </section>

                        {showInventoryTab && (
                            <section
                                className={`character-main-tab-panel character-inventory-tab ${activeTab === "inventory" ? "active" : ""}`}
                                aria-hidden={activeTab !== "inventory"}
                            >
                                <InventorySection
                                    character={character}
                                    sessionId={sessionId}
                                    actorUserId={actorUserId}
                                    canEdit={canEdit}
                                    isGM={isGM}
                                    isFloating={false}
                                />
                            </section>
                        )}

                        <section
                            className={`character-main-tab-panel character-notes-tab ${activeTab === "notes" ? "active" : ""}`}
                            aria-hidden={activeTab !== "notes"}
                        >
                            <div className="character-tab-intro">
                                <span className="character-tab-kicker">ATALHO PRIVADO</span>
                                <p>
                                    As notas privadas da ficha ficam abertas por padrão aqui, sem
                                    perder o restante das notas já existentes.
                                </p>
                            </div>

                            <LinkedNotes
                                notes={character.linkedNotes || []}
                                onAddNote={hook.handleAddNote}
                                onDeleteNote={hook.handleDeleteNote}
                                mentionEntities={mentionEntities}
                                hideTitle={false}
                                userId={actorUserId}
                                userRole={isGM ? "GM" : "PLAYER"}
                                defaultShowNotes={false}
                                defaultShowPrivateNotes={true}
                            />
                        </section>
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
