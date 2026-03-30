"use client";

import React, { useMemo } from 'react';

export type AtmosphericEffectType =
    | 'none'
    | 'rain'
    | 'leaves_green'
    | 'leaves_orange'
    | 'fog'
    | 'sparks'
    | 'snow'
    | 'blizzard'
    | 'inferno'
    | 'acid_rain'
    | 'blood_rain';

interface AtmosphericEffectsProps {
    type: AtmosphericEffectType;
}

export function AtmosphericEffects({ type }: AtmosphericEffectsProps) {
    if (type === 'none') return null;

    return (
        <div className="atmospheric-container">
            {(type === 'rain' || type === 'acid_rain' || type === 'blood_rain') && (
                <RainEffect
                    color={type === 'acid_rain' ? '#4ade80' : type === 'blood_rain' ? '#ef4444' : '#ffffff'}
                />
            )}
            {type === 'leaves_green' && <LeavesEffect type="green" />}
            {type === 'leaves_orange' && <LeavesEffect type="orange" />}
            {type === 'fog' && <FogEffect />}
            {type === 'sparks' && <SparksEffect />}
            {type === 'snow' && <SnowEffect />}
            {type === 'blizzard' && <BlizzardEffect />}
            {type === 'inferno' && <InfernoEffect />}

            <style jsx>{`
                .atmospheric-container {
                    position: fixed;
                    inset: 0;
                    pointer-events: none;
                    z-index: 1;
                    overflow: hidden;
                    width: 100vw;
                    height: 100vh;
                }
            `}</style>
        </div>
    );
}

function RainEffect({ color = '#ffffff' }: { color?: string }) {
    const drops = useMemo(() => Array.from({ length: 150 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2}s`,
        duration: `${(0.3 + Math.random() * 0.4) * 1.43}s`,
        opacity: 0.2 + Math.random() * 0.4,
        height: `${25 + Math.random() * 35}px`,
        width: `${1 + Math.random() * 1.5}px`
    })), []);

    return (
        <div className="rain-wrapper">
            {drops.map(drop => (
                <div
                    key={drop.id}
                    className="rain-drop"
                    style={{
                        left: drop.left,
                        animationDelay: drop.delay,
                        animationDuration: drop.duration,
                        opacity: drop.opacity,
                        height: drop.height,
                        width: drop.width,
                        background: `linear-gradient(to bottom, transparent, ${color})`
                    }}
                />
            ))}
            <style jsx>{`
                .rain-wrapper {
                    position: absolute;
                    inset: 0;
                }
                .rain-drop {
                    position: absolute;
                    top: -100px;
                    animation: rain-fall linear infinite;
                    filter: drop-shadow(0 0 2px ${color}44);
                }
                @keyframes rain-fall {
                    to { transform: translateY(120vh); }
                }
            `}</style>
        </div>
    );
}

function SnowEffect() {
    const flakes = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${5 + Math.random() * 10}s`,
        opacity: 0.3 + Math.random() * 0.5,
        size: `${2 + Math.random() * 4}px`,
        drift: Math.random() * 200 - 100
    })), []);

    return (
        <div className="snow-wrapper">
            {flakes.map(flake => (
                <div
                    key={flake.id}
                    className="snow-flake"
                    style={{
                        left: flake.left,
                        animationDelay: flake.delay,
                        animationDuration: flake.duration,
                        opacity: flake.opacity,
                        width: flake.size,
                        height: flake.size,
                        '--drift': `${flake.drift}px`
                    } as any}
                />
            ))}
            <style jsx>{`
                .snow-wrapper {
                    position: absolute;
                    inset: 0;
                }
                .snow-flake {
                    position: absolute;
                    top: -20px;
                    background: white;
                    border-radius: 50%;
                    filter: blur(1px);
                    animation: snow-fall linear infinite;
                }
                @keyframes snow-fall {
                    0% { transform: translateY(0) translateX(0); }
                    100% { transform: translateY(110vh) translateX(var(--drift)); }
                }
            `}</style>
        </div>
    );
}

