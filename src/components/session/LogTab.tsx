"use client";

import { ActionEvent } from "@/types/domain";
import { CombatLog } from "@/components/CombatLog";
import { SessionState } from "@/types/domain";
import { RotateCw } from "lucide-react";

interface LogTabProps {
    filteredEvents: ActionEvent[];
    logFilter: string;
    setLogFilter: (f: string) => void;
    logSessionFilter: number | null;
    setLogSessionFilter: (n: number | null) => void;
    logSessionNumbers: number[];
    eventSessionMap: Record<string, number>;
    state: SessionState;
    events: ActionEvent[];
    onRefresh?: () => void;
}

export function LogTab({ filteredEvents, logFilter, setLogFilter, logSessionFilter, setLogSessionFilter, logSessionNumbers, eventSessionMap, state, events, onRefresh }: LogTabProps) {
    return (
        <div className="log-display animate-reveal">
            <div className="display-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 className="display-title" style={{ margin: 0 }}>LOGS</h2>
                    {onRefresh && (
                        <button 
                            onClick={onRefresh}
                            className="refresh-btn"
                            title="Atualizar Logs"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--accent-color)',
                                cursor: 'pointer',
                                opacity: 0.6,
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                        >
                            <RotateCw size={14} />
                        </button>
                    )}
                </div>
                <div className="log-filters" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {[["ALL", "TUDO"], ["ROLLS", "ROLAGENS"], ["CHARS", "COMBATENTES"], ["ASPECTS", "INVOCAÇÕES"]].map(([f, label]) => (
                        <button
                            key={f}
                            className={`log-filter-btn ${logFilter === f ? "active" : ""}`}
                            onClick={() => setLogFilter(f)}
                        >
                            {label}
                        </button>
                    ))}
                    {logSessionNumbers.length > 1 && (
                        <select
                            value={logSessionFilter === null ? "all" : String(logSessionFilter)}
                            onChange={e => setLogSessionFilter(e.target.value === "all" ? null : Number(e.target.value))}
                            className="author-filter"
                            style={{ marginLeft: '4px' }}
                        >
                            <option value="all">TODAS AS SESSÕES</option>
                            {logSessionNumbers.map(sn => (
                                <option key={sn} value={String(sn)}>SESSÃO {sn}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>
            <div className="log-scroll solid ornate-border">
                {(() => {
                    const visibleSessions = logSessionFilter === null ? logSessionNumbers : logSessionNumbers.filter(sn => sn === logSessionFilter);
                    const showDividers = logSessionFilter === null && logSessionNumbers.length > 1;
                    return visibleSessions.map(sn => {
                        const sessionEvents = filteredEvents
                            .filter(e => (eventSessionMap[e.id] ?? 1) === sn)
                            .slice()
                            .reverse();
                        return (
                            <div key={sn}>
                                {showDividers && (
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: '12px',
                                        margin: '18px 0 12px', padding: '0 4px'
                                    }}>
                                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, var(--accent-color))' }} />
                                        <span style={{
                                            fontFamily: 'var(--font-header)', fontSize: '0.65rem',
                                            letterSpacing: '0.25em', color: 'var(--accent-color)',
                                            padding: '4px 14px', border: '1px solid var(--accent-color)',
                                            background: 'rgba(0,0,0,0.5)', whiteSpace: 'nowrap'
                                        }}>
                                            SESSÃO {sn}
                                        </span>
                                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, var(--accent-color))' }} />
                                    </div>
                                )}
                                {sessionEvents.map(event => (
                                    <div key={event.id} className="arcane-log-entry">
                                        <div className="entry-header">
                                            <span className="entry-type">
                                                {event.type === "ROLL_RESOLVED" ? "ROLAGEM DE DADOS" :
                                                    event.type === "FP_SPENT" ? "PONTO DE DESTINO GASTO" :
                                                        event.type === "FP_GAINED" ? "PONTO DE DESTINO GANHO" :
                                                            event.type === "CHARACTER_CREATED" ? "PERSONAGEM CRIADO" :
                                                                event.type === "CHARACTER_MOVED" ? "MOVIMENTAÇÃO" :
                                                                    event.type === "ASPECT_CREATED" ? "ASPECTO CRIADO" :
                                                                        event.type === "FREE_INVOKE_PRODUCED" ? "INVOCAÇÃO LIVRE GERADA" :
                                                                            event.type === "FREE_INVOKE_CONSUMED" ? "INVOCAÇÃO LIVRE USADA" :
                                                                                event.type === "STRESS_MARKED" ? "ESTRESSE MARCADO" :
                                                                                    event.type === "STRESS_CLEARED" ? "ESTRESSE LIMPO" :
                                                                                        event.type === "SESSION_CREATED" ? "SESSÃO INICIADA" :
                                                                                            event.type === "CHARACTER_SKILL_UPDATED" ? "PERÍCIA ATUALIZADA" :
                                                                                                event.type === "CHARACTER_STUNT_UPDATED" ? "FAÇANHA ATUALIZADA" :
                                                                                                    event.type.replace(/_/g, " ")}
                                            </span>
                                            <span className="entry-time">{new Date(event.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                        <div className="entry-body">
                                            <span className="actor">{event.actorUserId.toUpperCase()}</span>
                                            <div className="entry-details">
                                                {event.type === "ROLL_RESOLVED" && (
                                                    <div className="roll-tactical-data">
                                                        <div className="roll-intent">
                                                            <span className="intent-badge">
                                                                {event.payload.actionType === "OVERCOME" ? "SUPERAR" :
                                                                    event.payload.actionType === "ATTACK" ? "ATACAR" :
                                                                        event.payload.actionType === "DEFEND" ? "DEFENDER" : "CRIAR VANTAGEM"}
                                                            </span>
                                                            {event.payload.targetCharacterId && (
                                                                <span className="target">
                                                                    🎯 {state.characters[event.payload.targetCharacterId]?.name.toUpperCase() || "DESCONHECIDO"}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="roll-visual">
                                                            <span className="dice-raw">[{event.payload.dice.map((d: number) => d > 0 ? "+" : d < 0 ? "-" : "0").join("")}]</span>
                                                            <span className="mod">+{event.payload.modifier}</span>
                                                            <span className="total">TOTAL::{event.payload.total}</span>
                                                        </div>
                                                        {event.payload.note && <p className="note">"{event.payload.note}"</p>}
                                                    </div>
                                                )}
                                                {event.type === "FP_SPENT" && <span> PONTO DE DESTINO GASTO :: {event.payload.amount}</span>}
                                                {event.type === "FP_GAINED" && <span> PONTO DE DESTINO GANHO :: {event.payload.amount}</span>}
                                                {event.type === "CHARACTER_CREATED" && <span> PERSONAGEM CRIADO :: {event.payload.name.toUpperCase()}</span>}
                                                {event.type === "CHARACTER_MOVED" && <span> MOVIMENTAÇÃO REALIZADA </span>}
                                                {event.type === "ASPECT_CREATED" && <span> ASPECTO CRIADO :: {event.payload.name.toUpperCase()} ({event.payload.scope === "SCENE" ? "SESSÃO" : "SESSÃO"})</span>}
                                                {event.type === "FREE_INVOKE_PRODUCED" && <span> INVOCAÇÃO LIVRE GERADA :: {state.aspects[event.payload.aspectId]?.name.toUpperCase()}</span>}
                                                {event.type === "FREE_INVOKE_CONSUMED" && <span> INVOCAÇÃO LIVRE USADA :: {state.aspects[event.payload.aspectId]?.name.toUpperCase()}</span>}
                                                {event.type === "STRESS_MARKED" && <span> ESTRESSE MARCADO :: {event.payload.track === "PHYSICAL" ? "FÍSICO" : "MENTAL"} (BOX {event.payload.boxIndex + 1})</span>}
                                                {event.type === "CHARACTER_STUNT_UPDATED" && <span> FAÇANHA :: {event.payload.stunt.name.toUpperCase()} ({event.payload.stunt.cost} PD)</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
    );
}
