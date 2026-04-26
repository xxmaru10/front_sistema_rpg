"use client";

const DEFAULT_ASPECT_LABELS = ["ASPECTO", "ASPECTO", "ASPECTO", "DIFICULDADE"] as const;

interface CharacterLoreProps {
    biography: string;
    sheetAspects: Record<number, string> | string[] | undefined;
    /** Custom labels per aspect index. Length also controls how many slots are rendered. */
    aspectLabels?: string[];
    canEdit: boolean;
    showLore: boolean;
    onToggleLore: () => void;
    isEditingBio: boolean;
    tempBio: string;
    onTempBioChange: (value: string) => void;
    onStartEditingBio: () => void;
    onSaveBio: () => void;
    onCancelBio: () => void;
    editingAspectIndex: number | null;
    tempAspect: string;
    onTempAspectChange: (value: string) => void;
    onStartEditingAspect: (index: number, currentVal: string) => void;
    onSaveAspect: (index: number) => void;
    onCancelAspect: () => void;
    religionName?: string;
}

export function CharacterLore({
    biography,
    sheetAspects,
    aspectLabels,
    canEdit,
    showLore,
    onToggleLore,
    isEditingBio,
    tempBio,
    onTempBioChange,
    onStartEditingBio,
    onSaveBio,
    onCancelBio,
    editingAspectIndex,
    tempAspect,
    onTempAspectChange,
    onStartEditingAspect,
    onSaveAspect,
    onCancelAspect,
    religionName,
}: CharacterLoreProps) {
    return (
        <div className="info-tower-column">
            {/* Lore Accordion */}
            <div className={`lore-accordion-box ${showLore ? "expanded" : "collapsed"}`}>
                <div className="lore-accordion-header" onClick={onToggleLore}>
                    <span className="lore-title">LORE</span>
                    <span className="lore-toggle-icon">{showLore ? "−" : "+"}</span>
                </div>

                {showLore && (
                    <div className="lore-accordion-content animate-reveal">
                        {religionName && (
                            <div className="religion-banner">
                                ✧ {religionName.toUpperCase()} ✧
                            </div>
                        )}
                        <div className="lore-controls-mini">
                            {canEdit && !isEditingBio && (
                                <button
                                    className="tiny-edit-btn"
                                    onClick={(e) => { e.stopPropagation(); onStartEditingBio(); }}
                                >
                                    ✎
                                </button>
                            )}
                        </div>
                        {isEditingBio ? (
                            <div className="lore-editor-stack">
                                <textarea
                                    className="lore-textarea-stack"
                                    value={tempBio}
                                    onChange={(e) => onTempBioChange(e.target.value)}
                                    placeholder="História..."
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="stack-actions">
                                    <button className="save" onClick={(e) => { e.stopPropagation(); onSaveBio(); }}>✓</button>
                                    <button className="cancel" onClick={(e) => { e.stopPropagation(); onCancelBio(); }}>✕</button>
                                </div>
                            </div>
                        ) : (
                            <div className="lore-text-stack">{biography || "..."}</div>
                        )}
                    </div>
                )}
            </div>

            {/* Aspects Stack */}
            <div className="aspects-stack">
                {(aspectLabels ?? DEFAULT_ASPECT_LABELS).map((label, idx) => {
                    const isTrouble = label === "DIFICULDADE";
                    const aspectValue = (sheetAspects as any)?.[idx] || "";
                    const isEditing = editingAspectIndex === idx;

                    return (
                        <div
                            key={idx}
                            className={`sheet-aspect-box-vertical ${isTrouble ? "trouble" : "normal"}`}
                        >
                            <div className="aspect-label-vertical">
                                {label}
                                {canEdit && !isEditing && (
                                    <button
                                        className="tiny-edit-btn"
                                        onClick={() => onStartEditingAspect(idx, aspectValue)}
                                    >
                                        ✎
                                    </button>
                                )}
                            </div>

                            {isEditing ? (
                                <div className="aspect-editor-mini">
                                    <input
                                        className="aspect-input"
                                        value={tempAspect}
                                        onChange={(e) => onTempAspectChange(e.target.value.toUpperCase())}
                                        autoFocus
                                    />
                                    <div className="mini-actions">
                                        <button className="save" onClick={() => onSaveAspect(idx)}>✓</button>
                                        <button className="cancel" onClick={onCancelAspect}>✕</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="aspect-display-vertical">{aspectValue || "---"}</div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
