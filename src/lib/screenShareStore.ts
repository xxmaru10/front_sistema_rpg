
class ScreenShareStore {
    hasStream: boolean = false;
    reconnectVersion: number = 0;
    retry1080Version: number = 0;
    retryPeerVersion: number = 0;
    retryPeerId: string | null = null;
    qualityTier: '1080p' | '720p' = '1080p';
    downgradeActive: boolean = false;
    peerHardStoppedId: string | null = null;
    private listeners: (() => void)[] = [];

    setHasStream(has: boolean) {
        this.hasStream = has;
        this.notify();
    }

    triggerReconnect() {
        this.reconnectVersion++;
        this.notify();
    }

    triggerTry1080p() {
        this.retry1080Version++;
        this.notify();
    }

    triggerRetryPeer(peerId: string) {
        const normalizedPeerId = (peerId || '').trim().toLowerCase();
        if (!normalizedPeerId) return;
        this.retryPeerId = normalizedPeerId;
        this.retryPeerVersion++;
        this.peerHardStoppedId = null;
        this.notify();
    }

    setQualityTier(tier: '1080p' | '720p', downgradeActive: boolean) {
        this.qualityTier = tier;
        this.downgradeActive = downgradeActive;
        this.notify();
    }

    setPeerHardStopped(peerId: string) {
        const normalizedPeerId = (peerId || '').trim().toLowerCase();
        this.peerHardStoppedId = normalizedPeerId || null;
        this.notify();
    }

    clearPeerHardStopped() {
        this.peerHardStoppedId = null;
        this.notify();
    }

    subscribe(listener: () => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l());
    }
}

export const screenShareStore = new ScreenShareStore();
