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
    private peerAudioContexts: Map<string, AudioContext> = new Map();
    private audioNodes: Map<string, {
        source: MediaStreamAudioSourceNode;
        gain: GainNode;
        analyser: AnalyserNode;
        destination: MediaStreamAudioDestinationNode;
    }> = new Map();
    private dummyAudioElements: Map<string, HTMLAudioElement> = new Map();
    private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
    private speakingAnalysers: Map<string, { analyser: AnalyserNode; interval: ReturnType<typeof setInterval> }> = new Map();
    private localSpeakingInterval: ReturnType<typeof setInterval> | null = null;
    private _localSpeaking: boolean = false;
    private _localAudioLevel: number = 0;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
    private _micVolume: number = 1;
    private localGainNode: GainNode | null = null;
    private _sessionParticipants: SessionParticipant[] = [];
    private voicePeerIds: Set<string> = new Set();
    private reconnectAttempts: Map<string, number> = new Map();
    private static readonly MAX_RECONNECT_ATTEMPTS = 3;
    private characterId?: string;
    private signalHandler: ((signal: VoiceSignal) => void) | null = null;

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
    get audioContextState() { return this.localAudioContext?.state || 'closed'; }

    // ─── Audio helpers ─────────────────────────────────────────

    private getLocalAudioContext(): AudioContext {
        if (typeof window === 'undefined') return {} as AudioContext;
        if (!this.localAudioContext) {
            this.localAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
        }
        return this.localAudioContext!;
    }

    private getPeerAudioContext(peerId: string): AudioContext {
        let ctx = this.peerAudioContexts.get(peerId);
        if (!ctx) {
            ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
            this.peerAudioContexts.set(peerId, ctx);
        }
        return ctx;
    }

    // ─── Initialize ────────────────────────────────────────────

    public async initialize() {
        const socket = getSocket(this.userId);

        // Remove previous handler if reinitializing
        if (this.signalHandler) {
            socket.off('webrtc-signal', this.signalHandler);
        }

        this.signalHandler = (signal: VoiceSignal) => {
            // Ignore own signals
            if (signal.from === this.userId) return;
            // Ignore signals directed to someone else
            if (signal.to && signal.to !== this.userId) return;
            // Ignore non-voice signals
            if (!signal.type?.startsWith('voice-')) return;

            console.log(`[VoiceChat - ${this.userId}] Signal received:`, signal.type, 'from:', signal.from);
            this.handleSignal(signal);
        };

        socket.on('webrtc-signal', this.signalHandler);

        // Handle presence updates from server
        socket.off('voice-presence-update');
        socket.on('voice-presence-update', (participants: SessionParticipant[]) => {
            this._sessionParticipants = participants;
            this.onPresenceUpdate(participants);
        });

        // Announce presence
        socket.emit('voice-presence', {
            sessionId: this.sessionId,
            userId: this.userId,
            characterId: this.characterId,
            inVoice: this._isConnected,
        });
    }

    // ─── Signal sending ────────────────────────────────────────

    private async sendSignal(signal: VoiceSignal) {
        const socket = getSocket(this.userId);
        console.log(`[VoiceChat - ${this.userId}] Sending signal:`, signal.type, '→', signal.to ?? 'broadcast');

        // Always broadcast to session room — receiver filters by signal.to
        // Direct userId routing is unreliable due to userId format differences across devices
        socket.emit('webrtc-signal', {
            sessionId: this.sessionId,
            signal,
        });
    }

    // ─── Join / Leave ──────────────────────────────────────────

    public async joinVoice(deviceId?: string): Promise<boolean> {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: { ideal: 1 },
                }
            });

            const audioCtx = this.getLocalAudioContext();
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume().catch(console.warn);
            }

            this._isConnected = true;
            this._micMuted = false;
            this.voicePeerIds.add(this.userId);

            // Update presence to inVoice: true
            const socket = getSocket(this.userId);
            socket.emit('voice-presence', {
                sessionId: this.sessionId,
                userId: this.userId,
                characterId: this.characterId,
                inVoice: true,
            });

            this.startLocalSpeakingDetection();

            // Announce to peers
            await this.sendSignal({ type: 'voice-join', from: this.userId, peerId: this.userId });

            // Heartbeat so late-joiners see us
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

        const socket = getSocket(this.userId);
        socket.emit('voice-presence', {
            sessionId: this.sessionId,
            userId: this.userId,
            characterId: this.characterId,
            inVoice: false,
        });

        this.cleanupAllPeers();
        this.notifyPeerUpdate();
    }

    // ─── Local controls ────────────────────────────────────────

    public setMicMuted(muted: boolean) {
        this._micMuted = muted;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(t => { t.enabled = !muted; });
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
            const newStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: deviceId },
                    echoCancellation: true,
                    noiseSuppression: false,
                    autoGainControl: false,
                    channelCount: { ideal: 1 },
                }
            });

            if (this.localStream) {
                this.localStream.getTracks().forEach(t => t.stop());
            }

            const newTrack = newStream.getAudioTracks()[0];
            this.localStream = newStream;

            // Replace track in all peer connections
            const replacements = Array.from(this.peerConnections.entries()).map(async ([peerId, pc]) => {
                const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
                if (sender) {
                    await sender.replaceTrack(newTrack);
                }
            });

            await Promise.all(replacements);

            // Re-setup local analysis
            if (this.localSpeakingInterval) {
                clearInterval(this.localSpeakingInterval);
                this.localSpeakingInterval = null;
            }
            this.startLocalSpeakingDetection();
            this.setMicMuted(this._micMuted);

            console.log(`[VoiceChat - ${this.userId}] Mic device changed to:`, deviceId);
        } catch (e) {
            console.error('[VoiceChat] Failed to change mic device:', e);
        }
    }

    public async setOutputDevice(deviceId: string) {
        try {
            const promises = Array.from(this.peerAudioElements.values()).map(async (el) => {
                if ((el as any).setSinkId) {
                    await (el as any).setSinkId(deviceId);
                }
            });
            await Promise.all(promises);
            console.log(`[VoiceChat - ${this.userId}] Output device changed to:`, deviceId);
        } catch (e) {
            console.error('[VoiceChat] Failed to set sinkId on audio elements:', e);
        }
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
        if (audioEl) audioEl.volume = 1;
        this.notifyPeerUpdate();
    }

    public setPeerMuted(peerId: string, muted: boolean) {
        this.peerMuted.set(peerId, muted);
        const audioEl = this.peerAudioElements.get(peerId);
        if (audioEl) audioEl.muted = muted;
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
        this.onPeerUpdate(this.getActivePeers());
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
    }

    // ─── Cleanup ───────────────────────────────────────────────

    private cleanupAllPeers() {
        this.speakingAnalysers.forEach(({ interval }) => clearInterval(interval));
        this.speakingAnalysers.clear();

        this.peerAudioElements.forEach(el => { el.pause(); el.srcObject = null; });
        this.peerAudioElements.clear();

        this.dummyAudioElements.forEach(el => { el.pause(); el.srcObject = null; });
        this.dummyAudioElements.clear();

        this.audioNodes.forEach(nodes => {
            nodes.source.disconnect();
            nodes.gain.disconnect();
            nodes.analyser.disconnect();
        });
        this.audioNodes.clear();

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

    private removePeer(peerId: string) {
        const analyser = this.speakingAnalysers.get(peerId);
        if (analyser) { clearInterval(analyser.interval); this.speakingAnalysers.delete(peerId); }

        const audioEl = this.peerAudioElements.get(peerId);
        if (audioEl) { audioEl.pause(); audioEl.srcObject = null; this.peerAudioElements.delete(peerId); }

        const dummyEl = this.dummyAudioElements.get(peerId);
        if (dummyEl) { dummyEl.pause(); dummyEl.srcObject = null; this.dummyAudioElements.delete(peerId); }

        const nodes = this.audioNodes.get(peerId);
        if (nodes) { nodes.source.disconnect(); nodes.gain.disconnect(); nodes.analyser.disconnect(); this.audioNodes.delete(peerId); }

        const pc = this.peerConnections.get(peerId);
        if (pc) { pc.close(); this.peerConnections.delete(peerId); }

        const ctx = this.peerAudioContexts.get(peerId);
        if (ctx) { ctx.close().catch(() => {}); this.peerAudioContexts.delete(peerId); }

        this.peerStreams.delete(peerId);
        this.peerVolumes.delete(peerId);
        this.peerMuted.delete(peerId);
        this.pendingCandidates.delete(peerId);
        this.notifyPeerUpdate();
    }

    // ─── Speaking detection ────────────────────────────────────

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
            this.localSpeakingInterval = setInterval(() => {
                analyser.getByteFrequencyData(dataArray);
                const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
                this._localAudioLevel = Math.min(1, avg / 80);
                const wasSpeaking = this._localSpeaking;
                this._localSpeaking = avg > 11;
                if (wasSpeaking !== this._localSpeaking) this.notifyPeerUpdate();
            }, 250);
        } catch (e) {
            console.warn('[VoiceChat] Could not start local speaking detection:', e);
        }
    }

    private startPeerSpeakingDetection(peerId: string, stream: MediaStream) {
        try {
            const existingNodes = this.audioNodes.get(peerId);
            if (existingNodes) {
                existingNodes.source.disconnect();
                existingNodes.gain.disconnect();
                existingNodes.analyser.disconnect();
                this.audioNodes.delete(peerId);
            }
            const existingAnalyser = this.speakingAnalysers.get(peerId);
            if (existingAnalyser) { clearInterval(existingAnalyser.interval); this.speakingAnalysers.delete(peerId); }
            const existingDummy = this.dummyAudioElements.get(peerId);
            if (existingDummy) { existingDummy.pause(); existingDummy.srcObject = null; this.dummyAudioElements.delete(peerId); }

            const audioCtx = this.getPeerAudioContext(peerId);
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().catch(e => console.warn('[VoiceChat] Auto-resume AudioContext failed:', e));
            }

            const source = audioCtx.createMediaStreamSource(stream);
            const gainNode = audioCtx.createGain();
            const currentVolume = this.peerVolumes.get(peerId) ?? 1;
            gainNode.gain.setValueAtTime(currentVolume, audioCtx.currentTime);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 512;
            source.connect(gainNode);
            gainNode.connect(analyser);
            const dst = audioCtx.createMediaStreamDestination();
            analyser.connect(dst);
            this.audioNodes.set(peerId, { source, gain: gainNode, analyser, destination: dst });

            const audioEl = this.peerAudioElements.get(peerId);
            if (audioEl) {
                const dummyAudio = new Audio();
                dummyAudio.srcObject = stream;
                dummyAudio.muted = true;
                dummyAudio.autoplay = true;
                dummyAudio.play().catch(() => {});
                this.dummyAudioElements.set(peerId, dummyAudio);
                audioEl.srcObject = dst.stream;
                audioEl.play().catch(e => console.warn('[VoiceChat] Audio play failed:', e));
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

    // ─── Signal handling ───────────────────────────────────────

    private async handleSignal(signal: VoiceSignal) {
        const { type, from } = signal;

        if (type === 'voice-leave') {
            if (from === this.userId) return;
            this.voicePeerIds.delete(from);
            this.removePeer(from);
            return;
        }

        if (type === 'voice-join') {
            if (from === this.userId) return;

            // Guard: don't reconnect to already-connected peers
            const existingPc = this.peerConnections.get(from);
            if (existingPc
                && existingPc.connectionState !== 'failed'
                && existingPc.connectionState !== 'closed') {
                console.log(`[VoiceChat - ${this.userId}] voice-join from ${from} ignored — already ${existingPc.connectionState}`);
                return;
            }

            // Guard: if already tracking this peer and we're the answerer,
            // don't keep ping-ponging — only the offerer drives reconnection
            if (this.voicePeerIds.has(from) && this._isConnected && this.localStream) {
                const isOfferer = this.userId < from;
                if (!isOfferer) {
                    console.log(`[VoiceChat - ${this.userId}] voice-join from ${from} — already tracking, answerer skipping re-ping`);
                    return;
                }
            }

            this.removePeer(from);
            this.voicePeerIds.add(from);

            if (!this._isConnected || !this.localStream) return;

            if (this.userId < from) {
                // Deterministic: smaller userId is always the offerer
                console.log(`[VoiceChat - ${this.userId}] I am offerer → creating offer for:`, from);
                await this.createPeerConnection(from, true);
            } else {
                // Answerer: ping back so offerer knows we're here
                console.log(`[VoiceChat - ${this.userId}] I am answerer → pinging back to:`, from);
                await this.sendSignal({ type: 'voice-join', from: this.userId, to: from, peerId: this.userId });
            }
            return;
        }

        if (type === 'voice-offer' && signal.offer) {
            if (!this._isConnected || !this.localStream) {
                console.warn(`[VoiceChat - ${this.userId}] Offer from ${from} dropped — not connected`);
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
                    if (!this.pendingCandidates.has(from)) this.pendingCandidates.set(from, []);
                    this.pendingCandidates.get(from)!.push(signal.candidate);
                }
            }
        }
    }

    // ─── Peer connection ───────────────────────────────────────

    private async createPeerConnection(peerId: string, createOffer: boolean) {
        if (peerId === this.userId) {
            console.warn('[VoiceChat] Blocked self-connection attempt');
            return new RTCPeerConnection(this.rtcConfig);
        }

        if (this.peerConnections.has(peerId)) {
            this.peerConnections.get(peerId)?.close();
        }

        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(peerId, pc);

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
                    candidate: event.candidate.toJSON(),
                });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[VoiceChat - ${this.userId}] Received audio track from:`, peerId);
            if (event.track.kind !== 'audio') return;

            const stream = event.streams?.[0] || new MediaStream([event.track]);
            this.peerStreams.set(peerId, stream);

            let audioEl = this.peerAudioElements.get(peerId);
            if (!audioEl) {
                audioEl = new Audio();
                audioEl.autoplay = true;
                this.peerAudioElements.set(peerId, audioEl);
            }
            audioEl.muted = this.peerMuted.get(peerId) ?? false;
            audioEl.volume = 1;

            this.startPeerSpeakingDetection(peerId, stream);
            this.notifyPeerUpdate();
        };

        pc.onconnectionstatechange = () => {
            console.log(`[VoiceChat] Connection state for ${peerId}:`, pc.connectionState);
            if (pc.connectionState === 'failed') {
                const attempts = this.reconnectAttempts.get(peerId) || 0;
                if (attempts < VoiceChatManager.MAX_RECONNECT_ATTEMPTS && this._isConnected && this.localStream) {
                    this.reconnectAttempts.set(peerId, attempts + 1);
                    console.log(`[VoiceChat] Reconnecting to ${peerId} (attempt ${attempts + 1}/${VoiceChatManager.MAX_RECONNECT_ATTEMPTS})`);
                    setTimeout(() => {
                        if (this._isConnected && this.localStream) {
                            if (this.userId < peerId) {
                                this.createPeerConnection(peerId, true);
                            } else {
                                this.sendSignal({ type: 'voice-join', from: this.userId, peerId: this.userId });
                            }
                        }
                    }, 3000 * (attempts + 1));
                } else {
                    console.warn(`[VoiceChat] Max reconnect attempts reached for ${peerId}`);
                }
            } else if (pc.connectionState === 'connected') {
                this.reconnectAttempts.delete(peerId);
                console.log(`[VoiceChat] Successfully connected to ${peerId}`);
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
        const peerId = signal.from;
        console.log(`[VoiceChat - ${this.userId}] Handling offer from:`, peerId);

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
        const pc = this.peerConnections.get(signal.from);
        if (!pc) return;

        if (pc.signalingState !== 'have-local-offer') {
            console.warn(`[VoiceChat] Ignoring stale answer from ${signal.from} (state: ${pc.signalingState})`);
            return;
        }

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

    // ─── Public helpers ────────────────────────────────────────

    public isPeerSpeaking(peerId: string): boolean {
        const data = this.speakingAnalysers.get(peerId);
        return data ? (data as any).speaking === true : false;
    }

    public getPeerAudioLevel(peerId: string): number {
        const data = this.speakingAnalysers.get(peerId);
        return data ? ((data as any).audioLevel || 0) : 0;
    }
}