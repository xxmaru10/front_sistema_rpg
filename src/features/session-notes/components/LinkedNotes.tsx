import React, { useState, useRef } from 'react';
import { MessageSquare, Send, User, Trash2, ShieldAlert } from 'lucide-react';
import { EntityNote } from '@/types/domain';
import { renderMentions } from '@/lib/mentionUtils';
import { MentionEditor } from '@/components/MentionEditor';

function MergedNoteInput({ editorRef, value, onChange, mentionEntities, onSubmitPrivate }: {
    editorRef: React.RefObject<HTMLDivElement | null>;
    value: string;
    onChange: (v: string) => void;
    mentionEntities: any[];
    onSubmitPrivate: (e: React.FormEvent) => void;
}) {
    return (
        <form
            onSubmit={onSubmitPrivate}
            style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}
        >
            <div style={{ flex: 1, minHeight: '30px' }}>
                <MentionEditor
                    ref={editorRef}
                    value={value}
                    onChange={onChange}
                    mentionEntities={mentionEntities}
                    placeholder="Nota sobre o jogador..."
                    className="linked-note-editor"
                    style={{ borderColor: 'rgba(197,160,89,0.3)' }}
                />
            </div>
            <button
                type="submit"
                style={{
                    background: 'rgba(197,160,89,0.25)',
                    border: '1px solid rgba(197,160,89,0.4)',
                    borderRadius: '4px', padding: '6px 8px',
                    color: 'var(--accent-color)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', height: '30px'
                }}
            >
                <Send size={12} />
            </button>
        </form>
    );
}

interface LinkedNotesProps {
    notes: EntityNote[];
    onAddNote: (content: string, isPrivate?: boolean) => void;
    onDeleteNote?: (noteId: string) => void;
    title?: string;
    hideTitle?: boolean;
    mentionEntities: any[];
    userId?: string;
    userRole?: string;
    mergeAllNotes?: boolean;
}

