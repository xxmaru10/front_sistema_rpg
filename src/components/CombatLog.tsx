"use client";

import { ActionEvent, Character } from "@/types/domain";

interface CombatLogProps {
    events: ActionEvent[];
    characters: Record<string, Character>;
    sessionNumber?: number;
    eventSessionMap?: Record<string, number>;
    isRefreshing?: boolean;
    onRefresh?: () => void;
    compact?: boolean;
}

import { RotateCw } from "lucide-react";

export function CombatLog({ events, characters, sessionNumber, eventSessionMap, isRefreshing, onRefresh, compact = false }: CombatLogProps) {
    const currentSessionEvents = sessionNumber === undefined
        ? events
        : events.filter(e => (eventSessionMap?.[e.id] ?? sessionNumber ?? 1) === sessionNumber);

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

    const getActionLabel = (actionType: string) => {
        if (actionType === "OVERCOME") return "SUPERAR";
        if (actionType === "ATTACK") return "ATACAR";
        if (actionType === "DEFEND") return "DEFENDER";
        if (actionType === "CREATE_ADVANTAGE") return "VANTAGEM";
        return actionType;
    };

    const normalizeLabel = (value: string) =>
        value
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();

    const shouldHideChallengeLabel = (value?: string) => {
        if (!value) return false;
        const normalized = normalizeLabel(value);
        return normalized === "exploracao" || normalized === "combate";
    };

    const getCompactRollMeta = (event: ActionEvent) => {
        if (event.type !== "ROLL_RESOLVED") return null;

        const payload = event.payload as any;
        const actionLabel = getActionLabel(payload.actionType || "");
        const rawTargetLabel = payload.challengeDescription
            || payload.targetCharacterIds?.map((id: string) => characters[id]?.name.toUpperCase() || "ALVO").join(", ")
            || (payload.targetCharacterId ? characters[payload.targetCharacterId]?.name.toUpperCase() || "ALVO" : "");
        const targetLabel = shouldHideChallengeLabel(rawTargetLabel) ? "" : (rawTargetLabel || "");
        const diceFaces = Array.isArray(payload.dice)
            ? payload.dice.map((d: number) => (d > 0 ? "+" : d < 0 ? "-" : "0")).join("")
            : "";

        const modifiers: string[] = [];
        if (payload.skill?.rank) {
            modifiers.push(`PER ${payload.skill.rank >= 0 ? `+${payload.skill.rank}` : payload.skill.rank}`);
        }
        if (payload.item?.bonus) {
            modifiers.push(`ITEM ${payload.item.bonus >= 0 ? `+${payload.item.bonus}` : payload.item.bonus}`);
        }
        if (payload.manualBonus) {
            modifiers.push(`BONUS ${payload.manualBonus >= 0 ? `+${payload.manualBonus}` : payload.manualBonus}`);
        }

        const diff = payload.targetDiff !== undefined
            ? payload.total - (payload.targetDiff || 0)
            : payload.total;
        const isSuccess = diff >= 0;

        return {
            actionLabel,
            targetLabel,
            diceFaces,
            modifierText: modifiers.join(" "),
            outcomeLabel: isSuccess ? "Sucesso" : "Fracasso",
            isSuccess,
            totalLabel: payload.total >= 0 ? `+${payload.total}` : String(payload.total),
        };
    };

    const getCompactSummary = (event: ActionEvent) => {
        if (event.type === "ROLL_RESOLVED") {
            const payload = event.payload as any;
            const action = getActionLabel(payload.actionType || "");
            const targetLabel = payload.challengeDescription
                || payload.targetCharacterIds?.map((id: string) => characters[id]?.name.toUpperCase() || "ALVO").join(", ")
                || (payload.targetCharacterId ? characters[payload.targetCharacterId]?.name.toUpperCase() || "ALVO" : "");
            const diceFaces = Array.isArray(payload.dice)
                ? payload.dice.map((d: number) => d > 0 ? "+" : d < 0 ? "-" : "0").join("")
                : "";
            const skillMod = payload.skill?.rank ? ` Per ${payload.skill.rank >= 0 ? `+${payload.skill.rank}` : payload.skill.rank}` : "";
            const itemMod = payload.item?.bonus ? ` Item ${payload.item.bonus >= 0 ? `+${payload.item.bonus}` : payload.item.bonus}` : "";
            const bonusMod = payload.manualBonus ? ` Bônus ${payload.manualBonus >= 0 ? `+${payload.manualBonus}` : payload.manualBonus}` : "";

            let outcome = "";
            if (payload.targetDiff !== undefined) {
                const diff = payload.total - (payload.targetDiff || 0);
                outcome = diff >= 0 ? "Sucesso" : "Fracasso";
            }

            return `${action}${targetLabel ? ` • ${targetLabel}` : ""} • ${diceFaces}${skillMod}${itemMod}${bonusMod}${outcome ? ` • ${outcome}` : ""}`;
        }

        if (event.type === "FP_SPENT") return `Gasta PD ${(event.payload as any).amount}`;
        if (event.type === "FP_GAINED") return `Ganha PD ${(event.payload as any).amount}`;
        if (event.type === "CHARACTER_CREATED") return `Novo combatente ${(event.payload as any).name?.toUpperCase() || ""}`;
        if (event.type === "STRESS_MARKED") {
            const p = event.payload as any;
            return `Dano ${p.track === "PHYSICAL" ? "FÍSICO" : "MENTAL"} em ${p.characterId ? characters[p.characterId]?.name?.toUpperCase() || "ALVO" : "ALVO"}`;
        }
        if (event.type.includes("ASPECT_CREATED")) return `Novo aspecto ${(event.payload as any).name?.toUpperCase() || ""}`;
        if (event.type === "COMBAT_OUTCOME") return (event.payload as any).message || "Desfecho de combate";
        return event.type;
    };

    const displayedEvents = currentSessionEvents
        .filter(e =>
            ["ROLL_RESOLVED", "FP_SPENT", "FP_GAINED", "CHARACTER_CREATED", "STRESS_MARKED", "COMBAT_OUTCOME"].includes(e.type) ||
            e.type.includes("ASPECT_CREATED")
        )
        .slice()
        .reverse();

    return (
        <div className={`combat-log-container solid ornate-border ${compact ? "compact-mode" : ""}`}>
            <div className="log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {sessionNumber !== undefined && (
                    <span className="resonance-indicator">SESSÃO {sessionNumber}</span>
                )}
                {onRefresh && (
                    <button 
                        onClick={onRefresh}
                        disabled={!!isRefreshing}
                        className="refresh-btn"
                        title={isRefreshing ? "Sincronizando logs..." : "Atualizar Logs"}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--accent-color)',
                            cursor: 'pointer',
                            opacity: isRefreshing ? 1 : 0.6,
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                        onMouseLeave={(e) => e.currentTarget.style.opacity = isRefreshing ? '1' : '0.6'}
                    >
                        <RotateCw size={14} className={isRefreshing ? "animate-spin" : ""} />
                    </button>
                )}
            </div>
            {isRefreshing && (
                <div style={{
                    padding: '6px 20px',
                    borderBottom: '1px solid rgba(197, 160, 89, 0.1)',
                    background: 'rgba(197, 160, 89, 0.05)',
                    color: 'var(--accent-color)',
                    fontFamily: 'var(--font-header)',
                    fontSize: '0.55rem',
                    letterSpacing: '0.14em',
                    textAlign: 'center'
                }}>
                    SINCRONIZANDO LOGS...
                </div>
            )}
            <div className="log-entries-scroll">
                {displayedEvents.map(event => (
                    compact ? (
                        <div
                            key={event.id}
                            className={`combat-entry compact-line animate-fade-in ${(() => {
                                const rollMeta = getCompactRollMeta(event);
                                if (!rollMeta) return "";
                                return rollMeta.isSuccess ? "roll-good" : "roll-bad";
                            })()}`}
                        >
                            <span className="compact-time">{new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            <span className="compact-actor">{getActorName(event)}</span>
                            <span className="compact-summary">
                                {(() => {
                                    const rollMeta = getCompactRollMeta(event);
                                    if (!rollMeta) return getCompactSummary(event);
                                    return (
                                        <>
                                            <span className="compact-action">{rollMeta.actionLabel}</span>
                                            {rollMeta.targetLabel && (
                                                <>
                                                    <span className="compact-sep"> • </span>
                                                    <span className="compact-target">{rollMeta.targetLabel}</span>
                                                </>
                                            )}
                                            <span className="compact-sep"> • </span>
                                            <span className="compact-dice">{rollMeta.diceFaces}</span>
                                            {rollMeta.modifierText && (
                                                <>
                                                    <span className="compact-sep"> </span>
                                                    <span className="compact-mods">{rollMeta.modifierText}</span>
                                                </>
                                            )}
                                            <span className="compact-sep"> • </span>
                                            <span className={`compact-outcome ${rollMeta.isSuccess ? "good" : "bad"}`}>
                                                {rollMeta.outcomeLabel}
                                            </span>
                                        </>
                                    );
                                })()}
                            </span>
                            {(() => {
                                const rollMeta = getCompactRollMeta(event);
                                if (!rollMeta) return <span className="compact-total muted"></span>;
                                return <span className={`compact-total ${rollMeta.isSuccess ? "good" : "bad"}`}>{rollMeta.totalLabel}</span>;
                            })()}
                        </div>
                    ) : (
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
                    )
                ))}
                {displayedEvents.length === 0 && (
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

                .combat-log-container.compact-mode {
                    min-height: 144px;
                    max-height: 196px;
                    border-radius: 12px;
                    background: rgba(5, 5, 5, 0.88);
                    backdrop-filter: blur(12px);
                }

                .combat-log-container.compact-mode .log-header {
                    padding: 6px 10px;
                }

                .combat-log-container.compact-mode .resonance-indicator {
                    font-size: 0.52rem;
                    letter-spacing: 0.22em;
                }

                .combat-log-container.compact-mode .log-entries-scroll {
                    display: flex;
                    flex-direction: column;
                    align-items: stretch;
                    gap: 6px;
                    padding: 8px 10px;
                    overflow-x: hidden;
                    overflow-y: auto;
                }

                .combat-entry {
                    padding-bottom: 8px;
                    border-bottom: 1px solid rgba(197, 160, 89, 0.05);
                }

                .combat-log-container.compact-mode .combat-entry {
                    min-width: 0;
                    max-width: none;
                    padding: 10px 14px;
                    border-right: none;
                    border-bottom: 2px solid rgba(197, 160, 89, 0.1);
                    min-height: 64px;
                }

                .combat-log-container.compact-mode .combat-entry:last-child {
                    border-bottom: none;
                }

                .combat-log-container.compact-mode .entry-meta {
                    margin-bottom: 4px;
                    font-size: 0.5rem;
                }

                .combat-log-container.compact-mode .entry-content {
                    font-size: 0.66rem;
                }

                .combat-log-container.compact-mode .roll-data {
                    padding: 8px;
                }

                .compact-line {
                    display: grid;
                    grid-template-columns: auto auto minmax(0, 1fr) auto;
                    align-items: center;
                    gap: 8px;
                }

                .combat-entry.compact-line.roll-good {
                    border-left: 2px solid rgba(50, 213, 131, 0.75);
                    background: linear-gradient(90deg, rgba(15, 70, 43, 0.42), rgba(15, 25, 20, 0));
                }

                .combat-entry.compact-line.roll-bad {
                    border-left: 2px solid rgba(255, 90, 90, 0.78);
                    background: linear-gradient(90deg, rgba(80, 18, 18, 0.42), rgba(28, 14, 14, 0));
                }

                .compact-time {
                    font-family: var(--font-header);
                    font-size: 0.62rem;
                    color: rgba(255, 255, 255, 0.58);
                    letter-spacing: 0.08em;
                    white-space: nowrap;
                }

                .compact-actor {
                    font-family: var(--font-header);
                    font-size: 0.95rem;
                    color: var(--accent-color);
                    letter-spacing: 0.08em;
                    white-space: nowrap;
                    font-weight: 800;
                    text-shadow: 0 0 8px rgba(0,0,0,0.5);
                }

                .compact-summary {
                    font-family: var(--font-main);
                    font-size: 1.05rem;
                    color: rgba(255, 255, 255, 0.92);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .compact-action {
                    font-weight: 600;
                }

                .compact-target {
                    opacity: 0.9;
                }

                .compact-dice,
                .compact-mods {
                    opacity: 0.86;
                }

                .compact-sep {
                    opacity: 0.5;
                }

                .compact-outcome.good {
                    color: #32d583;
                    font-weight: 700;
                }

                .compact-outcome.bad {
                    color: #ff5a5a;
                    font-weight: 700;
                }

                .compact-total {
                    font-family: var(--font-header);
                    font-size: 1.6rem;
                    color: var(--accent-color);
                    letter-spacing: 0.02em;
                    white-space: nowrap;
                    font-weight: 900;
                }

                .compact-total.good {
                    color: #32d583;
                    text-shadow: 0 0 10px rgba(50, 213, 131, 0.28);
                }

                .compact-total.bad {
                    color: #ff5a5a;
                    text-shadow: 0 0 10px rgba(255, 90, 90, 0.28);
                }

                .compact-total.muted {
                    opacity: 0.25;
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
