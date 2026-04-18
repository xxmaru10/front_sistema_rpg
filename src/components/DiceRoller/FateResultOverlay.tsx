/**
 * Componente de Overlay para o FateDice3D.
 * Exibe instruÃƒÂ§ÃƒÂµes, botÃƒÂµes de aÃƒÂ§ÃƒÂ£o e o resultado final com estÃƒÂ©tica neon.
 */

import React from "react";
import { Play, Pencil, Trash2, X, AlertCircle } from "lucide-react";
import { DiceBreakdownEntry, DicePoolEntry, DieType } from "@/types/domain";
import { useState, useMemo, useEffect } from "react";
import type { DiceResultOverlayMode } from "@/lib/diceSimulationStore";

interface FateResultOverlayProps {
    phase: "idle" | "held" | "thrown" | "snapping" | "done";
    results: number[] | null;
    breakdown?: DiceBreakdownEntry[] | null;
    dicePool: DicePoolEntry[];
    onPoolChange: (pool: DicePoolEntry[]) => void;
    accentColor: string;
    dangerColor: string;
    onAutoRoll: () => void;
    onManualExpressionRoll?: (expression: string) => string | null;
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
        8: "LendÃƒÂ¡rio", 7: "Ãƒâ€°pico", 6: "FantÃƒÂ¡stico", 5: "Excelente",
        4: "Ãƒâ€œtimo", 3: "Bom", 2: "RazoÃƒÂ¡vel", 1: "Mediano",
        0: "MedÃƒÂ­ocre", [-1]: "Pobre", [-2]: "TerrÃƒÂ­vel",
    };
    if (sum > 8) return "Divino";
    if (sum < -2) return "CatastrÃƒÂ³fico";
    return L[sum] || "N/A";
}

function renderDieValue(type: DieType, value: number): string {
    if (type === "dF") return value > 0 ? "+1" : value < 0 ? "-1" : "0";
    return String(value);
}

