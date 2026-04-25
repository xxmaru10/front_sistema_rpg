"use client";

import { Character, DEFAULT_SKILLS } from "@/types/domain";
import { getSkillPalette } from "./skillPalette";

interface CharacterSummarySkillsProps {
    character: Character;
}

export function CharacterSummarySkills({ character }: CharacterSummarySkillsProps) {
    const visibleSkills = DEFAULT_SKILLS.map((skill) => ({
        skill,
        level: character.skills?.[skill] || 0,
    }))
        .filter(({ level }) => level !== 0)
        .sort((a, b) => {
            if (b.level !== a.level) return b.level - a.level;
            return a.skill.localeCompare(b.skill);
        });

    return (
        <div
            className="character-summary-skills"
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
        >
            {visibleSkills.length === 0 ? (
                <div
                    className="summary-skill-empty"
                    style={{
                        padding: "11px 13px",
                        borderRadius: "12px",
                        border: "1px dashed rgba(var(--accent-rgb), 0.18)",
                        color: "rgba(255, 255, 255, 0.58)",
                        fontStyle: "italic",
                        fontSize: "0.9rem",
                    }}
                >
                    Nenhuma perícia diferente de 0 para exibir no resumo.
                </div>
            ) : (
                <div
                    className="summary-skills-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(128px, 1fr))",
                        gap: "8px",
                    }}
                >
                    {visibleSkills.map(({ skill, level }) => {
                        const palette = getSkillPalette(level);

                        return (
                            <div
                                key={skill}
                                className="summary-skill-chip"
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "10px",
                                    padding: "8px 10px",
                                    borderRadius: "999px",
                                    border: `1px solid ${palette.borderColor}`,
                                    background: palette.background,
                                    boxShadow: palette.shadow,
                                }}
                            >
                            <span
                                className="summary-skill-label"
                                style={{
                                    minWidth: 0,
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.66rem",
                                    letterSpacing: "0.12em",
                                    color: palette.labelColor,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                }}
                            >
                                {skill.toUpperCase()}
                            </span>
                            <span
                                className="summary-skill-rank"
                                style={{
                                    flexShrink: 0,
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.82rem",
                                    color: palette.valueColor,
                                }}
                            >
                                {level > 0 ? `+${level}` : `${level}`}
                            </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
