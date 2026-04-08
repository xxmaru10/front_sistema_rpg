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
        <section
            className="character-summary-card"
            style={{
                background:
                    "radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.14), transparent 38%), linear-gradient(180deg, rgba(18, 18, 18, 0.98), rgba(8, 8, 8, 0.98))",
                border: "1px solid rgba(var(--accent-rgb), 0.28)",
                borderRadius: "24px",
                padding: isCompact ? "18px" : "24px",
                boxShadow: "inset 0 0 40px rgba(0, 0, 0, 0.45), 0 18px 42px rgba(0, 0, 0, 0.35)",
            }}
        >
            <div
                className="character-summary-header"
                style={{
                    display: "flex",
                    alignItems: isCompact ? "flex-start" : "center",
                    flexDirection: isCompact ? "column" : "row",
                    gap: "20px",
                    paddingBottom: "20px",
                    borderBottom: "1px solid rgba(var(--accent-rgb), 0.16)",
                    marginBottom: "20px",
                }}
            >
                <div
                    className="character-summary-avatar-frame"
                    style={{
                        width: isCompact ? "74px" : "92px",
                        height: isCompact ? "74px" : "92px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                        border: "2px solid rgba(var(--accent-rgb), 0.4)",
                        background:
                            "radial-gradient(circle at 30% 30%, rgba(var(--accent-rgb), 0.28), rgba(0, 0, 0, 0.7)), rgba(0, 0, 0, 0.7)",
                        boxShadow:
                            "0 0 0 4px rgba(var(--accent-rgb), 0.08), 0 0 24px rgba(var(--accent-rgb), 0.16)",
                    }}
                >
                    {character.imageUrl ? (
                        <img
                            src={character.imageUrl}
                            alt={character.name}
                            className="character-summary-avatar-image"
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                            }}
                        />
                    ) : (
                        <span
                            className="character-summary-avatar-placeholder"
                            style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontFamily: "var(--font-header)",
                                fontSize: "2rem",
                                color: "var(--accent-color)",
                            }}
                        >
                            {initial}
                        </span>
                    )}
                </div>

                <div
                    className="character-summary-identity"
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        minWidth: 0,
                        flex: 1,
                    }}
                >
                    <span
                        className="character-summary-overline"
                        style={{
                            fontFamily: "var(--font-header)",
                            fontSize: "0.68rem",
                            letterSpacing: "0.35em",
                            color: "rgba(var(--accent-rgb), 0.78)",
                        }}
                    >
                        RESUMO DA FICHA
                    </span>

                    {isEditingName ? (
                        <div
                            className="character-summary-name-edit"
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "10px",
                                alignItems: "center",
                            }}
                        >
                            <input
                                className="character-summary-name-input"
                                value={tempName}
                                onChange={(e) => onTempNameChange(e.target.value)}
                                autoFocus
                                style={{
                                    minWidth: "min(320px, 100%)",
                                    flex: 1,
                                    background: "rgba(0, 0, 0, 0.48)",
                                    border: "1px solid rgba(var(--accent-rgb), 0.34)",
                                    borderRadius: "999px",
                                    color: "#f6e7bf",
                                    padding: "12px 16px",
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.95rem",
                                    letterSpacing: "0.08em",
                                    outline: "none",
                                }}
                            />
                            <div
                                className="character-summary-name-actions"
                                style={{ display: "flex", alignItems: "center", gap: "8px" }}
                            >
                                <button
                                    className="character-summary-name-btn save"
                                    onClick={onSaveName}
                                    title="Salvar nome"
                                    style={{
                                        width: "34px",
                                        height: "34px",
                                        borderRadius: "50%",
                                        border: "1px solid rgba(143, 231, 167, 0.35)",
                                        background: "rgba(0, 0, 0, 0.45)",
                                        color: "#8fe7a7",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✓
                                </button>
                                <button
                                    className="character-summary-name-btn cancel"
                                    onClick={onCancelEditName}
                                    title="Cancelar edição"
                                    style={{
                                        width: "34px",
                                        height: "34px",
                                        borderRadius: "50%",
                                        border: "1px solid rgba(255, 140, 140, 0.35)",
                                        background: "rgba(0, 0, 0, 0.45)",
                                        color: "#ff8c8c",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div
                            className="character-summary-name-row"
                            style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}
                        >
                            <h2
                                className="character-summary-name"
                                style={{
                                    margin: 0,
                                    fontFamily: "var(--font-victorian)",
                                    fontSize: isCompact ? "1.3rem" : "clamp(1.5rem, 2vw, 2.4rem)",
                                    lineHeight: 1.05,
                                    color: "#f6e7bf",
                                    textTransform: "uppercase",
                                    textShadow: "0 0 20px rgba(var(--accent-rgb), 0.18)",
                                    wordBreak: "break-word",
                                }}
                            >
                                {character.name.toUpperCase()}
                            </h2>
                            {isGM && (
                                <button
                                    className="character-summary-edit-name-btn"
                                    onClick={onStartEditingName}
                                    title="Editar nome"
                                    style={{
                                        width: "34px",
                                        height: "34px",
                                        borderRadius: "50%",
                                        border: "1px solid rgba(var(--accent-rgb), 0.35)",
                                        background: "rgba(0, 0, 0, 0.45)",
                                        color: "var(--accent-color)",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✎
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div
                className="character-summary-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: isCompact ? "1fr" : "minmax(0, 1.2fr) minmax(0, 1fr)",
                    gap: "20px",
                }}
            >
                <div className="character-summary-panel" style={{ minWidth: 0 }}>
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

                <div className="character-summary-panel" style={{ minWidth: 0 }}>
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

                <div
                    className="character-summary-panel summary-skills-panel"
                    style={{ minWidth: 0, gridColumn: "1 / -1" }}
                >
                    <CharacterSummarySkills character={character} />
                </div>
            </div>
        </section>
    );
}