export const FateResultOverlay: React.FC<FateResultOverlayProps> = ({
    phase,
    results,
    breakdown,
    dicePool,
    onPoolChange,
    accentColor,
    dangerColor,
    onAutoRoll,
    onManualExpressionRoll,
    calculationBreakdown,
    resultOverlay,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [limitToast, setLimitToast] = useState(false);
    const [isManualInputOpen, setIsManualInputOpen] = useState(false);
    const [manualExpression, setManualExpression] = useState("");
    const [manualError, setManualError] = useState<string | null>(null);

    useEffect(() => {
        if (phase !== "idle" && isEditing) {
            setIsEditing(false);
            setIsManualInputOpen(false);
            setManualError(null);
        }
    }, [phase, isEditing]);

    const totalDiceCount = useMemo(() => dicePool.reduce((acc, curr) => acc + curr.count, 0), [dicePool]);

    const notationText = useMemo(() => {
        if (totalDiceCount === 0) return "Caixa vazia selecione um tipo de dado";
        return dicePool
            .filter(p => p.count > 0)
            .sort((a, b) => {
                const order: DieType[] = ["dF", "d4", "d6", "d8", "d10", "d12", "d20", "d100"];
                return order.indexOf(a.type) - order.indexOf(b.type);
            })
            .map(p => `${p.count}${p.type}`)
            .join(" + ");
    }, [dicePool, totalDiceCount]);

    const handleAddDie = (type: DieType) => {
        if (totalDiceCount >= 40) {
            setLimitToast(true);
            setTimeout(() => setLimitToast(false), 1500);
            return;
        }
        const newPool = [...dicePool];
        const idx = newPool.findIndex(p => p.type === type);
        if (idx >= 0) {
            newPool[idx] = { ...newPool[idx], count: newPool[idx].count + 1 };
        } else {
            newPool.push({ type, count: 1 });
        }
        onPoolChange(newPool);
    };

    const handleClear = () => {
        onPoolChange([]);
    };

    const submitManualExpression = () => {
        const expression = manualExpression.trim();
        if (!expression) {
            setManualError("Digite uma expressão, ex: 2d6+d20");
            return;
        }

        const maybeError = onManualExpressionRoll?.(expression);
        if (maybeError) {
            setManualError(maybeError);
            return;
        }

        setManualError(null);
        setManualExpression("");
        setIsManualInputOpen(false);
        setIsEditing(false);
    };

    const blockPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const blockClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const label =
        phase === "idle"     ? "CLIQUE E SEGURE PARA PEGAR OS DADOS" :
        phase === "held"     ? "MOVA PARA BALANÃƒâ€¡AR  Ã‚Â·  SOLTE PARA LANÃƒâ€¡AR" :
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
            {/* Interface de CÃƒÂ¢mara (Idle) Ã¢â‚¬â€ Unifica BotÃƒÂ£o, InstruÃƒÂ§ÃƒÂ£o e Dados */}
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
                    pointerEvents: "none", // Container principal nÃƒÂ£o bloqueia cliques
                }}>
                    {/* Toolbar de ediÃƒÂ§ÃƒÂ£o e notaÃƒÂ§ÃƒÂ£o */}
                    <div style={{
                        position: "absolute",
                        top: "16px",
                        left: "16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        pointerEvents: "auto",
                    }}>
                        {/* BotÃƒÂ£o de LÃƒÂ¡pis */}
                        <button
                            onMouseDown={blockPointerDown}
                            onTouchStart={blockPointerDown}
                            onClick={(e) => {
                                blockClick(e);
                                onAutoRoll();
                            }}
                            style={{
                                background: "rgba(0,0,0,0.45)",
                                border: `1px solid ${accentColor}33`,
                                borderRadius: "8px",
                                color: accentColor,
                                width: "36px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "all 0.3s cubic-bezier(0.19, 1, 0.22, 1)",
                                boxShadow: `0 2px 8px rgba(0,0,0,0.4)`,
                                padding: "8px"
                            }}
                            title="Rolar automaticamente"
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = accentColor;
                                e.currentTarget.style.background = `${accentColor}22`;
                                e.currentTarget.style.transform = "scale(1.08)";
                                e.currentTarget.style.boxShadow = `0 0 16px ${accentColor}44`;
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = `${accentColor}33`;
                                e.currentTarget.style.background = "rgba(0,0,0,0.45)";
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.boxShadow = `0 2px 8px rgba(0,0,0,0.4)`;
                            }}
                        >
                            <Play size={16} fill="currentColor" style={{ marginLeft: "1px" }} />
                        </button>
                        <button
                            onMouseDown={blockPointerDown}
                            onTouchStart={blockPointerDown}
                            onClick={(e) => {
                                blockClick(e);
                                setIsEditing((prev) => {
                                    const next = !prev;
                                    if (!next) {
                                        setIsManualInputOpen(false);
                                        setManualError(null);
                                    }
                                    return next;
                                });
                            }}
                            style={{
                                background: isEditing ? `${accentColor}22` : "rgba(0,0,0,0.45)",
                                border: `1px solid ${isEditing ? accentColor : accentColor + "33"}`,
                                borderRadius: "8px",
                                color: accentColor,
                                width: "36px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "all 0.3s cubic-bezier(0.19, 1, 0.22, 1)",
                                boxShadow: `0 2px 8px rgba(0,0,0,0.4)`,
                                padding: "8px"
                            }}
                            title="Editar pool de dados"
                        >
                            <Pencil size={18} />
                        </button>
                    </div>

                    {/* NotaÃƒÂ§ÃƒÂ£o Viva */}
                    <div style={{
                        position: "absolute",
                        top: "16px",
                        right: "16px",
                        transform: "none",
                        textAlign: "right",
                        fontFamily: "var(--font-header, 'Cinzel', serif)",
                        fontSize: "0.82rem",
                        color: totalDiceCount === 0 ? "rgba(230, 225, 210, 0.4)" : accentColor,
                        textTransform: "uppercase",
                        letterSpacing: "0.15em",
                        whiteSpace: "nowrap",
                        padding: "4px 16px",
                        background: "rgba(10, 10, 15, 0.85)",
                        borderRadius: "20px",
                        border: `1px solid ${totalDiceCount === 40 ? '#f97316' : accentColor}33`,
                        boxShadow: totalDiceCount === 40 ? `0 0 15px rgba(249, 115, 22, 0.2)` : `0 0 10px ${accentColor}11`,
                        backdropFilter: "blur(4px)",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "all 0.3s ease",
                        pointerEvents: "auto",
                    }}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onMouseUp={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}>
                        {notationText}
                        {isEditing && totalDiceCount > 0 && (
                            <button
                                onMouseDown={blockPointerDown}
                                onTouchStart={blockPointerDown}
                                onClick={(e) => {
                                    blockClick(e);
                                    handleClear();
                                }}
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    color: "#ff4444",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    padding: "4px",
                                    marginLeft: "4px",
                                    borderRadius: "4px",
                                    transition: "background 0.2s",
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 68, 68, 0.15)"}
                                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                title="Limpar caixa"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>

                    {/* Painel Seletor de Dados (Glass Mode) */}
                    {isEditing && (
                        <div style={{
                            position: "absolute",
                            top: "60px",
                            left: "16px",
                            width: "200px",
                            background: "rgba(15, 15, 25, 0.92)",
                            backdropFilter: "blur(12px)",
                            border: `1px solid ${accentColor}44`,
                            borderRadius: "16px",
                            boxShadow: `0 10px 30px rgba(0,0,0,0.8), 0 0 20px ${accentColor}11`,
                            padding: "16px",
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "8px",
                            pointerEvents: "auto",
                            zIndex: 20,
                            animation: "panelFadeIn 0.3s cubic-bezier(0.19, 1, 0.22, 1)",
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onClick={(e) => e.stopPropagation()}>
                             <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                <span style={{ color: "rgba(230,225,210,0.5)", fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em" }}>Pool de Dados</span>
                                <button
                                    onMouseDown={blockPointerDown}
                                    onTouchStart={blockPointerDown}
                                    onClick={(e) => {
                                        blockClick(e);
                                        setIsEditing(false);
                                    }}
                                    style={{ background: "transparent", border: "none", color: "rgba(230,225,210,0.4)", cursor: "pointer" }}
                                >
                                    <X size={14} />
                                </button>
                             </div>
                             {(["dF", "d4", "d6", "d8", "d10", "d12", "d20", "d100"] as DieType[]).map(type => (
                                <button
                                    key={type}
                                    onMouseDown={blockPointerDown}
                                    onTouchStart={blockPointerDown}
                                    onClick={(e) => {
                                        blockClick(e);
                                        handleAddDie(type);
                                    }}
                                    style={{
                                        background: "rgba(255,255,255,0.03)",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        borderRadius: "8px",
                                        padding: "8px 4px",
                                        color: "rgba(230,225,210,0.9)",
                                        fontFamily: "var(--font-header, 'Cinzel', serif)",
                                        fontSize: "0.75rem",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: "2px"
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                                        e.currentTarget.style.borderColor = `${accentColor}66`;
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                                    }}
                                >
                                    <span style={{ fontSize: "1rem", color: accentColor }}>{type === "dF" ? "F" : "#"}</span>
                                    {type}
                                </button>
                             ))}
                             <button
                                onMouseDown={blockPointerDown}
                                onTouchStart={blockPointerDown}
                                onClick={(e) => {
                                    blockClick(e);
                                    setIsManualInputOpen((prev) => !prev);
                                    setManualError(null);
                                }}
                                style={{
                                    gridColumn: "1 / -1",
                                    background: isManualInputOpen ? `${accentColor}22` : "rgba(255,255,255,0.05)",
                                    border: `1px solid ${isManualInputOpen ? accentColor : "rgba(255,255,255,0.12)"}`,
                                    borderRadius: "8px",
                                    padding: "8px 10px",
                                    color: "rgba(230,225,210,0.95)",
                                    fontFamily: "var(--font-header, 'Cinzel', serif)",
                                    fontSize: "0.72rem",
                                    letterSpacing: "0.12em",
                                    cursor: "pointer",
                                    transition: "all 0.2s",
                                    textTransform: "uppercase",
                                }}
                                title="Digitar expressão de dados sem 3D"
                            >
                                + Digitar dado
                            </button>
                            {isManualInputOpen && (
                                <div
                                    style={{
                                        gridColumn: "1 / -1",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "8px",
                                        marginTop: "4px",
                                    }}
                                    onMouseDown={blockPointerDown}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <input
                                        value={manualExpression}
                                        onChange={(e) => {
                                            setManualExpression(e.target.value);
                                            if (manualError) setManualError(null);
                                        }}
                                        onMouseDown={blockPointerDown}
                                        onTouchStart={blockPointerDown}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                submitManualExpression();
                                            }
                                        }}
                                        placeholder="Ex: 2d6+d20+4"
                                        style={{
                                            width: "100%",
                                            borderRadius: "8px",
                                            border: `1px solid ${accentColor}44`,
                                            background: "rgba(0,0,0,0.4)",
                                            color: "rgba(230,225,210,0.95)",
                                            padding: "8px 10px",
                                            fontFamily: "var(--font-main, serif)",
                                            fontSize: "0.78rem",
                                            outline: "none",
                                        }}
                                    />
                                    <button
                                        onMouseDown={blockPointerDown}
                                        onTouchStart={blockPointerDown}
                                        onClick={(e) => {
                                            blockClick(e);
                                            submitManualExpression();
                                        }}
                                        style={{
                                            width: "100%",
                                            borderRadius: "8px",
                                            border: `1px solid ${accentColor}66`,
                                            background: `${accentColor}22`,
                                            color: accentColor,
                                            padding: "8px 10px",
                                            fontFamily: "var(--font-header, 'Cinzel', serif)",
                                            fontSize: "0.72rem",
                                            textTransform: "uppercase",
                                            letterSpacing: "0.12em",
                                            cursor: "pointer",
                                        }}
                                    >
                                        Rolar resultado
                                    </button>
                                    {manualError && (
                                        <div style={{
                                            color: "#ff8a8a",
                                            fontSize: "0.68rem",
                                            lineHeight: 1.3,
                                            fontFamily: "var(--font-main, serif)",
                                        }}>
                                            {manualError}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Toast de Limite */}
                    {limitToast && (
                        <div style={{
                            position: "absolute",
                            top: "-80px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "rgba(249, 115, 22, 0.95)",
                            color: "#fff",
                            padding: "8px 16px",
                            borderRadius: "8px",
                            fontSize: "0.75rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 4px 15px rgba(0,0,0,0.4)",
                            animation: "toastFadeIn 0.3s ease",
                            zIndex: 100,
                        }}>
                             <AlertCircle size={14} />
                             LIMITE ATINGIDO: 40 DADOS
                        </div>
                    )}



                    <div style={{ flex: 1 }} /> {/* EspaÃƒÂ§o para os dados 3D ficarem no meio */}

                    {/* Label de instruÃƒÂ§ÃƒÂ£o interno */}
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

            {/* Labels para outras fases (que nÃƒÂ£o idle) */}
            {phase !== "idle" && label && (
                <div style={{
                    position: "absolute",
                    bottom: "12%",
                        right: "16px",
                        transform: "none",
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

            {/* Painel de resultado apÃƒÂ³s 3D: compacto (Arena / desafio) */}
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
                    gap: "14px",
                    pointerEvents: "none",
                    animation: "resultReveal 0.6s cubic-bezier(0.19, 1, 0.22, 1)",
                    background: "rgba(5, 5, 8, 0.98)",
                    padding: "28px 48px 36px",
                    borderRadius: "28px",
                    minWidth: "300px",
                    border: `1px solid ${totalColor}66`,
                    boxShadow: `0 0 80px rgba(0,0,0,0.9), 0 0 40px ${totalColor}33`,
                    backdropFilter: "blur(16px)",
                }}>
                    {/* Breakdown section Ã¢â‚¬â€ cÃƒÂ¡lculos no topo */}
                    <div style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        width: "100%",
                    }}>
                        {/* Linha dos dados individuais */}
                        {results && results.length > 0 && (
                            <div style={{
                                display: "flex",
                                flexWrap: "wrap",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "4px 6px",
                                fontFamily: "var(--font-header, 'Cinzel', serif)",
                                fontSize: "0.88rem",
                                color: "rgba(230, 225, 210, 0.75)",
                                letterSpacing: "0.06em",
                                paddingBottom: "4px",
                                borderBottom: "1px solid rgba(255,255,255,0.08)",
                            }}>
                                {breakdown && breakdown.length > 0 ? (
                                    breakdown.map((entry, entryIndex) => (
                                        <span
                                            key={`${entry.type}-${entryIndex}`}
                                            style={{ display: "flex", alignItems: "center", gap: "4px" }}
                                        >
                                            {entryIndex > 0 ? <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 2px" }}>+</span> : null}
                                            <span style={{ color: "rgba(230,225,210,0.55)", fontSize: "0.72rem" }}>
                                                {entry.values.length}{entry.type}
                                            </span>
                                            <span style={{ color: "rgba(230,225,210,0.88)" }}>
                                                [{entry.values.map((v) => renderDieValue(entry.type, v)).join(" ")}]
                                            </span>
                                        </span>
                                    ))
                                ) : (
                                    results.map((v, i) => (
                                        <span key={i} style={{
                                            fontVariantNumeric: "tabular-nums",
                                            color: v === 1 ? accentColor : v === -1 ? "#ff6666" : "rgba(230,225,210,0.4)",
                                        }}>
                                            {i > 0 ? <span style={{ color: "rgba(255,255,255,0.2)", margin: "0 2px" }}>.</span> : null}
                                            {v === 1 ? "+1" : v === -1 ? "-1" : "0"}
                                        </span>
                                    ))
                                )}
                                <span style={{ color: "rgba(255,255,255,0.25)", margin: "0 4px" }}>-&gt;</span>
                                <span style={{ color: "rgba(230,225,210,0.9)", fontWeight: 600 }}>
                                    dado {fmtSigned(diceSum)}
                                </span>
                            </div>
                        )}

                        {/* Modificadores Ã¢â‚¬â€ sÃƒÂ³ mostra os nÃƒÂ£o-zero */}
                        {calculationBreakdown && (() => {
                            const skillVal = calculationBreakdown.baseSkillValue ?? 0;
                            const itemVal = calculationBreakdown.itemBonusValue ?? 0;
                            const bonusVal = calculationBreakdown.customModifierValue ?? 0;
                            const lines: { label: string; value: number }[] = [];
                            if (skillVal !== 0) lines.push({ label: "PerÃƒÂ­cia", value: skillVal });
                            if (itemVal !== 0 || calculationBreakdown.itemName) {
                                lines.push({
                                    label: calculationBreakdown.itemName || "Item",
                                    value: itemVal,
                                });
                            }
                            if (bonusVal !== 0) lines.push({ label: "BÃƒÂ´nus", value: bonusVal });
                            if (lines.length === 0) return null;
                            return (
                                <div style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "3px",
                                    paddingTop: "4px",
                                }}>
                                    {lines.map(({ label, value }) => (
                                        <div key={label} style={{
                                            fontFamily: "var(--font-header, 'Cinzel', serif)",
                                            fontSize: "0.9rem",
                                            color: "rgba(230, 225, 210, 0.85)",
                                            letterSpacing: "0.06em",
                                        }}>
                                            {label}{" "}
                                            <span style={{
                                                color: value > 0 ? accentColor : value < 0 ? "#ff6666" : "rgba(230,225,210,0.5)",
                                                fontWeight: 700,
                                            }}>
                                                {fmtSigned(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>

                    {/* Separador */}
                    <div style={{
                        width: "60%",
                        height: "1px",
                        background: `linear-gradient(to right, transparent, ${totalColor}66, transparent)`,
                    }} />

                    {/* Total grande */}
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

                    {/* RÃƒÂ³tulo da escada */}
                    <div style={{
                        fontFamily: "var(--font-header, 'Cinzel', serif)",
                        fontSize: "0.72rem",
                        letterSpacing: "0.28em",
                        textTransform: "uppercase",
                        color: totalColor,
                        opacity: 0.65,
                    }}>
                        {ladderLabel(grandTotal).toUpperCase()}
                    </div>
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
                                    {v === 1 ? "+" : v === -1 ? "Ã¢Ë†â€™" : "Ã¢â€”Â"}
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
                                        {i > 0 ? <span style={{ opacity: 0.35 }}> Ã‚Â· </span> : null}
                                        {v === 1 ? "+1" : v === -1 ? "Ã¢Ë†â€™1" : "0"}
                                    </span>
                                ))}
                                <span style={{ opacity: 0.45 }}> Ã¢â€ â€™ </span>
                                <span>dado {fmtSigned(diceSum)}</span>
                            </div>
                            {calculationBreakdown && (
                                <>
                                    <div>PerÃƒÂ­cia {fmtSigned(calculationBreakdown.baseSkillValue ?? 0)}</div>
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
                                    <div>BÃƒÂ´nus manual {fmtSigned(calculationBreakdown.customModifierValue ?? 0)}</div>
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
                @keyframes panelFadeIn {
                    from { opacity: 0; transform: translateY(10px) scale(0.95); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes toastFadeIn {
                    from { opacity: 0; transform: translate(-50%, 10px); }
                    to   { opacity: 1; transform: translate(-50%, 0); }
                }
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