export function LinkedNotes({ notes, onAddNote, onDeleteNote, title = "NOTAS", hideTitle = false, mentionEntities, userId, userRole, mergeAllNotes }: LinkedNotesProps) {
    const [newNote, setNewNote] = useState("");
    const [newPrivateNote, setNewPrivateNote] = useState("");
    const editorRef = useRef<HTMLDivElement>(null);
    const privateEditorRef = useRef<HTMLDivElement>(null);
    const [showNotes, setShowNotes] = useState(false);
    const [showPrivateNotes, setShowPrivateNotes] = useState(false);
    const [hasViewedNotes, setHasViewedNotes] = useState(false);

    const sharedNotes = (notes || []).filter(n => !(n.isPrivate || (n as any).is_private));
    const privateNotes = (notes || []).filter(n => {
        if (!(n.isPrivate || (n as any).is_private)) return false;
        if (!userId) return true;
        return n.authorId === userId;
    });

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

    const renderNoteList = (list: EntityNote[], isPrivateList: boolean) => (
        <div className="notes-container animate-fade-in" style={{
            marginTop: '10px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            flex: 1,
            minWidth: (showNotes && showPrivateNotes) ? '250px' : '100%',
            background: isPrivateList ? 'rgba(197, 160, 89, 0.03)' : 'transparent',
            padding: isPrivateList ? '12px' : '0',
            borderRadius: '4px',
            border: isPrivateList ? '1px dashed rgba(197, 160, 89, 0.2)' : 'none'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                {isPrivateList ? <ShieldAlert size={14} style={{ color: 'var(--accent-color)' }} /> : <MessageSquare size={14} style={{ color: 'var(--accent-color)' }} />}
                <span style={{ fontSize: '0.65rem', fontWeight: 'bold', letterSpacing: '0.1em', color: 'var(--accent-color)' }}>
                    {isPrivateList ? 'NOTAS PRIVADAS' : 'NOTAS GERAIS'}
                </span>
            </div>

            <div className="notes-list" style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '5px' }}>
                {list.length === 0 ? (
                    <span style={{ fontSize: '0.7rem', color: '#666', fontStyle: 'italic' }}>Nenhuma nota ainda.</span>
                ) : (
                    list.map((note) => (
                        <div key={note.id} className="linked-note-item" style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '0.6rem', color: 'var(--accent-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <User size={10} />
                                    {note.authorName.toUpperCase()}
                                </span>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.55rem', color: '#444' }}>{new Date(note.createdAt).toLocaleString()}</span>
                                    {onDeleteNote && (note.authorId === userId || userRole === 'GM') && (
                                        <button
                                            onClick={() => onDeleteNote(note.id)}
                                            style={{ background: 'none', border: 'none', color: '#ff4444', opacity: 0.6, cursor: 'pointer', padding: '0', display: 'flex', alignItems: 'center' }}
                                            title="Excluir nota"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div
                                style={{ fontSize: '0.8rem', color: '#ccc', whiteSpace: 'pre-wrap' }}
                                dangerouslySetInnerHTML={{ __html: renderMentions(note.content) }}
                            />
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={isPrivateList ? handlePrivateSubmit : handleSubmit} style={{ display: 'flex', gap: '8px', marginTop: '5px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1, minHeight: '34px' }}>
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
                        background: 'var(--accent-color)',
                        border: 'none', borderRadius: '4px', padding: '8px 10px', color: '#000', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '34px'
                    }}
                >
                    <Send size={14} />
                </button>
            </form>
        </div>
    );

    if (mergeAllNotes) {
        const stripGMPrefix = (content: string) => {
            const marker = '[Nota de MESTRE]:';
            const idx = content.toLowerCase().indexOf(marker.toLowerCase());
            if (idx === -1) return content;
            return content.slice(idx + marker.length).trim();
        };

        const allNotes = [...(notes || [])].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return (
            <div className="linked-notes-section" style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                <div className="notes-list" style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px', marginBottom: '10px' }}>
                    {allNotes.length === 0 ? (
                        <span style={{ fontSize: '0.7rem', color: '#555', fontStyle: 'italic' }}>Nenhuma nota ainda.</span>
                    ) : (
                        allNotes.map((note) => {
                            const isPriv = note.isPrivate || (note as any).is_private;
                            return (
                                <div key={note.id} style={{
                                    background: isPriv ? 'rgba(197,160,89,0.06)' : 'rgba(255,255,255,0.03)',
                                    padding: '7px 9px', borderRadius: '4px',
                                    border: isPriv ? '1px dashed rgba(197,160,89,0.25)' : '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '3px', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '0.55rem', color: '#444' }}>{new Date(note.createdAt).toLocaleString()}</span>
                                        {onDeleteNote && (note.authorId === userId || userRole === 'GM') && (
                                            <button onClick={() => onDeleteNote(note.id)} style={{ background: 'none', border: 'none', color: '#ff4444', opacity: 0.6, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }} title="Excluir nota">
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.78rem', color: '#ccc' }} dangerouslySetInnerHTML={{ __html: renderMentions(stripGMPrefix(note.content)) }} />
                                </div>
                            );
                        })
                    )}
                </div>
                <MergedNoteInput
                    editorRef={editorRef}
                    value={newNote}
                    onChange={setNewNote}
                    mentionEntities={mentionEntities}
                    onSubmitPrivate={handleMergedPrivateSubmit}
                />
            </div>
        );
    }

    return (
        <div className="linked-notes-section" style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px' }}>
            <div style={{ display: 'flex', gap: '20px', marginBottom: (showNotes || showPrivateNotes) ? '10px' : '0' }}>
                <button
                    onClick={() => { setShowNotes(!showNotes); setHasViewedNotes(true); }}
                    style={{
                        background: 'none', border: 'none', color: showNotes ? 'var(--accent-color)' : '#666',
                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 'bold',
                        cursor: 'pointer', padding: '5px 0', textTransform: 'uppercase'
                    }}
                >
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <MessageSquare size={16} />
                        {!hasViewedNotes && sharedNotes.length > 0 && (
                            <span style={{
                                position: 'absolute', top: '-8px', right: '-8px', background: 'var(--accent-color)', color: '#000',
                                fontSize: '0.5rem', padding: '2px 4px', borderRadius: '10px', fontWeight: 'bold', minWidth: '14px', textAlign: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
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
                        background: 'none', border: 'none', color: showPrivateNotes ? 'var(--accent-color)' : '#666',
                        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontWeight: 'bold',
                        cursor: 'pointer', padding: '5px 0', textTransform: 'uppercase'
                    }}
                >
                    <ShieldAlert size={16} />
                    <span>NOTAS PRIVADAS</span>
                </button>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {showNotes && renderNoteList(sharedNotes, false)}
                {showPrivateNotes && renderNoteList(privateNotes, true)}
            </div>
        </div>
    );
}
