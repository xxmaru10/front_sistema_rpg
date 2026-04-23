import { getSocket } from "./socketClient";
import { screenShareStore } from "./screenShareStore";

export type SignalType = 'peer-join' | 'offer' | 'answer' | 'ice-candidate' | 'stream-started' | 'stop-share';

export interface WebRTCSignal {
    type: SignalType;
    from: string;
    to?: string;
    peerId?: string;
    offer?: RTCSessionDescriptionInit;
    answer?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

type ScreenShareTier = '1080p' | '720p';
type ScreenSharePeerRole = 'broadcaster' | 'receiver';
type ScreenSharePeerStage =
    | 'createPeerConnection'
    | 'offer-created'
    | 'offer-sent'
    | 'offer-received'
    | 'remote-description-set'
    | 'answer-created'
    | 'answer-sent'
    | 'answer-received'
    | 'ice-connection-state-change'
    | 'connection-state-change'
    | 'safety-timeout'
    | 'reconnect-scheduled'
    | 'peer-join-ignored-by-breaker'
    | 'peer-hard-stopped'
    | 'track-received';

interface ScreenSharePeerFailureState {
    failures: number;
    blockedUntil: number;
    hardStopped: boolean;
}

export interface ScreenShareManagerConfig {
    onPeerHardStopped?: (peerId: string) => void;
}

const SCREENSHARE_TIER_STORAGE_KEY = 'screenshare_tier';
const DEBUG_SCREEN_SHARE_STORAGE_KEY = 'debugScreenShare';
const QUALITY_MONITOR_INTERVAL_MS = 4000;
const QUALITY_PRESSURE_STREAK_TARGET = 2;

export class ScreenShareManager {
    private sessionId: string;
    private userId: string;
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
    private onStreamReceived: (stream: MediaStream | null) => void;
    private isBroadcaster: boolean = false;
    private bufferedPeerIds: Set<string> = new Set();
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private reconnectAttempts: Map<string, number> = new Map();
    private _receivedTracks: Map<string, MediaStreamTrack> = new Map();
    private signalHandler: ((signal: WebRTCSignal) => void) | null = null;
    private statsInterval: ReturnType<typeof setInterval> | null = null;
    private qualityTier: ScreenShareTier = '1080p';
    private hasDowngraded: boolean = false;
    private cpuPressureStreak: number = 0;
    private fpsPressureStreak: number = 0;
    private droppedPressureStreak: number = 0;
    private attemptCounters: Map<string, number> = new Map();
    private pcAttemptIds: WeakMap<RTCPeerConnection, number> = new WeakMap();
    private peerFailureState: Map<string, ScreenSharePeerFailureState> = new Map();
    private onPeerHardStopped?: (peerId: string) => void;
    private static readonly MAX_RECONNECT_ATTEMPTS = 3;
    private static readonly BREAKER_COOLDOWN_MS = 30_000;
    private static readonly BREAKER_SOFT_THRESHOLD = 3;
    private static readonly BREAKER_HARD_THRESHOLD = 5;
    private isHealthyConnectionState(state: RTCPeerConnectionState): boolean {
        return state === 'new' || state === 'connecting' || state === 'connected';
    }

    private rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.services.mozilla.com' },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ],
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        iceCandidatePoolSize: 10,
    };

    constructor(
        sessionId: string,
        userId: string,
        onStreamReceived: (stream: MediaStream | null) => void,
        config?: ScreenShareManagerConfig,
    ) {
        this.sessionId = sessionId;
        this.userId = userId.trim().toLowerCase();
        this.onStreamReceived = onStreamReceived;
        this.onPeerHardStopped = config?.onPeerHardStopped;
        this.qualityTier = this.readStoredTier();
        this.hasDowngraded = this.qualityTier === '720p';
        screenShareStore.setQualityTier(this.qualityTier, this.hasDowngraded);
    }

    private getRole(): ScreenSharePeerRole {
        return this.isBroadcaster ? 'broadcaster' : 'receiver';
    }

    private shouldLogPeerEvent(): boolean {
        if (process.env.NODE_ENV === 'development') return true;
        if (typeof window === 'undefined') return false;
        try {
            return window.localStorage?.getItem(DEBUG_SCREEN_SHARE_STORAGE_KEY) === '1';
        } catch {
            return false;
        }
    }

