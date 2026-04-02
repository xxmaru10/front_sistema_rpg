"use client";

import { useRef } from "react";

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
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePortraitClick = () => {
        if (isGM) {
            fileInputRef.current?.click();
        }
    };

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

            {/* Input de arquivo sempre oculto — acionado via ref */}
            {isGM && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onImageUpload}
                    style={{ display: "none" }}
                />
            )}

            <div
                className={`character-portrait ${isGM ? "editable" : ""}`}
                onClick={handlePortraitClick}
                title={isGM ? "Clique para alterar a imagem" : undefined}
                style={{ cursor: isGM ? "pointer" : "default" }}
            >
                {imageUrl ? (
                    /* Tem imagem: mostra o retrato. Clique já aciona o picker via handlePortraitClick */
                    <div
                        className="portrait-image"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                    />
                ) : (
                    /* Sem imagem: mostra overlay de upload */
                    <div className="portrait-upload-overlay">
                        {isGM ? (
                            <>
                                <span className="upload-icon">🖼</span>
                                <span className="upload-label">CLIQUE PARA ADICIONAR RETRATO</span>
                            </>
                        ) : (
                            <div className="portrait-placeholder" />
                        )}
                    </div>
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

                .portrait-upload-overlay {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    background: rgba(0, 0, 0, 0.3);
                    transition: background 0.2s;
                }

                .character-portrait.editable:hover .portrait-upload-overlay {
                    background: rgba(var(--accent-rgb), 0.08);
                }

                .upload-icon {
                    font-size: 2.5rem;
                    opacity: 0.5;
                }

                .upload-label {
                    font-family: var(--font-header);
                    font-size: 0.6rem;
                    letter-spacing: 0.15em;
                    color: var(--accent-color);
                    opacity: 0.5;
                    text-align: center;
                    padding: 0 12px;
                }

                .character-portrait.editable:hover .upload-icon,
                .character-portrait.editable:hover .upload-label {
                    opacity: 0.9;
                }
            `}</style>
        </div>
    );
}
