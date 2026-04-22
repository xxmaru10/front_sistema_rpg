"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { MessageSquare, Send } from "lucide-react";
import { getSocket } from "@/lib/socketClient";
import { useProjectedState } from "@/lib/projectedStateStore";
import { v4 as uuidv4 } from "uuid";

interface TextChatMessage {
    id: string;
    userId: string;
    text: string;
    timestamp: number;
    authorRole?: "GM" | "PLAYER";
    authorLabel?: string;
}

interface TextChatPanelProps {
    sessionId: string;
    userId: string;
    userRole: "GM" | "PLAYER";
}

export function TextChatPanel({ sessionId, userId, userRole }: TextChatPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<TextChatMessage[]>([]);
    const [inputText, setInputText] = useState("");
    const [unreadCount, setUnreadCount] = useState(0);
    const panelRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesRef = useRef<TextChatMessage[]>([]);
    const isOpenRef = useRef(false);
    const normalizeUserId = useCallback((value: string) => value.trim().toLowerCase(), []);
    const normalizedCurrentUserId = useMemo(() => normalizeUserId(userId), [userId, normalizeUserId]);

    useEffect(() => {
        messagesRef.current = messages;
    }, [messages]);

    // Story 46 Prioridade 3: lê estado projetado do singleton.
    const state = useProjectedState();
    const getDisplayName = useCallback((uid: string, msg?: TextChatMessage) => {
        if (msg?.authorRole === "GM") return "MESTRE";
        if (msg?.authorLabel?.trim()) return msg.authorLabel.trim().toUpperCase();
        const uidNormalized = normalizeUserId(uid);
        const ownedPc = Object.values(state.characters || {}).find(
            (c: any) => normalizeUserId(c.ownerUserId || "") === uidNormalized && !c.isNPC
        );
        return ownedPc ? (ownedPc as any).name : uid.toUpperCase();
    }, [state.characters, normalizeUserId]);

    useEffect(() => {
        const socket = getSocket(normalizedCurrentUserId || userId);

        const handleNewMsg = (msg: TextChatMessage) => {
            if (normalizeUserId(msg.userId) === normalizedCurrentUserId) return;
            setMessages(prev => {
                const exists = prev.find(m => m.id === msg.id);
                if (exists) return prev;
                const next = [...prev, msg];
                return next.length > 100 ? next.slice(next.length - 100) : next;
            });
            if (!isOpenRef.current) setUnreadCount(prev => prev + 1);
        };

        const handleHistoryReq = (data: { from: string; socketId: string }) => {
            const currentMsgs = messagesRef.current;
            if (currentMsgs.length > 0 && normalizeUserId(data.from) !== normalizedCurrentUserId) {
                socket.emit('text-chat-history-res', {
                    toSocketId: data.socketId,
                    messages: currentMsgs,
                });
            }
        };

        const handleHistoryRes = (msgs: TextChatMessage[]) => {
            setMessages(prev => prev.length < msgs.length ? msgs : prev);
        };

        socket.on('text-chat-msg', handleNewMsg);
        socket.on('text-chat-history-req', handleHistoryReq);
        socket.on('text-chat-history-res', handleHistoryRes);

        // Request history from other participants
        const historyTimer = setTimeout(() => {
            socket.emit('text-chat-history-req', { sessionId, from: normalizedCurrentUserId });
        }, 500);

        return () => {
            clearTimeout(historyTimer);
            socket.off('text-chat-msg', handleNewMsg);
            socket.off('text-chat-history-req', handleHistoryReq);
            socket.off('text-chat-history-res', handleHistoryRes);
        };
    }, [sessionId, userId, normalizedCurrentUserId, normalizeUserId]);

    useEffect(() => {
        isOpenRef.current = isOpen;
        if (isOpen) {
            setUnreadCount(0);
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 100);
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                const btn = document.getElementById('text-chat-toggle-btn');
                if (btn && btn.contains(e.target as Node)) return;
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        const newMsg: TextChatMessage = {
            id: uuidv4(),
            userId: normalizedCurrentUserId,
            text: inputText.trim(),
            timestamp: Date.now(),
            authorRole: userRole,
            authorLabel: userRole === "GM" ? "Mestre" : userId,
        };

        setMessages(prev => {
            const next = [...prev, newMsg];
            return next.length > 100 ? next.slice(next.length - 100) : next;
        });
        setInputText("");

        const socket = getSocket(normalizedCurrentUserId || userId);
        socket.emit('text-chat-send', { sessionId, message: newMsg });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
            <button
                id="text-chat-toggle-btn"
                onClick={() => setIsOpen(!isOpen)}
                title="Chat de Texto"
                style={{
                    background: isOpen ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(var(--accent-rgb), 0.05)',
                    border: '1px solid rgba(var(--accent-rgb), 0.2)',
                    color: 'var(--accent-color)',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.3s ease',
                    position: 'relative' as const,
                }}
            >
                <MessageSquare size={16} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        background: '#ff4d4d',
                        color: 'white',
                        fontSize: '0.6rem',
                        fontWeight: 'bold',
                        padding: '2px 4px',
                        borderRadius: '8px',
                        minWidth: '16px',
                        textAlign: 'center',
                    }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'fixed',
                        top: '70px',
                        right: '76px',
                        width: '300px',
                        height: '400px',
                        background: 'rgba(15, 15, 15, 0.97)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(var(--accent-rgb), 0.25)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(var(--accent-rgb), 0.1)',
                        zIndex: 2000,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <div style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid rgba(var(--accent-rgb), 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                    }}>
                        <span style={{
                            fontFamily: 'var(--font-header)',
                            fontSize: '0.75rem',
                            letterSpacing: '0.15em',
                            color: 'var(--accent-color)',
                            textTransform: 'uppercase',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}>
                            <MessageSquare size={14} /> CHAT
                        </span>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'rgba(255,255,255,0.4)',
                                cursor: 'pointer',
                                fontSize: '1rem',
                                padding: '2px 6px',
                                transition: 'color 0.2s',
                            }}
                            onMouseEnter={e => (e.target as HTMLElement).style.color = '#ff4d4d'}
                            onMouseLeave={e => (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.4)'}
                        >
                            ✕
                        </button>
                    </div>

                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                    }}>
                        {messages.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                color: 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                marginTop: '16px',
                                fontStyle: 'italic',
                            }}>
                                O chat está vazio. As mensagens desaparecem quando todos saem.
                            </div>
                        ) : (
                            messages.map((msg) => {
                                const isMe = normalizeUserId(msg.userId) === normalizedCurrentUserId;
                                return (
                                    <div key={msg.id} style={{
                                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                                        maxWidth: '85%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: isMe ? 'flex-end' : 'flex-start',
                                    }}>
                                        {!isMe && (
                                            <span style={{
                                                fontSize: '0.65rem',
                                                color: 'var(--text-secondary)',
                                                marginBottom: '2px',
                                                fontFamily: 'var(--font-header)',
                                                paddingLeft: '4px',
                                            }}>
                                                {getDisplayName(msg.userId, msg)}
                                            </span>
                                        )}
                                        <div style={{
                                            background: isMe ? 'rgba(var(--accent-rgb), 0.2)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${isMe ? 'rgba(var(--accent-rgb), 0.4)' : 'rgba(255,255,255,0.1)'}`,
                                            padding: '8px 10px',
                                            borderRadius: '6px',
                                            fontSize: '0.8rem',
                                            color: 'var(--text-primary)',
                                            wordBreak: 'break-word',
                                            whiteSpace: 'pre-wrap',
                                            lineHeight: 1.4,
                                        }}>
                                            {msg.text}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div style={{
                        padding: '10px',
                        borderTop: '1px solid rgba(var(--accent-rgb), 0.15)',
                        display: 'flex',
                        gap: '8px',
                    }}>
                        <textarea
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Mensagem..."
                            style={{
                                flex: 1,
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '4px',
                                padding: '8px',
                                color: 'white',
                                fontSize: '0.8rem',
                                resize: 'none',
                                height: '36px',
                                fontFamily: 'inherit',
                                overflow: 'hidden',
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!inputText.trim()}
                            style={{
                                background: inputText.trim() ? 'var(--accent-color)' : 'rgba(var(--accent-rgb), 0.2)',
                                color: inputText.trim() ? 'black' : 'rgba(255,255,255,0.3)',
                                border: 'none',
                                borderRadius: '4px',
                                width: '36px',
                                height: '36px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: inputText.trim() ? 'pointer' : 'default',
                                transition: 'all 0.2s',
                            }}
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
