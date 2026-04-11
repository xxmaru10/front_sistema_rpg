"use client";

import { Sparkles, Zap, Backpack, Plus } from "lucide-react";
import { Character, DEFAULT_SKILLS, Item } from "@/types/domain";

interface RollerInputsProps {
    isIntegrated: boolean;
    fixedCharacterId?: string;
    characters: Character[];
    selectedCharId: string;
    setSelectedCharId: (id: string) => void;
    selectedSkill: string;
    handleSkillSelect: (skill: string) => void;
    actionType: "ATTACK" | "DEFEND" | "OVERCOME" | "CREATE_ADVANTAGE";
    setActionType: (type: "ATTACK" | "DEFEND" | "OVERCOME" | "CREATE_ADVANTAGE") => void;
    damageType: "PHYSICAL" | "MENTAL";
    toggleDamageType: () => void;
    setExplicitDamageType: (type: "PHYSICAL" | "MENTAL") => void;
    selectedItemId: string;
    setSelectedItemId: (id: string) => void;
    allItems: Item[];
    manualBonus: number;
    setManualBonus: (bonus: number) => void;
    targetIds: string[];
    handleTargetAdd: (id: string) => void;
    handleTargetRemove: (id: string) => void;
    isGM: boolean;
    activeChar: Character | undefined;
}

