/**
 * Store global para gerenciar a simulação de dados 3D em toda a arena.
 * Permite que qualquer componente dispare a animação no nível da página.
 */

export type DiceResultOverlayMode = "combat" | "challenge";

import { DiceBreakdownEntry, DicePoolEntry } from "@/types/domain";

type DiceSettledCallback = (results: number[], breakdown?: DiceBreakdownEntry[]) => void;
type DicePreviewCallback = (results: number[]) => void;

interface DiceSimulationParams {
    accentColor?: string;
    initialPool?: DicePoolEntry[];
    currentPool?: DicePoolEntry[]; // Final pool after user edits
    onPoolChange?: (pool: DicePoolEntry[]) => void;
    onSettled: DiceSettledCallback;
    onPreResult?: DicePreviewCallback;
    calculationBreakdown?: {
        baseSkillValue?: number;
        itemBonusValue?: number;
        customModifierValue?: number;
        /** Nome do item equipado/selecionado (só exibição no overlay). */
        itemName?: string;
    };
    /** Como colorir o total final após os dados 3D (Arena vs desafio). */
    resultOverlay?: {
        mode: DiceResultOverlayMode;
        /** Dificuldade do desafio (modo challenge); sucesso se total >= este valor. */
        targetDifficulty?: number;
    };
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

    updateCurrentPool(pool: DicePoolEntry[]) {
        if (this.activeParams) {
            this.activeParams.currentPool = pool;
        }
    }
}

export const diceSimulationStore = new DiceSimulationStore();
