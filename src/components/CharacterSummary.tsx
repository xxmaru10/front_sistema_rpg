"use client";

import { Character } from "@/types/domain";

interface CharacterSummaryProps {
    character: Character;
    onClick: () => void;
}

export function CharacterSummary({ character, onClick }: CharacterSummaryProps) {
    return (
        <div
            className="character-dummy-card"
            onClick={onClick}
            title="Clique para ver detalhes"
        >
            <div className="dummy-portrait">
                {character.imageUrl ? (
                    <div
                        className="dummy-image"
                        style={{ backgroundImage: `url(${character.imageUrl})` }}
                    />
                ) : (
                    <div className="dummy-placeholder">?</div>
                )}
            </div>

            <div className="dummy-info">
                <h3 className="dummy-name">{character.name.toUpperCase()}</h3>
            </div>

            <style jsx>{`
                .character-dummy-card {
                    display: flex;
                    align-items: center;
                    background: linear-gradient(135deg, rgba(16, 16, 16, 0.95), rgba(24, 24, 24, 0.98));
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    gap: 16px;
                    border-left: 3px solid rgba(197, 160, 89, 0.4);
                    position: relative;
                    overflow: hidden;
                }

                .character-dummy-card:hover {
                    background: linear-gradient(135deg, rgba(24, 24, 24, 0.95), rgba(32, 32, 32, 0.98));
                    border-color: rgba(197, 160, 89, 0.6);
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
                    transform: translateY(-2px);
                    border-left-color: var(--accent-color);
                }

                .character-dummy-card:active {
                    transform: translateY(0);
                }

                /* Dummy Portrait Styles */
                .dummy-portrait {
                    width: 60px;
                    height: 60px;
                    background-color: rgba(0, 0, 0, 0.3);
                    background-image: url('/fundo_retrato.png');
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                    border: 2px solid rgba(197, 160, 89, 0.4);
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .dummy-image {
                    width: 100%;
                    height: 100%;
                    background-size: cover;
                    background-position: center;
                    background-repeat: no-repeat;
                }

                .dummy-placeholder {
                    color: var(--accent-color);
                    font-size: 1.5rem;
                    opacity: 0.5;
                    font-family: var(--font-header);
                }

                /* Dummy Info Styles */
                .dummy-info {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }

                .dummy-name {
                    font-family: var(--font-victorian);
                    font-size: 1.4rem;
                    font-weight: 600;
                    font-style: italic;
                    color: var(--accent-color);
                    margin: 0;
                    text-shadow: 0 0 10px rgba(197, 160, 89, 0.1);
                    letter-spacing: 0.02em;
                }

                @media (max-width: 768px) {
                    .dummy-name {
                        font-size: 1.2rem;
                    }
                    .dummy-portrait {
                        width: 50px;
                        height: 50px;
                    }
                }
            `}</style>
        </div>
    );
}
