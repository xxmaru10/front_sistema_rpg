import { useState, useMemo, useRef, useEffect } from "react";
import { Note, SessionState, Character } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";

interface UseSessionNotesDiaryProps {
    sessionId: string;
    userId: string;
    state: SessionState;
    notesSubTab: string;
    worldFilters: Record<string, string[]>;
    handleAddEntityNote: (
        type: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM',
        entityId: string,
        content: string,
        isPrivate?: boolean
    ) => void;
}

export function useSessionNotesDiary({
    sessionId,
    userId: rawUserId,
    state,
    notesSubTab,
    worldFilters,
    handleAddEntityNote,
}: UseSessionNotesDiaryProps) {
    const userId = rawUserId.trim().toLowerCase();
    const isAuthor = (authorId?: string) => (authorId || "").trim().toLowerCase() === userId;
    const notes = state.notes || [];

    const [editorContent, setEditorContent] = useState("");
    const [filterAuthor, setFilterAuthor] = useState("all");
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [locallyHiddenNoteIds, setLocallyHiddenNoteIds] = useState<Set<string>>(new Set());
    const [connectionStatus, setConnectionStatus] = useState(globalEventStore.getConnectionStatus());
    const [failedEventIds, setFailedEventIds] = useState<Set<string>>(new Set());

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribeStatus = globalEventStore.subscribeStatus(setConnectionStatus);
        const unsubscribeEvents = globalEventStore.subscribe(
            () => setFailedEventIds(globalEventStore.getFailedIds()),
            () => setFailedEventIds(globalEventStore.getFailedIds())
        );
        return () => {
            unsubscribeStatus();
            unsubscribeEvents();
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    });

    // --- Derived ---
    const authors = useMemo(() => {
        const visibleNotes = notes.filter(n => !n.isPrivate || isAuthor(n.authorId));
        return Array.from(new Set(visibleNotes.map(n => n.authorId))).map(id => {
            const note = visibleNotes.find(n => n.authorId === id);
            return { id, name: note?.authorName || id };
        });
    }, [notes, userId]);

    const filteredNotesByTab = useMemo(() => {
        if (notesSubTab === "Geral") {
            return notes.filter(n => !n.isPrivate && !locallyHiddenNoteIds.has(n.id));
        } else if (notesSubTab === "Sessão") {
            return notes.filter(n => (!n.isPrivate || isAuthor(n.authorId)) && !locallyHiddenNoteIds.has(n.id));
        } else {
            return notes.filter(n => n.isPrivate && isAuthor(n.authorId) && !locallyHiddenNoteIds.has(n.id));
        }
    }, [notes, notesSubTab, userId, locallyHiddenNoteIds]);

    const filteredNotes = useMemo(() => {
        let list = filteredNotesByTab;
        if (filterAuthor !== "all") list = list.filter(n => n.authorId === filterAuthor);
        if (worldFilters.authorId && worldFilters.authorId.length > 0) {
            list = list.filter(n => worldFilters.authorId.includes(n.authorId));
        }
        return list;
    }, [filteredNotesByTab, filterAuthor, worldFilters.authorId]);

    // --- Handlers ---
    const getAuthorColor = (id: string, role?: string) => {
        if (role === "GM" || id.toLowerCase().includes("mestre") || id.toLowerCase().includes("gm")) {
            return "#C5A059";
        }
        const colors = ["#4a90e2", "#50e3c2", "#b8e986", "#f8e71c", "#f5a623", "#d0021b", "#bd10e0", "#9013fe"];
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
        return colors[Math.abs(hash) % colors.length];
    };

    const handleClearNotesLocally = (tab: 'Geral' | 'Privado') => {
        const toHide = tab === 'Geral'
            ? notes.filter(n => !n.isPrivate).map(n => n.id)
            : notes.filter(n => n.isPrivate && isAuthor(n.authorId)).map(n => n.id);
        setLocallyHiddenNoteIds(prev => new Set([...prev, ...toHide]));
    };

    const handleFormat = (command: string) => {
        document.execCommand(command, false, undefined);
        if (editorRef.current) editorRef.current.focus();
    };

    const crossPostMentionsToEntities = (htmlContent: string, isPrivate: boolean = false) => {
        if (!htmlContent) return;

        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${htmlContent}</div>`, 'text/html');
        const mentionSpans = doc.querySelectorAll('[data-mention-id]');
        const plainContentEl = doc.querySelector('div');
        const cleanText = plainContentEl?.textContent || "";
        const noteHtml = plainContentEl?.innerHTML || htmlContent;

        const targets = new Map<string, { id: string; type: string }>();

        mentionSpans.forEach(span => {
            const id = span.getAttribute('data-mention-id');
            const type = span.getAttribute('data-mention-type');
            if (id && type) targets.set(id, { id, type });
        });

        const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const normalizedContent = normalize(cleanText);

        Object.values(state.characters || {}).forEach(char => {
            const normalizedName = normalize(char.name);
            if (normalizedName.length > 2 && (normalizedContent.includes(normalizedName) || normalizedContent.includes(`@${normalizedName}`))) {
                if (!targets.has(char.id)) targets.set(char.id, { id: char.id, type: 'CHARACTER' });
            }
        });

        const seat = state.seats.find(s => s.userId === userId);
        const authorChar = seat?.characterId ? state.characters[seat.characterId] : null;
        const authorName = authorChar?.name || userId;
        const characterTypes = ['CHARACTER', 'AMEAÇA', 'AMEACA', 'NPC', 'INIMIGO'];

        targets.forEach(({ id, type }) => {
            const upperType = type.toUpperCase();
            let noteType: 'WORLD' | 'CHARACTER' | 'MISSION' | 'TIMELINE' | 'SKILL' | 'ITEM' | null = null;

            if (state.worldEntities?.[id]) noteType = 'WORLD';
            else if (state.characters?.[id]) noteType = 'CHARACTER';
            else if ((state.missions || []).some((m: any) => m.id === id)) noteType = 'MISSION';
            else if ((state.timeline || []).some((e: any) => e.id === id)) noteType = 'TIMELINE';
            else if ((state.skills || []).some((s: any) => s.id === id)) noteType = 'SKILL';
            else if ((state.items || []).some((i: any) => i.id === id)) noteType = 'ITEM';
            else if (characterTypes.includes(upperType)) noteType = 'CHARACTER';
            else if (upperType === 'MISSÃO' || upperType === 'MISSAO') noteType = 'MISSION';
            else if (upperType === 'HISTÓRIA' || upperType === 'TIMELINE' || upperType === 'EVENTO') noteType = 'TIMELINE';
            else if (upperType === 'HABILIDADE' || upperType === 'SKILL') noteType = 'SKILL';
            else if (upperType === 'ITEM') noteType = 'ITEM';
            else noteType = 'WORLD';

            if (noteType) {
                const crossPostContent = `<div class="crosspost-note">📝 [Nota de ${authorName.toUpperCase()}]: ${noteHtml}</div>`;
                handleAddEntityNote(noteType, id, crossPostContent, isPrivate);
            }
        });
    };

    const handleSend = () => {
        const content = editorContent.trim();
        if (!content) return;

        if (editingNoteId) {
            const existingNote = notes.find(n => n.id === editingNoteId);
            if (!existingNote) return;
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
                type: "NOTE_UPDATED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: existingNote.isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
                payload: { noteId: editingNoteId, content: editorContent }
            } as any);
            setEditingNoteId(null);
        } else {
            const isPrivate = notesSubTab.toLowerCase() === "privado";
            globalEventStore.append({
                id: uuidv4(), sessionId, seq: 0,
                type: "NOTE_ADDED",
                actorUserId: userId,
                createdAt: new Date().toISOString(),
                visibility: isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
                payload: {
                    id: uuidv4(),
                    authorId: userId,
                    authorName: userId,
                    content: editorContent,
                    createdAt: new Date().toISOString(),
                    isPrivate,
                    sessionNumber: state.sessionNumber || 1
                }
            } as any);
            crossPostMentionsToEntities(editorContent, isPrivate);
        }

        setEditorContent("");
        if (editorRef.current) {
            editorRef.current.innerHTML = "";
            editorRef.current.focus();
        }
    };

    const handleStartEdit = (noteId: string) => {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;
        setEditingNoteId(noteId);
        setEditorContent(note.content);
        if (editorRef.current) {
            editorRef.current.innerHTML = note.content;
            editorRef.current.focus();
        }
    };

    const handleCancelEdit = () => {
        setEditingNoteId(null);
        setEditorContent("");
        if (editorRef.current) editorRef.current.innerHTML = "";
    };

    const handleDelete = (noteId: string) => {
        const existingNote = notes.find(n => n.id === noteId);
        if (!existingNote) return;
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "NOTE_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: existingNote.isPrivate ? { kind: "PLAYER_ONLY", userId } : "PUBLIC",
            payload: { noteId }
        } as any);
    };

    const handleDeleteAll = () => {
        globalEventStore.append({
            id: uuidv4(), sessionId, seq: 0,
            type: "ALL_NOTES_DELETED",
            actorUserId: userId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {}
        } as any);
    };

    const handleRetry = (noteId: string) => {
        const events = globalEventStore.getEvents();
        const event = events.find(e => e.id === noteId || (e.type === 'NOTE_ADDED' && e.payload.id === noteId));
        if (event) globalEventStore.retryEvent(event.id);
    };

    return {
        // State
        editorContent, setEditorContent,
        filterAuthor, setFilterAuthor,
        editingNoteId, setEditingNoteId,
        locallyHiddenNoteIds,
        connectionStatus,
        failedEventIds,
        // Refs
        editorRef,
        scrollRef,
        // Derived
        notes,
        authors,
        filteredNotes,
        // Handlers
        getAuthorColor,
        handleClearNotesLocally,
        handleFormat,
        handleSend,
        handleStartEdit,
        handleCancelEdit,
        handleDelete,
        handleDeleteAll,
        handleRetry,
    };
}
