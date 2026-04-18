"use client";

import { useState } from "react";
import { Character, SessionState } from "@/types/domain";
import { InventorySection } from "./InventorySection";
import { SkillsSection } from "./SkillsSection";
import { useCharacterCard } from "./useCharacterCard";
import { ImageCropper } from "@/components/ImageCropper/ImageCropper";
import { ArenaFocusCropper } from "@/components/ImageCropper/ArenaFocusCropper";
import { CharacterPortrait } from "./CharacterPortrait";
import { CharacterLore } from "./CharacterLore";
import { PowerTabsSection } from "./PowerTabsSection";
import { CharacterSummarySection } from "./CharacterSummarySection";
import { CharacterPrivateNotesPanel } from "./CharacterPrivateNotesPanel";
import { MentionNavigationRequest } from "@/lib/mentionNavigation";

interface CharacterCardProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    isGM?: boolean;
    isCompact?: boolean;
    isLinkedCharacter?: boolean;
    mentionEntities?: any[];
    hideInventory?: boolean;
    sessionState?: SessionState;
    userRole?: "GM" | "PLAYER";
    onMentionNavigate?: (request: MentionNavigationRequest) => void;
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
    sessionState,
    userRole,
    onMentionNavigate,
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
    const resolveActiveTab = () => {
        if (activeTab === "inventory" && !showInventoryTab) return "lore";
        return activeTab;
    };
    const visibleTab = resolveActiveTab();

    const renderActivePanel = () => {
        if (visibleTab === "lore") {
            return (
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
                        onReCrop={hook.handleReCrop}
                        onReArenaFocus={hook.handleReArenaFocus}
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
            );
        }

        if (visibleTab === "powers") {
            return (
                <div className="character-powers-tab active">
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
                </div>
            );
        }

        if (visibleTab === "inventory" && showInventoryTab) {
            return (
                <div className="character-main-tab-panel active">
                    <InventorySection
                        character={character}
                        sessionId={sessionId}
                        actorUserId={actorUserId}
                        canEdit={canEdit}
                        isGM={isGM}
                        isFloating={false}
                        globalItems={sessionState?.items || []}
                    />
                </div>
            );
        }

        return (
            <div className="character-notes-tab active">
                {sessionState ? (
                    <CharacterPrivateNotesPanel
                        sessionId={sessionId}
                        characterId={character.id}
                        userId={actorUserId}
                        userRole={userRole || (isGM ? "GM" : "PLAYER")}
                        state={sessionState}
                        mentionEntities={mentionEntities}
                        onMentionNavigate={onMentionNavigate}
                    />
                ) : (
                    <div className="character-tab-intro">
                        <span className="character-tab-kicker">NOTAS PRIVADAS</span>
                        <p>As notas da sessão não estão disponíveis neste contexto da ficha.</p>
                    </div>
                )}
            </div>
        );
    };

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
                    canEditConsequences={canEdit}
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

                <div
                    className="character-main-tabs-shell"
                    style={{
                        border: "1px solid rgba(var(--accent-rgb), 0.18)",
                        borderRadius: "22px",
                        overflow: "hidden",
                        background: "linear-gradient(180deg, rgba(15, 15, 15, 0.95), rgba(8, 8, 8, 0.98))",
                        boxShadow: "inset 0 0 30px rgba(0, 0, 0, 0.22)",
                    }}
                >
                    <div
                        className="character-main-tabs-header"
                        style={{
                            display: "grid",
                            gridTemplateColumns: showInventoryTab ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                            background: "rgba(var(--accent-rgb), 0.05)",
                            borderBottom: "1px solid rgba(var(--accent-rgb), 0.16)",
                        }}
                    >
                        <button
                            className={`character-main-tab-btn ${visibleTab === "lore" ? "active" : ""}`}
                            onClick={() => setActiveTab("lore")}
                            type="button"
                            style={{
                                background: visibleTab === "lore"
                                    ? "linear-gradient(180deg, rgba(var(--accent-rgb), 0.18), rgba(var(--accent-rgb), 0.08))"
                                    : "transparent",
                                border: "none",
                                color: visibleTab === "lore" ? "var(--accent-color)" : "rgba(255, 255, 255, 0.72)",
                                cursor: "pointer",
                                padding: "16px 14px",
                                fontFamily: "var(--font-header)",
                                fontSize: "0.72rem",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                                boxShadow: visibleTab === "lore" ? "inset 0 -2px 0 var(--accent-color)" : "none",
                            }}
                        >
                            LORE
                        </button>
                        <button
                            className={`character-main-tab-btn ${visibleTab === "powers" ? "active" : ""}`}
                            onClick={() => setActiveTab("powers")}
                            type="button"
                            style={{
                                background: visibleTab === "powers"
                                    ? "linear-gradient(180deg, rgba(var(--accent-rgb), 0.18), rgba(var(--accent-rgb), 0.08))"
                                    : "transparent",
                                border: "none",
                                color: visibleTab === "powers" ? "var(--accent-color)" : "rgba(255, 255, 255, 0.72)",
                                cursor: "pointer",
                                padding: "16px 14px",
                                fontFamily: "var(--font-header)",
                                fontSize: "0.72rem",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                                boxShadow: visibleTab === "powers" ? "inset 0 -2px 0 var(--accent-color)" : "none",
                            }}
                        >
                            FAÇANHAS & MAGIA
                        </button>
                        {showInventoryTab && (
                            <button
                                className={`character-main-tab-btn ${visibleTab === "inventory" ? "active" : ""}`}
                                onClick={() => setActiveTab("inventory")}
                                type="button"
                                style={{
                                    background: visibleTab === "inventory"
                                        ? "linear-gradient(180deg, rgba(var(--accent-rgb), 0.18), rgba(var(--accent-rgb), 0.08))"
                                        : "transparent",
                                    border: "none",
                                    color: visibleTab === "inventory" ? "var(--accent-color)" : "rgba(255, 255, 255, 0.72)",
                                    cursor: "pointer",
                                    padding: "16px 14px",
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.18em",
                                    textTransform: "uppercase",
                                    boxShadow: visibleTab === "inventory" ? "inset 0 -2px 0 var(--accent-color)" : "none",
                                }}
                            >
                                INVENTÁRIO
                            </button>
                        )}
                        <button
                            className={`character-main-tab-btn ${visibleTab === "notes" ? "active" : ""}`}
                            onClick={() => setActiveTab("notes")}
                            type="button"
                            style={{
                                background: visibleTab === "notes"
                                    ? "linear-gradient(180deg, rgba(var(--accent-rgb), 0.18), rgba(var(--accent-rgb), 0.08))"
                                    : "transparent",
                                border: "none",
                                color: visibleTab === "notes" ? "var(--accent-color)" : "rgba(255, 255, 255, 0.72)",
                                cursor: "pointer",
                                padding: "16px 14px",
                                fontFamily: "var(--font-header)",
                                fontSize: "0.72rem",
                                letterSpacing: "0.18em",
                                textTransform: "uppercase",
                                boxShadow: visibleTab === "notes" ? "inset 0 -2px 0 var(--accent-color)" : "none",
                            }}
                        >
                            NOTAS PRIVADAS
                        </button>
                    </div>

                    <div
                        className="character-main-tab-body"
                        style={{ padding: "28px" }}
                    >
                        {renderActivePanel()}
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

                {hook.isArenaFocusCropping && hook.arenaFocusSrc && (
                    <ArenaFocusCropper
                        src={hook.arenaFocusSrc}
                        aspectRatio={1.24}
                        initialFocus={character.arenaPortraitFocus}
                        onConfirm={hook.handleArenaFocusConfirm}
                        onCancel={hook.handleArenaFocusCancel}
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
