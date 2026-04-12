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
    canEditConsequences?: boolean;
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
    onKillCharacter?: () => void;
}

export function CharacterSummarySection({
    character,
    isGM,
    isCompact,
    canEditStressOrFP,
    canEditConsequences,
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
    onKillCharacter,
}: CharacterSummarySectionProps) {
    const initial = character.name?.trim()?.charAt(0)?.toUpperCase() || "?";
    const showFateInline = !(character.isNPC && !isGM);

    const renderFateInline = () => {
        if (!showFateInline) return null;

        return (
            <div
                className="character-summary-fate-inline"
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "8px",
                    padding: "6px 10px",
                    borderRadius: "999px",
                    border: "1px solid rgba(var(--accent-rgb), 0.22)",
                    background: "rgba(0, 0, 0, 0.34)",
                    boxShadow: "inset 0 0 12px rgba(0, 0, 0, 0.2)",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "6px",
                        whiteSpace: "nowrap",
                    }}
                >
                    <span
                        style={{
                            fontSize: "1rem",
                            color: "var(--accent-color)",
                            lineHeight: 1,
                        }}
                    >
                        🜂
                    </span>
                    <span
                        style={{
                            fontFamily: "var(--font-header)",
                            fontSize: isCompact ? "0.9rem" : "1rem",
                            color: "#f6e7bf",
                        }}
                    >
                        {character.fatePoints}
                    </span>
                    <span
                        style={{
                            fontFamily: "var(--font-header)",
                            fontSize: "0.76rem",
                            color: "rgba(255, 255, 255, 0.58)",
                        }}
                    >
                        / {character.refresh ?? 3}
                    </span>
                </div>

                {canEditStressOrFP && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <button
                            type="button"
                            onClick={() => onFPChange(-1)}
                            style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "7px",
                                border: "1px solid rgba(var(--accent-rgb), 0.28)",
                                background: "rgba(0, 0, 0, 0.5)",
                                color: "var(--accent-color)",
                                cursor: "pointer",
                            }}
                        >
                            -
                        </button>
                        <button
                            type="button"
                            onClick={() => onFPChange(1)}
                            style={{
                                width: "24px",
                                height: "24px",
                                borderRadius: "7px",
                                border: "1px solid rgba(var(--accent-rgb), 0.28)",
                                background: "rgba(0, 0, 0, 0.5)",
                                color: "var(--accent-color)",
                                cursor: "pointer",
                            }}
                        >
                            +
                        </button>
                        {isGM && (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <button
                                    type="button"
                                    onClick={() => onRefreshChange(-1)}
                                    title="Reduzir recarga"
                                    style={{
                                        width: "24px",
                                        height: "24px",
                                        borderRadius: "7px",
                                        border: "1px solid rgba(var(--accent-rgb), 0.22)",
                                        background: "rgba(0, 0, 0, 0.4)",
                                        color: "rgba(255, 255, 255, 0.72)",
                                        cursor: "pointer",
                                    }}
                                >
                                    v
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRefreshChange(1)}
                                    title="Aumentar recarga"
                                    style={{
                                        width: "24px",
                                        height: "24px",
                                        borderRadius: "7px",
                                        border: "1px solid rgba(var(--accent-rgb), 0.22)",
                                        background: "rgba(0, 0, 0, 0.4)",
                                        color: "rgba(255, 255, 255, 0.72)",
                                        cursor: "pointer",
                                    }}
                                >
                                    ^
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <section
            className="character-summary-card"
            style={{
                background:
                    "radial-gradient(circle at top left, rgba(var(--accent-rgb), 0.14), transparent 38%), linear-gradient(180deg, rgba(18, 18, 18, 0.98), rgba(8, 8, 8, 0.98))",
                border: "1px solid rgba(var(--accent-rgb), 0.28)",
                borderRadius: "20px",
                padding: isCompact ? "14px" : "19px",
                boxShadow: "inset 0 0 28px rgba(0, 0, 0, 0.42), 0 14px 34px rgba(0, 0, 0, 0.32)",
            }}
        >
            <div
                className="character-summary-header"
                style={{
                    display: "flex",
                    alignItems: isCompact ? "flex-start" : "center",
                    flexDirection: isCompact ? "column" : "row",
                    gap: "16px",
                    paddingBottom: "16px",
                    borderBottom: "1px solid rgba(var(--accent-rgb), 0.16)",
                    marginBottom: "16px",
                }}
            >
                <div
                    className="character-summary-avatar-frame"
                    style={{
                        width: isCompact ? "60px" : "74px",
                        height: isCompact ? "60px" : "74px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        flexShrink: 0,
                        border: "2px solid rgba(var(--accent-rgb), 0.4)",
                        background:
                            "radial-gradient(circle at 30% 30%, rgba(var(--accent-rgb), 0.28), rgba(0, 0, 0, 0.7)), rgba(0, 0, 0, 0.7)",
                        boxShadow:
                            "0 0 0 3px rgba(var(--accent-rgb), 0.08), 0 0 18px rgba(var(--accent-rgb), 0.14)",
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
                                fontSize: "1.5rem",
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
                    {isEditingName ? (
                        <div
                            className="character-summary-name-edit"
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "8px",
                                alignItems: "center",
                            }}
                        >
                            <input
                                className="character-summary-name-input"
                                value={tempName}
                                onChange={(e) => onTempNameChange(e.target.value)}
                                autoFocus
                                style={{
                                    minWidth: "min(260px, 100%)",
                                    flex: 1,
                                    background: "rgba(0, 0, 0, 0.48)",
                                    border: "1px solid rgba(var(--accent-rgb), 0.34)",
                                    borderRadius: "999px",
                                    color: "#f6e7bf",
                                    padding: "10px 14px",
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.82rem",
                                    letterSpacing: "0.08em",
                                    outline: "none",
                                }}
                            />
                            <div
                                className="character-summary-name-actions"
                                style={{ display: "flex", alignItems: "center", gap: "6px" }}
                            >
                                <button
                                    className="character-summary-name-btn save"
                                    onClick={onSaveName}
                                    title="Salvar nome"
                                    style={{
                                        width: "28px",
                                        height: "28px",
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
                                        width: "28px",
                                        height: "28px",
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
                            {renderFateInline()}
                        </div>
                    ) : (
                        <div
                            className="character-summary-name-row"
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                flexWrap: "wrap",
                                gap: "10px 12px",
                                minWidth: 0,
                            }}
                        >
                            <div
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    minWidth: 0,
                                    flexWrap: "wrap",
                                }}
                            >
                                <h2
                                    className="character-summary-name"
                                    style={{
                                        margin: 0,
                                        fontFamily: "var(--font-victorian)",
                                        fontSize: isCompact ? "1.08rem" : "clamp(1.2rem, 1.7vw, 1.9rem)",
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
                                            width: "28px",
                                            height: "28px",
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
                            {renderFateInline()}
                        </div>
                    )}
                </div>
            </div>

            <div
                className="character-summary-grid"
                style={{
                    display: "grid",
                    gridTemplateColumns: isCompact ? "1fr" : "minmax(0, 1.2fr) minmax(0, 1fr)",
                    alignItems: "start",
                    gap: "16px",
                }}
            >
                <div
                    className="character-summary-panel"
                    style={{
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                    }}
                >
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
                        compactNodes={true}
                        hideFateReserve={true}
                        canEditStressOrFP={canEditStressOrFP}
                        onStressToggle={onStressToggle}
                        onAddStressBox={onAddStressBox}
                        onRemoveStressBox={onRemoveStressBox}
                        onUpdateStressBoxValue={onUpdateStressBoxValue}
                        onFPChange={onFPChange}
                        onRefreshChange={onRefreshChange}
                    />

                    <CharacterSummarySkills character={character} />
                </div>

                <div className="character-summary-panel" style={{ minWidth: 0 }}>
                    <CharacterConsequences
                        character={character}
                        isGM={isGM}
                        canEditConsequences={canEditConsequences}
                        consequenceModal={consequenceModal}
                        showAddConsequenceModal={showAddConsequenceModal}
                        onConsequenceClick={onConsequenceClick}
                        onSaveConsequence={onSaveConsequence}
                        onCancelConsequenceModal={onCancelConsequenceModal}
                        onDeleteConsequence={onDeleteConsequence}
                        onAddConsequence={onAddConsequence}
                        onOpenAddModal={onOpenAddModal}
                        onCloseAddModal={onCloseAddModal}
                        onKillCharacter={onKillCharacter}
                    />
                </div>
            </div>
        </section>
    );
}
