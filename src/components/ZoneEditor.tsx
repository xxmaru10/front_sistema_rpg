"use client";

import { useState } from "react";
import { Plus, X, Globe, Link2, ChevronRight } from "lucide-react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Zone } from "@/types/domain";

interface ZoneEditorProps {
    sessionId: string;
    actorUserId: string;
    zones: Zone[];
    onClose: () => void;
}

export function ZoneEditor({ sessionId, actorUserId, zones, onClose }: ZoneEditorProps) {
    const [name, setName] = useState("");
    const [desc, setDesc] = useState("");
    const [linkingFrom, setLinkingFrom] = useState<string | null>(null);

    const handleCreateZone = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "ZONE_CREATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {
                id: uuidv4(),
                name: name.trim(),
                description: desc.trim(),
                sceneId: "scene-1" // Default for MVP
            }
        } as any);
        setName("");
        setDesc("");
    };

    const handleLinkZones = (toId: string) => {
        if (!linkingFrom || linkingFrom === toId) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "ZONE_LINKED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {
                sceneId: "scene-1",
                fromZoneId: linkingFrom,
                toZoneId: toId,
                bidirectional: true
            }
        } as any);
        setLinkingFrom(null);
    };

    return (
        <div className="ritual-overlay">
            <div className="ritual-modal tarot-style animate-reveal">
                <div className="ritual-header">
                    <div className="ritual-id">FERRAMENTA :: CARTÓGRAFO DAS ESFERAS</div>
                    <button onClick={onClose} className="ritual-close"><X size={20} /></button>
                </div>

                <div className="ritual-body">
                    <form onSubmit={handleCreateZone} className="ritual-form">
                        <div className="ritual-field">
                            <label>IDENTIFICADOR DE NOVA ESFERA</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="INSIRA O NOME DA ESFERA..."
                                className="mystic-input input-ritual"
                            />
                        </div>
                        <div className="ritual-field">
                            <label>ANÁLISE DESCRITIVA</label>
                            <input
                                type="text"
                                value={desc}
                                onChange={(e) => setDesc(e.target.value)}
                                placeholder="DESCRIÇÃO DA ESFERA..."
                                className="mystic-input input-ritual"
                            />
                        </div>
                        <button type="submit" className="ritual-submit">
                            MATERIALIZAR NOVA ESFERA
                        </button>
                    </form>

                    <div className="link-engine">
                        <div className="engine-header">
                            <span className="symbol">🜖</span>
                            <span>PROTOCOLOS DE CONEXÃO ASTRAL</span>
                        </div>
                        <p className="engine-hint">SELECIONE A ORIGEM E O DESTINO PARA CRIAR UMA PONTE ASTRAL</p>
                        <div className="nodes-grid">
                            {zones.map(z => (
                                <button
                                    key={z.id}
                                    className={`node-link-item ${linkingFrom === z.id ? "node-active" : ""}`}
                                    onClick={() => linkingFrom ? handleLinkZones(z.id) : setLinkingFrom(z.id)}
                                >
                                    <div className="node-status"></div>
                                    <div className="node-label">
                                        <div className="label-main">{z.name.toUpperCase()}</div>
                                        {linkingFrom === z.id && <div className="label-sub pulse">AGUARDANDO DESTINO...</div>}
                                    </div>
                                    {!linkingFrom && <ChevronRight size={14} className="node-arrow" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <style jsx>{`
                    .ritual-overlay {
                        position: fixed;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(0, 0, 0, 0.9);
                        backdrop-filter: blur(12px);
                        display: flex; align-items: center; justify-content: center;
                        z-index: 1000;
                    }

                    .ritual-modal {
                        width: 100%;
                        max-width: 500px;
                        padding: 2px;
                        background: #080808;
                        border: 1px solid var(--border-color);
                        display: flex;
                        flex-direction: column;
                        max-height: 90vh;
                        overflow-y: auto;
                    }

                    .ritual-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: rgba(197, 160, 89, 0.05);
                        padding: 16px 24px;
                        border-bottom: 1px solid rgba(197, 160, 89, 0.1);
                    }

                    .ritual-id {
                        font-family: var(--font-header);
                        font-size: 0.75rem;
                        letter-spacing: 0.25em;
                        color: var(--accent-color);
                    }

                    .ritual-close {
                        background: transparent;
                        border: none;
                        color: var(--accent-color);
                        cursor: pointer;
                        opacity: 0.6;
                        transition: 0.3s;
                    }
                    .ritual-close:hover { opacity: 1; transform: rotate(90deg); }

                    .ritual-body { padding: 48px; display: flex; flex-direction: column; gap: 40px; }

                    .ritual-form { display: flex; flex-direction: column; gap: 32px; }

                    .ritual-field { display: flex; flex-direction: column; gap: 12px; }

                    .ritual-field label {
                        font-family: var(--font-header);
                        font-size: 0.6rem;
                        letter-spacing: 0.15em;
                        color: var(--accent-color);
                        opacity: 0.7;
                    }

                    .input-ritual {
                        background: rgba(197, 160, 89, 0.02) !important;
                        border: 1px solid rgba(197, 160, 89, 0.1) !important;
                        font-family: var(--font-header) !important;
                        font-size: 0.9rem !important;
                        color: var(--accent-color) !important;
                        padding: 16px 24px !important;
                        transition: all 0.4s;
                    }
                    .input-ritual:focus { border-color: var(--accent-color) !important; box-shadow: 0 0 20px rgba(197, 160, 89, 0.1); }

                    .ritual-submit {
                        height: 54px;
                        background: transparent;
                        border: 1px solid var(--accent-color);
                        font-family: var(--font-header);
                        font-size: 0.85rem;
                        letter-spacing: 0.15em;
                        color: var(--accent-color);
                        cursor: pointer;
                        transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
                    }
                    .ritual-submit:hover { background: var(--accent-color); color: #000; box-shadow: 0 0 25px var(--accent-glow); }

                    .link-engine { display: flex; flex-direction: column; gap: 20px; border-top: 1px solid rgba(197, 160, 89, 0.1); padding-top: 24px; }

                    .engine-header {
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        font-family: var(--font-header);
                        font-size: 0.75rem;
                        letter-spacing: 0.1em;
                        color: var(--accent-color);
                    }

                    .engine-hint { font-family: var(--font-narrative); font-style: italic; font-size: 0.8rem; color: var(--text-secondary); opacity: 0.7; margin-bottom: 4px; }

                    .nodes-grid { display: flex; flex-direction: column; gap: 12px; }

                    .node-link-item {
                        background: rgba(197, 160, 89, 0.02);
                        border: 1px solid rgba(197, 160, 89, 0.05);
                        padding: 16px 24px;
                        display: flex;
                        align-items: center;
                        gap: 20px;
                        cursor: pointer;
                        text-align: left;
                        transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                    }

                    .node-link-item:hover { background: rgba(197, 160, 89, 0.05); border-color: rgba(197, 160, 89, 0.2); }

                    .node-status { width: 8px; height: 8px; border: 1px solid var(--accent-color); border-radius: 50%; opacity: 0.3; }
                    .node-active .node-status { background: var(--accent-color); box-shadow: 0 0 10px var(--accent-glow); opacity: 1; }
                    .node-active { border-color: var(--accent-color); background: rgba(197, 160, 89, 0.05); }

                    .node-label { flex: 1; }
                    .label-main { font-family: var(--font-header); font-size: 1rem; color: var(--accent-color); }
                    .label-sub { font-family: var(--font-header); font-size: 0.65rem; color: var(--accent-color); opacity: 0.8; }

                    .pulse { animation: pulse 2s infinite; }
                    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

                    .node-arrow { opacity: 0.4; color: var(--accent-color); }
                    .symbol { font-size: 1.2rem; }
                `}</style>
            </div>
        </div>
    );
}
