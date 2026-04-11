"use client";

import { useState, useEffect, useMemo, useRef } from "react";


interface TurnTimerProps {
    startTime: string; // ISO date of the last relevant action
    durationMinutes: number;
    isPaused: boolean;
    pausedAt?: string;
    isGM: boolean;
    onExpire: () => void;
    onTogglePause: () => void;
    onForcePass: () => void;
}

export function TurnTimer({
    startTime,
    durationMinutes,
    isPaused,
    pausedAt,
    isGM,
    onExpire,
    onTogglePause,
    onForcePass
}: TurnTimerProps) {
    const totalSeconds = durationMinutes * 60;
    const [timeLeft, setTimeLeft] = useState(totalSeconds);
    const lastTickRef = useRef(Date.now());
    const prevStartTimeRef = useRef(startTime);

    // Reset when startTime effectively changes (turn change)
    useEffect(() => {
        if (startTime !== prevStartTimeRef.current) {
            setTimeLeft(totalSeconds);
            lastTickRef.current = Date.now();
            prevStartTimeRef.current = startTime;
        }
    }, [startTime, totalSeconds]);

    useEffect(() => {
        // Interval for robust local ticking
        const timer = setInterval(() => {
            const now = Date.now();
            const delta = Math.floor((now - lastTickRef.current) / 1000);

            if (delta > 0) {
                if (!isPaused) {
                    setTimeLeft(prev => Math.max(0, prev - delta));
                }
                // Update tick regardless to not accrue time while paused
                lastTickRef.current = now;
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [isPaused]);

    // Check for expiration
    useEffect(() => {
        if (timeLeft <= 0 && !isPaused) {
            onExpire();
        }
    }, [timeLeft, isPaused, onExpire]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const percentage = (timeLeft / totalSeconds) * 100;
    const isLowTime = timeLeft < 30;

    return (
        <div className={`turn-timer-container ${isLowTime ? 'low-time' : ''} ${isPaused ? 'paused' : ''}`}>
            <div className="timer-content">
                <span className="time-display">{formatTime(timeLeft)}</span>
                {isPaused && <span className="paused-tag">PAUSADO</span>}
            </div>

            <style jsx>{`
                .turn-timer-container {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0;
                }

                .timer-content {
                    position: relative;
                    z-index: 2;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 8px;
                }

                .low-time {
                    color: #ff4444 !important;
                    text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
                    animation: pulse-red 1s infinite alternate;
                }

                @keyframes pulse-red {
                    from { transform: scale(1); }
                    to { transform: scale(1.05); }
                }

                .time-display {
                    min-width: 40px;
                    text-align: center;
                    font-family: var(--font-header);
                    letter-spacing: 0.1em;
                }

                .paused-tag {
                    font-size: 0.5rem;
                    opacity: 0.8;
                    color: rgba(197, 160, 89, 0.8);
                    letter-spacing: 0.2em;
                    position: absolute;
                    bottom: -12px;
                    white-space: nowrap;
                }
            `}</style>
        </div>
    );
}
