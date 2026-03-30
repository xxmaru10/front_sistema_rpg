import { Bold, Italic, Underline, Trash2, Send, Users, ShieldAlert, Pencil, X, Check, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { MentionEditor } from "../MentionEditor";
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
    setNotesSubTab: (tab: "Geral" | "Privado" | "Jogadores" | "Sessão") => void;
    editingNoteId: string | null;
    handleStartEdit: (noteId: string) => void;
    handleCancelEdit: () => void;
    mentionEntities: any[];
    state?: any;
    handleAddEntityNote?: (type: string, entityId: string, content: string, isPrivate?: boolean) => void;
    handleDeleteEntityNote?: (type: string, entityId: string, noteId: string) => void;
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
    setNotesSubTab,
    editingNoteId,
    handleStartEdit,
    handleCancelEdit,
    mentionEntities,
    state,
    handleAddEntityNote,
    handleDeleteEntityNote
}: NotesTabProps) {
    const playerChars = Object.values((state?.characters) || {}).filter((c: any) => !c.isNPC && c.source !== 'bestiary') as any[];
    const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
    const toggleCard = (id: string) => setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
    const [sessionFilter, setSessionFilter] = useState<number | null>(null);

    return (
        <div className="tab-content-area">
            <div className="sub-menu-bar">
                {[
                    { id: "Geral", icon: <Users size={16} /> },
                    { id: "Privado", icon: <ShieldAlert size={16} /> },
                    ...(userRole === "GM" ? [{ id: "Jogadores", icon: <Users size={16} /> }] : []),
                    { id: "Sessão", icon: <BookOpen size={16} /> }
                ].map(sub => (
                    <button
                        key={sub.id}
                        className={`sub-tab-btn ${notesSubTab === sub.id ? "active" : ""}`}
                        onClick={() => {
                            if (editingNoteId) handleCancelEdit();
                            setNotesSubTab(sub.id as any);
                        }}
                    >
                        {sub.icon}
                        <span>{sub.id.toUpperCase()}</span>
                    </button>
                ))}
            </div>

            {notesSubTab === "Sessão" && (() => {
                const sessionNotes = notes.filter((n: any) => !n.isPrivate || n.authorId === userId);
                const grouped: Record<number, any[]> = {};
                sessionNotes.forEach((note: any) => {
                    const sn = note.sessionNumber || 1;
                    if (!grouped[sn]) grouped[sn] = [];
                    grouped[sn].push(note);
                });
                const allSessionNumbers = Object.keys(grouped).map(Number).sort((a, b) => a - b);
                const visibleSessionNumbers = sessionFilter === null ? allSessionNumbers : allSessionNumbers.filter(sn => sn === sessionFilter);

                return (
                    <>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '8px 10px', borderBottom: '1px solid rgba(197,160,89,0.1)',
                            background: 'rgba(0,0,0,0.2)'
                        }}>
                            <span style={{ fontFamily: 'var(--font-header)', fontSize: '0.6rem', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                                SESSÃO:
                            </span>
                            <select
                                value={sessionFilter === null ? "all" : String(sessionFilter)}
                                onChange={e => setSessionFilter(e.target.value === "all" ? null : Number(e.target.value))}
                                className="author-filter"
                            >
                                <option value="all">TODAS AS SESSÕES</option>
                                {allSessionNumbers.map(sn => (
                                    <option key={sn} value={String(sn)}>SESSÃO {sn}</option>
                                ))}
                            </select>
                        </div>
                        <div className="notes-scroll scrollbar-arcane" style={{ padding: '10px 5px' }}>
                            {visibleSessionNumbers.length === 0 && (
                                <div className="empty-notes">NENHUMA NOTA ENCONTRADA.</div>
                            )}
                            {visibleSessionNumbers.map(sn => (
                                <div key={sn}>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        margin: '18px 0 12px', padding: '0 4px'
                                    }}>
                                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, var(--accent-color))' }} />
                                        <span style={{
                                            fontFamily: 'var(--font-header)', fontSize: '0.65rem',
                                            letterSpacing: '0.25em', color: 'var(--accent-color)',
                                            padding: '4px 14px', border: '1px solid var(--accent-color)',
                                            background: 'rgba(0,0,0,0.5)', whiteSpace: 'nowrap'
                                        }}>
                                            SESSÃO {sn}
                                        </span>
                                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, var(--accent-color))' }} />
                                    </div>
                                    {grouped[sn].map((note: any) => (
                                        <div key={note.id} className="note-entry animate-fade-in" style={{ borderLeftColor: getAuthorColor(note.authorId) }}>
                                            <div className="entry-meta">
                                                <span className="time">{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                <span className="actor" style={{ color: getAuthorColor(note.authorId) }}>
                                                    {note.authorName.toUpperCase()}
                                                    {note.isPrivate && <span style={{ opacity: 0.5, marginLeft: '5px', fontSize: '0.6rem' }}>(PRIVADO)</span>}
                                                </span>
                                            </div>
                                            <div className="entry-content">
                                                <div className="note-body" dangerouslySetInnerHTML={{ __html: renderMentions(note.content) }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </>
                );
            })()}

            {notesSubTab === "Jogadores" && (
                <div className="notes-scroll scrollbar-arcane" style={{ padding: '10px 5px' }}>
                    {playerChars.length === 0 ? (
                        <div className="empty-notes">NENHUM JOGADOR ENCONTRADO NA SESSÃO.</div>
                    ) : (
                        <div className="items-grid" style={{ alignItems: 'start' }}>
                            {playerChars.map((char: any) => {
                                const isOpen = !!expandedCards[char.id];
                                return (
                                    <div key={char.id} className="global-item-card card-bg ornate-border" style={{ borderLeft: '4px solid var(--accent-color)' }}>
                                        <div
                                            className="item-header"
                                            style={{ marginBottom: isOpen ? '8px' : '0', cursor: 'pointer', userSelect: 'none' }}
                                            onClick={() => toggleCard(char.id)}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                                {char.imageUrl && (
                                                    <div style={{ borderRadius: '50%', width: '32px', height: '32px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.1)' }}>
                                                        <img src={char.imageUrl} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                )}
                                                <h5 className="item-title" style={{ color: 'var(--accent-color)', margin: 0 }}>{char.name.toUpperCase()}</h5>
                                            </div>
                                            <div style={{ color: '#666', flexShrink: 0 }}>
                                                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </div>
                                        </div>
                                        {isOpen && (
                                            <LinkedNotes
                                                notes={(char.linkedNotes || []).filter((n: any) => n.authorId === userId)}
                                                onAddNote={(content: string, isPrivate?: boolean) => handleAddEntityNote?.('CHARACTER', char.id, content, isPrivate)}
                                                onDeleteNote={(noteId: string) => handleDeleteEntityNote?.('CHARACTER', char.id, noteId)}
                                                mentionEntities={mentionEntities}
                                                hideTitle={true}
                                                userId={userId}
                                                userRole={userRole}
                                                mergeAllNotes={true}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {notesSubTab !== "Jogadores" && notesSubTab !== "Sessão" && (<>
            <div className="notes-header">
                <h3 className="notes-title">DIÁRIO DE CAMPANHA {notesSubTab === "Privado" && "(PRIVADO)"}</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {notesSubTab === "Geral" && authors.length > 0 && (
                        <select
                            value={filterAuthor}
                            onChange={(e) => setFilterAuthor(e.target.value)}
                            className="author-filter"
                        >
                            <option value="all">TODOS OS AUTORES</option>
                            {authors.map(a => (
                                <option key={a.id} value={a.id}>{a.name.toUpperCase()}</option>
                            ))}
                        </select>
                    )}

                    {filteredNotes.length > 0 && (
                        <button
                            className="clear-all-btn"
                            onClick={() => { if (confirm("Apagar todas as notas visíveis para você?")) handleClearNotesLocally(notesSubTab as 'Geral' | 'Privado'); }}
                            title="Apagar notas da minha visualização"
                        >
                            LIMPAR PARA MIM
                        </button>
                    )}

                    {userRole === "GM" && notesSubTab === "Geral" && notes.filter((n: any) => !n.isPrivate).length > 0 && (
                        <button
                            className="clear-all-btn"
                            style={{ background: 'rgba(255,80,80,0.15)', borderColor: 'rgba(255,80,80,0.4)', color: '#ff6060' }}
                            onClick={() => { if (confirm("⚠️ Apagar TODAS as notas gerais para TODOS os usuários? Esta ação é irreversível.")) handleDeleteAll(); }}
                            title="Apagar todas as notas gerais para todos"
                        >
                            LIMPAR TODOS
                        </button>
                    )}
                </div>
            </div>

            <div className="notes-scroll scrollbar-arcane" ref={scrollRef}>
                {filteredNotes.length === 0 && (
                    <div className="empty-notes">
                        {notesSubTab === "Geral" 
                            ? "NENHUMA NOTA ENCONTRADA." 
                            : "VOCÊ AINDA NÃO TEM ANOTAÇÕES PRIVADAS."}
                    </div>
                )}
                {filteredNotes.map((note) => {
                    const isMyNote = note.authorId === userId;
                    const isGM = userRole === "GM";
                    
                    const canEdit = isMyNote || (isGM && !note.isPrivate);
                    const canDelete = isMyNote || (isGM && !note.isPrivate);
                    
                    const authorColor = getAuthorColor(note.authorId, note.authorId === "GM" ? "GM" : undefined);

                    return (
                        <div key={note.id} className={`note-entry animate-fade-in ${editingNoteId === note.id ? 'editing' : ''}`} style={{ borderLeftColor: authorColor }}>
                            <div className="entry-meta">
                                <span className="time">{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="actor" style={{ color: authorColor }}>{note.authorName.toUpperCase()}</span>
                                <div style={{ display: 'flex', gap: '8px' }}>
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
                    <button onClick={() => handleFormat('bold')} className="tool-btn" title="Negrito"><Bold size={14} /></button>
                    <button onClick={() => handleFormat('italic')} className="tool-btn" title="Itálico"><Italic size={14} /></button>
                    <button onClick={() => handleFormat('underline')} className="tool-btn" title="Sublinhado"><Underline size={14} /></button>
                </div>
                <div className="editor-input-wrapper">
                    <MentionEditor
                        ref={editorRef}
                        value={editorContent}
                        onChange={setEditorContent}
                        placeholder={notesSubTab === "Geral" ? "Digite sua nota..." : "Anote algo privado..."}
                        className="rich-editor"
                        mentionEntities={mentionEntities}
                        onKeyDown={(e) => { 
                            if (e.key === 'Enter' && !e.shiftKey) { 
                                e.preventDefault(); 
                                handleSend(); 
                            } 
                        }}
                    />
                    <button 
                        onClick={handleSend} 
                        className={`send-btn ${editingNoteId ? 'save-mode' : ''}`} 
                        disabled={!editorContent.trim()} 
                        title={editingNoteId ? "Salvar Alterações" : "Enviar Nota"}
                    >
                        {editingNoteId ? <Check size={16} /> : <Send size={16} />}
                    </button>
                </div>
            </div>
            </>)}
        </div>
    );
}
