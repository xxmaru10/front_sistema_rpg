import { getSocket } from "./socketClient";

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
    volume: number;
    muted: boolean;
    speaking: boolean;
    audioLevel: number;
    inVoice: boolean;
}

export interface SessionParticipant {
    userId: string;
    inVoice: boolean;
    characterId?: string;
}

interface SpeakingSnapshot {
    speaking: boolean;
    audioLevel: number;
}

interface LocalSpeakingSnapshot extends SpeakingSnapshot {
    audioStatus: AudioContextState | 'closed';
}

interface PeerSpeakingAnalyser {
    analyser: AnalyserNode;
    interval: ReturnType<typeof setInterval>;
}

const EMPTY_SPEAKING_SNAPSHOT: SpeakingSnapshot = Object.freeze({ speaking: false, audioLevel: 0 });
const DEBUG_VOICE_STORAGE_KEY = "debugVoiceChat";

type PeerUpdateCallback = (peers: VoicePeer[]) => void;
type PresenceUpdateCallback = (participants: SessionParticipant[]) => void;

export class VoiceChatManager {
    private sessionId: string;
    private userId: string;
    private localStream: MediaStream | null = null;
    private peerConnections: Map<string, RTCPeerConnection> = new Map();
    private peerStreams: Map<string, MediaStream> = new Map();
    private peerVolumes: Map<string, number> = new Map();
    private peerMuted: Map<string, boolean> = new Map();
    private peerAudioElements: Map<string, HTMLAudioElement> = new Map();
    private onPeerUpdate: PeerUpdateCallback;
    private onPresenceUpdate: PresenceUpdateCallback;
    private _micMuted: boolean = false;
    private _isConnected: boolean = false;

    private localAudioContext: AudioContext | null = null;
    private sharedPeerAudioContext: AudioContext | null = null;
    private audioNodes: Map<string, {
        source: MediaStreamAudioSourceNode;
        gain: GainNode;
        analyser: AnalyserNode;
        dest: MediaStreamAudioDestinationNode;
    }> = new Map();
    private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
    private speakingAnalysers: Map<string, PeerSpeakingAnalyser> = new Map();
    private speakingSnapshots: Map<string, SpeakingSnapshot> = new Map();
    private speakingListeners: Set<() => void> = new Set();
    private localSpeakingSnapshot: LocalSpeakingSnapshot = { speaking: false, audioLevel: 0, audioStatus: 'closed' };
    private localSpeakingInterval: ReturnType<typeof setInterval> | null = null;
    private _localSpeaking: boolean = false;
    private _localAudioLevel: number = 0;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private _micVolume: number = 1;
    private localGainNode: GainNode | null = null;
    private _sessionParticipants: SessionParticipant[] = [];
    private voicePeerIds: Set<string> = new Set();
    private reconnectAttempts: Map<string, number> = new Map();
    private pendingOfferFallbackTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private connectionSafetyTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
    private lastVoiceJoinBroadcastAt: number = 0;
    private lastDirectedVoiceJoinAt: Map<string, number> = new Map();
    private static readonly MAX_RECONNECT_ATTEMPTS = 3;
    private static readonly SCREEN_SHARE_PEER_DUCK_FACTOR = 0.35;
    private static readonly VOICE_JOIN_HEARTBEAT_MS = 30000;
    private static readonly VOICE_JOIN_THROTTLE_MS = 4000;
    private static readonly OFFER_FALLBACK_DELAY_MS = 5000;
    private static readonly CONNECTION_SAFETY_TIMEOUT_MS = 15000;
    private characterId?: string;
    private signalHandler: ((signal: VoiceSignal) => void) | null = null;
    private lastVoiceSeenAt: Map<string, number> = new Map();
    private static readonly PRESENCE_STALE_MS = 30000;
    private suppressPeerPlaybackForScreenShare: boolean = false;
    private screenShareAudioStateHandler: ((event: Event) => void) | null = null;
    private lastPeerSnapshot: VoicePeer[] = [];

