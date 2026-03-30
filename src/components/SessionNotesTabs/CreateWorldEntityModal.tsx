import { X, Map as MapIcon } from "lucide-react";
import { MentionEditor } from "../MentionEditor";
import { createPortal } from "react-dom";

interface CreateWorldEntityModalProps {
    setShowAddWorldEntity: (show: boolean) => void;
    newEntityName: string;
    setNewEntityName: (name: string) => void;
    newEntityType: any;
    setNewEntityType: (type: any) => void;
    setImportBestiaryId: (id: string) => void;
    TYPE_LABELS: Record<string, string>;
    newEntityColor: string;
    setNewEntityColor: (color: string) => void;
    LOC_CATEGORIES: Record<string, string[]>;
    locSearch: string;
    setLocSearch: (search: string) => void;
    setNewEntityLocationType: (type: string) => void;
    newEntityLocationType: string;
    newEntityLinkedLocation: string;
    setNewEntityLinkedLocation: (id: string) => void;
    locationsList: any[];
    newEntityImageUrl: string;
    setNewEntityImageUrl: (url: string) => void;
    newEntityProfession: string;
    setNewEntityProfession: (prof: string) => void;
    COLOR_PRESETS: string[];
    importBestiaryId: string;
    bestiaryList: any[];
    newEntityDescription: string;
    setNewEntityDescription: (desc: string) => void;
    newEntityFamily: string;
    setNewEntityFamily: (id: string) => void;
    familiesList: any[];
    newEntityRace: string;
    setNewEntityRace: (id: string) => void;
    racesList: any[];
    newEntityOrigin: string;
    setNewEntityOrigin: (id: string) => void;
    newEntityCurrentLoc: string;
    setNewEntityCurrentLoc: (id: string) => void;
    newEntityTags: string[];
    tagInput: string;
    setTagInput: (input: string) => void;
    handleAddTag: (e: any) => void;
    removeTag: (tag: string) => void;
    handleCreateWorldEntity: () => void;
    editingWorldEntityId: string | null;
    handleCancelWorldEntityEdit: () => void;
    mentionEntities: any[];
}

