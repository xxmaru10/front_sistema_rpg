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

function getSkillToneStyles(level: number) {
    const tone = getSkillTone(level);
    if (tone === "legendary") {
        return {
            borderColor: "rgba(215, 96, 96, 0.34)",
            background: "linear-gradient(135deg, rgba(122, 34, 34, 0.26), rgba(18, 8, 8, 0.8))",
        };
    }

    if (tone === "expert") {
        return {
            borderColor: "rgba(219, 171, 76, 0.34)",
            background: "linear-gradient(135deg, rgba(130, 93, 22, 0.24), rgba(19, 14, 8, 0.76))",
        };
    }

    if (tone === "trained") {
        return {
            borderColor: "rgba(93, 196, 164, 0.28)",
            background: "linear-gradient(135deg, rgba(26, 120, 96, 0.2), rgba(10, 16, 15, 0.72))",
        };
    }

    return {
        borderColor: "rgba(138, 170, 255, 0.24)",
        background: "linear-gradient(135deg, rgba(56, 83, 165, 0.18), rgba(10, 12, 18, 0.72))",
    };
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
        <div
            className="character-summary-skills"
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
            <div
                className="summary-subtitle"
                style={{
                    fontFamily: "var(--font-header)",
                    fontSize: "0.74rem",
                    letterSpacing: "0.28em",
                    color: "rgba(var(--accent-rgb), 0.82)",
                }}
            >
                PERÍCIAS TREINADAS
            </div>

            {visibleSkills.length === 0 ? (
                <div
                    className="summary-skill-empty"
                    style={{
                        padding: "14px 16px",
                        borderRadius: "14px",
                        border: "1px dashed rgba(var(--accent-rgb), 0.18)",
                        color: "rgba(255, 255, 255, 0.58)",
                        fontStyle: "italic",
                    }}
                >
                    Nenhuma perícia acima de 0 para exibir no resumo.
                </div>
            ) : (
                <div
                    className="summary-skills-grid"
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "10px",
                    }}
                >
                    {visibleSkills.map(({ skill, level }) => (
                        <div
                            key={skill}
                            className={`summary-skill-chip tone-${getSkillTone(level)}`}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "12px",
                                padding: "10px 12px",
                                borderRadius: "999px",
                                border: "1px solid rgba(255, 255, 255, 0.08)",
                                ...getSkillToneStyles(level),
                            }}
                        >
                            <span
                                className="summary-skill-label"
                                style={{
                                    minWidth: 0,
                                    fontFamily: "var(--font-header)",
                                    fontSize: "0.74rem",
                                    letterSpacing: "0.12em",
                                    color: "#efe2c0",
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
                                    fontSize: "0.92rem",
                                    color: "#ffffff",
                                }}
                            >
                                +{level}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
