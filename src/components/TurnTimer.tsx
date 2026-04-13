"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Play, Pause, Save, X } from "lucide-react";


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

    const [showSettings, setShowSettings] = useState(false);
    const [editMinutes, setEditMinutes] = useState(0);
    const [editSeconds, setEditSeconds] = useState(0);

    const handleOpenSettings = () => {
        if (!isGM) return;
        setEditMinutes(Math.floor(timeLeft / 60));
        setEditSeconds(timeLeft % 60);
        setShowSettings(true);
    };

    const handleSaveSettings = () => {
        setTimeLeft(editMinutes * 60 + editSeconds);
        setShowSettings(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const percentage = (timeLeft / totalSeconds) * 100;
    const isLowTime = timeLeft < 30;

    return (
        <div className={`turn-timer-container ${isLowTime ? 'low-time' : ''} ${isPaused ? 'paused' : ''} ${isGM ? 'gm-clickable' : ''}`} onClick={isGM ? handleOpenSettings : undefined}>
            <div className="timer-content">
                <span className="time-display">{formatTime(timeLeft)}</span>
                {isPaused && <span className="paused-tag">PAUSADO</span>}
            </div>

            {showSettings && isGM && (
                <div className="timer-settings-popover" onClick={e => e.stopPropagation()}>
                    <div className="popover-header">
                        <span className="popover-title">AJUSTAR TEMPO</span>
                        <button type="button" className="close-btn" onClick={() => setShowSettings(false)}>
                            <X size={14} />
                        </button>
                    </div>
                    <div className="popover-body">
                        <div className="time-inputs">
                            <input 
                                type="number" 
                                value={editMinutes === null ? '' : editMinutes} 
                                onChange={e => setEditMinutes(e.target.value === '' ? null as any : (parseInt(e.target.value) || 0))} 
                                min="0" 
                                className="time-input"
                            />
                            <span>:</span>
                            <input 
                                type="number" 
                                value={editSeconds === null ? '' : editSeconds} 
                                onChange={e => setEditSeconds(e.target.value === '' ? null as any : (parseInt(e.target.value) || 0))} 
                                min="0" 
                                max="59" 
                                className="time-input"
                            />
                        </div>
                        <div className="popover-actions">
                            <button type="button" className={`action-btn ${isPaused ? 'btn-play' : 'btn-pause'}`} onClick={onTogglePause}>
                                {isPaused ? <Play size={14}/> : <Pause size={14}/>}
                                {isPaused ? 'PLAY' : 'PAUSE'}
                            </button>
                            <button type="button" className="action-btn btn-save" onClick={handleSaveSettings}>
                                <Save size={14}/> SALVAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

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

                .gm-clickable {
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .gm-clickable:hover {
                    transform: scale(1.05);
                    text-shadow: 0 0 10px rgba(197, 160, 89, 0.5);
                }

                .timer-settings-popover {
                    position: absolute;
                    top: calc(100% + 15px);
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(10, 15, 25, 0.95);
                    border: 1px solid rgba(197, 160, 89, 0.4);
                    border-radius: 8px;
                    padding: 12px;
                    min-width: 180px;
                    z-index: 1000;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
                    cursor: default;
                    animation: pop-in 0.2s ease-out;
                }

                @keyframes pop-in {
                    from { opacity: 0; transform: translate(-50%, -10px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }

                .popover-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    padding-bottom: 8px;
                    margin-bottom: 12px;
                }

                .popover-title {
                    font-family: var(--font-header);
                    font-size: 0.65rem;
                    letter-spacing: 0.1em;
                    color: rgba(255, 255, 255, 0.7);
                }

                .close-btn {
                    background: transparent;
                    border: none;
                    color: rgba(255, 255, 255, 0.5);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4px;
                    border-radius: 4px;
                }

                .close-btn:hover {
                    color: #ff4444;
                    background: rgba(255, 68, 68, 0.1);
                }

                .time-inputs {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .time-input {
                    width: 50px;
                    height: 36px;
                    background: rgba(0, 0, 0, 0.5);
                    border: 1px solid rgba(197, 160, 89, 0.4);
                    border-radius: 6px;
                    color: #fff;
                    font-family: 'Courier New', monospace;
                    font-size: 1.1rem;
                    font-weight: bold;
                    text-align: center;
                }

                .time-input:focus {
                    outline: none;
                    border-color: rgba(197, 160, 89, 1);
                    box-shadow: 0 0 10px rgba(197, 160, 89, 0.2);
                }

                .popover-actions {
                    display: flex;
                    gap: 8px;
                }

                .action-btn {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 4px;
                    height: 32px;
                    border-radius: 4px;
                    font-family: var(--font-header);
                    font-size: 0.65rem;
                    letter-spacing: 0.1em;
                    cursor: pointer;
                    border: none;
                    color: #fff;
                    transition: all 0.2s;
                }

                .btn-play {
                    background: rgba(74, 222, 128, 0.2);
                    border: 1px solid rgba(74, 222, 128, 0.4);
                    color: #4ade80;
                }

                .btn-play:hover {
                    background: rgba(74, 222, 128, 0.3);
                }

                .btn-pause {
                    background: rgba(250, 204, 21, 0.2);
                    border: 1px solid rgba(250, 204, 21, 0.4);
                    color: #facc15;
                }

                .btn-pause:hover {
                    background: rgba(250, 204, 21, 0.3);
                }

                .btn-save {
                    background: rgba(197, 160, 89, 0.2);
                    border: 1px solid rgba(197, 160, 89, 0.4);
                    color: #c5a059;
                }

                .btn-save:hover {
                    background: rgba(197, 160, 89, 0.3);
                }
            `}</style>
        </div>
    );
}
