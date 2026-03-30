"use client";

import { useState } from "react";
import { Character, Stunt, Spell } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface StuntsSpellsSectionProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    canEdit: boolean;
}

export function StuntsSpellsSection({ character, sessionId, actorUserId, canEdit }: StuntsSpellsSectionProps) {
    const [editingStuntId, setEditingStuntId] = useState<string | null>(null);
    const [tempStunt, setTempStunt] = useState<Stunt | null>(null);
    const [editingSpellId, setEditingSpellId] = useState<string | null>(null);
    const [tempSpell, setTempSpell] = useState<Spell | null>(null);

    const startEditingStunt = (stunt: Stunt) => {
        setEditingStuntId(stunt.id);
        // Ensure cost is treated as string, even if it was number previously
        setTempStunt({ ...stunt, cost: stunt.cost.toString() || "" });
    };

    const startAddingStunt = () => {
        setEditingStuntId("NEW");
        setTempStunt({ id: uuidv4(), name: "", description: "", cost: "1" });
    };

    const cancelEditing = () => {
        setEditingStuntId(null);
        setTempStunt(null);
    };

    const handleSaveStunt = () => {
        if (!tempStunt) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_STUNT_UPDATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, stunt: tempStunt }
        } as any);

        setEditingStuntId(null);
        setTempStunt(null);
    };

    const handleDeleteStunt = (stuntId: string) => {
        if (!confirm("Tem certeza que deseja deletar esta façanha?")) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_STUNT_DELETED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, stuntId }
        } as any);

        setEditingStuntId(null);
        setTempStunt(null);
    };

    const startEditingSpell = (spell: Spell) => {
        setEditingSpellId(spell.id);
        setTempSpell({ ...spell, cost: spell.cost.toString() || "" });
    };

    const startAddingSpell = () => {
        setEditingSpellId("NEW");
        setTempSpell({ id: uuidv4(), name: "", description: "", cost: "1" });
    };

    const cancelSpellEditing = () => {
        setEditingSpellId(null);
        setTempSpell(null);
    };

    const handleSaveSpell = () => {
        if (!tempSpell) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_SPELL_UPDATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, spell: tempSpell }
        } as any);

        setEditingSpellId(null);
        setTempSpell(null);
    };

    const handleDeleteSpell = (spellId: string) => {
        if (!confirm("Tem certeza que deseja deletar esta magia?")) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_SPELL_DELETED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, spellId }
        } as any);

        setEditingSpellId(null);
        setTempSpell(null);
    };

    const handleMagicLevelChange = (delta: number) => {
        const currentLevel = character.magicLevel || 0;
        const newLevel = Math.max(0, Math.min(3, currentLevel + delta));

        if (newLevel === currentLevel) return;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_MAGIC_LEVEL_UPDATED",
            actorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: { characterId: character.id, level: newLevel }
        } as any);
    };

    return (
        <>
            <div className="logic-readout stunts-matrix">
                            <div className="stunts-section">
                                <h4 className="section-title">✦ FAÇANHAS ✦</h4>
                                <div className="stunts-list">
                                    {(character.stunts || []).map((stunt, i) => {
                                        const isEditing = editingStuntId === stunt.id;

                                        return (
                                            <div key={stunt.id} className={`stunt-slot ${isEditing ? 'editing' : 'filled'}`}>
                                                {isEditing ? (
                                                    <div className="stunt-editable-wrapper">
                                                        <div className="stunt-form-header">
                                                            <input
                                                                type="text"
                                                                className="stunt-name-input"
                                                                placeholder="NOME DA FAÇANHA"
                                                                value={tempStunt?.name || ''}
                                                                onChange={(e) => setTempStunt(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)}
                                                            />
                                                            <div className="stunt-cost-row">
                                                                <span>CUSTO:</span>
                                                                <input
                                                                    type="text"
                                                                    className="stunt-cost-input"
                                                                    placeholder="Ex: 1 PD"
                                                                    value={tempStunt?.cost || ''}
                                                                    onChange={(e) => setTempStunt(prev => prev ? { ...prev, cost: e.target.value } : null)}
                                                                />
                                                            </div>
                                                        </div>
                                                        <textarea
                                                            className="stunt-effect-textarea"
                                                            placeholder="Descrição do efeito..."
                                                            value={tempStunt?.description || ''}
                                                            onChange={(e) => setTempStunt(prev => prev ? { ...prev, description: e.target.value } : null)}
                                                        />
                                                        <div className="stunt-actions-row">
                                                            <button
                                                                className="stunt-action-btn save"
                                                                onClick={handleSaveStunt}
                                                            >
                                                                SALVAR
                                                            </button>
                                                            <button
                                                                className="stunt-action-btn cancel"
                                                                onClick={cancelEditing}
                                                            >
                                                                CANCELAR
                                                            </button>
                                                            <button
                                                                className="stunt-action-btn delete"
                                                                onClick={() => handleDeleteStunt(stunt.id)}
                                                            >
                                                                DELETAR
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="stunt-btn-wrapper static">
                                                        <div className="stunt-meta-col">
                                                            <div className="stunt-name">{stunt.name.toUpperCase()}</div>
                                                            <div className="stunt-cost">CUSTO: {stunt.cost}</div>
                                                        </div>
                                                        <div className="stunt-effect-col">
                                                            {stunt.description}
                                                        </div>
                                                        {canEdit && (
                                                            <button
                                                                className="edit-stunt-trigger"
                                                                onClick={() => startEditingStunt(stunt)}
                                                                title="Editar Façanha"
                                                            >
                                                                ✎
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {canEdit && !editingStuntId && (
                                        <button className="add-stunt-btn" onClick={startAddingStunt}>
                                            <span className="plus-icon">+</span>
                                            <span>NOVA FAÇANHA</span>
                                        </button>
                                    )}

                                    {canEdit && editingStuntId === "NEW" && tempStunt && (
                                        <div className="stunt-slot editing">
                                            <div className="stunt-editable-wrapper">
                                                <div className="stunt-form-header">
                                                    <input
                                                        type="text"
                                                        className="stunt-name-input"
                                                        placeholder="NOME DA NOVA FAÇANHA"
                                                        value={tempStunt.name}
                                                        onChange={(e) => setTempStunt(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)}
                                                        autoFocus
                                                    />
                                                    <div className="stunt-cost-row">
                                                        <span>CUSTO:</span>
                                                        <input
                                                            type="text"
                                                            className="stunt-cost-input"
                                                            placeholder="Ex: 1 PD"
                                                            value={tempStunt.cost}
                                                            onChange={(e) => setTempStunt(prev => prev ? { ...prev, cost: e.target.value } : null)}
                                                        />
                                                    </div>
                                                </div>
                                                <textarea
                                                    className="stunt-effect-textarea"
                                                    placeholder="Descreva o efeito..."
                                                    value={tempStunt.description}
                                                    onChange={(e) => setTempStunt(prev => prev ? { ...prev, description: e.target.value } : null)}
                                                />
                                                <div className="stunt-actions-row">
                                                    <button
                                                        className="stunt-action-btn save"
                                                        onClick={handleSaveStunt}
                                                    >
                                                        CONFIRMAR
                                                    </button>
                                                    <button
                                                        className="stunt-action-btn cancel"
                                                        onClick={cancelEditing}
                                                    >
                                                        CANCELAR
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="stunts-section" style={{ marginTop: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <h4 className="section-title" style={{ marginBottom: 0 }}>🔮 MAGIAS</h4>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        display: 'flex',
                                        gap: '2px',
                                        height: '24px',
                                        background: 'rgba(0,0,0,0.3)',
                                        padding: '2px',
                                        border: '1px solid rgba(197, 160, 89, 0.3)',
                                        borderRadius: '4px'
                                    }}>
                                        {[1, 2, 3].map(level => {
                                            const isActive = (character.magicLevel || 0) >= level;
                                            return (
                                                <div
                                                    key={level}
                                                    style={{
                                                        width: '24px',
                                                        height: '100%',
                                                        background: isActive
                                                            ? `linear-gradient(to top, rgba(147, 51, 234, ${0.4 + (level * 0.2)}), rgba(79, 70, 229, ${0.4 + (level * 0.2)}))`
                                                            : 'rgba(255, 255, 255, 0.05)',
                                                        border: isActive ? '1px solid rgba(167, 139, 250, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                                                        transition: 'all 0.3s'
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                    {canEdit && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <button
                                                onClick={() => handleMagicLevelChange(1)}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid rgba(197, 160, 89, 0.3)',
                                                    color: 'var(--accent-color)',
                                                    fontSize: '0.6rem',
                                                    cursor: 'pointer',
                                                    padding: '0 4px',
                                                    lineHeight: 1
                                                }}
                                            >
                                                ▲
                                            </button>
                                            <button
                                                onClick={() => handleMagicLevelChange(-1)}
                                                style={{
                                                    background: 'none',
                                                    border: '1px solid rgba(197, 160, 89, 0.3)',
                                                    color: 'var(--accent-color)',
                                                    fontSize: '0.6rem',
                                                    cursor: 'pointer',
                                                    padding: '0 4px',
                                                    lineHeight: 1
                                                }}
                                            >
                                                ▼
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="stunts-list">
                                {(character.spells || []).map(spell => {
                                    if (editingSpellId === spell.id && tempSpell) {
                                        return (
                                            <div key={spell.id} className="stunt-slot editing">
                                                <div className="stunt-editable-wrapper">
                                                    <div className="stunt-form-header">
                                                        <input
                                                            type="text"
                                                            className="stunt-name-input"
                                                            value={tempSpell.name}
                                                            onChange={(e) => setTempSpell(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)}
                                                            autoFocus
                                                        />
                                                        <div className="stunt-cost-row">
                                                            <span>CUSTO:</span>
                                                            <input
                                                                type="text"
                                                                className="stunt-cost-input"
                                                                value={tempSpell.cost}
                                                                onChange={(e) => setTempSpell(prev => prev ? { ...prev, cost: e.target.value } : null)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <textarea
                                                        className="stunt-effect-textarea"
                                                        value={tempSpell.description}
                                                        onChange={(e) => setTempSpell(prev => prev ? { ...prev, description: e.target.value } : null)}
                                                    />
                                                    <div className="stunt-actions-row">
                                                        <button className="stunt-action-btn save" onClick={handleSaveSpell}>
                                                            CONFIRMAR
                                                        </button>
                                                        <button className="stunt-action-btn cancel" onClick={cancelSpellEditing}>
                                                            CANCELAR
                                                        </button>
                                                        <button
                                                            className="stunt-action-btn delete"
                                                            onClick={() => handleDeleteSpell(spell.id)}
                                                            style={{ marginLeft: 'auto', borderColor: '#f44', color: '#f44' }}
                                                        >
                                                            EXCLUIR
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div key={spell.id} className="stunt-slot filled">
                                            <div className="stunt-btn-wrapper static">
                                                <div className="stunt-meta-col">
                                                    <div className="stunt-name">{spell.name.toUpperCase()}</div>
                                                    <div className="stunt-cost">CUSTO: {spell.cost}</div>
                                                </div>
                                                <div className="stunt-effect-col">
                                                    {spell.description}
                                                </div>
                                                {canEdit && (
                                                    <button
                                                        className="edit-stunt-trigger"
                                                        onClick={() => startEditingSpell(spell)}
                                                        title="Editar Magia"
                                                    >
                                                        ✎
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {canEdit && !editingSpellId && (
                                    <button className="add-stunt-btn" onClick={startAddingSpell}>
                                        <span className="plus-icon">+</span>
                                        <span>NOVA MAGIA</span>
                                    </button>
                                )}

                                {canEdit && editingSpellId === "NEW" && tempSpell && (
                                    <div className="stunt-slot editing">
                                        <div className="stunt-editable-wrapper">
                                            <div className="stunt-form-header">
                                                <input
                                                    type="text"
                                                    className="stunt-name-input"
                                                    placeholder="NOME DA NOVA MAGIA"
                                                    value={tempSpell.name}
                                                    onChange={(e) => setTempSpell(prev => prev ? { ...prev, name: e.target.value.toUpperCase() } : null)}
                                                    autoFocus
                                                />
                                                <div className="stunt-cost-row">
                                                    <span>CUSTO:</span>
                                                    <input
                                                        type="text"
                                                        className="stunt-cost-input"
                                                        placeholder="Ex: 1 PM"
                                                        value={tempSpell.cost}
                                                        onChange={(e) => setTempSpell(prev => prev ? { ...prev, cost: e.target.value } : null)}
                                                    />
                                                </div>
                                            </div>
                                            <textarea
                                                className="stunt-effect-textarea"
                                                placeholder="Descreva o efeito..."
                                                value={tempSpell.description}
                                                onChange={(e) => setTempSpell(prev => prev ? { ...prev, description: e.target.value } : null)}
                                            />
                                            <div className="stunt-actions-row">
                                                <button
                                                    className="stunt-action-btn save"
                                                    onClick={handleSaveSpell}
                                                >
                                                    CONFIRMAR
                                                </button>
                                                <button
                                                    className="stunt-action-btn cancel"
                                                    onClick={cancelSpellEditing}
                                                >
                                                    CANCELAR
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
        </>
    );
}
