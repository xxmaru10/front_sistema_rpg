"use client";

import { useState } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import type { VampireSystemData } from "../../types";

interface VampireVitalityProps {
  characterId: string;
  sessionId: string;
  actorUserId: string;
  data: VampireSystemData;
  isGM: boolean;
  canEditStressOrFP: boolean;
}

const TRACKS = [
  {
    key: "physical" as const,
    eventKey: "PHYSICAL",
    label: "FÍSICO",
    symbol: "🥊",
    accent: "#e74c3c",
    border: "rgba(231, 76, 60, 0.22)",
    bg: "linear-gradient(180deg, rgba(231, 76, 60, 0.07), rgba(255, 255, 255, 0.015))",
    activeNode: "linear-gradient(180deg, rgba(235, 80, 65, 0.85), rgba(180, 35, 25, 0.92))",
  },
  {
    key: "mental" as const,
    eventKey: "MENTAL",
    label: "MENTAL",
    symbol: "🧠",
    accent: "#3498db",
    border: "rgba(52, 152, 219, 0.22)",
    bg: "linear-gradient(180deg, rgba(52, 152, 219, 0.07), rgba(255, 255, 255, 0.015))",
    activeNode: "linear-gradient(180deg, rgba(60, 160, 225, 0.85), rgba(25, 90, 160, 0.92))",
  },
  {
    key: "blood" as const,
    eventKey: "BLOOD",
    label: "SANGUE",
    symbol: "🩸",
    accent: "#c0392b",
    border: "rgba(192,57,43,0.22)",
    bg: "linear-gradient(180deg,rgba(192,57,43,0.07),rgba(255,255,255,0.015))",
    activeNode: "linear-gradient(180deg,rgba(220,60,50,0.85),rgba(120,15,10,0.92))",
  },
];