export function CreateWorldEntityModal({
    setShowAddWorldEntity,
    newEntityName,
    setNewEntityName,
    newEntityType,
    setNewEntityType,
    setImportBestiaryId,
    TYPE_LABELS,
    newEntityColor,
    setNewEntityColor,
    LOC_CATEGORIES,
    locSearch,
    setLocSearch,
    setNewEntityLocationType,
    newEntityLocationType,
    newEntityLinkedLocation,
    setNewEntityLinkedLocation,
    locationsList,
    newEntityImageUrl,
    setNewEntityImageUrl,
    newEntityProfession,
    setNewEntityProfession,
    COLOR_PRESETS,
    importBestiaryId,
    bestiaryList,
    newEntityDescription,
    setNewEntityDescription,
    newEntityFamily,
    setNewEntityFamily,
    familiesList,
    newEntityRace,
    setNewEntityRace,
    racesList,
    newEntityOrigin,
    setNewEntityOrigin,
    newEntityCurrentLoc,
    setNewEntityCurrentLoc,
    newEntityTags,
    tagInput,
    setTagInput,
    handleAddTag,
    removeTag,
    handleCreateWorldEntity,
    editingWorldEntityId,
    handleCancelWorldEntityEdit,
    mentionEntities
}: CreateWorldEntityModalProps) {
    const modalContent = (
        <div className="modal-overlay" onClick={() => setShowAddWorldEntity(false)}>
            <div className="modal-content world-entity-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header-ornate">
                    <h3>{editingWorldEntityId ? "EDITAR ELEMENTO" : "NOVO ELEMENTO DE MUNDO"}</h3>
                    <button className="close-btn" onClick={handleCancelWorldEntityEdit}><X size={18} /></button>
                </div>

                <div className="modal-body scrollbar-arcane">
                    <div className="input-group">
                        <label>NOME</label>
                        <input
                            type="text"
                            value={newEntityName}
                            onChange={e => setNewEntityName(e.target.value)}
                            placeholder="Ex: Reino de Eldoria, Marcus o Bravo..."
                        />
                    </div>

                    <div className="input-row">
                        <div className="input-group flex-1">
                            <label>TIPO</label>
                            <select
                                value={newEntityType}
                                onChange={e => {
                                    setNewEntityType(e.target.value as any);
                                    setImportBestiaryId("");
                                }}
                            >
                                {Object.entries(TYPE_LABELS).map(([val, label]) => (
                                    <option key={val} value={val}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="input-group">
                            <label>COR</label>
                            <div className="color-input-wrapper">
                                <input
                                    type="color"
                                    value={newEntityColor}
                                    onChange={e => setNewEntityColor(e.target.value)}
                                    className="color-wheel"
                                />
                            </div>
                        </div>
                    </div>

                    {(newEntityType === "LOCALIZACAO" || newEntityType === "MAPA") && (
                        <div className="location-extra-fields animate-fade-in" style={{ marginTop: '20px' }}>
                            <div className="input-row" style={{ display: 'flex', gap: '15px' }}>
                                <div className="input-group flex-1" style={{ position: 'relative' }}>
                                    <label>TIPO DE LOCAL</label>
                                    <div className="searchable-themed-select">
                                        <input
                                            type="text"
                                            placeholder="Pesquisar tipo... (ex: Cidade, Floresta)"
                                            value={locSearch}
                                            onChange={e => setLocSearch(e.target.value)}
                                            onFocus={() => { if (!locSearch) setLocSearch(" "); }}
                                            style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px', fontSize: '0.8rem' }}
                                        />
                                        {locSearch && (
                                            <div className="themed-dropdown scrollbar-arcane" style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1a1a1a', border: '1px solid #444', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                                                {Object.entries(LOC_CATEGORIES).map(([category, types]) => {
                                                    const filtered = types.filter(t => t.toLowerCase().includes(locSearch.trim().toLowerCase()));
                                                    if (filtered.length === 0) return null;
                                                    return (
                                                        <div key={category}>
                                                            <div style={{ background: '#333', padding: '4px 8px', fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 'bold' }}>{category.toUpperCase()}</div>
                                                            {filtered.map(t => (
                                                                <div
                                                                    key={t}
                                                                    className="dropdown-opt"
                                                                    onClick={() => { setNewEntityLocationType(t); setLocSearch(""); }}
                                                                    style={{ padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', transition: '0.2s', borderBottom: '1px solid #222' }}
                                                                >
                                                                    {t}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {newEntityLocationType && !locSearch && (
                                            <div style={{ marginTop: '4px', fontSize: '0.7rem', color: 'var(--accent-color)' }}>SELECIONADO: {newEntityLocationType}</div>
                                        )}
                                    </div>
                                </div>
                                <div className="input-group flex-1">
                                    <label>LOCAL VINCULADO</label>
                                    <select value={newEntityLinkedLocation} onChange={e => setNewEntityLinkedLocation(e.target.value)} style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}>
                                        <option value="">NENHUM</option>
                                        {locationsList.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>

                            {newEntityType === "MAPA" && (
                                <div className="input-group" style={{ marginTop: '15px' }}>
                                    <label>IMAGEM DO MAPA (PNG ou JPEG)</label>
                                    <p style={{ fontSize: '0.65rem', color: '#C5A059', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.9 }}>
                                        <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>AVISO:</span> Resolução recomendada: 1280x720 (HD) para melhor performance.
                                    </p>
                                    <input
                                        type="file"
                                        accept=".png, .jpg, .jpeg"
                                        onChange={e => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                const reader = new FileReader();
                                                reader.onloadend = () => {
                                                    setNewEntityImageUrl(reader.result as string);
                                                };
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                        style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}
                                    />
                                    {newEntityImageUrl && (
                                        <div style={{ marginTop: '10px', position: 'relative', width: '200px', height: '120px', border: '1px solid #444', overflow: 'hidden' }}>
                                            <img src={newEntityImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            <button
                                                onClick={() => setNewEntityImageUrl("")}
                                                style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {["PERSONAGEM", "LOCALIZACAO", "RACA", "FAMILIA", "FACAO", "BESTIARIO", "OUTROS"].includes(newEntityType) && (
                        <div className="input-group" style={{ marginTop: '15px' }}>
                            <label>IMAGEM (PNG ou JPEG)</label>
                            <p style={{ fontSize: '0.65rem', color: '#C5A059', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.9 }}>
                                <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>AVISO:</span> Resolução recomendada: 800x800 para melhor performance.
                            </p>
                            <input
                                type="file"
                                accept=".png, .jpg, .jpeg"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => {
                                            const img = new Image();
                                            img.onload = () => {
                                                const canvas = document.createElement('canvas');
                                                let width = img.width;
                                                let height = img.height;
                                                
                                                // Max dimensions
                                                const MAX_WIDTH = 800;
                                                const MAX_HEIGHT = 800;
                                                
                                                if (width > height) {
                                                    if (width > MAX_WIDTH) {
                                                        height = Math.round((height * MAX_WIDTH) / width);
                                                        width = MAX_WIDTH;
                                                    }
                                                } else {
                                                    if (height > MAX_HEIGHT) {
                                                        width = Math.round((width * MAX_HEIGHT) / height);
                                                        height = MAX_HEIGHT;
                                                    }
                                                }
                                                
                                                canvas.width = width;
                                                canvas.height = height;
                                                const ctx = canvas.getContext('2d');
                                                if (ctx) {
                                                    ctx.drawImage(img, 0, 0, width, height);
                                                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
                                                    setNewEntityImageUrl(compressedBase64);
                                                } else {
                                                    setNewEntityImageUrl(reader.result as string);
                                                }
                                            };
                                            img.src = reader.result as string;
                                        };
                                        reader.readAsDataURL(file);
                                    }
                                }}
                                style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}
                            />
                            {newEntityImageUrl && (
                                <div style={{ marginTop: '10px', position: 'relative', width: '200px', height: '120px', border: '1px solid #444', overflow: 'hidden' }}>
                                    <img src={newEntityImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button
                                        onClick={() => setNewEntityImageUrl("")}
                                        style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="color-presets">
                        {COLOR_PRESETS.map(color => (
                            <button
                                key={color}
                                className={`color-preset ${newEntityColor === color ? 'active' : ''}`}
                                style={{ backgroundColor: color }}
                                onClick={() => setNewEntityColor(color)}
                            />
                        ))}
                    </div>

                    {["PERSONAGEM", "FACAO", "FAMILIA", "BESTIARIO"].includes(newEntityType) && (
                        <>
                            {newEntityType === "BESTIARIO" && (
                                <div className="input-group" style={{ marginBottom: '20px', borderBottom: '1px solid rgba(var(--accent-rgb), 0.1)', paddingBottom: '15px' }}>
                                    <label>IMPORTAR DO BESTIÁRIO DO JOGO</label>
                                    <select 
                                        value={importBestiaryId} 
                                        onChange={e => {
                                            const id = e.target.value;
                                            setImportBestiaryId(id);
                                            const char = bestiaryList.find(c => c.id === id);
                                            if (char) {
                                                setNewEntityName(char.name);
                                                setNewEntityDescription(char.biography || "");
                                                setNewEntityImageUrl(char.imageUrl || "");
                                            }
                                        }}
                                        style={{ width: '100%', background: '#1a1a1a', color: '#fff', border: '1px solid var(--accent-color)', padding: '10px', borderRadius: '4px' }}
                                    >
                                        <option value="">-- SELECIONE PARA IMPORTAR --</option>
                                        {bestiaryList.map(c => (
                                            <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                                        ))}
                                    </select>
                                    <p style={{ fontSize: '0.6rem', color: '#888', marginTop: '6px' }}>Isso preencherá automaticamente Nome, Lore e Imagem.</p>
                                </div>
                            )}
                            <div className="character-extra-fields animate-fade-in" style={{ marginTop: '20px' }}>
                            <div className="input-row" style={{ display: 'flex', gap: '15px' }}>
                                {newEntityType === "PERSONAGEM" && (
                                    <>
                                        <div className="input-group flex-1">
                                            <label>FAMÍLIA</label>
                                            <select value={newEntityFamily} onChange={e => setNewEntityFamily(e.target.value)} style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}>
                                                <option value="">NENHUMA</option>
                                                {familiesList.map(f => <option key={f.id} value={f.id}>{f.name.toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                        <div className="input-group flex-1">
                                            <label>RAÇA</label>
                                            <select value={newEntityRace} onChange={e => setNewEntityRace(e.target.value)} style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}>
                                                <option value="">NENHUMA</option>
                                                {racesList.map(r => <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>)}
                                            </select>
                                        </div>
                                        <div className="input-group flex-1">
                                            <label>PROFISSÃO</label>
                                            <input 
                                                type="text" 
                                                value={newEntityProfession} 
                                                onChange={e => setNewEntityProfession(e.target.value)} 
                                                placeholder="Ex: Guerreiro, Ladino..."
                                                style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px', fontSize: '0.8rem' }}
                                            />
                                        </div>
                                    </>
                                )}
                                {["FACAO", "FAMILIA", "BESTIARIO", "OUTROS"].includes(newEntityType) && (
                                    <div className="input-group flex-1">
                                        <label>LOCALIZAÇÃO / BASE</label>
                                        <select value={newEntityCurrentLoc} onChange={e => setNewEntityCurrentLoc(e.target.value)} style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}>
                                            <option value="">NENHUMA (DESCONHECIDA)</option>
                                            {locationsList.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            {newEntityType === "PERSONAGEM" && (
                                <div className="input-row" style={{ display: 'flex', gap: '15px', marginTop: '15px' }}>
                                    <div className="input-group flex-1">
                                        <label>LOCAL DE ORIGEM</label>
                                        <select value={newEntityOrigin} onChange={e => setNewEntityOrigin(e.target.value)} style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}>
                                            <option value="">NENHUM</option>
                                            {locationsList.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group flex-1">
                                        <label>LOCAL ATUAL</label>
                                        <select value={newEntityCurrentLoc} onChange={e => setNewEntityCurrentLoc(e.target.value)} style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}>
                                            <option value="">NENHUM</option>
                                            {locationsList.map(l => <option key={l.id} value={l.id}>{l.name.toUpperCase()}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>
                        </>
                    )}

                    <div className="input-group">
                        <label>TAGS (Enter para adicionar)</label>
                        <div className="tags-container">
                            {newEntityTags.map((tag, i) => (
                                <div key={i} className="tag-pill" style={{ borderColor: newEntityColor, color: newEntityColor }}>
                                    <span>{tag.toUpperCase()}</span>
                                    <button onClick={() => removeTag(tag)}><X size={10} /></button>
                                </div>
                            ))}
                            <input
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                placeholder={newEntityTags.length === 0 ? "Ex: Importante, Aliado..." : ""}
                                className="tag-input-field"
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>DESCRIÇÃO</label>
                        <MentionEditor
                            value={newEntityDescription}
                            onChange={setNewEntityDescription}
                            placeholder="Escreva detalhes sobre este elemento..."
                            className="description-area"
                            mentionEntities={mentionEntities}
                        />
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={handleCancelWorldEntityEdit}>CANCELAR</button>
                    <button className="confirm-btn" onClick={handleCreateWorldEntity}>
                        {editingWorldEntityId ? "SALVAR ALTERAÇÕES" : "CRIAR ELEMENTO"}
                    </button>
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
}

const styles = `
    .input-group select option {
        background-color: #111;
        color: #fff;
    }
`;

if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = styles;
    document.head.appendChild(styleSheet);
}
