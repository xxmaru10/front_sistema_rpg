"use client";

import React, { useMemo, useState } from "react";
import { Character } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { ChevronLeft, ChevronDown, Trash2, Star, Target, Dices, Skull } from "lucide-react";
import { ConsequenceModal } from "@/components/ConsequenceModal";
import { CombatCardStyles } from "@/components/CombatCard/CombatCard.styles";
import type { VampireCharacter, VampireSystemData, ConsequenceData } from "../../types";
import { migrateLegacyVampireCharacter } from "../../migrations";
import { toRoman } from "../../utils";

interface Props {
  character: Character;
  sessionId: string;
  actorUserId: string;
  isGM?: boolean;
  onRemove?: () => void;
  isCurrentTurn?: boolean;
  isLinkedCharacter?: boolean;
  onToggleDiceRoller?: () => void;
  displayMode?: "expanded" | "compact" | "strip";
  onToggleExpanded?: () => void;
  isPinned?: boolean;
  avatarSide?: "left" | "right";
  stripRank?: number;
  stripWidthPercent?: number;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}

function isThreat(c: Character) {
  return c.arenaSide === "THREAT" || (c.isNPC && c.arenaSide !== "HERO");
}

const BLOOD_ACCENT = "#c0392b";

export function VampireCombatCard({
  character,
  sessionId,
  actorUserId,
  isGM = false,
  onRemove,
  isCurrentTurn = false,
  isLinkedCharacter = false,
  onToggleDiceRoller,
  displayMode = "expanded",
  onToggleExpanded,
  isPinned = false,
  avatarSide = "left",
  stripRank = 0,
  stripWidthPercent = 100,
}: Props) {
  // Always derive a valid VampireSystemData. If the projected state somehow has
  // a character without systemData, build it on the fly so the card never crashes
  // on `data.stress` / `data.stressValues` access.
  const data: VampireSystemData = useMemo(() => {
    const vc = character as VampireCharacter;
    if (vc.systemData?.generation !== undefined) return vc.systemData;
    return (migrateLegacyVampireCharacter(character) as VampireCharacter).systemData;
  }, [character]);
  const userId = actorUserId.trim().toLowerCase();

  const isOwner = (actorUserId && character.ownerUserId && userId === character.ownerUserId.trim().toLowerCase()) || isLinkedCharacter;
  const canEditSelf = isGM || isOwner;
  const threat = isThreat(character);
  const themeClass = character.isHazard ? "hazard-card" : threat ? "threat-card" : isOwner ? "own-hero-card" : "hero-card";

  const accentColor = threat ? "rgba(255,68,68,0.82)" : "rgba(var(--accent-rgb),0.86)";
  const accentSoftColor = threat ? "rgba(255,68,68,0.42)" : "rgba(var(--accent-rgb),0.46)";

  const focusX = character.arenaPortraitFocus?.x ?? 50;
  const focusY = character.arenaPortraitFocus?.y ?? 30;
  const focusZoom = character.arenaPortraitFocus?.zoom ?? 1;

  const [isAspectsExpanded, setIsAspectsExpanded] = useState(false);
  const [expandedExtra, setExpandedExtra] = useState<"stunts" | "disciplines" | "skills" | null>(null);
  const [consequenceModal, setConsequenceModal] = useState<{ slot: string; isHunger: boolean; current: string; debuffSkill: string; debuffValue: number } | null>(null);
  const [isCollapsed] = useState(false);

  const append = (type: string, payload: Record<string, unknown>) =>
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type, actorUserId: userId,
      createdAt: new Date().toISOString(), visibility: "PUBLIC", payload,
    } as any);

  const handleStressToggle = (track: string, index: number, current: boolean) => {
    if (!canEditSelf) return;
    append(current ? "STRESS_CLEARED" : "STRESS_MARKED", { characterId: character.id, track, boxIndex: index });
  };

  const handleFPChange = (amount: number) => {
    if (!canEditSelf) return;
    append(amount > 0 ? "FP_GAINED" : "FP_SPENT", { characterId: character.id, amount: Math.abs(amount), reason: "MANUAL" });
  };

  const openConsequenceModal = (slot: string, isHunger: boolean, currentValue: string, debuffSkill?: string, debuffValue?: number) => {
    if (!isGM) return;
    setConsequenceModal({ slot, isHunger, current: currentValue, debuffSkill: debuffSkill ?? "", debuffValue: debuffValue ?? 0 });
  };

  const handleSaveConsequence = (text: string, debuffSkill: string, debuffValue: number) => {
    if (!consequenceModal) return;
    const debuff = debuffSkill ? { skill: debuffSkill, value: debuffValue } : undefined;
    const evType = consequenceModal.isHunger ? "VAMPIRE_HUNGER_CONSEQUENCE_UPDATED" : "CHARACTER_CONSEQUENCE_UPDATED";
    append(evType, { characterId: character.id, slot: consequenceModal.slot, value: text, debuff });
    setConsequenceModal(null);
  };

  const handleKill = () => {
    if (!isGM) return;
    const normalSlots = ["mild", "moderate", "severe"];
    const hungerSlots = ["fome_mild", "fome_moderate", "fome_severe"];
    [...normalSlots, ...hungerSlots].forEach((slot) => {
      const isHunger = slot.startsWith("fome_");
      const col = isHunger ? data.hungerConsequences : data.consequences;
      if (!col?.[slot]?.text?.trim()) {
        append(isHunger ? "VAMPIRE_HUNGER_CONSEQUENCE_UPDATED" : "CHARACTER_CONSEQUENCE_UPDATED", {
          characterId: character.id, slot, value: "ELIMINADO",
        });
      }
    });
  };

  const isMirrored = threat;
  const outerSkew = isMirrored ? "skewX(5deg)" : "skewX(-5deg)";
  const imageSkew = isMirrored ? "skewX(-5deg)" : "skewX(5deg)";

  const validAspects = (data.sheetAspects ?? []).map((a, i) => ({ value: a, isTrouble: i === 3 })).filter((a) => a.value?.trim());
  const conceptAspect = validAspects[0] ?? null;
  const otherAspects = validAspects.slice(1);

  const generation = data.generation ?? 13;
  const bloodBoxes = data.stress?.blood ?? [];
  const physicalBoxes = data.stress?.physical ?? [];
  const mentalBoxes = data.stress?.mental ?? [];
  const bloodValues = data.stressValues?.blood ?? [];
  const physicalValues = data.stressValues?.physical ?? [];
  const mentalValues = data.stressValues?.mental ?? [];
  const getVal = (arr: number[], i: number) => Math.max(1, Math.trunc(arr[i] ?? (i + 1)));

  const activeSkills = Object.entries(data.skills ?? {}).filter(([_, v]) => v > 0);
  const disciplines = data.disciplines ?? [];

  const consSlotsNormal = ["mild", "moderate", "severe"];
  const consSlotsHunger = ["fome_mild", "fome_moderate", "fome_severe"];

  const portraitInitials = initials(character.name);

  if (displayMode === "compact") {
    return (
      <>
        <button type="button" className={`combat-avatar-shell ${themeClass} ${avatarSide === "right" ? "side-right" : "side-left"} ${isCurrentTurn ? "active-turn-avatar" : ""}`} onClick={onToggleExpanded} title={`Abrir card de ${character.name}`} aria-label={`Abrir card de ${character.name}`}>
          <span className="combat-avatar-halo" aria-hidden="true" />
          <span className="combat-portrait-avatar">
            {character.imageUrl ? <img src={character.imageUrl} alt="" /> : <span className="combat-portrait-fallback">{portraitInitials}</span>}
          </span>
        </button>
        <CombatCardStyles isGM={isGM} />
      </>
    );
  }

  if (displayMode === "strip") {
    const stage = Math.min(5, Math.max(0, stripRank));
    return (
      <>
        <button type="button" className={`combat-strip-shell strip-stage-${stage} ${themeClass} ${avatarSide === "right" ? "side-right" : "side-left"} ${isCurrentTurn ? "active-turn-avatar" : ""}`} onClick={onToggleExpanded} style={{ "--card-accent": accentColor, "--card-accent-soft": accentSoftColor, "--strip-width": `${Math.max(16, Math.min(100, stripWidthPercent))}%` } as any}>
          <span className="combat-strip-image">
            {character.imageUrl ? <img src={character.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focusX}% ${focusY}%`, opacity: 0.9, transform: `scale(${focusZoom})`, transformOrigin: `${focusX}% ${focusY}%` }} /> : <span className="combat-portrait-fallback">{portraitInitials}</span>}
            <span className="combat-strip-vignette top" aria-hidden="true" />
            <span className="combat-strip-vignette bottom" aria-hidden="true" />
            <span className="combat-strip-vignette side" aria-hidden="true" />
            <span className="combat-strip-vignette slash" aria-hidden="true" />
          </span>
          <span className="combat-strip-name">{character.name.toUpperCase()}</span>
        </button>
        <CombatCardStyles isGM={isGM} />
      </>
    );
  }

  return (
    <div className="combat-card-wrapper" style={{ display: "flex", flexDirection: "column", gap: "1px", marginBottom: "10px", position: "relative", width: "min(100%, 1375px)", "--card-accent": accentColor, "--card-accent-soft": accentSoftColor } as any}>

      {/* External row: name + stress tracks */}
      <div className="combat-external-stress" style={{ marginBottom: "0px", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: isMirrored ? "0 1 auto" : "1 1 220px", marginLeft: isMirrored ? "auto" : 0 }}>
          <h3 className="combat-name" style={{ fontSize: "1.05rem", margin: 0, fontWeight: 900, letterSpacing: "0.05em", textShadow: "2px 2px 4px rgba(0,0,0,0.5)", whiteSpace: "normal", wordBreak: "break-word" }}>
            {character.name.toUpperCase()}
          </h3>
          {/* Generation in Roman */}
          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: BLOOD_ACCENT, background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.3)", borderRadius: "6px", padding: "2px 6px" }}>
            {toRoman(generation)}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: isMirrored ? 0 : "auto", order: isMirrored ? -1 : 0, flexWrap: "wrap" }}>
          {/* Compact stress display — styled like Fate CombatStressTracks */}
          <div style={{
            display: "flex", gap: "16px", alignItems: "center",
            background: "radial-gradient(circle at 22% 34%,rgba(255,255,255,0.09) 0%,transparent 42%),radial-gradient(circle at 78% 68%,rgba(255,255,255,0.06) 0%,transparent 45%),linear-gradient(to right,rgba(0,0,0,0.6) 0%,rgba(0,0,0,0.3) 55%,transparent 100%)",
            backdropFilter: "blur(14px) saturate(1.08)",
            border: "1px solid rgba(var(--accent-rgb),0.52)",
            borderRadius: "8px",
            padding: "6px 14px",
            boxShadow: "0 12px 28px rgba(0,0,0,0.68),inset 0 0 14px rgba(255,255,255,0.04)",
            transform: "translateY(-2px)",
          }}>
            {[
              { boxes: physicalBoxes, vals: physicalValues, track: "PHYSICAL", color: "#e87070", iconUrl: "url('/interface/fisico.png')", accentRgb: "var(--accent-rgb)" },
              { boxes: mentalBoxes, vals: mentalValues, track: "MENTAL", color: "#b59cff", iconUrl: "url('/interface/mental.png')", accentRgb: "var(--accent-rgb)" },
              { boxes: bloodBoxes, vals: bloodValues, track: "BLOOD", color: BLOOD_ACCENT, iconUrl: null, emoji: "🩸" },
            ].map(({ boxes, vals, track, color, iconUrl, emoji }, ti) => (
              <React.Fragment key={track}>
                {ti > 0 && <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {/* Track icon */}
                  {iconUrl ? (
                    <span style={{
                      display: "inline-flex", width: "18px", height: "18px", flexShrink: 0,
                      backgroundColor: color,
                      WebkitMaskImage: iconUrl, maskImage: iconUrl,
                      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
                      WebkitMaskPosition: "center", maskPosition: "center",
                      WebkitMaskSize: "contain", maskSize: "contain",
                      filter: "drop-shadow(0 0 5px currentColor)",
                    }} />
                  ) : (
                    <span style={{ fontSize: "0.75rem", lineHeight: 1 }}>{emoji}</span>
                  )}
                  {/* Stress circles */}
                  <div style={{ display: "flex", gap: "4px", flexWrap: "nowrap" }}>
                    {boxes.map((marked, i) => (
                      <button
                        key={i}
                        onClick={() => handleStressToggle(track, i, marked)}
                        disabled={!canEditSelf}
                        style={{
                          width: "22px", height: "22px", borderRadius: "50%", border: "none",
                          background: marked
                            ? `linear-gradient(145deg,${color}ee,${color}aa)`
                            : "linear-gradient(145deg,rgba(255,255,255,0.14),rgba(255,255,255,0.02))",
                          color: marked ? "#000" : color,
                          fontSize: "0.65rem", fontWeight: 700,
                          cursor: canEditSelf ? "pointer" : "default",
                          boxShadow: marked ? `0 0 8px ${color}88` : "none",
                          transition: "all 0.18s",
                        }}
                      >
                        {getVal(vals, i)}
                      </button>
                    ))}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
          {onToggleDiceRoller && isOwner && !isGM && (
            <button onClick={(e) => { e.stopPropagation(); onToggleDiceRoller(); }} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", color: "#fff", padding: "6px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} className="combat-dice-trigger-outer" title="Abrir dados">
              <Dices size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className={`combat-card animate-reveal expanded-card ${themeClass} ${isCurrentTurn ? "active-turn" : ""}`} style={{ display: "grid", gridTemplateColumns: isMirrored ? "minmax(118px,178px) minmax(220px,1fr) minmax(170px,240px)" : "minmax(170px,240px) minmax(220px,1fr) minmax(118px,178px)", gap: 0, alignItems: "stretch", padding: 0, minHeight: "154px", height: "auto", borderRadius: isMirrored ? "50px 0 0 0" : "0 50px 0 0", position: "relative", border: "none", background: isMirrored ? "linear-gradient(250deg,#000 0%,#000 38%,var(--card-accent-soft) 82%,transparent 100%)" : "linear-gradient(110deg,#000 0%,#000 38%,var(--card-accent-soft) 82%,transparent 100%)", overflow: "visible", transform: outerSkew }}>

        {/* Remove button */}
        {isGM && onRemove && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} style={isMirrored ? { position: "absolute", top: 4, left: 4, color: "#ff8b8b", background: "rgba(90,8,8,0.72)", border: "1px solid rgba(255,68,68,0.65)", borderRadius: "7px", cursor: "pointer", zIndex: 40, width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center" } : { position: "absolute", top: 4, right: 4, color: "rgba(255,255,255,0.2)", background: "transparent", border: "none", cursor: "pointer", zIndex: 40 }}>
            {isMirrored ? <Trash2 size={14} /> : "X"}
          </button>
        )}

        {onToggleExpanded && (
          <button onClick={(e) => { e.stopPropagation(); onToggleExpanded(); }} style={{ position: "absolute", top: 4, ...(isMirrored ? { left: isGM && onRemove ? 34 : 4 } : { right: isGM && onRemove ? 34 : 4 }), color: "rgba(255,255,255,0.55)", background: "transparent", border: "none", cursor: "pointer", zIndex: 40, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 27, height: 27 }} title={isPinned ? "Soltar card" : "Fixar card"}>
            {isPinned ? <ChevronDown size={18} /> : <ChevronLeft size={18} />}
          </button>
        )}

        {/* Portrait column */}
        <div className={`combat-image-column${isMirrored ? " mirrored" : ""}`} style={{ gridColumn: isMirrored ? 3 : 1, gridRow: 1, position: "relative", minHeight: 154, transform: imageSkew, marginLeft: "-24px", marginRight: isMirrored ? "-24px" : 0, overflow: "visible", alignSelf: "stretch", zIndex: 6 }}>
          <div className={`combat-image-frame${isMirrored ? " mirrored" : ""}`} style={{ position: "absolute", inset: 0, backgroundColor: "#000", overflow: "hidden", zIndex: 2 }}>
            {character.imageUrl ? (
              <img src={character.imageUrl} alt="" className={`combat-image-portrait${isMirrored ? " mirrored" : ""}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${focusX}% ${focusY}%`, opacity: 0.92, transform: `${isMirrored ? "skewX(-3deg)" : "skewX(3deg)"} scale(${focusZoom})`, transformOrigin: `${focusX}% ${focusY}%` }} />
            ) : (
              <span className="combat-portrait-fallback" style={{ fontSize: "1.2rem", display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#111" }}>{portraitInitials}</span>
            )}
          </div>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,rgba(0,0,0,0.82) 0%,transparent 28%)", pointerEvents: "none", zIndex: 3 }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top,rgba(0,0,0,0.82) 0%,transparent 28%)", pointerEvents: "none", zIndex: 3 }} />
          <div style={{ position: "absolute", inset: 0, background: isMirrored ? "linear-gradient(to right,rgba(0,0,0,0.65) 0%,transparent 18%)" : "linear-gradient(to left,rgba(0,0,0,0.65) 0%,transparent 18%)", pointerEvents: "none", zIndex: 3 }} />
          {(isGM || isOwner) && (
            <div style={{ position: "absolute", bottom: 8, ...(isMirrored ? { left: 10 } : { right: 10 }), zIndex: 35 }}>
              <div className="combat-fate" style={{ display: "flex", alignItems: "center", gap: "6px", color: "#fff" }}>
                {canEditSelf && <button onClick={(e) => { e.stopPropagation(); handleFPChange(-1); }} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "0.8rem", cursor: "pointer", opacity: 0.6, padding: 0 }}>-</button>}
                <span style={{ fontSize: "1.2rem", fontWeight: 900, textShadow: "0 0 10px rgba(255,255,255,0.5)" }}>{data.fatePoints ?? 0}</span>
                {canEditSelf && <button onClick={(e) => { e.stopPropagation(); handleFPChange(1); }} style={{ background: "transparent", border: "none", color: "#fff", fontSize: "0.8rem", cursor: "pointer", opacity: 0.6, padding: 0 }}>+</button>}
              </div>
            </div>
          )}
        </div>

        {/* Middle column */}
        <div className={`combat-main-column${isMirrored ? " mirrored" : ""}`} style={{ gridColumn: 2, gridRow: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0, padding: "4px 12px", transform: isMirrored ? "skewX(-5deg)" : "skewX(5deg)", overflow: "visible", justifyContent: "flex-start", position: "relative", zIndex: 4 }}>
          {conceptAspect && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.03)", padding: "4px 8px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.1)" }}>
                <span style={{ flex: 1, fontSize: "0.8rem", color: "#ccc", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{conceptAspect.value}</span>
                {otherAspects.length > 0 && (
                  <button onClick={() => setIsAspectsExpanded(!isAspectsExpanded)} style={{ background: "transparent", border: "none", color: "var(--card-accent)", cursor: "pointer", fontSize: "1.2rem", padding: "0 4px", lineHeight: 1 }}>{isAspectsExpanded ? "-" : "+"}</button>
                )}
              </div>
              {isAspectsExpanded && otherAspects.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: 8, paddingLeft: 8, borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
                  {otherAspects.map((asp, idx) => (
                    <div key={idx} style={{ fontSize: "0.75rem", color: asp.isTrouble ? "#ffaaaa" : "#aaa" }}>• {asp.value}</div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {disciplines.length > 0 && (
              <button onClick={() => setExpandedExtra(expandedExtra === "disciplines" ? null : "disciplines")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,0.22)", borderRadius: 4, color: BLOOD_ACCENT, cursor: "pointer", opacity: expandedExtra === "disciplines" ? 1 : 0.65 }} title="Disciplinas">🩸</button>
            )}
            {(data.stunts?.length ?? 0) > 0 && (
              <button onClick={() => setExpandedExtra(expandedExtra === "stunts" ? null : "stunts")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", cursor: "pointer", opacity: expandedExtra === "stunts" ? 1 : 0.6 }} title="Façanhas"><Star size={16} /></button>
            )}
            {activeSkills.length > 0 && (
              <button onClick={() => setExpandedExtra(expandedExtra === "skills" ? null : "skills")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4, color: "#fff", cursor: "pointer", opacity: expandedExtra === "skills" ? 1 : 0.6 }} title="Perícias"><Target size={16} /></button>
            )}
          </div>
          {expandedExtra === "disciplines" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4, padding: 8, background: "rgba(192,57,43,0.05)", borderRadius: 4, border: "1px solid rgba(192,57,43,0.15)" }}>
              {disciplines.map((d) => (
                <div key={d.id} style={{ padding: "4px 6px", fontSize: "0.7rem", color: "#ccc", borderLeft: `2px solid rgba(192,57,43,0.5)` }} title={d.description}>
                  <span style={{ color: "#e07070", fontWeight: "bold" }}>{d.name}</span> <span style={{ color: "#888" }}>[{d.cost}]</span>
                </div>
              ))}
            </div>
          )}
          {expandedExtra === "stunts" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4, padding: 8, background: "rgba(80,166,255,0.05)", borderRadius: 4, border: "1px solid rgba(80,166,255,0.15)" }}>
              {(data.stunts ?? []).map((s) => (
                <div key={s.id} style={{ padding: "4px 6px", fontSize: "0.7rem", color: "#ccc", borderLeft: "2px solid rgba(80,166,255,0.4)" }} title={s.description}>
                  <span style={{ color: "#8bc8ff", fontWeight: "bold" }}>{s.name}</span> <span style={{ color: "#888" }}>[{s.cost}]</span>
                </div>
              ))}
            </div>
          )}
          {expandedExtra === "skills" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginTop: 4, padding: 8, background: "rgba(230,90,90,0.05)", borderRadius: 4, border: "1px solid rgba(230,90,90,0.15)" }}>
              {activeSkills.map(([skill, rank]) => (
                <div key={skill} style={{ display: "flex", justifyContent: "space-between", padding: "2px 6px", fontSize: "0.7rem", color: "#ccc", borderLeft: "2px solid rgba(230,90,90,0.4)" }}>
                  <span>{skill}</span><span style={{ color: "#ffaaaa", fontWeight: "bold" }}>+{rank}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Consequences column: normal + hunger */}
        <div className={`combat-cons-column${isMirrored ? " mirrored" : ""}`} style={{ gridColumn: isMirrored ? 1 : 3, gridRow: 1, display: "flex", flexDirection: "column", minWidth: 0, padding: "3px 8px", borderLeft: isMirrored ? "none" : "1px solid rgba(255,255,255,0.1)", borderRight: isMirrored ? "1px solid rgba(255,255,255,0.1)" : "none", transform: isMirrored ? "skewX(-5deg)" : "skewX(5deg)", position: "relative", zIndex: 5, gap: 6 }}>
          {/* Normal consequences */}
          <div>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.18em", color: "rgba(var(--accent-rgb),0.6)", marginBottom: 4 }}>CONSEQUÊNCIAS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {consSlotsNormal.map((slot) => {
                const cons = data.consequences?.[slot] as ConsequenceData | undefined;
                const isFilled = !!(cons?.text?.trim());
                const penalty = slot === "mild" ? "-2" : slot === "moderate" ? "-4" : "-6";
                return (
                  <div key={slot} className={`combat-consequence-box ${isFilled ? "filled" : "empty"}`} onClick={() => openConsequenceModal(slot, false, cons?.text || "", cons?.debuff?.skill, cons?.debuff?.value)} title={isFilled ? cons!.text.toUpperCase() : `Vazio (${penalty})`}>
                    <span className="cons-content">{isFilled ? cons!.text.toUpperCase() : penalty}</span>
                    {isFilled && cons?.debuff && <span className="cons-debuff-badge">-{cons.debuff.value} {cons.debuff.skill.slice(0, 3).toUpperCase()}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hunger consequences */}
          <div>
            <div style={{ fontSize: "0.58rem", letterSpacing: "0.18em", color: "rgba(192,57,43,0.8)", marginBottom: 4 }}>🩸 FOME</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {consSlotsHunger.map((slot) => {
                const cons = data.hungerConsequences?.[slot] as ConsequenceData | undefined;
                const isFilled = !!(cons?.text?.trim());
                const penalty = slot.includes("mild") ? "-2" : slot.includes("moderate") ? "-4" : "-6";
                return (
                  <div key={slot} className={`combat-consequence-box ${isFilled ? "filled" : "empty"}`} onClick={() => openConsequenceModal(slot, true, cons?.text || "", cons?.debuff?.skill, cons?.debuff?.value)} title={isFilled ? cons!.text.toUpperCase() : `Fome (${penalty})`} style={{ borderColor: "rgba(192,57,43,0.28)" }}>
                    <span className="cons-content">{isFilled ? cons!.text.toUpperCase() : penalty}</span>
                    {isFilled && cons?.debuff && <span className="cons-debuff-badge">-{cons.debuff.value} {cons.debuff.skill.slice(0, 3).toUpperCase()}</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {isGM && (
            <button onClick={(e) => { e.stopPropagation(); handleKill(); }} title="Eliminar personagem" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 4, padding: "6px 10px", background: "rgba(180,0,0,0.08)", border: "1px solid rgba(180,0,0,0.28)", borderRadius: 8, color: "rgba(255,80,80,0.75)", cursor: "pointer", fontSize: "0.66rem", letterSpacing: "0.16em", fontFamily: "var(--font-header)" }}>
              <Skull size={12} /> ELIMINAR
            </button>
          )}
        </div>
      </div>

      {consequenceModal && (
        <ConsequenceModal
          isOpen={!!consequenceModal}
          initialText={consequenceModal.current}
          initialDebuffSkill={consequenceModal.debuffSkill}
          initialDebuffValue={consequenceModal.debuffValue}
          onSave={handleSaveConsequence}
          onCancel={() => setConsequenceModal(null)}
        />
      )}

      <CombatCardStyles isGM={isGM} />
    </div>
  );
}
