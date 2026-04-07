import { getSocket } from "./socketClient";

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
    private static readonly MAX_RECONNECT_ATTEMPTS = 3;

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
        onStreamReceived: (stream: MediaStream | null) => void
    ) {
        this.sessionId = sessionId;
        this.userId = userId.trim().toLowerCase();
        this.onStreamReceived = onStreamReceived;
    }

    // ─── Initialize ────────────────────────────────────────────

    public async initialize() {
        const socket = getSocket(this.userId);

        // Fetch TURN credentials from backend
        try {
            const { fetchTurnCredentials } = await import('./apiClient');
            const turnData = await fetchTurnCredentials(this.sessionId, this.userId);
            if (turnData && turnData.iceServers) {
                this.rtcConfig.iceServers = turnData.iceServers;
                console.log(`[WebRTC - ${this.userId}] Loaded custom TURN credentials`);
            }
        } catch (err) {
            console.error(`[WebRTC - ${this.userId}] Failed to fetch TURN credentials, using fallback:`, err);
        }

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
        console.log(`[WebRTC - ${this.userId}] Sending signal:`, signal.type);
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
            this.localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920, max: 2560 },
                    height: { ideal: 1080, max: 1440 },
                    frameRate: { ideal: 30, max: 60 },
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

            // Optimize video for sharpness (text, maps) not motion
            this.localStream.getVideoTracks().forEach(track => {
                if ('contentHint' in track) {
                    (track as any).contentHint = 'detail';
                }
            });

            this.isBroadcaster = true;
            this.onStreamReceived(this.localStream);

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

            // Update heartbeat to also emit transmission-sync
            this.heartbeatInterval = setInterval(() => {
                if (this.isBroadcaster && this.localStream) {
                    this.sendSignal({ type: 'stream-started', from: this.userId });
                    socket.emit('transmission-sync', {
                        sessionId: this.sessionId,
                        payload: { type: 'stream-started' },
                    });
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
            const socket = getSocket(this.userId);
            socket.emit('transmission-sync', {
                sessionId: this.sessionId,
                payload: { type: 'stop-share' },
            });
            this.isBroadcaster = false;
        }

        this.bufferedPeerIds.clear();
        this.onStreamReceived(null);
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
                console.log(`[WebRTC - ${this.userId}] Peer joined: ${peerId} — creating connection`);
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

    // ─── Peer connection ───────────────────────────────────────

    private async createPeerConnection(peerId: string) {
        console.log(`[WebRTC - ${this.userId}] Creating peer connection for:`, peerId);
        if (this.peerConnections.has(peerId)) {
            this.peerConnections.get(peerId)?.close();
        }

        const pc = new RTCPeerConnection(this.rtcConfig);
        this.peerConnections.set(peerId, pc);

        // Safety timeout: close stuck connections after 15s
        const safetyTimeout = setTimeout(() => {
            if (pc.connectionState === 'new' || pc.connectionState === 'connecting') {
                console.warn(`[WebRTC] Safety timeout: closing stuck connection for ${peerId}`);
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
                    candidate: event.candidate.toJSON(),
                });
            }
        };

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
            // Add ALL tracks (video + audio)
            this.localStream.getTracks().forEach(track => {
                console.log(`[WebRTC - ${this.userId}] Adding ${track.kind} track to peer connection`);
                if (this.localStream) pc.addTrack(track, this.localStream);
            });

            // Set encoding params for video only — leave audio at browser defaults
            try {
                const senders = pc.getSenders();
                for (const sender of senders) {
                    if (sender.track?.kind === 'video') {
                        const params = sender.getParameters();
                        if (!params.encodings || params.encodings.length === 0) {
                            params.encodings = [{}];
                        }
                        params.encodings[0].maxBitrate = this.getAdaptiveBitrate();
                        params.encodings[0].priority = 'high';
                        params.encodings[0].networkPriority = 'high';
                        try {
                            if ('setDegradationPreference' in (sender as any)) {
                                (sender as any).setDegradationPreference('maintain-resolution');
                            }
                        } catch (e) { /* ignore */ }
                        delete (params.encodings[0] as any).maxFramerate;
                        await sender.setParameters(params);
                    }
                    // Audio sender — leave at browser defaults, no bitrate restriction
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
            // Receiver side — accumulate tracks as they arrive
            // ontrack fires once per track (video first, then audio)
            pc.ontrack = (event) => {
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

        // Reset received tracks for fresh connection
        this._receivedTracks.clear();

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
            await this.sendSignal({
                type: 'answer',
                from: this.userId,
                to: signal.from,
                peerId: this.userId,
                answer,
            });
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

    // ─── Cleanup ───────────────────────────────────────────────

    private cleanupPeers() {
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        this.pendingCandidates.clear();
        this.reconnectAttempts.clear();
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

    private getAdaptiveBitrate(): number {
        const peerCount = this.peerConnections.size;
        if (peerCount <= 2) return 2_500_000;
        if (peerCount <= 5) return 2_000_000;
        if (peerCount <= 8) return 1_200_000;
        return 800_000;
    }
}