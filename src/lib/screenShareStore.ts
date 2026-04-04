
class ScreenShareStore {
    hasStream: boolean = false;
    reconnectVersion: number = 0;
    private listeners: (() => void)[] = [];

    setHasStream(has: boolean) {
        this.hasStream = has;
        this.notify();
    }

    triggerReconnect() {
        this.reconnectVersion++;
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
