"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Character, SessionState } from "@/types/domain";
import { CharacterCard } from "@/components/CharacterCard";
import { CharacterSummary } from "@/components/CharacterSummary";
import { globalEventStore } from "@/lib/eventStore";
import { MentionNavigationRequest } from "@/lib/mentionNavigation";

interface CharactersTabProps {
    displayedCharacters: Character[];
    characterList: Character[];
    userRole: 'GM' | 'PLAYER';
    sessionId: string;
    actorUserId: string;
    fixedCharacterId?: string;
    mentionEntities: any[];
    onNewCharacter: () => void;
    bestiaryList: Character[];
    stateCharacters: Record<string, Character>;
    sessionState: SessionState;
    onMentionNavigate?: (request: MentionNavigationRequest) => void;
}

export function CharactersTab({
    displayedCharacters,
    characterList,
    userRole,
    sessionId,
    actorUserId,
    fixedCharacterId,
    mentionEntities,
    onNewCharacter,
    bestiaryList,
    stateCharacters,
    sessionState,
    onMentionNavigate,
}: CharactersTabProps) {
    const [viewingCharacterId, setViewingCharacterId] = useState<string | null>(null);
    const [showBestiaryImport, setShowBestiaryImport] = useState(false);
    const [selectedBestiaryIds, setSelectedBestiaryIds] = useState<string[]>([]);
    const playerCharacters = useMemo(
        () => displayedCharacters.filter(c => !c.isNPC),
        [displayedCharacters]
    );
    const npcCharacters = useMemo(
        () => displayedCharacters.filter(c => c.isNPC),
        [displayedCharacters]
    );
    const normalizedActorUserId = useMemo(
        () => actorUserId.trim().toLowerCase(),
        [actorUserId]
    );
    const visiblePlayerCharacters = useMemo(() => {
        if (userRole === "GM") return playerCharacters;

        if (fixedCharacterId) {
            const linkedCharacter = playerCharacters.find((char) => char.id === fixedCharacterId);
            return linkedCharacter ? [linkedCharacter] : [];
        }

        if (!normalizedActorUserId) return [];

        const ownedCharacter = playerCharacters.find(
            (char) => (char.ownerUserId || "").trim().toLowerCase() === normalizedActorUserId
        );
        return ownedCharacter ? [ownedCharacter] : [];
    }, [fixedCharacterId, normalizedActorUserId, playerCharacters, userRole]);
    const viewingCharacter = useMemo(
        () => (viewingCharacterId ? characterList.find(c => c.id === viewingCharacterId) ?? null : null),
        [characterList, viewingCharacterId]
    );
    const handleViewCharacter = useCallback((characterId: string) => {
        setViewingCharacterId(characterId);
    }, []);

    return (
        <>
            <div className="characters-display animate-reveal">
                <div className="display-header">
                    <h2 className="display-title">PERSONAGENS</h2>
                    <div className="gm-actions-row">
                        {userRole === "GM" && (
                            <>
                                <button onClick={onNewCharacter} className="btn btn-primary btn-sm">
                                    NOVO PERSONAGEM
                                </button>
                                <button onClick={() => setShowBestiaryImport(true)} className="btn btn-secondary btn-sm" style={{ marginLeft: '8px' }}>
                                    IMPORTAR DO BESTIÁRIO
                                </button>
                            </>
                        )}
                    </div>
                </div>
                <div className="entities-columns">
                    {displayedCharacters.length === 0 ? (
                        <div className="empty-state solid ornate-border">
                            <p className="narrative-text">NENHUM PERSONAGEM ENCONTRADO NESTA SESSÃO.</p>
                        </div>
                    ) : (
                        <div className="entities-scroll">
                            {userRole === "GM" ? (
                                <div className="gm-character-list">
                                    {playerCharacters.length > 0 && (
                                        <div className="entity-group">
                                            <h3 className="group-title">PERSONAGENS JOGADORES</h3>
                                            <div className="cards-grid compact-grid">
                                                {playerCharacters.map(char => (
                                                    <CharacterSummary
                                                        key={char.id}
                                                        character={char}
                                                        onClick={handleViewCharacter}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {npcCharacters.length > 0 && (
                                        <div className="entity-group mt-8">
                                            <h3 className="group-title threats">NPCs / INIMIGOS</h3>
                                            <div className="cards-grid compact-grid">
                                                {npcCharacters.map(char => (
                                                    <CharacterSummary
                                                        key={char.id}
                                                        character={char}
                                                        onClick={handleViewCharacter}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    {playerCharacters.length > 0 && (
                                        <div className="entity-group">
                                            {visiblePlayerCharacters.length > 0 ? (
                                                <div className="cards-grid">
                                                    {visiblePlayerCharacters.map(char => (
                                                        <CharacterCard
                                                            key={char.id}
                                                            character={char}
                                                            sessionId={sessionId}
                                                            actorUserId={actorUserId}
                                                            isGM={false}
                                                            isLinkedCharacter={fixedCharacterId === char.id}
                                                            mentionEntities={mentionEntities}
                                                            sessionState={sessionState}
                                                            userRole={userRole}
                                                            onMentionNavigate={onMentionNavigate}
                                                        />
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="empty-state solid ornate-border">
                                                    <p className="narrative-text">NENHUMA FICHA VINCULADA AO SEU USUÁRIO.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {npcCharacters.length > 0 && (
                                        <div className="entity-group mt-12">
                                            <h3 className="group-title threats">NPCs / INIMIGOS</h3>
                                            <div className="cards-grid compact-grid">
                                                {npcCharacters.map(char => (
                                                    <CharacterSummary
                                                        key={char.id}
                                                        character={char}
                                                        onClick={handleViewCharacter}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {viewingCharacterId && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setViewingCharacterId(null)}>
                        <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <button
                                className="absolute top-2 right-2 z-50 rounded-full w-8 h-8 flex items-center justify-center transition-all shadow-lg hover:brightness-110"
                                style={{
                                    backgroundColor: 'var(--accent-color)',
                                    color: '#080808',
                                    border: '1px solid var(--accent-color)',
                                    boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.4)'
                                }}
                                onClick={() => setViewingCharacterId(null)}
                                title="Fechar"
                            >
                                ✕
                            </button>
                            <div className="w-full h-full overflow-y-auto pr-1">
                                {viewingCharacter && (
                                    <CharacterCard
                                        character={viewingCharacter}
                                        sessionId={sessionId}
                                        actorUserId={actorUserId}
                                        isGM={userRole === "GM"}
                                        isLinkedCharacter={fixedCharacterId === viewingCharacter.id}
                                        mentionEntities={mentionEntities}
                                        sessionState={sessionState}
                                        userRole={userRole}
                                        onMentionNavigate={onMentionNavigate}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {showBestiaryImport && createPortal(
                <div className="modal-overlay" onClick={() => setShowBestiaryImport(false)}>
                    <div className="modal-content import-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => setShowBestiaryImport(false)}>✕</button>
                        <h2 className="modal-title">IMPORTAR DO BESTIÁRIO</h2>

                        {bestiaryList.length === 0 ? (
                            <p className="empty-text">Nenhuma ameaça cadastrada no Bestiário.</p>
                        ) : (
                            <>
                                <div className="import-dropdown-container">
                                    <select
                                        className="import-dropdown"
                                        value=""
                                        onChange={(e) => {
                                            const charId = e.target.value;
                                            if (charId && !selectedBestiaryIds.includes(charId)) {
                                                setSelectedBestiaryIds(prev => [...prev, charId]);
                                            }
                                        }}
                                    >
                                        <option value="">Selecionar ameaça...</option>
                                        {bestiaryList
                                            .filter(c => !selectedBestiaryIds.includes(c.id))
                                            .map(char => (
                                                <option key={char.id} value={char.id}>
                                                    {char.name.toUpperCase()}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                {selectedBestiaryIds.length > 0 && (
                                    <div className="selected-items">
                                        <span className="selected-label">SELECIONADOS:</span>
                                        <div className="selected-tags">
                                            {selectedBestiaryIds.map(id => {
                                                const char = stateCharacters[id];
                                                if (!char) return null;
                                                return (
                                                    <div key={id} className="selected-tag">
                                                        <span>{char.name.toUpperCase()}</span>
                                                        <button
                                                            className="tag-remove"
                                                            onClick={() => setSelectedBestiaryIds(prev => prev.filter(x => x !== id))}
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                <div className="import-actions">
                                    <button
                                        className="btn btn-primary"
                                        disabled={selectedBestiaryIds.length === 0}
                                        onClick={async () => {
                                            for (const charId of selectedBestiaryIds) {
                                                const original = stateCharacters[charId];
                                                if (!original) continue;

                                                const newId = crypto.randomUUID();
                                                const importedChar = {
                                                    ...original,
                                                    id: newId,
                                                    source: "active" as const,
                                                    activeInArena: false,
                                                    arenaSide: "THREAT"
                                                };

                                                await globalEventStore.append({
                                                    id: crypto.randomUUID(),
                                                    sessionId,
                                                    seq: 0,
                                                    type: "CHARACTER_CREATED",
                                                    actorUserId,
                                                    createdAt: new Date().toISOString(),
                                                    visibility: "PUBLIC",
                                                    payload: importedChar,
                                                } as any);
                                            }
                                            setSelectedBestiaryIds([]);
                                            setShowBestiaryImport(false);
                                        }}
                                    >
                                        IMPORTAR ({selectedBestiaryIds.length})
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