function BlizzardEffect() {
    const flakesCount = 300;
    const flakes = useMemo(() => Array.from({ length: flakesCount }, (_, i) => ({
        id: i,
        left: `${-20 + Math.random() * 140}%`,
        delay: `${Math.random() * 3}s`,
        duration: `${0.8 + Math.random() * 1.5}s`,
        opacity: 0.4 + Math.random() * 0.6,
        size: `${1 + Math.random() * 3}px`,
        drift: 400 + Math.random() * 400
    })), []);

    return (
        <div className="blizzard-wrapper">
            <div className="wind-gusts"></div>
            {flakes.map(flake => (
                <div
                    key={flake.id}
                    className="blizzard-flake"
                    style={{
                        left: flake.left,
                        animationDelay: flake.delay,
                        animationDuration: flake.duration,
                        opacity: flake.opacity,
                        width: flake.size,
                        height: flake.size,
                        '--drift': `${flake.drift}px`
                    } as any}
                />
            ))}
            <style jsx>{`
                .blizzard-wrapper {
                    position: absolute;
                    inset: 0;
                }
                .blizzard-flake {
                    position: absolute;
                    top: -20px;
                    background: white;
                    border-radius: 50%;
                    filter: blur(1px);
                    animation: blizzard-fall linear infinite;
                }
                .wind-gusts {
                    position: absolute;
                    inset: 0;
                    background: linear-gradient(
                        45deg,
                        transparent 40%,
                        rgba(255, 255, 255, 0.05) 50%,
                        transparent 60%
                    );
                    background-size: 200% 200%;
                    animation: gust-move 4s ease-in-out infinite;
                }

                @keyframes blizzard-fall {
                    0% { transform: translateY(0) translateX(0) rotate(0deg); }
                    100% { transform: translateY(110vh) translateX(var(--drift)) rotate(360deg); }
                }
                @keyframes gust-move {
                    0% { background-position: -100% -100%; opacity: 0; }
                    50% { opacity: 1; }
                    100% { background-position: 100% 100%; opacity: 0; }
                }
            `}</style>
        </div>
    );
}

