import { supabase } from "./supabaseClient";
import { v4 as uuidv4 } from "uuid";

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
    private _receivedTracks: Map<string, MediaStreamTrack> = new Map();
    private static readonly MAX_RECONNECT_ATTEMPTS = 3;

    private rtcConfig: RTCConfiguration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
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
        iceTransportPolicy: 'all',
    };

    constructor(
        sessionId: string,
        userId: string,
        onStreamReceived: (stream: MediaStream | null) => void
    ) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.onStreamReceived = onStreamReceived;
    }

    public async initialize() {
        if (this.channel) return;

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
                    if (row.from_user === this.userId) return;
                    if (row.to_user && row.to_user !== this.userId) return;
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
                        this.sendSignal({ type: 'stream-started', from: this.userId });
                    } else {
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
                console.error(`[WebRTC - ${this.userId}] DB insert error for ${signal.type}:`, error.message);
                if (error.code === '42P01') {
                    console.error('[WebRTC] TABELA webrtc_signals NÃO EXISTE.');
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
                    width: { ideal: 1920, max: 2560 },
                    height: { ideal: 1080, max: 1440 },
                    frameRate: { ideal: 30, max: 60 },
                },
                // System audio should NOT have echoCancellation/noiseSuppression/autoGainControl
                // These are microphone processing features that corrupt or drop system audio
                audio: true,
            });

            // Check if audio was actually captured
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('[ScreenShare] No audio track — user may not have checked "Share system audio" in the dialog');
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

            if (this.bufferedPeerIds.size > 0) {
                console.log(`[WebRTC - ${this.userId}] Connecting to ${this.bufferedPeerIds.size} buffered peers`);
                this.bufferedPeerIds.forEach(peerId => this.createPeerConnection(peerId));
                this.bufferedPeerIds.clear();
            }

            await this.sendSignal({ type: 'stream-started', from: this.userId });

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
        const { type, from } = signal;

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
                if (existingPc && existingPc.connectionState !== 'failed' && existingPc.connectionState !== 'closed') {
                    return;
                }
                console.log(`[WebRTC - ${this.userId}] Stream active, sending peer-join`);
                await this.sendSignal({ type: 'peer-join', from: this.userId, peerId: this.userId, to: from });
            }
            return;
        }

        if (type === 'peer-join') {
            const peerId = signal.peerId || from;
            if (!peerId || peerId === this.userId) return;

            if (this.isBroadcaster) {
                const existingPc = this.peerConnections.get(peerId);
                if (existingPc && existingPc.connectionState !== 'failed' && existingPc.connectionState !== 'closed') {
                    return;
                }
                console.log(`[WebRTC - ${this.userId}] Peer joined (broadcasting): ${peerId}`);
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

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Connection state for ${peerId}:`, pc.connectionState);
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

            // Set encoding params for video only
            try {
                const senders = pc.getSenders();
                for (const sender of senders) {
                    if (sender.track?.kind === 'video') {
                        const params = sender.getParameters();
                        if (!params.encodings || params.encodings.length === 0) {
                            params.encodings = [{}];
                        }
                        params.encodings[0].maxBitrate = 12_000_000;
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
                    // Audio sender — leave at browser defaults, do not restrict bitrate
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
            pc.ontrack = (event) => {
                console.log(`[WebRTC - ${this.userId}] Received ${event.track.kind} track`);

                if (event.streams?.[0]) {
                    // streams[0] is the same MediaStream object for all tracks from the same sender
                    // calling onStreamReceived multiple times is fine — same reference, React deduplicates
                    this.onStreamReceived(event.streams[0]);
                } else {
                    // Fallback: accumulate tracks manually
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
        this._receivedTracks.clear();
    }
}