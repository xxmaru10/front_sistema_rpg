import { Book, Globe, Clock, Swords, Search, X, Filter, ChevronDown } from "lucide-react";
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

interface SessionNotesProps {
    sessionId: string;
    userId: string;
    userRole?: "GM" | "PLAYER";
    state: SessionState;
    globalBestiaryChars?: Character[];
    onRegisterThreat?: () => void;
}

export function SessionNotes({ sessionId, userId, userRole, state, globalBestiaryChars = [], onRegisterThreat }: SessionNotesProps) {
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
        locationsList,
        worldEntitiesForCurrentTab,
        worldSearchSuggestions,
        mentionEntities,
        filteredNotes,
        viewingEntity,
        
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
    const [showSuggestions, setShowSuggestions] = useState(false);

    const handleSelectSearchResult = (entity: any) => {
        if (entity.category === 'Mundo') {
            setActiveTab('Mundo');
            const typeToTab: any = {
                'PERSONAGEM': 'Personagens',
                'LOCALIZACAO': 'Localizações',
                'MAPA': 'Mapas',
                'FACAO': 'Facções',
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
                // Could highlight or scroll to if needed
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

                {activeTab === "Mundo" && (
                    <div className="world-filter-wrap" style={{ position: 'relative' }}>
                        <button 
                            className={`filter-toggle-btn ${showWorldFilters ? 'active' : ''}`}
                            onClick={() => setShowWorldFilters(!showWorldFilters)}
                            title="Filtros de Mundo"
                        >
                            <Filter size={14} />
                            <span>FILTROS</span>
                            <ChevronDown size={12} style={{ opacity: 0.5, transform: showWorldFilters ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                        </button>

                        {showWorldFilters && (
                            <div className="world-filters-dropdown global-dropdown scrollbar-arcane animate-fade-in" style={{ width: '280px', padding: '15px' }}>
                                <div className="filter-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                    <h5 style={{ fontSize: '0.7rem', color: 'var(--accent-color)' }}>FILTRAR {subTabMundo.toUpperCase()}</h5>
                                    <button onClick={() => setShowWorldFilters(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer' }}><X size={14} /></button>
                                </div>
                                <div className="filters-list-content scrollbar-arcane" style={{ maxHeight: 'calc(100vh - 250px)', overflowY: 'auto', paddingRight: '5px' }}>
                                    {worldFilterAvailableOptions.length === 0 ? (
                                        <p style={{ fontSize: '0.7rem', color: '#888', textAlign: 'center' }}>Nenhum filtro disponível para esta aba.</p>
                                    ) : (
                                        worldFilterAvailableOptions.map((group: any) => (
                                            <div key={group.field} className="filter-group" style={{ marginBottom: '12px' }}>
                                                <label style={{ fontSize: '0.6rem', color: '#888', display: 'block', marginBottom: '6px', fontWeight: 'bold' }}>{group.label}</label>
                                                <div className="filter-options-grid" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    {group.options.length === 0 ? (
                                                        <span style={{ fontSize: '0.65rem', color: '#555', fontStyle: 'italic' }}>Nada para filtrar...</span>
                                                    ) : (
                                                        group.options.map((opt: any) => (
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
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="notes-tabs-main" onClick={() => setShowSuggestions(false)}>
                {[
                    { id: "Notas", icon: <Book size={18} /> },
                    { id: "Mundo", icon: <Globe size={18} /> },
                    { id: "Tempo", icon: <Clock size={16} /> },
                    { id: "Jogo", icon: <Swords size={18} /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        className={`main-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                        onClick={() => setActiveTab(tab.id as any)}
                    >
                        {tab.icon}
                        <span>{tab.id.toUpperCase()}</span>
                    </button>
                ))}
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
                    state={state}
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
                    state={state}
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
