"use client";

import { useState } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import type { Discipline, VampireSystemData } from "../../types";

interface Props {
  characterId: string;
  sessionId: string;
  actorUserId: string;
  disciplines: Discipline[];
  canEdit: boolean;
}

export function VampireDisciplines({ characterId, sessionId, actorUserId, disciplines, canEdit }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [temp, setTemp] = useState<Partial<Discipline> | null>(null);

  const startEdit = (d: Discipline) => {
    setTemp({ ...d });
    setEditingId(d.id);
  };

  const startAdd = () => {
    const id = uuidv4();
    setTemp({ id, name: "", description: "", cost: "" });
    setEditingId("NEW");
  };

  const handleSave = () => {
    if (!temp?.name?.trim()) return;
    const disc: Discipline = {
      id: temp.id ?? uuidv4(),
      name: temp.name ?? "",
      description: temp.description ?? "",
      cost: temp.cost ?? "",
    };
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "VAMPIRE_DISCIPLINE_UPDATED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, discipline: disc },
    } as any);
    setEditingId(null);
    setTemp(null);
  };

  const handleDelete = (disciplineId: string) => {
    globalEventStore.append({
      id: uuidv4(), sessionId, seq: 0, type: "VAMPIRE_DISCIPLINE_DELETED",
      actorUserId, createdAt: new Date().toISOString(), visibility: "PUBLIC",
      payload: { characterId, disciplineId },
    } as any);
    setEditingId(null);
    setTemp(null);
  };

  return (
    <div className="stunts-list-compact">
      {disciplines.map((d) => (
        <div key={d.id} className="stunt-slot filled">
          {editingId === d.id ? (
            <div className="stunt-editable-wrapper">
              <input
                className="stunt-name-input"
                value={temp?.name ?? ""}
                onChange={(e) => setTemp((p) => p ? { ...p, name: e.target.value.toUpperCase() } : null)}
              />
              <div className="stunt-meta-row">
                <span>CUSTO:</span>
                <input
                  className="stunt-cost-input"
                  value={temp?.cost ?? ""}
                  onChange={(e) => setTemp((p) => p ? { ...p, cost: e.target.value } : null)}
                />
              </div>
              <textarea
                className="stunt-effect-textarea"
                value={temp?.description ?? ""}
                onChange={(e) => setTemp((p) => p ? { ...p, description: e.target.value } : null)}
              />
              <div className="stunt-actions-row">
                <button className="stunt-action-btn save" onClick={handleSave}>OK</button>
                <button className="stunt-action-btn delete" onClick={() => handleDelete(d.id)}>🗑</button>
                <button className="stunt-action-btn cancel" onClick={() => setEditingId(null)}>X</button>
              </div>
            </div>
          ) : (
            <div className="stunt-btn-wrapper static">
              <div className="stunt-meta-col">
                <div className="stunt-name">{d.name}</div>
                <div className="stunt-cost">CUSTO: {d.cost}</div>
              </div>
              <div className="stunt-effect-col">{d.description}</div>
              {canEdit && <button className="edit-stunt-trigger" onClick={() => startEdit(d)}>✎</button>}
            </div>
          )}
        </div>
      ))}

      {canEdit && editingId !== "NEW" && (
        <button className="add-stunt-btn" onClick={startAdd}>+ NOVA DISCIPLINA</button>
      )}

      {editingId === "NEW" && (
        <div className="stunt-slot editing-new">
          <input className="stunt-name-input" placeholder="NOME" value={temp?.name ?? ""} onChange={(e) => setTemp((p) => p ? { ...p, name: e.target.value.toUpperCase() } : null)} />
          <input className="stunt-cost-input" placeholder="CUSTO" value={temp?.cost ?? ""} onChange={(e) => setTemp((p) => p ? { ...p, cost: e.target.value } : null)} />
          <textarea className="stunt-effect-textarea" placeholder="DESCRIÇÃO" value={temp?.description ?? ""} onChange={(e) => setTemp((p) => p ? { ...p, description: e.target.value } : null)} />
          <div className="stunt-actions-row">
            <button className="stunt-action-btn save" onClick={handleSave}>SALVAR</button>
            <button className="stunt-action-btn cancel" onClick={() => setEditingId(null)}>CANCELAR</button>
          </div>
        </div>
      )}
    </div>
  );
}