export function RollerInputs({
    isIntegrated,
    fixedCharacterId,
    characters,
    selectedCharId,
    setSelectedCharId,
    selectedSkill,
    handleSkillSelect,
    actionType,
    setActionType,
    damageType,
    toggleDamageType: _toggleDamageType,
    setExplicitDamageType,
    selectedItemId,
    setSelectedItemId,
    allItems,
    manualBonus,
    setManualBonus,
    targetIds,
    handleTargetAdd,
    handleTargetRemove,
    isGM,
    activeChar
}: RollerInputsProps) {
    const physicalGlyph = "\u2694";
    const mentalGlyph = "\ud83e\udde0";

    const actionLabelMap: Record<RollerInputsProps["actionType"], string> = {
        OVERCOME: "SUPERAR",
        ATTACK: `ATK: ${damageType === "PHYSICAL" ? physicalGlyph : mentalGlyph}`,
        CREATE_ADVANTAGE: "VANTAGEM",
        DEFEND: "DEFENDER",
    };

    const selectedActionLabel = actionLabelMap[actionType] || "SUPERAR";
    const computeIntegratedWidth = (baseLabel: string, currentLabel: string, maxCh = 14) => {
        const base = baseLabel.length + 1;
        const current = currentLabel.length + 1;
        return `${Math.min(Math.max(base, current), maxCh)}ch`;
    };

    const actionWidth = computeIntegratedWidth("SUPERAR", selectedActionLabel, 12);
    const bonusWidth = manualBonus === 0
        ? "8ch"
        : `${Math.min(Math.max(String(manualBonus).length + 2, 3), 8)}ch`;

    const actionSelectValue = actionType === "ATTACK"
        ? (damageType === "PHYSICAL" ? "ATTACK_PHYSICAL" : "ATTACK_MENTAL")
        : actionType;

    const handleActionChange = (value: string) => {
        if (value === "ATTACK_PHYSICAL") {
            setActionType("ATTACK");
            setExplicitDamageType("PHYSICAL");
            return;
        }
        if (value === "ATTACK_MENTAL") {
            setActionType("ATTACK");
            setExplicitDamageType("MENTAL");
            return;
        }
        setActionType(value as RollerInputsProps["actionType"]);
    };

    const skillOptions = (() => {
        const ownedSkills = DEFAULT_SKILLS.filter(s => (activeChar?.skills?.[s] || 0) > 0);
        const otherSkills = DEFAULT_SKILLS.filter(s => (activeChar?.skills?.[s] || 0) <= 0);
        return { ownedSkills, otherSkills };
    })();

    return (
        <div className={`matrix-inputs flex-stagger ${isIntegrated ? "integrated" : ""}`}>
            {!fixedCharacterId && (
                <div className="matrix-field">
                    {!isIntegrated && <label>PERSONAGEM</label>}
                    <select
                        value={selectedCharId}
                        onChange={(e) => setSelectedCharId(e.target.value)}
                        className="mystic-input select-ritual"
                    >
                        {characters.map(c => (
                            <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className={`control-panel-grid ${isIntegrated ? "integrated-mode" : ""}`}>
                <div className="panel-col primary">
                    <div className="matrix-field">
                        {!isIntegrated && <label>PERICIA</label>}
                        <div className="field-row">
                            {!isIntegrated && <Sparkles size={18} className="field-icon" style={{ stroke: "var(--accent-color)" }} />}
                            {isIntegrated ? (
                                <div className="icon-select-shell" title="Pericia">
                                    <span className="icon-select-face"><Sparkles size={16} /></span>
                                    <select
                                        value={selectedSkill}
                                        onChange={(e) => handleSkillSelect(e.target.value)}
                                        className="icon-select-native"
                                        aria-label="Pericia"
                                    >
                                        <option value="">PERICIA</option>
                                        {skillOptions.ownedSkills.sort().map(skill => {
                                            const rank = activeChar?.skills?.[skill] || 0;
                                            return <option key={skill} value={skill}>{skill.toUpperCase()} (+{rank})</option>;
                                        })}
                                        {skillOptions.ownedSkills.length > 0 && <option disabled>----------</option>}
                                        {skillOptions.otherSkills.sort().map(skill => {
                                            const rank = activeChar?.skills?.[skill] || 0;
                                            return <option key={skill} value={skill}>{skill.toUpperCase()} ({rank})</option>;
                                        })}
                                    </select>
                                </div>
                            ) : (
                                <select
                                    value={selectedSkill}
                                    onChange={(e) => handleSkillSelect(e.target.value)}
                                    className="mystic-input select-ritual"
                                >
                                    <option value="">ROLAGEM PURA</option>
                                    {skillOptions.ownedSkills.sort().map(skill => {
                                        const rank = activeChar?.skills?.[skill] || 0;
                                        return (
                                            <option key={skill} value={skill} style={{ color: "var(--accent-color)", fontWeight: "bold" }}>
                                                {skill.toUpperCase()} (+{rank})
                                            </option>
                                        );
                                    })}
                                    {skillOptions.ownedSkills.length > 0 && <option disabled>----------</option>}
                                    {skillOptions.otherSkills.sort().map(skill => {
                                        const rank = activeChar?.skills?.[skill] || 0;
                                        return <option key={skill} value={skill}>{skill.toUpperCase()} ({rank})</option>;
                                    })}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="matrix-field">
                        {!isIntegrated && <label>ACAO</label>}
                        <div className="field-row">
                            {!isIntegrated && <Zap size={18} className="field-icon" style={{ stroke: "var(--accent-color)" }} />}
                            <select
                                value={actionSelectValue}
                                onChange={(e) => handleActionChange(e.target.value)}
                                className="mystic-input select-ritual"
                                style={isIntegrated ? { width: actionWidth, maxWidth: "12ch" } : undefined}
                            >
                                <option value="OVERCOME">SUPERAR</option>
                                <option value="ATTACK_PHYSICAL">{`ATK: ${physicalGlyph}`}</option>
                                <option value="ATTACK_MENTAL">{`ATK: ${mentalGlyph}`}</option>
                                <option value="CREATE_ADVANTAGE">CRIAR VANTAGEM</option>
                                <option value="DEFEND">DEFENDER</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="panel-col secondary">
                    <div className="matrix-field item-field-container">
                        {!isIntegrated && <label>INVENTARIO</label>}
                        <div className="field-row">
                            {!isIntegrated && <Backpack size={18} className="field-icon" style={{ stroke: "var(--accent-color)" }} />}
                            {isIntegrated ? (
                                <div className="icon-select-shell" title="Inventario">
                                    <span className="icon-select-face"><Backpack size={16} /></span>
                                    <select
                                        value={selectedItemId}
                                        onChange={(e) => setSelectedItemId(e.target.value)}
                                        className="icon-select-native"
                                        aria-label="Inventario"
                                    >
                                        <option value="">INVENTARIO</option>
                                        {allItems.filter(i => i.name && i.bonus > 0).map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name.toUpperCase()} ({item.bonus >= 0 ? `+${item.bonus}` : item.bonus})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <select
                                    value={selectedItemId}
                                    onChange={(e) => setSelectedItemId(e.target.value)}
                                    className="mystic-input select-ritual"
                                    style={{
                                        textAlign: "center",
                                        textIndent: "0",
                                        padding: "8px 16px"
                                    }}
                                >
                                    <option value="">INVENTARIO</option>
                                    {allItems.filter(i => i.name && i.bonus > 0).map(item => (
                                        <option key={item.id} value={item.id}>
                                            {item.name.toUpperCase()} ({item.bonus >= 0 ? `+${item.bonus}` : item.bonus})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                    </div>

                    <div className="matrix-field bonus-field-container">
                        {!isIntegrated && <label>BONUS</label>}
                        <div className="field-row">
                            {!isIntegrated && <Plus size={18} className="field-icon" style={{ stroke: "var(--accent-color)" }} />}
                            <input
                                type="number"
                                placeholder="BONUS"
                                value={manualBonus === 0 ? "" : manualBonus}
                                onChange={(e) => {
                                    const rawValue = e.target.value;
                                    setManualBonus(rawValue === "" ? 0 : (parseInt(rawValue, 10) || 0));
                                }}
                                className="mystic-input input-ritual bonus-input"
                                style={isIntegrated ? { width: bonusWidth, maxWidth: "8ch" } : undefined}
                            />
                        </div>
                    </div>
                </div>

                {(actionType === "ATTACK" || actionType === "CREATE_ADVANTAGE") && (
                    <div className="matrix-field full-width animate-reveal">
                        <label>ALVOS</label>
                        <div className="target-selection-area">
                            <div className="target-tags">
                                {targetIds.map(tid => {
                                    const char = characters.find(c => c.id === tid);
                                    return (
                                        <div key={tid} className="target-tag">
                                            <span>{char?.name.toUpperCase() || "???"}</span>
                                            <button className="remove-tag" onClick={() => handleTargetRemove(tid)}>x</button>
                                        </div>
                                    );
                                })}
                                <div className="add-target-wrapper">
                                    <select
                                        value=""
                                        onChange={(e) => handleTargetAdd(e.target.value)}
                                        className="mystic-input select-ritual add-target-select"
                                    >
                                        <option value="">+</option>
                                        {characters
                                            .filter(c => c.id !== (fixedCharacterId || selectedCharId))
                                            .filter(c => !targetIds.includes(c.id))
                                            .filter(c => {
                                                if (!isGM) {
                                                    const arenaSide = c.arenaSide as string | undefined;
                                                    const isThreat = (arenaSide === "THREAT") || (c.isNPC && arenaSide !== "HERO");
                                                    return isThreat;
                                                }
                                                return true;
                                            })
                                            .map(c => (
                                                <option key={c.id} value={c.id}>
                                                    {c.isNPC ? "NPC :: " : "PC :: "}{c.name.toUpperCase()}
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .matrix-inputs {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .matrix-inputs.integrated {
                    flex-direction: row;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 6px;
                    min-width: 0;
                }

                .matrix-field {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 100%;
                    min-width: 0;
                    gap: 10px;
                }

                .matrix-field label {
                    font-family: var(--font-header);
                    font-size: 0.6rem;
                    letter-spacing: 0.15em;
                    color: var(--accent-color);
                    opacity: 0.6;
                }

                .control-panel-grid {
                    display: flex;
                    flex-wrap: wrap;
                    justify-content: center;
                    gap: 8px;
                    align-items: flex-start;
                    width: 100%;
                    margin: 0 auto;
                }

                .control-panel-grid.integrated-mode {
                    flex-direction: row !important;
                    align-items: center !important;
                    justify-content: flex-start !important;
                    gap: 6px;
                    flex-wrap: wrap;
                }

                .panel-col {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex: 1 1 120px;
                    min-width: 0;
                    width: auto;
                    align-items: center;
                }

                .control-panel-grid.integrated-mode .panel-col {
                    flex-direction: row;
                    gap: 6px;
                    flex: 0 1 auto;
                    width: auto;
                }

                .field-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    justify-content: center;
                    width: 100%;
                }

                .control-panel-grid.integrated-mode .matrix-field {
                    width: auto;
                    gap: 4px;
                }

                .control-panel-grid.integrated-mode .matrix-field label {
                    display: none;
                }

                .control-panel-grid.integrated-mode .field-row {
                    width: auto;
                    gap: 0;
                }

                .icon-select-shell {
                    position: relative;
                    width: 40px;
                    min-width: 40px;
                    height: 36px;
                    border-radius: 12px;
                    border: 1px solid var(--accent-color);
                    background: #000;
                    box-shadow: 0 0 14px var(--accent-glow), inset 0 0 9px var(--accent-glow);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }

                .icon-select-face {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent-color);
                    pointer-events: none;
                    z-index: 1;
                }

                .icon-select-native {
                    position: absolute;
                    inset: 0;
                    width: 100%;
                    height: 100%;
                    opacity: 0;
                    cursor: pointer;
                    z-index: 2;
                }

                .select-ritual,
                .input-ritual {
                    background: #000000 !important;
                    border: 1px solid var(--accent-color) !important;
                    border-radius: 30px !important;
                    box-shadow: 0 0 20px var(--accent-glow), inset 0 0 15px var(--accent-glow) !important;
                    color: var(--accent-color) !important;
                    text-shadow: 0 0 10px var(--accent-glow), 0 0 20px var(--accent-glow) !important;
                    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1) !important;
                    text-align: center;
                    padding: 4px 12px !important;
                    font-family: var(--font-header) !important;
                    font-size: 0.8rem !important;
                    letter-spacing: 0.1em !important;
                    max-width: 100% !important;
                    box-sizing: border-box;
                    width: fit-content !important;
                    min-width: 0 !important;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .control-panel-grid.integrated-mode .select-ritual,
                .control-panel-grid.integrated-mode .input-ritual {
                    font-size: 0.72rem !important;
                    letter-spacing: 0.06em !important;
                    padding: 5px 10px !important;
                    border-radius: 12px !important;
                    min-height: 36px;
                    box-shadow: 0 0 14px var(--accent-glow), inset 0 0 10px var(--accent-glow) !important;
                }

                .control-panel-grid.integrated-mode :global(.field-icon) {
                    width: 14px;
                    height: 14px;
                }

                :global(.field-icon) {
                    color: var(--accent-color) !important;
                    stroke: var(--accent-color) !important;
                    filter: drop-shadow(0 0 5px var(--accent-glow)) drop-shadow(0 0 10px var(--accent-glow));
                }

                .bonus-input {
                    width: 50px !important;
                    text-align: center;
                }

                .control-panel-grid.integrated-mode .bonus-input {
                    width: auto !important;
                    min-width: 3ch;
                }

                .select-ritual option,
                .icon-select-native option,
                .add-target-select option {
                    background: #0a0d13;
                    color: #f2f6ff;
                }

                .target-selection-area {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    width: 100%;
                }

                .target-tags {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                    align-items: center;
                    min-height: 38px;
                    padding: 4px;
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(197, 160, 89, 0.1);
                }

                .target-tag {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid var(--accent-color);
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    color: #fff;
                    transition: all 0.3s ease;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                }

                .remove-tag {
                    background: rgba(255, 68, 68, 0.2);
                    border: 1px solid rgba(255, 68, 68, 0.4);
                    color: #ff4444;
                    cursor: pointer;
                    font-size: 1rem;
                    padding: 0;
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    line-height: 1;
                    transition: all 0.2s ease;
                    margin-left: 4px;
                }

                .remove-tag:hover {
                    background: #ff4444;
                    color: #fff;
                    transform: scale(1.1);
                    border-color: #ff6666;
                }

                .add-target-wrapper {
                    display: flex;
                    align-items: center;
                }

                .add-target-select {
                    width: auto !important;
                    min-width: 44px !important;
                    height: 32px !important;
                    padding: 0 8px !important;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border-radius: 6px;
                }

                .full-width {
                    width: 100%;
                    flex-basis: 100%;
                }

                .control-panel-grid.integrated-mode .full-width {
                    width: auto;
                    flex-basis: auto;
                }

                .control-panel-grid.integrated-mode .target-selection-area {
                    width: auto;
                }

                .control-panel-grid.integrated-mode .target-tags {
                    min-height: 30px;
                    padding: 2px 4px;
                    gap: 4px;
                }
            `}</style>
        </div>
    );
}
