import { User, MapPin, Map as MapIcon, Shield, Home, Skull, Dna, Plus, Trash2, MessageSquare, EyeOff, Eye, Layers, Edit2, Church, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { renderMentions } from "@/lib/mentionUtils";
import { WorldTabStyles } from "../styles/WorldTab.styles";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";

type ListSortMode = "AZ" | "ZA";
type ListPageSize = 10 | 20 | 50;

function sortByName<T extends { name?: string }>(list: T[], mode: ListSortMode): T[] {
    const sorted = [...list].sort((a, b) =>
        (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })
    );
    return mode === "ZA" ? sorted.reverse() : sorted;
}

interface WorldTabProps {
    subTabMundo: string;
    setSubTabMundo: (tab: any) => void;
    setShowAddWorldEntity: (show: boolean) => void;
    bestiarySearch: string;
    setBestiarySearch: (search: string) => void;
    bestiarySessionOnly: boolean;
    setBestiarySessionOnly: (only: boolean) => void;
    userRole?: "GM" | "PLAYER";
    onRegisterThreat?: () => void;
    bestiaryList: any[];
    viewingBestiaryCharId: string | null;
    setViewingBestiaryCharId: (id: string | null) => void;
    sessionId: string;
    userId: string;
    worldEntitiesForCurrentTab: any[];
    setViewingEntityId: (id: string | null) => void;
    handleDeleteWorldEntity: (id: string) => void;
    handleStartEditWorldEntity: (id: string) => void;
    handleToggleAllVisibility?: (entityId: string, hideAll: boolean) => void;
    handleUpdateFieldVisibility?: (entityId: string, fieldName: string, isHidden: boolean) => void;
    worldSearch: string;
    setWorldSearch: (search: string) => void;
    worldSearchSuggestions: any[];
    state: any;
    globalEventStore: any;
    uuidv4: any;
    handleAddEntityNote: (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, content: string, isPrivate?: boolean) => void;
    handleDeleteEntityNote: (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, noteId: string) => void;
    mentionEntities: any[];
    worldFilters: Record<string, string[]>;
    toggleWorldFilter: (field: string, value: string) => void;
    worldFilterAvailableOptions: any[];
    setNewEntityType?: (type: any) => void;
}