export function VampireVitality({
  characterId,
  sessionId,
  actorUserId,
  data,
  isGM,
  canEditStressOrFP,
}: VampireVitalityProps) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [expandedTrack, setExpandedTrack] = useState<string | null>(null);

  const clampV = (v: number) => Math.max(1, Math.min(1000, Math.trunc(v || 1)));

  const getResolvedValue = (track: "physical" | "mental" | "blood", i: number) => {
    const vals = data.stressValues[track] ?? [];
    return clampV(vals[i] ?? (i + 1));
  };

  const draftKey = (track: string, i: number) => `${track}-${i}`;

  const handleToggle = (track: string, index: number, current: boolean) => {
    if (!canEditStressOrFP) return;
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0,
      type: current ? "STRESS_CLEARED" : "STRESS_MARKED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, track: track.toUpperCase(), boxIndex: index },
    } as any);
  };

  const handleExpand = (trackKey: string, eventKey: string, value: number) => {
    if (!isGM) return;
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "STRESS_TRACK_EXPANDED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, track: eventKey, value: clampV(value) },
    } as any);
  };

  const handleReduce = (eventKey: string) => {
    if (!isGM) return;
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "STRESS_TRACK_REDUCED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, track: eventKey },
    } as any);
  };

  const handleBoxValueUpdate = (track: string, eventKey: string, boxIndex: number, value: number) => {
    if (!isGM) return;
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "STRESS_BOX_VALUE_UPDATED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, track: eventKey, boxIndex, value: clampV(value) },
    } as any);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Fate Points */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.18)", border: "1px solid rgba(var(--accent-rgb),0.12)", borderRadius: "14px", padding: "10px 14px" }}>
        <span style={{ fontSize: "0.7rem", letterSpacing: "0.22em", color: "rgba(var(--accent-rgb),0.88)" }}>PONTOS DE DESTINO</span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {canEditStressOrFP && (
            <button onClick={() => {
              globalEventStore.append({ id: uuidv4(), sessionId, seq: 0, type: "FP_SPENT", actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC", payload: { characterId, amount: 1, reason: "MANUAL" } } as any);
            }} style={{ background: "transparent", border: "none", color: "rgba(var(--accent-rgb),0.7)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 4px" }}>−</button>
          )}
          <span style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--accent-color)", minWidth: "28px", textAlign: "center" }}>{data.fatePoints}</span>
          {canEditStressOrFP && (
            <button onClick={() => {
              globalEventStore.append({ id: uuidv4(), sessionId, seq: 0, type: "FP_GAINED", actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC", payload: { characterId, amount: 1, reason: "MANUAL" } } as any);
            }} style={{ background: "transparent", border: "none", color: "rgba(var(--accent-rgb),0.7)", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 4px" }}>+</button>
          )}
          {isGM && (
            <span style={{ fontSize: "0.62rem", letterSpacing: "0.12em", color: "rgba(var(--accent-rgb),0.55)", marginLeft: "6px" }}>
              RECARGA: {data.refresh}
            </span>
          )}
        </div>
      </div>

      {/* Three stress tracks */}
      {TRACKS.map((t) => {
        const boxes = data.stress[t.key] ?? [];
        const isExpanded = expandedTrack === t.key;
        return (
          <div
            key={t.key}
            style={{
              background: t.bg,
              border: `1px solid ${t.border}`,
              borderRadius: "14px",
              padding: "10px 14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.78rem" }}>{t.symbol}</span>
                <span style={{ fontSize: "0.68rem", letterSpacing: "0.22em", color: t.accent }}>{t.label}</span>
              </div>
              {isGM && (
                <div style={{ display: "flex", gap: "4px" }}>
                  <button
                    onClick={() => setExpandedTrack(isExpanded ? null : t.key)}
                    style={{ background: "transparent", border: `1px solid ${t.border}`, color: t.accent, borderRadius: "6px", padding: "2px 7px", fontSize: "0.7rem", cursor: "pointer" }}
                  >
                    {isExpanded ? "−" : "✎"}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {boxes.map((marked, i) => {
                const val = getResolvedValue(t.key, i);
                return (
                  <button
                    key={i}
                    onClick={() => handleToggle(t.key, i, marked)}
                    disabled={!canEditStressOrFP}
                    style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      border: `2px solid ${t.accent}`,
                      background: marked ? t.activeNode : "rgba(0,0,0,0.4)",
                      color: marked ? "#fff" : t.accent,
                      fontSize: "0.75rem", fontWeight: 700,
                      cursor: canEditStressOrFP ? "pointer" : "default",
                      transition: "all 0.18s",
                    }}
                  >
                    {val}
                  </button>
                );
              })}
            </div>

            {isExpanded && isGM && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {boxes.map((_, i) => {
                    const val = getResolvedValue(t.key, i);
                    const dk = draftKey(t.key, i);
                    return (
                      <input
                        key={i}
                        type="number"
                        min={1} max={1000}
                        value={draftValues[dk] ?? String(val)}
                        onChange={(e) => setDraftValues((prev) => ({ ...prev, [dk]: e.target.value }))}
                        onBlur={(e) => {
                          const parsed = parseInt(e.target.value, 10);
                          if (!isNaN(parsed)) handleBoxValueUpdate(t.key, t.eventKey, i, parsed);
                          setDraftValues((prev) => { const n = { ...prev }; delete n[dk]; return n; });
                        }}
                        style={{ width: "40px", height: "28px", textAlign: "center", background: "rgba(0,0,0,0.4)", border: `1px solid ${t.border}`, color: t.accent, borderRadius: "6px", fontSize: "0.8rem" }}
                      />
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => handleReduce(t.eventKey)}
                    disabled={boxes.length === 0}
                    style={{ padding: "4px 10px", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.3)", color: "#ff8080", borderRadius: "6px", fontSize: "0.7rem", cursor: "pointer" }}
                  >
                    − REMOVER
                  </button>
                  <button
                    onClick={() => handleExpand(t.key, t.eventKey, 1)}
                    style={{ padding: "4px 10px", background: `rgba(${t.key === "blood" ? "192,57,43" : "var(--accent-rgb)"},0.08)`, border: `1px solid ${t.border}`, color: t.accent, borderRadius: "6px", fontSize: "0.7rem", cursor: "pointer" }}
                  >
                    + ADICIONAR
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
