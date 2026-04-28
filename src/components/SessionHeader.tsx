"use client";

import { useEffect, useState } from "react";
import { ImageLibraryModal } from "./ImageLibraryModal";
import { AtmosphericEffectType } from "./AtmosphericEffects";
import { battlemapToolStore } from "@/lib/battlemapToolStore";
import {
    Sparkles,
    CircleSlash,
    CloudRain,
    Snowflake,
    Wind,
    Leaf,
    Cloud,
    Flame,
    FlaskConical,
    Droplet,
    Palette,
    Monitor,
    Swords,
    Library,
    ChevronDown,
    Tv,
} from "lucide-react";

const ATMOSPHERIC_OPTIONS: { value: AtmosphericEffectType, label: string, icon: any, color?: string }[] = [
    { value: 'none', label: 'NENHUM', icon: CircleSlash },
    { value: 'rain', label: 'CHUVA', icon: CloudRain },
    { value: 'snow', label: 'NEVE', icon: Snowflake },
    { value: 'blizzard', label: 'BLIZZARD', icon: Wind },
    { value: 'leaves_green', label: 'FOLHAS VERDES', icon: Leaf, color: '#4ade80' },
    { value: 'leaves_orange', label: 'FOLHAS LARANJAS', icon: Leaf, color: '#f97316' },
    { value: 'fog', label: 'NÉVOA', icon: Cloud },
    { value: 'sparks', label: 'FAÍSCAS', icon: Sparkles },
    { value: 'inferno', label: 'INCÊNDIO', icon: Flame },
    { value: 'acid_rain', label: 'CHUVA ÁCIDA', icon: FlaskConical },
    { value: 'blood_rain', label: 'CHUVA SANGUE', icon: Droplet },
];

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
    connectionStatus?: string;
    title?: string;
    showDiceRoller?: boolean;
    onToggleDiceRoller?: () => void;
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
    onStopScreenShare,
    connectionStatus,
    title,
    showDiceRoller,
    onToggleDiceRoller
}: SessionHeaderProps) {
    const [showLibrary, setShowLibrary] = useState(false);
    const [showBgMenu, setShowBgMenu] = useState(false);
    const [showEffectsMenu, setShowEffectsMenu] = useState(false);
    const [isMobilePerfMode, setIsMobilePerfMode] = useState(false);
    const [isTheaterMode, setIsTheaterMode] = useState(battlemapToolStore.isTheaterMode);

    useEffect(() => {
        const viewportMedia = window.matchMedia("(max-width: 1024px)");
        const coarsePointerMedia = window.matchMedia("(hover: none), (pointer: coarse)");
        const syncMedia = () => setIsMobilePerfMode(viewportMedia.matches || coarsePointerMedia.matches);

        syncMedia();
        viewportMedia.addEventListener("change", syncMedia);
        coarsePointerMedia.addEventListener("change", syncMedia);

        return () => {
            viewportMedia.removeEventListener("change", syncMedia);
            coarsePointerMedia.removeEventListener("change", syncMedia);
        };
    }, []);

    useEffect(() => {
        const unsub = battlemapToolStore.subscribe(() => {
            setIsTheaterMode(battlemapToolStore.isTheaterMode);
        });
        return unsub;
    }, []);

    if (!imageUrl && !isGM && !videoStream && !children) return null;

    const isArena = tabName === "ARENA";
    const hasCoverBanner = Boolean(imageUrl && !isArena);
    const isMobilePerfOutsideArena = isMobilePerfMode && !isArena;
    const renderImageBanner = hasCoverBanner && !isMobilePerfOutsideArena;
    const shellBorder = isArena
        ? "none"
        : isMobilePerfOutsideArena
            ? "1px solid rgba(var(--accent-rgb), 0.14)"
            : "1px solid rgba(var(--accent-rgb), 0.3)";
    const shellShadow = isArena ? "none" : isMobilePerfOutsideArena ? "none" : "0 0 8px rgba(var(--accent-rgb), 0.16)";
    const headerHeight = isArena
        ? "300px"
        : isMobilePerfOutsideArena
            ? (hasCoverBanner ? "160px" : "136px")
            : hasCoverBanner
                ? "240px"
                : "180px";

    return (
        <div className={`header-container${isMobilePerfOutsideArena ? " mobile-perf-outside-arena" : ""}`} style={{
            position: 'relative',
            marginTop: '70px',
            width: '100%',
            height: headerHeight,
            zIndex: 101,
            overflow: 'visible',
            borderTop: shellBorder,
            borderBottom: shellBorder,
            borderLeft: shellBorder,
            borderRight: shellBorder,
            boxSizing: 'border-box',
            boxShadow: shellShadow,
            transition: isMobilePerfOutsideArena ? 'none' : 'border-color 0.3s ease, box-shadow 0.3s ease',
            background: 'transparent'
        }}>
            {hasCoverBanner ? (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: renderImageBanner
                        ? `linear-gradient(to bottom, rgba(0,0,0,0.06) 0%, rgba(8,8,8,0.92) 100%), url(${imageUrl})`
                        : 'linear-gradient(180deg, rgba(var(--accent-rgb), 0.12) 0%, rgba(10, 10, 10, 0.92) 58%, rgba(8, 8, 8, 0.98) 100%)',
                    backgroundSize: renderImageBanner ? 'cover, cover' : 'cover',
                    backgroundPosition: renderImageBanner ? 'center, center' : 'center',
                }} />
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

            {/* Removed Giant Titles */}

            <style jsx>{`
                @media (max-width: 768px) {
                    .header-container {
                        height: auto !important;
                        min-height: 200px;
                        padding-bottom: 60px;
                    }
                    .header-container.mobile-perf-outside-arena {
                        min-height: 150px;
                        padding-bottom: 44px;
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
                        <button
                            onClick={() => setShowEffectsMenu(!showEffectsMenu)}
                            className="btn btn-secondary btn-sm action-btn"
                            style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid var(--accent-color)',
                                color: 'var(--accent-color)',
                                backdropFilter: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '0 12px',
                                height: '32px'
                            }}
                        >
                            <Sparkles size={14} />
                            <span style={{ fontSize: '0.65rem' }}>EFEITOS ▼</span>
                        </button>

                        {showEffectsMenu && (
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
                                zIndex: 120,
                                boxShadow: '0 4px 12px rgba(var(--accent-rgb),0.6)',
                                minWidth: '180px'
                            }}>
                                {ATMOSPHERIC_OPTIONS.map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => {
                                            onAtmosphericEffectChange?.(opt.value);
                                            setShowEffectsMenu(false);
                                        }}
                                        style={{
                                            background: currentAtmosphericEffect === opt.value ? 'rgba(var(--accent-rgb), 0.2)' : 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(var(--accent-rgb), 0.1)',
                                            color: opt.color || '#fff',
                                            padding: '8px 16px',
                                            fontFamily: 'var(--font-header)',
                                            fontSize: '0.65rem',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            transition: '0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = currentAtmosphericEffect === opt.value ? 'rgba(var(--accent-rgb), 0.2)' : 'transparent'}
                                    >
                                        <opt.icon size={14} />
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowBgMenu(!showBgMenu)}
                            className="btn btn-secondary btn-sm action-btn"
                            style={{
                                background: 'rgba(0,0,0,0.6)',
                                border: '1px solid rgba(var(--accent-rgb), 0.4)',
                                color: 'var(--accent-color)',
                                backdropFilter: 'none',
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
                            <Palette size={14} />
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
                                        <Tv size={14} /> {videoStream ? 'PARAR TELA' : 'COMP. TELA'}
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
                                        <Swords size={14} /> BATTLEMAP
                                    </button>
                                )}
                                {isArena && (
                                    <button
                                        onClick={() => {
                                            if (!isTheaterMode) {
                                                onUpdate("BATTLEMAP_ACTIVATE");
                                                battlemapToolStore.setTheaterMode(true);
                                            } else {
                                                battlemapToolStore.setTheaterMode(false);
                                            }
                                            setShowBgMenu(false);
                                        }}
                                        style={{
                                            background: isTheaterMode ? 'rgba(var(--accent-rgb), 0.18)' : 'transparent',
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
                                        onMouseEnter={(e) => {
                                            if (!isTheaterMode) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isTheaterMode) e.currentTarget.style.background = 'transparent';
                                        }}
                                    >
                                        <Monitor size={14} /> {isTheaterMode ? 'SAIR CENA' : 'MODO CENA'}
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
                                    <Library size={14} /> ALTERAR BANNER
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
                        cropConfig={isArena ? null : { aspectRatio: 16 / 5, outputWidth: 1280, outputHeight: 400 }}
                    />
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
                    paddingTop: '50px'
                }}>
                    <div style={{ pointerEvents: 'auto' }}>
                        {children}
                    </div>
                </div>
            )}

            {(connectionStatus === 'TIMED_OUT' || connectionStatus === 'CHANNEL_ERROR' || connectionStatus === 'CONNECTING') && (
                <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 200,
                    background: connectionStatus === 'CONNECTING' ? 'rgba(var(--accent-rgb), 0.9)' : 'rgba(200, 50, 50, 0.9)',
                    color: connectionStatus === 'CONNECTING' ? '#000' : '#fff',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '0.6rem',
                    fontFamily: 'var(--font-header)',
                    letterSpacing: '0.1em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: connectionStatus === 'CONNECTING' ? '0 0 15px rgba(var(--accent-rgb), 0.4)' : '0 0 15px rgba(200, 50, 50, 0.4)',
                    backdropFilter: 'blur(4px)',
                    animation: 'pulse 2s infinite'
                }}>
                    <span style={{ 
                        width: '6px', 
                        height: '6px', 
                        borderRadius: '50%', 
                        background: '#fff', 
                        animation: 'blink 1s infinite' 
                    }} />
                    {connectionStatus === 'CONNECTING' ? 'SINCRONIZANDO...' : 'CONEXÀO INSTÁVEL'}
                </div>
            )}
        </div>
    );
}
