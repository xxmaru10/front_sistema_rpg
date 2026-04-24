"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, useSyncExternalStore } from "react";
import { VoiceChatManager, VoicePeer, SessionParticipant } from "@/lib/VoiceChatManager";
import { useProjectedCharacters } from "@/lib/projectedStateStore";
import { Mic, MicOff, RefreshCw } from "lucide-react";
import { logStory59 } from "@/lib/story59Debug";

interface VoiceChatPanelProps {
    sessionId: string;
    userId: string;
    characterId?: string;
    isMobile?: boolean;
}

type VoiceActivitySnapshot = {
    speaking: boolean;
    audioLevel: number;
};

const EMPTY_VOICE_ACTIVITY: VoiceActivitySnapshot = Object.freeze({ speaking: false, audioLevel: 0 });
const EMPTY_LOCAL_ACTIVITY: VoiceActivitySnapshot & { audioStatus: AudioContextState | 'closed' } = Object.freeze({
    speaking: false,
    audioLevel: 0,
    audioStatus: 'closed',
});

interface VoiceActivityConsumerProps {
    managerRef: React.RefObject<VoiceChatManager | null>;
    managerEpoch: number;
    peerId: string;
    isMe: boolean;
    children: (activity: VoiceActivitySnapshot) => React.ReactNode;
}

function VoiceActivityConsumer({ managerRef, managerEpoch, peerId, isMe, children }: VoiceActivityConsumerProps) {
    const activity = useSyncExternalStore(
        useCallback((onStoreChange) => {
            const mgr = managerRef.current;
            if (!mgr) return () => { };
            return mgr.subscribeSpeakingState(onStoreChange);
        }, [managerRef, managerEpoch]),
        useCallback(() => {
            const mgr = managerRef.current;
            if (!mgr) return EMPTY_VOICE_ACTIVITY;
            if (isMe) return mgr.getLocalSpeakingSnapshot();
            return mgr.getPeerSpeakingSnapshot(peerId);
        }, [managerRef, managerEpoch, isMe, peerId]),
        () => EMPTY_VOICE_ACTIVITY
    );

    return <>{children(activity)}</>;
}

function areVoicePeersEqual(prev: VoicePeer[], next: VoicePeer[]): boolean {
    if (prev.length !== next.length) return false;
    const sortedPrev = [...prev].sort((a, b) => a.peerId.localeCompare(b.peerId));
    const sortedNext = [...next].sort((a, b) => a.peerId.localeCompare(b.peerId));
    for (let i = 0; i < sortedPrev.length; i += 1) {
        const a = sortedPrev[i];
        const b = sortedNext[i];
        if (a.peerId !== b.peerId) return false;
        if (a.stream !== b.stream) return false;
        if (a.muted !== b.muted) return false;
        if (Math.abs(a.volume - b.volume) > 0.001) return false;
        if (a.inVoice !== b.inVoice) return false;
    }
    return true;
}

function areSessionParticipantsEqual(prev: SessionParticipant[], next: SessionParticipant[]): boolean {
    if (prev.length !== next.length) return false;
    const norm = (s: string) => (s || "").trim().toLowerCase().normalize("NFC");
    const sortedPrev = [...prev].sort((a, b) => norm(a.userId).localeCompare(norm(b.userId)));
    const sortedNext = [...next].sort((a, b) => norm(a.userId).localeCompare(norm(b.userId)));
    for (let i = 0; i < sortedPrev.length; i += 1) {
        const a = sortedPrev[i];
        const b = sortedNext[i];
        if (norm(a.userId) !== norm(b.userId)) return false;
        if (a.inVoice !== b.inVoice) return false;
        if ((a.characterId || "") !== (b.characterId || "")) return false;
    }
    return true;
}

function normalizeVoiceUserId(value: string): string {
    return (value || "").trim().toLowerCase().normalize("NFC");
}

