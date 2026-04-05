/**
 * @file: src/lib/audio-unlock-manager.ts
 * @summary: Singleton que gerencia o estado de desbloqueio de autoplay do browser.
 * Notifica subscribers (MusicPlayer, AtmosphericPlayer, screen share) para
 * retentarem .play() após gesto explícito do usuário.
 */

type UnlockSubscriber = () => void;

class AudioUnlockManager {
    private _unlocked = false;
    private _subscribers: Set<UnlockSubscriber> = new Set();
    private _mutedVideoElements: Set<HTMLVideoElement> = new Set();
    private _audioContext: AudioContext | null = null;

    get isUnlocked(): boolean {
        return this._unlocked;
    }

    /**
     * Registra um callback que será chamado quando o áudio for desbloqueado.
     * Retorna função de cleanup para remover o subscriber.
     */
    subscribe(callback: UnlockSubscriber): () => void {
        this._subscribers.add(callback);
        return () => this._subscribers.delete(callback);
    }

    /**
     * Registra um elemento <video> que foi mutado por fallback de autoplay.
     * No unlock, será desmutado e terá .play() chamado novamente.
     */
    registerMutedVideo(videoEl: HTMLVideoElement): void {
        this._mutedVideoElements.add(videoEl);
    }

    /**
     * Remove um elemento <video> da lista (ex: quando o stream termina).
     */
    unregisterVideo(videoEl: HTMLVideoElement): void {
        this._mutedVideoElements.delete(videoEl);
    }

    /**
     * Chamado pelo AudioUnlockBanner quando o usuário clica no botão.
     * 1. Cria/resume o AudioContext (desbloqueia Web Audio API).
     * 2. Notifica todos os subscribers (players tentam .play() novamente).
     * 3. Desmuta e retoca todos os vídeos mutados por fallback.
     */
    async unlock(): Promise<void> {
        if (this._unlocked) return;

        // 1. Resume AudioContext (singleton — cria apenas uma vez)
        try {
            if (!this._audioContext) {
                this._audioContext = new AudioContext();
            }
            if (this._audioContext.state === "suspended") {
                await this._audioContext.resume();
            }
        } catch (e) {
            console.warn("[AudioUnlockManager] AudioContext resume failed:", e);
        }

        this._unlocked = true;

        // 2. Notifica subscribers (MusicPlayer, AtmosphericPlayer)
        this._subscribers.forEach((cb) => {
            try {
                cb();
            } catch (e) {
                console.warn("[AudioUnlockManager] Subscriber error:", e);
            }
        });

        // 3. Desmuta vídeos mutados por fallback (screen share)
        this._mutedVideoElements.forEach(async (videoEl) => {
            try {
                videoEl.muted = false;
                await videoEl.play();
                console.log("[AudioUnlockManager] Video unmuted and resumed.");
            } catch (e) {
                console.warn("[AudioUnlockManager] Video unmute/play failed:", e);
            }
        });

        this._mutedVideoElements.clear();
    }
}

// Singleton exportado — uma única instância em toda a aplicação
export const audioUnlockManager = new AudioUnlockManager();
