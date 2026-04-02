"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePathname, useParams, useSearchParams } from "next/navigation";
import { floatingNotesStore } from "@/lib/floatingNotesStore";
import { StickyNote } from "@/types/domain";
import { globalEventStore } from "@/lib/eventStore";
import { computeState } from "@/lib/projections";

const NOTE_COLORS = [
    { value: '#fef08a', label: 'Amarelo' },
    { value: '#86efac', label: 'Verde' },
    { value: '#93c5fd', label: 'Azul' },
    { value: '#f9a8d4', label: 'Rosa' },
    { value: '#fed7aa', label: 'Laranja' },
];

function StickyNoteCard({ note }: { note: StickyNote }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const finalPosRef = useRef({ x: note.x, y: note.y });
    const finalSizeRef = useRef({ w: note.width, h: note.height });
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Sync position/size from store to DOM when note data changes externally
    useEffect(() => {
        if (!cardRef.current) return;
        if (!isDragging) {
            cardRef.current.style.left = note.x + 'px';
            cardRef.current.style.top = note.y + 'px';
        }
        if (!isResizing && !note.minimized) {
            cardRef.current.style.width = note.width + 'px';
            cardRef.current.style.height = note.height + 'px';
        }
    }, [note.x, note.y, note.width, note.height, note.minimized, isDragging, isResizing]);

    // Cancela confirmação se clicar fora
    useEffect(() => {
        if (!confirmDelete) return;
        const cancel = (e: MouseEvent) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                setConfirmDelete(false);
            }
        };
        window.addEventListener('mousedown', cancel);
        return () => window.removeEventListener('mousedown', cancel);
    }, [confirmDelete]);

    const onMouseDownHeader = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
        e.preventDefault();
        if (confirmDelete) { setConfirmDelete(false); return; }
        floatingNotesStore.bringToFront(note.id);

        const startX = e.clientX - note.x;
        const startY = e.clientY - note.y;
        finalPosRef.current = { x: note.x, y: note.y };
        setIsDragging(true);

        const onMouseMove = (ev: MouseEvent) => {
            const newX = ev.clientX - startX;
            const newY = Math.max(70, ev.clientY - startY);
            if (cardRef.current) {
                cardRef.current.style.left = newX + 'px';
                cardRef.current.style.top = newY + 'px';
            }
            finalPosRef.current = { x: newX, y: newY };
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setIsDragging(false);
            floatingNotesStore.updateNote(note.id, finalPosRef.current);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const onMouseDownResize = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        floatingNotesStore.bringToFront(note.id);

        const startX = e.clientX;
        const startY = e.clientY;
        finalSizeRef.current = { w: note.width, h: note.height };
        setIsResizing(true);

        const onMouseMove = (ev: MouseEvent) => {
            const newW = Math.max(160, note.width + (ev.clientX - startX));
            const newH = Math.max(120, note.height + (ev.clientY - startY));
            if (cardRef.current) {
                cardRef.current.style.width = newW + 'px';
                cardRef.current.style.height = newH + 'px';
            }
            finalSizeRef.current = { w: newW, h: newH };
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            setIsResizing(false);
            floatingNotesStore.updateNote(note.id, { width: finalSizeRef.current.w, height: finalSizeRef.current.h });
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const cardStyle: React.CSSProperties = {
        position: 'fixed',
        left: note.x,
        top: note.y,
        width: note.width,
        height: note.minimized ? 'auto' : note.height,
        zIndex: note.zIndex,
        background: note.color,
        borderRadius: '6px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: isDragging || isResizing ? 'none' : 'auto',
    };

    const headerStyle: React.CSSProperties = {
        padding: '5px 6px',
        background: 'rgba(0,0,0,0.13)',
        borderRadius: note.minimized ? '6px' : '6px 6px 0 0',
        cursor: isDragging ? 'grabbing' : 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: '3px',
        flexShrink: 0,
        userSelect: 'none',
    };

    const btnStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: '0 3px',
        color: 'rgba(0,0,0,0.55)',
        fontSize: '13px',
        lineHeight: 1,
        fontWeight: 'bold',
    };

    return (
        <div
            ref={cardRef}
            style={cardStyle}
            onMouseDown={() => floatingNotesStore.bringToFront(note.id)}
        >
            {/* Header / drag area */}
            <div style={headerStyle} onMouseDown={onMouseDownHeader}>
                {/* Color swatches */}
                {NOTE_COLORS.map(c => (
                    <button
                        key={c.value}
                        title={c.label}
                        onMouseDown={e => e.stopPropagation()}
                        onClick={() => floatingNotesStore.updateNote(note.id, { color: c.value })}
                        style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: c.value,
                            border: c.value === note.color ? '2px solid rgba(0,0,0,0.6)' : '1px solid rgba(0,0,0,0.25)',
                            cursor: 'pointer',
                            padding: 0,
                            flexShrink: 0,
                        }}
                    />
                ))}

                {/* Title */}
                <input
                    value={note.title}
                    onChange={e => floatingNotesStore.updateNote(note.id, { title: e.target.value })}
                    onMouseDown={e => e.stopPropagation()}
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontWeight: '700',
                        fontSize: '0.68rem',
                        color: 'rgba(0,0,0,0.75)',
                        cursor: 'text',
                        minWidth: 0,
                        fontFamily: 'var(--font-ui, sans-serif)',
                        letterSpacing: '0.03em',
                    }}
                />

                {/* Minimize */}
                <button
                    title={note.minimized ? 'Restaurar' : 'Minimizar'}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { setConfirmDelete(false); floatingNotesStore.updateNote(note.id, { minimized: !note.minimized }); }}
                    style={btnStyle}
                >
                    {note.minimized ? '▲' : '▼'}
                </button>

                {/* Delete / confirmação */}
                <button
                    title={confirmDelete ? '' : 'Deletar nota'}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => setConfirmDelete(true)}
                    style={{ ...btnStyle, color: confirmDelete ? 'rgba(180,0,0,0.8)' : 'rgba(0,0,0,0.55)' }}
                >
                    ✕
                </button>
            </div>

            {/* Banner de confirmação de exclusão */}
            {confirmDelete && (
                <div style={{
                    background: 'rgba(0,0,0,0.82)',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    flexShrink: 0,
                }}>
                    <span style={{ color: '#fff', fontSize: '0.72rem', fontFamily: 'var(--font-ui, sans-serif)', lineHeight: 1.4 }}>
                        Deletar esta nota permanentemente?
                    </span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => floatingNotesStore.deleteNote(note.id)}
                            style={{
                                flex: 1,
                                background: 'rgba(180,30,30,0.85)',
                                border: '1px solid rgba(255,80,80,0.4)',
                                color: '#fff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                padding: '4px 0',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                fontFamily: 'var(--font-ui, sans-serif)',
                            }}
                        >
                            Sim, deletar
                        </button>
                        <button
                            onMouseDown={e => e.stopPropagation()}
                            onClick={() => setConfirmDelete(false)}
                            style={{
                                flex: 1,
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: '#ccc',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                padding: '4px 0',
                                fontSize: '0.7rem',
                                fontFamily: 'var(--font-ui, sans-serif)',
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Body */}
            {!note.minimized && !confirmDelete && (
                <textarea
                    value={note.text}
                    onChange={e => floatingNotesStore.updateNote(note.id, { text: e.target.value })}
                    placeholder="Escreva aqui..."
                    style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        padding: '7px 9px',
                        fontFamily: 'var(--font-ui, sans-serif)',
                        fontSize: '0.82rem',
                        color: 'rgba(0,0,0,0.82)',
                        lineHeight: 1.55,
                    }}
                />
            )}

            {/* Resize handle */}
            {!note.minimized && !confirmDelete && (
                <div
                    onMouseDown={onMouseDownResize}
                    title="Redimensionar"
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 16,
                        height: 16,
                        cursor: 'se-resize',
                        background: 'rgba(0,0,0,0.12)',
                        borderRadius: '0 0 6px 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="rgba(0,0,0,0.4)">
                        <path d="M0 8 L8 0 L8 8 Z" />
                    </svg>
                </div>
            )}
        </div>
    );
}

