/**
 * Store global para gerenciar a simulação de dados 3D em toda a arena.
 * Permite que qualquer componente dispare a animação no nível da página.
 */

type DiceSimulationCallback = (results: number[]) => void;

interface DiceSimulationParams {
    accentColor?: string;
    onSettled: DiceSimulationCallback;
    onPreResult?: DiceSimulationCallback;
    onFirstImpact?: () => void;
}

class DiceSimulationStore {
    private listeners: Set<() => void> = new Set();
    private activeParams: DiceSimulationParams | null = null;
    private isVisible: boolean = false;

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(l => l());
    }

    show(params: DiceSimulationParams) {
        this.activeParams = params;
        this.isVisible = true;
        this.notify();
    }

    hide() {
        this.isVisible = false;
        this.activeParams = null;
        this.notify();
    }

    getIsVisible() {
        return this.isVisible;
    }

    getParams() {
        return this.activeParams;
    }
}

export const diceSimulationStore = new DiceSimulationStore();
