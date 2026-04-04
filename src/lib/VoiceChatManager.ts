import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";

// Tipos de sinal específicos para voice chat
type VoiceSignalType = 'voice-join' | 'voice-leave' | 'voice-offer' | 'voice-answer' | 'voice-ice-candidate';

interface VoiceSignal {
    type: VoiceSignalType;
    from: string;
    to?: string;
    peerId?: string;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

export interface VoicePeer {
    peerId: string;
    stream: MediaStream | null;
    volume: number;    // 0-2 (supports boost up to 200%)
    muted: boolean;
    speaking: boolean;
    audioLevel: number; // 0-1
    inVoice: boolean;  // true se está no voice chat ativo
}

// Participante da sessão (presença)
export interface SessionParticipant {
    userId: string;
    inVoice: boolean;
    characterId?: string;
}

type PeerUpdateCallback = (peers: VoicePeer[]) => void;
type PresenceUpdateCallback = (participants: SessionParticipant[]) => void;

/**
 * VoiceChatManager – Comunicação de voz via WebRTC (mesh topology)
 *
 * Reutiliza a tabela 'webrtc_signals' já existente para sinalização,
 * usando tipos de sinal prefixados com 'voice-' para diferenciar do screen share.
 */
export class VoiceChatManager {
    private sessionId: string;
    private userId: string;
    private channel: any = null;
    private presenceChannel: any = null;
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private peerStreams: Map<string, MediaStream> = new Map();
    private peerVolumes: Map<string, number> = new Map();
    private peerMuted: Map<string, boolean> = new Map();
    private peerAudioElements: Map<string, HTMLAudioElement> = new Map();
    private processedSignalIds: Set<string> = new Set();
    private onPeerUpdate: PeerUpdateCallback;
    private onPresenceUpdate: PresenceUpdateCallback;
    private _micMuted: boolean = false;
    private _isConnected: boolean = false;

    private localAudioContext: AudioContext | null = null;
    private peerAudioContexts: Map<string, AudioContext> = new Map();
    private audioNodes: Map<string, { source: MediaStreamAudioSourceNode; gain: GainNode; analyser: AnalyserNode; destination: MediaStreamAudioDestinationNode }> = new Map();
    private dummyAudioElements: Map<string, HTMLAudioElement> = new Map();
    private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();

    private speakingAnalysers: Map<string, { analyser: AnalyserNode; interval: ReturnType<typeof setInterval> }> = new Map();
    private localSpeakingInterval: ReturnType<typeof setInterval> | null = null;
    private _localSpeaking: boolean = false;
    private _localAudioLevel: number = 0; // 0-1 nível de áudio do mic local
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private _micVolume: number = 1; // 0-1 volume do microfone local
    private localGainNode: GainNode | null = null;
    private _sessionParticipants: SessionParticipant[] = [];
    private voicePeerIds: Set<string> = new Set();

    // Tentativas de reconexão por peer (max 3)
    private reconnectAttempts: Map<string, number> = new Map();
    private static readonly MAX_RECONNECT_ATTEMPTS = 3;

    // H6: Flag de presença subscrita — track() só funciona após SUBSCRIBED
    private _presenceSubscribed: boolean = false;
    // H5: Peers com fallback de voice-join agendado (evita múltiplos timeouts para o mesmo peer)
    private pendingFallbackJoins: Set<string> = new Set();

