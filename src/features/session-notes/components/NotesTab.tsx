import { AlertTriangle, Bold, Check, ChevronDown, ChevronUp, Clock, GripVertical, Italic, List, Pencil, Plus, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MentionEditor } from "@/components/MentionEditor";
import { renderMentions } from "@/lib/mentionUtils";
import { LinkedNotes } from "./LinkedNotes";

interface NotesTabProps {
    notes: any[];
    filteredNotes: any[];
    userId: string;
    userRole?: "GM" | "PLAYER";
    authors: any[];
    filterAuthor: string;
    setFilterAuthor: (author: string) => void;
    editorContent: string;
    setEditorContent: (content: string) => void;
    editorRef: React.RefObject<HTMLDivElement | null>;
    scrollRef: React.RefObject<HTMLDivElement | null>;
    handleDeleteAll: () => void;
    handleClearNotesLocally: (tab: 'Geral' | 'Privado') => void;
    handleDelete: (noteId: string) => void;
    handleFormat: (command: string) => void;
    handleSend: () => void;
    getAuthorColor: (id: string, role?: string) => string;
    notesSubTab: "Geral" | "Privado" | "Jogadores" | "Sessão";
    editingNoteId: string | null;
    handleStartEdit: (noteId: string) => void;
    handleCancelEdit: () => void;
    mentionEntities: any[];
    state?: any;
    handleAddEntityNote?: (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, content: string, isPrivate?: boolean) => void;
    handleUpdateEntityNote?: (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, noteId: string, patch: any) => void;
    handleDeleteEntityNote?: (type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM', entityId: string, noteId: string) => void;
    connectionStatus?: string;
    failedEventIds?: Set<string>;
    handleRetry?: (noteId: string) => void;
    privateNoteFolders: any[];
    handleCreatePrivateFolder: (name: string, color: string) => boolean;
    handleUpdatePrivateFolder: (folderId: string, patch: any) => void;
    handleDeletePrivateFolder: (folderId: string) => void;
    handleMovePrivateNoteToFolder: (noteId: string, folderId: string | null) => void;
    handleReorderPrivateFolders: (orderedFolderIds: string[]) => void;
    selectedPrivateFolderId: string;
    setSelectedPrivateFolderId: (folderId: string) => void;
    selectedPlayerNotesView: string;
    setSelectedPlayerNotesView: (viewId: string) => void;
}

const NOTE_FOLDER_COLORS = [
    "#C5A059",
    "#4A90E2",
    "#50E3C2",
    "#B8E986",
    "#F5A623",
    "#D96C6C",
    "#BD10E0",
    "#7ED321"
];

function dedupeById<T extends { id: string }>(list: T[]): T[] {
    const merged = new Map<string, T>();
    list.forEach(item => merged.set(item.id, { ...(merged.get(item.id) || {}), ...item }));
    return Array.from(merged.values());
}

type NotesSortMode = "RECENT" | "AZ";
type NotesPageSize = 10 | 20 | 50;

function stripHtml(content: string): string {
    return (content || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function sortNotes(list: any[], mode: NotesSortMode): any[] {
    if (mode !== "AZ") return list;
    return [...list].sort((a, b) =>
        stripHtml(a?.content || "").localeCompare(stripHtml(b?.content || ""), "pt-BR", { sensitivity: "base" })
    );
}

export function NotesTab({
    notes,
    filteredNotes,
    userId,
    userRole,
    authors,
    filterAuthor,
    setFilterAuthor,
    editorContent,
    setEditorContent,
    editorRef,
    scrollRef,
    handleDeleteAll,
    handleClearNotesLocally,
    handleDelete,
    handleFormat,
    handleSend,
    getAuthorColor,
    notesSubTab,
    editingNoteId,
    handleStartEdit,
    handleCancelEdit,
    mentionEntities,
    state,
    handleAddEntityNote,
    handleUpdateEntityNote,
    handleDeleteEntityNote,
    connectionStatus = "SUBSCRIBED",
    failedEventIds = new Set(),
    handleRetry,
    privateNoteFolders,
    handleCreatePrivateFolder,
    handleUpdatePrivateFolder,
    handleDeletePrivateFolder,
    handleMovePrivateNoteToFolder,
    handleReorderPrivateFolders,
    selectedPrivateFolderId,
    setSelectedPrivateFolderId,
    selectedPlayerNotesView,
    setSelectedPlayerNotesView
}: NotesTabProps) {
    const normalizedUserId = userId.trim().toLowerCase();
    const isAuthor = (authorId?: string) => (authorId || "").trim().toLowerCase() === normalizedUserId;
    const playerChars = useMemo(
        () =>
            (Object.values((state?.characters) || {})
                .filter((char: any) => !char.isNPC && char.source !== "bestiary")
                .sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })) as any[]),
        [state?.characters]
    );

    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const [sessionFilter, setSessionFilter] = useState<number | null>(null);
    const [notesSortMode, setNotesSortMode] = useState<NotesSortMode>("RECENT");
    const [notesPerPage, setNotesPerPage] = useState<NotesPageSize>(10);
    const [notesPage, setNotesPage] = useState(0);
    const [folderDraft, setFolderDraft] = useState<{ mode: "closed" | "create" | "edit"; id: string | null; name: string; color: string }>({
        mode: "closed",
        id: null,
        name: "",
        color: NOTE_FOLDER_COLORS[0]
    });
    const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
    const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);

    const isOffline = connectionStatus !== "SUBSCRIBED";
    const toggleCard = (id: string) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));

    const folderMap = useMemo(() => {
        const map = new Map<string, any>();
        privateNoteFolders.forEach(folder => map.set(folder.id, folder));
        return map;
    }, [privateNoteFolders]);

    const visibleNotes = useMemo(() => {
        const deduped = dedupeById(filteredNotes);
        if (notesSubTab !== "Privado" || selectedPrivateFolderId === "all") return deduped;
        return deduped.filter(note => (note.folderId || "") === selectedPrivateFolderId);
    }, [filteredNotes, notesSubTab, selectedPrivateFolderId]);

    const orderedVisibleNotes = useMemo(
        () => sortNotes(visibleNotes, notesSortMode),
        [visibleNotes, notesSortMode]
    );

    const allSessionNotes = useMemo(() => {
        const deduped = dedupeById(notes.filter((note: any) => !note.isPrivate || isAuthor(note.authorId)));
        const bySession =
            sessionFilter === null
                ? deduped
                : deduped.filter((note: any) => (note.sessionNumber || 1) === sessionFilter);
        return sortNotes(bySession, notesSortMode);
    }, [notes, notesSortMode, sessionFilter, normalizedUserId]);

    const activeNotesCount = useMemo(() => {
        if (notesSubTab === "Sessão") return allSessionNotes.length;
        if (notesSubTab === "Jogadores") return 0;
        return orderedVisibleNotes.length;
    }, [notesSubTab, allSessionNotes.length, orderedVisibleNotes.length]);

    const totalPages = Math.max(1, Math.ceil(activeNotesCount / notesPerPage));

    const paginatedVisibleNotes = useMemo(() => {
        const start = notesPage * notesPerPage;
        return orderedVisibleNotes.slice(start, start + notesPerPage);
    }, [orderedVisibleNotes, notesPage, notesPerPage]);

    const paginatedSessionNotes = useMemo(() => {
        const start = notesPage * notesPerPage;
        return allSessionNotes.slice(start, start + notesPerPage);
    }, [allSessionNotes, notesPage, notesPerPage]);

    const currentFolder = selectedPrivateFolderId === "all" ? null : folderMap.get(selectedPrivateFolderId);

    useEffect(() => {
        if (notesSubTab === "Privado" && selectedPrivateFolderId !== "all" && !folderMap.has(selectedPrivateFolderId)) {
            setSelectedPrivateFolderId("all");
        }
    }, [notesSubTab, selectedPrivateFolderId, folderMap, setSelectedPrivateFolderId]);

    useEffect(() => {
        if (notesSubTab === "Jogadores" && selectedPlayerNotesView !== "all" && !playerChars.some((char: any) => char.id === selectedPlayerNotesView)) {
            setSelectedPlayerNotesView("all");
        }
    }, [notesSubTab, selectedPlayerNotesView, playerChars, setSelectedPlayerNotesView]);

    useEffect(() => {
        setNotesPage(0);
    }, [notesSubTab, notesPerPage, notesSortMode, selectedPrivateFolderId, selectedPlayerNotesView, sessionFilter, filterAuthor]);

    useEffect(() => {
        const maxPage = Math.max(0, totalPages - 1);
        if (notesPage > maxPage) {
            setNotesPage(maxPage);
        }
    }, [notesPage, totalPages]);

    const startCreateFolder = () => {
        if (privateNoteFolders.length >= 10) return;
        setFolderDraft({ mode: "create", id: null, name: "", color: NOTE_FOLDER_COLORS[0] });
    };

    const startEditFolder = (folder: any) => {
        setFolderDraft({ mode: "edit", id: folder.id, name: folder.name, color: folder.color || NOTE_FOLDER_COLORS[0] });
    };

    const closeFolderDraft = () => {
        setFolderDraft({ mode: "closed", id: null, name: "", color: NOTE_FOLDER_COLORS[0] });
    };

    const saveFolderDraft = () => {
        const trimmedName = folderDraft.name.trim();
        if (!trimmedName) return;

        if (folderDraft.mode === "create") {
            const created = handleCreatePrivateFolder(trimmedName, folderDraft.color);
            if (created) closeFolderDraft();
            return;
        }

        if (folderDraft.mode === "edit" && folderDraft.id) {
            handleUpdatePrivateFolder(folderDraft.id, { name: trimmedName, color: folderDraft.color });
            closeFolderDraft();
        }
    };

    const moveDraggedFolder = (targetFolderId: string) => {
        if (!draggedFolderId || draggedFolderId === targetFolderId) return;
        const currentOrder = privateNoteFolders.map(folder => folder.id).filter(id => id !== draggedFolderId);
        const targetIndex = targetFolderId === "all" ? 0 : currentOrder.indexOf(targetFolderId);
        currentOrder.splice(targetIndex < 0 ? currentOrder.length : targetIndex, 0, draggedFolderId);
        handleReorderPrivateFolders(currentOrder);
        setDraggedFolderId(null);
    };

    const moveDraggedNote = (targetFolderId: string) => {
        if (!draggedNoteId) return;
        handleMovePrivateNoteToFolder(draggedNoteId, targetFolderId === "all" ? null : targetFolderId);
        setDraggedNoteId(null);
    };

    const renderPrivateFolders = () => (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.62rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)" }}>
                    TÓPICOS PRIVADOS
                </span>
                <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)" }}>
                    {privateNoteFolders.length}/10
                </span>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                    type="button"
                    onClick={() => setSelectedPrivateFolderId("all")}
                    onDragOver={(e) => {
                        if (draggedFolderId || draggedNoteId) e.preventDefault();
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        if (draggedNoteId) moveDraggedNote("all");
                        if (draggedFolderId) moveDraggedFolder("all");
                    }}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        border: selectedPrivateFolderId === "all" ? "1px solid var(--accent-color)" : "1px solid rgba(255,255,255,0.08)",
                        background: selectedPrivateFolderId === "all" ? "rgba(197,160,89,0.18)" : "rgba(255,255,255,0.03)",
                        color: selectedPrivateFolderId === "all" ? "#fff" : "#bbb",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        cursor: "pointer"
                    }}
                >
                    <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent-color)" }} />
                    TODAS
                </button>

                {privateNoteFolders.map(folder => (
                    <div
                        key={folder.id}
                        draggable
                        onDragStart={() => setDraggedFolderId(folder.id)}
                        onDragOver={(e) => {
                            if (draggedFolderId || draggedNoteId) e.preventDefault();
                        }}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (draggedNoteId) moveDraggedNote(folder.id);
                            if (draggedFolderId) moveDraggedFolder(folder.id);
                        }}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            border: selectedPrivateFolderId === folder.id ? `1px solid ${folder.color}` : "1px solid rgba(255,255,255,0.08)",
                            background: selectedPrivateFolderId === folder.id ? `${folder.color}22` : "rgba(255,255,255,0.03)",
                            color: selectedPrivateFolderId === folder.id ? "#fff" : "#bbb",
                            padding: "8px 12px",
                            borderRadius: "999px",
                            cursor: "pointer"
                        }}
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedPrivateFolderId(folder.id)}
                            style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0 }}
                        >
                            <GripVertical size={12} style={{ opacity: 0.55 }} />
                            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: folder.color }} />
                            {folder.name.toUpperCase()}
                        </button>
                        <button
                            type="button"
                            onClick={() => startEditFolder(folder)}
                            style={{ background: "none", border: "none", color: "inherit", opacity: 0.75, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                            title="Editar submenu"
                        >
                            <Pencil size={12} />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDeletePrivateFolder(folder.id)}
                            style={{ background: "none", border: "none", color: "#ff6b6b", opacity: 0.8, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                            title="Excluir submenu"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                ))}

                <button
                    type="button"
                    onClick={startCreateFolder}
                    disabled={privateNoteFolders.length >= 10}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        border: "1px dashed rgba(197,160,89,0.45)",
                        background: "rgba(197,160,89,0.08)",
                        color: privateNoteFolders.length >= 10 ? "rgba(255,255,255,0.35)" : "var(--accent-color)",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        cursor: privateNoteFolders.length >= 10 ? "not-allowed" : "pointer"
                    }}
                    title={privateNoteFolders.length >= 10 ? "Limite de 10 submenus atingido" : "Criar submenu"}
                >
                    <Plus size={12} />
                    NOVO TÓPICO
                </button>
            </div>

            {folderDraft.mode !== "closed" && (
                <div style={{ border: "1px solid rgba(197,160,89,0.18)", background: "rgba(0,0,0,0.2)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                        <input
                            value={folderDraft.name}
                            onChange={(e) => setFolderDraft(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="Nome do submenu..."
                            className="author-filter"
                            style={{ minWidth: "220px" }}
                        />
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                            {NOTE_FOLDER_COLORS.map(color => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFolderDraft(prev => ({ ...prev, color }))}
                                    style={{
                                        width: "22px",
                                        height: "22px",
                                        borderRadius: "50%",
                                        border: folderDraft.color === color ? "2px solid #fff" : "1px solid rgba(255,255,255,0.18)",
                                        background: color,
                                        cursor: "pointer"
                                    }}
                                    title={`Cor ${color}`}
                                />
                            ))}
                        </div>
                        <div style={{ display: "flex", gap: "8px", marginLeft: "auto" }}>
                            <button type="button" onClick={closeFolderDraft} className="tool-btn" title="Cancelar">
                                <X size={12} />
                            </button>
                            <button type="button" onClick={saveFolderDraft} className="tool-btn" title="Salvar submenu">
                                <Check size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderOrderingAndPagination = () => (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                flexWrap: "wrap",
                padding: "8px 10px",
                border: "1px solid rgba(197,160,89,0.12)",
                background: "rgba(0,0,0,0.18)",
                borderRadius: "8px",
            }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.62rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}>ORDENAR</span>
                <select
                    value={notesSortMode}
                    onChange={(e) => setNotesSortMode(e.target.value as NotesSortMode)}
                    className="author-filter"
                    style={{ minWidth: "120px" }}
                >
                    <option value="RECENT">RECENTE</option>
                    <option value="AZ">A-Z</option>
                </select>

                <span style={{ fontSize: "0.62rem", letterSpacing: "0.12em", color: "rgba(255,255,255,0.45)" }}>POR PÁGINA</span>
                <select
                    value={String(notesPerPage)}
                    onChange={(e) => setNotesPerPage(Number(e.target.value) as NotesPageSize)}
                    className="author-filter"
                    style={{ minWidth: "90px" }}
                >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                    type="button"
                    className="clear-all-btn"
                    disabled={notesPage <= 0}
                    onClick={() => setNotesPage((prev) => Math.max(0, prev - 1))}
                    style={{ opacity: notesPage <= 0 ? 0.5 : 1, cursor: notesPage <= 0 ? "not-allowed" : "pointer" }}
                >
                    ANTERIOR
                </button>
                <span style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.55)", minWidth: "95px", textAlign: "center" }}>
                    {totalPages === 0 ? "0/0" : `${notesPage + 1}/${totalPages}`}
                </span>
                <button
                    type="button"
                    className="clear-all-btn"
                    disabled={notesPage >= totalPages - 1}
                    onClick={() => setNotesPage((prev) => Math.min(totalPages - 1, prev + 1))}
                    style={{ opacity: notesPage >= totalPages - 1 ? 0.5 : 1, cursor: notesPage >= totalPages - 1 ? "not-allowed" : "pointer" }}
                >
                    PRÓXIMO
                </button>
            </div>
        </div>
    );

    const renderPlayerSubmenus = () => (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", padding: "8px 10px", border: "1px solid rgba(197,160,89,0.12)", background: "rgba(0,0,0,0.18)", borderRadius: "8px" }}>
            <span style={{ fontSize: "0.62rem", letterSpacing: "0.18em", color: "rgba(255,255,255,0.45)", whiteSpace: "nowrap" }}>
                JOGADOR:
            </span>
            <select
                value={selectedPlayerNotesView}
                onChange={(e) => setSelectedPlayerNotesView(e.target.value)}
                className="victorian-select notes-player-select"
                style={{ minWidth: "240px" }}
            >
                <option value="all">TODOS</option>
                {playerChars.map((char: any) => (
                    <option key={char.id} value={char.id}>
                        {char.name.toUpperCase()}
                    </option>
                ))}
            </select>
        </div>
    );

    const renderPlayerCard = (char: any, expanded = true) => {
        if (!char) return null;
        const isOpen = expanded || !!expandedCards[char.id];
        return (
            <div key={char.id} className="global-item-card card-bg ornate-border" style={{ borderLeft: "4px solid var(--accent-color)" }}>
                <div
                    className="item-header"
                    style={{ marginBottom: isOpen ? "8px" : "0", cursor: expanded ? "default" : "pointer", userSelect: "none" }}
                    onClick={() => {
                        if (!expanded) toggleCard(char.id);
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                        {char.imageUrl && (
                            <div style={{ borderRadius: "50%", width: "32px", height: "32px", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,255,255,0.1)" }}>
                                <img src={char.imageUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                        )}
                        <h5 className="item-title" style={{ color: "var(--accent-color)", margin: 0 }}>{char.name.toUpperCase()}</h5>
                    </div>
                    {!expanded && (
                        <div style={{ color: "#666", flexShrink: 0 }}>
                            {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                    )}
                </div>
                {isOpen && (
                    <LinkedNotes
                        notes={(char.linkedNotes || []).filter((note: any) => isAuthor(note.authorId))}
                        onAddNote={(content: string, isPrivate?: boolean) => handleAddEntityNote?.("CHARACTER", char.id, content, isPrivate)}
                        onUpdateNote={(noteId: string, patch: any) => handleUpdateEntityNote?.("CHARACTER", char.id, noteId, patch)}
                        onDeleteNote={(noteId: string) => handleDeleteEntityNote?.("CHARACTER", char.id, noteId)}
                        mentionEntities={mentionEntities}
                        hideTitle={true}
                        userId={normalizedUserId}
                        userRole={userRole}
                        mergeAllNotes={true}
                    />
                )}
            </div>
        );
    };

    return (
        <div className="tab-content-area">
            {isOffline && (
                <div className="connection-warning-bar animate-slide-down">
                    <AlertTriangle size={14} />
                    <span>CONEXÃO INSTÁVEL - TENTANDO RECONECTAR...</span>
                    <RefreshCw size={12} className="animate-spin" />
                </div>
            )}

            <div className="navigator-controls">
                <span className="navigator-label">CATEGORIA: {notesSubTab.toUpperCase()}</span>
            </div>

            {notesSubTab === "Sessão" && (() => {
                const allSessionBase = dedupeById(notes.filter((note: any) => !note.isPrivate || isAuthor(note.authorId)));
                const groupedAll: Record<number, any[]> = {};
                allSessionBase.forEach((note: any) => {
                    const sessionNumber = note.sessionNumber || 1;
                    if (!groupedAll[sessionNumber]) groupedAll[sessionNumber] = [];
                    groupedAll[sessionNumber].push(note);
                });
                const allSessionNumbers = Object.keys(groupedAll).map(Number).sort((a, b) => a - b);

                const groupedPaginated: Record<number, any[]> = {};
                paginatedSessionNotes.forEach((note: any) => {
                    const sessionNumber = note.sessionNumber || 1;
                    if (!groupedPaginated[sessionNumber]) groupedPaginated[sessionNumber] = [];
                    groupedPaginated[sessionNumber].push(note);
                });
                const visibleSessionNumbers = Object.keys(groupedPaginated).map(Number).sort((a, b) => a - b);

                return (
                    <>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderBottom: "1px solid rgba(197,160,89,0.1)", background: "rgba(0,0,0,0.2)", flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "var(--font-header)", fontSize: "0.6rem", letterSpacing: "0.15em", color: "rgba(255,255,255,0.4)", whiteSpace: "nowrap" }}>
                                SESSÃO:
                            </span>
                            <select
                                value={sessionFilter === null ? "all" : String(sessionFilter)}
                                onChange={e => setSessionFilter(e.target.value === "all" ? null : Number(e.target.value))}
                                className="author-filter"
                            >
                                <option value="all">TODAS AS SESSÕES</option>
                                {allSessionNumbers.map(sessionNumber => (
                                    <option key={sessionNumber} value={String(sessionNumber)}>SESSÃO {sessionNumber}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ margin: "10px 5px 0 5px" }}>
                            {renderOrderingAndPagination()}
                        </div>
                        <div className="notes-scroll scrollbar-arcane" style={{ padding: "10px 5px" }}>
                            {paginatedSessionNotes.length === 0 && (
                                <div className="empty-notes">NENHUMA NOTA ENCONTRADA.</div>
                            )}
                            {visibleSessionNumbers.map(sessionNumber => (
                                <div key={sessionNumber}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "18px 0 12px", padding: "0 4px" }}>
                                        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, var(--accent-color))" }} />
                                        <span style={{ fontFamily: "var(--font-header)", fontSize: "0.65rem", letterSpacing: "0.25em", color: "var(--accent-color)", padding: "4px 14px", border: "1px solid var(--accent-color)", background: "rgba(0,0,0,0.5)", whiteSpace: "nowrap" }}>
                                            SESSÃO {sessionNumber}
                                        </span>
                                        <div style={{ flex: 1, height: "1px", background: "linear-gradient(to left, transparent, var(--accent-color))" }} />
                                    </div>
                                    {groupedPaginated[sessionNumber].map((note: any) => {
                                        const isFailed = failedEventIds.has(note.id);
                                        const isPending = note.seq === 0 && !isFailed;

                                        return (
                                            <div key={note.id} className={`note-entry animate-fade-in ${isPending ? "pending" : ""} ${isFailed ? "failed" : ""}`} style={{ borderLeftColor: getAuthorColor(note.authorId) }}>
                                                <div className="entry-meta">
                                                    <span className="time">{new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                                    <span className="actor" style={{ color: getAuthorColor(note.authorId) }}>
                                                        {note.authorName.toUpperCase()}
                                                        {note.isPrivate && <span style={{ opacity: 0.5, marginLeft: "5px", fontSize: "0.6rem" }}>(PRIVADO)</span>}
                                                    </span>
                                                    <div className="note-status-icons">
                                                        {isPending && <span title="Enviando..."><Clock size={12} className="status-pending" /></span>}
                                                        {isFailed && (
                                                            <button className="retry-btn" onClick={() => handleRetry?.(note.id)} title="Falha ao enviar. Clique para tentar novamente.">
                                                                <RefreshCw size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="entry-content">
                                                    <div className="note-body" dangerouslySetInnerHTML={{ __html: renderMentions(note.content) }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </>
                );
            })()}

            {notesSubTab === "Jogadores" && (
                <div className="notes-scroll scrollbar-arcane" style={{ padding: "10px 5px" }}>
                    {playerChars.length === 0 ? (
                        <div className="empty-notes">NENHUM JOGADOR ENCONTRADO NA SESSÃO.</div>
                    ) : (
                        <>
                            {renderPlayerSubmenus()}
                            {selectedPlayerNotesView === "all" ? (
                                <div className="items-grid" style={{ alignItems: "start" }}>
                                    {playerChars.map((char: any) => renderPlayerCard(char, false))}
                                </div>
                            ) : (
                                renderPlayerCard(playerChars.find((char: any) => char.id === selectedPlayerNotesView), true)
                            )}
                        </>
                    )}
                </div>
            )}

            {notesSubTab !== "Jogadores" && notesSubTab !== "Sessão" && (
                <>
                    <div className="notes-header">
                        <h3 className="notes-title">
                            DIÁRIO DE CAMPANHA {notesSubTab === "Privado" && "(PRIVADO)"}
                            {notesSubTab === "Privado" && currentFolder && (
                                <span style={{ marginLeft: "10px", fontSize: "0.58rem", letterSpacing: "0.18em", color: currentFolder.color || "var(--accent-color)" }}>
                                    {currentFolder.name.toUpperCase()}
                                </span>
                            )}
                        </h3>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {notesSubTab === "Geral" && authors.length > 0 && (
                                <select
                                    value={filterAuthor}
                                    onChange={(e) => setFilterAuthor(e.target.value)}
                                    className="author-filter"
                                >
                                    <option value="all">TODOS OS AUTORES</option>
                                    {authors.map(author => (
                                        <option key={author.id} value={author.id}>{author.name.toUpperCase()}</option>
                                    ))}
                                </select>
                            )}

                            {orderedVisibleNotes.length > 0 && (
                                <button
                                    className="clear-all-btn"
                                    onClick={() => handleClearNotesLocally(notesSubTab as 'Geral' | 'Privado')}
                                    title="Apagar notas da minha visualização"
                                >
                                    LIMPAR PARA MIM
                                </button>
                            )}

                            {userRole === "GM" && notesSubTab === "Geral" && notes.filter((note: any) => !note.isPrivate).length > 0 && (
                                <button
                                    className="clear-all-btn"
                                    style={{ background: "rgba(255,80,80,0.15)", borderColor: "rgba(255,80,80,0.4)", color: "#ff6060" }}
                                    onClick={() => handleDeleteAll()}
                                    title="Apagar todas as notas gerais para todos"
                                >
                                    LIMPAR TODOS
                                </button>
                            )}
                        </div>
                    </div>

                    {notesSubTab === "Privado" && renderPrivateFolders()}
                    <div style={{ marginBottom: "10px" }}>
                        {renderOrderingAndPagination()}
                    </div>

                    <div className="notes-scroll scrollbar-arcane" ref={scrollRef}>
                        {orderedVisibleNotes.length === 0 && (
                            <div className="empty-notes">
                                {notesSubTab === "Geral"
                                    ? "NENHUMA NOTA ENCONTRADA."
                                    : selectedPrivateFolderId === "all"
                                        ? "VOCÊ AINDA NÃO TEM ANOTAÇÕES PRIVADAS."
                                        : "ESTE SUBMENU AINDA NÃO TEM ANOTAÇÕES."}
                            </div>
                        )}
                        {paginatedVisibleNotes.map((note) => {
                            const isMyNote = isAuthor(note.authorId);
                            const isGM = userRole === "GM";
                            const canEdit = isMyNote || (isGM && !note.isPrivate);
                            const canDelete = isMyNote || (isGM && !note.isPrivate);
                            const authorColor = getAuthorColor(note.authorId, note.authorId === "GM" ? "GM" : undefined);
                            const isFailed = isMyNote && failedEventIds.has(note.id);
                            const isPending = isMyNote && note.seq === 0 && !isFailed;
                            const noteFolder = note.folderId ? folderMap.get(note.folderId) : null;

                            return (
                                <div
                                    key={note.id}
                                    className={`note-entry animate-fade-in ${editingNoteId === note.id ? "editing" : ""} ${isPending ? "pending" : ""} ${isFailed ? "failed" : ""}`}
                                    style={{ borderLeftColor: authorColor, cursor: notesSubTab === "Privado" && isMyNote ? "grab" : "default" }}
                                    draggable={notesSubTab === "Privado" && isMyNote}
                                    onDragStart={() => setDraggedNoteId(note.id)}
                                    onDragEnd={() => setDraggedNoteId(null)}
                                >
                                    <div className="entry-meta">
                                        <span className="time">{new Date(note.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                        <span className="actor" style={{ color: authorColor }}>{note.authorName.toUpperCase()}</span>
                                        {noteFolder && (
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 8px", borderRadius: "999px", background: `${noteFolder.color || "#C5A059"}22`, color: noteFolder.color || "var(--accent-color)", fontSize: "0.55rem", letterSpacing: "0.12em" }}>
                                                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: noteFolder.color || "#C5A059" }} />
                                                {noteFolder.name.toUpperCase()}
                                            </span>
                                        )}
                                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
                                            {isPending && <span title="Enviando..."><Clock size={12} className="status-pending" /></span>}
                                            {isFailed && (
                                                <button className="retry-btn" onClick={() => handleRetry?.(note.id)} title="Falha ao enviar. Clique para tentar novamente.">
                                                    <RefreshCw size={12} />
                                                </button>
                                            )}
                                            {canEdit && (
                                                <button onClick={() => handleStartEdit(note.id)} className="edit-mini-btn" title="Editar nota">
                                                    <Pencil size={12} />
                                                </button>
                                            )}
                                            {canDelete && (
                                                <button onClick={() => handleDelete(note.id)} className="delete-btn" title="Apagar nota">
                                                    <Trash2 size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="entry-content">
                                        <div className="note-body" dangerouslySetInnerHTML={{ __html: renderMentions(note.content) }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="notes-editor-area">
                        {editingNoteId && (
                            <div className="editor-status-bar">
                                <span>EDITANDO NOTA...</span>
                                <button onClick={handleCancelEdit} className="cancel-edit-btn"><X size={12} /> CANCELAR</button>
                            </div>
                        )}
                        <div className="editor-toolbar">
                            <button onClick={() => handleFormat("bold")} className="tool-btn" title="Negrito"><Bold size={14} /></button>
                            <button onClick={() => handleFormat("italic")} className="tool-btn" title="Itálico"><Italic size={14} /></button>
                            <button onClick={() => handleFormat("insertUnorderedList")} className="tool-btn" title="Marcadores"><List size={14} /></button>
                        </div>
                        <div className="editor-input-wrapper">
                            <MentionEditor
                                ref={editorRef}
                                value={editorContent}
                                onChange={setEditorContent}
                                placeholder={notesSubTab === "Geral"
                                    ? "Digite sua nota..."
                                    : currentFolder
                                        ? `Anote algo em ${currentFolder.name}...`
                                        : "Anote algo privado..."}
                                className="rich-editor"
                                mentionEntities={mentionEntities}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                            />
                            <button
                                onClick={handleSend}
                                className={`send-btn ${editingNoteId ? "save-mode" : ""}`}
                                disabled={!editorContent.trim() || isOffline}
                                title={editingNoteId ? "Salvar Alterações" : "Enviar Nota"}
                            >
                                {editingNoteId ? <Check size={16} /> : <Send size={16} />}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
