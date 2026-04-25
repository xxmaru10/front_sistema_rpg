"use client";

import { useState } from "react";
import { Character } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Zap, BookOpen } from "lucide-react";
import type { VampireCharacter, VampireSystemData } from "../../types";
import { toRoman } from "../../utils";
import { VampireVitality } from "./VampireVitality";
import { VampireHungerConsequences } from "./VampireHungerConsequences";
import { VampireDisciplines } from "./VampireDisciplines";
import { CharacterConsequences } from "@/components/CharacterCard/CharacterConsequences";
import { VampireSkillsSection } from "./VampireSkillsSection";
import { ConsequenceModal } from "@/components/ConsequenceModal";

interface VampireCharacterCardProps {
  character: Character;
  sessionId: string;
  actorUserId: string;
  isGM: boolean;
  isOwner: boolean;
  canEdit: boolean;
  canEditStressOrFP: boolean;
}

type Tab = "vitality" | "skills" | "powers" | "notes";

export default function VampireCharacterCard({
  character,
  sessionId,
  actorUserId,
  isGM,
  isOwner,
  canEdit,
  canEditStressOrFP,
}: VampireCharacterCardProps) {
  const vc = character as VampireCharacter;
  const data = vc.systemData as VampireSystemData;
  const userId = actorUserId.trim().toLowerCase();

  const [tab, setTab] = useState<Tab>("vitality");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isEditingGen, setIsEditingGen] = useState(false);
  const [tempGen, setTempGen] = useState("");
  const [editingAspect, setEditingAspect] = useState<number | null>(null);
  const [tempAspect, setTempAspect] = useState("");

  // Consequence modal for normal consequences
  const [consequenceModal, setConsequenceModal] = useState<{
    slot: string; current: string; debuffSkill: string; debuffValue: number;
  } | null>(null);
  const [showAddConsequenceModal, setShowAddConsequenceModal] = useState(false);

  const append = (type: string, payload: Record<string, unknown>) =>
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type, actorUserId: userId,
      createdAt: new Date().toISOString(), visibility: "PUBLIC", payload,
    } as any);

  const handleSaveName = () => {
    if (!tempName.trim()) return;
    append("CHARACTER_NAME_UPDATED", { characterId: character.id, name: tempName.trim() });
    setIsEditingName(false);
  };

  const handleSaveAspect = (index: number) => {
    append("CHARACTER_SHEET_ASPECT_UPDATED", { characterId: character.id, index, value: tempAspect.toUpperCase() });
    setEditingAspect(null);
  };

  const handleSaveGeneration = () => {
    const val = parseInt(tempGen, 10);
    if (!isNaN(val) && val >= 1 && val <= 13) {
      append("VAMPIRE_GENERATION_UPDATED", { characterId: character.id, generation: val });
    }
    setIsEditingGen(false);
  };

  // Normal consequence handlers (delegated to CharacterConsequences)
  const handleConsequenceClick = (slot: string) => {
    const consData = (data.consequences as any)[slot];
    setConsequenceModal({
      slot,
      current: consData?.text || "",
      debuffSkill: consData?.debuff?.skill || "",
      debuffValue: consData?.debuff?.value || 0,
    });
  };

  const handleSaveConsequence = (text: string, debuffSkill: string, debuffValue: number) => {
    if (!consequenceModal) return;
    const debuff = debuffSkill ? { skill: debuffSkill, value: debuffValue } : undefined;
    append("CHARACTER_CONSEQUENCE_UPDATED", { characterId: character.id, slot: consequenceModal.slot, value: text, debuff });
    setConsequenceModal(null);
  };

  const handleDeleteConsequence = (slot: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    append("CHARACTER_CONSEQUENCE_DELETED", { characterId: character.id, slot });
  };

  const handleAddConsequence = (type: "mild" | "moderate" | "severe") => {
    const uniqueId = `${type}_${uuidv4().slice(0, 8)}`;
    setShowAddConsequenceModal(false);
    append("CHARACTER_CONSEQUENCE_SLOT_ADDED", { characterId: character.id, slot: uniqueId });
  };

  const aspects = data.sheetAspects ?? ["", "", "", ""];
  const generation = data.generation ?? 13;

  const tabs: { key: Tab; label: string; icon?: React.ReactNode }[] = [
    { key: "vitality", label: "VITALIDADE" },
    { key: "skills", label: "PERÍCIAS" },
    { key: "powers", label: "FAÇANHAS & DISCIPLINAS", icon: <Zap size={14} /> },
    { key: "notes", label: "NOTAS", icon: <BookOpen size={14} /> },
  ];

  // Build a character proxy to pass to Fate CharacterConsequences (reads legacy fields)
  const charProxy = {
    ...character,
    consequences: data.consequences ?? {},
    removedDefaultSlots: data.removedDefaultSlots ?? [],
    extraConsequenceSlots: data.extraConsequenceSlots ?? [],
  } as any;

  return (
    <div className="character-card-panel" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="character-header" style={{ padding: "12px 16px 0" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
          {isEditingName ? (
            <div style={{ display: "flex", gap: "6px", flex: 1 }}>
              <input
                autoFocus
                className="name-edit-input"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setIsEditingName(false); }}
                style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(var(--accent-rgb),0.4)", color: "#fff", padding: "4px 10px", borderRadius: "6px", fontSize: "1rem" }}
              />
              <button onClick={handleSaveName} style={{ background: "rgba(var(--accent-rgb),0.15)", border: "1px solid rgba(var(--accent-rgb),0.4)", color: "var(--accent-color)", borderRadius: "6px", padding: "4px 10px", cursor: "pointer" }}>OK</button>
              <button onClick={() => setIsEditingName(false)} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#888", borderRadius: "6px", padding: "4px 8px", cursor: "pointer" }}>✕</button>
            </div>
          ) : (
            <h2
              onClick={() => canEdit && (setTempName(character.name), setIsEditingName(true))}
              style={{ margin: 0, fontSize: "1.1rem", fontWeight: 900, letterSpacing: "0.04em", cursor: canEdit ? "pointer" : "default", color: "#fff" }}
            >
              {character.name.toUpperCase()}
            </h2>
          )}

          {/* Generation badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isEditingGen && isGM ? (
              <input
                autoFocus
                type="number" min={1} max={13}
                value={tempGen}
                onChange={(e) => setTempGen(e.target.value)}
                onBlur={handleSaveGeneration}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveGeneration(); if (e.key === "Escape") setIsEditingGen(false); }}
                style={{ width: "52px", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(192,57,43,0.4)", color: "#c0392b", padding: "2px 6px", borderRadius: "6px", textAlign: "center", fontSize: "0.85rem" }}
              />
            ) : (
              <span
                onClick={() => isGM && (setTempGen(String(generation)), setIsEditingGen(true))}
                title={isGM ? "Editar geração" : `Geração ${generation}`}
                style={{
                  fontSize: "0.78rem", fontWeight: 700,
                  color: "#c0392b",
                  background: "rgba(192,57,43,0.12)",
                  border: "1px solid rgba(192,57,43,0.3)",
                  borderRadius: "6px",
                  padding: "2px 8px",
                  cursor: isGM ? "pointer" : "default",
                  letterSpacing: "0.05em",
                }}
              >
                {toRoman(generation)}
              </span>
            )}
          </div>
        </div>

        {/* Aspects */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px" }}>
          {aspects.map((asp, i) => (
            <div key={i}>
              {editingAspect === i ? (
                <div style={{ display: "flex", gap: "4px" }}>
                  <input
                    autoFocus
                    value={tempAspect}
                    onChange={(e) => setTempAspect(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleSaveAspect(i); if (e.key === "Escape") setEditingAspect(null); }}
                    style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(var(--accent-rgb),0.3)", color: "#fff", padding: "3px 8px", borderRadius: "6px", fontSize: "0.8rem" }}
                  />
                  <button onClick={() => handleSaveAspect(i)} style={{ background: "rgba(var(--accent-rgb),0.15)", border: "1px solid rgba(var(--accent-rgb),0.3)", color: "var(--accent-color)", borderRadius: "6px", padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>OK</button>
                </div>
              ) : (
                <div
                  onClick={() => canEdit && (setTempAspect(asp), setEditingAspect(i))}
                  style={{
                    padding: "3px 8px", borderRadius: "6px",
                    background: asp ? "rgba(255,255,255,0.03)" : "transparent",
                    border: asp ? "1px solid rgba(255,255,255,0.06)" : "1px dashed rgba(255,255,255,0.08)",
                    color: i === 3 ? "#e07070" : "#bbb",
                    fontSize: "0.78rem", fontStyle: asp ? "italic" : "normal",
                    cursor: canEdit ? "pointer" : "default",
                    minHeight: "24px",
                  }}
                >
                  {asp || (canEdit ? <span style={{ opacity: 0.3 }}>Aspecto {i + 1}{i === 3 ? " (Problema)" : ""}…</span> : "")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 16px", gap: "4px", flexShrink: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              background: "transparent", border: "none",
              borderBottom: tab === t.key ? "2px solid var(--accent-color)" : "2px solid transparent",
              color: tab === t.key ? "var(--accent-color)" : "rgba(255,255,255,0.45)",
              padding: "8px 10px", cursor: "pointer", fontSize: "0.62rem",
              letterSpacing: "0.15em", transition: "all 0.15s",
              display: "flex", alignItems: "center", gap: "4px",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        {tab === "vitality" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <VampireVitality
              characterId={character.id}
              sessionId={sessionId}
              actorUserId={userId}
              data={data}
              isGM={isGM}
              canEditStressOrFP={canEditStressOrFP}
            />

            {/* Two consequence columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <CharacterConsequences
                character={charProxy}
                isGM={isGM}
                canEditConsequences={canEdit}
                consequenceModal={consequenceModal}
                showAddConsequenceModal={showAddConsequenceModal}
                onConsequenceClick={handleConsequenceClick}
                onSaveConsequence={handleSaveConsequence}
                onCancelConsequenceModal={() => setConsequenceModal(null)}
                onDeleteConsequence={handleDeleteConsequence}
                onAddConsequence={handleAddConsequence}
                onOpenAddModal={() => setShowAddConsequenceModal(true)}
                onCloseAddModal={() => setShowAddConsequenceModal(false)}
              />
              <VampireHungerConsequences
                characterId={character.id}
                sessionId={sessionId}
                actorUserId={userId}
                data={data}
                isGM={isGM}
              />
            </div>
          </div>
        )}

        {tab === "skills" && (
          <VampireSkillsSection
            skills={data.skills ?? {}}
            skillResources={(character as any).skillResources}
            consequences={data.consequences ?? {}}
            characterId={character.id}
            sessionId={sessionId}
            actorUserId={userId}
            canEdit={canEdit}
          />
        )}

        {tab === "powers" && (
          <div className="power-tabs-container" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Stunts section */}
            <div>
              <h4 className="section-title" style={{ fontSize: "0.68rem", letterSpacing: "0.22em", marginBottom: "10px" }}>✦ FAÇANHAS ✦</h4>
              <div className="stunts-list-compact">
                {(data.stunts ?? []).map((stunt) => (
                  <div key={stunt.id} className="stunt-slot filled">
                    <div className="stunt-btn-wrapper static">
                      <div className="stunt-meta-col">
                        <div className="stunt-name">{stunt.name}</div>
                        <div className="stunt-cost">CUSTO: {stunt.cost}</div>
                      </div>
                      <div className="stunt-effect-col">{stunt.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Disciplines section */}
            <div>
              <h4 className="section-title" style={{ fontSize: "0.68rem", letterSpacing: "0.22em", marginBottom: "10px", color: "#c0392b" }}>✦ DISCIPLINAS ✦</h4>
              <VampireDisciplines
                characterId={character.id}
                sessionId={sessionId}
                actorUserId={userId}
                disciplines={data.disciplines ?? []}
                canEdit={canEdit}
              />
            </div>
          </div>
        )}

        {tab === "notes" && (
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: "0.82rem", padding: "16px 0" }}>
            {((character as any).notes ?? []).length === 0 ? (
              <span>Sem anotações.</span>
            ) : (
              ((character as any).notes ?? []).map((n: any) => (
                <div key={n.id} style={{ padding: "8px 12px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "8px", fontSize: "0.8rem", color: "#ccc" }}>
                  <div style={{ fontSize: "0.62rem", color: "#888", marginBottom: "4px" }}>{n.authorName} · {new Date(n.createdAt).toLocaleDateString("pt-BR")}</div>
                  <div>{n.content}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
