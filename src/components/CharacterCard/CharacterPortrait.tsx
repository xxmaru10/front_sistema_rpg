"use client";

interface CharacterPortraitProps {
    name: string;
    imageUrl?: string;
    isGM: boolean;
    isCompact: boolean;
    isEditingName: boolean;
    tempName: string;
    onTempNameChange: (value: string) => void;
    onStartEditingName: () => void;
    onSaveName: () => void;
    onCancelEditName: () => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function CharacterPortrait({
    name,
    imageUrl,
    isGM,
    isCompact,
    isEditingName,
    tempName,
    onTempNameChange,
    onStartEditingName,
    onSaveName,
    onCancelEditName,
    onImageUpload,
}: CharacterPortraitProps) {
    return (
        <div className="portrait-column">
            {isEditingName ? (
                <div className="name-editor-container">
                    <input
                        className="name-input-edit"
                        value={tempName}
                        onChange={(e) => onTempNameChange(e.target.value)}
                        autoFocus
                    />
                    <button className="save-name-btn" onClick={onSaveName}>✓</button>
                    <button className="cancel-name-btn" onClick={onCancelEditName}>✕</button>
                </div>
            ) : (
                <div className="name-display-container">
                    <h3 className={`char-name-portrait ${isCompact ? "compact" : ""}`}>
                        {name.toUpperCase()}
                    </h3>
                    {isGM && (
                        <button
                            onClick={onStartEditingName}
                            className="edit-name-btn"
                            title="Editar Nome"
                        >
                            ✎
                        </button>
                    )}
                </div>
            )}

            <div className={`character-portrait ${isGM ? "editable" : ""}`}>
                {isGM && (
                    <input
                        type="file"
                        accept="image/*"
                        onChange={onImageUpload}
                        className="hidden-file-input"
                        title="Upload Portrait"
                    />
                )}
                {imageUrl ? (
                    <div
                        className="portrait-image"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                ) : (
                    <div className="portrait-placeholder">{isGM ? "+" : ""}</div>
                )}
            </div>

            <style jsx>{`
                .name-editor-container {
                    margin-bottom: 8px;
                    display: flex;
                    gap: 4px;
                    justify-content: center;
                }

                .name-input-edit {
                    background: rgba(0, 0, 0, 0.5);
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    font-family: var(--font-header);
                    font-size: 1.2rem;
                    text-align: center;
                    width: 100%;
                    padding: 4px;
                }

                .save-name-btn {
                    color: #4f4;
                    background: none;
                    border: 1px solid #080;
                    cursor: pointer;
                }

                .cancel-name-btn {
                    color: #f44;
                    background: none;
                    border: 1px solid #800;
                    cursor: pointer;
                }

                .name-display-container {
                    position: relative;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .edit-name-btn {
                    position: absolute;
                    right: 0;
                    background: none;
                    border: none;
                    color: var(--accent-color);
                    opacity: 0.3;
                    cursor: pointer;
                    font-size: 0.8rem;
                }

                .edit-name-btn:hover {
                    opacity: 1;
                }
            `}</style>
        </div>
    );
}
