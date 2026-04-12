"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sparkles, Zap, Backpack, Plus, Minus, X, Swords, Brain } from "lucide-react";
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
    isReaction?: boolean;
    isCombat?: boolean;
    onRequestRollAttention?: () => void;
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
    activeChar,
    isReaction = false,
    isCombat = false,
    onRequestRollAttention,
}: RollerInputsProps) {
    const guideEnabled = isIntegrated && isCombat;
    const bonusSelectRef = useRef<HTMLSelectElement>(null);
    const skillSelectRef = useRef<HTMLSelectElement>(null);
    const itemSelectRef = useRef<HTMLSelectElement>(null);
    const gmCharGuideInit = useRef(false);

    const focusBonusSoon = () => {
        if (!guideEnabled) return;
        requestAnimationFrame(() => {
            bonusSelectRef.current?.focus();
        });
    };

    const focusSkillSoon = () => {
        if (!guideEnabled) return;
        requestAnimationFrame(() => {
            skillSelectRef.current?.focus();
        });
    };

    const afterSkillChosen = (skill: string) => {
        handleSkillSelect(skill);
        if (!guideEnabled) return;
        if (!skill) return;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const items = allItems.filter(i => i.name && i.bonus > 0);
                if (items.length > 0) {
                    itemSelectRef.current?.focus();
                } else {
                    onRequestRollAttention?.();
                }
            });
        });
    };

    // ── Attack sub-menu state ──
    const [showAttackSubMenu, setShowAttackSubMenu] = useState(false);
    const [showTargetPicker, setShowTargetPicker] = useState(false);
    const [pendingDamageType, setPendingDamageType] = useState<"PHYSICAL" | "MENTAL" | null>(null);
    const attackMenuRef = useRef<HTMLDivElement>(null);

    // ── Sequential Glow State ──
    const [interactionStep, setInteractionStep] = useState(1);

    useEffect(() => {
        if (selectedCharId) {
            setInteractionStep(2);
            focusBonusSoon();
        } else {
            setInteractionStep(1);
        }
    }, [selectedCharId]);

    // Defender skips the action selection and jumps straight to Bonus
    useEffect(() => {
        if (actionType === "DEFEND" && interactionStep < 2) {
            setInteractionStep(2);
        }
    }, [actionType, interactionStep]);

    useEffect(() => {
        if (interactionStep === 4) {
            const hasValidItems = allItems.filter(i => i.name && i.bonus > 0).length > 0;
            if (!hasValidItems) {
                setInteractionStep(5);
            }
        }
        if (interactionStep === 5) {
            onRequestRollAttention?.();
        }
    }, [interactionStep, allItems, onRequestRollAttention]);

    useEffect(() => {
        if (!guideEnabled || !isGM || fixedCharacterId) return;
        if (!gmCharGuideInit.current) {
            gmCharGuideInit.current = true;
            return;
        }
        focusBonusSoon();
        // Intencional: reação só ao trocar personagem (GM), não incluir focusBonusSoon nas deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCharId, guideEnabled, isGM, fixedCharacterId]);
    
    // ── Bonus Menu State ──
    const [showBonusMenu, setShowBonusMenu] = useState(false);
    const [selectedSign, setSelectedSign] = useState<'+' | '-' | null>(null);
    const bonusMenuRef = useRef<HTMLDivElement>(null);

    // Close menus on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (showAttackSubMenu && attackMenuRef.current && !attackMenuRef.current.contains(e.target as Node)) {
                setShowAttackSubMenu(false);
            }
            if (showBonusMenu && bonusMenuRef.current && !bonusMenuRef.current.contains(e.target as Node)) {
                setShowBonusMenu(false);
                setSelectedSign(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showAttackSubMenu, showBonusMenu]);

    const actionLabelMap: Record<RollerInputsProps["actionType"], string> = {
        OVERCOME: "SUPERAR",
        ATTACK: "ATACAR",
        CREATE_ADVANTAGE: "VANTAGEM",
        DEFEND: "DEFENDER",
    };

    const damageLabel = damageType === "PHYSICAL" ? "FISICO" : "MENTAL";
    const selectedActionLabel = actionType === "ATTACK"
        ? `ATACAR (${damageLabel})`
        : actionLabelMap[actionType] || "SUPERAR";

    const computeIntegratedWidth = (baseLabel: string, currentLabel: string, maxCh = 22) => {
        const base = baseLabel.length + 1;
        const current = currentLabel.length + 1;
        // Use a more proportional expansion
        return `${Math.min(Math.max(base, current), maxCh)}ch`;
    };

    const actionWidth = computeIntegratedWidth("SUPERAR", selectedActionLabel, 18);
    const bonusWidth = manualBonus === 0
        ? "4ch"
        : `${Math.min(Math.max(String(manualBonus).length + 1, 2), 4)}ch`;

    // Available enemy targets
    const availableTargets = characters
        .filter(c => c.id !== (fixedCharacterId || selectedCharId))
        .filter(c => !targetIds.includes(c.id))
        .filter(c => {
            if (!isGM) {
                const arenaSide = c.arenaSide as string | undefined;
                return (arenaSide === "THREAT") || (c.isNPC && arenaSide !== "HERO");
            }
            return true;
        });

    const handleActionChange = (value: string) => {
        if (value === "ATTACK") {
            setShowAttackSubMenu(true);
            return;
        }
        setShowAttackSubMenu(false);
        setActionType(value as RollerInputsProps["actionType"]);
        if (interactionStep < 2) setInteractionStep(2);
        focusBonusSoon();
    };

    const handleDamageTypeSelected = (type: "PHYSICAL" | "MENTAL") => {
        setShowAttackSubMenu(false);
        setActionType("ATTACK");
        setExplicitDamageType(type);
        setPendingDamageType(type);
        // Open target picker if there are available targets
        if (availableTargets.length > 0) {
            setShowTargetPicker(true);
        } else {
            focusBonusSoon();
        }
    };

    const handleTargetSelected = (targetId: string) => {
        handleTargetAdd(targetId);
        setShowTargetPicker(false);
        setPendingDamageType(null);
        focusBonusSoon();
    };

    const handleTargetPickerClose = () => {
        setShowTargetPicker(false);
        setPendingDamageType(null);
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
                        {characters.map(c => {
                            const isEnemy = c.isNPC && c.arenaSide !== "HERO";
                            const color = isEnemy ? "#ff4444" : "#3b82f6";
                            return (
                                <option key={c.id} value={c.id} style={{ color }}>
                                    {c.name.toUpperCase()}
                                </option>
                            );
                        })}
                    </select>
                </div>
            )}

            <div className={`control-panel-grid ${isIntegrated ? "integrated-mode" : ""}`}>
                <div className="panel-col primary">
                    <div className="matrix-field" ref={attackMenuRef}>
                        {!isIntegrated && <label>ACAO</label>}
                        <div className="field-row action-field-row">
                            {!isIntegrated && <Zap size={18} className="field-icon" style={{ stroke: "var(--accent-color)" }} />}
                            <div className="action-dropdown-wrapper">
                                <button
                                    type="button"
                                    className={`mystic-input select-ritual action-btn ${actionType === "ATTACK" ? "attack-active" : ""} ${interactionStep === 1 ? 'nudge-glow' : ''}`}
                                    style={isIntegrated ? { width: actionWidth, minWidth: "120px" } : undefined}
                                    onClick={() => {
                                        setShowAttackSubMenu(!showAttackSubMenu);
                                        if (interactionStep < 2) setInteractionStep(2);
                                    }}
                                >
                                    {selectedActionLabel}
                                </button>

                                {showAttackSubMenu && (
                                    <div className="action-sub-menu">
                                        <button
                                            type="button"
                                            className={`action-sub-item ${actionType === "OVERCOME" ? "active" : ""}`}
                                            onClick={() => handleActionChange("OVERCOME")}
                                        >SUPERAR</button>
                                        <div className="action-sub-group">
                                            <span className="action-sub-group-label">ATACAR</span>
                                            <button
                                                type="button"
                                                className="action-sub-item attack-physical"
                                                onClick={() => handleDamageTypeSelected("PHYSICAL")}
                                            >
                                                <Swords size={14} /> FISICO
                                            </button>
                                            <button
                                                type="button"
                                                className="action-sub-item attack-mental"
                                                onClick={() => handleDamageTypeSelected("MENTAL")}
                                            >
                                                <Brain size={14} /> MENTAL
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            className={`action-sub-item ${actionType === "CREATE_ADVANTAGE" ? "active" : ""}`}
                                            onClick={() => handleActionChange("CREATE_ADVANTAGE")}
                                        >CRIAR VANTAGEM</button>
                                        <button
                                            type="button"
                                            className={`action-sub-item ${actionType === "DEFEND" ? "active" : ""}`}
                                            onClick={() => handleActionChange("DEFEND")}
                                        >DEFENDER</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="matrix-field bonus-field-container">
                        {!isIntegrated && <label>BONUS</label>}
                        <div className="field-row">
                            {!isIntegrated && <Plus size={18} className="field-icon" style={{ stroke: "var(--accent-color)" }} />}
                            {isIntegrated ? (
                                <div 
                                    className={`icon-select-shell ${(guideEnabled && interactionStep === 2) ? 'nudge-glow' : ''}`} 
                                    title="Bônus"
                                    ref={bonusMenuRef}
                                >
                                    <div className="icon-select-face" onClick={() => setShowBonusMenu(!showBonusMenu)}>
                                        {manualBonus !== 0 ? (
                                            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: manualBonus > 0 ? 'var(--accent-color)' : '#ff6b6b' }}>
                                                {manualBonus > 0 ? `+${manualBonus}` : manualBonus}
                                            </span>
                                        ) : (
                                            <Plus size={16} />
                                        )}
                                    </div>

                                    {showBonusMenu && (
                                        <div className="bonus-dropdown-menu">
                                            {!selectedSign ? (
                                                <div className="bonus-sign-row">
                                                    <button className="sign-btn plus" onClick={() => setSelectedSign('+')}>
                                                        <Plus size={20} />
                                                        <span>Bônus</span>
                                                    </button>
                                                    <button className="sign-btn minus" onClick={() => setSelectedSign('-')}>
                                                        <Minus size={20} />
                                                        <span>Ônus</span>
                                                    </button>
                                                    <button className="sign-btn zero" onClick={() => {
                                                        setManualBonus(0);
                                                        setShowBonusMenu(false);
                                                        if (interactionStep < 3) setInteractionStep(3);
                                                        focusSkillSoon();
                                                    }}>
                                                        <span>0</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="bonus-values-grid">
                                                    <button className="back-btn" onClick={() => setSelectedSign(null)}>←</button>
                                                    <div className="values-scroll">
                                                        {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                                                            <button 
                                                                key={num} 
                                                                className={`value-btn ${selectedSign === '-' ? 'is-minus' : ''}`}
                                                                onClick={() => {
                                                                    const val = selectedSign === '+' ? num : -num;
                                                                    setManualBonus(val);
                                                                    setShowBonusMenu(false);
                                                                    setSelectedSign(null);
                                                                    if (interactionStep < 3) setInteractionStep(3);
                                                                    focusSkillSoon();
                                                                }}
                                                            >
                                                                {selectedSign}{num}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <input
                                    type="number"
                                    placeholder="BONUS"
                                    value={manualBonus === 0 ? "" : manualBonus}
                                    onChange={(e) => {
                                        const rawValue = e.target.value;
                                        setManualBonus(rawValue === "" ? 0 : (parseInt(rawValue, 10) || 0));
                                        if (interactionStep < 3) setInteractionStep(3);
                                    }}
                                    onClick={() => { if (interactionStep < 3) setInteractionStep(3); }}
                                    className={`mystic-input input-ritual bonus-input narrowed ${(guideEnabled && interactionStep === 2) ? 'nudge-glow' : ''}`}
                                    style={{ width: bonusWidth, minWidth: "60px" }}
                                />
                            )}
                        </div>
                    </div>
                </div>

                <div className="panel-col secondary">
                    <div className="matrix-field">
                        {!isIntegrated && <label>PERICIA</label>}
                        <div className="field-row">
                            {!isIntegrated && <Sparkles size={18} className="field-icon" style={{ stroke: "var(--accent-color)" }} />}
                            {isIntegrated ? (
                                <div className={`icon-select-shell ${(guideEnabled && interactionStep === 3) ? 'nudge-glow' : ''}`} title="Pericia">
                                    <span className="icon-select-face">
                                        {selectedSkill ? (
                                            <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fff' }}>
                                                {selectedSkill.slice(0, 3).toUpperCase()}
                                            </span>
                                        ) : (
                                            <Sparkles size={16} />
                                        )}
                                    </span>
                                    <select
                                        ref={skillSelectRef}
                                        value={selectedSkill}
                                        onChange={(e) => {
                                            afterSkillChosen(e.target.value);
                                            if (interactionStep < 4) setInteractionStep(4);
                                        }}
                                        onClick={() => { if (interactionStep < 4) setInteractionStep(4); }}
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
                                    onChange={(e) => {
                                        handleSkillSelect(e.target.value);
                                        if (interactionStep < 4) setInteractionStep(4);
                                    }}
                                    onClick={() => { if (interactionStep < 4) setInteractionStep(4); }}
                                    className={`mystic-input select-ritual ${(guideEnabled && interactionStep === 3) ? 'nudge-glow' : ''}`}
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

                    <div className="matrix-field item-field-container">
                        {!isIntegrated && <label>INVENTARIO</label>}
                        <div className="field-row">
                            {!isIntegrated && <Backpack size={18} className="field-icon" style={{ stroke: "var(--accent-color)" }} />}
                            {isIntegrated ? (
                                <div className={`icon-select-shell ${(guideEnabled && interactionStep === 4) ? 'nudge-glow' : ''}`} title="Inventario">
                                    <span className="icon-select-face"><Backpack size={16} /></span>
                                    <select
                                        ref={itemSelectRef}
                                        value={selectedItemId}
                                        onChange={(e) => {
                                            setSelectedItemId(e.target.value);
                                            if (interactionStep < 5) setInteractionStep(5);
                                        }}
                                        onClick={() => { if (interactionStep < 5) setInteractionStep(5); }}
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
                                    onChange={(e) => {
                                        setSelectedItemId(e.target.value);
                                        if (interactionStep < 5) setInteractionStep(5);
                                    }}
                                    onClick={() => { if (interactionStep < 5) setInteractionStep(5); }}
                                    className={`mystic-input select-ritual ${(guideEnabled && interactionStep === 4) ? 'nudge-glow' : ''}`}
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
                </div>

                {/* Attack target tags (shown after target is selected) */}
                {actionType === "ATTACK" && targetIds.length > 0 && (
                    <div className="matrix-field full-width animate-reveal">
                        <label>ALVO</label>
                        <div className="target-selection-area">
                            <div className="target-tags">
                                {targetIds.map(tid => {
                                    const char = characters.find(c => c.id === tid);
                                    return (
                                        <div key={tid} className="target-tag">
                                            {char?.imageUrl && (
                                                <div className="target-tag-portrait" style={{ backgroundImage: `url(${char.imageUrl})` }} />
                                            )}
                                            <span>{char?.name.toUpperCase() || "???"}</span>
                                            <button className="remove-tag" onClick={() => handleTargetRemove(tid)}>x</button>
                                        </div>
                                    );
                                })}
                                {/* Inline add more targets */}
                                {availableTargets.length > 0 && (
                                    <button
                                        type="button"
                                        className="add-target-btn"
                                        onClick={() => setShowTargetPicker(true)}
                                        title="Adicionar alvo"
                                    >+</button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* CREATE_ADVANTAGE keeps old target selector */}
                {actionType === "CREATE_ADVANTAGE" && (
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
                                        {availableTargets.map(c => (
                                            <option key={c.id} value={c.id}>
                                                {c.isNPC ? "NPC :: " : "PC :: "}{c.name.toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ TARGET PICKER MODAL (Portal — conventions.md: Luxury Portal Selection) ═══ */}
            {showTargetPicker && typeof document !== 'undefined' && createPortal(
                <div className="target-picker-overlay" onClick={handleTargetPickerClose}>
                    <div className="target-picker-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="target-picker-header">
                            <span className="target-picker-title">
                                {pendingDamageType === "PHYSICAL" ? <Swords size={16} /> : <Brain size={16} />}
                                ESCOLHA O ALVO
                            </span>
                            <button type="button" className="target-picker-close" onClick={handleTargetPickerClose}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="target-picker-list">
                            {availableTargets.length === 0 ? (
                                <div className="target-picker-empty">Nenhum alvo disponivel</div>
                            ) : (
                                availableTargets.map(c => (
                                    <button
                                        key={c.id}
                                        type="button"
                                        className="target-picker-item"
                                        onClick={() => handleTargetSelected(c.id)}
                                    >
                                        <div
                                            className="target-picker-portrait"
                                            style={c.imageUrl ? { backgroundImage: `url(${c.imageUrl})` } : undefined}
                                        >
                                            {!c.imageUrl && <span className="target-picker-initials">{c.name.charAt(0).toUpperCase()}</span>}
                                        </div>
                                        <span className="target-picker-name">{c.name.toUpperCase()}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

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
                    align-content: flex-start;
                    gap: 4px;
                    min-width: 0;
                    width: auto;
                    flex: 0 1 auto;
                }

                .matrix-inputs.integrated > .matrix-field {
                    width: auto;
                    gap: 0;
                    flex: 0 1 auto;
                }

                .matrix-inputs.integrated > .matrix-field label {
                    display: none;
                }

                .matrix-inputs.integrated > .matrix-field .field-row {
                    width: auto;
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
                    gap: 4px;
                    flex-wrap: wrap;
                    width: auto;
                    margin: 0;
                    flex: 0 1 auto;
                }

                .panel-col {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    flex: 1 1 120px;
                    min-width: 0;
                    width: 100%;
                    align-items: center;
                }

                .control-panel-grid.integrated-mode .panel-col {
                    flex-direction: row;
                    gap: 4px;
                    flex: 1 1 auto;
                    width: auto;
                    justify-content: flex-start;
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
                    gap: 0;
                }

                .control-panel-grid.integrated-mode .matrix-field label {
                    display: none;
                }

                .control-panel-grid.integrated-mode .field-row {
                    width: auto;
                    gap: 4px;
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
                    overflow: visible;
                    z-index: 1000;
                }

                .icon-select-face {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--accent-color);
                    pointer-events: auto;
                    cursor: pointer;
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
                    color-scheme: dark;
                }

                .select-ritual,
                .input-ritual {
                    appearance: none;
                    -webkit-appearance: none;
                    -moz-appearance: none;
                    background: #000000 !important;
                    border: 1px solid var(--accent-color) !important;
                    border-radius: 30px !important;
                    box-shadow: 0 0 20px var(--accent-glow), inset 0 0 15px var(--accent-glow) !important;
                    color: var(--accent-color) !important;
                    font-size: 0.8rem;
                    height: 36px;
                    padding: 0 14px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    flex: 1 1 auto;
                    min-width: 0;
                }
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
                    font-size: 0.66rem !important;
                    letter-spacing: 0.05em !important;
                    padding: 4px 8px !important;
                    border-radius: 12px !important;
                    min-height: 34px;
                    box-shadow: 0 0 14px var(--accent-glow), inset 0 0 10px var(--accent-glow) !important;
                }

                .matrix-inputs.integrated .select-ritual,
                .matrix-inputs.integrated .input-ritual {
                    max-width: 24ch !important;
                }

                .control-panel-grid.integrated-mode .select-ritual {
                    max-width: 11ch !important;
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
                    width: 25px !important;
                    text-align: center;
                    font-size: 1rem !important;
                    font-weight: 700 !important;
                }

                .control-panel-grid.integrated-mode .bonus-input {
                    font-size: 1.08rem !important;
                    font-weight: 800 !important;
                    line-height: 1;
                    padding: 2px 4px !important;
                    min-width: unset !important;
                }
                
                .bonus-input.narrowed {
                    width: 38px !important;
                }

                .attack-type-select {
                    min-width: 90px !important;
                }

                .select-ritual option,
                .icon-select-native option,
                .add-target-select option {
                    background: #0a0d13;
                    color: #f2f6ff;
                    font-family: var(--font-header);
                    font-size: 0.88rem;
                }

                .select-ritual option:checked,
                .icon-select-native option:checked,
                .add-target-select option:checked {
                    background: #1f3b61 !important;
                    color: #ffffff !important;
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

                /* ── Action dropdown wrapper ── */
                .action-dropdown-wrapper {
                    position: relative;
                    display: inline-flex;
                }

                .action-btn {
                    cursor: pointer;
                    user-select: none;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    transition: all 0.3s ease;
                }

                .action-btn.attack-active {
                    border-color: #ff4444 !important;
                    color: #ff4444 !important;
                    text-shadow: 0 0 10px rgba(255, 68, 68, 0.4), 0 0 20px rgba(255, 68, 68, 0.2) !important;
                    box-shadow: 0 0 20px rgba(255, 68, 68, 0.2), inset 0 0 12px rgba(255, 68, 68, 0.1) !important;
                }

                /* ── Action sub-menu ── */
                .action-sub-menu {
                    position: absolute;
                    top: calc(100% + 6px);
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 9999;
                    background: rgba(8, 10, 14, 0.96);
                    border: 1px solid rgba(var(--accent-rgb), 0.35);
                    border-radius: 14px;
                    backdrop-filter: blur(18px) saturate(1.2);
                    -webkit-backdrop-filter: blur(18px) saturate(1.2);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), 0 0 20px rgba(var(--accent-rgb), 0.15);
                    padding: 6px;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    min-width: 180px;
                    animation: submenuReveal 0.18s ease-out;
                }

                @keyframes submenuReveal {
                    from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.96); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                }

                .action-sub-item {
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.75);
                    font-family: var(--font-header);
                    font-size: 0.78rem;
                    letter-spacing: 0.1em;
                    padding: 10px 16px;
                    cursor: pointer;
                    border-radius: 10px;
                    transition: all 0.2s ease;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .action-sub-item:hover {
                    background: rgba(var(--accent-rgb), 0.15);
                    color: #fff;
                }

                .action-sub-item.active {
                    background: rgba(var(--accent-rgb), 0.12);
                    color: var(--accent-color);
                }

                .action-sub-group {
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    padding: 4px 0;
                    margin: 0 4px;
                    border-left: 2px solid rgba(255, 68, 68, 0.3);
                }

                .action-sub-group-label {
                    font-family: var(--font-header);
                    font-size: 0.55rem;
                    letter-spacing: 0.2em;
                    color: rgba(255, 68, 68, 0.5);
                    padding: 0 12px;
                    margin-bottom: 2px;
                }

                .action-sub-item.attack-physical {
                    color: #ff6b6b;
                    padding-left: 12px;
                }
                .action-sub-item.attack-physical:hover {
                    background: rgba(255, 68, 68, 0.15);
                    color: #ff4444;
                }

                .action-sub-item.attack-mental {
                    color: #c084fc;
                    padding-left: 12px;
                }
                .action-sub-item.attack-mental:hover {
                    background: rgba(168, 85, 247, 0.15);
                    color: #a855f7;
                }

                /* ── Target tag portrait ── */
                .target-tag-portrait {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    background-size: cover;
                    background-position: center;
                    border: 1px solid rgba(255, 68, 68, 0.5);
                    flex-shrink: 0;
                }

                .add-target-btn {
                    background: rgba(255, 68, 68, 0.1);
                    border: 1px dashed rgba(255, 68, 68, 0.4);
                    color: #ff6666;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 1.1rem;
                    font-weight: bold;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                }

                .add-target-btn:hover {
                    background: rgba(255, 68, 68, 0.25);
                    border-color: #ff4444;
                    transform: scale(1.1);
                }

                /* ── Mobile responsive ── */
                @media (max-width: 768px) {
                    .matrix-inputs.integrated {
                        width: 100%;
                        justify-content: center;
                    }

                    .control-panel-grid.integrated-mode {
                        width: 100%;
                        justify-content: center !important;
                        gap: 6px;
                    }

                    .control-panel-grid.integrated-mode .panel-col {
                        width: 100%;
                        justify-content: center;
                        flex-wrap: wrap;
                        row-gap: 6px;
                    }

                    .control-panel-grid.integrated-mode .field-row {
                        max-width: 100%;
                        flex-wrap: wrap;
                        justify-content: center;
                    }

                    .control-panel-grid.integrated-mode .select-ritual,
                    .control-panel-grid.integrated-mode .input-ritual {
                        max-width: min(44vw, 170px) !important;
                    }
                }
            `}</style>

            {/* Portal-rendered styles — must be global */}
            <style jsx global>{`
                .target-picker-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(6px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: targetPickerFadeIn 0.2s ease-out;
                }

                @keyframes targetPickerFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                .target-picker-modal {
                    background: rgba(10, 12, 18, 0.97);
                    border: 1px solid rgba(255, 68, 68, 0.35);
                    border-radius: 20px;
                    box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 68, 68, 0.1);
                    min-width: 320px;
                    max-width: 480px;
                    max-height: 70vh;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    animation: targetPickerSlideIn 0.25s cubic-bezier(0.19, 1, 0.22, 1);
                }

                @keyframes targetPickerSlideIn {
                    from { opacity: 0; transform: scale(0.92) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }

                .target-picker-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 16px 20px;
                    border-bottom: 1px solid rgba(255, 68, 68, 0.15);
                }

                .target-picker-title {
                    font-family: var(--font-header);
                    font-size: 0.75rem;
                    letter-spacing: 0.2em;
                    color: #ff6666;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .target-picker-close {
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.4);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    transition: all 0.2s;
                    display: inline-flex;
                }

                .target-picker-close:hover {
                    color: #ff4444;
                    background: rgba(255, 68, 68, 0.1);
                }

                .target-picker-list {
                    padding: 8px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    max-height: 55vh;
                }

                .target-picker-empty {
                    padding: 24px;
                    text-align: center;
                    font-family: var(--font-header);
                    font-size: 0.8rem;
                    color: rgba(255, 255, 255, 0.3);
                    letter-spacing: 0.1em;
                }

                .target-picker-item {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    padding: 10px 14px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 14px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #fff;
                }

                .target-picker-item:hover {
                    background: rgba(255, 68, 68, 0.1);
                    border-color: rgba(255, 68, 68, 0.4);
                    transform: translateX(4px);
                    box-shadow: 0 4px 18px rgba(255, 68, 68, 0.15);
                }

                .target-picker-portrait {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background-color: rgba(40, 20, 20, 0.6);
                    background-size: cover;
                    background-position: center top;
                    border: 2px solid rgba(255, 68, 68, 0.3);
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                    transition: border-color 0.2s;
                }

                .target-picker-item:hover .target-picker-portrait {
                    border-color: #ff4444;
                    box-shadow: 0 0 12px rgba(255, 68, 68, 0.3);
                }

                .target-picker-initials {
                    font-family: var(--font-header);
                    font-size: 1.2rem;
                    color: rgba(255, 68, 68, 0.5);
                    font-weight: bold;
                }

                .target-picker-name {
                    font-family: var(--font-header);
                    font-size: 0.85rem;
                    letter-spacing: 0.08em;
                    color: rgba(255, 255, 255, 0.9);
                }

                @media (max-width: 768px) {
                    .target-picker-modal {
                        min-width: 280px;
                        max-width: calc(100vw - 32px);
                        margin: 0 16px;
                    }
                }
                .target-tag-portrait {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background-size: cover;
                    background-position: center;
                    border: 1px solid var(--accent-color);
                }

                @keyframes sequence-glow {
                    0% {
                        box-shadow: 0 0 5px rgba(255, 215, 0, 0.4), inset 0 0 5px rgba(255, 215, 0, 0.2);
                        border-color: rgba(255, 215, 0, 0.6);
                    }
                    50% {
                        box-shadow: 0 0 15px rgba(255, 215, 0, 1), inset 0 0 10px rgba(255, 215, 0, 0.8) !important;
                        border-color: rgba(255, 215, 0, 1) !important;
                        transform: scale(1.05);
                    }
                    100% {
                        box-shadow: 0 0 5px rgba(255, 215, 0, 0.4), inset 0 0 5px rgba(255, 215, 0, 0.2);
                        border-color: rgba(255, 215, 0, 0.6);
                    }
                }

                .nudge-glow {
                    animation: sequence-glow 1.5s infinite alternate !important;
                    border-color: rgba(255, 215, 0, 1) !important;
                    z-index: 10;
                }

                .bonus-dropdown-menu {
                    position: absolute;
                    bottom: 110%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: #0a0a0a;
                    border: 1px solid var(--accent-color);
                    border-radius: 8px;
                    padding: 12px;
                    min-width: 220px;
                    z-index: 2000;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.8), 0 0 15px rgba(var(--accent-rgb), 0.3);
                    animation: bonus-pop 0.2s ease-out;
                }
                @keyframes bonus-pop {
                    from { opacity: 0; transform: translateX(-50%) translateY(10px) scale(0.95); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
                }
                .bonus-sign-row {
                    display: flex;
                    gap: 10px;
                    justify-content: center;
                }
                .sign-btn {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 6px;
                    padding: 12px 8px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 6px;
                    color: #fff;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .sign-btn:hover { background: rgba(var(--accent-rgb), 0.15); border-color: var(--accent-color); }
                .sign-btn.plus { color: var(--accent-color); }
                .sign-btn.minus { color: #ff6b6b; }
                .sign-btn span { font-size: 0.65rem; font-weight: bold; letter-spacing: 0.1em; text-transform: uppercase; }

                .bonus-values-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .back-btn {
                    align-self: flex-start;
                    background: transparent;
                    border: none;
                    color: rgba(255,255,255,0.4);
                    cursor: pointer;
                    font-size: 1.2rem;
                    padding: 0 5px;
                }
                .back-btn:hover { color: #fff; }
                .values-scroll {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 6px;
                    max-height: 200px;
                    overflow-y: auto;
                    padding-right: 4px;
                }
                .values-scroll::-webkit-scrollbar { width: 4px; }
                .values-scroll::-webkit-scrollbar-thumb { background: rgba(var(--accent-rgb), 0.3); border-radius: 2px; }
                .value-btn {
                    aspect-ratio: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 4px;
                    color: #fff;
                    font-size: 0.8rem;
                    font-weight: 800;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .value-btn:hover { 
                    background: var(--accent-color); 
                    color: #000; 
                    border-color: var(--accent-color); 
                    transform: scale(1.1);
                }
                .value-btn.is-minus:hover {
                    background: #ff4444;
                    border-color: #ff4444;
                }
            `}</style>
        </div>
    );
}
