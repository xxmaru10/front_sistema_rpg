import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";

// Tipos de sinal WebRTC
export type SignalType = 'peer-join' | 'offer' | 'answer' | 'ice-candidate' | 'stream-started' | 'stop-share';

export interface WebRTCSignal {
    type: SignalType;
    from: string;
    to?: string; // undefined = broadcast para todos
    peerId?: string;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

/**
 * ScreenShareManager v3 - Sinalização via Supabase DB (postgres_changes)
 *
 * Em vez do canal Broadcast (instável), usa a tabela 'webrtc_signals' diretamente.
 * - ENVIO: supabase.from('webrtc_signals').insert(...)
 * - RECEBIMENTO: postgres_changes subscription (mesmo mecanismo do eventStore, confiável)
 *
 * Cada sinal expira automaticamente (TTL de 30s) para não poluir o banco.
 */
export class ScreenShareManager {
    private sessionId: string;
    private userId: string;
    private channel: any = null;
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
    private onStreamReceived: (stream: MediaStream | null) => void;
    private isBroadcaster: boolean = false;
    private bufferedPeerIds: Set<string> = new Set();
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private processedSignalIds: Set<string> = new Set();
    private reconnectAttempts: Map<string, number> = new Map();
    private static readonly MAX_RECONNECT_ATTEMPTS = 3;

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

    constructor(
        sessionId: string,
        userId: string,
        onStreamReceived: (stream: MediaStream | null) => void
    ) {
        this.sessionId = sessionId;
        this.userId = userId.trim().toLowerCase();
        this.onStreamReceived = onStreamReceived;
    }

