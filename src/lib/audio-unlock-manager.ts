/**
 * @file: src/lib/audio-unlock-manager.ts
 * @summary: Singleton que gerencia o estado de desbloqueio de autoplay do browser.
 * Notifica subscribers (MusicPlayer, AtmosphericPlayer, screen share) para
 * retentarem .play() após gesto explícito do usuário.
 *
 * Além do unlock por banner, mantém uma fila de "pending plays": elementos cujo
 * play() falhou por autoplay policy. Qualquer clique/toque na página retenta
 * automaticamente esses plays, sem depender exclusivamente do banner.
 */

type UnlockSubscriber = () => void;

class AudioUnlockManager {
    private _unlocked = false;
    private _subscribers: Set<UnlockSubscriber> = new Set();
    private _mutedVideoElements: Set<HTMLVideoElement> = new Set();
    private _audioContext: AudioContext | null = null;

    /** Elementos <audio>/<video> cujo play() falhou e aguardam próximo gesto */
    private _pendingPlays: Set<HTMLMediaElement> = new Set();
    private _interactionListenerBound = false;

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

    // ─── Pending Plays ───────────────────────────────────────────────────────

    /**
     * Registra um elemento de mídia cujo play() falhou por autoplay policy.
     * O manager retentará no próximo gesto de usuário (click/touch em qualquer
     * lugar da página), sem depender do AudioUnlockBanner.
     */
    registerPendingPlay(element: HTMLMediaElement): void {
        this._pendingPlays.add(element);
        this._ensureInteractionListener();
    }

    /**
     * Remove um elemento da fila de pending plays (cleanup de componente).
     */
    unregisterPendingPlay(element: HTMLMediaElement): void {
        this._pendingPlays.delete(element);
    }

    private _ensureInteractionListener(): void {
        if (this._interactionListenerBound || typeof document === "undefined") return;
        this._interactionListenerBound = true;
        document.addEventListener("click", this._onUserInteraction, { capture: true });
        document.addEventListener("touchstart", this._onUserInteraction, { capture: true });
    }

    private _removeInteractionListener(): void {
        if (!this._interactionListenerBound) return;
        this._interactionListenerBound = false;
        document.removeEventListener("click", this._onUserInteraction, { capture: true });
        document.removeEventListener("touchstart", this._onUserInteraction, { capture: true });
    }

    /**
     * Handler de interação no document: retenta play() de todos os elementos
     * pendentes dentro do contexto de gesto do usuário.
     */
    private _onUserInteraction = (): void => {
        if (this._pendingPlays.size === 0) {
            this._removeInteractionListener();
            return;
        }

        const pending = [...this._pendingPlays];
        this._pendingPlays.clear();

        for (const el of pending) {
            el.play().catch(() => {
                // Ainda falhando — re-registra para próximo gesto
                this._pendingPlays.add(el);
            });
        }

        // Verifica se sobrou algo após as promises (async)
        setTimeout(() => {
            if (this._pendingPlays.size === 0) {
                this._removeInteractionListener();
            }
        }, 200);
    };

    // ─── Unlock (chamado pelo AudioUnlockBanner) ─────────────────────────────

    /**
     * Chamado pelo AudioUnlockBanner quando o usuário clica no botão.
     *
     * IMPORTANTE: subscribers e pending plays são processados ANTES de qualquer
     * await, para manter o contexto de gesto do usuário (user activation).
     * Browsers como Firefox/Safari perdem o gesto após o primeiro await.
     */
    unlock(): void {
        if (this._unlocked) return;
        this._unlocked = true;

        // 1. Notifica subscribers SINCRONAMENTE no contexto de gesto do usuário
        this._subscribers.forEach((cb) => {
            try {
                cb();
            } catch (e) {
                console.warn("[AudioUnlockManager] Subscriber error:", e);
            }
        });

        // 2. Retenta pending plays (também no contexto de gesto)
        const pending = [...this._pendingPlays];
        this._pendingPlays.clear();
        for (const el of pending) {
            el.play().catch((e) => {
                console.warn("[AudioUnlockManager] Pending play retry failed:", e);
            });
        }

        // 3. Desmuta e retoca vídeos (screen share) — no contexto de gesto
        for (const videoEl of this._mutedVideoElements) {
            try {
                videoEl.muted = false;
                videoEl.play().catch((e) => {
                    console.warn("[AudioUnlockManager] Video unmute/play failed:", e);
                });
            } catch (e) {
                console.warn("[AudioUnlockManager] Video error:", e);
            }
        }
        this._mutedVideoElements.clear();

        // 4. Resume AudioContext — fire-and-forget (NÃO await)
        try {
            if (!this._audioContext) {
                this._audioContext = new AudioContext();
            }
            if (this._audioContext.state === "suspended") {
                this._audioContext.resume().catch((e) => {
                    console.warn("[AudioUnlockManager] AudioContext resume failed:", e);
                });
            }
        } catch (e) {
            console.warn("[AudioUnlockManager] AudioContext creation failed:", e);
        }

        this._removeInteractionListener();
    }
}

// Singleton exportado — uma única instância em toda a aplicação
export const audioUnlockManager = new AudioUnlockManager();
