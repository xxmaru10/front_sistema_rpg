"use client";

import { Character, DEFAULT_SKILLS } from "@/types/domain";

interface CharacterSummarySkillsProps {
    character: Character;
}

function getSkillTone(level: number) {
    if (level >= 5) return "legendary";
    if (level >= 3) return "expert";
    if (level >= 2) return "trained";
    return "basic";
}

export function CharacterSummarySkills({ character }: CharacterSummarySkillsProps) {
    const visibleSkills = DEFAULT_SKILLS.map((skill) => ({
        skill,
        level: character.skills[skill] || 0,
    }))
        .filter(({ level }) => level > 0)
        .sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return a.skill.localeCompare(b.skill);
        });

    return (
        <div className="character-summary-skills">
            <div className="summary-subtitle">PERÍCIAS TREINADAS</div>

            {visibleSkills.length === 0 ? (
                <div className="summary-skill-empty">
                    Nenhuma perícia acima de 0 para exibir no resumo.
                </div>
            ) : (
                <div className="summary-skills-grid">
                    {visibleSkills.map(({ skill, level }) => (
                        <div
                            key={skill}
                            className={`summary-skill-chip tone-${getSkillTone(level)}`}
                        >
                            <span className="summary-skill-label">{skill.toUpperCase()}</span>
                            <span className="summary-skill-rank">+{level}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
