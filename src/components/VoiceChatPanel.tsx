"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
    const [refreshKey, setRefreshKey] = useState(0);
    const [audioStatus, setAudioStatus] = useState<AudioContextState>('closed');
    const [audioInputDeviceId, setAudioInputDeviceId] = useState<string>('');
    const [audioOutputDeviceId, setAudioOutputDeviceId] = useState<string>('');
    const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [devicesLoaded, setDevicesLoaded] = useState(false);
    const supportsSinkId = typeof (new Audio() as any).setSinkId === 'function';
    const hasAttemptedAutoJoin = useRef(false);
    const managerRef = useRef<VoiceChatManager | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const speakingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const wasConnectedBeforeRefresh = useRef(false);

    const [events, setEvents] = useState<ActionEvent[]>([]);

    const loadDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputs = devices.filter(d => d.kind === 'audioinput' && d.deviceId);
            const outputs = devices.filter(d => d.kind === 'audiooutput' && d.deviceId);
            setInputDevices(inputs);
            setOutputDevices(outputs);
            setDevicesLoaded(true);
        } catch (e) {
            console.warn('[VoiceChatPanel] Error enumerating devices', e);
        }
    }, []);

    useEffect(() => {
        const savedInput = localStorage.getItem('voice_input_device');
        const savedOutput = localStorage.getItem('voice_output_device');
        if (savedInput) setAudioInputDeviceId(savedInput);
        if (savedOutput) setAudioOutputDeviceId(savedOutput);
    }, []);

    useEffect(() => {
        if (isConnected) {
            loadDevices();
            navigator.mediaDevices.addEventListener('devicechange', loadDevices);
            return () => {
                navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
            };
        }
    }, [isConnected, loadDevices]);

    const handleInputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const deviceId = e.target.value;
        setAudioInputDeviceId(deviceId);
        localStorage.setItem('voice_input_device', deviceId);
        if (managerRef.current && isConnected) {
            await managerRef.current.setMicDevice(deviceId);
        }
    }, [isConnected]);

    const handleOutputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const deviceId = e.target.value;
        setAudioOutputDeviceId(deviceId);
        localStorage.setItem('voice_output_device', deviceId);
        if (managerRef.current) {
            await managerRef.current.setOutputDevice(deviceId);
        }
    }, []);

    // Diagnóstico Etapa 1: Sanitização de IDs
    useEffect(() => {
        console.log('[VoiceChatPanel] Mount Props Sync Check:', {
            sessionId: JSON.stringify(sessionId),
            userId: JSON.stringify(userId),
            characterId: JSON.stringify(characterId)
        });
    }, [sessionId, userId, characterId]);

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
                // Cleanup síncrono para garantir que nenhum canal fique aberto antes do próximo useEffect
                mgr.disconnect();
            }
        };
    }, [sessionId, userId, refreshKey]);

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
        const handleClickOutside = (e: any) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                const btn = document.getElementById('voice-chat-toggle-btn');
                if (btn && btn.contains(e.target as Node)) return;
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside as any);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside as any);
    }, [isOpen]);

    const handleJoin = useCallback(async () => {
        const mgr = managerRef.current;
        if (!mgr || isJoining) return;
        setIsJoining(true);
        try {
            const savedOutput = localStorage.getItem('voice_output_device');
            if (savedOutput) {
                mgr.setOutputDevice(savedOutput).catch(console.warn);
            }
            const savedInput = localStorage.getItem('voice_input_device') || undefined;
            const ok = await mgr.joinVoice(savedInput);
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

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            wasConnectedBeforeRefresh.current = isConnected;

            // Limpar estados locais
            setIsConnected(false);
            setPeers([]);
            setParticipants([]);
            setLocalSpeaking(false);
            setLocalAudioLevel(0);

            // Trigger para recriar o manager via refreshKey (useEffect cleanup será chamado)
            setRefreshKey((prev: number) => prev + 1);
            
            // Note: O auto-reconnect agora é tratado pelo useEffect de auto-join, 
            // que aguarda isManagerReady ser true.
        } finally {
            setIsRefreshing(false);
        }
    }, [isRefreshing, isConnected]);

    // Auto-join effect (trata F5 da página e Nuclear Refresh)
    useEffect(() => {
        const autoJoin = localStorage.getItem(`voice_autojoin_${sessionId}`);
        const shouldJoin = (autoJoin === "true" && !hasAttemptedAutoJoin.current) || wasConnectedBeforeRefresh.current;

        if (shouldJoin && !isConnected && !isJoining && isManagerReady && managerRef.current) {
            const timeout = setTimeout(() => {
                hasAttemptedAutoJoin.current = true;
                wasConnectedBeforeRefresh.current = false;
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => !isRefreshing && (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
                                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => !isRefreshing && (e.currentTarget.style.backgroundColor = 'transparent')}
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
                                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = '#ff4d4d')}
                                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
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

                        {/* Seletores de Dispositivo */}
                        {isConnected && devicesLoaded && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)' }}>MIC (ENTRADA)</label>
                                    <select 
                                        value={audioInputDeviceId} 
                                        onChange={handleInputDeviceChange}
                                        style={{ 
                                            background: 'rgba(255,255,255,0.05)', 
                                            border: '1px solid rgba(255,255,255,0.1)', 
                                            color: '#fff', 
                                            padding: '4px 6px', 
                                            fontSize: '0.7rem',
                                            borderRadius: '4px',
                                            outline: 'none',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="">Padrão do Sistema</option>
                                        {inputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microfone'}</option>)}
                                    </select>
                                </div>
                                {supportsSinkId ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)' }}>FONE (SAÍDA)</label>
                                        <select
                                            value={audioOutputDeviceId}
                                            onChange={handleOutputDeviceChange}
                                            style={{
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                color: '#fff',
                                                padding: '4px 6px',
                                                fontSize: '0.7rem',
                                                borderRadius: '4px',
                                                outline: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <option value="">Padrão do Sistema</option>
                                            {outputDevices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Alto-falante'}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)', opacity: 0.6 }}>
                                        SAÍDA: não suportado neste browser
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Lista de TODOS os participantes em GRID COMPACTO */}
                    <div style={{
                        overflowY: 'auto',
                        flex: 1,
                        position: 'relative' as const, 
                        padding: '16px',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '20px',
                        justifyContent: 'flex-start',
                        alignContent: 'flex-start',
                    }}>
                        {/* Overlay de carregamento durante o refresh */}
                        {isRefreshing && (
                            <div style={{
                                position: 'absolute',
                                inset: 0,
                                background: 'rgba(15, 15, 15, 0.85)',
                                backdropFilter: 'blur(4px)',
                                zIndex: 100,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '15px',
                                transition: 'all 0.3s ease',
                            }}>
                                <div style={{
                                    width: '30px',
                                    height: '30px',
                                    border: '2px solid rgba(var(--accent-rgb), 0.1)',
                                    borderTop: '2px solid var(--accent-color)',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                }} />
                                <span style={{
                                    fontFamily: 'var(--font-header)',
                                    fontSize: '0.6rem',
                                    letterSpacing: '0.2em',
                                    color: 'var(--accent-color)',
                                    textTransform: 'uppercase',
                                }}>
                                    Reiniciando Malha de Voz...
                                </span>
                            </div>
                        )}

                        {allUsers.length === 0 && !isRefreshing && (
                            <div style={{
                                width: '100%',
                                padding: '20px 16px',
                                textAlign: 'center',
                                color: 'var(--text-secondary)',
                                fontSize: '0.75rem',
                                fontStyle: 'italic',
                            }}>
                                Aguardando participantes...
                            </div>
                        )}

                        {allUsers.map(user => {
                            const charImg = getCharacterImage(user.id, user.characterId);
                            const displayName = getDisplayName(user.id, user.characterId);
                            const shortName = displayName.length > 8 ? displayName.substring(0, 7) + ".." : displayName;
                            
                            return (
                                <div
                                    key={user.id}
                                    className="participant-card"
                                    title={displayName}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        width: '75px', // Tamanho fixo para o grid responder bem
                                        gap: '6px',
                                        padding: '4px',
                                        borderRadius: '8px',
                                        background: user.isMe ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent',
                                        position: 'relative' as const,
                                    }}
                                >
                                    {/* Círculo do Avatar */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <div style={{
                                            width: '50px',
                                            height: '50px',
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

                                        {/* Badge de Mudo em cima do avatar se necessário */}
                                        {user.inVoice && user.muted && (
                                            <div style={{
                                                position: 'absolute',
                                                bottom: '-2px',
                                                right: '-2px',
                                                width: '18px',
                                                height: '18px',
                                                background: '#ff4d4d',
                                                borderRadius: '50%',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.6rem',
                                                border: '1px solid #111',
                                                zIndex: 2,
                                            }}>
                                                🔇
                                            </div>
                                        )}
                                        
                                        {/* Pequena barra lateral de áudio level para feedback visual sutil */}
                                        {user.inVoice && (user.speaking || user.audioLevel > 0.05) && (
                                            <div style={{
                                                position: 'absolute',
                                                left: '-5px',
                                                bottom: '0',
                                                width: '3px',
                                                height: '20px',
                                                background: 'rgba(255,255,255,0.1)',
                                                borderRadius: '2px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: '100%',
                                                    height: `${Math.round(user.audioLevel * 100)}%`,
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    background: user.audioLevel > 0.6 ? '#50c878' : 'var(--accent-color)',
                                                    transition: 'height 0.1s ease-out'
                                                }} />
                                            </div>
                                        )}
                                    </div>

                                    {/* Nome Curto Abaixo */}
                                    <div style={{
                                        fontSize: '0.65rem',
                                        color: user.inVoice ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        fontFamily: 'var(--font-header)',
                                        textAlign: 'center',
                                        lineHeight: '1.1',
                                        width: '100%',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {shortName}
                                        {user.isMe && <div style={{ color: 'var(--accent-color)', fontSize: '0.55rem', opacity: 0.8 }}>EU</div>}
                                    </div>

                                    {/* Botões e Sliders compactos (visíveis em hover ou sutilmente) */}
                                    <div className="participant-controls" style={{
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px',
                                        alignItems: 'center',
                                        marginTop: '2px'
                                    }}>
                                        {user.inVoice && user.isMe && (
                                            <button
                                                onClick={handleToggleMic}
                                                style={{
                                                    background: micMuted ? 'rgba(255, 77, 77, 0.2)' : 'rgba(80, 200, 120, 0.1)',
                                                    border: 'none',
                                                    color: micMuted ? '#ff6666' : '#50c878',
                                                    padding: '2px 6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.55rem',
                                                    fontFamily: 'var(--font-header)',
                                                    borderRadius: '4px',
                                                }}
                                            >
                                                {micMuted ? 'OFF' : 'ON'}
                                            </button>
                                        )}
                                        {user.inVoice && !user.isMe && user.hasPeer && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => handlePeerMute(user.id)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: user.muted ? '#ff6666' : 'rgba(255,255,255,0.4)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.65rem',
                                                        padding: '0',
                                                    }}
                                                >
                                                    {user.muted ? '🔇' : '🔈'}
                                                </button>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="200"
                                                    value={user.volume}
                                                    onChange={e => handlePeerVolume(user.id, parseInt(e.target.value))}
                                                    style={{ width: '35px', accentColor: 'var(--accent-color)', height: '12px' }}
                                                />
                                            </div>
                                        )}
                                        {user.inVoice && user.isMe && (
                                            <input
                                                type="range"
                                                min="0"
                                                max="200"
                                                value={micVolume}
                                                onChange={e => handleMicVolume(parseInt(e.target.value))}
                                                style={{ width: '45px', accentColor: 'var(--accent-color)', height: '12px' }}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
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
                        const initial = getDisplayName(user.id, user.characterId).charAt(0).toUpperCase();
                        return (
                            <div
                                key={`indicator-${user.id}`}
                                title={getDisplayName(user.id, user.characterId)}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '3px',
                                    pointerEvents: 'auto',
                                    cursor: 'default',
                                }}
                            >
                                <div style={{
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
                                    transition: 'all 0.2s ease',
                                }}>
                                    {!charImg && initial}
                                </div>
                                <div style={{
                                    fontSize: '0.55rem',
                                    color: user.speaking ? '#50c878' : 'rgba(255,255,255,0.5)',
                                    fontFamily: 'var(--font-header)',
                                    textAlign: 'center',
                                    letterSpacing: '0.05em',
                                    textTransform: 'uppercase',
                                }}>
                                    {initial}
                                </div>
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
