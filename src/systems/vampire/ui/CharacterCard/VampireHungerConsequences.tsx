"use client";

import { createPortal } from "react-dom";
import { ConsequenceModal } from "@/components/ConsequenceModal";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { useState } from "react";
import type { VampireSystemData, ConsequenceData } from "../../types";
import { VAMPIRE_SKILLS } from "../../utils";

interface Props {
  characterId: string;
  sessionId: string;
  actorUserId: string;
  data: VampireSystemData;
  isGM: boolean;
}

const DEFAULT_HUNGER_SLOTS = ["fome_mild", "fome_moderate", "fome_severe"];

function slotLabel(slot: string) {
  if (slot.includes("mild")) return { label: "LEVE", penalty: -2 };
  if (slot.includes("moderate")) return { label: "MODERADA", penalty: -4 };
  if (slot.includes("severe")) return { label: "GRAVE", penalty: -6 };
  if (slot.includes("extreme")) return { label: "EXTREMA", penalty: -8 };
  return { label: "EXTRA", penalty: 0 };
}

export function VampireHungerConsequences({ characterId, sessionId, actorUserId, data, isGM }: Props) {
  const [modal, setModal] = useState<{ slot: string; current: string; debuffSkill: string; debuffValue: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const removedDefaults = data.removedDefaultHungerSlots ?? [];
  const allKeys = new Set<string>();
  DEFAULT_HUNGER_SLOTS.forEach((s) => { if (!removedDefaults.includes(s)) allKeys.add(s); });
  (data.extraHungerSlots ?? []).forEach((k) => allKeys.add(k));
  Object.keys(data.hungerConsequences ?? {}).forEach((k) => allKeys.add(k));

  const sortedSlots = Array.from(allKeys).map((slot) => ({ slot, ...slotLabel(slot) }))
    .sort((a, b) => {
      if (a.penalty !== b.penalty) return b.penalty - a.penalty;
      const stdA = DEFAULT_HUNGER_SLOTS.includes(a.slot);
      const stdB = DEFAULT_HUNGER_SLOTS.includes(b.slot);
      if (stdA && !stdB) return -1;
      if (!stdA && stdB) return 1;
      return a.slot.localeCompare(b.slot);
    });

  const handleClick = (slot: string) => {
    if (!isGM) return;
    const consData = data.hungerConsequences?.[slot];
    setModal({ slot, current: consData?.text || "", debuffSkill: consData?.debuff?.skill || "", debuffValue: consData?.debuff?.value || 0 });
  };

  const handleSave = (text: string, debuffSkill: string, debuffValue: number) => {
    if (!modal) return;
    const debuff = debuffSkill ? { skill: debuffSkill, value: debuffValue } : undefined;
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "VAMPIRE_HUNGER_CONSEQUENCE_UPDATED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, slot: modal.slot, value: text, debuff },
    } as any);
    setModal(null);
  };

  const handleDelete = (slot: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isGM) return;
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "VAMPIRE_HUNGER_CONSEQUENCE_DELETED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, slot },
    } as any);
  };

  const handleAdd = (type: "mild" | "moderate" | "severe") => {
    const uniqueId = `fome_${type}_${uuidv4().slice(0, 8)}`;
    setShowAddModal(false);
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "VAMPIRE_HUNGER_CONSEQUENCE_SLOT_ADDED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, slot: uniqueId },
    } as any);
  };

  return (
    <>
      <div
        style={{
          background: "rgba(120,10,10,0.10)",
          border: "1px solid rgba(192,57,43,0.22)",
          borderRadius: "18px",
          padding: "14px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "10px", marginBottom: "12px", borderBottom: "1px solid rgba(192,57,43,0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              display: "inline-flex", width: "18px", height: "18px", flexShrink: 0,
              backgroundColor: "#c0392b",
              WebkitMaskImage: "url('/interface/sangue.svg')", maskImage: "url('/interface/sangue.svg')",
              WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
              WebkitMaskPosition: "center", maskPosition: "center",
              WebkitMaskSize: "contain", maskSize: "contain",
              filter: "drop-shadow(0 0 5px #c0392b88)",
            }} />
            <span style={{ fontSize: "0.7rem", letterSpacing: "0.22em", color: "rgba(192,57,43,0.88)" }}>FOME</span>
            {isGM && (
              <button onClick={() => setShowAddModal(true)} style={{ marginLeft: "4px", background: "rgba(192,57,43,0.1)", border: "1px solid rgba(192,57,43,0.3)", color: "#c0392b", borderRadius: "6px", padding: "2px 8px", fontSize: "0.8rem", cursor: "pointer" }}>+</button>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gap: "10px" }}>
          {sortedSlots.map(({ slot, label, penalty }) => {
            const consData = data.hungerConsequences?.[slot] as ConsequenceData | undefined;
            const textValue = consData?.text || "";
            const isFilled = textValue.trim().length > 0;
            return (
              <div
                key={slot}
                style={{
                  display: "grid", gridTemplateColumns: "auto 1fr",
                  alignItems: "center", gap: "10px",
                  padding: "10px 12px", borderRadius: "14px",
                  border: "1px solid rgba(192,57,43,0.18)",
                  background: isFilled ? "rgba(192,57,43,0.05)" : "rgba(255,255,255,0.01)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ minWidth: "38px", height: "26px", padding: "0 8px", borderRadius: "999px", display: "inline-flex", alignItems: "center", justifyContent: "center", background: "rgba(192,57,43,0.12)", border: "1px solid rgba(192,57,43,0.25)", color: "#e07070", fontSize: "0.76rem" }}>
                    {penalty}
                  </span>
                  <span style={{ fontSize: "0.72rem", letterSpacing: "0.18em", color: "rgba(192,57,43,0.88)" }}>{label}</span>
                </div>

                {isGM ? (
                  <div style={{ display: "flex", width: "100%", gap: "4px" }}>
                    <button onClick={() => handleClick(slot)} style={{ flex: 1, background: "transparent", border: "none", padding: 0, textAlign: "left", cursor: "pointer" }}>
                      {isFilled ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <span style={{ fontSize: "0.9rem", color: "#efe4c7", wordBreak: "break-word" }}>{textValue.toUpperCase()}</span>
                          {consData?.debuff?.skill && (
                            <span style={{ background: "rgba(255,107,107,0.1)", border: "1px solid rgba(255,107,107,0.22)", color: "#ff9494", padding: "3px 8px", borderRadius: "999px", fontSize: "0.62rem", letterSpacing: "0.08em", alignSelf: "flex-start" }}>
                              {consData.debuff.skill} -{consData.debuff.value}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ display: "block", minHeight: "22px" }} />
                      )}
                    </button>
                    <button onClick={(e) => handleDelete(slot, e)} style={{ width: "28px", height: "28px", borderRadius: "999px", background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.3)", color: "#ff4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
                  </div>
                ) : (
                  <div style={{ minWidth: 0 }}>
                    {isFilled ? (
                      <span style={{ fontSize: "0.9rem", color: "#efe4c7", wordBreak: "break-word" }}>{textValue.toUpperCase()}</span>
                    ) : (
                      <span style={{ display: "block", minHeight: "22px" }} />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {modal && (
        <ConsequenceModal
          isOpen={!!modal}
          initialText={modal.current}
          initialDebuffSkill={modal.debuffSkill}
          initialDebuffValue={modal.debuffValue}
          onSave={handleSave}
          onCancel={() => setModal(null)}
          skills={VAMPIRE_SKILLS}
        />
      )}

      {showAddModal && typeof document !== "undefined" && createPortal(
        <div className="consequence-modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="consequence-modal" onClick={(e) => e.stopPropagation()}>
            <h4 className="modal-title">ADICIONAR FOME</h4>
            <div className="modal-options">
              <button className="modal-option-btn" onClick={() => handleAdd("mild")}><span className="badge badge-mild">-2</span> LEVE</button>
              <button className="modal-option-btn" onClick={() => handleAdd("moderate")}><span className="badge badge-moderate">-4</span> MODERADA</button>
              <button className="modal-option-btn" onClick={() => handleAdd("severe")}><span className="badge badge-severe">-6</span> GRAVE</button>
            </div>
            <button className="modal-close-btn" onClick={() => setShowAddModal(false)}>CANCELAR</button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
