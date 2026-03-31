"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { VoiceChatManager, VoicePeer, SessionParticipant } from "@/lib/VoiceChatManager";
import { globalEventStore } from "@/lib/eventStore";
import { computeState } from "@/lib/projections";
import { ActionEvent } from "@/types/domain";
import { Mic, MicOff, RefreshCw } from "lucide-react";

interface VoiceChatPanelProps {
    sessionId: string;
    userId: string;
    characterId?: string;
}

export function VoiceChatPanel({ sessionId, userId, characterId }: VoiceChatPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [micVolume, setMicVolume] = useState(100); // 0-100
    const [peers, setPeers] = useState<VoicePeer[]>([]);
    const [participants, setParticipants] = useState<SessionParticipant[]>([]);
    const [localSpeaking, setLocalSpeaking] = useState(false);
    const [localAudioLevel, setLocalAudioLevel] = useState(0);
    const [isJoining, setIsJoining] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isManagerReady, setIsManagerReady] = useState(false);
    const [audioStatus, setAudioStatus] = useState<AudioContextState>('closed');
    const hasAttemptedAutoJoin = useRef(false);
    const managerRef = useRef<VoiceChatManager | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const speakingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [events, setEvents] = useState<ActionEvent[]>([]);

    useEffect(() => {
        setEvents(globalEventStore.getEvents());
        const unsubscribe = globalEventStore.subscribe(
            (event) => {
                if (event.sessionId === sessionId) {
                    setEvents(prev => {
                        const idx = prev.findIndex(e => e.id === event.id);
                        if (idx !== -1) {
                            if (prev[idx].seq === 0 && (event.seq || 0) !== 0) {
                                const next = [...prev];
                                next[idx] = event;
                                return next;
                            }
                            return prev;
                        }
                        return [...prev, event];
                    });
                }
            },
            (bulkEvents) => setEvents(bulkEvents)
        );
        return () => unsubscribe();
    }, [sessionId]);

    const state = useMemo(() => {
        const sorted = [...events].sort((a, b) => {
            const seqA = a.seq || 0;
            const seqB = b.seq || 0;
            if (seqA !== 0 && seqB !== 0 && seqA !== seqB) return seqA - seqB;
            if (seqA === 0 && seqB !== 0) return 1;
            if (seqA !== 0 && seqB === 0) return -1;
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
        return computeState(sorted);
    }, [events]);

    const getDisplayName = useCallback((uid: string, charId?: string) => {
        const uidLower = uid.trim().toLowerCase();
        const storedRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'PLAYER';

        if (uidLower.includes('mestre') || uidLower === 'gm' || uidLower === 'narrador' || uidLower === 'narradora') {
            return uid;
        }

        if (storedRole === 'GM' && uid === userId) {
            return uid;
        }

        const allChars = Object.values(state.characters);

        // Prioridade: busca pelo characterId quando disponível
        if (charId) {
            const byId = allChars.find(c => c.id === charId);
            if (byId) return byId.name;
        }

        // Fallback: busca por ownerUserId, nome ou id
        const matchedChar = allChars.find(c => {
            const ownerMatch = (c.ownerUserId || "").trim().toLowerCase() === uidLower;
            const nameMatch = (c.name || "").trim().toLowerCase() === uidLower;
            const idMatch = c.id.toLowerCase() === uidLower;
            return (ownerMatch || nameMatch || idMatch) && c.imageUrl;
        }) || allChars.find(c => {
            const ownerMatch = (c.ownerUserId || "").trim().toLowerCase() === uidLower;
            const nameMatch = (c.name || "").trim().toLowerCase() === uidLower;
            const idMatch = c.id.toLowerCase() === uidLower;
            return (ownerMatch || nameMatch || idMatch);
        });

        return matchedChar ? matchedChar.name : uid;
    }, [state.characters, userId]);

    const getCharacterImage = useCallback((uid: string, charId?: string) => {
        const uidLower = uid.trim().toLowerCase();
        const storedRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'PLAYER';

        if (uidLower.includes('mestre') || uidLower === 'gm' || uidLower === 'narrador' || uidLower === 'narradora') {
            return null;
        }
        if (storedRole === 'GM' && uid === userId) return null;

        const allChars = Object.values(state.characters);

        // Prioridade: busca pelo characterId quando disponível (evita erros de nome/ownerUserId)
        if (charId) {
            const byId = allChars.find(c => c.id === charId && c.imageUrl);
            if (byId) return byId.imageUrl;
        }

        // Fallback: busca robusta por ownerUserId, nome ou id
        const matchedChar = allChars.find(c => {
            const ownerMatch = (c.ownerUserId || "").trim().toLowerCase() === uidLower;
            const nameMatch = (c.name || "").trim().toLowerCase() === uidLower;
            const idMatch = c.id.toLowerCase() === uidLower;
            return (ownerMatch || nameMatch || idMatch) && c.imageUrl;
        });

        return matchedChar?.imageUrl || null;
    }, [state.characters, userId]);

    // Inicializar manager
    useEffect(() => {
        const initTimer = setTimeout(() => {
            if (!managerRef.current) {
                const manager = new VoiceChatManager(
                    sessionId,
                    userId,
                    (updatedPeers) => {
                        setPeers([...updatedPeers]);
                    },
                    (updatedParticipants) => {
                        setParticipants([...updatedParticipants]);
                    },
                    characterId
                );

                manager.initialize();
                managerRef.current = manager;
                setIsManagerReady(true);
            }
        }, 300);

        return () => {
            clearTimeout(initTimer);
            if (speakingPollRef.current) clearInterval(speakingPollRef.current);
            if (managerRef.current) {
                const mgr = managerRef.current;
                managerRef.current = null;
                setIsManagerReady(false);
                setTimeout(() => mgr.disconnect(), 200);
            }
        };
    }, [sessionId, userId]);

    // Poll speaking state para feedback visual
    useEffect(() => {
        if (isConnected) {
            speakingPollRef.current = setInterval(() => {
                const mgr = managerRef.current;
                if (mgr) {
                    setLocalSpeaking(mgr.localSpeaking);
                    setLocalAudioLevel(mgr.localAudioLevel);
                    setAudioStatus(mgr.audioContextState);

                    setPeers(prev => {
                        let changed = false;
                        const next = prev.map(p => {
                            const isSpeaking = mgr.isPeerSpeaking(p.peerId);
                            const audioLevel = mgr.getPeerAudioLevel(p.peerId);
                            // Só marcar como alterado se a mudança for significativa (>5% no nível ou mudança no boolean)
                            if (p.speaking !== isSpeaking || Math.abs(p.audioLevel - audioLevel) > 0.05) {
                                changed = true;
                                return { ...p, speaking: isSpeaking, audioLevel: audioLevel };
                            }
                            return p;
                        });
                        return changed ? next : prev;
                    });
                }
            }, 300);
        } else {
            if (speakingPollRef.current) {
                clearInterval(speakingPollRef.current);
                speakingPollRef.current = null;
            }
        }

        return () => {
            if (speakingPollRef.current) clearInterval(speakingPollRef.current);
        };
    }, [isConnected]);

    // Fechar painel ao clicar fora
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                const btn = document.getElementById('voice-chat-toggle-btn');
                if (btn && btn.contains(e.target as Node)) return;
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleJoin = useCallback(async () => {
        const mgr = managerRef.current;
        if (!mgr || isJoining) return;
        setIsJoining(true);
        try {
            const ok = await mgr.joinVoice();
            if (ok) {
                setIsConnected(true);
                setMicMuted(false);
                localStorage.setItem(`voice_autojoin_${sessionId}`, "true");
            }
        } finally {
            setIsJoining(false);
        }
    }, [sessionId, isJoining]);

    const handleLeave = useCallback(() => {
        const mgr = managerRef.current;
        if (!mgr) return;
        mgr.leaveVoice();
        setIsConnected(false);
        setMicMuted(false);
        setPeers([]);
        setLocalSpeaking(false);
        setLocalAudioLevel(0);
        localStorage.removeItem(`voice_autojoin_${sessionId}`);
    }, [sessionId]);

    // Refresh silencioso do chat de voz
    const handleRefresh = useCallback(async () => {
        if (isRefreshing || !managerRef.current) return;
        setIsRefreshing(true);
        try {
            const mgr = managerRef.current;
            const wasConnected = isConnected;

            // Desconectar tudo
            mgr.leaveVoice();
            setPeers([]);
            setLocalSpeaking(false);
            setLocalAudioLevel(0);

            // Aguardar curto período para limpeza de rede/DB
            await new Promise(resolve => setTimeout(resolve, 800));

            // Re-entrar automaticamente se estava conectado
            if (wasConnected) {
                const ok = await mgr.joinVoice();
                if (ok) setIsConnected(true);
            }
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, isConnected]);

    // Auto-join effect
    useEffect(() => {
        const autoJoin = localStorage.getItem(`voice_autojoin_${sessionId}`);
        if (autoJoin === "true" && !isConnected && !isJoining && isManagerReady && managerRef.current && !hasAttemptedAutoJoin.current) {
            const timeout = setTimeout(() => {
                hasAttemptedAutoJoin.current = true;
                handleJoin();
            }, 800);
            return () => clearTimeout(timeout);
        }
    }, [sessionId, isConnected, isJoining, isManagerReady, handleJoin]);

    const handleToggleMic = useCallback(() => {
        const mgr = managerRef.current;
        if (!mgr) return;
        const newMuted = !micMuted;
        mgr.setMicMuted(newMuted);
        setMicMuted(newMuted);
    }, [micMuted]);

    const handleMicVolume = useCallback((vol: number) => {
        const mgr = managerRef.current;
        if (!mgr) return;
        setMicVolume(vol);
        mgr.setMicVolume(vol / 100);
    }, []);

    const handlePeerVolume = useCallback((peerId: string, vol: number) => {
        const mgr = managerRef.current;
        if (!mgr) return;
        mgr.setPeerVolume(peerId, vol / 100);
        setPeers(prev => prev.map(p =>
            p.peerId === peerId ? { ...p, volume: vol / 100 } : p
        ));
    }, []);

    const handlePeerMute = useCallback((peerId: string) => {
        const mgr = managerRef.current;
        if (!mgr) return;
        const peer = peers.find(p => p.peerId === peerId);
        if (peer) {
            mgr.setPeerMuted(peerId, !peer.muted);
        }
    }, [peers]);

    // Juntar participantes e peers: todos aparecem, com status de voice
    const allUsers = useMemo(() => {
        const users = participants.map(p => {
            const peer = peers.find(vp => vp.peerId === p.userId);
            const isMe = p.userId === userId;
            return {
                id: p.userId,
                characterId: isMe ? characterId : p.characterId,
                isMe,
                inVoice: isMe ? isConnected : (peer?.inVoice || p.inVoice),
                speaking: isMe ? localSpeaking : (peer?.speaking || false),
                audioLevel: isMe ? localAudioLevel : (peer?.audioLevel || 0),
                volume: isMe ? micVolume : (peer ? Math.round(peer.volume * 100) : 100),
                muted: isMe ? micMuted : (peer?.muted || false),
                hasPeer: !!peer,
            };
        });

        // Garantir que o usuário local está sempre na lista
        if (!users.find(u => u.isMe)) {
            users.unshift({
                id: userId,
                characterId,
                isMe: true,
                inVoice: isConnected,
                speaking: localSpeaking,
                audioLevel: localAudioLevel,
                volume: micVolume,
                muted: micMuted,
                hasPeer: false,
            });
        }

        // Mover "eu" para o topo
        return users.sort((a, b) => {
            if (a.isMe) return -1;
            if (b.isMe) return 1;
            return 0;
        });
    }, [participants, peers, userId, characterId, isConnected, localSpeaking, localAudioLevel, micVolume, micMuted]);

    const voiceCount = allUsers.filter(u => u.inVoice).length;

    // Shared styles
    const sliderTrackStyle: React.CSSProperties = {
        width: '100%',
        accentColor: 'var(--accent-color)',
        cursor: 'pointer',
        height: '4px',
    };

    const volNumStyle: React.CSSProperties = {
        fontSize: '0.65rem',
        color: 'var(--accent-color)',
        fontFamily: 'var(--font-header)',
        letterSpacing: '0.05em',
        minWidth: '32px',
        textAlign: 'right' as const,
    };

    return (
        <>
            {/* Botão do microfone no header */}
            <button
                id="voice-chat-toggle-btn"
                onClick={() => setIsOpen(!isOpen)}
                title="Voice Chat"
                style={{
                    background: isConnected
                        ? (localSpeaking ? 'rgba(80, 200, 120, 0.3)' : 'rgba(80, 200, 120, 0.15)')
                        : 'rgba(var(--accent-rgb), 0.05)',
                    border: `1px solid ${isConnected ? 'rgba(80, 200, 120, 0.5)' : 'rgba(var(--accent-rgb), 0.2)'}`,
                    color: isConnected ? '#50c878' : 'var(--accent-color)',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center', // Adicionado para centralizar o ícone sozinho
                    gap: '6px',
                    transition: 'all 0.3s ease',
                    position: 'relative' as const,
                }}
            >
                {micMuted ? <MicOff size={18} /> : <Mic size={18} />}

                {voiceCount > 0 && (
                    <span style={{
                        background: isConnected ? '#50c878' : 'var(--accent-color)',
                        color: '#000',
                        borderRadius: '50%',
                        width: '16px',
                        height: '16px',
                        fontSize: '0.6rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold',
                    }}>
                        {voiceCount}
                    </span>
                )}
                {isConnected && (
                    <span style={{
                        position: 'absolute',
                        top: '-2px',
                        right: '-2px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#50c878',
                        boxShadow: '0 0 6px rgba(80, 200, 120, 0.6)',
                        animation: 'voice-pulse 2s infinite',
                    }} />
                )}
            </button>

            {/* Painel de Voice Chat */}
            {isOpen && (
                <div
                    ref={panelRef}
                    style={{
                        position: 'fixed',
                        top: '70px',
                        right: '16px',
                        width: '320px',
                        maxHeight: '520px',
                        background: 'rgba(15, 15, 15, 0.97)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(var(--accent-rgb), 0.25)',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(var(--accent-rgb), 0.1)',
                        zIndex: 2000,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    {/* Header do painel */}
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
                        }}>
                            🎤 VOICE CHAT
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                title="Reiniciar Conexão de Voz"
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: isRefreshing ? 'var(--accent-color)' : 'rgba(255,255,255,0.4)',
                                    cursor: isRefreshing ? 'wait' : 'pointer',
                                    display: 'flex',
                                    padding: '4px',
                                    borderRadius: '4px',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={e => !isRefreshing && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                                onMouseLeave={e => !isRefreshing && (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} style={{
                                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                                }} />
                            </button>
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
                                onMouseEnter={e => (e.currentTarget.style.color = '#ff4d4d')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Botão de conectar/desconectar */}
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(var(--accent-rgb), 0.1)' }}>
                        {audioStatus === 'suspended' && (
                            <button
                                onClick={async () => {
                                    const mgr = managerRef.current;
                                    if (mgr) await handleJoin(); // Chama join que já tem o resume
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    marginBottom: '10px',
                                    background: 'rgba(255, 165, 0, 0.15)',
                                    border: '1px solid rgba(255, 165, 0, 0.4)',
                                    color: '#ffa500',
                                    cursor: 'pointer',
                                    fontFamily: 'var(--font-header)',
                                    fontSize: '0.7rem',
                                    letterSpacing: '0.15em',
                                    textTransform: 'uppercase',
                                    textAlign: 'center',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    animation: 'pulse 1.5s infinite',
                                }}
                            >
                                ⚠️ ATIVAR ÁUDIO DO NAVEGADOR
                            </button>
                        )}
                        
                        <button
                            onClick={isConnected ? handleLeave : handleJoin}
                            disabled={isJoining}
                            style={{
                                width: '100%',
                                padding: '10px',
                                background: isJoining
                                    ? 'rgba(255, 204, 0, 0.1)'
                                    : (isConnected ? 'rgba(255, 77, 77, 0.1)' : 'rgba(80, 200, 120, 0.1)'),
                                border: `1px solid ${isJoining
                                    ? 'rgba(255, 204, 0, 0.3)'
                                    : (isConnected ? 'rgba(255, 77, 77, 0.3)' : 'rgba(80, 200, 120, 0.3)')}`,
                                color: isJoining
                                    ? '#ffcc00'
                                    : (isConnected ? '#ff6666' : '#50c878'),
                                cursor: isJoining ? 'wait' : 'pointer',
                                fontFamily: 'var(--font-header)',
                                fontSize: '0.7rem',
                                letterSpacing: '0.15em',
                                textTransform: 'uppercase',
                                transition: 'all 0.3s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                opacity: isJoining ? 0.8 : 1,
                            }}
                        >
                            <span>{isJoining ? '⏳' : (isConnected ? '📴' : '📡')}</span>
                            {isJoining ? 'CONECTANDO...' : (isConnected ? 'SAIR DO VOICE' : 'ENTRAR NO VOICE')}
                        </button>
                    </div>

                    {/* Lista de TODOS os participantes */}
                    <div style={{
                        overflowY: 'auto',
                        flex: 1,
                    }}>
                        {allUsers.length === 0 && (
                            <div style={{
                                padding: '20px 16px',
                                textAlign: 'center',
                                color: 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                fontStyle: 'italic',
                            }}>
                                Aguardando participantes...
                            </div>
                        )}

                        {allUsers.map(user => (
                            <div
                                key={user.id}
                                style={{
                                    padding: '12px 16px',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    background: user.isMe ? 'rgba(var(--accent-rgb), 0.03)' : 'transparent',
                                }}
                            >
                                {/* Linha 1: Avatar + Nome + Status */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    marginBottom: '6px',
                                }}>
                                    {/* Indicador de fala / status */}
                                    {(() => {
                                        const charImg = getCharacterImage(user.id, user.characterId);
                                        return (
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <div style={{
                                                    width: '45px',
                                                    height: '45px',
                                                    borderRadius: '50%',
                                                    background: charImg
                                                        ? `url(${charImg}) center/cover no-repeat`
                                                        : (user.inVoice
                                                            ? (user.speaking ? 'rgba(80, 200, 120, 0.35)' : 'rgba(80, 200, 120, 0.08)')
                                                            : 'rgba(255,255,255,0.04)'),
                                                    border: `2px solid ${user.inVoice
                                                        ? (user.speaking ? '#50c878' : 'rgba(80, 200, 120, 0.3)')
                                                        : 'rgba(255,255,255,0.08)'}`,
                                                    boxShadow: user.speaking
                                                        ? '0 0 10px rgba(80, 200, 120, 0.6), 0 0 20px rgba(80, 200, 120, 0.3)'
                                                        : 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.2rem',
                                                    transition: 'all 0.2s ease',
                                                }}>
                                                    {!charImg && (!user.inVoice ? '👤' : (user.muted ? '🔇' : (user.speaking ? '🔊' : '🎤')))}
                                                </div>
                                                {charImg && (
                                                    <span style={{
                                                        position: 'absolute',
                                                        bottom: '-2px',
                                                        right: '-6px',
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: user.inVoice
                                                            ? (user.speaking ? 'rgba(80, 200, 120, 0.9)' : 'rgba(30, 30, 30, 0.95)')
                                                            : 'rgba(30, 30, 30, 0.95)',
                                                        border: `1px solid ${user.inVoice ? (user.speaking ? '#50c878' : 'rgba(80,200,120,0.3)') : 'rgba(255,255,255,0.1)'}`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.85rem',
                                                        fontFamily: 'var(--font-header)',
                                                        fontWeight: 'bold',
                                                        color: user.speaking ? '#fff' : 'rgba(255,255,255,0.6)',
                                                    }}>
                                                        {getDisplayName(user.id, user.characterId).charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Nome */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: '0.75rem',
                                            color: 'var(--text-primary)',
                                            fontFamily: 'var(--font-header)',
                                            letterSpacing: '0.05em',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {getDisplayName(user.id, user.characterId)} {user.isMe && <span style={{ color: 'var(--accent-color)', fontSize: '0.6rem' }}>(EU)</span>}
                                        </div>
                                        <div style={{
                                            fontSize: '0.6rem',
                                            color: user.inVoice ? '#50c878' : 'var(--text-secondary)',
                                            marginTop: '1px',
                                        }}>
                                            {user.inVoice
                                                ? (user.isMe ? (user.muted ? 'Mic desligado' : 'No voice') : 'No voice')
                                                : 'Online'
                                            }
                                        </div>
                                    </div>

                                    {/* Botão mute (para eu ou para peers conectados) */}
                                    {user.inVoice && user.isMe && (
                                        <button
                                            onClick={handleToggleMic}
                                            style={{
                                                background: micMuted ? 'rgba(255, 77, 77, 0.15)' : 'rgba(80, 200, 120, 0.15)',
                                                border: `1px solid ${micMuted ? 'rgba(255, 77, 77, 0.3)' : 'rgba(80, 200, 120, 0.3)'}`,
                                                color: micMuted ? '#ff6666' : '#50c878',
                                                padding: '4px 8px',
                                                cursor: 'pointer',
                                                fontSize: '0.6rem',
                                                fontFamily: 'var(--font-header)',
                                                letterSpacing: '0.1em',
                                                transition: 'all 0.2s',
                                                flexShrink: 0,
                                            }}
                                            title={micMuted ? 'Ativar Mic' : 'Desativar Mic'}
                                        >
                                            {micMuted ? 'ATIVAR' : 'MUDO'}
                                        </button>
                                    )}

                                    {user.inVoice && !user.isMe && user.hasPeer && (
                                        <button
                                            onClick={() => handlePeerMute(user.id)}
                                            style={{
                                                background: user.muted ? 'rgba(255, 77, 77, 0.15)' : 'transparent',
                                                border: `1px solid ${user.muted ? 'rgba(255, 77, 77, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                                                color: user.muted ? '#ff6666' : 'var(--text-secondary)',
                                                padding: '4px 6px',
                                                cursor: 'pointer',
                                                fontSize: '0.7rem',
                                                transition: 'all 0.2s',
                                                borderRadius: '2px',
                                                flexShrink: 0,
                                            }}
                                            title={user.muted ? 'Desmutar' : 'Mutar'}
                                        >
                                            {user.muted ? '🔇' : '🔈'}
                                        </button>
                                    )}
                                </div>

                                {/* Linha 2: Barra de volume (para eu = mic volume, para peers = volume de reprodução) */}
                                {user.inVoice && user.isMe && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        paddingLeft: '40px',
                                    }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', flexShrink: 0 }}>🎤</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="200"
                                            value={micVolume}
                                            onChange={e => handleMicVolume(parseInt(e.target.value))}
                                            style={sliderTrackStyle}
                                            title={`Volume do Mic: ${micVolume}%`}
                                        />
                                        <span style={volNumStyle}>{micVolume}%</span>
                                    </div>
                                )}

                                {/* Barra de nível de áudio (indicador visual) */}
                                {user.inVoice && (user.isMe ? isConnected : user.hasPeer) && (
                                    <div style={{
                                        paddingLeft: '40px',
                                        marginTop: '4px',
                                        marginBottom: '6px'
                                    }}>
                                        <div style={{
                                            height: '3px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '2px',
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                height: '100%',
                                                width: `${Math.round(user.audioLevel * 100)}%`,
                                                background: user.audioLevel > 0.6 ? '#50c878' : (user.audioLevel > 0.3 ? 'var(--accent-color)' : 'rgba(var(--accent-rgb), 0.4)'),
                                                transition: 'width 0.1s ease-out, background 0.3s',
                                                borderRadius: '2px',
                                            }} />
                                        </div>
                                    </div>
                                )}

                                {/* Volume do peer */}
                                {user.inVoice && !user.isMe && user.hasPeer && (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        paddingLeft: '40px',
                                    }}>
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', flexShrink: 0 }}>🔊</span>
                                        <input
                                            type="range"
                                            min="0"
                                            max="200"
                                            value={user.volume}
                                            onChange={e => handlePeerVolume(user.id, parseInt(e.target.value))}
                                            style={sliderTrackStyle}
                                            title={`Volume: ${user.volume}%`}
                                        />
                                        <span style={volNumStyle}>{user.volume}%</span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Footer com status */}
                    <div style={{
                        padding: '8px 16px',
                        borderTop: '1px solid rgba(var(--accent-rgb), 0.1)',
                        fontSize: '0.6rem',
                        color: 'var(--text-secondary)',
                        textAlign: 'center',
                        fontFamily: 'var(--font-header)',
                        letterSpacing: '0.1em',
                    }}>
                        {allUsers.length} na sessão • {voiceCount} no voice
                    </div>
                </div>
            )}

            {/* Indicadores flutuantes de voice no canto superior direito */}
            {allUsers.filter(u => u.inVoice).length > 0 && (
                <div style={{
                    position: 'fixed',
                    top: '78px',
                    right: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    zIndex: 1050,
                    pointerEvents: 'none',
                    alignItems: 'flex-end',
                }}>
                    {allUsers.filter(u => u.inVoice).map(user => {
                        const charImg = getCharacterImage(user.id, user.characterId);
                        return (
                            <div
                                key={`indicator-${user.id}`}
                                title={getDisplayName(user.id, user.characterId)}
                                style={{
                                    position: 'relative',
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '50%',
                                    background: charImg
                                        ? `url(${charImg}) center/cover no-repeat`
                                        : (user.speaking
                                            ? 'rgba(80, 200, 120, 0.25)'
                                            : 'rgba(30, 30, 30, 0.6)'),
                                    border: `2px solid ${user.speaking ? '#50c878' : 'rgba(255,255,255,0.12)'}`,
                                    boxShadow: user.speaking
                                        ? '0 0 12px rgba(80, 200, 120, 0.7), 0 0 24px rgba(80, 200, 120, 0.3)'
                                        : '0 2px 8px rgba(0,0,0,0.4)',
                                    backdropFilter: 'blur(8px)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.15rem',
                                    fontFamily: 'var(--font-header)',
                                    fontWeight: 'bold',
                                    color: user.speaking ? '#50c878' : 'rgba(255,255,255,0.5)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0',
                                    transition: 'all 0.2s ease',
                                    pointerEvents: 'auto',
                                    cursor: 'default',
                                }}
                            >
                                {!charImg && getDisplayName(user.id, user.characterId).charAt(0).toUpperCase()}
                                {charImg && (
                                    <span style={{
                                        position: 'absolute',
                                        bottom: '-3px',
                                        right: '-5px',
                                        width: '21px',
                                        height: '21px',
                                        borderRadius: '50%',
                                        background: user.speaking ? 'rgba(80, 200, 120, 0.9)' : 'rgba(30, 30, 30, 0.95)',
                                        border: `1px solid ${user.speaking ? '#50c878' : 'rgba(255,255,255,0.15)'}`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        color: user.speaking ? '#fff' : 'rgba(255,255,255,0.6)',
                                    }}>
                                        {getDisplayName(user.id, user.characterId).charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CSS animations */}
            <style jsx>{`
                @keyframes voice-pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.3); }
                }
            `}</style>
        </>
    );
}