    private logPeerEvent(params: {
        peerId: string;
        attemptId: number;
        stage: ScreenSharePeerStage;
        role?: ScreenSharePeerRole;
        data?: Record<string, unknown> | (() => Record<string, unknown>);
    }) {
        if (!this.shouldLogPeerEvent()) return;

        const base = {
            peerId: params.peerId,
            attemptId: params.attemptId,
            role: params.role ?? this.getRole(),
            stage: params.stage,
        };
        const data = typeof params.data === 'function' ? params.data() : params.data;
        if (data) {
            console.debug('[SS-TELEMETRY]', { ...base, ...data });
            return;
        }
        console.debug('[SS-TELEMETRY]', base);
    }

    private nextAttemptId(peerId: string): number {
        const nextAttempt = (this.attemptCounters.get(peerId) ?? 0) + 1;
        this.attemptCounters.set(peerId, nextAttempt);
        return nextAttempt;
    }

    private getAttemptId(peerId: string, pc?: RTCPeerConnection | null): number {
        if (pc) {
            const fromPc = this.pcAttemptIds.get(pc);
            if (typeof fromPc === 'number') return fromPc;
        }
        return this.attemptCounters.get(peerId) ?? 0;
    }

    private getOrCreatePeerFailureState(peerId: string): ScreenSharePeerFailureState {
        const existing = this.peerFailureState.get(peerId);
        if (existing) return existing;
        const initial: ScreenSharePeerFailureState = { failures: 0, blockedUntil: 0, hardStopped: false };
        this.peerFailureState.set(peerId, initial);
        return initial;
    }

    private isPeerBlocked(peerId: string): boolean {
        const failure = this.getOrCreatePeerFailureState(peerId);
        return failure.hardStopped || Date.now() < failure.blockedUntil;
    }

    private recordPeerFailure(peerId: string, origin: 'safety-timeout' | 'state-change-failed', attemptId: number): void {
        if (!this.isBroadcaster) return;

        const current = this.getOrCreatePeerFailureState(peerId);
        const failures = current.failures + 1;
        let blockedUntil = 0;
        let hardStopped = current.hardStopped;

        if (failures >= ScreenShareManager.BREAKER_HARD_THRESHOLD) {
            hardStopped = true;
        } else if (failures >= ScreenShareManager.BREAKER_SOFT_THRESHOLD) {
            blockedUntil = Date.now() + ScreenShareManager.BREAKER_COOLDOWN_MS;
        }

        this.peerFailureState.set(peerId, { failures, blockedUntil, hardStopped });

        if (hardStopped && !current.hardStopped) {
            this.logPeerEvent({
                peerId,
                attemptId,
                stage: 'peer-hard-stopped',
                data: { origin, failures },
            });
            this.onPeerHardStopped?.(peerId);
            return;
        }

    }

    private clearPeerFailure(peerId: string): void {
        this.peerFailureState.set(peerId, { failures: 0, blockedUntil: 0, hardStopped: false });
    }