function VoiceChatPanelComponent({ sessionId, userId, characterId, isMobile = false }: VoiceChatPanelProps) {
    const isBluetoothLabel = useCallback((label: string) => {
        const v = (label || "").toLowerCase();
        return v.includes("bluetooth") || v.includes("hands-free") || v.includes("hands free") || v.includes("hfp") || v.includes("airpods");
    }, []);

    const [isOpen, setIsOpen] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [micMuted, setMicMuted] = useState(false);
    const [micVolume, setMicVolume] = useState(100); // 0-100
    const [peers, setPeers] = useState<VoicePeer[]>([]);
    const [participants, setParticipants] = useState<SessionParticipant[]>([]);
    const [isJoining, setIsJoining] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isManagerReady, setIsManagerReady] = useState(false);
    const [managerEpoch, setManagerEpoch] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [showBluetoothWarning, setShowBluetoothWarning] = useState(true);
    const [audioInputDeviceId, setAudioInputDeviceId] = useState<string>('');
    const [audioOutputDeviceId, setAudioOutputDeviceId] = useState<string>('');
    const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
    const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
    const [devicesLoaded, setDevicesLoaded] = useState(false);
    const supportsSinkId = typeof (new Audio() as any).setSinkId === 'function';
    const hasAttemptedAutoJoin = useRef(false);
    const managerRef = useRef<VoiceChatManager | null>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const wasConnectedBeforeRefresh = useRef(false);
    const renderCountRef = useRef(0);
    // Persiste o último characterId conhecido por userId para evitar flicker
    // quando a presença chega com update parcial (sem characterId)
    const lastKnownCharacterIdRef = useRef<Map<string, string>>(new Map());

    renderCountRef.current += 1;

    useEffect(() => {
        logStory59("VoiceChatPanel", "mount", { sessionId, userId, isMobile });
        return () => logStory59("VoiceChatPanel", "unmount", { sessionId, userId, isMobile });
    }, [sessionId, userId, isMobile]);

    useEffect(() => {
        logStory59("VoiceChatPanel", "render", {
            count: renderCountRef.current,
            isConnected,
            peers: peers.length,
            participants: participants.length,
            isOpen,
        });
    });

    const localVoice = useSyncExternalStore(
        useCallback((onStoreChange) => {
            const mgr = managerRef.current;
            if (!mgr) return () => { };
            return mgr.subscribeSpeakingState(onStoreChange);
        }, [managerEpoch]),
        useCallback(() => {
            const mgr = managerRef.current;
            if (!mgr) return EMPTY_LOCAL_ACTIVITY;
            return mgr.getLocalSpeakingSnapshot();
        }, [managerEpoch]),
        () => EMPTY_LOCAL_ACTIVITY
    );
    const localSpeaking = localVoice.speaking;
    const localAudioLevel = localVoice.audioLevel;
    const audioStatus = localVoice.audioStatus;

    useEffect(() => {
        const savedInput = localStorage.getItem('voice_input_device');
        const savedOutput = localStorage.getItem('voice_output_device');
        if (savedInput) setAudioInputDeviceId(savedInput);
        if (savedOutput) setAudioOutputDeviceId(savedOutput);
    }, []);

    const loadDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputs = devices.filter(d => d.kind === 'audioinput' && d.deviceId);
            const outputs = devices.filter(d => d.kind === 'audiooutput' && d.deviceId);
            setInputDevices(inputs);
            setOutputDevices(outputs);
            setDevicesLoaded(true);

            // Evita manter device Bluetooth Hands-Free como entrada quando houver alternativa.
            const selected = inputs.find(d => d.deviceId === audioInputDeviceId);
            const nonBt = inputs.find(d => !isBluetoothLabel(d.label));
            if (nonBt && (!audioInputDeviceId || (selected && isBluetoothLabel(selected.label)))) {
                setAudioInputDeviceId(nonBt.deviceId);
                localStorage.setItem('voice_input_device', nonBt.deviceId);
                if (managerRef.current && isConnected) {
                    await managerRef.current.setMicDevice(nonBt.deviceId);
                }
            }
        } catch (e) {
            console.warn('[VoiceChatPanel] Error enumerating devices', e);
        }
    }, [audioInputDeviceId, isBluetoothLabel, isConnected]);

    useEffect(() => {
        if (isConnected) {
            loadDevices();
            navigator.mediaDevices.addEventListener('devicechange', loadDevices);
            return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
        }
    }, [isConnected, loadDevices]);

    const handleInputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const deviceId = e.target.value;
        const selected = inputDevices.find(d => d.deviceId === deviceId);
        if (selected?.label && isBluetoothLabel(selected.label)) {
            setShowBluetoothWarning(true);
        }
        setAudioInputDeviceId(deviceId);
        localStorage.setItem('voice_input_device', deviceId);
        if (managerRef.current && isConnected) {
            await managerRef.current.setMicDevice(deviceId);
        }
    }, [inputDevices, isBluetoothLabel, isConnected]);

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
        if (process.env.NODE_ENV !== 'development') return;
        console.log('[VoiceChatPanel] Mount Props Sync Check:', {
            sessionId: JSON.stringify(sessionId),
            userId: JSON.stringify(userId),
            characterId: JSON.stringify(characterId)
        });
    }, [sessionId, userId, characterId]);

    // Bug 3: limpar cache de characterId ao trocar de sessão para evitar vazamento entre mesas
    useEffect(() => {
        lastKnownCharacterIdRef.current.clear();
    }, [sessionId]);

    // Story 46 Prioridade 3: lê estado projetado do singleton (antes mantinha cópia local
    // de events[] + computeState próprio — um de 5 culpados do travamento mobile).
    const projectedCharacters = useProjectedCharacters();

    const getDisplayName = useCallback((uid: string, charId?: string) => {
        const uidLower = uid.trim().toLowerCase();
        const storedRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'PLAYER';

        if (uidLower.includes('mestre') || uidLower === 'gm' || uidLower === 'narrador' || uidLower === 'narradora') {
            return uid;
        }

        const allChars = Object.values(projectedCharacters);

        // 1. Prioridade absoluta por charId
        if (charId) {
            const byId = allChars.find(c => c.id === charId);
            if (byId) return byId.name;
        }

        // 2. Fallback por ownerUserId/nome — prioriza activeInArena para evitar troca de identidade
        const norm = (s: string) => (s || "").trim().toLowerCase().normalize('NFC');
        const uidNorm = norm(uid);
        const candidates = allChars.filter(c =>
            norm(c.ownerUserId) === uidNorm || norm(c.name) === uidNorm
        );
        const matchedChar = candidates.find(c => (c as any).activeInArena) ?? candidates[candidates.length - 1];

        return matchedChar ? matchedChar.name : uid;
    }, [projectedCharacters]);

    const getCharacterImage = useCallback((uid: string, charId?: string) => {
        const uidLower = uid.trim().toLowerCase();

        if (uidLower.includes('mestre') || uidLower === 'gm' || uidLower === 'narrador' || uidLower === 'narradora') {
            return null;
        }

        const allChars = Object.values(projectedCharacters);

        // 1. Prioridade por charId
        if (charId) {
            const byId = allChars.find(c => c.id === charId);
            if (byId?.imageUrl) return byId.imageUrl;
            if (byId) return null; // personagem encontrado mas sem imagem — não tentar fallback por nome
        }

        // 2. Fallback robusto por ownerUserId/nome — prioriza activeInArena para evitar troca de identidade
        const norm = (s: string) => (s || "").trim().toLowerCase().normalize('NFC');
        const uidNorm = norm(uid);
        const candidates = allChars.filter(c =>
            norm(c.ownerUserId) === uidNorm || norm(c.name) === uidNorm
        );
        const matchedChar = candidates.find(c => (c as any).activeInArena) ?? candidates[candidates.length - 1];

        return matchedChar?.imageUrl || null;
    }, [projectedCharacters, userId]);

    // Inicializar manager
    useEffect(() => {
        const initTimer = setTimeout(() => {
            if (!managerRef.current) {
                const manager = new VoiceChatManager(
                    sessionId,
                    userId,
                    (updatedPeers) => {
                        setPeers((prev) => (areVoicePeersEqual(prev, updatedPeers) ? prev : [...updatedPeers]));
                    },
                    (updatedParticipants) => {
                        // Log inline (não colapsável) para diagnóstico de characterId
                        if (process.env.NODE_ENV === 'development') {
                            console.log('[VoiceChat] Presence Update:', JSON.stringify(
                                updatedParticipants.map(u => ({ uid: u.userId, charId: u.characterId ?? 'MISSING' }))
                            ));
                        }

                        // Persistir characterId válido no Map e restaurar quando vier undefined
                        // Evita flicker e cobre race condition do mount inicial sem ?c=
                        const withKnownIds = updatedParticipants.map(p => {
                            if (p.characterId) {
                                lastKnownCharacterIdRef.current.set(p.userId, p.characterId);
                                return p;
                            }
                            const known = lastKnownCharacterIdRef.current.get(p.userId);
                            if (known) {
                                if (process.env.NODE_ENV === 'development') {
                                    console.log(`[VoiceChat] Restoring charId from cache: ${p.userId} → ${known}`);
                                }
                                return { ...p, characterId: known };
                            }
                            return p;
                        });

                        setParticipants((prev) => (areSessionParticipantsEqual(prev, withKnownIds) ? prev : withKnownIds));
                    },
                    characterId
                );

                manager.initialize();
                managerRef.current = manager;
                setIsManagerReady(true);
                setManagerEpoch((prev) => prev + 1);
            }
        }, 300);

        return () => {
            clearTimeout(initTimer);
            if (managerRef.current) {
                const mgr = managerRef.current;
                managerRef.current = null;
                setIsManagerReady(false);
                setManagerEpoch((prev) => prev + 1);
                // Cleanup síncrono para garantir que nenhum canal fique aberto antes do próximo useEffect
                mgr.disconnect();
            }
        };
    }, [sessionId, userId, refreshKey]);
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
            const savedInput = localStorage.getItem('voice_input_device') || undefined;
            const ok = await mgr.joinVoice(savedInput);
            if (ok) {
                setIsConnected(true);
                setMicMuted(false);
                localStorage.setItem(`voice_autojoin_${sessionId}`, "true");

                // Restaura device de saída se salvo
                const savedOutput = localStorage.getItem('voice_output_device');
                if (savedOutput) {
                    mgr.setOutputDevice(savedOutput).catch(console.warn);
                }
            } else if (savedInput) {
                // Mic falhou com device salvo — provavelmente stale; limpa para próxima tentativa usar default
                localStorage.removeItem('voice_input_device');
                setAudioInputDeviceId('');
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
        localStorage.removeItem(`voice_autojoin_${sessionId}`);
    }, [sessionId]);

    const handleRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        try {
            const mgr = managerRef.current;
            if (mgr) {
                // Soft reconnect: preserva a sessão de voz ativa, apenas reanuncia
                // presença e reconecta peers com falha — sem destruir o manager.
                mgr.softReconnect();
                setPeers([]);
                setParticipants([]);
            } else {
                // Manager não existe — recriação completa necessária
                wasConnectedBeforeRefresh.current = isConnected;
                setIsConnected(false);
                setPeers([]);
                setParticipants([]);
                setRefreshKey((prev: number) => prev + 1);
            }
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

    // Quando characterId chega depois do manager ser criado (useHeaderLogic lê ?c= assincronamente)
    useEffect(() => {
        if (characterId && managerRef.current) {
            managerRef.current.updateCharacterId(characterId);
        }
    }, [characterId]);

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
        const normalizedPeerId = normalizeVoiceUserId(peerId);
        const resolvedPeerId = peers.find((p) => normalizeVoiceUserId(p.peerId) === normalizedPeerId)?.peerId ?? normalizedPeerId;
        mgr.setPeerVolume(resolvedPeerId, vol / 100);
        setPeers(prev => prev.map(p =>
            normalizeVoiceUserId(p.peerId) === normalizedPeerId ? { ...p, volume: vol / 100 } : p
        ));
    }, [peers]);

    const handlePeerMute = useCallback((peerId: string) => {
        const mgr = managerRef.current;
        if (!mgr) return;
        const normalizedPeerId = normalizeVoiceUserId(peerId);
        const peer = peers.find((p) => normalizeVoiceUserId(p.peerId) === normalizedPeerId);
        if (peer) {
            mgr.setPeerMuted(peer.peerId, !peer.muted);
        }
    }, [peers]);

    // Juntar participantes e peers: todos aparecem, com status de voice
    const allUsers = useMemo(() => {
        const norm = (s: string) => (s || '').trim().toLowerCase().normalize('NFC');
        const dedupParticipants = Array.from(
            participants.reduce((acc, p) => {
                const key = norm(p.userId);
                const prev = acc.get(key);
                if (!prev) {
                    acc.set(key, p);
                } else {
                    acc.set(key, {
                        userId: prev.userId.length >= p.userId.length ? prev.userId : p.userId,
                        inVoice: prev.inVoice || p.inVoice,
                        characterId: prev.characterId || p.characterId,
                    });
                }
                return acc;
            }, new Map<string, SessionParticipant>()).values()
        );

        const users = dedupParticipants.map(p => {
            const peer = peers.find(vp => norm(vp.peerId) === norm(p.userId));
            const isMe = norm(p.userId) === norm(userId);

            // Resolver characterId: 1) prop local (eu), 2) presença, 3) fallback por ownerUserId/name no state atual
            let resolvedCharId = isMe ? characterId : p.characterId;
            if (!resolvedCharId) {
                const uidNorm = norm(p.userId);
                const allCharsForUser = Object.values(projectedCharacters).filter(c =>
                    norm(c.ownerUserId) === uidNorm || norm(c.name) === uidNorm
                );
                // Bug 3: multi-owner — priorizar activeInArena, depois mais recente por id (fallback)
                const matched = allCharsForUser.find(c => (c as any).activeInArena)
                    ?? allCharsForUser[allCharsForUser.length - 1];
                if (matched) resolvedCharId = matched.id;
            }

            const remoteInVoice = !!peer;

            return {
                id: p.userId,
                voicePeerId: isMe ? userId : (peer?.peerId || p.userId),
                characterId: resolvedCharId,
                isMe,
                inVoice: isMe ? isConnected : remoteInVoice,
                volume: isMe ? micVolume : (peer ? Math.round(peer.volume * 100) : 100),
                muted: isMe ? micMuted : (peer?.muted || false),
                hasPeer: !!peer,
            };
        });

        // Garantir que o usuário local está sempre na lista
        if (!users.find(u => u.isMe)) {
            users.unshift({
                id: userId,
                voicePeerId: userId,
                characterId,
                isMe: true,
                inVoice: isConnected,
                volume: micVolume,
                muted: micMuted,
                hasPeer: false,
            });
        }

        // Mostrar apenas usuários realmente ligados ao voice (ou eu local),
        // evitando "fantasmas" offline no painel.
        const visibleUsers = users.filter(u => u.isMe || u.inVoice || u.hasPeer);

        // Mover "eu" para o topo
        return visibleUsers.sort((a, b) => {
            if (a.isMe) return -1;
            if (b.isMe) return 1;
            return 0;
        });
    }, [participants, peers, userId, characterId, isConnected, micVolume, micMuted, projectedCharacters]);

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

                        {/* Seletores de dispositivo */}
                        {isConnected && devicesLoaded && (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)' }}>
                                        MIC (ENTRADA)
                                    </label>
                                    <select
                                        value={audioInputDeviceId}
                                        onChange={handleInputDeviceChange}
                                        style={{
                                            background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
                                            color: '#fff', padding: '4px 6px', fontSize: '0.7rem',
                                            borderRadius: '4px', outline: 'none', cursor: 'pointer', width: '100%',
                                        }}
                                    >
                                        <option value="" style={{ background: '#1a1a1a' }}>Padrão do Sistema</option>
                                        {inputDevices.map(d => (
                                            <option key={d.deviceId} value={d.deviceId} style={{ background: '#1a1a1a' }}>
                                                {d.label || 'Microfone'}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {supportsSinkId ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)' }}>
                                            FONE (SAÍDA)
                                        </label>
                                        <select
                                            value={audioOutputDeviceId}
                                            onChange={handleOutputDeviceChange}
                                            style={{
                                                background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
                                                color: '#fff', padding: '4px 6px', fontSize: '0.7rem',
                                                borderRadius: '4px', outline: 'none', cursor: 'pointer', width: '100%',
                                            }}
                                        >
                                            <option value="" style={{ background: '#1a1a1a' }}>Padrão do Sistema</option>
                                            {outputDevices.map(d => (
                                                <option key={d.deviceId} value={d.deviceId} style={{ background: '#1a1a1a' }}>
                                                    {d.label || 'Alto-falante'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                                        SAÍDA: não suportado neste browser
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Aviso Bluetooth — mostrar sempre que voice estiver conectado */}
                        {isConnected && showBluetoothWarning && (
                            <div style={{
                                fontSize: '0.58rem',
                                color: 'rgba(255, 200, 80, 0.85)',
                                background: 'rgba(255, 180, 0, 0.08)',
                                border: '1px solid rgba(255, 200, 80, 0.2)',
                                borderRadius: '4px',
                                padding: '5px 7px',
                                lineHeight: '1.4',
                                marginTop: '6px',
                                position: 'relative' as const,
                            }}>
                                ⚠ Usando fone Bluetooth? Selecione o <strong>microfone do computador</strong> como
                                entrada para manter a qualidade de áudio. Fones Bluetooth no mic degradam toda a
                                saída de áudio (incluindo música).
                                <button
                                    onClick={() => setShowBluetoothWarning(false)}
                                    title="Fechar aviso"
                                    style={{
                                        position: 'absolute' as const,
                                        top: '3px',
                                        right: '4px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'rgba(255, 200, 80, 0.6)',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem',
                                        lineHeight: 1,
                                        padding: '0 2px',
                                    }}
                                >✕</button>
                            </div>
                        )}
                    </div>

                    {/* Lista de TODOS os participantes */}
                    <div style={{
                        overflowY: 'auto',
                        flex: 1,
                        position: 'relative' as const, // Para o overlay de refresh
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
                            <VoiceActivityConsumer
                                key={user.id}
                                managerRef={managerRef}
                                managerEpoch={managerEpoch}
                                peerId={user.voicePeerId}
                                isMe={user.isMe}
                            >
                                {(activity) => (
                            <div
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
                                        const displayName = getDisplayName(user.id, user.characterId);
                                        return (
                                            <div style={{ position: 'relative', flexShrink: 0 }}>
                                                <div style={{
                                                    width: '45px',
                                                    height: '45px',
                                                    borderRadius: '50%',
                                                    background: charImg
                                                        ? 'transparent'
                                                        : (user.inVoice
                                                            ? (activity.speaking ? 'rgba(80, 200, 120, 0.35)' : 'rgba(80, 200, 120, 0.08)')
                                                            : 'rgba(255,255,255,0.04)'),
                                                    border: `2px solid ${user.inVoice
                                                        ? (activity.speaking ? '#50c878' : 'rgba(80, 200, 120, 0.3)')
                                                        : 'rgba(255,255,255,0.08)'}`,
                                                    boxShadow: activity.speaking
                                                        ? '0 0 10px rgba(80, 200, 120, 0.6), 0 0 20px rgba(80, 200, 120, 0.3)'
                                                        : 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    fontSize: '1.2rem',
                                                    overflow: 'hidden',
                                                    transition: 'all 0.2s ease',
                                                }}>
                                                    {charImg
                                                        ? <img src={charImg} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        : (!user.inVoice ? '👤' : (user.muted ? '🔇' : (activity.speaking ? '🔊' : '🎤')))
                                                    }
                                                </div>
                                                {/* Badge de mudo sobre avatar quando há imagem */}
                                                {charImg && user.inVoice && user.muted && (
                                                    <div style={{
                                                        position: 'absolute', bottom: '-2px', right: '-2px',
                                                        width: '16px', height: '16px',
                                                        background: '#ff4d4d', borderRadius: '50%',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.55rem', border: '1px solid #111', zIndex: 2,
                                                    }}>🔇</div>
                                                )}
                                                {!charImg && user.inVoice && (
                                                    <span style={{
                                                        position: 'absolute',
                                                        bottom: '-2px',
                                                        right: '-6px',
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        background: user.inVoice
                                                            ? (activity.speaking ? 'rgba(80, 200, 120, 0.9)' : 'rgba(30, 30, 30, 0.95)')
                                                            : 'rgba(30, 30, 30, 0.95)',
                                                        border: `1px solid ${user.inVoice ? (activity.speaking ? '#50c878' : 'rgba(80,200,120,0.3)') : 'rgba(255,255,255,0.1)'}`,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.85rem',
                                                        fontFamily: 'var(--font-header)',
                                                        fontWeight: 'bold',
                                                        color: activity.speaking ? '#fff' : 'rgba(255,255,255,0.6)',
                                                    }}>
                                                        {displayName.charAt(0).toUpperCase()}
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
                                            onClick={() => handlePeerMute(user.voicePeerId)}
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
                                                width: `${Math.round(activity.audioLevel * 100)}%`,
                                                background: activity.audioLevel > 0.6 ? '#50c878' : (activity.audioLevel > 0.3 ? 'var(--accent-color)' : 'rgba(var(--accent-rgb), 0.4)'),
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
                                            onChange={e => handlePeerVolume(user.voicePeerId, parseInt(e.target.value))}
                                            style={sliderTrackStyle}
                                            title={`Volume: ${user.volume}%`}
                                        />
                                        <span style={volNumStyle}>{user.volume}%</span>
                                    </div>
                                )}
                            </div>
                                )}
                            </VoiceActivityConsumer>
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
                        const displayName = getDisplayName(user.id, user.characterId);
                        return (
                            <VoiceActivityConsumer
                                key={`indicator-${user.id}`}
                                managerRef={managerRef}
                                managerEpoch={managerEpoch}
                                peerId={user.voicePeerId}
                                isMe={user.isMe}
                            >
                                {(activity) => (
                                    <div
                                        title={displayName}
                                        style={{
                                            position: 'relative',
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '50%',
                                            background: charImg
                                                ? 'transparent'
                                                : (activity.speaking
                                                    ? 'rgba(80, 200, 120, 0.25)'
                                                    : 'rgba(30, 30, 30, 0.6)'),
                                            border: `2px solid ${activity.speaking ? '#50c878' : 'rgba(255,255,255,0.12)'}`,
                                            boxShadow: activity.speaking
                                                ? '0 0 12px rgba(80, 200, 120, 0.7), 0 0 24px rgba(80, 200, 120, 0.3)'
                                                : '0 2px 8px rgba(0,0,0,0.4)',
                                            backdropFilter: 'blur(8px)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            transition: 'all 0.2s ease',
                                            pointerEvents: 'auto',
                                            cursor: 'default',
                                        }}
                                    >
                                        {charImg
                                            ? <img src={charImg} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            : <span style={{
                                                fontSize: '1.15rem',
                                                fontFamily: 'var(--font-header)',
                                                fontWeight: 'bold',
                                                color: activity.speaking ? '#50c878' : 'rgba(255,255,255,0.5)',
                                            }}>{displayName.charAt(0).toUpperCase()}</span>
                                        }

                                        {charImg && (
                                            <span style={{
                                                position: 'absolute',
                                                bottom: '1px',
                                                right: '1px',
                                                width: '18px',
                                                height: '18px',
                                                borderRadius: '50%',
                                                background: activity.speaking ? 'rgba(80, 200, 120, 0.9)' : 'rgba(30, 30, 30, 0.95)',
                                                border: `1px solid ${activity.speaking ? '#50c878' : 'rgba(255,255,255,0.15)'}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.62rem',
                                                fontWeight: 'bold',
                                                color: activity.speaking ? '#fff' : 'rgba(255,255,255,0.6)',
                                                zIndex: 2,
                                            }}>
                                                {displayName.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </VoiceActivityConsumer>
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

function areVoiceChatPanelPropsEqual(prev: VoiceChatPanelProps, next: VoiceChatPanelProps): boolean {
    return (
        prev.sessionId === next.sessionId &&
        prev.userId === next.userId &&
        prev.characterId === next.characterId &&
        prev.isMobile === next.isMobile
    );
}

export const VoiceChatPanel = React.memo(VoiceChatPanelComponent, areVoiceChatPanelPropsEqual);
VoiceChatPanel.displayName = "VoiceChatPanel";


