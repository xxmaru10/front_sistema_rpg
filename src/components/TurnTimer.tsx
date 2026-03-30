"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Play, Pause, FastForward, Clock } from "lucide-react";

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
            <div className="timer-track">
                <div
                    className="timer-progress"
                    style={{ width: `${percentage}%` }}
                ></div>

                <div className="timer-content">
                    <div className="timer-info">
                        <Clock size={14} className="timer-icon" />
                        <span className="time-display">{formatTime(timeLeft)}</span>
                        {isPaused && <span className="paused-tag">PAUSADO</span>}
                    </div>

                    {isGM && (
                        <div className="timer-controls">
                            <button
                                onClick={onTogglePause}
                                className="timer-ctrl-btn"
                                title={isPaused ? "Retomar" : "Pausar"}
                            >
                                {isPaused ? <Play size={14} /> : <Pause size={14} />}
                            </button>
                            <button
                                onClick={onForcePass}
                                className="timer-ctrl-btn pass"
                                title="Forçar Passagem"
                            >
                                <FastForward size={14} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .turn-timer-container {
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto 10px;
                    position: relative;
                }

                .timer-track {
                    height: 32px;
                    background: rgba(0, 0, 0, 0.4);
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    border-radius: 4px;
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                }

                .timer-progress {
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, rgba(197, 160, 89, 0.1) 0%, rgba(197, 160, 89, 0.3) 100%);
                    box-shadow: 0 0 15px rgba(197, 160, 89, 0.1);
                    transition: width 1s linear;
                    z-index: 1;
                }

                .low-time .timer-progress {
                    background: linear-gradient(90deg, rgba(255, 68, 68, 0.1) 0%, rgba(255, 68, 68, 0.4) 100%);
                    box-shadow: 0 0 15px rgba(255, 68, 68, 0.2);
                    animation: pulse-red 1s infinite alternate;
                }

                @keyframes pulse-red {
                    from { opacity: 0.8; }
                    to { opacity: 1; }
                }

                .timer-content {
                    position: relative;
                    z-index: 2;
                    width: 100%;
                    padding: 0 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .timer-info {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-family: var(--font-header);
                    color: var(--accent-color);
                    font-size: 0.8rem;
                    letter-spacing: 0.1em;
                }

                .time-display {
                    font-weight: bold;
                    min-width: 40px;
                }

                .paused-tag {
                    font-size: 0.6rem;
                    opacity: 0.6;
                    background: rgba(197, 160, 89, 0.1);
                    padding: 2px 6px;
                    border-radius: 2px;
                    letter-spacing: 0.2em;
                }

                .timer-controls {
                    display: flex;
                    gap: 8px;
                }

                .timer-ctrl-btn {
                    background: rgba(197, 160, 89, 0.05);
                    border: 1px solid rgba(197, 160, 89, 0.2);
                    color: var(--accent-color);
                    width: 24px;
                    height: 24px;
                    border-radius: 4px;
                    display: grid;
                    place-items: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    padding: 0;
                }

                .timer-ctrl-btn:hover {
                    background: rgba(197, 160, 89, 0.2);
                    border-color: var(--accent-color);
                }

                .timer-ctrl-btn.pass:hover {
                    background: rgba(255, 68, 68, 0.1);
                    border-color: #ff4444;
                    color: #ff4444;
                }

                .timer-icon {
                    opacity: 0.7;
                }

                .paused .timer-icon {
                    animation: none;
                }
            `}</style>
        </div>
    );
}
