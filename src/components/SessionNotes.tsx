import { Book, Globe, Clock, Swords, Search, X, Filter, ChevronDown, RotateCw, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Character, SessionState } from "@/types/domain";
import { useSessionNotes } from "@/hooks/useSessionNotes";
import { NotesTab } from "./SessionNotesTabs/NotesTab";
import { WorldTab } from "./SessionNotesTabs/WorldTab";
import { TimeTab, GameTab } from "./SessionNotesTabs/TimeGameTabs";
import { CreateWorldEntityModal } from "./SessionNotesTabs/CreateWorldEntityModal";
import { ViewWorldEntityModal } from "./SessionNotesTabs/ViewWorldEntityModal";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import "./SessionNotes.css";

import { createPortal } from "react-dom";

// Sub-componente para menu customizado de luxo com Portal para evitar problemas de z-index
function CustomMainTab({ id, label, icon, active, currentSub, onSelect, options }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            // Se clicar fora de AMBOS (trigger e menu portal), aí sim fechamos
            const isOutsideTrigger = triggerRef.current && !triggerRef.current.contains(event.target as Node);
            const isOutsideMenu = menuRef.current && !menuRef.current.contains(event.target as Node);
            
            if (isOutsideTrigger && isOutsideMenu) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleMenu = () => {
        if (triggerRef.current) {
            setRect(triggerRef.current.getBoundingClientRect());
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className={`main-tab-group ${active ? 'active' : ''}`} ref={triggerRef}>
            <div className="main-tab-trigger" onClick={toggleMenu}>
                {icon}
                <span className="main-tab-label">{label}</span>
                <ChevronDown size={14} className={`dropdown-chevron ${isOpen ? 'open' : ''}`} />
            </div>

            {isOpen && rect && createPortal(
                <div 
                    className="victorian-dropdown-menu animate-fade-in-up portal-menu" 
                    ref={menuRef}
                    style={{
                        position: 'fixed',
                        top: `${rect.bottom + 5}px`,
                        left: `${rect.left + rect.width / 2}px`,
                        transform: 'translateX(-50%)',
                        display: 'block'
                    }}
                >
                    <div className="menu-pointer"></div>
                    <ul className="menu-options-list scrollbar-arcane">
                        {options.map((opt: any) => (
                            <li 
                                key={opt.value} 
                                className={`menu-option-item ${currentSub === opt.value ? 'selected' : ''}`}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onSelect(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                {currentSub === opt.value && <Check size={12} className="check-icon-gold" />}
                                <span>{opt.label}</span>
                            </li>
                        ))}
                    </ul>
                </div>,
                document.body
            )}
        </div>
    );
}

interface SessionNotesProps {
    sessionId: string;
    userId: string;
    userRole?: "GM" | "PLAYER";
    state: SessionState;
    globalBestiaryChars?: Character[];
    onRegisterThreat?: () => void;
    onRefresh?: () => void;
}

export function SessionNotes({ sessionId, userId, userRole, state, globalBestiaryChars = [], onRegisterThreat, onRefresh }: SessionNotesProps) {
    const {
        // State
        editorContent, setEditorContent,
        filterAuthor, setFilterAuthor,
        activeTab, setActiveTab,
        subTabMundo, setSubTabMundo,
        subTabTempo, setSubTabTempo,
        subTabJogo, setSubTabJogo,
        notesSubTab, setNotesSubTab,
        editingNoteId, setEditingNoteId,
        newEntityProfession, setNewEntityProfession,
        worldFilters, toggleWorldFilter, worldFilterAvailableOptions,
        worldSearch, setWorldSearch,
        bestiarySearch, setBestiarySearch,

        bestiarySessionOnly, setBestiarySessionOnly,
        viewingBestiaryCharId, setViewingBestiaryCharId,
        showAddWorldEntity, setShowAddWorldEntity,
        newEntityName, setNewEntityName,
        newEntityType, setNewEntityType,
        newEntityColor, setNewEntityColor,
        newEntityTags, setNewEntityTags,
        tagInput, setTagInput,
        newEntityDescription, setNewEntityDescription,
        newEntityFamily, setNewEntityFamily,
        newEntityRace, setNewEntityRace,
        newEntityOrigin, setNewEntityOrigin,
        newEntityCurrentLoc, setNewEntityCurrentLoc,
        newEntityLocationType, setNewEntityLocationType,
        newEntityLinkedLocation, setNewEntityLinkedLocation,
        locSearch, setLocSearch,
        newEntityImageUrl, setNewEntityImageUrl,
        newEntityReligion, setNewEntityReligion,
        viewingEntityId, setViewingEntityId,
        importBestiaryId, setImportBestiaryId,
        
        // Mission State
        showAddMission, setShowAddMission,
        editingMissionId, setEditingMissionId,
        newMissionName, setNewMissionName,
        newMissionDescription, setNewMissionDescription,
        newMissionSubTasks, setNewMissionSubTasks,
        newSubTaskInput, setNewSubTaskInput,
        newMissionDay, setNewMissionDay,
        newMissionMonth, setNewMissionMonth,
        newMissionYear, setNewMissionYear,
        editingWorldEntityId, setEditingWorldEntityId,
        editingSkillId, setEditingSkillId,
        editingItemId, setEditingItemId,

        // Timeline State
        showAddTimelineEvent, setShowAddTimelineEvent,
        editingTimelineEventId, setEditingTimelineEventId,
        newTimelineName, setNewTimelineName,
        newTimelineDescription, setNewTimelineDescription,
        newTimelineDay, setNewTimelineDay,
        newTimelineMonth, setNewTimelineMonth,
        newTimelineYear, setNewTimelineYear,
        timelineSortAsc, setTimelineSortAsc,

        // Skill State
        showAddSkill, setShowAddSkill,
        newSkillName, setNewSkillName,
        newSkillDescription, setNewSkillDescription,
        newSkillRequirement, setNewSkillRequirement,
        newSkillColor, setNewSkillColor,

        // Item State
        showAddItem, setShowAddItem,
        newItemName, setNewItemName,
        newItemDescription, setNewItemDescription,
        newItemPrice, setNewItemPrice,
        newItemQuantity, setNewItemQuantity,
        newItemRequirement, setNewItemRequirement,

        // Derived state
        notes,
        authors,
        bestiaryList,
        familiesList,
        racesList,
        religionsList,
        locationsList,
        worldEntitiesForCurrentTab,
        worldSearchSuggestions,
        mentionEntities,
        filteredNotes,
        filteredMissions,
        filteredTimeline,
        filteredSkills,
        filteredItems,
        viewingEntity,
        uniqueTags,
        
        // Refs
        editorRef,
        scrollRef,
        
        // Handlers
        handleFormat,
        handleSend,
        handleDelete,
        handleDeleteAll,
        handleClearNotesLocally,
        handleStartEdit,
        handleCancelEdit,
        handleCreateWorldEntity,
        handleAddTag,
        removeTag,
        handleDeleteWorldEntity,
        handleStartEditWorldEntity,
        handleCancelWorldEntityEdit,
        getAuthorColor,

        // Mission Handlers
        handleCreateMission,
        handleUpdateMission,
        handleDeleteMission,
        handleStartEditMission,
        handleCancelMissionEdit,
        handleToggleSubTask,
        handleAddSubTask,

        // Timeline Handlers
        handleCreateTimelineEvent,
        handleDeleteTimelineEvent,
        handleStartEditTimelineEvent,
        handleCancelTimelineEdit,

        // Skill Handlers
        handleCreateSkill, handleUpdateSkill, handleDeleteSkill,
        handleStartEditSkill, handleCancelSkillEdit,
        // Item Handlers
        handleCreateItem, handleUpdateItem, handleDeleteItem,
        handleStartEditItem, handleCancelItemEdit,
        handleAddEntityNote,
        handleDeleteEntityNote,
        handleUpdateFieldVisibility,
        handleAddDescriptionBlock,
        handleUpdateDescriptionBlock,
        handleDeleteDescriptionBlock,
        handleToggleAllVisibility,

        failedEventIds,
        connectionStatus,
        handleRetry,

        // Constants
        COLOR_PRESETS,
        TYPE_LABELS,
        LOCATION_CATEGORIES
    } = useSessionNotes({ sessionId, userId, userRole, state, globalBestiaryChars });

    const [showWorldFilters, setShowWorldFilters] = useState(false);
    const [filterBtnRect, setFilterBtnRect] = useState<DOMRect | null>(null);
    const [filterSearch, setFilterSearch] = useState("");
    const filterBtnRef = useRef<HTMLDivElement>(null);
    const filterDropdownRef = useRef<HTMLDivElement>(null);

    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            const isOutsideBtn = filterBtnRef.current && !filterBtnRef.current.contains(event.target as Node);
            const isOutsideDropdown = filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node);
            if (isOutsideBtn && isOutsideDropdown) {
                setShowWorldFilters(false);
                setFilterSearch("");
            }
        }
        if (showWorldFilters) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showWorldFilters]);

    const handleSelectSearchResult = (entity: any) => {
        if (entity.category === 'Mundo') {
            setActiveTab('Mundo');
            const typeToTab: any = {
                'PERSONAGEM': 'Personagens',
                'LOCALIZACAO': 'Localizações',
                'MAPA': 'Mapas',
                'FACAO': 'Facções',
                'RELIGIAO': 'Religiões',
                'FAMILIA': 'Famílias',
                'BESTIARIO': 'Criaturas',
                'RACA': 'Raças',
                'OUTROS': 'Outros'
            };
            if (typeToTab[entity.type]) setSubTabMundo(typeToTab[entity.type]);
            setViewingEntityId(entity.id);
        } else if (entity.category === 'Criaturas') {
            setActiveTab('Mundo');
            setSubTabMundo('Criaturas');
            setViewingBestiaryCharId(entity.id);
        } else if (entity.category === 'Tempo') {
            setActiveTab('Tempo');
            if (entity.displayType === 'MISSÃO') {
                setSubTabTempo('Missões');
            } else if (entity.displayType === 'HISTÓRIA') {
                setSubTabTempo('Linha do Tempo');
            }
        } else if (entity.category === 'Jogo') {
            setActiveTab('Jogo');
            if (entity.displayType === 'HABILIDADE') setSubTabJogo('Habilidades');
            if (entity.displayType === 'ITEM') setSubTabJogo('Itens');
        }
        setShowSuggestions(false);
        setWorldSearch("");
    };

    const handleMentionClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const mentionId = target.getAttribute("data-mention-id");
        const mentionType = target.getAttribute("data-mention-type");
        const tag = target.getAttribute("data-tag");

        if (tag) {
            setWorldSearch(tag);
            setActiveTab("Mundo");
            return;
        }

        if (mentionId && mentionType) {
            const mockEntity = {
                id: mentionId,
                type: mentionType,
                category: mentionType === 'BESTIARIO' ? 'Criaturas' :
                         ['MISSÃO', 'HISTÓRIA'].includes(mentionType) ? 'Tempo' :
                         ['HABILIDADE', 'ITEM'].includes(mentionType) ? 'Jogo' : 'Mundo'
            };
            handleSelectSearchResult(mockEntity);
        }
    };

    return (
        <div className="session-notes-container solid ornate-border" onClick={handleMentionClick}>
            <div className="global-header-search">
                <div className="world-search-container">
                    <div className="search-input-group">
                        <Search size={14} className="search-icon" />
                        <input 
                            type="text" 
                            placeholder="Buscar no sistema... (Mundo, Missões, História, Itens...)" 
                            value={worldSearch}
                            onChange={(e) => {
                                setWorldSearch(e.target.value);
                                setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            className="global-world-search"
                        />
                        {worldSearch && (
                            <button className="clear-search" onClick={() => { setWorldSearch(""); setShowSuggestions(false); }}>
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {showSuggestions && worldSearchSuggestions.length > 0 && (
                        <div className="search-suggestions-dropdown global-dropdown scrollbar-arcane">
                            {worldSearchSuggestions.map((entity: any) => (
                                <div 
                                    key={entity.id} 
                                    className="suggestion-item"
                                    onClick={() => handleSelectSearchResult(entity)}
                                >
                                    <div className="suggestion-color" style={{ backgroundColor: entity.color }} />
                                    <div className="suggestion-info">
                                        <div className="suggestion-header">
                                            <span className="suggestion-name">{entity.name.toUpperCase()}</span>
                                            <span className="suggestion-category">{entity.category.toUpperCase()}</span>
                                        </div>
                                        <span className="suggestion-type">{entity.displayType}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {onRefresh && (
                        <button 
                            onClick={onRefresh}
                            className="system-refresh-btn"
                            title="Sincronizar Dados"
                            style={{
                                background: 'rgba(var(--accent-rgb), 0.1)',
                                border: '1px solid rgba(var(--accent-rgb), 0.2)',
                                color: 'var(--accent-color)',
                                width: '32px',
                                height: '32px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: '0.3s ease'
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.2)';
                                e.currentTarget.style.borderColor = 'var(--accent-color)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.1)';
                                e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb), 0.2)';
                            }}
                        >
                            <RotateCw size={14} />
                        </button>
                    )}

                    <div className="world-filter-wrap" style={{ position: 'relative' }} ref={filterBtnRef}>
                        <button 
                            className={`filter-toggle-btn ${showWorldFilters ? 'active' : ''}`}
                            onClick={() => {
                                if (filterBtnRef.current) setFilterBtnRect(filterBtnRef.current.getBoundingClientRect());
                                setShowWorldFilters(!showWorldFilters);
                            }}
                            title={`Filtros de ${activeTab === 'Mundo' ? subTabMundo : activeTab}`}
                        >
                            <Filter size={14} />
                            <span>FILTROS</span>
                            <ChevronDown size={12} style={{ opacity: 0.5, transform: showWorldFilters ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                        </button>
                    </div>
                </div>
            </div>

            {showWorldFilters && filterBtnRect && createPortal(
                <div 
                    ref={filterDropdownRef}
                    className="world-filters-dropdown global-dropdown scrollbar-arcane animate-fade-in portal-menu" 
                    style={{ 
                        position: 'fixed',
                        top: `${filterBtnRect.bottom + 10}px`,
                        left: `${filterBtnRect.right}px`,
                        transform: 'translateX(-100%)',
                        width: '280px', 
                        padding: '15px',
                        zIndex: 10001
                    }}
                >
                    <div className="filter-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                        <h5 style={{ fontSize: '0.7rem', color: 'var(--accent-color)' }}>FILTRAR {activeTab === 'Mundo' ? subTabMundo.toUpperCase() : activeTab.toUpperCase()}</h5>
                        <button onClick={() => setShowWorldFilters(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={14} /></button>
                    </div>

                    <div className="filter-search-input-wrap">
                        <Search size={12} className="filter-search-icon" />
                        <input 
                            type="text"
                            placeholder="Buscar filtro..."
                            value={filterSearch}
                            onChange={(e) => setFilterSearch(e.target.value)}
                            className="filter-search-input"
                        />
                        {filterSearch && (
                            <button 
                                onClick={() => setFilterSearch("")}
                                className="filter-search-clear"
                            >
                                <X size={10} />
                            </button>
                        )}
                    </div>

                    <div className="filters-list-content scrollbar-arcane" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto', paddingRight: '5px' }}>
                        {worldFilterAvailableOptions.length === 0 ? (
                            <p style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center' }}>Nenhum filtro disponível para esta aba.</p>
                        ) : (
                            worldFilterAvailableOptions.map((group: any) => {
                                const filteredOptions = group.options.filter((opt: any) => 
                                    opt.name.toLowerCase().includes(filterSearch.toLowerCase())
                                );

                                if (filterSearch && filteredOptions.length === 0) return null;

                                return (
                                    <div key={group.field} className="filter-group" style={{ marginBottom: '12px' }}>
                                        <label style={{ fontSize: '0.6rem', color: '#888', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>{group.label}</label>
                                        <div className="filter-options-grid" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {filteredOptions.length === 0 ? (
                                                <span style={{ fontSize: '0.65rem', color: '#555', fontStyle: 'italic' }}>Nada para filtrar...</span>
                                            ) : (
                                                filteredOptions.map((opt: any) => (
                                                    <label key={opt.id} className="filter-checkbox-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: '0.2s' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={(worldFilters[group.field] || []).includes(opt.id)}
                                                            onChange={() => toggleWorldFilter(group.field, opt.id)}
                                                            style={{ accentColor: 'var(--accent-color)' }}
                                                        />
                                                        <span style={{ fontSize: '0.7rem', color: (worldFilters[group.field] || []).includes(opt.id) ? '#fff' : '#aaa' }}>
                                                            {opt.name.toUpperCase()}
                                                        </span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>,
                document.body
            )}

            <div className="notes-tabs-main" onClick={() => setShowSuggestions(false)}>
                {/* Notas */}
                <CustomMainTab 
                    id="Notas" 
                    label="NOTAS" 
                    icon={<Book size={18} />} 
                    active={activeTab === 'Notas'} 
                    currentSub={notesSubTab}
                    onSelect={(val: string) => {
                        setActiveTab('Notas');
                        setNotesSubTab(val as any);
                    }}
                    options={[
                        { value: 'Geral', label: 'DIÁRIO GERAL' },
                        { value: 'Privado', label: 'NOTAS PRIVADAS' },
                        ...(userRole === "GM" ? [{ value: 'Jogadores', label: 'VISÃO DE JOGADORES' }] : []),
                        { value: 'Sessão', label: 'HISTÓRICO SESSÕES' }
                    ]}
                />

                {/* Mundo */}
                <CustomMainTab 
                    id="Mundo" 
                    label="MUNDO" 
                    icon={<Globe size={18} />} 
                    active={activeTab === 'Mundo'} 
                    currentSub={subTabMundo}
                    onSelect={(val: string) => {
                        setActiveTab('Mundo');
                        setSubTabMundo(val as any);
                    }}
                    options={[
                        { value: 'Personagens', label: 'PERSONAGENS' },
                        { value: 'Localizações', label: 'LOCALIZAÇÕES' },
                        { value: 'Mapas', label: 'MAPAS' },
                        { value: 'Facções', label: 'FACÇÕES' },
                        { value: 'Religiões', label: 'RELIGIÕES' },
                        { value: 'Famílias', label: 'FAMÍLIAS' },
                        { value: 'Criaturas', label: 'CRIATURAS' },
                        { value: 'Raças', label: 'RAÇAS' },
                        { value: 'Outros', label: 'OUTROS' }
                    ]}
                />

                {/* Tempo */}
                <CustomMainTab 
                    id="Tempo" 
                    label="TEMPO" 
                    icon={<Clock size={16} />} 
                    active={activeTab === 'Tempo'} 
                    currentSub={subTabTempo}
                    onSelect={(val: string) => {
                        setActiveTab('Tempo');
                        setSubTabTempo(val as any);
                    }}
                    options={[
                        { value: 'Missões', label: 'MISSÕES' },
                        { value: 'Linha do Tempo', label: 'HISTÓRIA' }
                    ]}
                />

                {/* Jogo */}
                <CustomMainTab 
                    id="Jogo" 
                    label="JOGO" 
                    icon={<Swords size={18} />} 
                    active={activeTab === 'Jogo'} 
                    currentSub={subTabJogo}
                    onSelect={(val: string) => {
                        setActiveTab('Jogo');
                        setSubTabJogo(val as any);
                    }}
                    options={[
                        { value: 'Habilidades', label: 'HABILIDADES' },
                        { value: 'Itens', label: 'ITENS' }
                    ]}
                />
            </div>

            {activeTab === "Notas" ? (
                <NotesTab 
                    notes={notes}
                    filteredNotes={filteredNotes}
                    userId={userId}
                    userRole={userRole}
                    authors={authors}
                    filterAuthor={filterAuthor}
                    setFilterAuthor={setFilterAuthor}
                    editorContent={editorContent}
                    setEditorContent={setEditorContent}
                    editorRef={editorRef}
                    scrollRef={scrollRef}
                    handleDeleteAll={handleDeleteAll}
                    handleClearNotesLocally={handleClearNotesLocally}
                    handleAddEntityNote={handleAddEntityNote}
                    handleDeleteEntityNote={handleDeleteEntityNote}
                    state={state}
                    handleDelete={handleDelete}
                    handleFormat={handleFormat}
                    handleSend={handleSend}
                    getAuthorColor={getAuthorColor}
                    notesSubTab={notesSubTab}
                    setNotesSubTab={setNotesSubTab}
                    editingNoteId={editingNoteId}
                    handleStartEdit={handleStartEdit}
                    handleCancelEdit={handleCancelEdit}
                    mentionEntities={mentionEntities}
                    connectionStatus={connectionStatus}
                    failedEventIds={failedEventIds}
                    handleRetry={handleRetry}
                />
            ) : activeTab === "Mundo" ? (
                <WorldTab 
                    subTabMundo={subTabMundo}
                    setSubTabMundo={setSubTabMundo}
                    setShowAddWorldEntity={setShowAddWorldEntity}
                    setNewEntityType={setNewEntityType}
                    bestiarySearch={bestiarySearch}
                    setBestiarySearch={setBestiarySearch}
                    bestiarySessionOnly={bestiarySessionOnly}
                    setBestiarySessionOnly={setBestiarySessionOnly}
                    userRole={userRole}
                    onRegisterThreat={onRegisterThreat}
                    bestiaryList={bestiaryList}
                    viewingBestiaryCharId={viewingBestiaryCharId}
                    setViewingBestiaryCharId={setViewingBestiaryCharId}
                    sessionId={sessionId}
                    userId={userId}
                    worldEntitiesForCurrentTab={worldEntitiesForCurrentTab}
                    setViewingEntityId={setViewingEntityId}
                    handleDeleteWorldEntity={handleDeleteWorldEntity}
                    handleStartEditWorldEntity={handleStartEditWorldEntity}
                    handleToggleAllVisibility={handleToggleAllVisibility}
                    handleUpdateFieldVisibility={handleUpdateFieldVisibility}
                    worldSearch={worldSearch}
                    setWorldSearch={setWorldSearch}
                    worldSearchSuggestions={worldSearchSuggestions}
                    state={state}
                    globalEventStore={globalEventStore}
                    uuidv4={uuidv4}
                    handleAddEntityNote={handleAddEntityNote}
                    handleDeleteEntityNote={handleDeleteEntityNote}
                    mentionEntities={mentionEntities}
                    worldFilters={worldFilters}
                    toggleWorldFilter={toggleWorldFilter}
                    worldFilterAvailableOptions={worldFilterAvailableOptions}
                />
            ) : activeTab === "Tempo" ? (
                <TimeTab
                    subTabTempo={subTabTempo}
                    setSubTabTempo={setSubTabTempo}
                    state={{
                        ...state,
                        missions: filteredMissions,
                        timeline: filteredTimeline
                    }}
                    userId={userId}
                    handlers={{
                        showAddMission, setShowAddMission,
                        newMissionName, setNewMissionName,
                        newMissionDescription, setNewMissionDescription,
                        newMissionSubTasks, setNewMissionSubTasks,
                        newSubTaskInput, setNewSubTaskInput,
                        newMissionDay, setNewMissionDay,
                        newMissionMonth, setNewMissionMonth,
                        newMissionYear, setNewMissionYear,
                        handleCreateMission, handleUpdateMission, handleDeleteMission, handleToggleSubTask,

                        showAddTimelineEvent, setShowAddTimelineEvent,
                        newTimelineName, setNewTimelineName,
                        newTimelineDescription, setNewTimelineDescription,
                        newTimelineDay, setNewTimelineDay,
                        newTimelineMonth, setNewTimelineMonth,
                        newTimelineYear, setNewTimelineYear,
                        timelineSortAsc, setTimelineSortAsc,
                        handleCreateTimelineEvent, handleDeleteTimelineEvent,
                        handleStartEditMission, handleStartEditTimelineEvent,
                        handleCancelMissionEdit, handleCancelTimelineEdit,
                        handleAddEntityNote
                    }}
                    userRole={userRole}
                    mentionEntities={mentionEntities}
                />


            ) : activeTab === "Jogo" ? (
                <GameTab
                    subTabJogo={subTabJogo}
                    setSubTabJogo={setSubTabJogo}
                    state={{
                        ...state,
                        skills: filteredSkills,
                        items: filteredItems
                    }}
                    userId={userId}
                    handlers={{
                        showAddSkill, setShowAddSkill,
                        newSkillName, setNewSkillName,
                        newSkillDescription, setNewSkillDescription,
                        newSkillRequirement, setNewSkillRequirement,
                        newSkillColor, setNewSkillColor,
                        handleCreateSkill, handleUpdateSkill, handleDeleteSkill,

                        showAddItem, setShowAddItem,
                        newItemName, setNewItemName,
                        newItemDescription, setNewItemDescription,
                        newItemPrice, setNewItemPrice,
                        newItemQuantity, setNewItemQuantity,
                        newItemRequirement, setNewItemRequirement,
                        handleCreateItem, handleUpdateItem, handleDeleteItem,
                        handleStartEditSkill, handleStartEditItem,
                        handleCancelSkillEdit, handleCancelItemEdit,
                        handleAddEntityNote,
                        COLOR_PRESETS

                    }}
                    userRole={userRole}
                    mentionEntities={mentionEntities}
                />

            ) : (
                <div className="tab-content-area scrollbar-arcane">
                    <div className="section-block">
                        <h4 className="section-label">INFORMAÇÕES DA SESSÃO</h4>
                        <div className="system-info-list">
                            <div className="info-item"><label>ID DA SESSÃO</label><span>{sessionId}</span></div>
                            <div className="info-item"><label>USUÁRIO</label><span>{userId.toUpperCase()}</span></div>
                            <div className="info-item"><label>FUNÇÃO</label><span>{userRole || "DESCONHECIDO"}</span></div>
                        </div>
                    </div>
                </div>
            )}

            {showAddWorldEntity && (
                <CreateWorldEntityModal 
                    setShowAddWorldEntity={setShowAddWorldEntity}
                    newEntityName={newEntityName}
                    setNewEntityName={setNewEntityName}
                    newEntityType={newEntityType}
                    setNewEntityType={setNewEntityType}
                    setImportBestiaryId={setImportBestiaryId}
                    TYPE_LABELS={TYPE_LABELS}
                    newEntityColor={newEntityColor}
                    setNewEntityColor={setNewEntityColor}
                    LOC_CATEGORIES={LOCATION_CATEGORIES}
                    locSearch={locSearch}
                    setLocSearch={setLocSearch}
                    setNewEntityLocationType={setNewEntityLocationType}
                    newEntityLocationType={newEntityLocationType}
                    newEntityLinkedLocation={newEntityLinkedLocation}
                    setNewEntityLinkedLocation={setNewEntityLinkedLocation}
                    locationsList={locationsList}
                    newEntityImageUrl={newEntityImageUrl}
                    setNewEntityImageUrl={setNewEntityImageUrl}
                    newEntityProfession={newEntityProfession}
                    setNewEntityProfession={setNewEntityProfession}
                    COLOR_PRESETS={COLOR_PRESETS}
                    importBestiaryId={importBestiaryId}
                    bestiaryList={bestiaryList}
                    newEntityDescription={newEntityDescription}
                    setNewEntityDescription={setNewEntityDescription}
                    newEntityFamily={newEntityFamily}
                    setNewEntityFamily={setNewEntityFamily}
                    familiesList={familiesList}
                    newEntityRace={newEntityRace}
                    setNewEntityRace={setNewEntityRace}
                    racesList={racesList}
                    newEntityOrigin={newEntityOrigin}
                    setNewEntityOrigin={setNewEntityOrigin}
                    newEntityCurrentLoc={newEntityCurrentLoc}
                    setNewEntityCurrentLoc={setNewEntityCurrentLoc}
                    newEntityTags={newEntityTags}
                    tagInput={tagInput}
                    setTagInput={setTagInput}
                    handleAddTag={handleAddTag}
                    removeTag={removeTag}
                    handleCreateWorldEntity={handleCreateWorldEntity}
                    editingWorldEntityId={editingWorldEntityId}
                    handleCancelWorldEntityEdit={handleCancelWorldEntityEdit}
                    mentionEntities={mentionEntities}
                    religionsList={religionsList}
                    newEntityReligion={newEntityReligion}
                    setNewEntityReligion={setNewEntityReligion}
                    uniqueTags={uniqueTags}
                />
            )}

            <ViewWorldEntityModal
                viewingEntityId={viewingEntityId}
                viewingEntity={viewingEntity}
                setViewingEntityId={setViewingEntityId}
                TYPE_LABELS={TYPE_LABELS}
                state={state}
                handleDeleteWorldEntity={handleDeleteWorldEntity}
                handleAddEntityNote={handleAddEntityNote}
                handleDeleteEntityNote={handleDeleteEntityNote}
                mentionEntities={mentionEntities}
                userRole={userRole}
                sessionId={sessionId}
                userId={userId}
                handleUpdateFieldVisibility={handleUpdateFieldVisibility}
                handleAddDescriptionBlock={handleAddDescriptionBlock}
                handleUpdateDescriptionBlock={handleUpdateDescriptionBlock}
                handleDeleteDescriptionBlock={handleDeleteDescriptionBlock}
                handleToggleAllVisibility={handleToggleAllVisibility}
            />
        </div>
    );
}
