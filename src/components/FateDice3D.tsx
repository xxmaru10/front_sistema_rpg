"use client";

import { useFateDiceSimulation } from "../hooks/useFateDiceSimulation";
import { FateResultOverlay } from "./DiceRoller/FateResultOverlay";
import type { DiceResultOverlayMode } from "@/lib/diceSimulationStore";
import { DiceBreakdownEntry, DicePoolEntry } from "@/types/domain";

interface FateDice3DProps {
    isVisible: boolean;
    initialPool?: DicePoolEntry[];
    onPoolChange?: (pool: DicePoolEntry[]) => void;
    accentColor?: string;
    onSettled: (results: number[], breakdown?: DiceBreakdownEntry[]) => void;
    onPreResult?: (results: number[]) => void;
    userRole?: "GM" | "PLAYER";
    activeTab?: string;
    calculationBreakdown?: {
        baseSkillValue?: number;
        itemBonusValue?: number;
        customModifierValue?: number;
        itemName?: string;
    };
    resultOverlay?: {
        mode: DiceResultOverlayMode;
        targetDifficulty?: number;
    };
}

/**
 * Componente principal para exibição dos dados Fate em 3D.
 * Utiliza o hook useFateDiceSimulation para a lógica de renderização e física.
 */
export default function FateDice3D({
    isVisible,
    initialPool,
    onPoolChange,
    accentColor = "#C5A059",
    onSettled,
    onPreResult,
    userRole,
    activeTab: _activeTab,
    calculationBreakdown,
    resultOverlay,
}: FateDice3DProps) {
    const {
        mountRef,
        uiPhase,
        uiResults,
        uiBreakdown,
        autoRoll,
        manualRollExpression,
        resolvedAccent,
        resolvedDanger,
        dicePool,
        updatePool,
    } = useFateDiceSimulation({
        isVisible,
        initialPool,
        accentColor,
        onSettled,
        onPreResult,
    });

    const handlePoolChange = (newPool: DicePoolEntry[]) => {
        updatePool(newPool);
        onPoolChange?.(newPool);
    };

    if (!isVisible) return null;

    // Lógica de bloqueio: 
    // Bloqueia (pointerEvents: 'auto') se:
    // 1. NÀO for GM
    // 2. NÀO estiver na Arena (activeTab !== 'combat')
    // 3. NÀO tiver terminado a rolagem (uiPhase !== 'done')
    const shouldBlock = uiPhase !== "done";

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9999,
                background: "transparent", // Removido fundo opaco
                animation: "fadeInDice 0.25s ease",
                // Se deve bloquear, usa 'auto' para capturar todos os cliques. 
                // Se não deve bloquear, 'none' para deixar passar pro sistema por baixo.
                // IMPORTANTE: O canvas em si PRECISA de pointer-events para pegar o drag/catch.
                pointerEvents: shouldBlock ? "auto" : "none",
                userSelect: "none",
            }}
        >
             {/* Fundo da Câmara (Apresentação Inicial) — Renderizado ANTES do canvas para ficar atrás dos dados */}
            {uiPhase === "idle" && (
                <div 
                    style={{
                        position: "absolute",
                        top: "42%",
                        left: "52.5%",
                        transform: "translate(-50%, -50%)",
                        width: "560px",
                        height: "220px",
                        background: "rgba(10, 10, 15, 0.45)",
                        border: `1px solid ${resolvedAccent}33`,
                        borderRadius: "24px",
                        boxShadow: `0 0 50px rgba(0,0,0,0.6), inset 0 0 25px ${resolvedAccent}08`,
                        backdropFilter: "blur(8px)",
                        pointerEvents: "none",
                        animation: "chamberFadeIn 0.8s cubic-bezier(0.19, 1, 0.22, 1)",
                        zIndex: 1,
                    }}
                />
            )}

            {/* Canvas Three.js montado pelo hook. Este sempre precisa de auto para os dados serem clicáveis */}
            <div 
                ref={mountRef} 
                style={{ 
                    width: "100%", 
                    height: "100%", 
                    position: "absolute", 
                    inset: 0,
                    pointerEvents: uiPhase === "done" ? "none" : "auto", 
                    zIndex: 2, 
                    opacity: uiPhase === 'done' ? 0 : 1,
                    transition: "opacity 0.4s ease-out",
                }} 
            />

            {/* UI Overlay (Instruções, Botão Auto-Roll e Resultados) */}
            <div style={{ pointerEvents: "auto" }}>
                <FateResultOverlay
                    phase={uiPhase}
                    results={uiResults}
                    breakdown={uiBreakdown}
                    accentColor={resolvedAccent}
                    dangerColor={resolvedDanger}
                    onAutoRoll={autoRoll}
                    onManualExpressionRoll={manualRollExpression}
                    dicePool={dicePool}
                    onPoolChange={handlePoolChange}
                    calculationBreakdown={calculationBreakdown}
                    resultOverlay={resultOverlay}
                    userRole={userRole}
                />
            </div>

            <style>{`
                @keyframes fadeInDice {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                @keyframes chamberFadeIn {
                    from { opacity: 0; transform: translate(-50%, -55%) scale(0.95); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1);   }
                }
            `}</style>
        </div>
    );
}
