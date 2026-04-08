import { Character } from "@/types/domain";
import { InventorySection } from "./InventorySection";
import { usePowerTabs } from "./use-power-tabs";
import { Zap, Briefcase, Wand2 } from "lucide-react";

interface PowerTabsSectionProps {
    character: Character;
    sessionId: string;
    actorUserId: string;
    canEdit: boolean;
    isGM: boolean;
    magicLevel: number;
    onMagicLevelChange: (level: number) => void;
    includeInventory?: boolean;
}


export function PowerTabsSection({
    character,
    sessionId,
    actorUserId,
    canEdit,
    isGM,
    magicLevel,
    onMagicLevelChange,
    includeInventory = true,
}: PowerTabsSectionProps) {

    const hook = usePowerTabs({ character, sessionId, actorUserId });
    const compactHeader = !includeInventory;

    return (
        <div className="power-tabs-container">
            <div
                className={`power-tabs-header ${compactHeader ? "text-mode" : ""}`}
                style={
                    compactHeader
                        ? {
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                          }
                        : undefined
                }
            >
                <button
                    className={`power-tab-btn ${hook.activeTab === 'stunts' ? 'active' : ''}`}
                    onClick={() => hook.setActiveTab('stunts')}
                    title="FAÇANHAS"
                    style={
                        compactHeader
                            ? {
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "10px",
                                  fontSize: "0.72rem",
                                  letterSpacing: "0.18em",
                              }
                            : undefined
                    }
                >
                    <Zap size={18} />
                    {compactHeader && <span>FAÇANHAS</span>}
                </button>
                {includeInventory && (
                    <button
                        className={`power-tab-btn ${hook.activeTab === 'inventory' ? 'active' : ''}`}
                        onClick={() => hook.setActiveTab('inventory')}
                        title="INVENTÁRIO"
                    >
                        <Briefcase size={18} />
                    </button>
                )}
                <button
                    className={`power-tab-btn ${hook.activeTab === 'spells' ? 'active' : ''}`}
                    onClick={() => hook.setActiveTab('spells')}
                    title="MAGIAS"
                    style={
                        compactHeader
                            ? {
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "10px",
                                  fontSize: "0.72rem",
                                  letterSpacing: "0.18em",
                              }
                            : undefined
                    }
                >
                    <Wand2 size={18} />
                    {compactHeader && <span>MAGIAS</span>}
                </button>
            </div>

            <div className="power-tab-content">
                {hook.activeTab === 'stunts' && (
                    <div className="stunts-list-compact">
                        {(character.stunts || []).map(stunt => (
                            <div key={stunt.id} className="stunt-slot filled">
                                {hook.editingStuntId === stunt.id ? (
                                    <div className="stunt-editable-wrapper">
                                        <input 
                                            className="stunt-name-input"
                                            value={hook.tempStunt?.name || ''} 
                                            onChange={e => hook.setTempStunt(p => p ? {...p, name: e.target.value.toUpperCase()} : null)}
                                        />
                                        <div className="stunt-meta-row">
                                            <span>COST:</span>
                                            <input 
                                                className="stunt-cost-input"
                                                type="text"
                                                value={hook.tempStunt?.cost || ''}
                                                onChange={e => hook.setTempStunt(p => p ? {...p, cost: e.target.value} : null)}
                                            />
                                        </div>
                                        <textarea 
                                            className="stunt-effect-textarea"
                                            value={hook.tempStunt?.description || ''}
                                            onChange={e => hook.setTempStunt(p => p ? {...p, description: e.target.value} : null)}
                                        />
                                        <div className="stunt-actions-row">
                                            <button className="stunt-action-btn save" onClick={hook.handleSaveStunt}>OK</button>
                                            <button className="stunt-action-btn delete" onClick={() => hook.handleDeleteStunt(stunt.id)}>🗑</button>
                                            <button className="stunt-action-btn cancel" onClick={() => hook.setEditingStuntId(null)}>X</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="stunt-btn-wrapper static">
                                        <div className="stunt-meta-col">
                                            <div className="stunt-name">{stunt.name}</div>
                                            <div className="stunt-cost">CUSTO: {stunt.cost}</div>
                                        </div>
                                        <div className="stunt-effect-col">{stunt.description}</div>
                                        {canEdit && <button className="edit-stunt-trigger" onClick={() => hook.startEditingStunt(stunt)}>✎</button>}
                                    </div>
                                )}
                            </div>
                        ))}
                        {canEdit && hook.editingStuntId !== 'NEW' && (
                            <button className="add-stunt-btn" onClick={hook.startAddingStunt}>+ NOVA FAÇANHA</button>
                        )}
                        {hook.editingStuntId === 'NEW' && (
                             <div className="stunt-slot editing-new">
                                 <input className="stunt-name-input" placeholder="NOME" value={hook.tempStunt?.name || ''} onChange={e => hook.setTempStunt(p => p ? {...p, name: e.target.value.toUpperCase()} : null)} />
                                 <input className="stunt-cost-input" placeholder="CUSTO" value={hook.tempStunt?.cost || ''} onChange={e => hook.setTempStunt(p => p ? {...p, cost: e.target.value} : null)} />
                                 <textarea className="stunt-effect-textarea" placeholder="DESCRIÇÃO" value={hook.tempStunt?.description || ''} onChange={e => hook.setTempStunt(p => p ? {...p, description: e.target.value} : null)} />
                                 <div className="stunt-actions-row">
                                    <button className="stunt-action-btn save" onClick={hook.handleSaveStunt}>SALVAR</button>
                                    <button className="stunt-action-btn cancel" onClick={() => hook.setEditingStuntId(null)}>CANCELAR</button>
                                 </div>
                             </div>
                        )}
                    </div>
                )}

                {includeInventory && hook.activeTab === 'inventory' && (
                    <InventorySection 
                        character={character}
                        sessionId={sessionId}
                        actorUserId={actorUserId}
                        canEdit={canEdit}
                        isGM={isGM}
                        isFloating={false}
                    />
                )}

                {hook.activeTab === 'spells' && (
                    <div className="spells-list-compact">
                        <div className="magic-reserve-inline">
                            <div className="reserve-label">NÍVEL DE MAGIA</div>
                            <div className="magic-nodes">
                                {[1, 2, 3].map((node) => (
                                    <button
                                        key={node}
                                        className={`magic-node ${magicLevel >= node ? "active" : ""}`}
                                        onClick={() => canEdit && onMagicLevelChange(magicLevel === node ? node - 1 : node)}
                                        disabled={!canEdit}
                                    >
                                        <div className="node-glow" />
                                    </button>
                                ))}
                            </div>
                        </div>


                         {(character.spells || []).map(spell => (
                            <div key={spell.id} className="stunt-slot filled">
                                {hook.editingSpellId === spell.id ? (
                                    <div className="stunt-editable-wrapper">
                                        <input className="stunt-name-input" value={hook.tempSpell?.name || ''} onChange={e => hook.setTempSpell(p => p ? {...p, name: e.target.value.toUpperCase()} : null)} />
                                         <div className="stunt-meta-row">
                                            <span>COST:</span>
                                            <input className="stunt-cost-input" value={hook.tempSpell?.cost || ''} onChange={e => hook.setTempSpell(p => p ? {...p, cost: e.target.value} : null)} />
                                        </div>
                                        <textarea className="stunt-effect-textarea" value={hook.tempSpell?.description || ''} onChange={e => hook.setTempSpell(p => p ? {...p, description: e.target.value} : null)} />
                                        <div className="stunt-actions-row">
                                            <button className="stunt-action-btn save" onClick={hook.handleSaveSpell}>OK</button>
                                            <button className="stunt-action-btn delete" onClick={() => hook.handleDeleteSpell(spell.id)}>🗑</button>
                                            <button className="stunt-action-btn cancel" onClick={() => hook.setEditingSpellId(null)}>X</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="stunt-btn-wrapper static">
                                        <div className="stunt-meta-col">
                                            <div className="stunt-name">{spell.name}</div>
                                            <div className="stunt-cost">CUSTO: {spell.cost}</div>
                                        </div>
                                        <div className="stunt-effect-col">{spell.description}</div>
                                        {canEdit && <button className="edit-stunt-trigger" onClick={() => hook.startEditingSpell(spell)}>✎</button>}
                                    </div>
                                )}
                            </div>
                        ))}
                        {canEdit && hook.editingSpellId !== 'NEW' && (
                            <button className="add-stunt-btn" onClick={hook.startAddingSpell}>+ NOVA MAGIA</button>
                        )}
                        {hook.editingSpellId === 'NEW' && (
                             <div className="stunt-slot editing-new">
                                 <input className="stunt-name-input" placeholder="NOME" value={hook.tempSpell?.name || ''} onChange={e => hook.setTempSpell(p => p ? {...p, name: e.target.value.toUpperCase()} : null)} />
                                 <input className="stunt-cost-input" placeholder="CUSTO" value={hook.tempSpell?.cost || ''} onChange={e => hook.setTempSpell(p => p ? {...p, cost: e.target.value} : null)} />
                                 <textarea className="stunt-effect-textarea" placeholder="DESCRIÇÃO" value={hook.tempSpell?.description || ''} onChange={e => hook.setTempSpell(p => p ? {...p, description: e.target.value} : null)} />
                                 <div className="stunt-actions-row">
                                    <button className="stunt-action-btn save" onClick={hook.handleSaveSpell}>SALVAR</button>
                                    <button className="stunt-action-btn cancel" onClick={() => hook.setEditingSpellId(null)}>CANCELAR</button>
                                 </div>
                             </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
