"use client";

import { Character } from "@/types/domain";
import { CharacterConsequences } from "./CharacterConsequences";
import { CharacterSummarySkills } from "./CharacterSummarySkills";
import { CharacterVitality } from "./CharacterVitality";

interface ConsequenceModalState {
    slot: string;
    current: string;
    debuffSkill: string;
    debuffValue: number;
}

interface CharacterSummarySectionProps {
    character: Character;
    isGM: boolean;
    isCompact: boolean;
    canEditStressOrFP: boolean;
    isEditingName: boolean;
    tempName: string;
    onTempNameChange: (value: string) => void;
    onStartEditingName: () => void;
    onSaveName: () => void;
    onCancelEditName: () => void;
    onStressToggle: (track: "PHYSICAL" | "MENTAL", index: number, current: boolean) => void;
    onAddStressBox: (track: "PHYSICAL" | "MENTAL", value?: number) => void;
    onRemoveStressBox: (track: "PHYSICAL" | "MENTAL") => void;
    onUpdateStressBoxValue: (track: "PHYSICAL" | "MENTAL", boxIndex: number, value: number) => void;
    onFPChange: (amount: number) => void;
    onRefreshChange: (delta: number) => void;
    consequenceModal: ConsequenceModalState | null;
    showAddConsequenceModal: boolean;
    onConsequenceClick: (slot: string) => void;
    onSaveConsequence: (text: string, debuffSkill: string, debuffValue: number) => void;
    onCancelConsequenceModal: () => void;
    onDeleteConsequence: (slot: string, e: React.MouseEvent) => void;
    onAddConsequence: (type: "mild" | "moderate" | "severe") => void;
    onOpenAddModal: () => void;
    onCloseAddModal: () => void;
}

export function CharacterSummarySection({
    character,
    isGM,
    isCompact,
    canEditStressOrFP,
    isEditingName,
    tempName,
    onTempNameChange,
    onStartEditingName,
    onSaveName,
    onCancelEditName,
    onStressToggle,
    onAddStressBox,
    onRemoveStressBox,
    onUpdateStressBoxValue,
    onFPChange,
    onRefreshChange,
    consequenceModal,
    showAddConsequenceModal,
    onConsequenceClick,
    onSaveConsequence,
    onCancelConsequenceModal,
    onDeleteConsequence,
    onAddConsequence,
    onOpenAddModal,
    onCloseAddModal,
}: CharacterSummarySectionProps) {
    const initial = character.name?.trim()?.charAt(0)?.toUpperCase() || "?";

    return (
        <section className="character-summary-card">
            <div className="character-summary-header">
                <div className="character-summary-avatar-frame">
                    {character.imageUrl ? (
                        <div
                            className="character-summary-avatar-image"
                            style={{ backgroundImage: `url(${character.imageUrl})` }}
                        />
                    ) : (
                        <span className="character-summary-avatar-placeholder">{initial}</span>
                    )}
                </div>

                <div className="character-summary-identity">
                    <span className="character-summary-overline">RESUMO DA FICHA</span>

                    {isEditingName ? (
                        <div className="character-summary-name-edit">
                            <input
                                className="character-summary-name-input"
                                value={tempName}
                                onChange={(e) => onTempNameChange(e.target.value)}
                                autoFocus
                            />
                            <div className="character-summary-name-actions">
                                <button
                                    className="character-summary-name-btn save"
                                    onClick={onSaveName}
                                    title="Salvar nome"
                                >
                                    ✓
                                </button>
                                <button
                                    className="character-summary-name-btn cancel"
                                    onClick={onCancelEditName}
                                    title="Cancelar edição"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="character-summary-name-row">
                            <h2 className="character-summary-name">{character.name.toUpperCase()}</h2>
                            {isGM && (
                                <button
                                    className="character-summary-edit-name-btn"
                                    onClick={onStartEditingName}
                                    title="Editar nome"
                                >
                                    ✎
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="character-summary-grid">
                <div className="character-summary-panel">
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
                        onStressToggle={onStressToggle}
                        onAddStressBox={onAddStressBox}
                        onRemoveStressBox={onRemoveStressBox}
                        onUpdateStressBoxValue={onUpdateStressBoxValue}
                        onFPChange={onFPChange}
                        onRefreshChange={onRefreshChange}
                    />
                </div>

                <div className="character-summary-panel">
                    <CharacterConsequences
                        character={character}
                        isGM={isGM}
                        consequenceModal={consequenceModal}
                        showAddConsequenceModal={showAddConsequenceModal}
                        onConsequenceClick={onConsequenceClick}
                        onSaveConsequence={onSaveConsequence}
                        onCancelConsequenceModal={onCancelConsequenceModal}
                        onDeleteConsequence={onDeleteConsequence}
                        onAddConsequence={onAddConsequence}
                        onOpenAddModal={onOpenAddModal}
                        onCloseAddModal={onCloseAddModal}
                    />
                </div>

                <div className="character-summary-panel summary-skills-panel">
                    <CharacterSummarySkills character={character} />
                </div>
            </div>
        </section>
    );
}