    private rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            // TURN servers gratuitos (OpenRelay) para bypass de NAT restritivo
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject',
            },
        ],
        iceTransportPolicy: 'all', // Tenta STUN primeiro, fallback para TURN
    };

    private characterId?: string;

    constructor(
        sessionId: string,
        userId: string,
        onPeerUpdate: PeerUpdateCallback,
        onPresenceUpdate: PresenceUpdateCallback,
        characterId?: string
    ) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.characterId = characterId;
        this.onPeerUpdate = onPeerUpdate;
        this.onPresenceUpdate = onPresenceUpdate;
    }

    get isConnected() { return this._isConnected; }
    get micMuted() { return this._micMuted; }
    get localSpeaking() { return this._localSpeaking; }
    get localAudioLevel() { return this._localAudioLevel; }
    get micVolume() { return this._micVolume; }
    get sessionParticipants() { return this._sessionParticipants; }
    get audioContextState() { return this.localAudioContext?.state || 'closed'; }

    // ─── Helpers de Áudio ──────────────────────────────────────

    private getLocalAudioContext(): AudioContext {
        if (typeof window === 'undefined') {
            return {} as AudioContext; // Stub para SSR
        }
        if (!this.localAudioContext) {
            // 48kHz = taxa nativa do Opus; latencyHint 'interactive' minimiza buffer de processamento
            this.localAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: 48000,
            });
        }
        return this.localAudioContext!;
    }

    private getPeerAudioContext(peerId: string): AudioContext {
        let ctx = this.peerAudioContexts.get(peerId);
        if (!ctx) {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: 48000,
            });
            this.peerAudioContexts.set(peerId, ctx);
        }
        return ctx;
    }

    // ─── Inicialização ──────────────────────────────────────────

    public async initialize() {
        if (this.channel) return;

        this.channel = supabase
            .channel(`voice-db-${this.sessionId}`)
            .on(
                'postgres_changes' as any,
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'webrtc_signals',
                    filter: `session_id=eq.${this.sessionId}`
                },
                (payload: any) => {
                    const row = payload.new;
                    if (row.from_user === this.userId) return;
                    if (row.to_user && row.to_user !== this.userId) return;
                    if (this.processedSignalIds.has(row.id)) return;
                    this.processedSignalIds.add(row.id);

                    // Filtrar apenas sinais de voice
                    const signalType = row.signal_type as string;
                    if (!signalType.startsWith('voice-')) return;
                    // NUNCA processar sinais de si mesmo (dupla segurança)
                    if (row.from_user === this.userId) return;

                    const signal: VoiceSignal = {
                        type: signalType as VoiceSignalType,
                        from: row.from_user,
                        to: row.to_user,
                        ...row.payload
                    };
                    console.log(`[VoiceChat - ${this.userId}] Signal received:`, signal.type, 'from:', signal.from);
                    this.handleSignal(signal);
                }
            )
            .subscribe((status: string) => {
                console.log(`[VoiceChat - ${this.userId}] Channel status:`, status);
            });

        // Canal de presença para rastrear todos os participantes da sessão
        this.presenceChannel = supabase
            .channel(`voice-presence-${this.sessionId}`)
            .on('presence', { event: 'sync' }, () => {
                this.syncPresence();
            })
            .on('presence', { event: 'join' }, () => {
                this.syncPresence();
            })
            .on('presence', { event: 'leave' }, () => {
                this.syncPresence();
            })
            .subscribe(async (subStatus: string) => {
                if (subStatus === 'SUBSCRIBED') {
                    this._presenceSubscribed = true;
                    const trackResult = await this.presenceChannel?.track({
                        userId: this.userId,
                        characterId: this.characterId,
                        inVoice: this._isConnected,
                        online_at: new Date().toISOString(),
                    });
                    console.log(`[VoiceChat - ${this.userId}] Initial Presence Track Result:`, trackResult);
                    // H6: Se joinVoice() foi chamado antes do canal ficar pronto, atualizar agora
                    if (this._isConnected) {
                        await this.updatePresenceVoiceState(true);
                    }
                }
            });
    }

    private syncPresence() {
        if (!this.presenceChannel) return;
        const state = this.presenceChannel.presenceState();
        
        // Diagnóstico Etapa 1: Log de presença bruto
        console.log(`[VoiceChat - ${this.userId}] Presence Sync - Bruto:`, state);

        const participants: SessionParticipant[] = [];

        // Agregar status inVoice verdadeiro caso haja múltiplos registros (ex: após refresh)
        const userVoices = new Map<string, boolean>();
        const userCharacters = new Map<string, string>(); // userId -> characterId
        const userIds = new Set<string>();

        Object.values(state).forEach((presences: any) => {
            if (Array.isArray(presences)) {
                presences.forEach((p: any) => {
                    if (p.userId) {
                        userIds.add(p.userId);
                        if (p.inVoice === true) {
                            userVoices.set(p.userId, true);
                        }
                        if (p.characterId && !userCharacters.has(p.userId)) {
                            userCharacters.set(p.userId, p.characterId);
                        }
                    }
                });
            }
        });

        // Limpar voicePeerIds de usuários que não estão mais na presença (zombies)
        const currentPresenceUsers = new Set(userIds);
        this.voicePeerIds.forEach(id => {
            if (id !== this.userId && !currentPresenceUsers.has(id)) {
                this.voicePeerIds.delete(id);
                this.removePeer(id);
            }
        });

        userIds.forEach(userId => {
            participants.push({
                userId: userId,
                inVoice: userVoices.get(userId) === true || this.voicePeerIds.has(userId),
                characterId: userCharacters.get(userId),
            });
        });

        // Mudança 1: Garantir que voicePeerIds popula a UI mesmo com Presence vazio
        this.voicePeerIds.forEach(id => {
            if (!participants.find(p => p.userId === id)) {
                participants.push({
                    userId: id,
                    inVoice: true,
                    characterId: undefined, // Infelizmente sem presença não temos o characterId
                });
            }
        });

        this._sessionParticipants = participants;
        this.onPresenceUpdate(participants);
    }

    private async updatePresenceVoiceState(inVoice: boolean, attempt: number = 0) {
        if (!this.presenceChannel) return;
        // H6: Canal ainda não pronto — retry exponencial (max 3 tentativas, delay 2s)
        if (!this._presenceSubscribed) {
            if (attempt < 3) {
                console.warn(`[VoiceChat - ${this.userId}] Presence not SUBSCRIBED yet — retry ${attempt + 1}/3 in 2s`);
                setTimeout(() => this.updatePresenceVoiceState(inVoice, attempt + 1), 2000);
            } else {
                console.error(`[VoiceChat - ${this.userId}] Presence track failed: canal não ficou SUBSCRIBED após 3 tentativas`);
            }
            return;
        }
        const trackResult = await this.presenceChannel.track({
            userId: this.userId,
            characterId: this.characterId,
            inVoice,
            online_at: new Date().toISOString(),
        });
        console.log(`[VoiceChat - ${this.userId}] Presence Track Update:`, { inVoice, trackResult });
    }

    // ─── Envio de sinais ────────────────────────────────────────

    private async sendSignal(signal: VoiceSignal) {
        try {
            const { error } = await supabase
                .from('webrtc_signals')
                .insert({
                    id: uuidv4(),
                    session_id: this.sessionId,
                    from_user: this.userId,
                    to_user: signal.to || null,
                    signal_type: signal.type,
                    payload: {
                        peerId: signal.peerId,
                        offer: signal.offer,
                        answer: signal.answer,
                        candidate: signal.candidate,
                    },
                    created_at: new Date().toISOString()
                });

            if (error) {
                console.error(`[VoiceChat] DB insert error for ${signal.type}:`, error.message);
            }
        } catch (e) {
            console.error(`[VoiceChat] Failed to send ${signal.type}:`, e);
        }
    }

    // ─── Entrar no voice ───────────────────────────────────────

    public async joinVoice(): Promise<boolean> {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    // 48kHz é a taxa nativa do Opus — elimina conversão de sample rate interna
                    sampleRate: 48000,
                    // Mono: voz não precisa de stereo, reduz carga em 50% por stream
                    channelCount: 1,
                }
            });

            const audioCtx = this.getLocalAudioContext();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume().catch(console.warn);
            }

            this._isConnected = true;
            this._micMuted = false;
            this.voicePeerIds.add(this.userId);

            // Atualizar presença para indicar que está no voice
            await this.updatePresenceVoiceState(true);

            // Monitorar nível de fala local
            this.startLocalSpeakingDetection();

            // Anunciar presença para outros peers
            await this.sendSignal({ type: 'voice-join', from: this.userId, peerId: this.userId });

            // Heartbeat a cada 15s para garantir que novos participantes nos vejam rapidamente (padrão original)
            this.heartbeatInterval = setInterval(() => {
                if (this._isConnected) {
                    this.sendSignal({ type: 'voice-join', from: this.userId, peerId: this.userId });
                }
            }, 15000);

            this.notifyPeerUpdate();
            return true;
        } catch (error) {
            console.error("[VoiceChat] Failed to get mic:", error);
            return false;
        }
    }

    // ─── Sair do voice ─────────────────────────────────────────

    public leaveVoice() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.localSpeakingInterval) {
            clearInterval(this.localSpeakingInterval);
            this.localSpeakingInterval = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }

        if (this.localAudioContext) {
            this.localAudioContext.close().catch(() => {});
            this.localAudioContext = null;
        }

        this.sendSignal({ type: 'voice-leave', from: this.userId, peerId: this.userId });

        this._isConnected = false;
        this._micMuted = false;
        this._localSpeaking = false;
        this._localAudioLevel = 0;
        this.voicePeerIds.delete(this.userId);

        // Atualizar presença
        this.updatePresenceVoiceState(false);

        this.cleanupAllPeers();
        this.notifyPeerUpdate();
    }

    // ─── Controles locais ──────────────────────────────────────

    public setMicMuted(muted: boolean) {
        this._micMuted = muted;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(t => {
                t.enabled = !muted;
            });
        }
        this.notifyPeerUpdate();
    }

    public setMicVolume(volume: number) {
        this._micVolume = Math.max(0, Math.min(2, volume));
        if (this.localGainNode) {
            const ctx = this.getLocalAudioContext();
            this.localGainNode.gain.setTargetAtTime(this._micVolume, ctx.currentTime, 0.01);
        }
        this.notifyPeerUpdate();
    }

    public setPeerVolume(peerId: string, volume: number) {
        const clampedVol = Math.max(0, Math.min(2, volume));
        this.peerVolumes.set(peerId, clampedVol);

        const gainNode = this.audioNodes.get(peerId)?.gain;
        if (gainNode) {
            const ctx = this.getPeerAudioContext(peerId);
            gainNode.gain.setTargetAtTime(clampedVol, ctx.currentTime, 0.1);
        }

        const audioEl = this.peerAudioElements.get(peerId);
        if (audioEl) {
            // Se temos GainNode, o volume real é controlado por ele.
            // O elemento HTML Audio é mantido em 1.0 para não aplicar o volume duas vezes.
            audioEl.volume = 1;
        }
        this.notifyPeerUpdate();
    }

    public setPeerMuted(peerId: string, muted: boolean) {
        this.peerMuted.set(peerId, muted);
        const audioEl = this.peerAudioElements.get(peerId);
        if (audioEl) {
            audioEl.muted = muted;
        }
        this.notifyPeerUpdate();
    }

    // ─── Estado dos peers ──────────────────────────────────────

    public getActivePeers(): VoicePeer[] {
        const peers: VoicePeer[] = [];
        this.peerConnections.forEach((_, peerId) => {
            peers.push({
                peerId,
                stream: this.peerStreams.get(peerId) || null,
                volume: this.peerVolumes.get(peerId) ?? 1,
                muted: this.peerMuted.get(peerId) ?? false,
                speaking: false, // será atualizado pelo analyser
                audioLevel: 0,   // será atualizado pelo analyser
                inVoice: true,
            });
        });
        return peers;
    }

    private notifyPeerUpdate() {
        this.onPeerUpdate(this.getActivePeers());
    }

    // ─── Cleanup ───────────────────────────────────────────────

    public disconnect() {
        this.leaveVoice();
        
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
        if (this.presenceChannel) {
            supabase.removeChannel(this.presenceChannel);
            this.presenceChannel = null;
        }
        this._presenceSubscribed = false;
        this.pendingFallbackJoins.clear();
    }

    private cleanupAllPeers() {
        this.speakingAnalysers.forEach(({ interval }) => clearInterval(interval));
        this.speakingAnalysers.clear();

        this.peerAudioElements.forEach(el => {
            el.pause();
            el.srcObject = null;
        });
        this.peerAudioElements.clear();

        this.dummyAudioElements.forEach(el => {
            el.pause();
            el.srcObject = null;
        });
        this.dummyAudioElements.clear();

        this.audioNodes.forEach(nodes => {
            nodes.source.disconnect();
            nodes.gain.disconnect();
            nodes.analyser.disconnect();
        });
        this.audioNodes.clear();

        // Mudança 4: Close all peer contexts
        this.peerAudioContexts.forEach(ctx => ctx.close().catch(() => {}));
        this.peerAudioContexts.clear();

        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.peerStreams.clear();
        this.peerVolumes.clear();
        this.peerMuted.clear();
        this.pendingCandidates.clear();
        this.voicePeerIds.clear();
    }

    // ─── Bitrate Adaptativo ────────────────────────────────────

    private getAdaptiveBitrate(peerCount: number): number {
        // Opus voz: 32kbps já é indistinguível de original para fala humana
        // Escala inversamente ao número de peers para suportar até 12 (66 conexões mesh)
        if (peerCount <= 2)  return 64000;  // 1-2 peers: 64kbps — máxima qualidade
        if (peerCount <= 6)  return 48000;  // 3-6 peers: 48kbps — alta qualidade
        if (peerCount <= 10) return 40000;  // 7-10 peers: 40kbps — boa qualidade
        return 32000;                        // 11-12 peers: 32kbps — qualidade sólida para voz
    }

    // Aplica bitrate apenas uma vez quando a conexão atinge 'connected' — evita choppy audio
    private async applyBitrateToSender(pc: RTCPeerConnection, peerId: string) {
        const peerCount = this.peerConnections.size;
        const targetBitrate = this.getAdaptiveBitrate(peerCount);
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (!sender) return;
        try {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = targetBitrate;
            await sender.setParameters(params);
            console.log(`[VoiceChat - ${this.userId}] Bitrate ${targetBitrate / 1000}kbps aplicado para ${peerId} (${peerCount} peers ativos)`);
        } catch (e) {
            console.warn(`[VoiceChat - ${this.userId}] Não foi possível definir bitrate para ${peerId}:`, e);
        }
    }

    private async updateAllPeersBitrate() {
        // Manter como no-op: setParameters repetidos causam 'choppy audio'
        // O bitrate é aplicado uma única vez via applyBitrateToSender em onconnectionstatechange
        return;
    }

    private removePeer(peerId: string) {
        const analyser = this.speakingAnalysers.get(peerId);
        if (analyser) {
            clearInterval(analyser.interval);
            this.speakingAnalysers.delete(peerId);
        }

        const audioEl = this.peerAudioElements.get(peerId);
        if (audioEl) {
            audioEl.pause();
            audioEl.srcObject = null;
            this.peerAudioElements.delete(peerId);
        }

        const dummyEl = this.dummyAudioElements.get(peerId);
        if (dummyEl) {
            dummyEl.pause();
            dummyEl.srcObject = null;
            this.dummyAudioElements.delete(peerId);
        }

        const nodes = this.audioNodes.get(peerId);
        if (nodes) {
            nodes.source.disconnect();
            nodes.gain.disconnect();
            nodes.analyser.disconnect();
            this.audioNodes.delete(peerId);
        }

        const pc = this.peerConnections.get(peerId);
        if (pc) {
            pc.close();
            this.peerConnections.delete(peerId);
        }

        // Mudança 4: Close and remove peer context
        const ctx = this.peerAudioContexts.get(peerId);
        if (ctx) {
            ctx.close().catch(() => {});
            this.peerAudioContexts.delete(peerId);
        }

        this.peerStreams.delete(peerId);
        this.peerVolumes.delete(peerId);
        this.peerMuted.delete(peerId);
        this.pendingCandidates.delete(peerId);
        this.notifyPeerUpdate();

        // Recalcular bitrate — menos peers = mais qualidade
        this.updateAllPeersBitrate();
    }

    // ─── Detecção de fala ──────────────────────────────────────

    private startLocalSpeakingDetection() {
        if (!this.localStream) return;
        try {
            const audioCtx = this.getLocalAudioContext();
            const source = audioCtx.createMediaStreamSource(this.localStream);

            // Gain node para controlar volume do microfone
            const gainNode = audioCtx.createGain();
            gainNode.gain.setTargetAtTime(this._micVolume, audioCtx.currentTime, 0.01);
            this.localGainNode = gainNode;
            source.connect(gainNode);

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            gainNode.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            this.localSpeakingInterval = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                this._localAudioLevel = Math.min(1, avg / 80);
                const wasSpeaking = this._localSpeaking;
                this._localSpeaking = avg > 11;
                if (wasSpeaking !== this._localSpeaking) {
                    this.notifyPeerUpdate();
                }
            }, 250);
        } catch (e) {
            console.warn('[VoiceChat] Could not start speaking detection:', e);
        }
    }

    private startPeerSpeakingDetection(peerId: string, stream: MediaStream) {
        try {
            // Cleanup prévio se já existirem nós (ex: re-negociação)
            const existingNodes = this.audioNodes.get(peerId);
            if (existingNodes) {
                existingNodes.source.disconnect();
                existingNodes.gain.disconnect();
                existingNodes.analyser.disconnect();
                this.audioNodes.delete(peerId);
            }
            const existingAnalyser = this.speakingAnalysers.get(peerId);
            if (existingAnalyser) {
                clearInterval(existingAnalyser.interval);
                this.speakingAnalysers.delete(peerId);
            }
            const existingDummy = this.dummyAudioElements.get(peerId);
            if (existingDummy) {
                existingDummy.pause();
                existingDummy.srcObject = null;
                this.dummyAudioElements.delete(peerId);
            }

            const audioCtx = this.getPeerAudioContext(peerId);
            
            // Resume Audio Context caso o navegador o tenha criado suspendido
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(e => console.warn('[VoiceChat] Auto-resume AudioContext failed:', e));
            }

            const source = audioCtx.createMediaStreamSource(stream);

            // Gain node para permitir boost de volume (> 100%)
            const gainNode = audioCtx.createGain();
            const currentVolume = this.peerVolumes.get(peerId) ?? 1;
            gainNode.gain.setValueAtTime(currentVolume, audioCtx.currentTime);

            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;

            source.connect(gainNode);
            gainNode.connect(analyser);

            // Criar um destino de stream para o áudio processado
            const dst = audioCtx.createMediaStreamDestination();
            analyser.connect(dst);

            // Armazenar nós para cleanup
            this.audioNodes.set(peerId, { source, gain: gainNode, analyser, destination: dst });

            // Redirecionar o elemento de áudio para o stream processado
            const audioEl = this.peerAudioElements.get(peerId);
            if (audioEl) {
                // Bug fix para Chrome: O stream original do WebRTC não decodifica áudio a menos que esteja atrelado
                // a um elemento HTMLAudio ativo. Criamos um elemento dummy e deixamos mudo.
                const dummyAudio = new Audio();
                dummyAudio.srcObject = stream;
                dummyAudio.muted = true;
                dummyAudio.autoplay = true;
                dummyAudio.play().catch(() => {});
                this.dummyAudioElements.set(peerId, dummyAudio);

                audioEl.srcObject = dst.stream;
                audioEl.play().catch(e => console.warn('[VoiceChat] Audio destination play failed:', e));
            }

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const interval = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                const peerData = this.speakingAnalysers.get(peerId);
                if (peerData) {
                    (peerData as any).speaking = avg > 11;
                    (peerData as any).audioLevel = Math.min(1, avg / 80);
                }
            }, 250);

            this.speakingAnalysers.set(peerId, { analyser, interval, speaking: false, audioLevel: 0 } as any);
        } catch (e) {
            console.warn('[VoiceChat] Could not start peer speaking detection:', e);
        }
    }

    // ─── Processamento de sinais ───────────────────────────────

    private async handleSignal(signal: VoiceSignal) {
        const { type, from } = signal;

        if (type === 'voice-leave') {
            if (from === this.userId) return; // Nunca processar leave de si mesmo
            this.voicePeerIds.delete(from);
            this.removePeer(from);
            this.syncPresence();
            return;
        }

        if (type === 'voice-join') {
            if (from === this.userId) return; // Nunca conectar consigo mesmo

            // Mudança 2: Restaurar guarda de conexão existente. 
            // Só remover se a conexão estiver falha ou fechada.
            const existingPc = this.peerConnections.get(from);
            if (existingPc 
                && existingPc.connectionState !== 'failed' 
                && existingPc.connectionState !== 'closed') {
                console.log(`[VoiceChat - ${this.userId}] Signal 'voice-join' from ${from} ignored (already connected/connecting)`);
                return;
            }

            this.removePeer(from);
            this.voicePeerIds.add(from);
            this.syncPresence();

            if (!this._isConnected || !this.localStream) return;

            // H1/H2: Normalizar userId antes da comparação — evita race por caixa/espaço/UUID vs nome
            const myIdNorm = this.userId.trim().toLowerCase();
            const fromIdNorm = from.trim().toLowerCase();
            console.log(`[VoiceChat - ${this.userId}] Deterministic offerer check: me="${myIdNorm}" from="${fromIdNorm}" → offerer=${myIdNorm < fromIdNorm}`);

            if (myIdNorm < fromIdNorm) {
                // Eu sou o offerer — envio a offer imediatamente
                console.log(`[VoiceChat - ${this.userId}] I am offerer → creating offer for:`, from);
                await this.createPeerConnection(from, true);
            } else if (myIdNorm > fromIdNorm) {
                // H5: Não sou o offerer — espera passiva. O offerer enviará a offer.
                // Fallback único após 5s caso a offer não chegue (ex: race condition de timing).
                console.log(`[VoiceChat - ${this.userId}] Non-offerer — awaiting offer from ${from} (fallback in 5s if needed)`);
                if (!this.pendingFallbackJoins.has(from)) {
                    this.pendingFallbackJoins.add(from);
                    setTimeout(async () => {
                        this.pendingFallbackJoins.delete(from);
                        if (!this._isConnected || !this.localStream) return;
                        const pc = this.peerConnections.get(from);
                        const state = pc?.connectionState;
                        if (!pc || state === 'failed' || state === 'closed' || state === 'new') {
                            console.log(`[VoiceChat - ${this.userId}] Fallback: offer de ${from} não chegou em 5s — enviando voice-join direcionado`);
                            await this.sendSignal({ type: 'voice-join', from: this.userId, to: from, peerId: this.userId });
                        } else {
                            console.log(`[VoiceChat - ${this.userId}] Fallback desnecessário para ${from} — connectionState: ${state}`);
                        }
                    }, 5000);
                }
            } else {
                // userId idêntico após normalização — não é possível determinar offerer
                console.warn(`[VoiceChat - ${this.userId}] userId colide com ${from} após normalização — handshake abortado`);
            }
            return;
        }

        if (type === 'voice-offer' && signal.offer) {
            // Bug #3: Log para diagnóstico de ofertas descartadas
            if (!this._isConnected || !this.localStream) {
                console.warn(`[VoiceChat - ${this.userId}] Offer from ${from} dropped — not connected/no stream (Local: ${this._isConnected}, Stream: ${!!this.localStream})`);
                return;
            }
            await this.handleOffer(signal);
            return;
        }

        if (type === 'voice-answer' && signal.answer) {
            await this.handleAnswer(signal);
            return;
        }

        if (type === 'voice-ice-candidate' && signal.candidate) {
            const pc = this.peerConnections.get(from);
            if (pc) {
                if (pc.remoteDescription) {
                    pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(console.error);
                } else {
                    if (!this.pendingCandidates.has(from)) {
                        this.pendingCandidates.set(from, []);
                    }
                    this.pendingCandidates.get(from)!.push(signal.candidate);
                }
            } else {
                console.warn(`[VoiceChat - ${this.userId}] [ice] Candidato de ${from} descartado — sem PeerConnection (queuing not possible)`);
            }
        }
    }

    // ─── Peer Connection ───────────────────────────────────────

    private async createPeerConnection(peerId: string, createOffer: boolean) {
        // NUNCA criar conexão consigo mesmo
        if (peerId === this.userId) {
            console.warn('[VoiceChat] Blocked self-connection attempt');
            return new RTCPeerConnection(this.rtcConfig); // retorna dummy, não será usado
        }

        if (this.peerConnections.has(peerId)) {
            this.peerConnections.get(peerId)?.close();
        }

        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(peerId, pc);

        // H4: Safety timeout — se em 15s a conexão não sair de 'connecting'/'new', remover e liberar re-negociação
        const connectingTimeout = setTimeout(() => {
            const currentState = this.peerConnections.get(peerId)?.connectionState;
            if (currentState === 'connecting' || currentState === 'new') {
                console.warn(`[VoiceChat - ${this.userId}] Conexão com ${peerId} travada em '${currentState}' por 15s — removendo peer`);
                this.removePeer(peerId);
            }
        }, 15000);

        // Adicionar tracks locais
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                if (this.localStream) pc.addTrack(track, this.localStream);
            });
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'voice-ice-candidate',
                    from: this.userId,
                    to: peerId,
                    candidate: event.candidate.toJSON()
                });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[VoiceChat - ${this.userId}] Received audio track from:`, peerId);
            if (event.track.kind !== 'audio') return;
            
            const stream = event.streams?.[0] || new MediaStream([event.track]);
            this.peerStreams.set(peerId, stream);

            // Criar elemento de áudio principal para reprodução (volume e áudio processado)
            let audioEl = this.peerAudioElements.get(peerId);
            if (!audioEl) {
                audioEl = new Audio();
                audioEl.autoplay = true;
                this.peerAudioElements.set(peerId, audioEl);
            }
            audioEl.muted = this.peerMuted.get(peerId) ?? false;
            audioEl.volume = 1; // GainNode controlará o volume real

            // Iniciar detecção de fala para este peer (encarrega-se de play e srcObject)
            this.startPeerSpeakingDetection(peerId, stream);

            this.notifyPeerUpdate();
        };

        pc.onconnectionstatechange = () => {
            console.log(`[VoiceChat - ${this.userId}] Connection state for ${peerId}:`, pc.connectionState);
            // H4: Limpar timeout de 'connecting' ao sair do estado pendente
            if (pc.connectionState !== 'connecting' && pc.connectionState !== 'new') {
                clearTimeout(connectingTimeout);
            }
            if (pc.connectionState === 'failed') {
                // Reconexão automática com limite de tentativas
                const attempts = this.reconnectAttempts.get(peerId) || 0;
                if (attempts < VoiceChatManager.MAX_RECONNECT_ATTEMPTS && this._isConnected && this.localStream) {
                    this.reconnectAttempts.set(peerId, attempts + 1);
                    console.log(`[VoiceChat - ${this.userId}] Reconnecting to ${peerId} (attempt ${attempts + 1}/${VoiceChatManager.MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(() => {
                        if (this._isConnected && this.localStream) {
                            // H1/H2: Normalizar userId na reconexão — consistente com handleSignal
                            if (this.userId.trim().toLowerCase() < peerId.trim().toLowerCase()) {
                                this.createPeerConnection(peerId, true);
                            } else {
                                this.sendSignal({ type: 'voice-join', from: this.userId, peerId: this.userId });
                            }
                        }
                    }, 3000 * (attempts + 1)); // Backoff progressivo
                } else {
                    console.warn(`[VoiceChat - ${this.userId}] Max reconnect attempts reached for ${peerId}`);
                }
            } else if (pc.connectionState === 'connected') {
                // Reset contador de reconexão quando conecta com sucesso
                console.log(`[VoiceChat - ${this.userId}] Connected to ${peerId}`);
                this.reconnectAttempts.delete(peerId);
                // Aplicar bitrate adaptativo uma única vez ao conectar (sem setParameters repetidos)
                void this.applyBitrateToSender(pc, peerId);
            }
        };

        // Preferência por Opus com FEC e DTX — resiliente a perda de pacotes em links intercontinentais
        if (typeof RTCRtpSender !== 'undefined' && RTCRtpSender.getCapabilities) {
            const capabilities = RTCRtpSender.getCapabilities('audio');
            if (capabilities) {
                const audioTransceiver = pc.getTransceivers().find(t => t.sender.track?.kind === 'audio');
                if (audioTransceiver && typeof audioTransceiver.setCodecPreferences === 'function') {
                    const opusCodecs = capabilities.codecs
                        .filter(c => c.mimeType.toLowerCase() === 'audio/opus')
                        .map(codec => {
                            // Merge de parâmetros via Map para evitar duplicatas (ex: Chrome já inclui minptime e useinbandfec)
                            // useinbandfec=1: recupera pacotes perdidos sem retransmissão (crucial em links intercontinentais)
                            // usedtx=1: silêncio não transmite (~40% menos banda em sessões com 12 pessoas)
                            // minptime=10: pacotes de 10ms — balanço entre latência e overhead
                            const fmtpParams = new Map<string, string>(
                                (codec.sdpFmtpLine ?? '')
                                    .split(';')
                                    .filter(Boolean)
                                    .map(p => {
                                        const [k, v] = p.split('=');
                                        return [k.trim(), v?.trim() ?? '1'] as [string, string];
                                    })
                            );
                            fmtpParams.set('useinbandfec', '1');
                            fmtpParams.set('usedtx', '1');
                            fmtpParams.set('minptime', '10');
                            return {
                                ...codec,
                                sdpFmtpLine: Array.from(fmtpParams.entries()).map(([k, v]) => `${k}=${v}`).join(';'),
                            };
                        });
                    const others = capabilities.codecs.filter(c => c.mimeType.toLowerCase() !== 'audio/opus');
                    if (opusCodecs.length > 0) {
                        audioTransceiver.setCodecPreferences([...opusCodecs, ...others]);
                        console.log(`[VoiceChat - ${this.userId}] Opus+FEC+DTX definido para ${peerId}`);
                    }
                }
            }
        }

        if (createOffer) {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await this.sendSignal({
                    type: 'voice-offer',
                    from: this.userId,
                    to: peerId,
                    peerId,
                    offer
                });
            } catch (error) {
                console.error("[VoiceChat] Error creating offer:", error);
            }
        }

        return pc;
    }

    private async handleOffer(signal: VoiceSignal) {
        if (!signal.offer) return;
        const peerId = signal.from;
        console.log(`[VoiceChat - ${this.userId}] [offer←] Recebida offer de: ${peerId} | localStream: ${!!this.localStream}`);

        const pc = await this.createPeerConnection(peerId, false);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));

            // Aplicar candidatos pendentes
            const queued = this.pendingCandidates.get(peerId);
            if (queued) {
                queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
                this.pendingCandidates.delete(peerId);
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log(`[VoiceChat - ${this.userId}] [answer→] Enviando answer para: ${peerId}`);
            await this.sendSignal({
                type: 'voice-answer',
                from: this.userId,
                to: peerId,
                peerId: this.userId,
                answer
            });
        } catch (error) {
            console.error("[VoiceChat] Error handling offer:", error);
        }
    }

    private async handleAnswer(signal: VoiceSignal) {
        if (!signal.answer) return;
        const pc = this.peerConnections.get(signal.from);
        if (!pc) {
            console.warn(`[VoiceChat - ${this.userId}] [answer←] Answer de ${signal.from} descartada — sem PeerConnection`);
            return;
        }

        // Only apply answer when expecting one — prevents "wrong state: stable" from offer glare
        if (pc.signalingState !== 'have-local-offer') {
            console.warn(`[VoiceChat - ${this.userId}] [answer←] Answer de ${signal.from} descartada (signalingState: ${pc.signalingState})`);
            return;
        }

        console.log(`[VoiceChat - ${this.userId}] [answer←] Aplicando answer de: ${signal.from}`);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
            const queued = this.pendingCandidates.get(signal.from);
            if (queued) {
                queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
                this.pendingCandidates.delete(signal.from);
            }
        } catch (error) {
            console.error("[VoiceChat] Error handling answer:", error);
        }
    }

    // Método público para verificar se um peer está falando
    public isPeerSpeaking(peerId: string): boolean {
        const data = this.speakingAnalysers.get(peerId);
        return data ? (data as any).speaking === true : false;
    }

    // Método público para obter o nível de áudio de um peer (0-1)
    public getPeerAudioLevel(peerId: string): number {
        const data = this.speakingAnalysers.get(peerId);
        return data ? ((data as any).audioLevel || 0) : 0;
    }
}
