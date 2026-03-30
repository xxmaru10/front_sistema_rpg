"use client";

import React from 'react';
import { Character } from "@/types/domain";

interface CombatAspectsProps {
    character: Character;
}

export function CombatAspects({ character }: CombatAspectsProps) {
    return (
        <div className="combat-aspects-row">
            <div className="combat-aspect">
                <span className="aspect-label">CONCEITO</span>
                <div className="aspect-text" title={character.sheetAspects?.[0] || ""}>
                    {character.sheetAspects?.[0] || "---"}
                </div>
            </div>
            <div className="combat-aspect trouble">
                <span className="aspect-label">DIFICULDADE</span>
                <div className="aspect-text" title={character.sheetAspects?.[3] || ""}>
                    {character.sheetAspects?.[3] || "---"}
                </div>
            </div>
        </div>
    );
}
