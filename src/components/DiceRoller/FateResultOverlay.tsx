/**
 * Componente de Overlay para o FateDice3D.
 * Exibe instruções, botões de ação e o resultado final com estética neon.
 */

import React from "react";
import { Play } from "lucide-react";

interface FateResultOverlayProps {
    phase: "idle" | "held" | "thrown" | "snapping" | "done";
    results: number[] | null;
    accentColor: string;
    dangerColor: string;
    onAutoRoll: () => void;
    calculationBreakdown?: {
        baseSkillValue?: number;
        itemBonusValue?: number;
        customModifierValue?: number;
    };
}

/** Escada de resultados Fate */
function ladderLabel(sum: number): string {
    const L: Record<number, string> = {
        8: "Lendário", 7: "Épico", 6: "Fantástico", 5: "Excelente",
        4: "Ótimo", 3: "Bom", 2: "Razoável", 1: "Mediano",
        0: "Medíocre", [-1]: "Pobre", [-2]: "Terrível",
    };
    if (sum > 8) return "Divino";
    if (sum < -2) return "Catastrófico";
    return L[sum] || "N/A";
}

export const FateResultOverlay: React.FC<FateResultOverlayProps> = ({
    phase,
    results,
    accentColor,
    dangerColor,
    onAutoRoll,
    calculationBreakdown,
}) => {
    const label =
        phase === "idle"     ? "CLIQUE E SEGURE PARA PEGAR OS DADOS" :
        phase === "held"     ? "MOVA PARA BALANÇAR  ·  SOLTE PARA LANÇAR" :
        phase === "thrown"   ? "CONVOCANDO O DESTINO..." :
        phase === "snapping" ? "REVELANDO O DESTINO..." :
        "";

    const diceSum = results ? results.reduce((a, b) => a + b, 0) : 0;
    
    // Calculate full breakdown sums
    const totalBonus = 
        (calculationBreakdown?.baseSkillValue || 0) + 
        (calculationBreakdown?.itemBonusValue || 0) + 
        (calculationBreakdown?.customModifierValue || 0);

    const grandTotal = diceSum + totalBonus;
    
    // Show breakdown only if there's any modifier
    const hasModifiers = totalBonus !== 0 || !!calculationBreakdown;

    return (
        <>
            {/* Interface de Câmara (Idle) — Unifica Botão, Instrução e Dados */}
            {phase === "idle" && (
                <div style={{
                    position: "absolute",
                    top: "42%", 
                    left: "52.5%",
                    transform: "translate(-50%, -50%)",
                    width: "560px",
                    height: "220px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "24px",
                    zIndex: 10,
                    pointerEvents: "none", // Container principal não bloqueia cliques
                }}>
                    {/* Botão de rolagem automática interno */}
                    <button
                        onClick={onAutoRoll}
                        style={{
                            background: "rgba(0,0,0,0.45)",
                            border: `1px solid ${accentColor}33`,
                            borderRadius: "50%",
                            color: accentColor,
                            width: "42px",
                            height: "42px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            pointerEvents: "auto", // Re-habilita cliques no botão
                            transition: "all 0.3s cubic-bezier(0.19, 1, 0.22, 1)",
                            boxShadow: `0 4px 12px rgba(0,0,0,0.6)`,
                        }}
                        title="rolar automaticamente"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = accentColor;
                            e.currentTarget.style.background = `${accentColor}22`;
                            e.currentTarget.style.transform = "scale(1.15)";
                            e.currentTarget.style.boxShadow = `0 0 20px ${accentColor}44`;
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = `${accentColor}33`;
                            e.currentTarget.style.background = "rgba(0,0,0,0.45)";
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.6)`;
                        }}
                    >
                        <Play size={20} fill="currentColor" style={{ marginLeft: "2px" }} />
                    </button>

                    <div style={{ flex: 1 }} /> {/* Espaço para os dados 3D ficarem no meio */}

                    {/* Label de instrução interno */}
                    <div style={{
                        color: accentColor,
                        fontFamily: "var(--font-header, 'Cinzel', serif)",
                        fontSize: "0.72rem",
                        letterSpacing: "0.3em",
                        textTransform: "uppercase",
                        textShadow: `0 0 10px ${accentColor}`,
                        opacity: 0.8,
                        pointerEvents: "none",
                        textAlign: "center",
                    }}>
                        {label}
                    </div>
                </div>
            )}

            {/* Labels para outras fases (que não idle) */}
            {phase !== "idle" && label && (
                <div style={{
                    position: "absolute",
                    bottom: "12%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    color: accentColor,
                    fontFamily: "var(--font-header, 'Cinzel', serif)",
                    fontSize: "0.88rem",
                    letterSpacing: "0.25em",
                    textTransform: "uppercase",
                    textShadow: `0 0 14px ${accentColor}, 0 0 28px ${accentColor}88`,
                    opacity: 0.9,
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                }}>
                    {label}
                </div>
            )}

            {/* Painel de resultado — face vencedora + total + escada */}
            {phase === "done" && results && (
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "52.5%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "24px",
                    pointerEvents: "none",
                    animation: "resultReveal 0.6s cubic-bezier(0.19, 1, 0.22, 1)",
                    background: "rgba(5, 5, 8, 0.98)",
                    padding: "40px 80px",
                    borderRadius: "28px",
                    minWidth: "520px",
                    border: `1px solid ${accentColor}66`,
                    boxShadow: `0 0 80px rgba(0,0,0,0.9), inset 0 0 30px ${accentColor}11`,
                    backdropFilter: "blur(16px)",
                }}>
                    <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                        {results.map((v, i) => {
                            const isNeg = v === -1;
                            const color  = isNeg ? dangerColor : v === 1 ? accentColor : accentColor + "88";
                            const shadow = isNeg
                                ? `0 0 18px ${dangerColor}, 0 0 36px ${dangerColor}66`
                                : v === 1
                                ? `0 0 18px ${accentColor}, 0 0 36px ${accentColor}66`
                                : `0 0 10px ${accentColor}55`;
                            const borderColor = isNeg ? dangerColor : accentColor;
                            const boxShadow   = isNeg
                                ? `0 0 24px ${dangerColor}99, 0 0 8px ${dangerColor}55, inset 0 0 14px ${dangerColor}22`
                                : `0 0 24px ${accentColor}99, 0 0 8px ${accentColor}55, inset 0 0 14px ${accentColor}22`;
                            return (
                                <div key={i} style={{
                                    width: 72, height: 72,
                                    borderRadius: 12,
                                    border: `2px solid ${borderColor}`,
                                    boxShadow,
                                    background: "rgba(8,4,18,0.95)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontSize: "2.4rem",
                                    fontWeight: "bold",
                                    fontFamily: "Georgia, serif",
                                    color,
                                    textShadow: shadow,
                                }}>
                                    {v === 1 ? "+" : v === -1 ? "−" : "●"}
                                </div>
                            );
                        })}
                    </div>

                    {/* Breakdown Math */}
                    {hasModifiers && (
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            color: accentColor,
                            fontFamily: "var(--font-header, 'Cinzel', serif)",
                            fontSize: "1.1rem",
                            letterSpacing: "0.1em",
                            opacity: 0.85,
                            marginTop: "-8px",
                            marginBottom: "4px"
                        }}>
                            <div>Dado: {diceSum > 0 ? `+${diceSum}` : diceSum}</div>
                            
                            {calculationBreakdown?.baseSkillValue ? (
                                <div> + Perícia: {calculationBreakdown.baseSkillValue}</div>
                            ) : null}
                            
                            {calculationBreakdown?.itemBonusValue ? (
                                <div> + Item: {calculationBreakdown.itemBonusValue}</div>
                            ) : null}

                            {calculationBreakdown?.customModifierValue ? (
                                <div> + Modificador: {calculationBreakdown.customModifierValue > 0 ? `+${calculationBreakdown.customModifierValue}` : calculationBreakdown.customModifierValue}</div>
                            ) : null}
                        </div>
                    )}

                    <div style={{
                        color: accentColor,
                        fontFamily: "var(--font-header, 'Cinzel', serif)",
                        fontSize: "2rem",
                        fontWeight: "bold",
                        letterSpacing: "0.15em",
                        textShadow: `0 0 20px ${accentColor}, 0 0 40px ${accentColor}66`,
                        display: "flex",
                        alignItems: "center",
                        gap: "10px"
                    }}>
                        {hasModifiers && <span style={{ fontSize: "1.4rem", opacity: 0.8 }}>Total =</span>}
                        <span>{grandTotal > 0 ? `+${grandTotal}` : grandTotal < 0 ? `${grandTotal}` : "0"}</span>
                    </div>

                    <div style={{
                        color: accentColor,
                        fontFamily: "var(--font-header, 'Cinzel', serif)",
                        fontSize: "0.82rem",
                        letterSpacing: "0.35em",
                        textTransform: "uppercase",
                        textShadow: `0 0 12px ${accentColor}`,
                        opacity: 0.72,
                    }}>
                        {ladderLabel(grandTotal).toUpperCase()}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes resultReveal {
                    from { opacity: 0; transform: translate(-50%, -40%) scale(0.9); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1);   }
                }
                @keyframes chamberFadeIn {
                    from { opacity: 0; transform: translate(-50%, -55%) scale(0.95); }
                    to   { opacity: 1; transform: translate(-50%, -50%) scale(1);   }
                }
            `}</style>
        </>
    );
};
