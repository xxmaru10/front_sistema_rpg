"use client";

import { useState } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { VAMPIRE_SKILLS } from "../../utils";
import { getSkillPalette } from "@/components/CharacterCard/skillPalette";

interface VampireSkillsSectionProps {
  skills: Record<string, number>;
  skillResources?: Record<string, { current: number; max: number }>;
  consequences: Record<string, { text?: string; debuff?: { skill: string; value: number } } | undefined>;
  characterId: string;
  sessionId: string;
  actorUserId: string;
  canEdit: boolean;
}

export function VampireSkillsSection({
  skills,
  skillResources,
  consequences,
  characterId,
  sessionId,
  actorUserId,
  canEdit,
}: VampireSkillsSectionProps) {
  const [expandedSkills, setExpandedSkills] = useState<Set<string>>(new Set());

  const handleSkillChange = (skill: string, currentRank: number, delta: number) => {
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "CHARACTER_SKILL_UPDATED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, skill, rank: currentRank + delta },
    } as any);
  };

  const handleInitResource = (skill: string) => {
    const initialMax = skills[skill] || 0;
    if (initialMax <= 0) return;
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "SKILL_RESOURCE_INIT",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, skill, initialMax: Math.max(1, initialMax) },
    } as any);
  };

  const handleUpdateResource = (skill: string, current: number, max: number) => {
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "SKILL_RESOURCE_UPDATED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, skill, current, max },
    } as any);
  };

  const toggleSkillResource = (skill: string) => {
    setExpandedSkills((prev) => {
      const next = new Set(prev);
      if (next.has(skill)) {
        next.delete(skill);
      } else {
        next.add(skill);
        if (!skillResources?.[skill]) handleInitResource(skill);
      }
      return next;
    });
  };

  const getSkillDebuff = (skillName: string): number => {
    let total = 0;
    for (const cons of Object.values(consequences)) {
      if (cons?.debuff?.skill === skillName && cons.debuff.value) {
        total += cons.debuff.value;
      }
    }
    return total;
  };

  const sorted = [...VAMPIRE_SKILLS]
    .map((skill) => ({ skill, level: skills[skill] || 0 }))
    .sort((a, b) => {
      if (b.level !== a.level) return b.level - a.level;
      return a.skill.localeCompare(b.skill, "pt-BR");
    });

  return (
    <div className="skills-section">
      <h4 className="section-title">✦ PERÍCIAS ✦</h4>
      <div className="skills-grid">
        {sorted.map(({ skill, level }) => {
          const resource = skillResources?.[skill];
          const isExpanded = expandedSkills.has(skill);
          const debuff = getSkillDebuff(skill);
          const isNegative = level < 0;
          const palette = getSkillPalette(level);
          const displayedValue = `${level >= 0 ? "+" : ""}${level}`;

          return (
            <div
              key={skill}
              className={`skill-row ${level > 0 ? "has-points" : ""} level-${level} ${debuff > 0 ? "has-debuff" : ""} ${isNegative ? "is-negative" : ""}`}
              style={{ border: `1px solid ${palette.borderColor}`, background: palette.background, boxShadow: palette.shadow }}
            >
              <span className="skill-name" style={{ color: palette.labelColor }}>
                {skill.toUpperCase()}
              </span>
              {canEdit ? (
                <div className="skill-controls">
                  <span className="skill-value" style={{ color: palette.valueColor }}>{displayedValue}</span>
                  {debuff > 0 && <span className="skill-debuff">(-{debuff})</span>}
                  <button onClick={() => handleSkillChange(skill, level, -1)} className="skill-btn" style={{ color: palette.valueColor, borderColor: palette.borderColor }}>▼</button>
                  <button onClick={() => handleSkillChange(skill, level, 1)} className="skill-btn" style={{ color: palette.valueColor, borderColor: palette.borderColor }}>▲</button>
                  {isExpanded && resource ? (
                    <div className="skill-resource-track">
                      <div className="res-current-control">
                        <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current - 1, resource.max)}>-</button>
                        <span className="res-val current">{resource.current}</span>
                        <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current + 1, resource.max)}>+</button>
                      </div>
                      <span className="res-sep">/</span>
                      <div className="res-max-control">
                        <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current, resource.max - 1)}>-</button>
                        <span className="res-val max">{resource.max}</span>
                        <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current, resource.max + 1)}>+</button>
                      </div>
                      <button className="close-resource-btn" onClick={() => toggleSkillResource(skill)} title="Fechar">✕</button>
                    </div>
                  ) : (
                    <button className="add-resource-btn" title={resource ? "Abrir Recurso" : "Adicionar Recurso"} onClick={() => toggleSkillResource(skill)} style={{ color: palette.valueColor, borderColor: palette.borderColor }}>+</button>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className="skill-value" style={{ color: palette.valueColor }}>{displayedValue}</span>
                  {debuff > 0 && <span className="skill-debuff">(-{debuff})</span>}
                  {isExpanded && resource ? (
                    <div className="skill-resource-track">
                      <div className="res-current-control">
                        <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current - 1, resource.max)}>-</button>
                        <span className="res-val current">{resource.current}</span>
                        <button className="tiny-res-btn" onClick={() => handleUpdateResource(skill, resource.current + 1, resource.max)}>+</button>
                      </div>
                      <span className="res-sep">/</span>
                      <span className="res-val max">{resource.max}</span>
                      <button className="close-resource-btn" onClick={() => toggleSkillResource(skill)} title="Fechar">✕</button>
                    </div>
                  ) : (
                    <button className="add-resource-btn" title={resource ? "Abrir Recurso" : "Adicionar Recurso"} onClick={() => toggleSkillResource(skill)} style={{ color: palette.valueColor, borderColor: palette.borderColor }}>+</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