export function WorldTab({
    subTabMundo,
    setSubTabMundo,
    setShowAddWorldEntity,
    bestiarySearch,
    setBestiarySearch,
    bestiarySessionOnly,
    setBestiarySessionOnly,
    userRole,
    onRegisterThreat,
    bestiaryList,
    viewingBestiaryCharId,
    setViewingBestiaryCharId,
    sessionId,
    userId,
    worldEntitiesForCurrentTab,
    setViewingEntityId,
    handleDeleteWorldEntity,
    handleStartEditWorldEntity,
    handleToggleAllVisibility,
    handleUpdateFieldVisibility,
    worldSearch,
    setWorldSearch,
    worldSearchSuggestions,
    state,
    globalEventStore,
    uuidv4,
    handleAddEntityNote,
    handleDeleteEntityNote,
    mentionEntities,
    worldFilters,
    toggleWorldFilter,
    worldFilterAvailableOptions,
    setNewEntityType
}: WorldTabProps) {
    const { requestDelete, isPending } = useDeleteConfirm();
    const [sortMode, setSortMode] = useState<ListSortMode>("AZ");
    const [itemsPerPage, setItemsPerPage] = useState<ListPageSize>(10);
    const [page, setPage] = useState(0);

    const orderedEntities = useMemo(
        () => sortByName(worldEntitiesForCurrentTab, sortMode),
        [worldEntitiesForCurrentTab, sortMode]
    );

    const totalPages = Math.max(1, Math.ceil(orderedEntities.length / itemsPerPage));
    const paginatedEntities = useMemo(() => {
        const start = page * itemsPerPage;
        return orderedEntities.slice(start, start + itemsPerPage);
    }, [orderedEntities, page, itemsPerPage]);

    useEffect(() => {
        setPage(0);
    }, [subTabMundo, worldSearch, bestiarySearch, bestiarySessionOnly, sortMode, itemsPerPage]);

    useEffect(() => {
        const maxPage = Math.max(0, totalPages - 1);
        if (page > maxPage) setPage(maxPage);
    }, [page, totalPages]);

    return (
        <>
        <WorldTabStyles />
        <div className="tab-content-combined">
            <div className="navigator-controls">
                <span className="navigator-label">MUNDO: {subTabMundo.toUpperCase()}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}>ORDENAR</span>
                    <select
                        className="author-filter"
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value as ListSortMode)}
                        style={{ minWidth: "92px" }}
                    >
                        <option value="AZ">A-Z</option>
                        <option value="ZA">Z-A</option>
                    </select>
                    <span style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.5)" }}>POR PÁGINA</span>
                    <select
                        className="author-filter"
                        value={String(itemsPerPage)}
                        onChange={(e) => setItemsPerPage(Number(e.target.value) as ListPageSize)}
                        style={{ minWidth: "82px" }}
                    >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                    </select>
                    <button
                        type="button"
                        className="clear-all-btn"
                        disabled={page <= 0}
                        onClick={() => setPage((prev) => Math.max(0, prev - 1))}
                        style={{ opacity: page <= 0 ? 0.45 : 1, cursor: page <= 0 ? "not-allowed" : "pointer" }}
                    >
                        ANT
                    </button>
                    <span style={{ minWidth: "54px", textAlign: "center", fontSize: "0.65rem", color: "rgba(255,255,255,0.6)" }}>
                        {page + 1}/{totalPages}
                    </span>
                    <button
                        type="button"
                        className="clear-all-btn"
                        disabled={page >= totalPages - 1}
                        onClick={() => setPage((prev) => Math.min(totalPages - 1, prev + 1))}
                        style={{ opacity: page >= totalPages - 1 ? 0.45 : 1, cursor: page >= totalPages - 1 ? "not-allowed" : "pointer" }}
                    >
                        PRÓX
                    </button>
                </div>

                {userRole === "GM" && (
                    <button
                        className="add-world-entity-btn-mini"
                        style={{ marginLeft: 'auto', width: '36px', height: '36px', flexShrink: 0 }}
                        onClick={() => {
                            if (setNewEntityType) {
                                const tabToType: Record<string, string> = {
                                    "Personagens": "PERSONAGEM",
                                    "Localizações": "LOCALIZACAO",
                                    "Mapas": "MAPA",
                                    "Facções": "FACAO",
                                    "Religiões": "RELIGIAO",
                                    "Famílias": "FAMILIA",
                                    "Criaturas": "BESTIARIO",
                                    "Raças": "RACA",
                                    "Outros": "OUTROS"
                                };
                                setNewEntityType(tabToType[subTabMundo] || "PERSONAGEM");
                            }
                            setShowAddWorldEntity(true);
                        }}
                        title="Adicionar Novo Elemento de Mundo"
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>

            <div className="sub-content-area scrollbar-arcane">
                <div className="world-entities-list-container">
                        {orderedEntities.length > 0 ? (
                            <div className="section-block">
                                <div className={subTabMundo === "Mapas" ? "entities-grid" : "world-entities-list"}>
                                    {paginatedEntities.map(entity => {
                                        const isGM = userRole === "GM";
                                        const fieldVisibility = entity.fieldVisibility || {};
                                        const isVisible = (field: string) => isGM || !fieldVisibility[field];
                                        const isAllHidden = Object.values(fieldVisibility).every(v => v);
                                        const displayColor = isVisible('color') ? entity.color : '#444';
                                        const deleteIsPending = isPending(entity.id);

                                        if (entity.type === "MAPA") {
                                            return (
                                                <div
                                                    key={entity.id}
                                                    className="world-entity-card map-card"
                                                    style={{ borderTop: `4px solid ${displayColor}`, cursor: 'default' }}
                                                >
                                                    <div className="map-thumbnail clickable" onClick={() => setViewingEntityId(entity.id)}>
                                                        {isVisible('image') ? (
                                                            entity.imageUrl ? (
                                                                <img src={entity.imageUrl} alt={isGM || isVisible('name') ? entity.name : '????'} />
                                                            ) : (
                                                                <div className="no-map-img"><MapIcon size={32} /></div>
                                                            )
                                                        ) : (
                                                            <div className="no-map-img" style={{ color: '#444' }}><EyeOff size={32} /></div>
                                                        )}
                                                    </div>
                                                    <div className="entity-card-content clickable" style={{ position: 'relative' }} onClick={() => setViewingEntityId(entity.id)}>
                                                        <div className="entity-card-header">
                                                            <span className="entity-name" style={{ color: displayColor }}>
                                                                {isVisible('name') ? entity.name.toUpperCase() : "????"}
                                                                {isGM && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleUpdateFieldVisibility?.(entity.id, 'name', !fieldVisibility['name']); }}
                                                                        className="visibility-toggle-btn name-toggle"
                                                                        title={fieldVisibility['name'] ? "Mostrar Nome" : "Ocultar Nome"}
                                                                        style={{ background: 'none', border: 'none', color: fieldVisibility['name'] ? 'var(--accent-color)' : '#666', cursor: 'pointer', marginLeft: '6px' }}
                                                                    >
                                                                        {fieldVisibility['name'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                    </button>
                                                                )}
                                                            </span>
                                                        </div>

                                                        <div className="description-preview-box" dangerouslySetInnerHTML={{ __html: isVisible('description') ? (entity.description ? renderMentions(entity.description) : "Sem descrição.") : "????" }} />

                                                        <div className="entity-location-label" style={{ marginBottom: '8px' }}>
                                                            <MapPin size={10} />
                                                            <span style={{ opacity: 0.6, marginRight: '4px' }}>VINCULADO A:</span>
                                                            {isVisible('location_info') ? (entity.linkedLocationId ? state.worldEntities?.[entity.linkedLocationId as string]?.name.toUpperCase() : "NENHUM") : "????"}
                                                        </div>

                                                        <div className="entity-tags">
                                                            {isVisible('tags') ? entity.tags.slice(0, 2).map((tag: string, i: number) => (
                                                                <span key={i} className="entity-tag">#{tag}</span>
                                                            )) : <span className="entity-tag" style={{ color: '#444' }}>#????</span>}
                                                        </div>

                                                        <div className="entity-actions" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', justifyContent: 'center', gap: '12px' }} onClick={e => e.stopPropagation()}>
                                                            {isGM && (
                                                                <>
                                                                    <button
                                                                        className="entity-visibility-btn"
                                                                        onClick={(e) => { e.stopPropagation(); handleToggleAllVisibility?.(entity.id, !isAllHidden); }}
                                                                        title={isAllHidden ? "Mostrar Tudo" : "Ocultar Tudo"}
                                                                        style={{ color: isAllHidden ? '#666' : 'var(--accent-color)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                                    >
                                                                        {isAllHidden ? <EyeOff size={18} /> : <Eye size={18} />}
                                                                    </button>
                                                                    <button
                                                                        className="entity-add-block-btn"
                                                                        onClick={(e) => { e.stopPropagation(); setViewingEntityId(entity.id); }}
                                                                        title="Adicionar Bloco"
                                                                        style={{ color: 'var(--accent-color)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                                                    >
                                                                        <Plus size={32} />
                                                                    </button>
                                                                    <button
                                                                        className="entity-edit-btn"
                                                                        onClick={(e) => { e.stopPropagation(); handleStartEditWorldEntity(entity.id); }}
                                                                        title="Editar"
                                                                        style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0 }}
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                                    </button>
                                                                    <button
                                                                        className="entity-delete-btn"
                                                                        onClick={(e) => { e.stopPropagation(); requestDelete(entity.id, () => handleDeleteWorldEntity(entity.id)); }}
                                                                        title={deleteIsPending ? "Clique para confirmar exclusão" : "Excluir"}
                                                                        style={{ background: 'none', border: 'none', color: deleteIsPending ? '#00cc66' : '#ff4444', opacity: 0.8, cursor: 'pointer', padding: 0 }}
                                                                    >
                                                                        {deleteIsPending ? <Check size={23} /> : <Trash2 size={23} />}
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                className="entity-note-btn gold-text"
                                                                onClick={(e) => { e.stopPropagation(); setViewingEntityId(entity.id); }}
                                                                title="Notas"
                                                                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer' }}
                                                            >
                                                                <MessageSquare size={32} />
                                                                {entity.linkedNotes && entity.linkedNotes.filter((n: any) => !(n.isPrivate || n.is_private) || n.authorId === userId).length > 0 && (
                                                                    <span className="note-badge-count" style={{ scale: '0.8' }}>{entity.linkedNotes.filter((n: any) => !(n.isPrivate || n.is_private) || n.authorId === userId).length}</span>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div
                                                key={entity.id}
                                                className="world-entity-card"
                                                style={{
                                                    borderLeft: `4px solid ${displayColor}`,
                                                    background: isVisible('color') ? 'rgba(255,255,255,0.03)' : '#1a1a1a',
                                                    padding: 0,
                                                    position: 'relative',
                                                    display: 'flex',
                                                    alignItems: 'stretch',
                                                    minHeight: '90px',
                                                    overflow: 'hidden'
                                                }}
                                            >
                                                {isGM && (
                                                    <div
                                                        title={isAllHidden ? "Mostrar Tudo" : "Ocultar Tudo"}
                                                        onClick={(e) => { e.stopPropagation(); handleToggleAllVisibility?.(entity.id, !isAllHidden); }}
                                                        style={{
                                                            width: '50px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            background: isAllHidden ? 'rgba(255,68,68,0.08)' : 'rgba(var(--accent-rgb), 0.08)',
                                                            borderRight: '1px solid rgba(255,255,255,0.05)',
                                                            cursor: 'pointer',
                                                            flexShrink: 0
                                                        }}
                                                    >
                                                        {isAllHidden ? <EyeOff size={24} style={{ opacity: 0.3 }} /> : <Eye size={24} style={{ color: 'var(--accent-color)', opacity: 0.8 }} />}
                                                    </div>
                                                )}

                                                <div
                                                    className="entity-main-content-area"
                                                    style={{
                                                        flex: 1,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        padding: '12px 15px',
                                                        paddingRight: '110px',
                                                        gap: '15px'
                                                    }}
                                                >
                                                    {isVisible('image') ? (
                                                        entity.imageUrl ? (
                                                            <div className="entity-card-thumb clickable" style={{ border: `1px solid ${displayColor}`, flexShrink: 0 }} onClick={() => setViewingEntityId(entity.id)}>
                                                                <img src={entity.imageUrl} alt={isGM || isVisible('name') ? entity.name : '????'} />
                                                            </div>
                                                        ) : (
                                                            <div className="entity-card-thumb" style={{ opacity: 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', border: '1px dashed #333', flexShrink: 0 }} onClick={() => setViewingEntityId(entity.id)}>
                                                                {entity.type === "PERSONAGEM" ? <User size={24} /> :
                                                                 entity.type === "LOCALIZACAO" ? <MapPin size={24} /> :
                                                                 entity.type === "FAMILIA" ? <Home size={24} /> :
                                                                 entity.type === "FACAO" ? <Shield size={24} /> :
                                                                 entity.type === "RELIGIAO" ? <Church size={24} /> :
                                                                 <Layers size={24} />}
                                                            </div>
                                                        )
                                                    ) : (
                                                        <div className="entity-card-thumb" style={{ opacity: 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', flexShrink: 0 }}><EyeOff size={24} /></div>
                                                    )}

                                                    <div className="entity-info-box clickable" style={{ flex: 1, minWidth: 0 }} onClick={() => setViewingEntityId(entity.id)}>
                                                        <div className="entity-card-header">
                                                            <span className="entity-name" style={{ color: displayColor, fontWeight: 'bold', fontSize: '0.95rem' }}>
                                                                {isVisible('name') ? entity.name.toUpperCase() : "????"}
                                                                {isGM && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleUpdateFieldVisibility?.(entity.id, 'name', !fieldVisibility['name']); }}
                                                                        style={{ background: 'none', border: 'none', color: fieldVisibility['name'] ? 'var(--accent-color)' : '#555', cursor: 'pointer', marginLeft: '8px' }}
                                                                    >
                                                                        {fieldVisibility['name'] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                                    </button>
                                                                )}
                                                            </span>
                                                        </div>

                                                        <div className="entity-meta-row" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px', opacity: 0.65 }}>
                                                            {entity.type === "PERSONAGEM" && (
                                                                <>
                                                                    <span style={{ fontSize: '0.62rem', color: '#aaa' }}>
                                                                        {isVisible('currentLocation') ? (entity.currentLocationId ? state.worldEntities?.[entity.currentLocationId as string]?.name.toUpperCase() : "—") : "????"}
                                                                    </span>
                                                                    {entity.raceId && isVisible('race') && <span style={{ fontSize: '0.6rem', color: '#666' }}>·</span>}
                                                                    {entity.raceId && isVisible('race') && (
                                                                        <span style={{ fontSize: '0.62rem', color: '#aaa' }}>{state.worldEntities?.[entity.raceId as string]?.name.toUpperCase()}</span>
                                                                    )}
                                                                    {entity.factionId && isVisible('faction') && <span style={{ fontSize: '0.6rem', color: '#666' }}>·</span>}
                                                                    {entity.factionId && isVisible('faction') && (
                                                                        <span style={{ fontSize: '0.62rem', color: '#aaa' }}>{state.worldEntities?.[entity.factionId as string]?.name.toUpperCase()}</span>
                                                                    )}
                                                                    {entity.profession && <span style={{ fontSize: '0.6rem', color: '#666' }}>·</span>}
                                                                    {entity.profession && (
                                                                        <span style={{ fontSize: '0.62rem', color: '#aaa' }}>{(entity.profession as string).toUpperCase()}</span>
                                                                    )}
                                                                </>
                                                            )}
                                                            {entity.type === "LOCALIZACAO" && (
                                                                <>
                                                                    {entity.locationType && (
                                                                        <span style={{ fontSize: '0.62rem', color: '#aaa' }}>{(entity.locationType as string).toUpperCase()}</span>
                                                                    )}
                                                                    {entity.locationType && entity.linkedLocationId && <span style={{ fontSize: '0.6rem', color: '#666' }}>·</span>}
                                                                    {entity.linkedLocationId && (
                                                                        <span style={{ fontSize: '0.62rem', color: '#aaa' }}>{state.worldEntities?.[entity.linkedLocationId as string]?.name.toUpperCase()}</span>
                                                                    )}
                                                                </>
                                                            )}
                                                            {entity.type === "FACAO" && entity.currentLocationId && (
                                                                <span style={{ fontSize: '0.62rem', color: '#aaa' }}>
                                                                    {state.worldEntities?.[entity.currentLocationId as string]?.name.toUpperCase()}
                                                                </span>
                                                            )}
                                                            {entity.type === "BESTIARIO" && (
                                                                <>
                                                                    {entity.originId && (
                                                                        <span style={{ fontSize: '0.62rem', color: '#aaa' }}>{state.worldEntities?.[entity.originId as string]?.name.toUpperCase()}</span>
                                                                    )}
                                                                    {entity.originId && entity.linkedLocationId && <span style={{ fontSize: '0.6rem', color: '#666' }}>·</span>}
                                                                    {entity.linkedLocationId && (
                                                                        <span style={{ fontSize: '0.62rem', color: '#aaa' }}>{state.worldEntities?.[entity.linkedLocationId as string]?.name.toUpperCase()}</span>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>

                                                        <p className="entity-description-text" style={{ marginTop: '8px', fontSize: '0.82rem', color: '#bbb', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: isVisible('description') ? (entity.description ? renderMentions(entity.description) : "Sem descrição.") : "????" }} />
                                                    </div>
                                                </div>

                                                <div
                                                    className="entity-absolute-actions"
                                                    style={{
                                                        position: 'absolute',
                                                        right: 0,
                                                        top: 0,
                                                        bottom: 0,
                                                        width: '100px',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        borderLeft: '1px solid rgba(255,255,255,0.05)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        gap: '10px',
                                                        zIndex: 9999
                                                    }}
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', gap: '12px' }}>
                                                        {isGM && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setViewingEntityId(entity.id);
                                                                }}
                                                                title="Adicionar Bloco"
                                                                style={{ color: 'var(--accent-color)', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', zIndex: 10000 }}
                                                            >
                                                                <Plus size={20} />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewingEntityId(entity.id);
                                                            }}
                                                            title="Notas"
                                                            style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '8px', zIndex: 10000 }}
                                                        >
                                                            <MessageSquare size={20} style={{ color: 'var(--accent-color)' }} />
                                                            {entity.linkedNotes && entity.linkedNotes.filter((n: any) => !(n.isPrivate || n.is_private) || n.authorId === userId).length > 0 && (
                                                                <span style={{ position: 'absolute', top: '0', right: '0', background: 'var(--accent-color)', color: '#000', fontSize: '0.6rem', fontWeight: 'bold', minWidth: '15px', height: '15px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                                                    {entity.linkedNotes.filter((n: any) => !(n.isPrivate || n.is_private) || n.authorId === userId).length}
                                                                </span>
                                                            )}
                                                        </button>
                                                    </div>
                                                    {isGM && (
                                                        <div style={{ display: 'flex', gap: '12px' }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleStartEditWorldEntity(entity.id);
                                                                }}
                                                                title="Editar"
                                                                style={{ background: 'none', border: 'none', color: '#777', cursor: 'pointer', padding: '8px', zIndex: 10000 }}
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    requestDelete(entity.id, () => handleDeleteWorldEntity(entity.id));
                                                                }}
                                                                title={isPending(entity.id) ? "Clique para confirmar exclusão" : "Excluir"}
                                                                style={{ background: 'none', border: 'none', color: isPending(entity.id) ? '#00cc66' : '#ff4444', opacity: 0.8, cursor: 'pointer', padding: '8px', zIndex: 10000 }}
                                                            >
                                                                {isPending(entity.id) ? <Check size={18} /> : <Trash2 size={18} />}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">
                                NENHUM REGISTRO DE {subTabMundo.toUpperCase()} ENCONTRADO.
                                <br />
                                CLIQUE NO BOTÀO "+" PARA ADICIONAR.
                            </div>
                        )}
                    </div>
            </div>
        </div>
        </>
    );
}
