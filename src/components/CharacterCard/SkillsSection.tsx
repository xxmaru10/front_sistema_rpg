"use client";

import { useState } from "react";
import { Character, DEFAULT_SKILLS } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { getSkillPalette } from "./skillPalette";

interface SkillsSectionProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    canEdit: boolean;
    /** Override the skill list iterated. Defaults to DEFAULT_SKILLS. */
    skills?: readonly string[];
}

export function SkillsSection({ character, sessionId, actorUserId, canEdit, skills: skillsList }: SkillsSectionProps) {
    const skillNames = skillsList ?? DEFAULT_SKILLS;
    const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

    const handleInitResource = (skill: string) => {
        const initialMax = character.skills?.[skill] || 0;
        if (initialMax <= 0) return;

        globalEventStore.append({
            type: "SKILL_RESOURCE_INIT",
            id: uuidv4(),
            sessionId,
            seq: 0,
            actorUserId,
            visibility: "PUBLIC",
            createdAt: new Date().toISOString(),
            payload: { characterId: character.id, skill, initialMax: Math.max(1, initialMax) }
        } as any);
    };

    const handleUpdateResource = (skill: string, current: number, max: number) => {
        globalEventStore.append({
            type: "SKILL_RESOURCE_UPDATED",
            id: uuidv4(),
            sessionId,
            seq: 0,
            actorUserId,
            visibility: "PUBLIC",
            createdAt: new Date().toISOString(),
            payload: { characterId: character.id, skill, current, max }
        } as any);
    };

    const handleSkillChange = (skill: string, currentRank: number, delta: number) => {
        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_SKILL_UPDATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, skill, rank: currentRank + delta }
        } as any);
    };

    const toggleSkillResource = (skill: string) => {
        setExpandedSkills(prev => {
            const next = new Set(prev);
            if (next.has(skill)) {
                next.delete(skill);
            } else {
                next.add(skill);
                // If initializing for the first time, check if it exists in character
                if (!character.skillResources?.[skill]) {
                    handleInitResource(skill);
                }
            }
            return next;
        });
    };

    // Calculate total debuffs per skill from all consequences
    const getSkillDebuff = (skillName: string): number => {
        let totalDebuff = 0;
        const slots: ("mild" | "mild2" | "moderate" | "severe")[] = ["mild", "mild2", "moderate", "severe"];
        for (const slot of slots) {
            const consData = character.consequences?.[slot];
            if (consData?.debuff?.skill === skillName && consData.debuff.value) {
                totalDebuff += consData.debuff.value;
            }
        }
        return totalDebuff;
    };

    return (
        <div className="skills-section">
                            <h4 className="section-title">✦ PERÍCIAS ✦</h4>
                            <div className="skills-grid">
                                {skillNames.map(skill => ({ skill, level: character.skills?.[skill] || 0 }))
                                    .sort((a, b) => {
                                        if (b.level !== a.level) return b.level - a.level;
                                        return a.skill.localeCompare(b.skill);
                                    })
                                    .map(({ skill, level }) => {
                                        const resource = character.skillResources?.[skill];
                                        const isExpanded = expandedSkills.has(skill);
                                        const debuff = getSkillDebuff(skill);
                                        const isNegative = level < 0;
                                        const palette = getSkillPalette(level);
                                        const displayedValue = `${level >= 0 ? "+" : ""}${level}`;

                                        return (
                                            <div
                                                key={skill}
                                                className={`skill-row ${level > 0 ? "has-points" : ""} level-${level} ${debuff > 0 ? "has-debuff" : ""} ${isNegative ? "is-negative" : ""}`}
                                                style={{
                                                    border: `1px solid ${palette.borderColor}`,
                                                    background: palette.background,
                                                    boxShadow: palette.shadow,
                                                }}
                                            >
                                                <span
                                                    className="skill-name"
                                                    style={{ color: palette.labelColor }}
                                                >
                                                    {skill.toUpperCase()}
                                                </span>
                                                {canEdit ? (
                                                    <div className="skill-controls">
                                                        <span
                                                            className="skill-value"
                                                            style={{ color: palette.valueColor }}
                                                        >
                                                            {displayedValue}
                                                        </span>
                                                        {debuff > 0 && <span className="skill-debuff">(-{debuff})</span>}
                                                        <button
                                                            onClick={() => handleSkillChange(skill, level, -1)}
                                                            className="skill-btn"
                                                            style={{ color: palette.valueColor, borderColor: palette.borderColor }}
                                                        >
                                                            ▼
                                                        </button>
                                                        <button
                                                            onClick={() => handleSkillChange(skill, level, 1)}
                                                            className="skill-btn"
                                                            style={{ color: palette.valueColor, borderColor: palette.borderColor }}
                                                        >
                                                            ▲
                                                        </button>

                                                        {/* Resource Tracking Collapsible */}
                                                        {isExpanded && resource ? (
                                                            <div className="skill-resource-track">
                                                                <div className="res-current-control">
                                                                    <button
                                                                        className="tiny-res-btn"
                                                                        onClick={() => handleUpdateResource(skill, resource.current - 1, resource.max)}
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="res-val current">{resource.current}</span>
                                                                    <button
                                                                        className="tiny-res-btn"
                                                                        onClick={() => handleUpdateResource(skill, resource.current + 1, resource.max)}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                                <span className="res-sep">/</span>
                                                                <div className="res-max-control">
                                                                    {canEdit ? (
                                                                        <>
                                                                            <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current, resource.max - 1)}>-</button>
                                                                            <span className="res-val max">{resource.max}</span>
                                                                            <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current, resource.max + 1)}>+</button>
                                                                        </>
                                                                    ) : (
                                                                        <span className="res-val max">{resource.max}</span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    className="close-resource-btn"
                                                                    onClick={() => toggleSkillResource(skill)}
                                                                    title="Fechar"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="add-resource-btn"
                                                                title={resource ? "Abrir Recurso" : "Adicionar Recurso"}
                                                                onClick={() => toggleSkillResource(skill)}
                                                                style={{ color: palette.valueColor, borderColor: palette.borderColor }}
                                                            >
                                                                +
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span
                                                            className="skill-value"
                                                            style={{ color: palette.valueColor }}
                                                        >
                                                            {displayedValue}
                                                        </span>
                                                        {debuff > 0 && <span className="skill-debuff">(-{debuff})</span>}

                                                        {/* Resource UI for Non-Editors (e.g. Players viewing their locked sheet?) */}
                                                        {/* We duplicate the logic here but Max is always read-only unless GM (which would be covered by first block usually, but let's be safe) */}

                                                        {isExpanded && resource ? (
                                                            <div className="skill-resource-track">
                                                                <div className="res-current-control">
                                                                    <button
                                                                        className="tiny-res-btn"
                                                                        onClick={() => handleUpdateResource(skill, resource.current - 1, resource.max)}
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="res-val current">{resource.current}</span>
                                                                    <button
                                                                        className="tiny-res-btn"
                                                                        onClick={() => handleUpdateResource(skill, resource.current + 1, resource.max)}
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                                <span className="res-sep">/</span>
                                                                <div className="res-max-control">
                                                                    {canEdit ? (
                                                                        <>
                                                                            <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current, resource.max - 1)}>-</button>
                                                                            <span className="res-val max">{resource.max}</span>
                                                                            <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current, resource.max + 1)}>+</button>
                                                                        </>
                                                                    ) : (
                                                                        <span className="res-val max">{resource.max}</span>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    className="close-resource-btn"
                                                                    onClick={() => toggleSkillResource(skill)}
                                                                    title="Fechar"
                                                                >
                                                                    ✕
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="add-resource-btn"
                                                                title={resource ? "Abrir Recurso" : "Adicionar Recurso"}
                                                                onClick={() => toggleSkillResource(skill)}
                                                                style={{ color: palette.valueColor, borderColor: palette.borderColor }}
                                                            >
                                                                +
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                            </div>
                        </div>
    );
}
