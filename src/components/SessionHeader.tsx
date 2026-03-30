"use client";

import { useState, useEffect, useRef } from "react";
import { ImageLibraryModal } from "./ImageLibraryModal";
import { AtmosphericEffectType } from "./AtmosphericEffects";

interface SessionHeaderProps {
    imageUrl?: string;
    onUpdate: (url: string) => void;
    isGM: boolean;
    tabName: string;
    // Arena specific actions
    onSummonAlly?: () => void;
    onSummonThreat?: () => void;
    onToggleChallenge?: () => void;
    onOpenTurnOrder?: () => void;
    challengeActive?: boolean;
    children?: React.ReactNode;
    soundSettings?: {
        portrait?: string;
    };
    inCombat?: boolean;
    onAtmosphericEffectChange?: (type: AtmosphericEffectType) => void;
    currentAtmosphericEffect?: AtmosphericEffectType;
    videoStream?: MediaStream | null;
    onStartScreenShare?: () => void;
    onStopScreenShare?: () => void;
}

export function SessionHeader({
    imageUrl,
    onUpdate,
    isGM,
    tabName,
    onSummonAlly,
    onSummonThreat,
    onToggleChallenge,
    onOpenTurnOrder,
    challengeActive,
    children,
    soundSettings,
    inCombat,
    onAtmosphericEffectChange,
    currentAtmosphericEffect = "none",
    videoStream,
    onStartScreenShare,
    onStopScreenShare
}: SessionHeaderProps) {
    const [showLibrary, setShowLibrary] = useState(false);
    const [showSummonMenu, setShowSummonMenu] = useState(false);
    const [showBgMenu, setShowBgMenu] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    if (!imageUrl && !isGM && !videoStream && !children) return null;

    const isArena = tabName === "ARENA";

    return (
        <div className="header-container" style={{
            position: 'relative',
            marginTop: '70px',
            width: '100%',
            height: '300px',
            zIndex: 101,
            overflow: 'visible',
            borderTop: isArena ? 'none' : '3px solid var(--accent-color)',
            borderBottom: isArena ? 'none' : '3px solid var(--accent-color)',
            borderLeft: isArena ? 'none' : '3px solid var(--accent-color)',
            borderRight: isArena ? 'none' : '3px solid var(--accent-color)',
            boxSizing: 'border-box',
            boxShadow: isArena ? 'none' : '0 0 20px rgba(var(--accent-rgb), 0.6), inset 0 0 20px rgba(var(--accent-rgb), 0.2)',
            transition: 'all 0.5s ease-in-out',
            background: 'transparent'
        }}>
            {imageUrl && !isArena ? (
                <>
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                    }} />
                    <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(8,8,8,1) 100%)',
                        opacity: 0.8
                    }} />
                </>
            ) : !isArena ? (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {isGM && <span style={{ color: 'rgba(255,255,255,0.2)' }}>Adicionar Capa</span>}
                </div>
            ) : null}

            <style jsx>{`
                @media (max-width: 768px) {
                    .header-container {
                        height: auto !important;
                        min-height: 200px;
                        padding-bottom: 60px;
                    }
                    .gm-actions-top {
                        position: relative !important;
                        bottom: auto !important;
                        right: auto !important;
                        align-items: center !important;
                        padding: 10px;
                        width: 100%;
                        background: rgba(0,0,0,0.4);
                    }
                    .gm-actions-bottom {
                        position: relative !important;
                        bottom: auto !important;
                        left: auto !important;
                        flex-wrap: wrap;
                        justify-content: center;
                        padding: 10px;
                        width: 100%;
                        background: rgba(0,0,0,0.6);
                    }
                    .action-btn {
                        flex: 1 1 140px;
                        height: 36px !important;
                    }
                }
            `}</style>

            {isGM && (
                <div
                    className="gm-actions-top"
                    style={{
                        position: 'absolute',
                        bottom: '16px',
                        right: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        alignItems: 'flex-end',
                        zIndex: 110
                    }}
                >
                    <div style={{ position: 'relative', display: 'flex', gap: '4px', width: '100%', justifyContent: 'flex-end' }}>
                        <select
                            value={currentAtmosphericEffect === 'none' ? 'placeholder' : currentAtmosphericEffect}
                            onChange={(e) => {
                                if (e.target.value !== 'placeholder') {
                                    onAtmosphericEffectChange?.(e.target.value as any);
                                }
                            }}
                            style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid var(--accent-color)',
                                color: 'var(--accent-color)',
                                backdropFilter: 'blur(4px)',
                                padding: '4px 8px',
                                fontFamily: 'var(--font-header)',
                                letterSpacing: '0.05em',
                                fontSize: '0.65rem',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                height: '32px',
                                outline: 'none',
                                width: '120px'
                            }}
                        >
                            <option value="placeholder" style={{ background: '#000' }} disabled hidden>✨ EFEITOS</option>
                            <option value="none" style={{ background: '#000' }}>🚫 NENHUM</option>
                            <option value="rain" style={{ background: '#000' }}>🌧️ CHUVA</option>
                            <option value="snow" style={{ background: '#000' }}>❄️ NEVE</option>
                            <option value="blizzard" style={{ background: '#000' }}>🌪️ TEMPESTADE DE NEVE</option>
                            <option value="leaves_green" style={{ background: '#000' }}>🍃 FOLHAS VERDES</option>
                            <option value="leaves_orange" style={{ background: '#000' }}>🍂 FOLHAS LARANJAS</option>
                            <option value="fog" style={{ background: '#000' }}>🌫️ NÉVOA</option>
                            <option value="sparks" style={{ background: '#000' }}>🔥 FAÍSCAS</option>
                            <option value="inferno" style={{ background: '#000' }}>🔥 INCÊNDIO</option>
                            <option value="acid_rain" style={{ background: '#000' }}>🧪 CHUVA ÁCIDA</option>
                            <option value="blood_rain" style={{ background: '#000' }}>🩸 CHUVA DE SANGUE</option>
                        </select>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowBgMenu(!showBgMenu)}
                            className="btn btn-secondary btn-sm action-btn"
                            style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(var(--accent-rgb), 0.4)',
                                color: 'var(--accent-color)',
                                backdropFilter: 'blur(4px)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '0 12px',
                                marginLeft: '8px',
                                height: '32px'
                            }}
                            title="Opções de Fundo"
                        >
                            <span>🎨</span>
                            <span style={{ fontSize: '0.65rem' }}>FUNDO ▼</span>
                        </button>

                        {showBgMenu && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                marginTop: '8px',
                                background: '#0a0a0a',
                                border: '1px solid var(--accent-color)',
                                borderRadius: '4px',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                zIndex: 30,
                                boxShadow: '0 4px 12px rgba(var(--accent-rgb),0.6)',
                                minWidth: '180px'
                            }}>
                                {isGM && tabName === "ARENA" && (
                                    <button
                                        onClick={() => {
                                            videoStream ? onStopScreenShare?.() : onStartScreenShare?.();
                                            setShowBgMenu(false);
                                        }}
                                        style={{
                                            background: videoStream ? 'rgba(200, 50, 50, 0.15)' : 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(var(--accent-rgb), 0.3)',
                                            color: videoStream ? '#ff6b6b' : '#fff',
                                            padding: '10px 16px',
                                            fontFamily: 'var(--font-header)',
                                            letterSpacing: '0.05em',
                                            fontSize: '0.65rem',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!videoStream) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                            else e.currentTarget.style.background = 'rgba(200, 50, 50, 0.3)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!videoStream) e.currentTarget.style.background = 'transparent';
                                            else e.currentTarget.style.background = 'rgba(200, 50, 50, 0.15)';
                                        }}
                                    >
                                        <span>📺</span> {videoStream ? 'PARAR TELA' : 'COMP. TELA'}
                                    </button>
                                )}
                                {isArena && (
                                    <button
                                        onClick={() => {
                                            onUpdate("BATTLEMAP_ACTIVATE"); // Special string to trigger battlemap activation in parent
                                            setShowBgMenu(false);
                                        }}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(var(--accent-rgb), 0.3)',
                                            color: '#fff',
                                            padding: '10px 16px',
                                            fontFamily: 'var(--font-header)',
                                            letterSpacing: '0.05em',
                                            fontSize: '0.65rem',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            transition: 'background 0.2s',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <span>⚔️</span> BATTLEMAP
                                    </button>
                                )}
                                <button
                                    onClick={() => { setShowLibrary(true); setShowBgMenu(false); }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#fff',
                                        padding: '10px 16px',
                                        fontFamily: 'var(--font-header)',
                                        letterSpacing: '0.05em',
                                        fontSize: '0.65rem',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    <span>📚</span> ALTERAR BANNER
                                </button>
                            </div>
                        )}
                    </div>
                    <ImageLibraryModal
                        isOpen={showLibrary}
                        onClose={() => setShowLibrary(false)}
                        onSelect={(url) => {
                            onUpdate(url);
                            setShowLibrary(false);
                        }}
                    />
                </div>
            )}

            {isGM && tabName === "ARENA" && (
                <div
                    className="gm-actions-bottom"
                    style={{
                        position: 'absolute',
                        bottom: '8px',
                        left: '16px',
                        display: 'flex',
                        gap: '8px',
                        zIndex: 110,
                        pointerEvents: 'auto'
                    }}
                >
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowSummonMenu(!showSummonMenu)}
                            className="btn btn-primary btn-sm action-btn"
                            style={{
                                background: 'linear-gradient(135deg, var(--accent-color) 0%, #F9E79F 50%, var(--accent-color) 100%)',
                                border: '1px solid var(--accent-color)',
                                color: '#000',
                                padding: '6px 16px',
                                fontFamily: 'var(--font-header)',
                                fontWeight: 'bold',
                                letterSpacing: '0.12em',
                                fontSize: '0.7rem',
                                boxShadow: '0 0 15px rgba(var(--accent-rgb), 0.4)'
                            }}
                        >
                            CONVOCAR ▼
                        </button>

                        {showSummonMenu && (
                            <div style={{
                                position: 'absolute',
                                bottom: '100%',
                                left: 0,
                                marginBottom: '8px',
                                background: '#0a0a0a',
                                border: '1px solid var(--accent-color)',
                                borderRadius: '4px',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                zIndex: 30,
                                boxShadow: '0 4px 12px rgba(var(--accent-rgb),0.6)',
                                minWidth: '160px'
                            }}>
                                <button
                                    onClick={() => { onSummonThreat?.(); setShowSummonMenu(false); }}
                                    style={{
                                        background: 'rgba(255, 50, 50, 0.15)',
                                        border: 'none',
                                        borderBottom: '1px solid rgba(var(--accent-rgb), 0.3)',
                                        color: '#ff6b6b',
                                        padding: '10px 16px',
                                        fontFamily: 'var(--font-header)',
                                        fontWeight: 'bold',
                                        letterSpacing: '0.1em',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 50, 50, 0.3)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 50, 50, 0.15)'}
                                >
                                    👿 INIMIGO
                                </button>
                                <button
                                    onClick={() => { onSummonAlly?.(); setShowSummonMenu(false); }}
                                    style={{
                                        background: 'rgba(50, 150, 255, 0.15)',
                                        border: 'none',
                                        color: '#50a6ff',
                                        padding: '10px 16px',
                                        fontFamily: 'var(--font-header)',
                                        fontWeight: 'bold',
                                        letterSpacing: '0.1em',
                                        fontSize: '0.7rem',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(50, 150, 255, 0.3)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(50, 150, 255, 0.15)'}
                                >
                                    🙎‍♂️ ALIADO
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onToggleChallenge}
                        className={`btn btn-sm action-btn ${challengeActive ? "btn-primary" : "btn-secondary"}`}
                        style={{
                            background: challengeActive ? 'rgba(var(--accent-rgb), 0.8)' : 'rgba(0,0,0,0.6)',
                            border: '1px solid var(--accent-color)',
                            color: challengeActive ? '#000' : 'var(--accent-color)',
                            backdropFilter: 'blur(4px)',
                            padding: '6px 16px',
                            fontFamily: 'var(--font-header)',
                            letterSpacing: '0.1em',
                            fontSize: '0.7rem'
                        }}
                    >
                        {challengeActive ? "MODO COMBATE" : "MODO DESAFIO"}
                    </button>

                    {isGM && !challengeActive && (
                        <button
                            onClick={onOpenTurnOrder}
                            className="btn btn-secondary btn-sm action-btn"
                            style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(80, 166, 255, 0.4)',
                                color: '#50a6ff',
                                backdropFilter: 'blur(4px)',
                                padding: '6px 16px',
                                fontFamily: 'var(--font-header)',
                                letterSpacing: '0.1em',
                                fontSize: '0.7rem'
                            }}
                        >
                            ORDEM DE TURNO
                        </button>
                    )}

                </div>
            )}


            {children && (
                <div style={{
                    position: 'absolute',
                    top: '0',
                    left: '0',
                    width: '100%',
                    height: '100%',
                    zIndex: 25,
                    pointerEvents: 'none', // Allow clicking through to banner upload unless hitting a button
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'center',
                    paddingTop: '20px'
                }}>
                    <div style={{ pointerEvents: 'auto' }}>
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}
