"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_SKILLS } from "@/types/domain";

interface CharacterCreatorProps {
    sessionId: string;
    actorUserId: string;
    onClose: () => void;
    source?: "active" | "bestiary";
    religionsList?: any[];
    /** System id of the current session (used to tag bestiary characters). */
    system?: string;
}

type NpcTypeOption = "capanga" | "batedor" | "ameaca" | "boss" | "vilao";

export function CharacterCreator({ sessionId, actorUserId, onClose, source = "active", religionsList = [], system }: CharacterCreatorProps) {
    const normalizedActorUserId = actorUserId.trim().toLowerCase();
    const [name, setName] = useState("");
    const [owner, setOwner] = useState(normalizedActorUserId);
    const [isNPC, setIsNPC] = useState(source === "bestiary");
    const [scope, setScope] = useState<"session" | "global">("session");
    const [physStress, setPhysStress] = useState(2);
    const [mentStress, setMentStress] = useState(2);
    const [mounted, setMounted] = useState(false);
    const [npcType, setNpcType] = useState<"capanga" | "batedor" | "ameaca" | "boss" | "vilao" | "">(source === "bestiary" ? "capanga" : "");
    const [religionId, setReligionId] = useState("");
    const [blinkUsername, setBlinkUsername] = useState("");
    const [blinkPassword, setBlinkPassword] = useState("");

    // Stress values by NPC type
    const getStressForType = (type: string) => {
        switch (type) {
            case "capanga": return { phys: 2, ment: 2 };
            case "batedor": return { phys: 2, ment: 2 };
            case "ameaca": return { phys: 4, ment: 2 };
            case "boss": return { phys: 4, ment: 4 };
            case "vilao": return { phys: 6, ment: 6 };
            default: return null;
        }
    };

    // Auto-update stress when NPC type changes
    useEffect(() => {
        if (npcType) {
            const stressValues = getStressForType(npcType);
            if (stressValues) {
                setPhysStress(stressValues.phys);
                setMentStress(stressValues.ment);
            }
        }
    }, [npcType]);

    useEffect(() => {
        setMounted(true);
        // Prevenir scroll do body quando o modal estiver aberto
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "unset";
            setMounted(false);
        };
    }, []);


    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        // Generate NPC preset configuration if NPC type is selected
        const preset = isNPC && npcType ? generateNpcPreset(npcType) : null;

        globalEventStore.append({
            id: uuidv4(),
            sessionId,
            seq: 0,
            type: "CHARACTER_CREATED",
            actorUserId: normalizedActorUserId,
            createdAt: new Date().toISOString(),
            visibility: "PUBLIC",
            payload: {
                id: uuidv4(),
                name: name.trim(),
                ownerUserId: isNPC ? "AMBIENTE" : owner.trim().toLowerCase(),
                isNPC,
                religionId: religionId || undefined,
                npcType: isNPC ? npcType : undefined,
                system: system || undefined,
                // If NPC, always add to bestiary (even from active tab)
                source: (isNPC && source === "bestiary") ? "bestiary" : source,
                // If NPC, default scope is session (unless already set to global)
                scope: isNPC ? (source === "bestiary" ? scope : "session") : undefined,
                fatePoints: preset?.fatePoints ?? (isNPC ? 0 : 3),
                refresh: preset?.refresh ?? 3,
                stress: preset ? {
                    physical: Array(preset.physicalStress).fill(false),
                    mental: Array(preset.mentalStress).fill(false)
                } : {
                    physical: Array(physStress).fill(false),
                    mental: Array(mentStress).fill(false)
                },
                stressValues: preset ? {
                    physical: Array.from({ length: preset.physicalStress }, (_, index) => index + 1),
                    mental: Array.from({ length: preset.mentalStress }, (_, index) => index + 1)
                } : {
                    physical: Array.from({ length: physStress }, (_, index) => index + 1),
                    mental: Array.from({ length: mentStress }, (_, index) => index + 1)
                },
                skills: preset?.skills ?? DEFAULT_SKILLS.reduce((acc, sk) => ({ ...acc, [sk]: 0 }), {}),
                consequences: preset?.consequences ?? {
                    mild: { text: "" },
                    moderate: { text: "" },
                    severe: { text: "" }
                },
                stunts: preset?.stunts ?? [],
                blinkmotion: {
                    username: blinkUsername,
                    password: blinkPassword
                }
            }
        } as any);
        onClose();
    };

    // Skill priorities by category (Fate Toolkit)
    const COMBAT_SKILLS = ["Lutar", "Atirar", "Atletismo", "Vigor", "Provocar"];
    const STEALTH_SKILLS = ["Furtividade", "Percepção", "Roubo", "Enganar"];
    const SOCIAL_SKILLS = ["Comunicação", "Empatia", "Enganar", "Vontade"];
    const OCCULT_SKILLS = ["Ocultismo", "Vontade", "Conhecimentos", "Investigar"];

    const generateNpcPreset = (type: NpcTypeOption) => {
        const baseSkills = DEFAULT_SKILLS.reduce((acc, sk) => ({ ...acc, [sk]: 0 }), {} as Record<string, number>);

        // Shuffle helper
        const shuffle = <T,>(arr: T[]): T[] => [...arr].sort(() => Math.random() - 0.5);

        // Pick distinct skills from prioritized pool
        const pickSkills = (count: number, priorities: string[][]): string[] => {
            const allPriority = priorities.flatMap(p => p);
            const shuffled = shuffle([...new Set(allPriority)]);
            return shuffled.slice(0, count);
        };

        switch (type) {
            case "capanga": {
                // 2 físico, 2 mental, sem consequências, 1-2 perícias +1/+2
                const skills = pickSkills(2, [COMBAT_SKILLS, STEALTH_SKILLS]);
                const firstRank = Math.random() > 0.5 ? 2 : 1;
                baseSkills[skills[0]] = firstRank;
                if (skills[1]) baseSkills[skills[1]] = 1;
                return {
                    physicalStress: 2, mentalStress: 2,
                    consequences: {},
                    skills: baseSkills,
                    stunts: [],
                    fatePoints: 0, refresh: 0
                };
            }
            case "batedor": {
                // 2 físico, 2 mental, sem consequências, +3 pico, 2x +2, 1 façanha
                const skills = pickSkills(3, [COMBAT_SKILLS, STEALTH_SKILLS]);
                baseSkills[skills[0]] = 3;
                baseSkills[skills[1]] = 2;
                baseSkills[skills[2]] = 2;
                return {
                    physicalStress: 2, mentalStress: 2,
                    consequences: {},
                    skills: baseSkills,
                    stunts: [{ id: uuidv4(), name: "FAÇANHA", description: "Descrição...", cost: "―" }],
                    fatePoints: 0, refresh: 0
                };
            }
            case "ameaca": {
                // 4 físico, 2 mental, -2 consequência, +4 pico, 2x +3, 3x +2, 2 façanhas
                const skills = pickSkills(6, [COMBAT_SKILLS, OCCULT_SKILLS, SOCIAL_SKILLS]);
                baseSkills[skills[0]] = 4;
                baseSkills[skills[1]] = 3;
                baseSkills[skills[2]] = 3;
                baseSkills[skills[3]] = 2;
                baseSkills[skills[4]] = 2;
                baseSkills[skills[5]] = 2;
                return {
                    physicalStress: 4, mentalStress: 2,
                    consequences: { mild: { text: "" } },
                    skills: baseSkills,
                    stunts: [
                        { id: uuidv4(), name: "FAÇANHA 1", description: "Descrição...", cost: "―" },
                        { id: uuidv4(), name: "FAÇANHA 2", description: "Descrição...", cost: "―" }
                    ],
                    fatePoints: 0, refresh: 0
                };
            }
            case "boss": {
                // 4 físico, 4 mental, -2 e -4, +5 pyramid, 3 façanhas, 1-2 PD
                const skills = pickSkills(10, [COMBAT_SKILLS, OCCULT_SKILLS, SOCIAL_SKILLS, STEALTH_SKILLS]);
                baseSkills[skills[0]] = 5;
                baseSkills[skills[1]] = 4;
                baseSkills[skills[2]] = 4;
                baseSkills[skills[3]] = 3;
                baseSkills[skills[4]] = 3;
                baseSkills[skills[5]] = 3;
                baseSkills[skills[6]] = 2;
                baseSkills[skills[7]] = 2;
                baseSkills[skills[8]] = 2;
                baseSkills[skills[9]] = 2;
                return {
                    physicalStress: 4, mentalStress: 4,
                    consequences: { mild: { text: "" }, moderate: { text: "" } },
                    skills: baseSkills,
                    stunts: [
                        { id: uuidv4(), name: "FAÇANHA 1", description: "Descrição...", cost: "―" },
                        { id: uuidv4(), name: "FAÇANHA 2", description: "Descrição...", cost: "―" },
                        { id: uuidv4(), name: "FAÇANHA 3", description: "Descrição...", cost: "―" }
                    ],
                    fatePoints: Math.random() > 0.5 ? 2 : 1,
                    refresh: 2
                };
            }
            case "vilao": {
                // 6 físico, 6 mental, -2/-4/-6, +5/+6 pyramid, 5 façanhas, 3 PD
                const skills = pickSkills(12, [COMBAT_SKILLS, OCCULT_SKILLS, SOCIAL_SKILLS, STEALTH_SKILLS]);
                const pico = Math.random() > 0.5 ? 6 : 5;
                baseSkills[skills[0]] = pico;
                baseSkills[skills[1]] = pico - 1;
                baseSkills[skills[2]] = pico - 1;
                baseSkills[skills[3]] = pico - 2;
                baseSkills[skills[4]] = pico - 2;
                baseSkills[skills[5]] = pico - 2;
                baseSkills[skills[6]] = pico - 3;
                baseSkills[skills[7]] = pico - 3;
                baseSkills[skills[8]] = pico - 3;
                baseSkills[skills[9]] = pico - 3;
                if (skills[10]) baseSkills[skills[10]] = Math.max(1, pico - 4);
                if (skills[11]) baseSkills[skills[11]] = Math.max(1, pico - 4);
                return {
                    physicalStress: 6, mentalStress: 6,
                    consequences: { mild: { text: "" }, moderate: { text: "" }, severe: { text: "" } },
                    skills: baseSkills,
                    stunts: [
                        { id: uuidv4(), name: "FAÇANHA 1", description: "Descrição...", cost: "―" },
                        { id: uuidv4(), name: "FAÇANHA 2", description: "Descrição...", cost: "―" },
                        { id: uuidv4(), name: "FAÇANHA 3", description: "Descrição...", cost: "―" },
                        { id: uuidv4(), name: "FAÇANHA 4", description: "Descrição...", cost: "―" },
                        { id: uuidv4(), name: "FAÇANHA 5", description: "Descrição...", cost: "―" }
                    ],
                    fatePoints: 3,
                    refresh: 3
                };
            }
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="mystic-modal-overlay tarot-reveal" onClick={onClose}>
            <div className="mystic-modal-container" onClick={e => e.stopPropagation()}>
                <div className="ritual-header">
                    <span className="ritual-title">RITUAL DE INICIAÇÀO</span>
                    <button onClick={onClose} className="ritual-close-btn">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleCreate} className="ritual-content">
                    <div className="input-field">
                        <label>NOME DO PERSONAGEM</label>
                        <input
                            autoFocus
                            placeholder="Ex: Alistair, o Observador..."
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="occult-input"
                        />
                    </div>

                    <div className="checkbox-row">
                        <label className="occult-checkbox-container">
                            <input
                                type="checkbox"
                                checked={isNPC}
                                onChange={e => setIsNPC(e.target.checked)}
                            />
                            <span className="checkbox-orb"></span>
                            NPC / INIMIGO
                        </label>
                    </div>

                    {isNPC && (
                        <div className="input-field">
                            <label>TIPO DE AMEAÇA</label>
                            <select
                                className="occult-input npc-type-select"
                                value={npcType}
                                onChange={e => setNpcType(e.target.value as NpcTypeOption | "")}
                            >
                                <option value="">Personalizado</option>
                                <option value="capanga">👤 Capanga (2F/2M, sem conseq.)</option>
                                <option value="batedor">🗡️ Batedor (+3 pico, 1 façanha)</option>
                                <option value="ameaca">⚔️ Ameaça (+4 pico, 2 façanhas)</option>
                                <option value="boss">💀 Boss (+5 pico, 3 façanhas, PD)</option>
                                <option value="vilao">👑 Vilão Principal (+5/+6, 5 façanhas)</option>
                            </select>
                            <span className="type-hint">
                                {npcType === "capanga" && "Fodder: 2 estresse físico/mental, sem consequências, perícias +1/+2"}
                                {npcType === "batedor" && "Scout: +3 pico, 2x +2, 1 façanha pré-criada"}
                                {npcType === "ameaca" && "Threat: 4F/2M, -2 conseq., +4 pico, 2 façanhas"}
                                {npcType === "boss" && "Boss: 4F/4M, -2/-4, +5 pirâmide, 3 façanhas, 1-2 PD"}
                                {npcType === "vilao" && "Main Villain: 6F/6M, todas conseq., +5/+6 pirâmide, 5 façanhas, 3 PD"}
                                {!npcType && "Configuração manual de estresse e perícias"}
                            </span>
                        </div>
                    )}

                    {source === "bestiary" && (
                        <div className="input-field">
                            <label>ESCOPO DO BESTIÁRIO</label>
                            <div className="scope-options">
                                <label className="scope-option">
                                    <input
                                        type="radio"
                                        name="scope"
                                        checked={scope === "session"}
                                        onChange={() => setScope("session")}
                                    />
                                    <span className="radio-indicator"></span>
                                    EXCLUSIVO DESSA MESA
                                </label>
                                <label className="scope-option">
                                    <input
                                        type="radio"
                                        name="scope"
                                        checked={scope === "global"}
                                        onChange={() => setScope("global")}
                                    />
                                    <span className="radio-indicator"></span>
                                    GERAL (TODAS AS MESAS)
                                </label>
                            </div>
                        </div>
                    )}

                    {!isNPC && (
                        <div className="input-field">
                            <label>PROPRIETÁRIO (USUÁRIO)</label>
                            <input
                                placeholder="Nome do jogador..."
                                value={owner}
                                onChange={e => setOwner(e.target.value)}
                                className="occult-input"
                            />
                        </div>
                    )}
                    
                    <div className="input-field">
                        <label>RELIGIÀO</label>
                        <select
                            className="occult-input"
                            value={religionId}
                            onChange={e => setReligionId(e.target.value)}
                        >
                            <option value="">Nenhuma / Desconhecida</option>
                            {religionsList.map(r => (
                                <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="dual-inputs">
                        <div className="input-field">
                            <label>ESTRESSE FÍSICO</label>
                            <input
                                type="number"
                                min="1"
                                max="6"
                                value={physStress}
                                onChange={e => setPhysStress(parseInt(e.target.value) || 1)}
                                className="occult-input"
                            />
                        </div>
                        <div className="input-field">
                            <label>ESTRESSE MENTAL</label>
                            <input
                                type="number"
                                min="1"
                                max="6"
                                value={mentStress}
                                onChange={e => setMentStress(parseInt(e.target.value) || 1)}
                                className="occult-input"
                            />
                        </div>
                    </div>

                    <div className="blinkmotion-section">
                        <div className="section-divider">
                            <span className="divider-line"></span>
                            <span className="divider-text">PROTOCOLO BLINKMOTION</span>
                            <span className="divider-line"></span>
                        </div>
                        
                        <div className="dual-inputs">
                            <div className="input-field">
                                <label>USUÁRIO DE ACESSO</label>
                                <input
                                    placeholder="Login..."
                                    value={blinkUsername}
                                    onChange={e => setBlinkUsername(e.target.value)}
                                    className="occult-input blink-input"
                                />
                            </div>
                            <div className="input-field">
                                <label>SENHA CRIPTOGRÁFICA</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    value={blinkPassword}
                                    onChange={e => setBlinkPassword(e.target.value)}
                                    className="occult-input blink-input"
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="ritual-action-btn"
                        disabled={!name.trim() || (isNPC && !npcType && false)} // Add a basic state if needed, but for now just prevent double submit via local state if you had one.
                    >
                        CONVOCAR PERSONAGEM
                    </button>
                </form>
            </div>

            <style jsx>{`
                .mystic-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    display: grid;
                    place-items: center;
                    z-index: 99999;
                    padding: 20px;
                }

                .mystic-modal-container {
                    width: 100%;
                    max-width: 480px;
                    background: #0a0a0a;
                    border: 1px solid var(--border-color);
                    box-shadow: 0 0 60px rgba(0,0,0,0.9), 0 0 20px rgba(197, 160, 89, 0.1);
                    position: relative;
                }

                .ritual-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 30px;
                    border-bottom: 1px solid rgba(197, 160, 89, 0.1);
                    background: rgba(197, 160, 89, 0.02);
                }

                .ritual-title {
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    letter-spacing: 0.3em;
                    color: var(--accent-color);
                    text-transform: uppercase;
                }

                .ritual-close-btn {
                    background: transparent;
                    border: none;
                    color: var(--accent-color);
                    cursor: pointer;
                    opacity: 0.6;
                    transition: all 0.3s;
                }

                .ritual-close-btn:hover {
                    opacity: 1;
                    transform: rotate(90deg);
                }

                .ritual-content {
                    padding: 40px 30px;
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                }

                .input-field {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .input-field label {
                    font-family: var(--font-header);
                    font-size: 0.6rem;
                    letter-spacing: 0.1em;
                    color: var(--accent-color);
                    opacity: 0.8;
                }

                .occult-input {
                    background: rgba(197, 160, 89, 0.03);
                    border: 1px solid rgba(197, 160, 89, 0.15);
                    padding: 14px 20px;
                    color: white;
                    font-family: var(--font-main);
                    font-size: 0.95rem;
                    outline: none;
                    transition: all 0.3s;
                }

                .occult-input:focus {
                    border-color: var(--accent-color);
                    background: rgba(197, 160, 89, 0.08);
                    box-shadow: 0 0 15px rgba(197, 160, 89, 0.1);
                }

                .checkbox-row {
                    display: flex;
                    padding: 5px 0;
                }

                .occult-checkbox-container {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    cursor: pointer;
                    font-family: var(--font-header);
                    font-size: 0.7rem;
                    color: var(--text-primary);
                    letter-spacing: 0.05em;
                }

                .occult-checkbox-container input {
                    display: none;
                }

                .checkbox-orb {
                    width: 18px;
                    height: 18px;
                    border: 1px solid var(--accent-color);
                    border-radius: 50%;
                    position: relative;
                }

                .occult-checkbox-container input:checked + .checkbox-orb {
                    background: var(--accent-color);
                    box-shadow: 0 0 15px var(--accent-glow);
                }

                .dual-inputs {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                }

                .npc-type-select {
                    cursor: pointer;
                }

                .npc-type-select option {
                    background: #1a1a1a;
                    color: var(--text-primary);
                }

                .type-hint {
                    display: block;
                    font-size: 0.65rem;
                    color: rgba(197, 160, 89, 0.6);
                    font-style: italic;
                    margin-top: 4px;
                    letter-spacing: 0.03em;
                }

                .scope-options {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .scope-option {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    font-family: var(--font-header);
                    font-size: 0.7rem;
                    color: var(--text-primary);
                    letter-spacing: 0.05em;
                }

                .scope-option input {
                    display: none;
                }

                .radio-indicator {
                    width: 16px;
                    height: 16px;
                    border: 1px solid var(--accent-color);
                    border-radius: 50%;
                    position: relative;
                }

                .scope-option input:checked + .radio-indicator {
                    background: var(--accent-color);
                    box-shadow: 0 0 10px var(--accent-glow);
                }

                .scope-option input:checked + .radio-indicator::after {
                    content: '';
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 6px;
                    height: 6px;
                    background: #000;
                    border-radius: 50%;
                }

                .ritual-action-btn {
                    height: 54px;
                    background: transparent;
                    border: 1px solid var(--accent-color);
                    color: var(--accent-color);
                    font-family: var(--font-header);
                    font-size: 0.85rem;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                    margin-top: 10px;
                }

                .ritual-action-btn:hover {
                    background: var(--accent-color);
                    color: #000;
                    box-shadow: 0 0 30px var(--accent-glow);
                }

                @keyframes tarotReveal {
                    from { opacity: 0; transform: scale(0.95) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .tarot-reveal {
                    animation: tarotReveal 0.6s cubic-bezier(0.19, 1, 0.22, 1) forwards;
                }

                .blinkmotion-section {
                    margin-top: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }

                .section-divider {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 5px;
                }

                .divider-line {
                    flex: 1;
                    height: 1px;
                    background: linear-gradient(to right, transparent, rgba(var(--accent-rgb), 0.3), transparent);
                }

                .divider-text {
                    font-family: var(--font-header);
                    font-size: 0.55rem;
                    letter-spacing: 0.2em;
                    color: var(--accent-color);
                    opacity: 0.6;
                }

                .blink-input {
                    border-color: rgba(var(--accent-rgb), 0.1) !important;
                    background: rgba(0, 255, 255, 0.02) !important;
                }

                .blink-input:focus {
                    border-color: #0ff !important;
                    box-shadow: 0 0 15px rgba(0, 255, 255, 0.1) !important;
                }
            `}</style>
        </div>,
        document.body
    );
}
