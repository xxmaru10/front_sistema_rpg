import { X, Eye, EyeOff, Plus, Edit2, Trash2 } from "lucide-react";
import { renderMentions } from "@/lib/mentionUtils";
import { LinkedNotes } from "./LinkedNotes";
import { useState } from "react";
import { createPortal } from "react-dom";

interface ViewWorldEntityModalProps {
    viewingEntityId: string | null;
    viewingEntity: any;
    setViewingEntityId: (id: string | null) => void;
    TYPE_LABELS: Record<string, string>;
    state: any;
    handleDeleteWorldEntity: (id: string) => void;
    handleAddEntityNote: (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, content: string, isPrivate?: boolean) => void;
    handleDeleteEntityNote: (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, noteId: string) => void;
    mentionEntities: any[];
    userRole?: "GM" | "PLAYER";
    sessionId: string;
    userId: string;
    handleUpdateFieldVisibility?: (entityId: string, fieldName: string, isHidden: boolean) => void;
    handleAddDescriptionBlock?: (entityId: string, content: string) => void;
    handleUpdateDescriptionBlock?: (entityId: string, blockId: string, patch: any) => void;
    handleDeleteDescriptionBlock?: (entityId: string, blockId: string) => void;
    handleToggleAllVisibility?: (entityId: string, hideAll: boolean) => void;
}

