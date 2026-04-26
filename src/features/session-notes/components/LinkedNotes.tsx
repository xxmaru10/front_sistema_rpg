import React, { useMemo, useRef, useState } from "react";
import { Bold, Italic, List, MessageSquare, Pencil, Send, ShieldAlert, Trash2, User, X, Check } from "lucide-react";
import { EntityNote } from "@/types/domain";
import { renderMentions } from "@/lib/mentionUtils";
import { MentionEditor } from "@/components/MentionEditor";

interface LinkedNotesProps {
    notes: EntityNote[];
    onAddNote: (content: string, isPrivate?: boolean) => void;
    onUpdateNote?: (noteId: string, patch: Partial<EntityNote>) => void;
    onDeleteNote?: (noteId: string) => void;
    title?: string;
    hideTitle?: boolean;
    mentionEntities: any[];
    userId?: string;
    userRole?: string;
    mergeAllNotes?: boolean;
    defaultShowNotes?: boolean;
    defaultShowPrivateNotes?: boolean;
}

function dedupeNotes(list: EntityNote[]): EntityNote[] {
    const merged = new Map<string, EntityNote>();
    list.forEach(note => merged.set(note.id, { ...(merged.get(note.id) || {}), ...note }));
    return Array.from(merged.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
}

export function LinkedNotes({
    notes,
    onAddNote,
    onUpdateNote,
    onDeleteNote,
    title = "NOTAS",
    hideTitle = false,
    mentionEntities,
    userId,
    userRole,
    mergeAllNotes,
    defaultShowNotes = false,
    defaultShowPrivateNotes = false,
}: LinkedNotesProps) {
    const normalizedUserId = (userId || "").trim().toLowerCase();
    const isAuthor = (authorId?: string) => (authorId || "").trim().toLowerCase() === normalizedUserId;

    const [newNote, setNewNote] = useState("");
    const [newPrivateNote, setNewPrivateNote] = useState("");
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingContent, setEditingContent] = useState("");

    const editorRef = useRef<HTMLDivElement>(null);
    const privateEditorRef = useRef<HTMLDivElement>(null);
    const editEditorRef = useRef<HTMLDivElement>(null);

    const [showNotes, setShowNotes] = useState(defaultShowNotes);
    const [showPrivateNotes, setShowPrivateNotes] = useState(defaultShowPrivateNotes);
    const [hasViewedNotes, setHasViewedNotes] = useState(false);

    const allNotes = useMemo(() => dedupeNotes(notes || []), [notes]);
    const sharedNotes = allNotes.filter(note => !(note.isPrivate || (note as any).is_private));
    const privateNotes = allNotes.filter(note => {
        if (!(note.isPrivate || (note as any).is_private)) return false;
        if (!normalizedUserId) return true;
        return isAuthor(note.authorId);
    });

    const applyFormat = (ref: React.RefObject<HTMLDivElement | null>, command: string) => {
        ref.current?.focus();
        document.execCommand(command, false, undefined);
    };

    const startEditing = (note: EntityNote) => {
        setEditingNoteId(note.id);
        setEditingContent(note.content);
        requestAnimationFrame(() => {
            if (!editEditorRef.current) return;
            editEditorRef.current.innerHTML = note.content;
            editEditorRef.current.focus();
        });
    };

    const cancelEditing = () => {
        setEditingNoteId(null);
        setEditingContent("");
        if (editEditorRef.current) {
            editEditorRef.current.innerHTML = "";
        }
    };

    const saveEditing = (noteId: string) => {
        const content = editEditorRef.current?.innerHTML || editingContent;
        if (!content.trim() || content === "<br>") return;
        onUpdateNote?.(noteId, { content });
        cancelEditing();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const content = editorRef.current?.innerHTML || newNote;
        if (!content.trim() || content === "<br>") return;
        onAddNote(content, false);
        setNewNote("");
        if (editorRef.current) editorRef.current.innerHTML = "";
        setShowNotes(true);
    };

    const handlePrivateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const content = privateEditorRef.current?.innerHTML || newPrivateNote;
        if (!content.trim() || content === "<br>") return;
        onAddNote(content, true);
        setNewPrivateNote("");
        if (privateEditorRef.current) privateEditorRef.current.innerHTML = "";
        setShowPrivateNotes(true);
    };

    const handleMergedPrivateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const content = editorRef.current?.innerHTML || newNote;
        if (!content.trim() || content === "<br>") return;
        onAddNote(content, true);
        setNewNote("");
        if (editorRef.current) editorRef.current.innerHTML = "";
    };

    const renderToolbar = (ref: React.RefObject<HTMLDivElement | null>) => (
        <div style={{ display: "flex", gap: "6px", marginBottom: "6px" }}>
            <button type="button" onClick={() => applyFormat(ref, "bold")} className="tool-btn" title="Negrito">
                <Bold size={12} />
            </button>
            <button type="button" onClick={() => applyFormat(ref, "italic")} className="tool-btn" title="Itálico">
                <Italic size={12} />
            </button>
            <button type="button" onClick={() => applyFormat(ref, "insertUnorderedList")} className="tool-btn" title="Marcadores">
                <List size={12} />
            </button>
        </div>
    );

    const renderNoteItem = (note: EntityNote, compact = false) => {
        const canManage = isAuthor(note.authorId) || userRole === "GM";
        const isEditing = editingNoteId === note.id;

        return (
            <div
                key={note.id}
                className="linked-note-item"
                style={{
                    background: "rgba(255,255,255,0.03)",
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid rgba(255,255,255,0.05)"
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", gap: "10px" }}>
                    <span style={{ fontSize: "0.6rem", color: "var(--accent-color)", fontWeight: "bold", display: "flex", alignItems: "center", gap: "4px" }}>
                        <User size={10} />
                        {note.authorName.toUpperCase()}
                    </span>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: compact ? "0.55rem" : "0.6rem", color: "#666" }}>
                            {new Date(note.createdAt).toLocaleString()}
                        </span>
                        {canManage && onUpdateNote && (
                            <button
                                onClick={() => startEditing(note)}
                                style={{ background: "none", border: "none", color: "var(--accent-color)", opacity: 0.75, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                                title="Editar nota"
                            >
                                <Pencil size={12} />
                            </button>
                        )}
                        {canManage && onDeleteNote && (
                            <button
                                onClick={() => onDeleteNote(note.id)}
                                style={{ background: "none", border: "none", color: "#ff4444", opacity: 0.7, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
                                title="Excluir nota"
                            >
                                <Trash2 size={12} />
                            </button>
                        )}
                    </div>
                </div>

                {isEditing ? (
                    <div>
                        {renderToolbar(editEditorRef)}
                        <MentionEditor
                            ref={editEditorRef}
                            value={editingContent}
                            onChange={setEditingContent}
                            mentionEntities={mentionEntities}
                            placeholder="Atualize a nota..."
                            className="linked-note-editor"
                        />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                            <button type="button" onClick={cancelEditing} className="tool-btn" title="Cancelar edição">
                                <X size={12} />
                            </button>
                            <button type="button" onClick={() => saveEditing(note.id)} className="tool-btn" title="Salvar edição">
                                <Check size={12} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div
                        style={{ fontSize: compact ? "0.78rem" : "0.8rem", color: "#ccc", whiteSpace: "pre-wrap" }}
                        dangerouslySetInnerHTML={{ __html: renderMentions(note.content) }}
                    />
                )}
            </div>
        );
    };

    const renderNoteList = (list: EntityNote[], isPrivateList: boolean) => (
        <div className="notes-container animate-fade-in" style={{
            marginTop: "10px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            flex: 1,
            minWidth: (showNotes && showPrivateNotes) ? "250px" : "100%",
            background: isPrivateList ? "rgba(var(--accent-rgb), 0.03)" : "transparent",
            padding: isPrivateList ? "12px" : "0",
            borderRadius: "4px",
            border: isPrivateList ? "1px dashed rgba(var(--accent-rgb), 0.2)" : "none"
        }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                {isPrivateList ? <ShieldAlert size={14} style={{ color: "var(--accent-color)" }} /> : <MessageSquare size={14} style={{ color: "var(--accent-color)" }} />}
                <span style={{ fontSize: "0.65rem", fontWeight: "bold", letterSpacing: "0.1em", color: "var(--accent-color)" }}>
                    {isPrivateList ? "NOTAS PRIVADAS" : "NOTAS GERAIS"}
                </span>
            </div>

            <div className="notes-list" style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "5px" }}>
                {list.length === 0 ? (
                    <span style={{ fontSize: "0.7rem", color: "#666", fontStyle: "italic" }}>Nenhuma nota ainda.</span>
                ) : (
                    list.map(note => renderNoteItem(note))
                )}
            </div>

            {renderToolbar(isPrivateList ? privateEditorRef : editorRef)}
            <form onSubmit={isPrivateList ? handlePrivateSubmit : handleSubmit} style={{ display: "flex", gap: "8px", marginTop: "5px", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minHeight: "34px" }}>
                    <MentionEditor
                        ref={isPrivateList ? privateEditorRef : editorRef}
                        value={isPrivateList ? newPrivateNote : newNote}
                        onChange={isPrivateList ? setNewPrivateNote : setNewNote}
                        mentionEntities={mentionEntities}
                        placeholder={isPrivateList ? "Adicionar nota privada..." : "Adicionar nota..."}
                        className="linked-note-editor"
                    />
                </div>
                <button
                    type="submit"
                    style={{
                        background: "var(--accent-color)",
                        border: "none",
                        borderRadius: "4px",
                        padding: "8px 10px",
                        color: "#000",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "34px"
                    }}
                >
                    <Send size={14} />
                </button>
            </form>
        </div>
    );

    if (mergeAllNotes) {
        const stripGMPrefix = (content: string) => {
            const marker = "[Nota de MESTRE]:";
            const idx = content.toLowerCase().indexOf(marker.toLowerCase());
            if (idx === -1) return content;
            return content.slice(idx + marker.length).trim();
        };

        return (
            <div className="linked-notes-section" style={{ marginTop: hideTitle ? "0" : "12px", borderTop: hideTitle ? "none" : "1px solid rgba(255,255,255,0.08)", paddingTop: hideTitle ? "0" : "12px" }}>
                {!hideTitle && (
                    <div style={{ marginBottom: "10px", fontSize: "0.72rem", letterSpacing: "0.16em", color: "var(--accent-color)", fontWeight: "bold" }}>
                        {title}
                    </div>
                )}
                <div className="notes-list" style={{ maxHeight: "320px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", paddingRight: "4px", marginBottom: "10px" }}>
                    {allNotes.length === 0 ? (
                        <span style={{ fontSize: "0.7rem", color: "#555", fontStyle: "italic" }}>Nenhuma nota ainda.</span>
                    ) : (
                        allNotes.map(note => (
                            <div
                                key={note.id}
                                style={{
                                    background: (note.isPrivate || (note as any).is_private) ? "rgba(var(--accent-rgb),0.06)" : "rgba(255,255,255,0.03)",
                                    padding: "7px 9px",
                                    borderRadius: "4px",
                                    border: (note.isPrivate || (note as any).is_private) ? "1px dashed rgba(var(--accent-rgb),0.25)" : "1px solid rgba(255,255,255,0.05)"
                                }}
                            >
                                {editingNoteId === note.id ? (
                                    <div>
                                        {renderToolbar(editEditorRef)}
                                        <MentionEditor
                                            ref={editEditorRef}
                                            value={editingContent}
                                            onChange={setEditingContent}
                                            mentionEntities={mentionEntities}
                                            placeholder="Atualize a nota..."
                                            className="linked-note-editor"
                                        />
                                        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
                                            <button type="button" onClick={cancelEditing} className="tool-btn" title="Cancelar edição">
                                                <X size={12} />
                                            </button>
                                            <button type="button" onClick={() => saveEditing(note.id)} className="tool-btn" title="Salvar edição">
                                                <Check size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", alignItems: "center", gap: "8px" }}>
                                            <span style={{ fontSize: "0.6rem", color: "var(--accent-color)", fontWeight: "bold" }}>
                                                {note.authorName.toUpperCase()}
                                            </span>
                                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                <span style={{ fontSize: "0.55rem", color: "#666" }}>{new Date(note.createdAt).toLocaleString()}</span>
                                                {onUpdateNote && (isAuthor(note.authorId) || userRole === "GM") && (
                                                    <button onClick={() => startEditing(note)} style={{ background: "none", border: "none", color: "var(--accent-color)", opacity: 0.75, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }} title="Editar nota">
                                                        <Pencil size={12} />
                                                    </button>
                                                )}
                                                {onDeleteNote && (isAuthor(note.authorId) || userRole === "GM") && (
                                                    <button onClick={() => onDeleteNote(note.id)} style={{ background: "none", border: "none", color: "#ff4444", opacity: 0.7, cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }} title="Excluir nota">
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: "0.78rem", color: "#ccc" }} dangerouslySetInnerHTML={{ __html: renderMentions(stripGMPrefix(note.content)) }} />
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>
                {renderToolbar(editorRef)}
                <form onSubmit={handleMergedPrivateSubmit} style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                    <div style={{ flex: 1, minHeight: "30px" }}>
                        <MentionEditor
                            ref={editorRef}
                            value={newNote}
                            onChange={setNewNote}
                            mentionEntities={mentionEntities}
                            placeholder="Nota sobre o jogador..."
                            className="linked-note-editor"
                        />
                    </div>
                    <button
                        type="submit"
                        style={{
                            background: "rgba(var(--accent-rgb),0.25)",
                            border: "1px solid rgba(var(--accent-rgb),0.4)",
                            borderRadius: "4px",
                            padding: "6px 8px",
                            color: "var(--accent-color)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            height: "30px"
                        }}
                    >
                        <Send size={12} />
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="linked-notes-section" style={{ marginTop: "20px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "15px" }}>
            {!hideTitle && (
                <div style={{ marginBottom: "12px", fontSize: "0.72rem", letterSpacing: "0.16em", color: "var(--accent-color)", fontWeight: "bold" }}>
                    {title}
                </div>
            )}
            <div style={{ display: "flex", gap: "20px", marginBottom: (showNotes || showPrivateNotes) ? "10px" : "0" }}>
                <button
                    onClick={() => { setShowNotes(!showNotes); setHasViewedNotes(true); }}
                    style={{
                        background: "none",
                        border: "none",
                        color: showNotes ? "var(--accent-color)" : "#666",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                        padding: "5px 0",
                        textTransform: "uppercase"
                    }}
                >
                    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <MessageSquare size={16} />
                        {!hasViewedNotes && sharedNotes.length > 0 && (
                            <span style={{
                                position: "absolute",
                                top: "-8px",
                                right: "-8px",
                                background: "var(--accent-color)",
                                color: "#000",
                                fontSize: "0.5rem",
                                padding: "2px 4px",
                                borderRadius: "10px",
                                fontWeight: "bold",
                                minWidth: "14px",
                                textAlign: "center",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.3)"
                            }}>
                                {sharedNotes.length}
                            </span>
                        )}
                    </div>
                    <span>NOTAS GERAIS</span>
                </button>

                <button
                    onClick={() => setShowPrivateNotes(!showPrivateNotes)}
                    style={{
                        background: "none",
                        border: "none",
                        color: showPrivateNotes ? "var(--accent-color)" : "#666",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "0.75rem",
                        fontWeight: "bold",
                        cursor: "pointer",
                        padding: "5px 0",
                        textTransform: "uppercase"
                    }}
                >
                    <ShieldAlert size={16} />
                    <span>NOTAS PRIVADAS</span>
                </button>
            </div>

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "flex-start" }}>
                {showNotes && renderNoteList(sharedNotes, false)}
                {showPrivateNotes && renderNoteList(privateNotes, true)}
            </div>
        </div>
    );
}
