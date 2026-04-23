
class ScreenShareStore {
    hasStream: boolean = false;
    reconnectVersion: number = 0;
    retry1080Version: number = 0;
    qualityTier: '1080p' | '720p' = '1080p';
    downgradeActive: boolean = false;
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

    setQualityTier(tier: '1080p' | '720p', downgradeActive: boolean) {
        this.qualityTier = tier;
        this.downgradeActive = downgradeActive;
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