export function ViewWorldEntityModal({
    viewingEntityId,
    viewingEntity,
    setViewingEntityId,
    TYPE_LABELS,
    state,
    handleDeleteWorldEntity,
    handleAddEntityNote,
    handleDeleteEntityNote,
    mentionEntities,
    userRole,
    userId,
    handleUpdateFieldVisibility,
    handleAddDescriptionBlock,
    handleUpdateDescriptionBlock,
    handleDeleteDescriptionBlock,
    handleToggleAllVisibility
}: ViewWorldEntityModalProps) {
    const [isAddingBlock, setIsAddingBlock] = useState(false);
    const [newBlockContent, setNewBlockContent] = useState("");
    const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
    const [editBlockContent, setEditBlockContent] = useState("");

    if (!viewingEntityId || !viewingEntity) return null;

    const isGM = userRole === "GM";
    const fieldVisibility = viewingEntity.fieldVisibility || {};

    const isFieldVisible = (fieldName: string) => {
        if (isGM) return true;
        return !fieldVisibility[fieldName];
    };

    const toggleVisibility = (fieldName: string) => {
        if (handleUpdateFieldVisibility) {
            handleUpdateFieldVisibility(viewingEntity.id, fieldName, !fieldVisibility[fieldName]);
        }
    };

    const handleSaveBlock = () => {
        if (!newBlockContent.trim() || !handleAddDescriptionBlock) return;
        handleAddDescriptionBlock(viewingEntity.id, newBlockContent);
        setNewBlockContent("");
        setIsAddingBlock(false);
    };

    const handleUpdateBlock = (blockId: string) => {
        if (!editBlockContent.trim() || !handleUpdateDescriptionBlock) return;
        handleUpdateDescriptionBlock(viewingEntity.id, blockId, { content: editBlockContent });
        setEditingBlockId(null);
        setEditBlockContent("");
    };

    const modalContent = (
        <div className="modal-overlay" onClick={() => setViewingEntityId(null)} style={{ zIndex: 100000 }}>
            <div className="modal-content world-entity-detail scrollable animate-fade-in" onClick={e => e.stopPropagation()} style={{ borderTop: `4px solid ${viewingEntity.color}`, maxWidth: '600px', width: '90%', background: '#111', padding: '30px', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}>
                <div className="detail-header" style={{ position: 'relative', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                        <div className="type-badge" style={{ backgroundColor: isFieldVisible('color') ? viewingEntity.color : '#444', padding: '3px 10px', fontSize: '0.65rem', color: isFieldVisible('color') ? '#000' : '#888', fontWeight: 'bold', borderRadius: '2px' }}>
                            {isFieldVisible('type') ? TYPE_LABELS[viewingEntity.type] : "????"}
                        </div>
                        {isGM && (
                            <div style={{ display: 'flex', gap: '5px' }}>
                                <button onClick={() => toggleVisibility('type')} className="visibility-toggle-btn" title={fieldVisibility['type'] ? "Mostrar Tipo" : "Ocultar Tipo"}>
                                    {fieldVisibility['type'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button onClick={() => toggleVisibility('color')} className="visibility-toggle-btn" title={fieldVisibility['color'] ? "Mostrar Cor" : "Ocultar Cor"}>
                                    {fieldVisibility['color'] ? <EyeOff size={14} style={{ color: '#ff4444' }} /> : <Eye size={14} style={{ color: viewingEntity.color }} />}
                                </button>
                                <button
                                    onClick={() => handleToggleAllVisibility?.(viewingEntity.id, !Object.values(fieldVisibility).every(v => v))}
                                    className="visibility-toggle-btn bulk-toggle"
                                    title="Alternar Tudo (Visível/Oculto)"
                                    style={{ marginLeft: '10px', padding: '2px 8px', background: 'rgba(197, 160, 89, 0.2)', borderRadius: '4px' }}
                                >
                                    <Eye size={18} />
                                </button>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <h2 style={{ color: isFieldVisible('color') ? viewingEntity.color : '#666', margin: 0, fontFamily: 'var(--font-header)', fontSize: '2rem' }}>
                            {isFieldVisible('name') ? viewingEntity.name.toUpperCase() : "????"}
                        </h2>
                        {isGM && (
                            <button onClick={() => toggleVisibility('name')} className="visibility-toggle-btn" title={fieldVisibility['name'] ? "Mostrar Nome" : "Ocultar Nome"}>
                                {fieldVisibility['name'] ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        )}
                    </div>
                    <button className="close-btn" onClick={() => setViewingEntityId(null)} style={{ position: 'absolute', top: 0, right: 0, background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={24} /></button>
                </div>

                <div className="detail-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {isFieldVisible('tags') && viewingEntity.tags && viewingEntity.tags.length > 0 && (
                        <div className="tags-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            {viewingEntity.tags.map((tag: string, i: number) => (
                                <span key={i} className="detail-tag" style={{ border: `1px solid ${viewingEntity.color}`, color: viewingEntity.color, padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem' }}>#{tag.toUpperCase()}</span>
                            ))}
                            {isGM && (
                                <button onClick={() => toggleVisibility('tags')} className="visibility-toggle-btn" title={fieldVisibility['tags'] ? "Mostrar Tags" : "Ocultar Tags"}>
                                    {fieldVisibility['tags'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            )}
                        </div>
                    )}

                    <div className="desc-container" style={{ position: 'relative' }}>
                        <div className="detail-description" style={{ color: '#ccc', lineHeight: '1.6', fontSize: '1.05rem', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap', position: 'relative' }}
                            dangerouslySetInnerHTML={{ __html: isFieldVisible('description') ? (viewingEntity.description ? renderMentions(viewingEntity.description) : "Sem descrição disponível.") : "????" }}
                        />
                        {isGM && (
                            <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px' }}>
                                <button onClick={() => toggleVisibility('description')} className="visibility-toggle-btn" title={fieldVisibility['description'] ? "Mostrar Descrição" : "Ocultar Descrição"}>
                                    {fieldVisibility['description'] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        )}
                    </div>

                    {(viewingEntity.descriptionBlocks || []).map((block: any) => {
                        const isBlockVisible = isGM || !block.hidden;
                        if (!isBlockVisible) return null;

                        return (
                            <div key={block.id} className="description-block" style={{ borderLeft: `3px solid ${viewingEntity.color}`, paddingLeft: '15px', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '0 4px 4px 0', position: 'relative' }}>
                                {editingBlockId === block.id ? (
                                    <div className="edit-block-form">
                                        <textarea
                                            value={editBlockContent}
                                            onChange={e => setEditBlockContent(e.target.value)}
                                            style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '10px', minHeight: '80px', borderRadius: '4px', marginBottom: '10px' }}
                                        />
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button onClick={() => handleUpdateBlock(block.id)} className="save-btn" style={{ background: '#c5a059', color: '#000', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>SALVAR</button>
                                            <button onClick={() => setEditingBlockId(null)} className="cancel-btn" style={{ background: '#444', color: '#eee', border: 'none', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}>CANCELAR</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="block-content" style={{ color: '#ccc', fontSize: '1rem', whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: renderMentions(block.content) }} />
                                        {isGM && (
                                            <div className="block-actions" style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '8px' }}>
                                                <button onClick={() => { setEditingBlockId(block.id); setEditBlockContent(block.content); }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }} title="Editar Bloco"><Edit2 size={14} /></button>
                                                <button onClick={() => handleUpdateDescriptionBlock?.(viewingEntity.id, block.id, { hidden: !block.hidden })} style={{ background: 'none', border: 'none', color: block.hidden ? '#c5a059' : '#666', cursor: 'pointer' }} title={block.hidden ? "Mostrar Bloco" : "Ocultar Bloco"}>{block.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                                                <button onClick={() => handleDeleteDescriptionBlock?.(viewingEntity.id, block.id)} style={{ background: 'none', border: 'none', color: '#ff4444', opacity: 0.6, cursor: 'pointer' }} title="Excluir Bloco"><Trash2 size={14} /></button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        );
                    })}

                    {isGM && !isAddingBlock && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0' }}>
                            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(197, 160, 89, 0.2))' }}></div>
                            <button
                                className="add-block-btn"
                                onClick={() => setIsAddingBlock(true)}
                                title="Adicionar Bloco de Descrição"
                                style={{
                                    background: 'rgba(197, 160, 89, 0.05)',
                                    border: '1px solid rgba(197, 160, 89, 0.2)',
                                    color: '#c5a059',
                                    borderRadius: '50%',
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(197, 160, 89, 0.15)';
                                    e.currentTarget.style.transform = 'scale(1.1)';
                                    e.currentTarget.style.borderColor = 'rgba(197, 160, 89, 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(197, 160, 89, 0.05)';
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.borderColor = 'rgba(197, 160, 89, 0.2)';
                                }}
                            >
                                <Plus size={20} />
                            </button>
                            <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, rgba(197, 160, 89, 0.2), transparent)' }}></div>
                        </div>
                    )}

                    {isAddingBlock && (
                        <div className="add-block-form" style={{ background: 'rgba(197, 160, 89, 0.05)', border: '1px dashed #c5a059', padding: '20px', borderRadius: '4px' }}>
                            <textarea
                                placeholder="Escreva o novo bloco de descrição..."
                                value={newBlockContent}
                                onChange={e => setNewBlockContent(e.target.value)}
                                style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '10px', minHeight: '100px', borderRadius: '4px', marginBottom: '10px' }}
                            />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={handleSaveBlock} className="save-btn" style={{ background: '#c5a059', color: '#000', border: 'none', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>ADICIONAR</button>
                                <button onClick={() => setIsAddingBlock(false)} className="cancel-btn" style={{ background: 'none', border: '1px solid #666', color: '#666', padding: '8px 20px', borderRadius: '4px', cursor: 'pointer' }}>CANCELAR</button>
                            </div>
                        </div>
                    )}

                    {viewingEntity.type === "PERSONAGEM" && (
                        <div className="relationships-box" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid #333', padding: '20px', borderRadius: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', position: 'relative' }}>
                            <div className="rel-item" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>FAMÍLIA</label>
                                <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                    {isFieldVisible('family') ? (viewingEntity.familyId ? state.worldEntities?.[viewingEntity.familyId]?.name.toUpperCase() : "NENHUMA") : "????"}
                                </span>
                                {isGM && (
                                    <button onClick={() => toggleVisibility('family')} className="visibility-toggle-btn field-toggle" title={fieldVisibility['family'] ? "Mostrar Família" : "Ocultar Família"}>
                                        {fieldVisibility['family'] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                )}
                            </div>
                            <div className="rel-item" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>FACÇÃO</label>
                                <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                    {isFieldVisible('faction') ? (viewingEntity.factionId ? state.worldEntities?.[viewingEntity.factionId]?.name.toUpperCase() : "NENHUMA") : "????"}
                                </span>
                                {isGM && (
                                    <button onClick={() => toggleVisibility('faction')} className="visibility-toggle-btn field-toggle" title={fieldVisibility['faction'] ? "Mostrar Facção" : "Ocultar Facção"}>
                                        {fieldVisibility['faction'] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                )}
                            </div>
                            <div className="rel-item" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>RAÇA</label>
                                <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                    {isFieldVisible('race') ? (viewingEntity.raceId ? state.worldEntities?.[viewingEntity.raceId]?.name.toUpperCase() : "NENHUMA") : "????"}
                                </span>
                                {isGM && (
                                    <button onClick={() => toggleVisibility('race')} className="visibility-toggle-btn field-toggle" title={fieldVisibility['race'] ? "Mostrar Raça" : "Ocultar Raça"}>
                                        {fieldVisibility['race'] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                )}
                            </div>
                            <div className="rel-item" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>ORIGEM</label>
                                <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                    {isFieldVisible('origin') ? (viewingEntity.originId ? state.worldEntities?.[viewingEntity.originId]?.name.toUpperCase() : "NENHUM") : "????"}
                                </span>
                                {isGM && (
                                    <button onClick={() => toggleVisibility('origin')} className="visibility-toggle-btn field-toggle" title={fieldVisibility['origin'] ? "Mostrar Origem" : "Ocultar Origem"}>
                                        {fieldVisibility['origin'] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                )}
                            </div>
                            <div className="rel-item" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>LOCAL ATUAL</label>
                                <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                    {isFieldVisible('currentLocation') ? (viewingEntity.currentLocationId ? state.worldEntities?.[viewingEntity.currentLocationId]?.name.toUpperCase() : "NENHUM") : "????"}
                                </span>
                                {isGM && (
                                    <button onClick={() => toggleVisibility('currentLocation')} className="visibility-toggle-btn field-toggle" title={fieldVisibility['currentLocation'] ? "Mostrar Local Atual" : "Ocultar Local Atual"}>
                                        {fieldVisibility['currentLocation'] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                )}
                            </div>
                            <div className="rel-item" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>RELIGIÃO</label>
                                <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                    {isFieldVisible('religion') ? (viewingEntity.religionId ? state.worldEntities?.[viewingEntity.religionId]?.name.toUpperCase() : "NENHUMA") : "????"}
                                </span>
                                {isGM && (
                                    <button onClick={() => toggleVisibility('religion')} className="visibility-toggle-btn field-toggle" title={fieldVisibility['religion'] ? "Mostrar Religião" : "Ocultar Religião"}>
                                        {fieldVisibility['religion'] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {["FACAO", "FAMILIA", "BESTIARIO", "LOCALIZACAO"].includes(viewingEntity.type) && (
                        <div className="relationships-box" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid #333', padding: '20px', borderRadius: '4px', marginBottom: '20px', position: 'relative' }}>
                            {isGM && (
                                <button onClick={() => toggleVisibility('location')} className="visibility-toggle-btn" style={{ position: 'absolute', top: '10px', right: '10px' }} title={fieldVisibility['location'] ? "Mostrar Localização" : "Ocultar Localização"}>
                                    {fieldVisibility['location'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            )}
                            <div className="rel-item" style={{ position: 'relative' }}>
                                <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>LOCALIZAÇÃO / BASE</label>
                                <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                    {isFieldVisible('location') ? (viewingEntity.currentLocationId ? state.worldEntities?.[viewingEntity.currentLocationId]?.name.toUpperCase() : "DESCONHECIDA") : "????"}
                                </span>
                            </div>
                            <div className="rel-item" style={{ position: 'relative', marginTop: '10px' }}>
                                <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>RELIGIÃO</label>
                                <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                    {isFieldVisible('religion') ? (viewingEntity.religionId ? state.worldEntities?.[viewingEntity.religionId]?.name.toUpperCase() : "NENHUMA") : "????"}
                                </span>
                                {isGM && (
                                    <button onClick={() => toggleVisibility('religion')} className="visibility-toggle-btn field-toggle" title={fieldVisibility['religion'] ? "Mostrar Religião" : "Ocultar Religião"}>
                                        {fieldVisibility['religion'] ? <EyeOff size={12} /> : <Eye size={12} />}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {(viewingEntity.type === "LOCALIZACAO" || viewingEntity.type === "MAPA" || viewingEntity.imageUrl) && (
                        <div className="detail-location-section">
                            {(viewingEntity.type === "LOCALIZACAO" || viewingEntity.type === "MAPA") && (
                                <div className="location-info-box" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid #333', padding: '20px', borderRadius: '4px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', position: 'relative' }}>
                                    {isGM && (
                                        <button onClick={() => toggleVisibility('location_info')} className="visibility-toggle-btn" style={{ position: 'absolute', top: '10px', right: '10px' }} title={fieldVisibility['location_info'] ? "Mostrar Info de Local" : "Ocultar Info de Local"}>
                                            {fieldVisibility['location_info'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    )}
                                    <div className="rel-item">
                                        <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>TIPO DE LOCAL</label>
                                        <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                            {isFieldVisible('location_info') ? (viewingEntity.locationType || "NÃO DEFINIDO") : "????"}
                                        </span>
                                    </div>
                                    <div className="rel-item">
                                        <label style={{ fontSize: '0.6rem', color: '#666', display: 'block' }}>VINCULADO A</label>
                                        <span style={{ color: isFieldVisible('color') ? 'var(--accent-color)' : '#888', fontFamily: 'var(--font-header)' }}>
                                            {isFieldVisible('location_info') ? (viewingEntity.linkedLocationId ? state.worldEntities?.[viewingEntity.linkedLocationId]?.name.toUpperCase() : "NENHUM") : "????"}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {viewingEntity.imageUrl && (
                                <div className="map-view-box" style={{ width: '100%', border: '1px solid #333', padding: '10px', background: '#000', borderRadius: '4px', position: 'relative' }}>
                                    {isGM && (
                                        <button onClick={() => toggleVisibility('image')} className="visibility-toggle-btn" style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1 }} title={fieldVisibility['image'] ? "Mostrar Imagem" : "Ocultar Imagem"}>
                                            {fieldVisibility['image'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                    )}
                                    <label style={{ fontSize: '0.6rem', color: '#666', display: 'block', marginBottom: '8px' }}>VISUALIZAÇÃO</label>
                                    {isFieldVisible('image') ? (
                                        <img
                                            src={viewingEntity.imageUrl}
                                            style={{ width: '100%', maxHeight: '400px', objectFit: 'contain', cursor: 'zoom-in' }}
                                            onClick={() => window.open(viewingEntity.imageUrl, '_blank')}
                                        />
                                    ) : (
                                        <div style={{ width: '100%', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '2rem' }}>????</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <LinkedNotes
                        notes={viewingEntity.linkedNotes || []}
                        onAddNote={(content: string, isPrivate?: boolean) => handleAddEntityNote('WORLD', viewingEntity.id, content, isPrivate)}
                        onDeleteNote={(noteId: string) => handleDeleteEntityNote('WORLD', viewingEntity.id, noteId)}
                        mentionEntities={mentionEntities}
                        hideTitle={true}
                        userId={userId}
                        userRole={userRole}
                    />
                </div>

                <div className="detail-footer" style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#444', fontSize: '0.65rem' }}>CRIADO EM {new Date(viewingEntity.createdAt).toLocaleDateString()}</span>
                    {isGM && (
                        <button
                            className="delete-btn"
                            onClick={() => { handleDeleteWorldEntity(viewingEntity.id); setViewingEntityId(null); }}
                            style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', color: '#ff4444', padding: '6px 15px', fontSize: '0.7rem', cursor: 'pointer' }}
                        >
                            APAGAR REGISTRO
                        </button>
                    )}
                </div>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `
                .visibility-toggle-btn {
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: color 0.2s;
                }
                .visibility-toggle-btn:hover {
                    color: #c5a059;
                }
                .visibility-toggle-btn svg {
                    opacity: 0.6;
                }
                .visibility-toggle-btn:hover svg {
                    opacity: 1;
                }
                .field-toggle {
                    position: absolute;
                    top: 0;
                    right: 0;
                }
            `}} />
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
}