export function FloatingNotes() {
    const [notes, setNotes] = useState<StickyNote[]>([]);
    const [mounted, setMounted] = useState(false);
    
    // Get context from URL
    const pathname = usePathname() || "";
    const params = useParams();
    const sessionId = params?.id as string;
    const searchParams = useSearchParams();
    const userId = searchParams?.get("u") || "";

    const isSessionPage = pathname.startsWith('/session/');

    useEffect(() => {
        setMounted(true);
        if (!isSessionPage || !sessionId || !userId) {
            setNotes([]);
            return;
        }

        // Initialize store with context
        floatingNotesStore.init(sessionId, userId);

        // Subscribe to global event store to get projected notes
        const unsubStore = globalEventStore.subscribe(() => {}, (bulkEvents) => {
            // Re-project state from events to find current user's sticky notes
            const state = computeState(bulkEvents, globalEventStore.getSnapshotState() ?? undefined);
            const userNotes = (state.stickyNotes || []).filter(n => n.ownerId === userId);
            
            // Only update if they actually changed (or just set them, React will handle diff)
            floatingNotesStore.setNotes(userNotes);
            setNotes([...userNotes]);
        });

        // Also subscribe to the floatingNotesStore for local optimistic updates
        const unsubLocal = floatingNotesStore.subscribe(() => {
            setNotes([...floatingNotesStore.getNotes()]);
        });

        return () => { 
            unsubStore();
            unsubLocal();
        };
    }, [isSessionPage, sessionId, userId]);

    if (!mounted || !isSessionPage || !sessionId || !userId || typeof document === 'undefined') return null;

    return createPortal(
        <>
            {notes.map(note => (
                <StickyNoteCard key={note.id} note={note} />
            ))}
        </>,
        document.body
    );
}