    public async initialize() {
        if (this.channel) return;

        // Subscribes a postgres_changes na tabela webrtc_signals desta sessão
        this.channel = supabase
            .channel(`webrtc-db-${this.sessionId}`)
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
                    // Ignorar sinais de si mesmo
                    if (row.from_user?.trim().toLowerCase() === this.userId) return;
                    // Ignorar sinais direcionados a outro usuário
                    if (row.to_user && row.to_user.trim().toLowerCase() !== this.userId) return;
                    // Deduplicar
                    if (this.processedSignalIds.has(row.id)) return;
                    this.processedSignalIds.add(row.id);

                    const signal: WebRTCSignal = {
                        type: row.signal_type,
                        from: row.from_user,
                        to: row.to_user,
                        ...row.payload
                    };
                    console.log(`[WebRTC - ${this.userId}] Received signal via DB:`, signal.type, 'from:', signal.from);
                    this.handleSignal(signal);
                }
            )
            .subscribe((status: string) => {
                console.log(`[WebRTC - ${this.userId}] DB channel status:`, status);
                if (status === 'SUBSCRIBED') {
                    if (this.isBroadcaster) {
                        // Broadcaster reconectou: reanunciar stream ativo
                        this.sendSignal({ type: 'stream-started', from: this.userId });
                    } else {
                        // Viewer: anunciar nossa presença
                        this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId });
                    }
                }
            });
    }

    private async sendSignal(signal: WebRTCSignal) {
        console.log(`[WebRTC - ${this.userId}] Sending signal via DB:`, signal.type);
        try {
            const { error } = await supabase
                .from('webrtc_signals')
                .insert({
                    id: uuidv4(),
                    session_id: this.sessionId,
                    from_user: this.userId,
                    to_user: signal.to || null, // null = broadcast
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
                console.error(`[WebRTC - ${this.userId}] DB insert error for ${signal.type}:`, error.message);
                // Se a tabela não existe, log específico
                if (error.code === '42P01') {
                    console.error('[WebRTC] TABELA webrtc_signals NÃO EXISTE. Execute o SQL de criação no Supabase.');
                }
            }
        } catch (e) {
            console.error(`[WebRTC - ${this.userId}] Failed to send ${signal.type}:`, e);
        }
    }

    public async startSharing(): Promise<MediaStream | null> {
        console.log(`[WebRTC - ${this.userId}] Starting screen share...`);
        try {
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    // Captura em Full HD estável e nítida
                    width: { ideal: 1920, max: 2560 },
                    height: { ideal: 1080, max: 1440 },
                    frameRate: { ideal: 30, max: 60 },
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            // Otimiza para nitidez/detalhes (texto e mapas) ao invés de movimento rápido
            this.localStream.getVideoTracks().forEach(track => {
                if ('contentHint' in track) {
                    (track as any).contentHint = 'detail';
                }
            });

            this.isBroadcaster = true;
            this.onStreamReceived(this.localStream);

            // Conectar imediatamente a peers que já enviaram peer-join
            if (this.bufferedPeerIds.size > 0) {
                console.log(`[WebRTC - ${this.userId}] Connecting to ${this.bufferedPeerIds.size} buffered peers`);
                this.bufferedPeerIds.forEach(peerId => this.createPeerConnection(peerId));
                this.bufferedPeerIds.clear();
            }

            await this.sendSignal({ type: 'stream-started', from: this.userId });

            // Heartbeat a cada 30s para novos jogadores que entrarem depois
            this.heartbeatInterval = setInterval(() => {
                if (this.isBroadcaster && this.localStream) {
                    this.sendSignal({ type: 'stream-started', from: this.userId });
                }
            }, 30000);

            this.localStream.getVideoTracks()[0].onended = () => this.stopSharing();

            return this.localStream;
        } catch (error) {
            console.error("Error starting screen share:", error);
            return null;
        }
    }

    public stopSharing() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.isBroadcaster) {
            this.sendSignal({ type: 'stop-share', from: this.userId });
            this.isBroadcaster = false;
        }

        this.bufferedPeerIds.clear();
        this.onStreamReceived(null);
        this.cleanupPeers();
    }

    public disconnect() {
        this.stopSharing();
        if (this.channel) {
            supabase.removeChannel(this.channel);
            this.channel = null;
        }
    }

    private async handleSignal(signal: WebRTCSignal) {
        const type = signal.type;
        const from = signal.from?.trim().toLowerCase() ?? '';

        if (type === 'stop-share') {
            if (!this.isBroadcaster) {
                this.onStreamReceived(null);
                this.cleanupPeers();
            }
            return;
        }

        if (type === 'stream-started') {
            if (!this.isBroadcaster) {
                // Se já temos uma conexão ativa com o broadcaster, ignorar heartbeat
                const existingPc = this.peerConnections.get('broadcaster');
                if (existingPc && existingPc.connectionState !== 'failed' && existingPc.connectionState !== 'closed') {
                    // Conexão já ativa, não precisa reconectar
                    return;
                }
                console.log(`[WebRTC - ${this.userId}] Stream active, sending peer-join`);
                await this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId, to: from });
            }
            return;
        }

        if (type === 'peer-join') {
            const peerId = (signal.peerId || from)?.trim().toLowerCase();
            if (!peerId || peerId === this.userId) return;

            if (this.isBroadcaster) {
                // Sempre recria a conexão ao receber peer-join, mesmo que já exista.
                // Garante que jogadores que deram F5 ou usaram o botão refresh sejam
                // atendidos sem o mestre precisar fechar e reabrir a transmissão.
                console.log(`[WebRTC - ${this.userId}] Peer joined (broadcasting): ${peerId} — recriando conexão`);
                this.createPeerConnection(peerId);
            } else {
                console.log(`[WebRTC - ${this.userId}] Buffering peer: ${peerId}`);
                this.bufferedPeerIds.add(peerId);
            }
            return;
        }

        if (type === 'offer' && !this.isBroadcaster && signal.offer) {
            setTimeout(() => this.handleOffer(signal), 0);
            return;
        }

        if (type === 'answer' && this.isBroadcaster && signal.answer) {
            setTimeout(() => this.handleAnswer(signal), 0);
            return;
        }

        if (type === 'ice-candidate' && signal.candidate) {
            const targetPeerId = this.isBroadcaster ? from : 'broadcaster';
            if (!targetPeerId) return;
            const pc = this.peerConnections.get(targetPeerId);
            if (pc) {
                if (pc.remoteDescription) {
                    pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(console.error);
                } else {
                    if (!this.pendingCandidates.has(targetPeerId)) {
                        this.pendingCandidates.set(targetPeerId, []);
                    }
                    this.pendingCandidates.get(targetPeerId)!.push(signal.candidate);
                }
            }
        }
    }

    private async createPeerConnection(peerId: string) {
        console.log(`[WebRTC - ${this.userId}] Creating peer connection for:`, peerId);
        if (this.peerConnections.has(peerId)) {
            this.peerConnections.get(peerId)?.close();
        }

        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(peerId, pc);

        // Safety timeout: fecha conexões presas em 'new' ou 'connecting' após 15s
        const safetyTimeout = setTimeout(() => {
            if (pc.connectionState === 'new' || pc.connectionState === 'connecting') {
                console.warn(`[WebRTC] Safety timeout (15s): fechando conexão presa para ${peerId} (state: ${pc.connectionState})`);
                pc.close();
                this.peerConnections.delete(peerId);
                const reconnectKey = this.isBroadcaster ? peerId : 'broadcaster';
                const attempts = this.reconnectAttempts.get(reconnectKey) || 0;
                if (attempts < ScreenShareManager.MAX_RECONNECT_ATTEMPTS) {
                    this.reconnectAttempts.set(reconnectKey, attempts + 1);
                    if (this.isBroadcaster && this.localStream) {
                        this.createPeerConnection(peerId);
                    } else if (!this.isBroadcaster) {
                        this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId });
                    }
                }
            }
        }, 15000);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'ice-candidate',
                    from: this.userId,
                    to: this.isBroadcaster ? peerId : undefined,
                    peerId,
                    candidate: event.candidate.toJSON()
                });
            }
        };

        // Reconexão automática para conexões falhadas
        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state for ${peerId}:`, pc.connectionState);
            if (pc.connectionState !== 'new' && pc.connectionState !== 'connecting') {
                clearTimeout(safetyTimeout);
            }
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                const reconnectKey = this.isBroadcaster ? peerId : 'broadcaster';
                const attempts = this.reconnectAttempts.get(reconnectKey) || 0;
                if (attempts < ScreenShareManager.MAX_RECONNECT_ATTEMPTS) {
                    this.reconnectAttempts.set(reconnectKey, attempts + 1);
                    console.log(`[WebRTC] Reconnecting ${reconnectKey} (attempt ${attempts + 1}/${ScreenShareManager.MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(() => {
                        if (this.isBroadcaster && this.localStream) {
                            this.createPeerConnection(peerId);
                        } else if (!this.isBroadcaster) {
                            // Viewer: pedir ao broadcaster para reconectar
                            this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId });
                        }
                    }, 3000 * (attempts + 1));
                } else {
                    console.warn(`[WebRTC] Max reconnect attempts reached for ${reconnectKey}`);
                }
            } else if (pc.connectionState === 'connected') {
                const reconnectKey = this.isBroadcaster ? peerId : 'broadcaster';
                this.reconnectAttempts.delete(reconnectKey);
            }
        };

        if (this.isBroadcaster && this.localStream) {
            this.localStream.getTracks().forEach(track => {
                if (this.localStream) pc.addTrack(track, this.localStream);
            });

            // Forçar alta qualidade no encoding WebRTC
            try {
                const senders = pc.getSenders();
                for (const sender of senders) {
                    if (sender.track?.kind === 'video') {
                        const params = sender.getParameters();
                        if (!params.encodings || params.encodings.length === 0) {
                            params.encodings = [{}];
                        }
                        // Bitrate adaptativo: reduz conforme mais peers entram na sessão
                        params.encodings[0].maxBitrate = this.getAdaptiveBitrate();
                        params.encodings[0].priority = 'high';
                        params.encodings[0].networkPriority = 'high';

                        // Tenta manter a resolução em vez de baixar o FPS (ideal para arena com textos/detalhes)
                        try {
                            if ('setDegradationPreference' in (sender as any)) {
                                (sender as any).setDegradationPreference('maintain-resolution');
                            }
                        } catch(e) { /* ignore fallback */ }

                        // Sem limite de framerate no encoder
                        delete (params.encodings[0] as any).maxFramerate;
                        await sender.setParameters(params);
                    }
                }
            } catch (e) {
                console.warn('[WebRTC] Could not set encoding params:', e);
            }

            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await this.sendSignal({ type: 'offer', from: this.userId, to: peerId, peerId, offer });
            } catch (error) {
                console.error("Error creating offer:", error);
            }
        } else {
            pc.ontrack = (event) => {
                console.log(`[WebRTC - ${this.userId}] Received remote track!`);
                if (event.streams?.[0]) {
                    this.onStreamReceived(event.streams[0]);
                } else if (event.track) {
                    this.onStreamReceived(new MediaStream([event.track]));
                }
            };
        }

        return pc;
    }

    private async handleOffer(signal: WebRTCSignal) {
        if (!signal.offer) return;
        console.log(`[WebRTC - ${this.userId}] Handling offer from broadcaster`);
        const pc = await this.createPeerConnection('broadcaster');
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));

            const queued = this.pendingCandidates.get('broadcaster');
            if (queued) {
                queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
                this.pendingCandidates.delete('broadcaster');
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            // Responder diretamente para o broadcaster (from = broadcaster userId)
            await this.sendSignal({ type: 'answer', from: this.userId, to: signal.from, peerId: this.userId, answer });
        } catch (error) {
            console.error("Error handling offer:", error);
        }
    }

    private async handleAnswer(signal: WebRTCSignal) {
        if (!signal.answer) return;
        const sourceId = signal.peerId || signal.from;
        if (!sourceId) return;
        console.log(`[WebRTC - ${this.userId}] Handling answer from:`, sourceId);
        const pc = this.peerConnections.get(sourceId);
        if (pc) {
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                const queued = this.pendingCandidates.get(sourceId);
                if (queued) {
                    queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
                    this.pendingCandidates.delete(sourceId);
                }
            } catch (error) {
                console.error("Error handling answer:", error);
            }
        }
    }

    private cleanupPeers() {
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.pendingCandidates.clear();
        // Zera contadores para que a próxima sessão de conexões comece do zero.
        // Sem isso, falhas acumuladas de uma transmissão anterior bloqueiam retries da próxima.
        this.reconnectAttempts.clear();
    }

    /**
     * Bitrate adaptativo baseado na quantidade de peers conectados.
     * Mesh de N viewers = broadcaster envia N streams simultâneos.
     * Valores: ≤2 peers → 4Mbps | ≤5 → 2.5Mbps | ≤8 → 1.5Mbps | 9+ → 1Mbps
     */
    private getAdaptiveBitrate(): number {
        const peerCount = this.peerConnections.size;
        if (peerCount <= 2) return 4_000_000;
        if (peerCount <= 5) return 2_500_000;
        if (peerCount <= 8) return 1_500_000;
        return 1_000_000;
    }

    /**
     * Reconecta apenas se não houver conexão ativa (usa `visibilitychange` e focus events).
     * Diferente de `reconnect()`, não interrompe uma conexão que já está funcionando.
     */
    public async checkAndReconnect() {
        if (this.isBroadcaster) return;
        const existingPc = this.peerConnections.get('broadcaster');
        const isHealthy = existingPc &&
            existingPc.connectionState !== 'failed' &&
            existingPc.connectionState !== 'closed' &&
            existingPc.connectionState !== 'disconnected';
        if (!isHealthy) {
            console.log(`[WebRTC - ${this.userId}] checkAndReconnect: sem conexão ativa, enviando peer-join`);
            await this.reconnect();
        }
    }

    /**
     * Reconnect manual (viewer only): fecha a RTCPeerConnection local com o broadcaster
     * e re-envia peer-join para iniciar um novo handshake sem exigir F5 na página.
     */
    public async reconnect() {
        if (this.isBroadcaster) return;
        console.log(`[WebRTC - ${this.userId}] Reconnect manual solicitado`);
        const existingPc = this.peerConnections.get('broadcaster');
        if (existingPc) {
            existingPc.close();
            this.peerConnections.delete('broadcaster');
        }
        this.pendingCandidates.delete('broadcaster');
        this.reconnectAttempts.delete('broadcaster');
        await this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId });
    }
}
