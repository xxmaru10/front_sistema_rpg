"use client";

import { useRef } from "react";
import { Pencil } from "lucide-react";

interface CharacterPortraitProps {
    name: string;
    imageUrl?: string;
    isGM: boolean;
    isCompact: boolean;
    showName?: boolean;
    isEditingName: boolean;
    tempName: string;
    onTempNameChange: (value: string) => void;
    onStartEditingName: () => void;
    onSaveName: () => void;
    onCancelEditName: () => void;
    onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isImageProcessing: boolean;
    onReCrop?: () => void;
}

export function CharacterPortrait({
    name,
    imageUrl,
    isGM,
    isCompact,
    showName = true,
    isEditingName,
    tempName,
    onTempNameChange,
    onStartEditingName,
    onSaveName,
    onCancelEditName,
    onImageUpload,
    isImageProcessing,
    onReCrop,
}: CharacterPortraitProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePortraitClick = () => {
        if (isGM && !isImageProcessing) {
            fileInputRef.current?.click();
        }
    };

    return (
        <div className="portrait-column">
            {showName &&
                (isEditingName ? (
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
                ))}

            {/* Input de arquivo sempre oculto — acionado via ref */}
            {isGM && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onImageUpload}
                    style={{ display: "none" }}
                    disabled={isImageProcessing}
                />
            )}

            <div
                className={`character-portrait ${isGM && !isImageProcessing ? "editable" : ""} ${isImageProcessing ? "processing" : ""}`}
                onClick={handlePortraitClick}
                title={isGM && !isImageProcessing ? "Clique para alterar a imagem" : undefined}
                style={{ cursor: isGM && !isImageProcessing ? "pointer" : "default" }}
            >
                {isImageProcessing ? (
                    <div className="portrait-processing-overlay">
                        <div className="spinner-arcane" />
                        <span className="processing-label">PROCESSANDO...</span>
                    </div>
                ) : imageUrl ? (
                    /* Tem imagem: mostra o retrato. Clique já aciona o picker via handlePortraitClick */
                    <div
                        className="portrait-image"
                        style={{ backgroundImage: `url(${imageUrl})` }}
                    >
                         {isGM && !isImageProcessing && onReCrop && (
                            <button 
                                className="re-crop-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onReCrop();
                                }}
                                title="Reajustar enquadramento"
                            >
                                <Pencil size={14} />
                            </button>
                        )}
                    </div>
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

                .re-crop-btn {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: rgba(0, 0, 0, 0.6);
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    border-radius: 50%;
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    opacity: 0.4;
                    transition: all 0.2s ease;
                    z-index: 10;
                    backdrop-filter: blur(4px);
                }

                .re-crop-btn:hover {
                    opacity: 1;
                    background: var(--accent-color);
                    color: #000;
                    transform: scale(1.1);
                    box-shadow: 0 0 10px var(--accent-color);
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

                .portrait-processing-overlay {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(2px);
                }

                .spinner-arcane {
                    width: 30px;
                    height: 30px;
                    border: 2px solid rgba(var(--accent-rgb), 0.1);
                    border-top-color: var(--accent-color);
                    border-radius: 50%;
                    animation: rotate-arcane 1s linear infinite;
                }

                .processing-label {
                    font-family: var(--font-header);
                    font-size: 0.65rem;
                    color: var(--accent-color);
                    letter-spacing: 0.1em;
                    animation: pulse-arcane 1.5s ease-in-out infinite;
                }

                @keyframes rotate-arcane {
                    to { transform: rotate(360deg); }
                }

                @keyframes pulse-arcane {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 1; }
                }
            `}</style>
        </div>
    );
}
