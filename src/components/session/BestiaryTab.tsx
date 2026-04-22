"use client";

import { useState } from "react";
import { Character } from "@/types/domain";
import { CharacterCard } from "@/components/CharacterCard";
import { globalEventStore } from "@/lib/eventStore";
import { Skull, Globe, Trash2 } from "lucide-react";

interface BestiaryTabProps {
    bestiaryList: Character[];
    bestiarySearch: string;
    setBestiarySearch: (s: string) => void;
    bestiarySessionOnly: boolean;
    setBestiarySessionOnly: (b: boolean) => void;
    userRole: 'GM' | 'PLAYER';
    sessionId: string;
    actorUserId: string;
    onRegisterThreat: () => void;
    findBestiaryChar: (id: string | null) => Character | null;
    stateCharacters: Record<string, Character>;
    setGlobalBestiaryChars: (chars: Character[]) => void;
    viewingBestiaryCharId: string | null;
    setViewingBestiaryCharId: (id: string | null) => void;
}

export function BestiaryTab({
    bestiaryList,
    bestiarySearch,
    setBestiarySearch,
    bestiarySessionOnly,
    setBestiarySessionOnly,
    userRole,
    sessionId,
    actorUserId,
    onRegisterThreat,
    findBestiaryChar,
    stateCharacters,
    setGlobalBestiaryChars,
    viewingBestiaryCharId,
    setViewingBestiaryCharId,
}: BestiaryTabProps) {
    return (
        <>
            <div className="bestiary-display animate-reveal">
                <div className="display-header">
                    <h2 className="display-title">BESTIÁRIO</h2>
                    <div className="gm-actions-row">
                        {userRole === "GM" && (
                            <button onClick={onRegisterThreat} className="btn btn-primary btn-sm">
                                REGISTRAR AMEAÇA
                            </button>
                        )}
                    </div>
                </div>

                <div className="bestiary-filters">
                    <input
                        type="text"
                        className="bestiary-search"
                        placeholder="Pesquisar por nome..."
                        value={bestiarySearch}
                        onChange={e => setBestiarySearch(e.target.value)}
                    />
                    <label className="bestiary-filter-checkbox">
                        <input
                            type="checkbox"
                            checked={bestiarySessionOnly}
                            onChange={e => setBestiarySessionOnly(e.target.checked)}
                        />
                        <span className="filter-checkbox-indicator"></span>
                        MOSTRAR SOMENTE DESSA MESA
                    </label>
                </div>

                <div className="bestiary-list">
                    {bestiaryList
                        .filter(char => {
                            if (bestiarySearch && !char.name.toLowerCase().includes(bestiarySearch.toLowerCase())) return false;
                            if (bestiarySessionOnly && char.scope === "global") return false;
                            return true;
                        }).length === 0 ? (
                        <div className="empty-state solid ornate-border">
                            <p className="narrative-text">NENHUMA AMEAÇA ENCONTRADA.</p>
                        </div>
                    ) : (
                        <div className="bestiary-entries">
                            {bestiaryList
                                .filter(char => {
                                    if (bestiarySearch && !char.name.toLowerCase().includes(bestiarySearch.toLowerCase())) return false;
                                    if (bestiarySessionOnly && char.scope === "global") return false;
                                    return true;
                                })
                                .map(char => (
                                    <div key={char.id} className="bestiary-entry-row">
                                        <button
                                            className={`bestiary-entry ${viewingBestiaryCharId === char.id ? "active" : ""}`}
                                            onClick={() => setViewingBestiaryCharId(viewingBestiaryCharId === char.id ? null : char.id)}
                                        >
                                            <div className="entry-avatar">
                                                {char.imageUrl ? (
                                                    <img src={char.imageUrl} alt={char.name} />
                                                ) : (
                                                    <div className="avatar-placeholder"><Skull size={24} /></div>
                                                )}
                                            </div>
                                            <div className="entry-info">
                                                <span className="entry-name">{char.name.toUpperCase()}</span>
                                                <span className="entry-meta">
                                                    PD: {char.fatePoints} | Magia: {char.magicLevel}
                                                    {char.scope === "global" && <> | <Globe size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> Geral</>}
                                                </span>
                                            </div>
                                        </button>
                                        {userRole === "GM" && (
                                            <button
                                                className="bestiary-delete-btn"
                                                title="Deletar ameaça"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (!confirm(`Deletar ${char.name}?`)) return;
                                                    await globalEventStore.append({
                                                        id: crypto.randomUUID(),
                                                        sessionId,
                                                        seq: 0,
                                                        type: "CHARACTER_DELETED",
                                                        actorUserId,
                                                        createdAt: new Date().toISOString(),
                                                        visibility: "PUBLIC",
                                                        payload: { characterId: char.id }
                                                    });
                                                    globalEventStore.fetchGlobalBestiary().then(events => {
                                                        const chars: Character[] = events.map(e => e.payload as unknown as Character);
                                                        setGlobalBestiaryChars(chars);
                                                    });
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bestiary character detail modal */}
            {viewingBestiaryCharId && findBestiaryChar(viewingBestiaryCharId) && (
                <div className="modal-overlay" onClick={() => setViewingBestiaryCharId(null)}>
                    <div className="modal-content bestiary-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setViewingBestiaryCharId(null)}>✕</button>
	                        <CharacterCard
	                            character={findBestiaryChar(viewingBestiaryCharId)!}
	                            sessionId={sessionId}
	                            actorUserId={actorUserId}
	                            isGM={userRole === "GM"}
	                            hideInventory={false}
	                        />
                        {userRole === "GM" && (
                            <div className="scope-toggle-container">
                                <button
                                    className="btn btn-scope-toggle"
                                    onClick={async () => {
                                        const char = findBestiaryChar(viewingBestiaryCharId);
                                        if (!char) return;
                                        const newScope = char.scope === "global" ? "session" : "global";
                                        await globalEventStore.append({
                                            id: crypto.randomUUID(),
                                            sessionId,
                                            seq: 0,
                                            type: "CHARACTER_UPDATED",
                                            actorUserId,
                                            createdAt: new Date().toISOString(),
                                            visibility: "PUBLIC",
                                            payload: {
                                                characterId: viewingBestiaryCharId,
                                                changes: { scope: newScope }
                                            }
                                        } as any);
                                        globalEventStore.fetchGlobalBestiary().then(events => {
                                            const chars: Character[] = events.map(e => e.payload as unknown as Character);
                                            setGlobalBestiaryChars(chars);
                                        });
                                        setViewingBestiaryCharId(null);
                                    }}
                                >
                                    {findBestiaryChar(viewingBestiaryCharId)?.scope === "global"
                                        ? "🌐 GERAL → TORNAR LOCAL"
                                        : "📍 LOCAL → TORNAR GERAL"}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
