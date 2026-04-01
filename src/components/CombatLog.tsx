"use client";

import { ActionEvent, Character } from "@/types/domain";

interface CombatLogProps {
    events: ActionEvent[];
    characters: Record<string, Character>;
    sessionNumber?: number;
    onRefresh?: () => void;
}

import { RotateCw } from "lucide-react";

export function CombatLog({ events, characters, sessionNumber, onRefresh }: CombatLogProps) {
    // Determine the start of the current session: all events after the most recent SESSION_NUMBER_UPDATED
    const sessionBoundarySeq = (() => {
        const updates = events.filter(e => e.type === "SESSION_NUMBER_UPDATED");
        if (updates.length === 0) return null;
        const last = updates.reduce((a, b) => {
            const seqA = a.seq || 0, seqB = b.seq || 0;
            if (seqA && seqB) return seqA >= seqB ? a : b;
            return new Date(a.createdAt) >= new Date(b.createdAt) ? a : b;
        });
        return last.seq || last.createdAt;
    })();

    const currentSessionEvents = sessionBoundarySeq === null
        ? events
        : events.filter(e => {
            if (typeof sessionBoundarySeq === 'number') return (e.seq || 0) >= (sessionBoundarySeq as number);
            return new Date(e.createdAt) >= new Date(sessionBoundarySeq as string);
        });

    const getActorName = (event: ActionEvent) => {
        const charId = (event.payload as any)?.characterId;
        if (charId && characters[charId]) {
            return characters[charId].name.toUpperCase();
        }
        const ownedPc = Object.values(characters).find(c => c.ownerUserId === event.actorUserId && !c.isNPC);
        if (ownedPc) {
            return ownedPc.name.toUpperCase();
        }
        return event.actorUserId.toUpperCase();
    };

    return (
        <div className="combat-log-container solid ornate-border">
            <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {sessionNumber !== undefined && (
                    <span className="resonance-indicator">SESSÃO {sessionNumber}</span>
                )}
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
                            alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                    >
                        <RotateCw size={14} />
                    </button>
                )}
            </div>
            <div className="log-entries-scroll">
                {currentSessionEvents
                    .filter(e =>
                        ["ROLL_RESOLVED", "FP_SPENT", "FP_GAINED", "CHARACTER_CREATED", "STRESS_MARKED", "COMBAT_OUTCOME"].includes(e.type) ||
                        e.type.includes("ASPECT_CREATED")
                    )
                    .slice()
                    .reverse()
                    .map(event => (
                        <div key={event.id} className="combat-entry animate-fade-in">
                            <div className="entry-meta">
                                <span className="time">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                <span className="actor">{getActorName(event)}</span>
                            </div>

                            <div className="entry-content">
                                {event.type === "ROLL_RESOLVED" && (
                                    <div className="roll-data">
                                        <div className="roll-header">
                                            {event.payload.challengeDescription ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', color: '#c5a059' }}>
                                                    <span className="actor" style={{ fontWeight: 'bold' }}>
                                                        {characters[event.payload.characterId]?.name.toUpperCase() || "JOGADOR"}
                                                    </span>
                                                    <span>
                                                        {(() => {
                                                            const diff = event.payload.total - (event.payload.targetDiff || 0);
                                                            return diff >= 0 ? " conseguiu " : " não conseguiu ";
                                                        })()}
                                                    </span>
                                                    <span className={`action-type-text`} style={{ textTransform: 'lowercase' }}>
                                                        {event.payload.actionType === "OVERCOME" ? "superar" :
                                                            event.payload.actionType === "ATTACK" ? "atacar" :
                                                                event.payload.actionType === "DEFEND" ? "defender" : "criar vantagem"}
                                                    </span>
                                                    <span> a(o) </span>
                                                    <span className="target" style={{ fontStyle: 'italic' }}>
                                                        {event.payload.challengeDescription}
                                                    </span>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className={`action-type ${event.payload.actionType}`}>
                                                        {event.payload.actionType === "OVERCOME" ? "SUPERAR" :
                                                            event.payload.actionType === "ATTACK" ? "ATACAR" :
                                                                event.payload.actionType === "DEFEND" ? "DEFENDER" : "CRIAR VANTAGEM"}
                                                    </span>
                                                    {event.payload.targetCharacterIds?.length ? (
                                                        <span className="target">
                                                            ➔ {event.payload.targetCharacterIds.map((id: string) => characters[id]?.name.toUpperCase() || "ALVO").join(", ")}
                                                        </span>
                                                    ) : event.payload.targetCharacterId && (
                                                        <span className="target">
                                                            ➔ {characters[event.payload.targetCharacterId]?.name.toUpperCase() || "ALVO"}
                                                        </span>
                                                    )}
                                                    {event.payload.damageType && (
                                                        <span style={{ marginLeft: '8px', opacity: 0.8 }} title={event.payload.damageType === "PHYSICAL" ? "Ação Física" : "Ação Mental"}>
                                                            {event.payload.damageType === "PHYSICAL" ? "💪" : "🧠"}
                                                        </span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <div className="roll-math" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                                            <span className="dice" title="Dados FATE">
                                                {event.payload.dice.map((d: number) => d > 0 ? "+" : d < 0 ? "-" : "0").join("")}
                                                <span className="val">({event.payload.diceSum >= 0 ? `+${event.payload.diceSum}` : event.payload.diceSum})</span>
                                            </span>

                                            {event.payload.skill && (
                                                <span className="mod skill" title={`Perícia: ${event.payload.skill.name}`}>
                                                    +{event.payload.skill.rank}
                                                </span>
                                            )}

                                            {event.payload.manualBonus !== undefined && event.payload.manualBonus !== 0 && (
                                                <span className="mod bonus" title="Bônus Manual" style={{ color: '#4db8ff', fontWeight: 'bold' }}>
                                                    {event.payload.manualBonus >= 0 ? `+${event.payload.manualBonus}` : event.payload.manualBonus}
                                                </span>
                                            )}

                                            {event.payload.item && (
                                                <span className="mod item" title={`Item: ${event.payload.item.name}`} style={{ color: '#4db8ff', fontWeight: 'bold' }}>
                                                    {event.payload.item.bonus >= 0 ? `+${event.payload.item.bonus}` : event.payload.item.bonus}
                                                </span>
                                            )}

                                            {!event.payload.skill && !event.payload.manualBonus && !event.payload.item && event.payload.modifier !== 0 && (
                                                <span className="mod">{event.payload.modifier >= 0 ? `+${event.payload.modifier}` : event.payload.modifier}</span>
                                            )}

                                            <span className="total"> = {event.payload.total}</span>
                                        </div>
                                        {event.payload.targetDiff !== undefined && (
                                            <div className="roll-result-outcome" style={{ marginTop: '5px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                {(() => {
                                                    const diff = event.payload.total - (event.payload.targetDiff || 0);
                                                    if (diff >= 3) return <span style={{ color: '#00cc88', textShadow: '0 0 10px rgba(0,204,136,0.5)' }}>SUCESSO COM ESTILO!</span>;
                                                    if (diff >= 0) return <span style={{ color: '#00cc88' }}>SUCESSO</span>;
                                                    if (diff <= -3) return <span style={{ color: '#ff3333', textShadow: '0 0 10px rgba(255,51,51,0.5)' }}>FRACASSO TERRÍVEL!</span>;
                                                    return <span style={{ color: '#ff3333' }}>FRACASSO</span>;
                                                })()}
                                                <span style={{ opacity: 0.5, marginLeft: '8px', fontSize: '0.7rem' }}>(Dif. {event.payload.targetDiff})</span>
                                            </div>
                                        )}
                                        {event.payload.note && <p className="note">"{event.payload.note}"</p>}
                                    </div>
                                )}

                                {event.type === "FP_SPENT" && <div className="event-msg spent">Gasta Ponto de Destino: {(event.payload as any).amount}</div>}
                                {event.type === "FP_GAINED" && <div className="event-msg gained">Ganha Ponto de Destino: {(event.payload as any).amount}</div>}
                                {event.type === "CHARACTER_CREATED" && <div className="event-msg">Novo combatente entra no conflito: {(event.payload as any).name?.toUpperCase()}</div>}
                                {event.type === "STRESS_MARKED" && (
                                    <div className="event-msg damage">
                                        Dano causado em {(event.payload as any).characterId ? characters[(event.payload as any).characterId]?.name.toUpperCase() : "Alvo"} :: {(event.payload as any).track === "PHYSICAL" ? "FÍSICO" : "MENTAL"}
                                    </div>
                                )}
                                {event.type.includes("ASPECT_CREATED") && <div className="event-msg aspect">Nova verdade manifestada: {(event.payload as any).name?.toUpperCase()}</div>}
                                {event.type === "COMBAT_OUTCOME" && (
                                    <div className="event-msg outcome" style={{
                                        padding: '8px 12px',
                                        background: 'rgba(168, 85, 247, 0.1)',
                                        borderLeft: '2px solid #a855f7',
                                        marginTop: '4px',
                                        fontSize: '0.85rem',
                                        fontWeight: 'bold',
                                        color: (event.payload as any).result > 0 ? '#ff4d4d' : (event.payload as any).result < 0 ? '#4ade80' : '#c5a059'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ textShadow: '0 0 10px rgba(0,0,0,0.5)' }}>{(event.payload as any).message}</span>
                                            <span style={{ opacity: 0.6, fontSize: '0.7rem', color: '#fff' }}>
                                                {(event.payload as any).attackTotal} ATK vs {(event.payload as any).defenseTotal} DEF
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                {currentSessionEvents.filter(e =>
                    ["ROLL_RESOLVED", "FP_SPENT", "FP_GAINED", "CHARACTER_CREATED", "STRESS_MARKED", "COMBAT_OUTCOME"].includes(e.type) ||
                    e.type.includes("ASPECT_CREATED")
                ).length === 0 && (
                    <div className="empty-log">Aguardando reverberações do destino...</div>
                )}
            </div>

            <style jsx>{`
                .combat-log-container {
                    background: rgba(5, 5, 5, 0.75);
                    display: flex;
                    flex-direction: column;
                    border: 1px solid var(--border-color);
                    box-shadow: inset 0 0 40px rgba(0,0,0,0.4);
                }

                @media (max-width: 768px) {
                    .combat-log-container {
                        max-height: 400px;
                    }
                    .log-entries-scroll {
                        padding: 12px;
                    }
                }

                .log-header {
                    padding: 12px 20px;
                    border-bottom: 1px solid rgba(197, 160, 89, 0.1);
                    background: rgba(197, 160, 89, 0.02);
                }

                .resonance-indicator {
                    font-family: var(--font-header);
                    font-size: 0.6rem;
                    letter-spacing: 0.4em;
                    color: var(--accent-color);
                    opacity: 0.8;
                }

                .log-entries-scroll {
                    flex-grow: 1;
                    overflow-y: auto;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .combat-entry {
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(197, 160, 89, 0.05);
                }

                .entry-meta {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                    font-family: var(--font-header);
                    font-size: 0.55rem;
                    letter-spacing: 0.1em;
                }

                .time { color: var(--text-secondary); opacity: 0.5; }
                .actor { color: var(--accent-color); opacity: 0.7; }

                .entry-content {
                    font-family: var(--font-main);
                    font-size: 0.75rem;
                }

                .roll-data {
                    background: rgba(197, 160, 89, 0.02);
                    padding: 12px;
                    border-left: 2px solid var(--accent-color);
                }

                .roll-header {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 8px;
                    font-family: var(--font-header);
                    font-size: 0.65rem;
                    letter-spacing: 0.1em;
                }

                .action-type.ATTACK { color: #ff3333; }
                .action-type.DEFEND { color: #33ccff; }
                .target { opacity: 0.6; }

                .roll-math {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                }

                .dice { font-family: serif; font-size: 1.2rem; letter-spacing: 4px; color: var(--accent-color); }
                .total { font-family: var(--font-header); font-size: 1.1rem; color: var(--secondary-color); font-weight: bold; }

                .note {
                    font-style: italic;
                    opacity: 0.6;
                    font-size: 0.75rem;
                    margin-top: 8px;
                }

                .event-msg {
                    padding: 4px 0;
                    color: var(--text-primary);
                    opacity: 0.9;
                }

                .event-msg.spent { color: #ff8800; }
                .event-msg.gained { color: #00cc88; }
                .event-msg.aspect { color: var(--accent-color); font-weight: bold; }
                .event-msg.damage { color: #ff3333; font-style: italic; }

                .empty-log {
                    text-align: center;
                    opacity: 0.3;
                    font-family: var(--font-narrative);
                    padding-top: 40px;
                }

                .animate-fade-in {
                    animation: fadeIn 0.4s ease-out forwards;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </div>
    );
}