    private scheduleReconnect(peerId: string, origin: 'safety-timeout' | 'state-change-failed', attemptId: number) {
        if (this.isBroadcaster && !this.localStream) return;

        const reconnectKey = this.isBroadcaster ? peerId : 'broadcaster';
        const attempts = this.reconnectAttempts.get(reconnectKey) || 0;
        if (attempts >= ScreenShareManager.MAX_RECONNECT_ATTEMPTS) {
            console.warn(`[WebRTC] Max reconnect attempts reached for ${reconnectKey}`);
            return;
        }

        if (this.isBroadcaster && this.isPeerBlocked(peerId)) {
            this.logPeerEvent({
                peerId,
                attemptId,
                stage: 'peer-join-ignored-by-breaker',
                data: { origin },
            });
            return;
        }

        const nextAttempt = attempts + 1;
        const delayMs = origin === 'state-change-failed' ? 3000 * nextAttempt : 0;
        this.reconnectAttempts.set(reconnectKey, nextAttempt);
        this.logPeerEvent({
            peerId,
            attemptId,
            stage: 'reconnect-scheduled',
            data: { origin, delayMs, attempt: nextAttempt },
        });

        const reconnectAction = () => {
            if (this.isBroadcaster && this.localStream) {
                void this.createPeerConnection(peerId);
            } else if (!this.isBroadcaster) {
                void this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId });
            }
        };

        if (delayMs <= 0) {
            reconnectAction();
            return;
        }
        setTimeout(reconnectAction, delayMs);
    }

    // ─── Initialize ────────────────────────────────────────────

    public async initialize() {
        const socket = getSocket(this.userId);

        socket.on('transmission-status-req', (data: { fromSocketId: string }) => {
            if (this.isBroadcaster && this.localStream) {
                socket.emit('transmission-status-res', {
                    toSocketId: data.fromSocketId,
                    isActive: true,
                });
            }
        });

        // Remove previous handler if reinitializing
        if (this.signalHandler) {
            socket.off('webrtc-signal', this.signalHandler);
        }

        this.signalHandler = (signal: WebRTCSignal) => {
            // Ignore own signals
            if (signal.from?.trim().toLowerCase() === this.userId) return;
            // Ignore signals directed to someone else
            if (signal.to && signal.to.trim().toLowerCase() !== this.userId) return;
            // Only handle screen share signals (not voice-)
            if (signal.type?.startsWith('voice-')) return;

            console.log(`[WebRTC - ${this.userId}] Signal received:`, signal.type, 'from:', signal.from);
            this.handleSignal(signal);
        };

        socket.on('webrtc-signal', this.signalHandler);

        // Announce presence
        if (this.isBroadcaster) {
            this.sendSignal({ type: 'stream-started', from: this.userId });
        } else {
            this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId });
        }
    }

    public get broadcasting(): boolean {
        return this.isBroadcaster;
    }

    // ─── Signal sending ────────────────────────────────────────

    private async sendSignal(signal: WebRTCSignal) {
        if (process.env.NODE_ENV === 'development') {
            console.log(`[WebRTC - ${this.userId}] Sending signal:`, signal.type);
        }
        const socket = getSocket(this.userId);

        // Broadcast to session room — receiver filters by signal.to
        socket.emit('webrtc-signal', {
            sessionId: this.sessionId,
            signal,
        });
    }

    // ─── Start / Stop sharing ──────────────────────────────────

    public async startSharing(): Promise<MediaStream | null> {
        console.log(`[WebRTC - ${this.userId}] Starting screen share...`);
        try {
            this.peerFailureState.clear();
            this.attemptCounters.clear();
            this.pcAttemptIds = new WeakMap();
            screenShareStore.clearPeerHardStopped();
            this.qualityTier = this.readStoredTier();
            this.hasDowngraded = this.qualityTier === '720p';
            const is720p = this.qualityTier === '720p';

            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: is720p ? 1280 : 1920, max: is720p ? 1280 : 1920 },
                    height: { ideal: is720p ? 720 : 1080, max: is720p ? 720 : 1080 },
                    frameRate: { ideal: is720p ? 24 : 30, max: is720p ? 24 : 30 },
                },
                // audio: true — NO mic processing constraints for system audio
                // echoCancellation/noiseSuppression/autoGainControl are for microphones
                // and corrupt or drop system audio entirely
                audio: true,
            });

            // Check if audio was captured
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('[ScreenShare] No audio track — user may not have checked "Share system audio"');
            } else {
                console.log('[ScreenShare] Audio tracks captured:', audioTracks.length, audioTracks[0].label);
            }

            this.isBroadcaster = true;
            this.onStreamReceived(this.localStream);
            screenShareStore.setQualityTier(this.qualityTier, this.hasDowngraded);
            this.resetQualityPressure();

            // Connect to peers that already sent peer-join
            if (this.bufferedPeerIds.size > 0) {
                console.log(`[WebRTC - ${this.userId}] Connecting to ${this.bufferedPeerIds.size} buffered peers`);
                this.bufferedPeerIds.forEach(peerId => this.createPeerConnection(peerId));
                this.bufferedPeerIds.clear();
            }

            await this.sendSignal({ type: 'stream-started', from: this.userId });
            const socket = getSocket(this.userId);
            socket.emit('transmission-sync', {
                sessionId: this.sessionId,
                payload: { type: 'stream-started' },
            });

            // Heartbeat de descoberta — apenas para quem ainda não conectou
            this.heartbeatInterval = setInterval(() => {
                if (this.isBroadcaster && this.localStream) {
                    // Só enviar o sinal WebRTC, sem forçar o socket 'transmission-sync' que reseta viewers
                    this.sendSignal({ type: 'stream-started', from: this.userId });
                }
            }, 60000); // Aumentado para 60s

            this.localStream.getVideoTracks()[0].onended = () => this.stopSharing();
            this.startQualityMonitoring();

            return this.localStream;
        } catch (error) {
            console.error("Error starting screen share:", error);
            return null;
        }
    }

    public stopSharing() {
        screenShareStore.clearPeerHardStopped();
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        this.stopQualityMonitoring();
        this.resetQualityPressure();

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.isBroadcaster) {
            this.sendSignal({ type: 'stop-share', from: this.userId });
            const socket = getSocket(this.userId);
            socket.emit('transmission-sync', {
                sessionId: this.sessionId,
                payload: { type: 'stop-share' },
            });
            this.isBroadcaster = false;
        }

        this.bufferedPeerIds.clear();
        this.onStreamReceived(null);
        this.hasDowngraded = this.qualityTier === '720p';
        screenShareStore.setQualityTier(this.qualityTier, this.hasDowngraded);
        this.cleanupPeers();
    }

    public disconnect() {
        this.stopSharing();
        const socket = getSocket(this.userId);
        if (this.signalHandler) {
            socket.off('webrtc-signal', this.signalHandler);
            this.signalHandler = null;
        }
    }

    // ─── Signal handling ───────────────────────────────────────

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
                const existingPc = this.peerConnections.get('broadcaster');
                if (existingPc
                    && existingPc.connectionState !== 'failed'
                    && existingPc.connectionState !== 'closed') {
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
                if (this.isPeerBlocked(peerId)) {
                    this.logPeerEvent({
                        peerId,
                        attemptId: this.getAttemptId(peerId),
                        stage: 'peer-join-ignored-by-breaker',
                        data: { origin: 'peer-join' },
                    });
                    return;
                }
                const existingPc = this.peerConnections.get(peerId);
                if (existingPc && this.isHealthyConnectionState(existingPc.connectionState)) {
                    console.log(`[WebRTC - ${this.userId}] Peer ${peerId} already has healthy connection (${existingPc.connectionState}), skipping recreate`);
                    return;
                }
                console.log(`[WebRTC - ${this.userId}] Peer joined: ${peerId} — creating connection`);
                this.createPeerConnection(peerId);
            } else {
                console.log(`[WebRTC - ${this.userId}] Buffering peer: ${peerId}`);
                this.bufferedPeerIds.add(peerId);
            }
            return;
        }

        if (type === 'offer' && !this.isBroadcaster && signal.offer) {
            this.logPeerEvent({
                peerId: 'broadcaster',
                attemptId: this.getAttemptId('broadcaster'),
                stage: 'offer-received',
            });
            const existing = this.peerConnections.get('broadcaster');
            if (
                existing &&
                (existing.connectionState === 'connected' || existing.connectionState === 'connecting') &&
                existing.signalingState === 'stable'
            ) {
                console.log(`[WebRTC - ${this.userId}] Duplicate offer ignored — broadcaster connection already healthy`);
                return;
            }
            setTimeout(() => this.handleOffer(signal), 0);
            return;
        }

        if (type === 'answer' && this.isBroadcaster && signal.answer) {
            const answerPeerId = (signal.peerId || from || '').trim().toLowerCase();
            if (answerPeerId) {
                this.logPeerEvent({
                    peerId: answerPeerId,
                    attemptId: this.getAttemptId(answerPeerId),
                    stage: 'answer-received',
                });
            }
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

    // ─── Peer connection ───────────────────────────────────────

    private async createPeerConnection(rawPeerId: string) {
        const peerId = rawPeerId.trim().toLowerCase();
        const attemptId = this.nextAttemptId(peerId);
        console.log(`[WebRTC - ${this.userId}] Creating peer connection for:`, peerId);
        const existingPc = this.peerConnections.get(peerId);
        this.logPeerEvent({
            peerId,
            attemptId,
            stage: 'createPeerConnection',
            data: existingPc ? { prevExistingState: existingPc.connectionState } : undefined,
        });
        if (existingPc && this.isHealthyConnectionState(existingPc.connectionState)) {
            return existingPc;
        }
        if (existingPc) {
            existingPc.close();
            this.peerConnections.delete(peerId);
        }

        const pc = new RTCPeerConnection(this.rtcConfig);
        this.pcAttemptIds.set(pc, attemptId);
        this.peerConnections.set(peerId, pc);
        let previousConnectionState: RTCPeerConnectionState = pc.connectionState;
        let stateFailureRecorded = false;
        let reconnectScheduled = false;
        const loggedTrackKinds = new Set<string>();

        // Safety timeout: close stuck connections after 15s
        const safetyTimeout = setTimeout(() => {
            if (this.peerConnections.get(peerId) !== pc) return;
            if (pc.connectionState === 'new' || pc.connectionState === 'connecting') {
                this.logPeerEvent({
                    peerId,
                    attemptId,
                    stage: 'safety-timeout',
                    data: () => ({
                        lastConnectionState: pc.connectionState,
                        lastIceConnectionState: pc.iceConnectionState,
                        lastSignalingState: pc.signalingState,
                    }),
                });
                console.warn(`[WebRTC] Safety timeout: closing stuck connection for ${peerId}`);
                pc.close();
                this.peerConnections.delete(peerId);
                reconnectScheduled = true;
                if (this.isBroadcaster) {
                    this.recordPeerFailure(peerId, 'safety-timeout', attemptId);
                }
                this.scheduleReconnect(peerId, 'safety-timeout', attemptId);
            }
        }, 15000);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'ice-candidate',
                    from: this.userId,
                    to: this.isBroadcaster ? peerId : undefined,
                    peerId,
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            this.logPeerEvent({
                peerId,
                attemptId,
                stage: 'ice-connection-state-change',
                data: () => ({ iceConnectionState: pc.iceConnectionState }),
            });
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state for ${peerId}:`, pc.connectionState);
            this.logPeerEvent({
                peerId,
                attemptId,
                stage: 'connection-state-change',
                data: () => ({ connectionState: pc.connectionState }),
            });
            const fromState = previousConnectionState;
            previousConnectionState = pc.connectionState;
            if (pc.connectionState !== 'new' && pc.connectionState !== 'connecting') {
                clearTimeout(safetyTimeout);
            }
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                if (this.isBroadcaster && !stateFailureRecorded && (fromState === 'connecting' || fromState === 'connected')) {
                    this.recordPeerFailure(peerId, 'state-change-failed', attemptId);
                    stateFailureRecorded = true;
                }

                if (!reconnectScheduled) {
                    reconnectScheduled = true;
                    this.scheduleReconnect(peerId, 'state-change-failed', attemptId);
                }
            } else if (pc.connectionState === 'connected') {
                reconnectScheduled = false;
                stateFailureRecorded = false;
                const reconnectKey = this.isBroadcaster ? peerId : 'broadcaster';
                this.reconnectAttempts.delete(reconnectKey);
                if (this.isBroadcaster) {
                    this.clearPeerFailure(peerId);
                }
            }
        };

        if (this.isBroadcaster && this.localStream) {
            // Add ALL tracks (video + audio)
            this.localStream.getTracks().forEach(track => {
                console.log(`[WebRTC - ${this.userId}] Adding ${track.kind} track to peer connection`);
                if (this.localStream) pc.addTrack(track, this.localStream);
            });

            // Set encoding params for video + audio.
            // Vídeo é limitado agressivamente para preservar uplink da call de voz.
            // Áudio recebe prioridade para manter inteligibilidade da transmissão.
            try {
                const senders = pc.getSenders();
                const adaptiveVideoBitrate = this.getAdaptiveBitrate();
                const adaptiveAudioBitrate = this.getAdaptiveAudioBitrate();
                for (const sender of senders) {
                    if (sender.track?.kind === 'video') {
                        const params = sender.getParameters();
                        if (!params.encodings || params.encodings.length === 0) {
                            params.encodings = [{}];
                        }
                        params.encodings[0].maxBitrate = adaptiveVideoBitrate;
                        params.encodings[0].priority = 'high';
                        params.encodings[0].networkPriority = 'high';
                        params.encodings[0].maxFramerate = this.qualityTier === '720p' ? 24 : 30;
                        try {
                            if ('setDegradationPreference' in (sender as any)) {
                                (sender as any).setDegradationPreference('balanced');
                            }
                        } catch (e) { /* ignore */ }
                        await sender.setParameters(params);
                    } else if (sender.track?.kind === 'audio') {
                        const params = sender.getParameters();
                        if (!params.encodings || params.encodings.length === 0) {
                            params.encodings = [{}];
                        }
                        params.encodings[0].maxBitrate = adaptiveAudioBitrate;
                        params.encodings[0].priority = 'high';
                        (params.encodings[0] as any).networkPriority = 'high';
                        (params.encodings[0] as any).dtx = 'disabled';
                        await sender.setParameters(params);
                    }
                }
            } catch (e) {
                console.warn('[WebRTC] Could not set encoding params:', e);
            }

            try {
                const offer = await pc.createOffer();
                this.logPeerEvent({ peerId, attemptId, stage: 'offer-created' });
                await pc.setLocalDescription(offer);
                await this.sendSignal({ type: 'offer', from: this.userId, to: peerId, peerId, offer });
                this.logPeerEvent({ peerId, attemptId, stage: 'offer-sent' });
            } catch (error) {
                console.error("Error creating offer:", error);
            }
        } else {
            // Receiver side — accumulate tracks as they arrive
            // ontrack fires once per track (video first, then audio)
            pc.ontrack = (event) => {
                if (!loggedTrackKinds.has(event.track.kind)) {
                    loggedTrackKinds.add(event.track.kind);
                    this.logPeerEvent({
                        peerId,
                        attemptId,
                        stage: 'track-received',
                        data: { kind: event.track.kind },
                    });
                }
                console.log(`[WebRTC - ${this.userId}] Received ${event.track.kind} track`);

                if (event.streams?.[0]) {
                    // streams[0] is the same MediaStream object for all tracks
                    // calling onStreamReceived again with the same stream is safe —
                    // React deduplicates via reference equality
                    this.onStreamReceived(event.streams[0]);
                } else {
                    // Fallback: accumulate tracks manually when streams[] is empty
                    this._receivedTracks.set(event.track.kind, event.track);
                    const tracks = Array.from(this._receivedTracks.values());
                    this.onStreamReceived(new MediaStream(tracks));
                }
            };
        }

        return pc;
    }

    private async handleOffer(signal: WebRTCSignal) {
        if (!signal.offer) return;
        console.log(`[WebRTC - ${this.userId}] Handling offer from broadcaster`);
        const peerId = 'broadcaster';

        // Reset received tracks for fresh connection
        this._receivedTracks.clear();

        const pc = await this.createPeerConnection(peerId);
        const attemptId = this.getAttemptId(peerId, pc);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));
            this.logPeerEvent({ peerId, attemptId, stage: 'remote-description-set' });

            const queued = this.pendingCandidates.get(peerId);
            if (queued) {
                queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
                this.pendingCandidates.delete(peerId);
            }

            const answer = await pc.createAnswer();
            this.logPeerEvent({ peerId, attemptId, stage: 'answer-created' });
            await pc.setLocalDescription(answer);
            await this.sendSignal({
                type: 'answer',
                from: this.userId,
                to: signal.from,
                peerId: this.userId,
                answer,
            });
            this.logPeerEvent({ peerId, attemptId, stage: 'answer-sent' });
        } catch (error) {
            console.error("Error handling offer:", error);
        }
    }

    private async handleAnswer(signal: WebRTCSignal) {
        if (!signal.answer) return;
        const sourceId = (signal.peerId || signal.from || '').trim().toLowerCase();
        if (!sourceId) return;
        console.log(`[WebRTC - ${this.userId}] Handling answer from:`, sourceId);
        const pc = this.peerConnections.get(sourceId);
        if (pc) {
            const attemptId = this.getAttemptId(sourceId, pc);
            if (pc.signalingState !== 'have-local-offer') {
                console.warn(`[WebRTC - ${this.userId}] Ignoring stale answer from ${sourceId} (state: ${pc.signalingState})`);
                return;
            }
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
                this.logPeerEvent({ peerId: sourceId, attemptId, stage: 'remote-description-set' });
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

    // ─── Cleanup ───────────────────────────────────────────────

    private cleanupPeers() {
        this.stopQualityMonitoring();
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.pendingCandidates.clear();
        this.reconnectAttempts.clear();
        this.peerFailureState.clear();
        this.attemptCounters.clear();
        this.pcAttemptIds = new WeakMap();
        this._receivedTracks.clear();
    }

    // ─── Public methods ────────────────────────────────────────

    public async checkAndReconnect() {
        if (this.isBroadcaster) return;
        const existingPc = this.peerConnections.get('broadcaster');
        const isHealthy = existingPc
            && existingPc.connectionState !== 'failed'
            && existingPc.connectionState !== 'closed'
            && existingPc.connectionState !== 'disconnected';
        if (!isHealthy) {
            console.log(`[WebRTC - ${this.userId}] checkAndReconnect: no active connection, sending peer-join`);
            await this.reconnect();
        }
    }

    public async reconnect() {
        if (this.isBroadcaster) return;
        console.log(`[WebRTC - ${this.userId}] Manual reconnect requested`);
        const existingPc = this.peerConnections.get('broadcaster');
        if (existingPc) {
            existingPc.close();
            this.peerConnections.delete('broadcaster');
        }
        this.pendingCandidates.delete('broadcaster');
        this.reconnectAttempts.delete('broadcaster');
        this._receivedTracks.clear();
        await this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId });
    }

    public retryPeer(peerId: string): void {
        const normalizedPeerId = (peerId || '').trim().toLowerCase();
        if (!normalizedPeerId) return;

        this.clearPeerFailure(normalizedPeerId);
        this.reconnectAttempts.delete(normalizedPeerId);
        this.attemptCounters.delete(normalizedPeerId);

        const existingPc = this.peerConnections.get(normalizedPeerId);
        if (existingPc) {
            existingPc.close();
            this.peerConnections.delete(normalizedPeerId);
        }
        this.pendingCandidates.delete(normalizedPeerId);

        if (this.isBroadcaster && this.localStream) {
            void this.createPeerConnection(normalizedPeerId);
            return;
        }

        if (!this.isBroadcaster) {
            void this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId });
        }
    }

    public async tryRestore1080p() {
        this.qualityTier = '1080p';
        this.hasDowngraded = false;
        this.resetQualityPressure();
        this.clearStoredTier();
        screenShareStore.setQualityTier('1080p', false);

        if (!this.localStream || !this.isBroadcaster) {
            return;
        }

        const videoTrack = this.localStream.getVideoTracks()[0];
        if (!videoTrack) return;

        try {
            await videoTrack.applyConstraints({
                width: { ideal: 1920, max: 1920 },
                height: { ideal: 1080, max: 1080 },
                frameRate: { ideal: 30, max: 30 },
            });
            await this.updateVideoSenderParameters(30);
            this.startQualityMonitoring();
        } catch (error) {
            console.warn('[ScreenShare] Failed to restore 1080p constraints:', error);
        }
    }

    private readStoredTier(): ScreenShareTier {
        if (typeof window === 'undefined') return '1080p';
        return localStorage.getItem(SCREENSHARE_TIER_STORAGE_KEY) === '720p' ? '720p' : '1080p';
    }

    private storeTier(tier: ScreenShareTier) {
        if (typeof window === 'undefined') return;
        localStorage.setItem(SCREENSHARE_TIER_STORAGE_KEY, tier);
    }

    private clearStoredTier() {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(SCREENSHARE_TIER_STORAGE_KEY);
    }

    private resetQualityPressure() {
        this.cpuPressureStreak = 0;
        this.fpsPressureStreak = 0;
        this.droppedPressureStreak = 0;
    }

    private startQualityMonitoring() {
        if (!this.isBroadcaster || !this.localStream || this.hasDowngraded) return;
        this.stopQualityMonitoring();
        this.statsInterval = setInterval(() => {
            this.collectAndEvaluateQualityStats().catch(() => { });
        }, QUALITY_MONITOR_INTERVAL_MS);
    }

    private stopQualityMonitoring() {
        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }
    }

    private async collectAndEvaluateQualityStats() {
        if (!this.isBroadcaster || !this.localStream || this.hasDowngraded) return;

        let cpuLimited = false;
        let lowFps = false;
        let highDroppedRatio = false;
        let hasVideoStats = false;

        const connectedPeers = Array.from(this.peerConnections.values()).filter(
            (pc) => pc.connectionState === 'connected'
        );

        for (const pc of connectedPeers) {
            const videoSender = pc.getSenders().find((sender) => sender.track?.kind === 'video');
            if (!videoSender) continue;

            const stats = await videoSender.getStats();
            stats.forEach((report) => {
                if (report.type !== 'outbound-rtp' || (report as any).kind !== 'video' || (report as any).isRemote) {
                    return;
                }
                hasVideoStats = true;

                const qualityReason = (report as any).qualityLimitationReason as string | undefined;
                const fps = Number((report as any).framesPerSecond ?? 0);
                const framesDropped = Number((report as any).framesDropped ?? 0);
                const framesEncoded = Number((report as any).framesEncoded ?? 0);
                const droppedRatio = framesEncoded > 0 ? framesDropped / framesEncoded : 0;

                if (qualityReason === 'cpu') cpuLimited = true;
                if (fps > 0 && fps < 18) lowFps = true;
                if (framesEncoded > 0 && droppedRatio > 0.15) highDroppedRatio = true;
            });
        }

        if (!hasVideoStats) return;

        this.cpuPressureStreak = cpuLimited ? this.cpuPressureStreak + 1 : 0;
        this.fpsPressureStreak = !cpuLimited && lowFps ? this.fpsPressureStreak + 1 : 0;
        this.droppedPressureStreak = !cpuLimited && !lowFps && highDroppedRatio ? this.droppedPressureStreak + 1 : 0;

        if (this.cpuPressureStreak >= QUALITY_PRESSURE_STREAK_TARGET) {
            await this.downgradeTo720p('cpu');
            return;
        }
        if (this.fpsPressureStreak >= QUALITY_PRESSURE_STREAK_TARGET) {
            await this.downgradeTo720p('fps');
            return;
        }
        if (this.droppedPressureStreak >= QUALITY_PRESSURE_STREAK_TARGET) {
            await this.downgradeTo720p('drop-rate');
        }
    }

    private async downgradeTo720p(reason: 'cpu' | 'fps' | 'drop-rate') {
        if (this.hasDowngraded || !this.localStream) return;
        const videoTrack = this.localStream.getVideoTracks()[0];
        if (!videoTrack) return;

        try {
            await videoTrack.applyConstraints({
                width: { ideal: 1280, max: 1280 },
                height: { ideal: 720, max: 720 },
                frameRate: { ideal: 24, max: 24 },
            });
        } catch (error) {
            console.warn('[ScreenShare] Failed to apply 720p downgrade constraints:', error);
            return;
        }

        this.qualityTier = '720p';
        this.hasDowngraded = true;
        this.storeTier('720p');
        this.resetQualityPressure();
        await this.updateVideoSenderParameters(24);
        this.stopQualityMonitoring();
        screenShareStore.setQualityTier('720p', true);
        console.warn(`[ScreenShare] Auto-downgrade activated (${reason}) -> 720p@24`);
    }

    private async updateVideoSenderParameters(maxFramerate: number) {
        const tasks = Array.from(this.peerConnections.values()).map(async (pc) => {
            const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
            if (!sender) return;

            try {
                const params = sender.getParameters();
                if (!params.encodings || params.encodings.length === 0) {
                    params.encodings = [{}];
                }
                params.encodings[0].maxFramerate = maxFramerate;
                params.encodings[0].priority = 'high';
                params.encodings[0].networkPriority = 'high';
                try {
                    if ('setDegradationPreference' in (sender as any)) {
                        (sender as any).setDegradationPreference('balanced');
                    }
                } catch (error) {
                    // Ignore unsupported browsers
                }
                await sender.setParameters(params);
            } catch (error) {
                console.warn('[ScreenShare] Could not update video sender parameters:', error);
            }
        });
        await Promise.all(tasks);
    }

    private getAdaptiveBitrate(): number {
        const peerCount = this.peerConnections.size;
        if (peerCount <= 2) return 1_800_000;
        if (peerCount <= 5) return 1_200_000;
        if (peerCount <= 8) return 900_000;
        return 600_000;
    }

    private getAdaptiveAudioBitrate(): number {
        const peerCount = this.peerConnections.size;
        if (peerCount <= 2) return 128_000;
        if (peerCount <= 5) return 96_000;
        if (peerCount <= 8) return 80_000;
        return 64_000;
    }
}
