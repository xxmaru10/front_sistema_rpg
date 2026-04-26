import { Target, History, Zap, Package, Plus, Check, Trash2, Calendar, CheckSquare, Square, CheckCircle, Circle, EyeOff, Eye, X, Users } from "lucide-react";
import { renderMentions } from "@/lib/mentionUtils";
import { MentionEditor } from "@/components/MentionEditor";
import { LinkedNotes } from "./LinkedNotes";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useDeleteConfirm } from "../hooks/useDeleteConfirm";
import { ImageCropper } from "@/components/ImageCropper/ImageCropper";

type ListSortMode = "AZ" | "ZA";
type ListPageSize = 10 | 20 | 50;

function compareByName(aName?: string, bName?: string) {
    return (aName || "").localeCompare(bName || "", "pt-BR", { sensitivity: "base" });
}

function sortByName<T extends { name?: string }>(list: T[], mode: ListSortMode): T[] {
    const sorted = [...list].sort((a, b) => compareByName(a.name, b.name));
    return mode === "ZA" ? sorted.reverse() : sorted;
}

interface TimeTabProps {
    subTabTempo: string;
    setSubTabTempo: (tab: any) => void;
    state: any;
    handlers: any;
    userRole?: string;
    mentionEntities: any[];
    userId?: string;
}



