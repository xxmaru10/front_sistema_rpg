/**
 * Componente de Overlay para o FateDice3D.
 * Exibe instruções, botões de ação e o resultado final com estética neon.
 */

import React from "react";
import { Play } from "lucide-react";
import type { DiceResultOverlayMode } from "@/lib/diceSimulationStore";

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
        itemName?: string;
    };
    resultOverlay?: {
        mode: DiceResultOverlayMode;
        targetDifficulty?: number;
    };
}

function fmtSigned(n: number): string {
    if (n > 0) return `+${n}`;
    return `${n}`;
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
    resultOverlay,
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

    const successGreen = "#4ade80";
    const failRed = "#ff3333";
    const neutralTone = accentColor;

    let totalColor = neutralTone;
    if (resultOverlay?.mode === "combat") {
        if (grandTotal > 0) totalColor = successGreen;
        else if (grandTotal < 0) totalColor = failRed;
    } else if (resultOverlay?.mode === "challenge") {
        const diff = resultOverlay.targetDifficulty ?? 0;
        totalColor = grandTotal >= diff ? successGreen : failRed;
    }

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

            {/* Painel de resultado após 3D: compacto (Arena / desafio) */}
            {phase === "done" && results && resultOverlay && (
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "52.5%",
                    transform: "translate(-50%, -50%)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "18px",
                    pointerEvents: "none",
                    animation: "resultReveal 0.6s cubic-bezier(0.19, 1, 0.22, 1)",
                    background: "rgba(5, 5, 8, 0.98)",
                    padding: "36px 56px 44px",
                    borderRadius: "28px",
                    minWidth: "280px",
                    border: `1px solid ${totalColor}66`,
                    boxShadow: `0 0 80px rgba(0,0,0,0.9), 0 0 40px ${totalColor}33`,
                    backdropFilter: "blur(16px)",
                }}>
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        color: "rgba(230, 225, 210, 0.88)",
                        fontFamily: "var(--font-header, 'Cinzel', serif)",
                        fontSize: "0.82rem",
                        letterSpacing: "0.08em",
                        lineHeight: 1.45,
                        textAlign: "center",
                        maxWidth: "420px",
                    }}>
                        {results && results.length > 0 && (
                            <div style={{
                                display: "flex",
                                flexWrap: "wrap",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "4px 8px",
                                fontSize: "0.78rem",
                                opacity: 0.95,
                            }}>
                                {results.map((v, i) => (
                                    <span key={i} style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {i > 0 ? <span style={{ opacity: 0.35 }}> · </span> : null}
                                        {v === 1 ? "+1" : v === -1 ? "−1" : "0"}
                                    </span>
                                ))}
                                <span style={{ opacity: 0.45, marginLeft: "2px" }}>→</span>
                                <span style={{ fontWeight: 600 }}>dado {fmtSigned(diceSum)}</span>
                            </div>
                        )}
                        {calculationBreakdown && (
                            <>
                                <div>Perícia ({fmtSigned(calculationBreakdown.baseSkillValue ?? 0)})</div>
                                {(calculationBreakdown.itemName ||
                                    (calculationBreakdown.itemBonusValue ?? 0) !== 0) && (
                                    <div>
                                        {calculationBreakdown.itemName
                                            ? `${calculationBreakdown.itemName} (${fmtSigned(
                                                  calculationBreakdown.itemBonusValue ?? 0
                                              )})`
                                            : `Item (${fmtSigned(calculationBreakdown.itemBonusValue ?? 0)})`}
                                    </div>
                                )}
                                <div>Bônus manual ({fmtSigned(calculationBreakdown.customModifierValue ?? 0)})</div>
                            </>
                        )}
                        {!calculationBreakdown && (
                            <div>Dado ({fmtSigned(diceSum)})</div>
                        )}
                    </div>
                    <span style={{
                        color: totalColor,
                        fontFamily: "var(--font-header, 'Cinzel', serif)",
                        fontSize: "clamp(3.2rem, 12vw, 5rem)",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        lineHeight: 1,
                        textShadow: `0 0 28px ${totalColor}88, 0 0 60px rgba(0,0,0,0.85)`,
                    }}>
                        {grandTotal > 0 ? `+${grandTotal}` : `${grandTotal}`}
                    </span>
                </div>
            )}

            {/* Painel de resultado legado (sem resultOverlay) */}
            {phase === "done" && results && !resultOverlay && (
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

                    {(hasModifiers || calculationBreakdown) && (
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "6px",
                            color: accentColor,
                            fontFamily: "var(--font-header, 'Cinzel', serif)",
                            fontSize: "0.95rem",
                            letterSpacing: "0.08em",
                            opacity: 0.9,
                            marginTop: "-4px",
                            marginBottom: "4px",
                            textAlign: "center",
                        }}>
                            <div>
                                {results.map((v, i) => (
                                    <span key={i} style={{ fontVariantNumeric: "tabular-nums" }}>
                                        {i > 0 ? <span style={{ opacity: 0.35 }}> · </span> : null}
                                        {v === 1 ? "+1" : v === -1 ? "−1" : "0"}
                                    </span>
                                ))}
                                <span style={{ opacity: 0.45 }}> → </span>
                                <span>dado {fmtSigned(diceSum)}</span>
                            </div>
                            {calculationBreakdown && (
                                <>
                                    <div>Perícia {fmtSigned(calculationBreakdown.baseSkillValue ?? 0)}</div>
                                    {(calculationBreakdown.itemName ||
                                        (calculationBreakdown.itemBonusValue ?? 0) !== 0) && (
                                        <div>
                                            {calculationBreakdown.itemName
                                                ? `${calculationBreakdown.itemName} ${fmtSigned(
                                                      calculationBreakdown.itemBonusValue ?? 0
                                                  )}`
                                                : `Item ${fmtSigned(calculationBreakdown.itemBonusValue ?? 0)}`}
                                        </div>
                                    )}
                                    <div>Bônus manual {fmtSigned(calculationBreakdown.customModifierValue ?? 0)}</div>
                                </>
                            )}
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
                        {(hasModifiers || calculationBreakdown) && (
                            <span style={{ fontSize: "1.4rem", opacity: 0.8 }}>Total =</span>
                        )}
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
