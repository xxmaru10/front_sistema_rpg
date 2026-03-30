"use client";

import { Character } from "@/types/domain";

interface HazardCardProps {
    character: Character;
    isGM: boolean;
    isOwner: boolean;
    canEditSelf: boolean;
    isCollapsed: boolean;
    setIsCollapsed: (v: boolean) => void;
    onRemove?: () => void;
    handleUpdateHazard: (changes: Partial<Character>) => void;
}

export function HazardCard({
    character,
    isGM,
    isCollapsed,
    setIsCollapsed,
    onRemove,
    canEditSelf,
    handleUpdateHazard,
}: HazardCardProps) {
    const hazardCardStyle: React.CSSProperties = {
        background: 'linear-gradient(135deg, rgba(45, 20, 70, 1) 0%, rgba(20, 10, 35, 1) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.5)',
        borderLeft: '4px solid #a855f7',
        boxShadow: 'inset 0 0 40px rgba(168, 85, 247, 0.2), 0 0 20px rgba(168, 85, 247, 0.15), 0 4px 20px rgba(0,0,0,0.7)',
        padding: isCollapsed ? '6px 12px' : '16px',
        display: 'flex',
        flexDirection: 'column' as const,
        gap: isCollapsed ? '0' : '12px',
        position: 'relative' as const,
        overflow: 'visible',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
    };

    const nameInputStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        borderBottom: '2px solid rgba(168, 85, 247, 0.3)',
        color: '#fff',
        fontFamily: 'var(--font-header)',
        fontSize: '1.1rem',
        width: '100%',
        outline: 'none',
        padding: '4px 0',
        textShadow: '0 2px 6px rgba(0,0,0,0.6)'
    };

    const badgeStyle: React.CSSProperties = {
        fontSize: '0.55rem',
        color: '#a855f7',
        letterSpacing: '0.2em',
        fontWeight: 'bold',
        textTransform: 'uppercase' as const,
        textShadow: '0 0 8px rgba(168, 85, 247, 0.5)'
    };

    const diffRingStyle: React.CSSProperties = {
        background: 'rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        padding: '10px 25px',
        borderRadius: '40px',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        boxShadow: '0 0 15px rgba(168, 85, 247, 0.15), 0 4px 15px rgba(0,0,0,0.4)'
    };

    const diffNumberStyle: React.CSSProperties = {
        fontSize: '2rem',
        fontFamily: 'var(--font-header)',
        color: '#a855f7',
        lineHeight: 1,
        textShadow: '0 0 15px rgba(168, 85, 247, 0.8)'
    };

    const aspectSlotStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'rgba(168, 85, 247, 0.05)',
        padding: '8px 12px',
        borderRadius: '4px',
        borderLeft: '3px solid rgba(168, 85, 247, 0.4)'
    };

    const aspectInputStyle: React.CSSProperties = {
        background: 'transparent',
        border: 'none',
        color: '#ddd',
        width: '100%',
        outline: 'none',
        fontSize: '0.8rem',
        fontFamily: 'var(--font-main)'
    };

    return (
        <div className={`combat-card animate-reveal ${isCollapsed ? 'collapsed' : ''}`} style={hazardCardStyle}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: 'radial-gradient(circle at top right, rgba(168, 85, 247, 0.25), transparent 70%)', pointerEvents: 'none' }}></div>
            <div className="combat-header" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <div className="combat-identity" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flexGrow: 1 }}>
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#a855f7',
                            width: '20px',
                            height: '20px',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            flexShrink: 0,
                            marginTop: '4px'
                        }}
                        title={isCollapsed ? "Expandir" : "Recolher"}
                    >
                        {isCollapsed ? "+" : "−"}
                    </button>
                    <div style={{ flexGrow: 1 }}>
                        {isGM ? (
                            <input
                                style={nameInputStyle}
                                value={character.name.toUpperCase()}
                                onChange={e => handleUpdateHazard({ name: e.target.value })}
                                placeholder="NOME DO DESAFIO"
                            />
                        ) : (
                            <h3 style={{ ...nameInputStyle, margin: 0 }}>{character.name.toUpperCase()}</h3>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                            <span style={badgeStyle}>◈ DESAFIO DE CENA</span>
                        </div>
                    </div>
                </div>
                {isGM && onRemove && !isCollapsed && (
                    <button onClick={onRemove} style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', color: '#ff6666', width: '24px', height: '24px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem' }} title="Remover Desafio">
                        ✕
                    </button>
                )}
            </div>

            {!isCollapsed && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
                        <div style={diffRingStyle}>
                            <div style={{ fontSize: '0.5rem', color: 'rgba(168, 85, 247, 0.8)', letterSpacing: '0.15em', marginBottom: '2px' }}>DIFICULDADE</div>
                            {isGM ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <button onClick={() => handleUpdateHazard({ difficulty: (character.difficulty || 0) - 1 })} style={{ background: 'transparent', border: 'none', color: '#a855f7', fontSize: '1.4rem', cursor: 'pointer' }}>-</button>
                                    <span style={diffNumberStyle}>{character.difficulty || 0}</span>
                                    <button onClick={() => handleUpdateHazard({ difficulty: (character.difficulty || 0) + 1 })} style={{ background: 'transparent', border: 'none', color: '#a855f7', fontSize: '1.4rem', cursor: 'pointer' }}>+</button>
                                </div>
                            ) : (
                                <div style={diffNumberStyle}>{character.difficulty || 0}</div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {[0, 1, 2].map(idx => (
                            <div key={idx} style={aspectSlotStyle}>
                                <div style={{ width: '6px', height: '6px', border: '1px solid #a855f7', transform: 'rotate(45deg)', flexShrink: 0, boxShadow: '0 0 5px rgba(168, 85, 247, 0.5)' }}></div>
                                {canEditSelf ? (
                                    <input
                                        style={aspectInputStyle}
                                        placeholder={`Revelar verdade ${idx + 1}...`}
                                        value={character.sheetAspects?.[idx] || ""}
                                        onChange={e => {
                                            const newAspects = [...(character.sheetAspects || ["", "", "", ""])];
                                            newAspects[idx] = e.target.value;
                                            handleUpdateHazard({ sheetAspects: newAspects });
                                        }}
                                    />
                                ) : (
                                    <span style={{ fontSize: '0.8rem', color: '#ccc' }}>{character.sheetAspects?.[idx] || "---"}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