export function TimeTab({ subTabTempo, setSubTabTempo, state, handlers, userRole, mentionEntities, userId }: TimeTabProps) {
    const { requestDelete, isPending } = useDeleteConfirm();

    const {
        showAddMission, setShowAddMission,
        newMissionName, setNewMissionName,
        newMissionDescription, setNewMissionDescription,
        newMissionSubTasks, setNewMissionSubTasks,
        newSubTaskInput, setNewSubTaskInput,
        newMissionDay, setNewMissionDay,
        newMissionMonth, setNewMissionMonth,
        newMissionYear, setNewMissionYear,
        handleCreateMission, handleUpdateMission, handleDeleteMission, handleToggleSubTask, handleAddSubTask,


        showAddTimelineEvent, setShowAddTimelineEvent,
        newTimelineName, setNewTimelineName,
        newTimelineDescription, setNewTimelineDescription,
        newTimelineDay, setNewTimelineDay,
        newTimelineMonth, setNewTimelineMonth,
        newTimelineYear, setNewTimelineYear,
        handleCreateTimelineEvent, handleDeleteTimelineEvent,
        handleStartEditMission, handleCancelMissionEdit,
        handleStartEditTimelineEvent, handleCancelTimelineEdit,
        handleAddEntityNote, handleDeleteEntityNote
    } = handlers;

    const missions = state.missions || [];
    const timeline = state.timeline || [];
    const [sortMode, setSortMode] = useState<ListSortMode>("AZ");
    const [itemsPerPage, setItemsPerPage] = useState<ListPageSize>(10);
    const [page, setPage] = useState(0);

    const orderedMissions = useMemo(
        () => sortByName(missions, sortMode),
        [missions, sortMode]
    );

    const allEvents = useMemo(
        () => ([
            ...timeline,
            ...missions
                .filter((m: any) => !m.hideFromTimeline)
                .map((m: any) => ({
                    id: m.id,
                    name: m.name,
                    description: m.description,
                    day: m.day,
                    month: m.month,
                    year: m.year,
                    type: "MISSION",
                    createdAt: m.createdAt
                }))
        ]),
        [missions, timeline]
    );

    const orderedEvents = useMemo(
        () => sortByName(allEvents, sortMode),
        [allEvents, sortMode]
    );

    const activeSource = subTabTempo === "MissÍµes" ? orderedMissions : orderedEvents;
    const totalPages = Math.max(1, Math.ceil(activeSource.length / itemsPerPage));

    const paginatedMissions = useMemo(() => {
        const start = page * itemsPerPage;
        return orderedMissions.slice(start, start + itemsPerPage);
    }, [orderedMissions, page, itemsPerPage]);

    const paginatedEvents = useMemo(() => {
        const start = page * itemsPerPage;
        return orderedEvents.slice(start, start + itemsPerPage);
    }, [orderedEvents, page, itemsPerPage]);

    const activeMissions = useMemo(
        () => paginatedMissions.filter((m: any) => !m.completed),
        [paginatedMissions]
    );
    const completedMissions = useMemo(
        () => paginatedMissions.filter((m: any) => m.completed),
        [paginatedMissions]
    );

    useEffect(() => {
        setPage(0);
    }, [subTabTempo, sortMode, itemsPerPage, missions.length, timeline.length]);

    useEffect(() => {
        const maxPage = Math.max(0, totalPages - 1);
        if (page > maxPage) setPage(maxPage);
    }, [page, totalPages]);

    return (
        <div className="tab-content-combined">
            <div className="navigator-controls">
                <span className="navigator-label">CRONOLOGIA: {subTabTempo.toUpperCase()}</span>
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
                {(subTabTempo === "MissÍµes" || (subTabTempo === "Linha do Tempo" && userRole === "GM")) && (
                    <button
                        className="add-world-entity-btn-mini"
                        style={{ marginLeft: 'auto', width: '36px', height: '36px', flexShrink: 0 }}
                        title={`Adicionar ${subTabTempo === "MissÍµes" ? "Missão" : "Evento"}`}
                        onClick={() => subTabTempo === "MissÍµes" ? setShowAddMission(true) : setShowAddTimelineEvent(true)}
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>

            <div className="sub-content-area scrollbar-arcane">
                {subTabTempo === "MissÍµes" && (
                    <div className="missions-page">
                        <div className="missions-lists">

                            <div className="mission-section">
                                <h4 className="section-label">MISSÍ•ES ATIVAS</h4>
                                <div className="missions-grid">
                                    {activeMissions.length === 0 ? (
                                        <p className="empty-msg">Nenhuma missão ativa.</p>
                                    ) : (
                                        activeMissions.map((mission: any) => (
                                            <MissionCard key={mission.id} mission={mission} onToggleSubTask={handleToggleSubTask} onAddSubTask={handleAddSubTask} onUpdate={handleUpdateMission} onDelete={handleDeleteMission} onEdit={handleStartEditMission} userRole={userRole} mentionEntities={mentionEntities} onAddNote={handleAddEntityNote} onDeleteNote={handleDeleteEntityNote} userId={userId} />
                                        ))
                                    )}

                                </div>
                            </div>

                            <div className="mission-section mt-6">
                                <h4 className="section-label">MISSÍ•ES CONCLUÍDAS</h4>
                                <div className="missions-grid completed">
                                    {completedMissions.length === 0 ? (
                                        <p className="empty-msg">Nenhuma missão concluÍ­da.</p>
                                    ) : (
                                        completedMissions.map((mission: any) => (
                                            <MissionCard key={mission.id} mission={mission} onToggleSubTask={handleToggleSubTask} onAddSubTask={handleAddSubTask} onUpdate={handleUpdateMission} onDelete={handleDeleteMission} onEdit={handleStartEditMission} userRole={userRole} mentionEntities={mentionEntities} onAddNote={handleAddEntityNote} onDeleteNote={handleDeleteEntityNote} userId={userId} />
                                        ))
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {subTabTempo === "Linha do Tempo" && (
                    <div className="timeline-page">
                        <div className="timeline-list">
                            {paginatedEvents.length === 0 ? (
                                <p className="empty-msg">Nenhum evento registrado.</p>
                            ) : (
                                paginatedEvents.map((event: any) => (
                                    <div key={event.id} className={`timeline-item ${event.type === 'MISSION' ? 'mission-event' : ''}`}>
                                        <div className="timeline-marker"></div>
                                        <div className="timeline-content card-bg ornate-border">
                                            <div className="timeline-date">
                                                <Calendar size={12} />
                                                <span>{event.day ? `${event.day}/${event.month}/` : ""}{event.year}</span>
                                                {event.type === 'MISSION' && <span className="mission-tag">MISSÀO</span>}
                                            </div>
                                            <div className="timeline-title-row">
                                                <h5 className="event-name">{event.name.toUpperCase()}</h5>
                                                <div className="event-actions">
                                                    {userRole === 'GM' && (
                                                        <>
                                                            {event.type === 'MISSION' ? (
                                                                <button
                                                                    className="hide-timeline-btn"
                                                                    onClick={() => handleUpdateMission(event.id, { hideFromTimeline: true })}
                                                                    title="Remover da linha do tempo"
                                                                >
                                                                    <EyeOff size={14} />
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    className="edit-btn-mini"
                                                                    onClick={() => handleStartEditTimelineEvent(event.id)}
                                                                    title="Editar evento"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                                </button>
                                                            )}

                                                            <button
                                                                className="del-btn"
                                                                onClick={() => requestDelete(event.id, () => event.type === 'MISSION' ? handleDeleteMission(event.id) : handleDeleteTimelineEvent(event.id))}
                                                                title={isPending(event.id) ? "Clique para confirmar exclusão" : "Excluir"}
                                                                style={{ color: isPending(event.id) ? '#00cc66' : undefined }}
                                                            >
                                                                {isPending(event.id) ? <Check size={20} /> : <Trash2 size={20} />}
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                             <p className="event-desc" dangerouslySetInnerHTML={{ __html: renderMentions(event.description) }} />
                                             <LinkedNotes
                                                notes={event.linkedNotes || []}
                                                onAddNote={(content: string, isPrivate?: boolean) => handleAddEntityNote(event.type === 'MISSION' ? 'MISSION' : 'TIMELINE', event.id, content, isPrivate)}
                                                onDeleteNote={(noteId: string) => handleDeleteEntityNote(event.type === 'MISSION' ? 'MISSION' : 'TIMELINE', event.id, noteId)}
                                                mentionEntities={mentionEntities}
                                                hideTitle={true}
                                                userId={userId}
                                                userRole={userRole}
                                             />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* MODALS */}
            {showAddMission && typeof document !== 'undefined' ? createPortal(
                <div className="modal-overlay">
                    <div className="modal-content solid mission-modal ornate-border">
                        <h3 className="modal-title gold-text">{handlers.editingMissionId ? "EDITAR MISSÀO" : "CRIAR NOVA MISSÀO"}</h3>

                        <div className="form-group">
                            <label>NOME DA MISSÀO</label>
                            <input
                                type="text"
                                value={newMissionName}
                                onChange={(e) => setNewMissionName(e.target.value)}
                                placeholder="Ex: O Resgate do Ferreiro"
                            />
                        </div>
                        <div className="form-group">
                            <label>DESCRIÍ‡ÀO</label>
                            <MentionEditor
                                value={newMissionDescription}
                                onChange={setNewMissionDescription}
                                placeholder="Detalhes da missão..."
                                mentionEntities={mentionEntities}
                            />
                        </div>
                        <div className="form-group">
                            <label>SUB-TAREFAS (CHECKBOXES)</label>
                            <div className="tag-input-wrapper">
                                <input
                                    type="text"
                                    value={newSubTaskInput}
                                    onChange={(e) => setNewSubTaskInput(e.target.value)}
                                    placeholder="Escreva e aperte Enter..."
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newSubTaskInput.trim()) {
                                            setNewMissionSubTasks([...newMissionSubTasks, { id: uuidv4(), text: newSubTaskInput, completed: false }]);
                                            setNewSubTaskInput("");
                                        }
                                    }}
                                />
                            </div>
                            <div className="mission-tasks-preview scrollbar-arcane">
                                {newMissionSubTasks.length === 0 ? (
                                    <div className="empty-tasks-hint">Nenhuma sub-tarefa adicionada.</div>
                                ) : (
                                    newMissionSubTasks.map((st: any) => (
                                        <div key={st.id} className="task-preview-item">
                                            <Square size={14} className="gold-text opacity-50" />
                                            <span>{st.text}</span>
                                            <button className="remove-task-btn" onClick={() => setNewMissionSubTasks(newMissionSubTasks.filter((t: any) => t.id !== st.id))}>Í—</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="form-row-triple">
                            <div className="form-group">
                                <label>DIA (OPCIONAL)</label>
                                <input type="number" value={newMissionDay || ""} onChange={(e) => setNewMissionDay(e.target.value ? parseInt(e.target.value) : undefined)} placeholder="01" />
                            </div>
                            <div className="form-group">
                                <label>MÊS (OPCIONAL)</label>
                                <input type="number" value={newMissionMonth || ""} onChange={(e) => setNewMissionMonth(e.target.value ? parseInt(e.target.value) : undefined)} placeholder="01" />
                            </div>
                            <div className="form-group">
                                <label>ANO</label>
                                <input type="number" value={newMissionYear} onChange={(e) => setNewMissionYear(parseInt(e.target.value))} />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={handleCancelMissionEdit}>CANCELAR</button>
                            <button className="confirm-btn" onClick={handleCreateMission}>
                                {handlers.editingMissionId ? "SALVAR ALTERAÍ‡Í•ES" : "CRIAR MISSÀO"}
                            </button>
                        </div>
                    </div>
                </div>, document.body
            ) : null}

            {showAddTimelineEvent && typeof document !== 'undefined' ? createPortal(
                <div className="modal-overlay">
                    <div className="modal-content solid event-modal ornate-border">
                        <h3 className="modal-title gold-text">{handlers.editingTimelineEventId ? "EDITAR EVENTO" : "REGISTRAR EVENTO HISTÓRICO"}</h3>

                        <div className="form-group">
                            <label>NOME DO EVENTO</label>
                            <input
                                type="text"
                                value={newTimelineName}
                                onChange={(e) => setNewTimelineName(e.target.value)}
                                placeholder="Ex: O Grande Incêndio"
                            />
                        </div>
                        <div className="form-group">
                            <label>DESCRIÍ‡ÀO</label>
                            <MentionEditor
                                value={newTimelineDescription}
                                onChange={setNewTimelineDescription}
                                placeholder="O que aconteceu?"
                                mentionEntities={mentionEntities}
                            />
                        </div>
                        <div className="form-row-triple">
                            <div className="form-group">
                                <label>DIA (OPCIONAL)</label>
                                <input type="number" value={newTimelineDay || ""} onChange={(e) => setNewTimelineDay(e.target.value ? parseInt(e.target.value) : undefined)} placeholder="01" />
                            </div>
                            <div className="form-group">
                                <label>MÊS (OPCIONAL)</label>
                                <input type="number" value={newTimelineMonth || ""} onChange={(e) => setNewTimelineMonth(e.target.value ? parseInt(e.target.value) : undefined)} placeholder="01" />
                            </div>
                            <div className="form-group">
                                <label>ANO</label>
                                <input type="number" value={newTimelineYear} onChange={(e) => setNewTimelineYear(parseInt(e.target.value))} />
                            </div>
                        </div>

                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={handleCancelTimelineEdit}>CANCELAR</button>
                            <button className="confirm-btn" onClick={handleCreateTimelineEvent}>
                                {handlers.editingTimelineEventId ? "SALVAR ALTERAÍ‡Í•ES" : "REGISTRAR EVENTO"}
                            </button>
                        </div>
                    </div>
                </div>, document.body
            ) : null}
        </div>
    );
}

function MissionCard({ mission, onToggleSubTask, onAddSubTask, onUpdate, onDelete, onEdit, userRole, mentionEntities, onAddNote, onDeleteNote, userId }: { mission: any, onToggleSubTask: any, onAddSubTask: any, onUpdate: any, onDelete: any, onEdit: any, userRole?: string, mentionEntities: any[], onAddNote: any, onDeleteNote?: any, userId?: string }) {
    const { requestDelete, isPending } = useDeleteConfirm();
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(mission.name);
    const [editDesc, setEditDesc] = useState(mission.description);

    const handleSave = () => {
        onUpdate(mission.id, { name: editName, description: editDesc });
        setIsEditing(false);
    };

    return (
        <div className={`mission-card card-bg ornate-border ${mission.completed ? 'completed' : ''}`}>
            <div className="mission-header">
                <h5 className="mission-title">{mission.name.toUpperCase()}</h5>
                <div className="mission-actions">
                    {!mission.completed && (
                        <button className="complete-btn" onClick={() => onUpdate(mission.id, { completed: true })} title="Concluir">
                            <CheckCircle size={14} />
                        </button>
                    )}
                    {mission.completed && (
                        <button className="reopen-btn" onClick={() => onUpdate(mission.id, { completed: false })} title="Reabrir">
                            <History size={14} />
                        </button>
                    )}

                    {userRole === 'GM' && (
                        <>
                            <button className="edit-btn" onClick={() => onEdit(mission.id)} title="Editar missão completa">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>

                            <button className="timeline-toggle-btn" onClick={() => onUpdate(mission.id, { hideFromTimeline: !mission.hideFromTimeline })} title={mission.hideFromTimeline ? "Mostrar na linha do tempo" : "Ocultar na linha do tempo"}>
                                {mission.hideFromTimeline ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                        </>
                    )}

                    {userRole === 'GM' && (
                        <button
                            className="del-btn"
                            onClick={() => requestDelete(mission.id, () => onDelete(mission.id))}
                            title={isPending(mission.id) ? "Clique para confirmar exclusão" : "Excluir"}
                            style={{ color: isPending(mission.id) ? '#00cc66' : undefined }}
                        >
                            {isPending(mission.id) ? <Check size={20} /> : <Trash2 size={20} />}
                        </button>
                    )}

                </div>
            </div>

            <p className="mission-desc" dangerouslySetInnerHTML={{ __html: renderMentions(mission.description) }} />

            <div className="mission-tasks">
                {mission.subTasks.map((task: any) => (
                    <div key={task.id} className={`mission-task-item ${task.completed ? 'done' : ''}`} onClick={() => onToggleSubTask(mission.id, task.id)}>
                        {task.completed ? <CheckSquare size={14} className="check-icon" /> : <Square size={14} className="check-icon" />}
                        <span>{task.text}</span>
                    </div>
                ))}
            </div>

            {!mission.completed && (
                <div className="add-task-inline" style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Plus size={14} className="gold-text" />
                    <input
                        type="text"
                        placeholder="Nova tarefa..."
                        style={{
                            background: 'none',
                            border: 'none',
                            borderBottom: '1px solid rgba(var(--accent-rgb), 0.2)',
                            color: '#fff',
                            fontSize: '0.7rem',
                            flex: 1,
                            padding: '2px 0'
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                                onAddSubTask(mission.id, e.currentTarget.value);
                                e.currentTarget.value = "";
                            }
                        }}
                    />
                </div>
            )}

            <LinkedNotes
                notes={mission.linkedNotes || []}
                onAddNote={(content: string, isPrivate?: boolean) => onAddNote('MISSION', mission.id, content, isPrivate)}
                onDeleteNote={onDeleteNote ? (noteId: string) => onDeleteNote('MISSION', mission.id, noteId) : undefined}
                mentionEntities={mentionEntities}
                hideTitle={true}
                userId={userId}
                userRole={userRole}
            />
        </div>
    );
}

interface GameTabProps {
    subTabJogo: string;
    setSubTabJogo: (tab: any) => void;
    state: any;
    handlers: any;
    userRole?: string;
    mentionEntities: any[];
    userId?: string;
}

export function GameTab({ subTabJogo, setSubTabJogo, state, handlers, userRole, mentionEntities, userId }: GameTabProps) {
    const { requestDelete, isPending } = useDeleteConfirm();

    // â”€â”€ Item image crop state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [isCroppingItem, setIsCroppingItem] = useState(false);
    const [tempItemCropSrc, setTempItemCropSrc] = useState<string | null>(null);

    const {
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
        newItemBonus, setNewItemBonus,
        newItemSize, setNewItemSize,
        newItemRequirement, setNewItemRequirement,
        newItemImageUrl, setNewItemImageUrl,
        editingItemId,
        handleCreateItem, handleUpdateItem, handleDeleteItem,
        handleStartEditSkill, handleCancelSkillEdit,
        handleStartEditItem, handleCancelItemEdit,
        handleAddEntityNote, handleDeleteEntityNote,
        COLOR_PRESETS
    } = handlers;

    const itemDescriptionMentionEntities = useMemo(() => {
        const draftName = (newItemName || "").trim();
        if (!draftName) return mentionEntities;

        const draftEntity = {
            id: editingItemId || "__draft_global_item__",
            name: draftName,
            category: "Jogo",
            displayType: "ITEM",
            type: "ITEM",
            color: "#f8e71c"
        };

        const normalizedDraftName = draftName.toLowerCase();
        return [
            draftEntity,
            ...(mentionEntities || []).filter((entity) => (entity?.name || "").trim().toLowerCase() !== normalizedDraftName)
        ];
    }, [editingItemId, mentionEntities, newItemName]);


    const skills = state.skills || [];
    const items = state.items || [];
    const [sortMode, setSortMode] = useState<ListSortMode>("AZ");
    const [itemsPerPage, setItemsPerPage] = useState<ListPageSize>(10);
    const [page, setPage] = useState(0);

    const orderedSkills = useMemo(() => sortByName(skills, sortMode), [skills, sortMode]);
    const orderedItems = useMemo(() => sortByName(items, sortMode), [items, sortMode]);
    const activeSource = subTabJogo === "Habilidades" ? orderedSkills : orderedItems;
    const totalPages = Math.max(1, Math.ceil(activeSource.length / itemsPerPage));

    const paginatedSkills = useMemo(() => {
        const start = page * itemsPerPage;
        return orderedSkills.slice(start, start + itemsPerPage);
    }, [orderedSkills, page, itemsPerPage]);

    const paginatedItems = useMemo(() => {
        const start = page * itemsPerPage;
        return orderedItems.slice(start, start + itemsPerPage);
    }, [orderedItems, page, itemsPerPage]);

    useEffect(() => {
        setPage(0);
    }, [subTabJogo, sortMode, itemsPerPage, skills.length, items.length]);

    useEffect(() => {
        const maxPage = Math.max(0, totalPages - 1);
        if (page > maxPage) setPage(maxPage);
    }, [page, totalPages]);

    return (
        <div className="tab-content-combined">
            <div className="navigator-controls">
                <span className="navigator-label">SISTEMA:</span>
                <select
                    className="victorian-select"
                    value={subTabJogo}
                    onChange={(e) => setSubTabJogo(e.target.value as any)}
                >
                    <option value="Habilidades">HABILIDADES</option>
                    <option value="Itens">ITENS E EQUIPAMENTOS</option>
                </select>
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

                {userRole === 'GM' && subTabJogo !== 'Jogadores' && (
                    <button
                        className="add-world-entity-btn-mini"
                        style={{ marginLeft: 'auto', width: '36px', height: '36px', flexShrink: 0 }}
                        title={`Adicionar ${subTabJogo === "Habilidades" ? "Habilidade" : "Item"}`}
                        onClick={() => subTabJogo === "Habilidades" ? setShowAddSkill(true) : setShowAddItem(true)}
                    >
                        <Plus size={18} />
                    </button>
                )}
            </div>

            <div className="sub-content-area scrollbar-arcane">
                {subTabJogo === "Habilidades" && (
                    <div className="skills-page">
                        <div className="skills-grid">
                            {paginatedSkills.length === 0 ? (
                                <p className="empty-msg">Nenhuma habilidade registrada.</p>
                            ) : (
                                paginatedSkills.map((skill: any) => (
                                    <div key={skill.id} className="skill-item-card card-bg ornate-border" style={{ borderLeft: `4px solid ${skill.color || 'var(--accent-color)'}` }}>
                                        <div className="skill-header">
                                            <h5 className="skill-title" style={{ color: skill.color || 'var(--accent-color)' }}>{skill.name.toUpperCase()}</h5>
                                            {userRole === 'GM' && (
                                                <div className="card-actions-mini">
                                                    <button className="edit-btn-mini" onClick={() => handleStartEditSkill(skill.id)} title="Editar">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    </button>
                                                    <button
                                                        className="del-btn-mini"
                                                        onClick={() => requestDelete(skill.id, () => handleDeleteSkill(skill.id))}
                                                        title={isPending(skill.id) ? "Clique para confirmar exclusão" : "Excluir"}
                                                        style={{ color: isPending(skill.id) ? '#00cc66' : undefined }}
                                                    >
                                                        {isPending(skill.id) ? <Check size={20} /> : <Trash2 size={20} />}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="skill-req">
                                            <label>REQUISITO:</label>
                                            <span>{skill.requirement || "NENHUM"}</span>
                                        </div>
                                         <p className="skill-desc" dangerouslySetInnerHTML={{ __html: renderMentions(skill.description) }} />
                                         <LinkedNotes
                                            notes={skill.linkedNotes || []}
                                            onAddNote={(content: string, isPrivate?: boolean) => handleAddEntityNote('SKILL', skill.id, content, isPrivate)}
                                            onDeleteNote={(noteId: string) => handleDeleteEntityNote('SKILL', skill.id, noteId)}
                                            mentionEntities={mentionEntities}
                                            hideTitle={true}
                                            userId={userId}
                                            userRole={userRole}
                                         />
                                    </div>
                                ))
                            )}
                        </div>

                    </div>
                )}

                {subTabJogo === "Itens" && (
                    <div className="items-page">
                        <div className="items-grid">
                            {paginatedItems.length === 0 ? (
                                <p className="empty-msg">Nenhum item registrado.</p>
                            ) : (
                                paginatedItems.map((item: any) => (
                                    <div key={item.id} className="global-item-card card-bg ornate-border">
                                        <div className="item-header">
                                            <h5 className="item-title">{item.name.toUpperCase()}</h5>
                                            <div className="item-meta">
                                                <span className="item-price gold-text">${item.price}</span>
                                                <span className="item-qty">QTD: {item.quantity}</span>
                                                <span className="item-qty">BONUS: {item.bonus || 0}</span>
                                                <span className="item-qty">TAM: {item.size || "-"}</span>
                                                {userRole === 'GM' && (
                                                    <div className="card-actions-mini">
                                                        <button className="edit-btn-mini" onClick={() => handleStartEditItem(item.id)} title="Editar">
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                        </button>
                                                        <button
                                                            className="del-btn-mini"
                                                            onClick={() => requestDelete(item.id, () => handleDeleteItem(item.id))}
                                                            title={isPending(item.id) ? "Clique para confirmar exclusão" : "Excluir"}
                                                            style={{ color: isPending(item.id) ? '#00cc66' : undefined }}
                                                        >
                                                            {isPending(item.id) ? <Check size={20} /> : <Trash2 size={20} />}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="item-main-content">
                                            {item.imageUrl && (
                                                <div className="item-card-thumb">
                                                    <img src={item.imageUrl} alt={item.name} />
                                                </div>
                                            )}
                                            <div className="item-text-info">
                                                <div className="skill-req">
                                                    <label>REQUISITO:</label>
                                                    <span>{item.requirement || "NENHUM"}</span>
                                                </div>
                                                <p className="item-desc" dangerouslySetInnerHTML={{ __html: renderMentions(item.description) }} />
                                            </div>
                                        </div>
                                         <LinkedNotes
                                            notes={item.linkedNotes || []}
                                            onAddNote={(content: string, isPrivate?: boolean) => handleAddEntityNote('ITEM', item.id, content, isPrivate)}
                                            onDeleteNote={(noteId: string) => handleDeleteEntityNote('ITEM', item.id, noteId)}
                                            mentionEntities={mentionEntities}
                                            hideTitle={true}
                                            userId={userId}
                                            userRole={userRole}
                                         />
                                    </div>

                                ))
                            )}
                        </div>
                    </div>
                )}

            {/* Jogadores removidos conforme solicitado */}

            </div>

            {/* MODALS */}
            {showAddSkill && typeof document !== 'undefined' ? createPortal(
                <div className="modal-overlay">
                    <div className="modal-content solid ornate-border mission-modal">
                        <h3 className="modal-title gold-text">{handlers.editingSkillId ? "EDITAR HABILIDADE" : "CRIAR HABILIDADE"}</h3>
                        <div className="form-group">
                            <label>NOME DA HABILIDADE</label>
                            <input type="text" value={newSkillName} onChange={(e) => setNewSkillName(e.target.value)} placeholder="Ex: Golpe Flamejante" />
                        </div>
                        <div className="form-group">
                            <label>REQUISITO</label>
                            <input type="text" value={newSkillRequirement} onChange={(e) => setNewSkillRequirement(e.target.value)} placeholder="Ex: ForÍ§a 2+" />
                        </div>
                        <div className="form-group">
                            <label>DESCRIÍ‡ÀO</label>
                            <MentionEditor value={newSkillDescription} onChange={setNewSkillDescription} placeholder="O que esta habilidade faz?" mentionEntities={mentionEntities} />
                        </div>
                        <div className="form-group">
                            <label>COR DO CARD</label>
                            <div className="color-presets-row">
                                {COLOR_PRESETS.map((c: string) => (
                                    <div
                                        key={c}
                                        className={`color-preset-circle ${newSkillColor === c ? 'active' : ''}`}
                                        style={{ backgroundColor: c }}
                                        onClick={() => setNewSkillColor(c)}
                                    />
                                ))}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={handleCancelSkillEdit}>CANCELAR</button>
                            <button className="confirm-btn" onClick={handleCreateSkill}>
                                {handlers.editingSkillId ? "SALVAR ALTERAÍ‡Í•ES" : "CRIAR"}
                            </button>
                        </div>
                    </div>
                </div>, document.body
            ) : null}

            {showAddItem && typeof document !== 'undefined' ? createPortal(
                <div className="modal-overlay">
                    <div className="modal-content solid ornate-border mission-modal">
                        <h3 className="modal-title gold-text">{handlers.editingItemId ? "EDITAR ITEM" : "CRIAR ITEM"}</h3>
                        <div className="form-group">
                            <label>NOME DO ITEM</label>
                            <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Ex: PoÍ§ão de Cura" />
                        </div>
                        <div className="form-group">
                            <label>REQUISITO</label>
                            <input type="text" value={newItemRequirement} onChange={(e) => setNewItemRequirement(e.target.value)} placeholder="Ex: Inteligência 1+" />
                        </div>

                        <div className="form-group">
                            <label>DESCRIÍ‡ÀO</label>
                            <MentionEditor value={newItemDescription} onChange={setNewItemDescription} placeholder="O que este item faz?" mentionEntities={itemDescriptionMentionEntities} />
                        </div>
                        <div className="form-row-double" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
                            <div className="form-group">
                                <label>PREÍ‡O ($)</label>
                                <input type="number" value={newItemPrice} onChange={(e) => setNewItemPrice(parseInt(e.target.value))} />
                            </div>
                            <div className="form-group">
                                <label>QUANTIDADE</label>
                                <input type="number" value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value))} />
                            </div>
                            <div className="form-group">
                                <label>BONUS</label>
                                <input type="number" value={newItemBonus} onChange={(e) => setNewItemBonus(parseInt(e.target.value) || 0)} />
                            </div>
                            <div className="form-group">
                                <label>TAMANHO</label>
                                <select className="victorian-select" value={newItemSize || ""} onChange={(e) => setNewItemSize((e.target.value || undefined) as any)}>
                                    <option value="">SEM TAMANHO</option>
                                    <option value="L">L</option>
                                    <option value="M">M</option>
                                    <option value="G">G</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label>IMAGEM DO ITEM (PNG ou JPEG)</label>
                            <p style={{ fontSize: '0.65rem', color: 'var(--accent-color)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px', opacity: 0.9 }}>
                                <span style={{ fontWeight: 'bold', letterSpacing: '0.05em' }}>AVISO:</span> ResoluÍ§ão recomendada: 800x800 para melhor performance.
                            </p>
                            <input
                                type="file"
                                accept=".png, .jpg, .jpeg"
                                onChange={e => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const blobUrl = URL.createObjectURL(file);
                                    const img = new Image();
                                    img.onload = () => {
                                        if (img.width > 800 || img.height > 800) {
                                            setTempItemCropSrc(blobUrl);
                                            setIsCroppingItem(true);
                                        } else {
                                            const canvas = document.createElement('canvas');
                                            canvas.width = img.width;
                                            canvas.height = img.height;
                                            const ctx = canvas.getContext('2d');
                                            if (ctx) {
                                                ctx.drawImage(img, 0, 0);
                                                setNewItemImageUrl(canvas.toDataURL('image/jpeg', 0.85));
                                            }
                                            URL.revokeObjectURL(blobUrl);
                                        }
                                    };
                                    img.onerror = () => URL.revokeObjectURL(blobUrl);
                                    img.src = blobUrl;
                                }}
                                style={{ width: '100%', background: '#222', color: '#fff', border: '1px solid #444', padding: '8px' }}
                            />
                            {newItemImageUrl && (
                                <div style={{ marginTop: '10px', position: 'relative', width: '200px', height: '120px', border: '1px solid #444', overflow: 'hidden' }}>
                                    <img src={newItemImageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button
                                        onClick={() => setNewItemImageUrl("")}
                                        style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', cursor: 'pointer', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={handleCancelItemEdit}>CANCELAR</button>
                            <button className="confirm-btn" onClick={handleCreateItem}>
                                {handlers.editingItemId ? "SALVAR ALTERAÍ‡Í•ES" : "CRIAR"}
                            </button>
                        </div>
                    </div>
                </div>, document.body
            ) : null}

            {isCroppingItem && tempItemCropSrc && (
                <ImageCropper
                    src={tempItemCropSrc}
                    aspectRatio={1}
                    outputWidth={800}
                    outputHeight={800}
                    onConfirm={base64 => {
                        if (tempItemCropSrc.startsWith("blob:")) URL.revokeObjectURL(tempItemCropSrc);
                        setNewItemImageUrl(base64);
                        setIsCroppingItem(false);
                        setTempItemCropSrc(null);
                    }}
                    onCancel={() => {
                        if (tempItemCropSrc.startsWith("blob:")) URL.revokeObjectURL(tempItemCropSrc);
                        setIsCroppingItem(false);
                        setTempItemCropSrc(null);
                    }}
                />
            )}
        </div>
    );
}