function InfernoEffect() {
    const flamesCount = 12;
    const sparksCount = 100;

    const sparks = useMemo(() => Array.from({ length: sparksCount }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 5}s`,
        duration: `${1 + Math.random() * 3}s`,
        size: `${2 + Math.random() * 4}px`,
        drift: Math.random() * 200 - 100
    })), []);

    return (
        <div className="inferno-wrapper">
            <div className="heat-vignette"></div>
            <div className="flames-container">
                {Array.from({ length: flamesCount }).map((_, i) => (
                    <div key={i} className="flame-lick" style={{
                        left: `${(i / flamesCount) * 100}%`,
                        animationDelay: `${Math.random() * 3}s`,
                        animationDuration: `${2 + Math.random() * 2}s`,
                        height: `${150 + Math.random() * 100}px`,
                        opacity: 0.3 + Math.random() * 0.4
                    }} />
                ))}
            </div>
            <div className="sparks-container">
                {sparks.map(spark => (
                    <div key={spark.id} className="fire-spark" style={{
                        left: spark.left,
                        animationDelay: spark.delay,
                        animationDuration: spark.duration,
                        width: spark.size,
                        height: spark.size,
                        '--drift': `${spark.drift}px`
                    } as any} />
                ))}
            </div>
            <style jsx>{`
                .inferno-wrapper {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at center, transparent 30%, rgba(255, 68, 0, 0.1) 70%, rgba(255, 34, 0, 0.2) 100%);
                }
                .heat-vignette {
                    position: absolute;
                    inset: 0;
                    box-shadow: inset 0 0 150px rgba(255, 68, 0, 0.3);
                    animation: pulse-heat 4s ease-in-out infinite;
                }
                .flames-container {
                    position: absolute;
                    bottom: -20px;
                    left: 0;
                    width: 100%;
                    height: 300px;
                    display: flex;
                    align-items: flex-end;
                    filter: blur(15px) contrast(200%);
                }
                .flame-lick {
                    position: absolute;
                    width: 120px;
                    background: linear-gradient(to top, #ff4400, #ff8800, transparent);
                    border-radius: 50% 50% 20% 20%;
                    animation: lick-move ease-in-out infinite;
                    mix-blend-mode: screen;
                }
                .fire-spark {
                    position: absolute;
                    bottom: -10px;
                    background: #ffcc33;
                    border-radius: 50%;
                    box-shadow: 0 0 10px #ffaa00, 0 0 20px #ff6600;
                    animation: spark-rise-fire linear infinite;
                }

                @keyframes pulse-heat {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 0.8; }
                }
                @keyframes lick-move {
                    0%, 100% { transform: scaleY(1) translateY(0) skewX(0deg); }
                    50% { transform: scaleY(1.3) translateY(-20px) skewX(10deg); }
                }
                @keyframes spark-rise-fire {
                    0% { transform: translateY(0) translateX(0) scale(1.5); opacity: 0; }
                    20% { opacity: 1; }
                    100% { transform: translateY(-110vh) translateX(var(--drift)) scale(0); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

function LeavesEffect({ type }: { type: 'green' | 'orange' }) {
    const leavesCount = 80;
    const leaves = useMemo(() => Array.from({ length: leavesCount }, (_, i) => {
        const colorPalette = type === 'orange'
            ? ['#a16207', '#854d0e', '#b45309', '#d97706', '#9a3412'] // Orange/Autumn
            : ['#4d7c0f', '#3f6212', '#166534', '#15803d', '#14532d']; // Green/Forest

        return {
            id: i,
            left: `${Math.random() * 100}%`,
            delay: `${Math.random() * 15}s`,
            duration: `${7 + Math.random() * 8}s`,
            size: `${18 + Math.random() * 22}px`,
            color: colorPalette[Math.floor(Math.random() * colorPalette.length)],
            drift: Math.random() * 300 - 150,
            rotation: Math.random() * 360,
            swaySpeed: 1 + Math.random() * 2
        };
    }), [type]);

    return (
        <div className="leaves-wrapper">
            {leaves.map(leaf => (
                <div
                    key={leaf.id}
                    className="leaf"
                    style={{
                        left: leaf.left,
                        animationDelay: leaf.delay,
                        animationDuration: leaf.duration,
                        width: leaf.size,
                        height: leaf.size,
                        '--drift': `${leaf.drift}px`,
                        '--rotate': `${leaf.rotation}deg`,
                        '--sway': `${leaf.swaySpeed}s`
                    } as any}
                >
                    <svg viewBox="0 0 24 24" fill={leaf.color} style={{
                        opacity: 0.8,
                        filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.4))'
                    }}>
                        <path d="M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8.12,20C11,20 14.27,15.5 17,12C18,12 20,13.5 19,15L21,16C21,12 21,7 19,5C17.5,3.5 14.5,4 13,5.25C11,2.5 10,1 6,1C5,1 4,1.5 4,2.5C4,3.5 5,4 6,5C7,6 9,7 11,8C9,14 11.5,14 17,8Z" />
                    </svg>
                </div>
            ))}
            <style jsx>{`
                .leaves-wrapper {
                    position: absolute;
                    inset: 0;
                }
                .leaf {
                    position: absolute;
                    top: -80px;
                    animation: leaf-fall-complex linear infinite;
                    will-change: transform;
                }
                @keyframes leaf-fall-complex {
                    0% { transform: translate(0, 0) rotate(var(--rotate)) rotateY(0deg); }
                    25% { transform: translate(calc(var(--drift) * 0.3), 25vh) rotate(calc(var(--rotate) + 90deg)) rotateY(180deg) translateX(20px); }
                    50% { transform: translate(calc(var(--drift) * 0.6), 50vh) rotate(calc(var(--rotate) + 180deg)) rotateY(360deg) translateX(-20px); }
                    75% { transform: translate(calc(var(--drift) * 0.8), 75vh) rotate(calc(var(--rotate) + 270deg)) rotateY(540deg) translateX(20px); }
                    100% { transform: translate(var(--drift), 115vh) rotate(calc(var(--rotate) + 360deg)) rotateY(720deg); }
                }
            `}</style>
        </div>
    );
}

function FogEffect() {
    return (
        <div className="fog-wrapper">
            <div className="smoke-container">
                <div className="smoke-layer layer-1"></div>
                <div className="smoke-layer layer-2"></div>
                <div className="smoke-layer layer-3"></div>
                <div className="smoke-layer layer-4"></div>
                <div className="smoke-layer layer-5"></div>
                <div className="smoke-layer layer-6"></div>
            </div>
            <style jsx>{`
                .fog-wrapper {
                    position: absolute;
                    inset: 0;
                    pointer-events: none;
                }
                .smoke-container {
                    position: absolute;
                    inset: 0;
                    filter: url(#smoke-filter);
                    background: radial-gradient(circle at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 100%);
                }
                .smoke-layer {
                    position: absolute;
                    width: 150%;
                    height: 150%;
                    top: -25%;
                    left: -25%;
                    background: radial-gradient(
                        circle at center,
                        rgba(245, 245, 250, 0.5) 0%,
                        rgba(200, 200, 210, 0.3) 30%,
                        rgba(100, 100, 110, 0.1) 60%,
                        transparent 80%
                    );
                    mask-image: radial-gradient(circle at center, black 0%, transparent 75%);
                    -webkit-mask-image: radial-gradient(circle at center, black 0%, transparent 75%);
                    will-change: transform;
                }
                
                .layer-1 { animation: billow-1 40s linear infinite; opacity: 0.7; }
                .layer-2 { animation: billow-2 55s linear infinite reverse; opacity: 0.5; transform: scale(1.3); }
                .layer-3 { animation: billow-3 30s ease-in-out infinite alternate; opacity: 0.4; }
                .layer-4 { animation: billow-1 65s linear infinite reverse; opacity: 0.6; transform: scale(1.1); }
                .layer-5 { 
                    animation: billow-4 50s linear infinite; 
                    background: radial-gradient(circle at 70% 30%, rgba(255,255,255,0.4) 0%, transparent 50%);
                }
                .layer-6 {
                    animation: billow-2 45s linear infinite;
                    background: radial-gradient(circle at 20% 80%, rgba(255,255,255,0.3) 0%, transparent 40%);
                }

                @keyframes billow-1 {
                    0% { transform: translate(-5%, -5%) rotate(0deg); }
                    50% { transform: translate(5%, 0%) rotate(180deg) scale(1.05); }
                    100% { transform: translate(-5%, -5%) rotate(360deg); }
                }
                @keyframes billow-2 {
                    0% { transform: scale(1.3) translate(5%, -5%) rotate(0deg); }
                    50% { transform: scale(1.35) translate(0%, 5%) rotate(-180deg); }
                    100% { transform: scale(1.3) translate(5%, -5%) rotate(-360deg); }
                }
                @keyframes billow-3 {
                    0% { transform: translate(-2%, 5%) scale(1); }
                    100% { transform: translate(2%, -5%) scale(1.2); }
                }
                @keyframes billow-4 {
                    0% { transform: scale(1.8) rotate(0deg) translate(0, 0); }
                    100% { transform: scale(1.8) rotate(360deg) translate(-5%, -5%); }
                }
            `}</style>

            <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                <filter id="smoke-filter">
                    <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="4" seed="1" />
                    <feDisplacementMap in="SourceGraphic" scale="120" />
                </filter>
            </svg>
        </div>
    );
}

function SparksEffect() {
    const sparksCount = 80;
    const sparks = useMemo(() => Array.from({ length: sparksCount }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 10}s`,
        duration: `${3 + Math.random() * 5}s`,
        size: `${1.5 + Math.random() * 3.75}px`,
        color: ['#ffbb00', '#ff8800', '#ff4400', '#ffd000', '#ffcc33'][Math.floor(Math.random() * 5)],
        drift: Math.random() * 250 - 125,
    })), []);

    return (
        <div className="sparks-wrapper">
            {sparks.map(spark => (
                <div
                    key={spark.id}
                    className="spark"
                    style={{
                        left: spark.left,
                        animationDelay: spark.delay,
                        animationDuration: spark.duration,
                        width: spark.size,
                        height: spark.size,
                        background: spark.color,
                        boxShadow: `0 0 10px ${spark.color}, 0 0 20px ${spark.color}`,
                        '--drift': `${spark.drift}px`
                    } as any}
                />
            ))}
            <style jsx>{`
                .sparks-wrapper {
                    position: absolute;
                    inset: 0;
                }
                .spark {
                    position: absolute;
                    bottom: -50px;
                    border-radius: 50%;
                    animation: spark-float-up-full linear infinite;
                    opacity: 0;
                    will-change: transform, opacity;
                }
                @keyframes spark-float-up-full {
                    0% { transform: translateY(0) translateX(0) scale(1.2); opacity: 0; }
                    15% { opacity: 1; }
                    85% { opacity: 1; }
                    100% { transform: translateY(-120vh) translateX(var(--drift)) scale(0); opacity: 0; }
                }
            `}</style>
        </div>
    );
}
