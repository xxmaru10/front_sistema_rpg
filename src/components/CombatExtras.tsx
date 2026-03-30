"use client";

import { Character } from "@/types/domain";

interface CombatExtrasProps {
    character: Character;
    isGM: boolean;
    isOwner: boolean;
}

export function CombatExtras({ character, isGM, isOwner }: CombatExtrasProps) {
    if (character.isNPC && !isGM && !isOwner) return null;

    const hasStunts = character.stunts && character.stunts.length > 0;
    const hasSpells = character.spells && character.spells.length > 0;

    if (!hasStunts && !hasSpells) return null;

    return (
        <div className="combat-extras-section">
            {character.stunts && character.stunts.length > 0 && (
                <div className="combat-extra-group">
                    <div className="extra-title">FAÇANHAS</div>
                    <div className="extra-list">
                        {character.stunts.map(stunt => (
                            <div key={stunt.id} className="extra-item" title={stunt.description}>
                                <span className="extra-name">{stunt.name.toUpperCase()}</span>
                                <span className="extra-cost">{stunt.cost}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {character.spells && character.spells.length > 0 && (
                <div className="combat-extra-group">
                    <div className="extra-title">MAGIAS</div>
                    <div className="extra-list">
                        {character.spells.map(spell => (
                            <div key={spell.id} className="extra-item" title={spell.description}>
                                <span className="extra-name">{spell.name.toUpperCase()}</span>
                                <span className="extra-cost">{spell.cost}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style jsx>{`
                .combat-extras-section {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    padding-top: 8px;
                    border-top: 1px solid rgba(255,255,255,0.05);
                }

                .combat-extra-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .extra-title {
                    font-size: 0.55rem;
                    letter-spacing: 0.15em;
                    color: rgba(197, 160, 89, 0.5);
                    font-weight: bold;
                }

                .extra-list {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }

                .extra-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(197, 160, 89, 0.03);
                    padding: 4px 6px;
                    border: 1px solid rgba(197, 160, 89, 0.1);
                    border-radius: 2px;
                }

                .extra-name {
                    font-size: 0.65rem;
                    color: #c5a059;
                    font-family: var(--font-header);
                    letter-spacing: 0.03em;
                }

                .extra-cost {
                    font-size: 0.6rem;
                    color: #888;
                    background: rgba(0, 0, 0, 0.2);
                    padding: 0 4px;
                    border-radius: 3px;
                }
            `}</style>
        </div>
    );
}