    private rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
            { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
        ],
        iceTransportPolicy: 'all',
    };

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
    get audioContextState() { return this.localSpeakingSnapshot.audioStatus; }

    private shouldLogSignalTraffic(signalType: VoiceSignalType): boolean {
        return this.shouldDebugVoice() && signalType !== 'voice-ice-candidate';
    }

    private shouldDebugVoice(): boolean {
        if (process.env.NODE_ENV === "development") return true;
        if (typeof window === "undefined") return false;
        try {
            return window.localStorage?.getItem(DEBUG_VOICE_STORAGE_KEY) === "1";
        } catch {
            return false;
        }
    }

    private logDebug(message: string, ...args: unknown[]) {
        if (!this.shouldDebugVoice()) return;
        console.debug(message, ...args);
    }

    public subscribeSpeakingState(listener: () => void): () => void {
        this.speakingListeners.add(listener);
        return () => {
            this.speakingListeners.delete(listener);
        };
    }

    public getLocalSpeakingSnapshot(): LocalSpeakingSnapshot {
        return this.localSpeakingSnapshot;
    }

    public getPeerSpeakingSnapshot(peerId: string): SpeakingSnapshot {
        peerId = this.normUserId(peerId);
        return this.speakingSnapshots.get(peerId) ?? EMPTY_SPEAKING_SNAPSHOT;
    }

    private normUserId(id: string): string {
        return (id || '').trim().toLowerCase().normalize('NFC');
    }

    private isMobileDevice(): boolean {
        if (typeof navigator === 'undefined') return false;
        return navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
    }

    private touchVoiceSeen(userId: string) {
        this.lastVoiceSeenAt.set(this.normUserId(userId), Date.now());
    }

    private getLastVoiceSeen(userId: string): number {
        return this.lastVoiceSeenAt.get(this.normUserId(userId)) || 0;
    }

    private hasLivePeerConnectionForUser(userId: string): boolean {
        const target = this.normUserId(userId);
        for (const [peerId, pc] of this.peerConnections.entries()) {
            if (this.normUserId(peerId) !== target) continue;
            if (pc.connectionState === 'new' || pc.connectionState === 'connecting' || pc.connectionState === 'connected') {
                return true;
            }
        }
        return false;
    }

    private sanitizePresence(participants: SessionParticipant[]): SessionParticipant[] {
        const now = Date.now();
        const dedup = new Map<string, SessionParticipant>();

        for (const p of participants) {
            const key = this.normUserId(p.userId);
            const prev = dedup.get(key);
            if (!prev) {
                dedup.set(key, p);
                continue;
            }
            dedup.set(key, {
                userId: prev.userId.length >= p.userId.length ? prev.userId : p.userId,
                inVoice: prev.inVoice || p.inVoice,
                characterId: prev.characterId || p.characterId,
            });
        }

        return Array.from(dedup.values()).map((p) => {
            if (this.normUserId(p.userId) === this.normUserId(this.userId)) {
                return { ...p, inVoice: this._isConnected, characterId: p.characterId || this.characterId };
            }
            if (!p.inVoice) return p;

            const recentlySeen = (now - this.getLastVoiceSeen(p.userId)) <= VoiceChatManager.PRESENCE_STALE_MS;
            const hasLivePc = this.hasLivePeerConnectionForUser(p.userId);
            if (!recentlySeen && !hasLivePc) {
                return { ...p, inVoice: false };
            }
            return p;
        });
    }

    private isSameParticipants(prev: SessionParticipant[], next: SessionParticipant[]): boolean {
        if (prev.length !== next.length) return false;
        const sortByUserId = (a: SessionParticipant, b: SessionParticipant) =>
            this.normUserId(a.userId).localeCompare(this.normUserId(b.userId));
        const sortedPrev = [...prev].sort(sortByUserId);
        const sortedNext = [...next].sort(sortByUserId);
        for (let i = 0; i < sortedPrev.length; i += 1) {
            const a = sortedPrev[i];
            const b = sortedNext[i];
            if (this.normUserId(a.userId) !== this.normUserId(b.userId)) return false;
            if (a.inVoice !== b.inVoice) return false;
            if ((a.characterId || "") !== (b.characterId || "")) return false;
        }
        return true;
    }

    private isSamePeers(prev: VoicePeer[], next: VoicePeer[]): boolean {
        if (prev.length !== next.length) return false;
        const sortedPrev = [...prev].sort((a, b) => this.normUserId(a.peerId).localeCompare(this.normUserId(b.peerId)));
        const sortedNext = [...next].sort((a, b) => this.normUserId(a.peerId).localeCompare(this.normUserId(b.peerId)));
        for (let i = 0; i < sortedPrev.length; i += 1) {
            const a = sortedPrev[i];
            const b = sortedNext[i];
            if (this.normUserId(a.peerId) !== this.normUserId(b.peerId)) return false;
            if (a.stream !== b.stream) return false;
            if (a.muted !== b.muted) return false;
            if (Math.abs(a.volume - b.volume) > 0.001) return false;
            if (a.inVoice !== b.inVoice) return false;
        }
        return true;
    }

    private emitPresenceUpdateIfChanged(participants: SessionParticipant[]) {
        const sanitized = this.sanitizePresence(participants);
        if (this.isSameParticipants(this._sessionParticipants, sanitized)) return;
        this._sessionParticipants = sanitized;
        this.onPresenceUpdate(sanitized);
    }

    private emitVoicePresence(inVoice: boolean = this._isConnected) {
        const socket = getSocket(this.userId);
        socket.emit("voice-presence", {
            sessionId: this.sessionId,
            userId: this.userId,
            characterId: this.characterId,
            inVoice,
        });
        this.touchVoiceSeen(this.userId);
    }

    // ─── Audio helpers ─────────────────────────────────────────

    private getLocalAudioContext(): AudioContext {
        if (typeof window === 'undefined') return {} as AudioContext;
        if (!this.localAudioContext) {
            this.localAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
            this.localAudioContext.onstatechange = () => {
                this.updateLocalSpeakingSnapshot(
                    this.localSpeakingSnapshot.speaking,
                    this.localSpeakingSnapshot.audioLevel,
                    this.localAudioContext?.state || 'closed'
                );
            };
            this.updateLocalSpeakingSnapshot(false, 0, this.localAudioContext.state);
        }
        return this.localAudioContext!;
    }

    private getSharedPeerAudioContext(): AudioContext {
        if (typeof window === 'undefined') return {} as AudioContext;
        if (!this.sharedPeerAudioContext || this.sharedPeerAudioContext.state === 'closed') {
            this.sharedPeerAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
        }
        return this.sharedPeerAudioContext;
    }

    private getPreferredAudioConstraints(deviceId?: string): MediaTrackConstraints {
        return {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: { ideal: 1 },
        };
    }

    private getFallbackAudioConstraints(deviceId?: string): MediaTrackConstraints {
        return {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            echoCancellation: true,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: { ideal: 1 },
        };
    }

    private isBluetoothDeviceLabel(label: string): boolean {
        const v = (label || '').toLowerCase();
        return v.includes('bluetooth') || v.includes('hands-free') || v.includes('hands free') || v.includes('hfp') || v.includes('airpods');
    }

    private async resolveInputDeviceId(deviceId?: string, respectRequested: boolean = false): Promise<string | undefined> {
        // Em mobile, o mic do sistema já é o correto — não substituir automaticamente
        if (this.isMobileDevice()) return deviceId;
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
            return deviceId;
        }

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const inputs = devices.filter(d => d.kind === 'audioinput' && !!d.deviceId);
            if (inputs.length === 0) return deviceId;

            if (deviceId) {
                const requested = inputs.find(d => d.deviceId === deviceId);
                if (!requested) return deviceId;
                if (respectRequested || !this.isBluetoothDeviceLabel(requested.label)) {
                    return requested.deviceId;
                }

                const fallback = inputs.find(d => !this.isBluetoothDeviceLabel(d.label));
                if (fallback?.deviceId) {
                    console.warn(`[VoiceChat] Bluetooth mic auto-avoided for quality. Requested "${requested.label}", using "${fallback.label}"`);
                    return fallback.deviceId;
                }
                return requested.deviceId;
            }

            const preferred = inputs.find(d => !this.isBluetoothDeviceLabel(d.label));
            return preferred?.deviceId || inputs[0]?.deviceId;
        } catch {
            return deviceId;
        }
    }

    private async tryUpgradeFromBluetoothStream(
        stream: MediaStream,
        respectRequested: boolean = false
    ): Promise<MediaStream> {
        // Em mobile, não tentar trocar o mic — o device do sistema já é o correto
        if (respectRequested || this.isMobileDevice()) return stream;
        const track = stream.getAudioTracks()[0];
        const currentLabel = track?.label || "";
        if (!track || !this.isBluetoothDeviceLabel(currentLabel)) return stream;
        if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) return stream;

        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const fallback = devices.find(
                d => d.kind === 'audioinput' && !!d.deviceId && !this.isBluetoothDeviceLabel(d.label)
            );
            if (!fallback?.deviceId) return stream;

            let upgraded: MediaStream | null = null;
            try {
                upgraded = await navigator.mediaDevices.getUserMedia({
                    audio: this.getPreferredAudioConstraints(fallback.deviceId),
                });
            } catch {
                upgraded = await navigator.mediaDevices.getUserMedia({
                    audio: this.getFallbackAudioConstraints(fallback.deviceId),
                });
            }

            if (upgraded) {
                stream.getTracks().forEach(t => t.stop());
                console.warn(`[VoiceChat] Bluetooth mic auto-avoided after permission. Using "${fallback.label}" instead of "${currentLabel}"`);
                return upgraded;
            }
            return stream;
        } catch {
            return stream;
        }
    }

    private isOffererAgainst(peerId: string): boolean {
        return this.normUserId(this.userId) < this.normUserId(peerId);
    }

    private clearPendingOfferFallback(peerId: string) {
        const key = this.normUserId(peerId);
        const timer = this.pendingOfferFallbackTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.pendingOfferFallbackTimers.delete(key);
        }
    }

    private clearConnectionSafetyTimer(peerId: string) {
        const key = this.normUserId(peerId);
        const timer = this.connectionSafetyTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.connectionSafetyTimers.delete(key);
        }
    }

    private scheduleConnectionSafety(peerId: string, pc: RTCPeerConnection) {
        const key = this.normUserId(peerId);
        this.clearConnectionSafetyTimer(key);
        const timer = setTimeout(() => {
            if (this.peerConnections.get(key) !== pc) return;
            if (pc.connectionState === 'new' || pc.connectionState === 'connecting') {
                console.warn(`[VoiceChat] Safety timeout: closing stuck connection for ${key}`);
                pc.close();
                this.peerConnections.delete(key);
                this.scheduleReconnect(key, 'safety-timeout');
            }
        }, VoiceChatManager.CONNECTION_SAFETY_TIMEOUT_MS);
        this.connectionSafetyTimers.set(key, timer);
    }

    private async sendVoiceJoin(targetPeerId?: string, force: boolean = false) {
        const now = Date.now();
        const selfPeerId = this.normUserId(this.userId);

        if (targetPeerId) {
            const key = this.normUserId(targetPeerId);
            const last = this.lastDirectedVoiceJoinAt.get(key) || 0;
            if (!force && now - last < VoiceChatManager.VOICE_JOIN_THROTTLE_MS) {
                return;
            }
            this.lastDirectedVoiceJoinAt.set(key, now);
            await this.sendSignal({ type: 'voice-join', from: this.userId, to: key, peerId: selfPeerId });
            return;
        }

        if (!force && now - this.lastVoiceJoinBroadcastAt < VoiceChatManager.VOICE_JOIN_THROTTLE_MS) {
            return;
        }
        this.lastVoiceJoinBroadcastAt = now;
        await this.sendSignal({ type: 'voice-join', from: this.userId, peerId: selfPeerId });
    }

    private scheduleAnswererFallbackJoin(peerId: string) {
        const key = this.normUserId(peerId);
        if (this.pendingOfferFallbackTimers.has(key)) return;

        const timer = setTimeout(() => {
            this.pendingOfferFallbackTimers.delete(key);
            if (!this._isConnected || !this.localStream) return;

            const pc = this.peerConnections.get(key);
            const alreadyHealthy = !!pc && (pc.connectionState === 'connected' || pc.connectionState === 'connecting');
            if (!alreadyHealthy) {
                this.sendVoiceJoin(key).catch(() => { });
            }
        }, VoiceChatManager.OFFER_FALLBACK_DELAY_MS);

        this.pendingOfferFallbackTimers.set(key, timer);
    }

    private scheduleReconnect(peerId: string, reason: string) {
        const key = this.normUserId(peerId);
        const attempts = this.reconnectAttempts.get(key) || 0;
        if (attempts >= VoiceChatManager.MAX_RECONNECT_ATTEMPTS) {
            console.warn(`[VoiceChat] Max reconnect attempts reached for ${key} (${reason})`);
            return;
        }
        if (!this._isConnected || !this.localStream) return;

        this.reconnectAttempts.set(key, attempts + 1);
        const delay = Math.min(8000, 2000 * (attempts + 1));

        this.logDebug(`[VoiceChat] Reconnecting to ${key} (${reason}) attempt ${attempts + 1}/${VoiceChatManager.MAX_RECONNECT_ATTEMPTS}`);
        setTimeout(() => {
            if (!this._isConnected || !this.localStream) return;
            const current = this.peerConnections.get(key);
            if (current && (current.connectionState === 'connected' || current.connectionState === 'connecting')) {
                return;
            }

            if (this.isOffererAgainst(key)) {
                this.createPeerConnection(key, true).catch(console.error);
            } else {
                this.sendVoiceJoin(key).catch(() => { });
            }
        }, delay);
    }

    private updatePeerAudioOutputState() {
        this.peerAudioElements.forEach((audioEl, peerId) => {
            const userMuted = this.peerMuted.get(peerId) ?? false;
            // Permite 0..2 (200%) — gain > 1 amplifica acima do nível original
            const desiredVolume = Math.max(0, Math.min(2, this.peerVolumes.get(peerId) ?? 1));
            const duckingMultiplier = this.suppressPeerPlaybackForScreenShare
                ? VoiceChatManager.SCREEN_SHARE_PEER_DUCK_FACTOR
                : 1;
            const effectiveGain = userMuted ? 0 : desiredVolume * duckingMultiplier;

            // Aplica o gain via GainNode (0..2); audioEl.volume fica em 1 fixo.
            // O GainNode está no caminho de playback (source→gain→dest→audioEl.srcObject).
            const nodes = this.audioNodes.get(peerId);
            if (nodes) {
                const ctx = this.getSharedPeerAudioContext();
                nodes.gain.gain.setTargetAtTime(effectiveGain, ctx.currentTime, 0.05);
            }

            audioEl.muted = userMuted;
            audioEl.volume = 1;
            if (audioEl.srcObject && audioEl.paused) {
                audioEl.play().catch(e => console.warn('[VoiceChat] Audio play failed:', e));
            }
        });
    }

    private attachScreenShareLoopbackGuard() {
        if (typeof window === 'undefined') return;
        if (this.screenShareAudioStateHandler) return;

        this.screenShareAudioStateHandler = (event: Event) => {
            const custom = event as CustomEvent<{ active?: boolean }>;
            this.suppressPeerPlaybackForScreenShare = !!custom.detail?.active;
            this.updatePeerAudioOutputState();
        };

        window.addEventListener('screenshare:broadcast-audio', this.screenShareAudioStateHandler);
    }

    private detachScreenShareLoopbackGuard() {
        if (typeof window === 'undefined') return;
        if (!this.screenShareAudioStateHandler) return;

        window.removeEventListener('screenshare:broadcast-audio', this.screenShareAudioStateHandler);
        this.screenShareAudioStateHandler = null;
        this.suppressPeerPlaybackForScreenShare = false;
    }

    private async getBestEffortMicStream(deviceId?: string, respectRequested: boolean = false): Promise<MediaStream> {
        const resolvedDeviceId = await this.resolveInputDeviceId(deviceId, respectRequested);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: this.getPreferredAudioConstraints(resolvedDeviceId),
            });
            return await this.tryUpgradeFromBluetoothStream(stream, respectRequested);
        } catch (preferredError) {
            console.warn("[VoiceChat] Preferred mic constraints failed, trying fallback:", preferredError);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: this.getFallbackAudioConstraints(resolvedDeviceId),
                });
                return await this.tryUpgradeFromBluetoothStream(stream, respectRequested);
            } catch (fallbackError) {
                // Device ID stale ou inválido — tenta sem deviceId (usa default do sistema)
                if (resolvedDeviceId) {
                    console.warn("[VoiceChat] Device ID inválido/stale, tentando sem deviceId:", fallbackError);
                    const stream = await navigator.mediaDevices.getUserMedia({
                        audio: this.getFallbackAudioConstraints(undefined),
                    });
                    return await this.tryUpgradeFromBluetoothStream(stream, respectRequested);
                }
                throw fallbackError;
            }
        }
    }

    private async tuneAudioSenders(pc: RTCPeerConnection) {
        const senders = pc.getSenders().filter(s => s.track?.kind === 'audio');
        for (const sender of senders) {
            const track = sender.track;
            if (track) {
                try {
                    track.contentHint = 'speech';
                } catch (_) { }
            }
            try {
                const params = sender.getParameters();
                if (!params.encodings || params.encodings.length === 0) {
                    params.encodings = [{}];
                }
                const peersInMesh = Math.max(1, this.peerConnections.size);
                const targetBitrate = peersInMesh >= 10 ? 52000 : peersInMesh >= 6 ? 56000 : 64000;
                params.encodings[0].maxBitrate = targetBitrate;
                params.encodings[0].priority = 'high';
                (params.encodings[0] as any).networkPriority = 'high';
                (params.encodings[0] as any).dtx = "disabled";
                (params.encodings[0] as any).ptime = 20;
                await sender.setParameters(params);
            } catch (e) {
                console.warn("[VoiceChat] Could not tune audio sender params:", e);
            }
        }
    }

    // ─── Initialize ────────────────────────────────────────────

    public async initialize() {
        const socket = getSocket(this.userId);
        this.attachScreenShareLoopbackGuard();

        // Remove previous handler if reinitializing
        if (this.signalHandler) {
            socket.off('webrtc-signal', this.signalHandler);
        }

        this.signalHandler = (signal: VoiceSignal) => {
            // Ignore own signals
            if (this.normUserId(signal.from) === this.normUserId(this.userId)) return;
            // Ignore signals directed to someone else
            if (signal.to && this.normUserId(signal.to) !== this.normUserId(this.userId)) return;
            // Ignore non-voice signals
            if (!signal.type?.startsWith('voice-')) return;

            if (this.shouldLogSignalTraffic(signal.type)) {
                this.logDebug(`[VoiceChat - ${this.userId}] Signal received:`, signal.type, "from:", signal.from);
            }
            this.handleSignal(signal);
        };

        socket.on('webrtc-signal', this.signalHandler);

        // Handle presence updates from server
        socket.off('voice-presence-update');
        socket.on('voice-presence-update', (participants: SessionParticipant[]) => {
            this.emitPresenceUpdateIfChanged(participants);
        });

        // Announce presence
        this.emitVoicePresence(this._isConnected);
    }

    // ─── Signal sending ────────────────────────────────────────

    private async sendSignal(signal: VoiceSignal) {
        const socket = getSocket(this.userId);
        if (this.shouldLogSignalTraffic(signal.type)) {
            this.logDebug(`[VoiceChat - ${this.userId}] Sending signal:`, signal.type, "->", signal.to ?? "broadcast");
        }

        // Always broadcast to session room — receiver filters by signal.to
        // Direct userId routing is unreliable due to userId format differences across devices
        socket.emit('webrtc-signal', {
            sessionId: this.sessionId,
            signal,
        });
    }

    // ─── Join / Leave ──────────────────────────────────────────

    public async joinVoice(deviceId?: string): Promise<boolean> {
        if (this._isConnected && this.localStream) {
            return true;
        }
        try {
            let stream = await this.getBestEffortMicStream(deviceId);

            // Guarda de stream health: track morto/desabilitado → fallback simples
            const track = stream.getAudioTracks()[0];
            this.logDebug(`[VoiceChat] Track capturada — readyState: ${track?.readyState}, enabled: ${track?.enabled}, label: "${track?.label}"`);
            if (!track || track.readyState !== 'live') {
                console.warn('[VoiceChat] Track não-live após getUserMedia — tentando fallback simples');
                stream.getTracks().forEach(t => t.stop());
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            }
            this.localStream = stream;

            const audioCtx = this.getLocalAudioContext();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume().catch(console.warn);
                // Retry com 500ms se ainda suspended (comportamento mobile)
                if (audioCtx.state === 'suspended') {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await audioCtx.resume().catch(console.warn);
                }
            }
            this.updateLocalSpeakingSnapshot(false, 0, audioCtx.state);

            this._isConnected = true;
            this._micMuted = false;
            this.voicePeerIds.add(this.normUserId(this.userId));

            // Update presence to inVoice: true
            this.emitVoicePresence(true);

            this.startLocalSpeakingDetection();

            // Announce to peers
            await this.sendVoiceJoin(undefined, true);

            // Presence heartbeat (sem voice-join broadcast recorrente em idle)
            if (this.heartbeatInterval) {
                clearInterval(this.heartbeatInterval);
            }
            this.heartbeatInterval = setInterval(() => {
                if (this._isConnected) {
                    this.emitVoicePresence(true);
                }
            }, VoiceChatManager.VOICE_JOIN_HEARTBEAT_MS);

            this.notifyPeerUpdate();
            return true;
        } catch (error) {
            console.error("[VoiceChat] Failed to get mic:", error);
            return false;
        }
    }

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
        if (this.sharedPeerAudioContext) {
            this.sharedPeerAudioContext.close().catch(() => {});
            this.sharedPeerAudioContext = null;
        }

        this.sendSignal({ type: 'voice-leave', from: this.userId, peerId: this.userId });

        this._isConnected = false;
        this._micMuted = false;
        this._localSpeaking = false;
        this._localAudioLevel = 0;
        this.updateLocalSpeakingSnapshot(false, 0, 'closed');
        this.voicePeerIds.delete(this.normUserId(this.userId));
        this.pendingOfferFallbackTimers.forEach((timer) => clearTimeout(timer));
        this.pendingOfferFallbackTimers.clear();
        this.connectionSafetyTimers.forEach((timer) => clearTimeout(timer));
        this.connectionSafetyTimers.clear();
        this.lastDirectedVoiceJoinAt.clear();
        this.lastVoiceJoinBroadcastAt = 0;

        this.emitVoicePresence(false);

        this.cleanupAllPeers();
        this.notifyPeerUpdate();
    }

    // ─── Local controls ────────────────────────────────────────

    public setMicMuted(muted: boolean) {
        this._micMuted = muted;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(t => { t.enabled = !muted; });
        }
        if (muted) {
            this._localSpeaking = false;
            this._localAudioLevel = 0;
            this.updateLocalSpeakingSnapshot(false, 0);
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

    public async setMicDevice(deviceId: string) {
        if (!this._isConnected) return;

        try {
            // Mesmo em troca manual de device, tenta evitar HFP/Bluetooth quando houver alternativa.
            const newStream = await this.getBestEffortMicStream(deviceId, false);

            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
            }

            const newTrack = newStream.getAudioTracks()[0];
            if (newTrack) {
                try {
                    newTrack.contentHint = 'speech';
                } catch (_) { }
            }
            this.localStream = newStream;

            // Replace track in all peer connections
            const replacements = Array.from(this.peerConnections.entries()).map(async ([peerId, pc]) => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
                if (sender) {
                    await sender.replaceTrack(newTrack);
                }
            });

            await Promise.all(replacements);

            const tunePromises = Array.from(this.peerConnections.values()).map(pc => this.tuneAudioSenders(pc));
            await Promise.all(tunePromises);

            // Re-setup local analysis
            if (this.localSpeakingInterval) {
                clearInterval(this.localSpeakingInterval);
                this.localSpeakingInterval = null;
            }
            this.startLocalSpeakingDetection();
            this.setMicMuted(this._micMuted);
            this.touchVoiceSeen(this.userId);

            this.logDebug(`[VoiceChat - ${this.userId}] Mic device changed to:`, deviceId);
        } catch (e) {
            console.error('[VoiceChat] Failed to change mic device:', e);
        }
    }

    public async setOutputDevice(deviceId: string) {
        const results = await Promise.allSettled(
            Array.from(this.peerAudioElements.values()).map(async (el) => {
                if ((el as any).setSinkId) {
                    await (el as any).setSinkId(deviceId);
                }
            })
        );
        const failed = results.filter(r => r.status === 'rejected');
        if (failed.length) {
            failed.forEach(r => console.warn('[VoiceChat] setSinkId failed on a peer element:', (r as PromiseRejectedResult).reason));
        } else {
            this.logDebug(`[VoiceChat - ${this.userId}] Output device changed to:`, deviceId);
        }
    }

    public setPeerVolume(peerId: string, volume: number) {
        peerId = this.normUserId(peerId);
        const clampedVol = Math.max(0, Math.min(2, volume));
        this.peerVolumes.set(peerId, clampedVol);
        const gainNode = this.audioNodes.get(peerId)?.gain;
        if (gainNode) {
            const ctx = this.getSharedPeerAudioContext();
            gainNode.gain.setTargetAtTime(clampedVol, ctx.currentTime, 0.1);
        }
        this.updatePeerAudioOutputState();
        this.notifyPeerUpdate();
    }

    public setPeerMuted(peerId: string, muted: boolean) {
        peerId = this.normUserId(peerId);
        const prevMuted = this.peerMuted.get(peerId) ?? false;
        this.peerMuted.set(peerId, muted);
        if (prevMuted !== muted) {
            if (muted) {
                this.stopPeerSpeakingDetection(peerId);
                this.updatePeerSpeakingSnapshot(peerId, false, 0);
            } else {
                const stream = this.peerStreams.get(peerId);
                if (stream) {
                    this.startPeerSpeakingDetection(peerId, stream);
                }
            }
        }
        this.updatePeerAudioOutputState();
        this.notifyPeerUpdate();
    }

    // ─── Peer state ────────────────────────────────────────────

    public getActivePeers(): VoicePeer[] {
        const peers: VoicePeer[] = [];
        this.peerConnections.forEach((_, peerId) => {
            peers.push({
                peerId,
                stream: this.peerStreams.get(peerId) || null,
                volume: this.peerVolumes.get(peerId) ?? 1,
                muted: this.peerMuted.get(peerId) ?? false,
                speaking: false,
                audioLevel: 0,
                inVoice: true,
            });
        });
        return peers;
    }

    private notifyPeerUpdate() {
        const nextPeers = this.getActivePeers();
        if (this.isSamePeers(this.lastPeerSnapshot, nextPeers)) return;
        this.lastPeerSnapshot = nextPeers;
        this.onPeerUpdate(nextPeers);
    }

    private notifySpeakingUpdate() {
        this.speakingListeners.forEach((listener) => listener());
    }

    private updateLocalSpeakingSnapshot(
        speaking: boolean,
        audioLevel: number,
        audioStatus: AudioContextState | 'closed' = this.localAudioContext?.state || 'closed'
    ) {
        const normalizedLevel = Math.max(0, Math.min(1, audioLevel));
        const prev = this.localSpeakingSnapshot;
        const levelChanged = Math.abs(prev.audioLevel - normalizedLevel) > 0.03;
        if (!levelChanged && prev.speaking === speaking && prev.audioStatus === audioStatus) {
            return;
        }

        this.localSpeakingSnapshot = {
            speaking,
            audioLevel: normalizedLevel,
            audioStatus,
        };
        this.notifySpeakingUpdate();
    }

    private updatePeerSpeakingSnapshot(peerId: string, speaking: boolean, audioLevel: number) {
        peerId = this.normUserId(peerId);
        const normalizedLevel = Math.max(0, Math.min(1, audioLevel));
        const prev = this.speakingSnapshots.get(peerId) ?? EMPTY_SPEAKING_SNAPSHOT;
        const levelChanged = Math.abs(prev.audioLevel - normalizedLevel) > 0.03;
        if (!levelChanged && prev.speaking === speaking) {
            return;
        }

        this.speakingSnapshots.set(peerId, { speaking, audioLevel: normalizedLevel });
        this.notifySpeakingUpdate();
    }

    // ─── Disconnect ────────────────────────────────────────────

    public disconnect() {
        this.leaveVoice();
        const socket = getSocket(this.userId);
        if (this.signalHandler) {
            socket.off('webrtc-signal', this.signalHandler);
            this.signalHandler = null;
        }
        socket.off('voice-presence-update');
        this.detachScreenShareLoopbackGuard();
    }

    /**
     * Soft reconnect: re-announces presence and reconnects failed peers WITHOUT
     * dropping the active voice session. Safe to call during screen share restarts
     * or UI refreshes that should not interrupt the call.
     */
    public softReconnect() {
        const socket = getSocket(this.userId);

        // Re-register presence handler in case it was inadvertently removed
        socket.off('voice-presence-update');
        socket.on('voice-presence-update', (participants: SessionParticipant[]) => {
            this.emitPresenceUpdateIfChanged(participants);
        });

        // Re-announce our presence so late-joiners and stale state is refreshed
        this.emitVoicePresence(this._isConnected);

        if (this._isConnected && this.localStream) {
            // Drop failed/closed peer connections so they can be re-established
            const toRemove: string[] = [];
            this.peerConnections.forEach((pc, peerId) => {
                if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
                    toRemove.push(peerId);
                }
            });
            toRemove.forEach(peerId => this.removePeer(peerId));

            // Re-broadcast voice-join so peers re-negotiate if needed
            this.sendVoiceJoin(undefined, true).catch(() => {});
        }

        this.notifyPeerUpdate();
        this.logDebug(`[VoiceChat - ${this.userId}] softReconnect - connected=${this._isConnected}, peers=${this.peerConnections.size}`);
    }

    // ─── Cleanup ───────────────────────────────────────────────

    private cleanupAllPeers() {
        this.speakingAnalysers.forEach(({ interval }) => clearInterval(interval));
        this.speakingAnalysers.clear();
        this.speakingSnapshots.clear();
        this.notifySpeakingUpdate();
        this.pendingOfferFallbackTimers.forEach((timer) => clearTimeout(timer));
        this.pendingOfferFallbackTimers.clear();
        this.connectionSafetyTimers.forEach((timer) => clearTimeout(timer));
        this.connectionSafetyTimers.clear();

        this.peerAudioElements.forEach(el => { el.pause(); el.srcObject = null; });
        this.peerAudioElements.clear();

        this.audioNodes.forEach(nodes => {
            nodes.source.disconnect();
            nodes.gain.disconnect();
            nodes.analyser.disconnect();
            nodes.dest.disconnect();
        });
        this.audioNodes.clear();

        if (this.sharedPeerAudioContext) {
            this.sharedPeerAudioContext.close().catch(() => {});
            this.sharedPeerAudioContext = null;
        }

        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();

        this.peerStreams.clear();
        this.peerVolumes.clear();
        this.peerMuted.clear();
        this.pendingCandidates.clear();
        this.voicePeerIds.clear();
    }

    private removePeer(peerId: string) {
        const key = this.normUserId(peerId);
        this.clearPendingOfferFallback(key);
        this.clearConnectionSafetyTimer(key);
        this.stopPeerSpeakingDetection(key);
        this.speakingSnapshots.delete(key);
        this.notifySpeakingUpdate();

        const audioEl = this.peerAudioElements.get(key);
        if (audioEl) { audioEl.pause(); audioEl.srcObject = null; this.peerAudioElements.delete(key); }

        const nodes = this.audioNodes.get(key);
        if (nodes) { nodes.source.disconnect(); nodes.gain.disconnect(); nodes.analyser.disconnect(); nodes.dest.disconnect(); this.audioNodes.delete(key); }

        const pc = this.peerConnections.get(key);
        if (pc) { pc.close(); this.peerConnections.delete(key); }

        this.peerStreams.delete(key);
        this.peerVolumes.delete(key);
        this.peerMuted.delete(key);
        this.pendingCandidates.delete(key);
        this.notifyPeerUpdate();
    }

    // ─── Speaking detection ────────────────────────────────────

    private stopPeerSpeakingDetection(peerId: string) {
        const existingAnalyser = this.speakingAnalysers.get(peerId);
        if (existingAnalyser) {
            clearInterval(existingAnalyser.interval);
            this.speakingAnalysers.delete(peerId);
        }
    }

    private startLocalSpeakingDetection() {
        if (!this.localStream) return;
        try {
            const audioCtx = this.getLocalAudioContext();
            const source = audioCtx.createMediaStreamSource(this.localStream);
            const gainNode = audioCtx.createGain();
            gainNode.gain.setTargetAtTime(this._micVolume, audioCtx.currentTime, 0.01);
            this.localGainNode = gainNode;
            source.connect(gainNode);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            gainNode.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const intervalMs = this.isMobileDevice() ? 600 : 400;
            this.localSpeakingInterval = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                this._localAudioLevel = Math.min(1, avg / 80);
                this._localSpeaking = avg > 11;
                this.updateLocalSpeakingSnapshot(this._localSpeaking, this._localAudioLevel);
            }, intervalMs);
        } catch (e) {
            console.warn('[VoiceChat] Could not start local speaking detection:', e);
        }
    }

    private startPeerSpeakingDetection(peerId: string, stream: MediaStream) {
        try {
            if (this.peerMuted.get(peerId) === true) {
                this.stopPeerSpeakingDetection(peerId);
                this.updatePeerSpeakingSnapshot(peerId, false, 0);
                return;
            }

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

            const audioCtx = this.getSharedPeerAudioContext();
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(e => console.warn('[VoiceChat] Auto-resume AudioContext failed:', e));
            }

            const source = audioCtx.createMediaStreamSource(stream);
            const gainNode = audioCtx.createGain();
            const currentVolume = Math.max(0, Math.min(2, this.peerVolumes.get(peerId) ?? 1));
            const isMutedNow = this.peerMuted.get(peerId) ?? false;
            gainNode.gain.setValueAtTime(isMutedNow ? 0 : currentVolume, audioCtx.currentTime);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            // dest permite amplificação via gain > 1 (até 200%) antes de chegar ao audioEl
            const dest = audioCtx.createMediaStreamDestination();
            source.connect(gainNode);
            gainNode.connect(analyser);
            gainNode.connect(dest);
            this.audioNodes.set(peerId, { source, gain: gainNode, analyser, dest });

            const audioEl = this.peerAudioElements.get(peerId);
            if (audioEl) {
                audioEl.srcObject = dest.stream;
                this.updatePeerAudioOutputState();
            }

            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            const intervalMs = this.isMobileDevice() ? 600 : 400;
            const interval = setInterval(() => {
                if (this.peerMuted.get(peerId) === true) {
                    this.updatePeerSpeakingSnapshot(peerId, false, 0);
                    return;
                }
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                this.updatePeerSpeakingSnapshot(peerId, avg > 11, Math.min(1, avg / 80));
            }, intervalMs);

            this.speakingAnalysers.set(peerId, { analyser, interval });
            this.updatePeerSpeakingSnapshot(peerId, false, 0);
        } catch (e) {
            console.warn('[VoiceChat] Could not start peer speaking detection:', e);
        }
    }

    // ─── Signal handling ───────────────────────────────────────

    private async handleSignal(signal: VoiceSignal) {
        const type = signal.type;
        const from = this.normUserId(signal.from);

        if (type === 'voice-leave') {
            if (from === this.normUserId(this.userId)) return;
            this.voicePeerIds.delete(from);
            this.lastVoiceSeenAt.delete(this.normUserId(from));
            this.clearPendingOfferFallback(from);
            this.removePeer(from);
            return;
        }

        if (type === 'voice-join') {
            if (from === this.normUserId(this.userId)) return;

            // Guard: don't reconnect to already-connected peers
            const existingPc = this.peerConnections.get(from);
            if (existingPc
                && (existingPc.connectionState === 'new'
                    || existingPc.connectionState === 'connecting'
                    || existingPc.connectionState === 'connected')) {
                this.logDebug(`[VoiceChat - ${this.userId}] voice-join from ${from} ignored — already ${existingPc.connectionState}`);
                return;
            }

            // Guard: if already tracking this peer and we're the answerer,
            // don't keep ping-ponging — only the offerer drives reconnection
            if (this.voicePeerIds.has(from) && this._isConnected && this.localStream) {
                const isOfferer = this.isOffererAgainst(from);
                if (!isOfferer) {
                    this.logDebug(`[VoiceChat - ${this.userId}] voice-join from ${from} — already tracking, answerer skipping re-ping`);
                    return;
                }
            }

            this.removePeer(from);
            this.voicePeerIds.add(from);
            this.touchVoiceSeen(from);

            if (!this._isConnected || !this.localStream) return;

            if (this.isOffererAgainst(from)) {
                // Deterministic: smaller userId is always the offerer
                this.logDebug(`[VoiceChat - ${this.userId}] I am offerer → creating offer for:`, from);
                await this.createPeerConnection(from, true);
            } else {
                // Answerer: espera passiva para evitar loop ping-pong de voice-join.
                this.logDebug(`[VoiceChat - ${this.userId}] I am answerer → waiting offer from:`, from);
                this.scheduleAnswererFallbackJoin(from);
            }
            return;
        }

        if (type === 'voice-offer' && signal.offer) {
            if (!this._isConnected || !this.localStream) {
                this.logDebug(`[VoiceChat - ${this.userId}] Offer from ${from} dropped - not connected`);
                return;
            }
            const existing = this.peerConnections.get(from);
            if (
                existing &&
                (existing.connectionState === 'connected' || existing.connectionState === 'connecting') &&
                existing.signalingState === 'stable'
            ) {
                this.logDebug(`[VoiceChat - ${this.userId}] Duplicate offer ignored — ${from} connection already healthy`);
                return;
            }
            this.clearPendingOfferFallback(from);
            this.touchVoiceSeen(from);
            await this.handleOffer(signal);
            return;
        }

        if (type === 'voice-answer' && signal.answer) {
            this.touchVoiceSeen(from);
            await this.handleAnswer(signal);
            return;
        }

        if (type === 'voice-ice-candidate' && signal.candidate) {
            this.touchVoiceSeen(from);
            const pc = this.peerConnections.get(from);
            if (pc) {
                if (pc.remoteDescription) {
                    pc.addIceCandidate(new RTCIceCandidate(signal.candidate)).catch(console.error);
                } else {
                    if (!this.pendingCandidates.has(from)) this.pendingCandidates.set(from, []);
                    this.pendingCandidates.get(from)!.push(signal.candidate);
                }
            }
        }
    }

    // ─── Peer connection ───────────────────────────────────────

    private async createPeerConnection(peerId: string, createOffer: boolean) {
        peerId = this.normUserId(peerId);
        if (peerId === this.normUserId(this.userId)) {
            console.warn('[VoiceChat] Blocked self-connection attempt');
            return new RTCPeerConnection(this.rtcConfig);
        }

        if (this.peerConnections.has(peerId)) {
            this.peerConnections.get(peerId)?.close();
        }
        this.clearConnectionSafetyTimer(peerId);

        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(peerId, pc);
        this.scheduleConnectionSafety(peerId, pc);

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                try {
                    if (track.kind === 'audio') track.contentHint = 'speech';
                } catch (_) { }
                if (this.localStream) pc.addTrack(track, this.localStream);
            });
        }

        this.tuneAudioSenders(pc).catch(() => {});

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.sendSignal({
                    type: 'voice-ice-candidate',
                    from: this.userId,
                    to: peerId,
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        pc.ontrack = (event) => {
            this.logDebug(`[VoiceChat - ${this.userId}] Received audio track from:`, peerId);
            if (event.track.kind !== 'audio') return;

            const stream = event.streams?.[0] || new MediaStream([event.track]);
            this.peerStreams.set(peerId, stream);
            this.touchVoiceSeen(peerId);

            let audioEl = this.peerAudioElements.get(peerId);
            if (!audioEl) {
                audioEl = new Audio();
                audioEl.autoplay = true;
                this.peerAudioElements.set(peerId, audioEl);
            }
            this.updatePeerAudioOutputState();

            this.startPeerSpeakingDetection(peerId, stream);
            this.notifyPeerUpdate();
        };

        pc.onconnectionstatechange = () => {
            this.logDebug(`[VoiceChat] Connection state for ${peerId}:`, pc.connectionState);
            if (pc.connectionState !== 'new' && pc.connectionState !== 'connecting') {
                this.clearConnectionSafetyTimer(peerId);
            }
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                if (this.peerConnections.get(peerId) === pc) {
                    this.scheduleReconnect(peerId, pc.connectionState);
                }
            } else if (pc.connectionState === 'connected') {
                this.reconnectAttempts.delete(peerId);
                this.clearPendingOfferFallback(peerId);
                this.touchVoiceSeen(peerId);
                this.logDebug(`[VoiceChat] Successfully connected to ${peerId}`);
            } else if (pc.connectionState === 'closed') {
                this.clearPendingOfferFallback(peerId);
            }
        };

        if (createOffer) {
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                await this.sendSignal({
                    type: 'voice-offer',
                    from: this.userId,
                    to: peerId,
                    peerId,
                    offer,
                });
            } catch (error) {
                console.error("[VoiceChat] Error creating offer:", error);
            }
        }

        return pc;
    }

    private async handleOffer(signal: VoiceSignal) {
        if (!signal.offer) return;
        const peerId = this.normUserId(signal.from);
        this.logDebug(`[VoiceChat - ${this.userId}] Handling offer from:`, peerId);

        const pc = await this.createPeerConnection(peerId, false);
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.offer));

            const queued = this.pendingCandidates.get(peerId);
            if (queued) {
                queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
                this.pendingCandidates.delete(peerId);
            }

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await this.sendSignal({
                type: 'voice-answer',
                from: this.userId,
                to: peerId,
                peerId: this.userId,
                answer,
            });
        } catch (error) {
            console.error("[VoiceChat] Error handling offer:", error);
        }
    }

    private async handleAnswer(signal: VoiceSignal) {
        if (!signal.answer) return;
        const from = this.normUserId(signal.from);
        const pc = this.peerConnections.get(from);
        if (!pc) return;

        if (pc.signalingState !== 'have-local-offer') {
            this.logDebug(`[VoiceChat] Ignoring stale answer from ${from} (state: ${pc.signalingState})`);
            return;
        }

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.answer));
            const queued = this.pendingCandidates.get(from);
            if (queued) {
                queued.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(console.error));
                this.pendingCandidates.delete(from);
            }
        } catch (error) {
            console.error("[VoiceChat] Error handling answer:", error);
        }
    }

    // ─── Public helpers ────────────────────────────────────────

    public updateCharacterId(characterId: string) {
        if (this.characterId === characterId) return;
        this.characterId = characterId;
        const socket = getSocket(this.userId);
        socket.emit('voice-presence', {
            sessionId: this.sessionId,
            userId: this.userId,
            characterId: this.characterId,
            inVoice: this._isConnected,
        });
    }

    public isPeerSpeaking(peerId: string): boolean {
        peerId = this.normUserId(peerId);
        const data = this.speakingSnapshots.get(peerId);
        return data ? data.speaking === true : false;
    }

    public getPeerAudioLevel(peerId: string): number {
        peerId = this.normUserId(peerId);
        const data = this.speakingSnapshots.get(peerId);
        return data ? data.audioLevel || 0 : 0;
    }
}
