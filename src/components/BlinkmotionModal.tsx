"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Terminal, ShieldCheck, Lock, User, Wifi } from "lucide-react";

interface BlinkmotionModalProps {
    characterName: string;
    storedUsername?: string;
    storedPassword?: string;
    onClose: () => void;
}

const TERMINAL_LINES = [
    "CONNECTING TO BLINKMOTION SECURE SERVER...",
    "ESTABLISHING SECURE CONNECTION...",
    "BYPASSING LOCAL FIREWALL [DONE]",
    "HANDSHAKE: 0x4f22e88a [SUCCESS]",
    "TRACING IP: 187.42.112.9... [ENCRYPTED]",
    "PROXY: 45.12.8.21 -> 122.34.1.99 -> HIDDEN",
    "ACCESSING REMOTE KERNEL...",
    "LOADING SYNK_BLINK_M0TI0N_V4.2...",
    "DECRYPTING DATA PACKETS...",
    "RE-ROUTING THROUGH OMEGA-9 NODE...",
    "AUTHENTICATING BIOMETRICS... [BYPASSED]",
    "SECURE CHANNEL ESTABLISHED.",
    "SYNCING WITH MASTER DATABASE...",
    "FINALIZING ENCRYPTION PROTOCOL...",
];

export function BlinkmotionModal({ characterName, storedUsername, storedPassword, onClose }: BlinkmotionModalProps) {
    const [step, setStep] = useState<"login" | "terminal" | "success">("login");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [terminalLines, setTerminalLines] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);
    const terminalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (step === "terminal") {
            let currentLine = 0;
            const interval = setInterval(() => {
                if (currentLine < TERMINAL_LINES.length) {
                    setTerminalLines(prev => [...prev, TERMINAL_LINES[currentLine]]);
                    currentLine++;
                    if (terminalRef.current) {
                        terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
                    }
                } else {
                    clearInterval(interval);
                    setTimeout(() => setStep("success"), 1000);
                }
            }, 150);
            return () => clearInterval(interval);
        }
    }, [step]);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === storedUsername && password === storedPassword) {
            setStep("terminal");
            setError("");
        } else {
            setError("ACESSO NEGADO: CREDENCIAIS INVÁLIDAS");
            // Add a little shake effect or sound if possible
        }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="blink-overlay" onClick={onClose}>
            <div className="blink-container" onClick={e => e.stopPropagation()}>
                <div className="blink-header">
                    <div className="header-left">
                        <Terminal size={14} className="blink-icon" />
                        <span className="blink-title">BLINKMOTION SECURE ACCESS // {characterName.toUpperCase()}</span>
                    </div>
                    <button onClick={onClose} className="blink-close">
                        <X size={18} />
                    </button>
                </div>

                <div className="blink-body">
                    {step === "login" && (
                        <form onSubmit={handleLogin} className="login-view">
                            <div className="security-banner">
                                <Lock size={40} className="lock-icon" />
                                <h2>ÁREA RESTRITA</h2>
                                <p>SISTEMA DE CRIPTOGRAFIA BLINKMOTION</p>
                            </div>

                            <div className="input-group">
                                <div className="input-row">
                                    <User size={16} />
                                    <input
                                        autoFocus
                                        placeholder="USUÁRIO"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        className="blink-input"
                                    />
                                </div>
                                <div className="input-row">
                                    <ShieldCheck size={16} />
                                    <input
                                        type="password"
                                        placeholder="CHAVE DE ACESSO"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="blink-input"
                                    />
                                </div>
                            </div>

                            {error && <div className="error-msg">{error}</div>}

                            <button type="submit" className="login-btn">
                                INICIAR PROTOCOLO
                            </button>
                        </form>
                    )}

                    {step === "terminal" && (
                        <div className="terminal-view" ref={terminalRef}>
                            <div className="terminal-header">
                                <Wifi size={12} className="pulse" /> 
                                <span>STATUS: CONECTANDO...</span>
                            </div>
                            {terminalLines.map((line, i) => (
                                <div key={i} className="terminal-line">
                                    <span className="cursor-prefix">{">"}</span> {line}
                                </div>
                            ))}
                            <div className="terminal-line active-cursor">
                                <span className="cursor-prefix">{">"}</span>
                                <span className="blinking-cursor">_</span>
                            </div>
                        </div>
                    )}

                    {step === "success" && (
                        <div className="success-view">
                            <div className="success-circle">
                                <ShieldCheck size={60} />
                            </div>
                            <h2 className="glitch" data-text="CRIPTOGRAFADO COM SUCESSO">CRIPTOGRAFADO COM SUCESSO</h2>
                            <p>O CANAL ESTÁ SEGURO. A SESSÃO FOI OCULTADA.</p>
                            <div className="success-footer">
                                <div className="security-code">ID-HASH: {Math.random().toString(36).substring(2, 10).toUpperCase()}</div>
                                <button onClick={onClose} className="close-btn-final">FECHAR TERMINAL</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .blink-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 5, 10, 0.95);
                    backdrop-filter: blur(20px);
                    display: grid;
                    place-items: center;
                    z-index: 999999;
                    font-family: 'Courier New', Courier, monospace;
                }

                .blink-container {
                    width: 100%;
                    max-width: 600px;
                    height: 400px;
                    background: #000;
                    border: 1px solid #0ff;
                    box-shadow: 0 0 30px rgba(0, 255, 255, 0.2);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    position: relative;
                }

                .blink-container::before {
                    content: "";
                    position: absolute;
                    inset: 0;
                    background: repeating-linear-gradient(
                        0deg,
                        transparent,
                        transparent 2px,
                        rgba(0, 255, 255, 0.05) 3px
                    );
                    pointer-events: none;
                    z-index: 10;
                }

                .blink-header {
                    background: #0ff;
                    color: #000;
                    padding: 8px 15px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .blink-title {
                    font-size: 0.7rem;
                    font-weight: bold;
                    letter-spacing: 1px;
                }

                .blink-close {
                    background: transparent;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    color: inherit;
                }

                .blink-body {
                    flex: 1;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                }

                /* LOGIN VIEW */
                .login-view {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 30px;
                    margin-top: 20px;
                }

                .security-banner {
                    text-align: center;
                }

                .lock-icon {
                    color: #0ff;
                    margin-bottom: 15px;
                    filter: drop-shadow(0 0 10px rgba(0, 255, 255, 0.5));
                }

                .security-banner h2 {
                    color: #0ff;
                    font-size: 1.2rem;
                    margin: 0;
                    letter-spacing: 4px;
                }

                .security-banner p {
                    color: rgba(0, 255, 255, 0.5);
                    font-size: 0.65rem;
                    margin: 5px 0 0;
                }

                .input-group {
                    width: 100%;
                    max-width: 300px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }

                .input-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    border-bottom: 1px solid rgba(0, 255, 255, 0.3);
                    padding: 5px 0;
                    color: #0ff;
                }

                .blink-input {
                    background: transparent;
                    border: none;
                    color: #0ff;
                    width: 100%;
                    outline: none;
                    font-family: inherit;
                    font-size: 0.9rem;
                }

                .blink-input::placeholder {
                    color: rgba(0, 255, 255, 0.2);
                }

                .error-msg {
                    color: #f44;
                    font-size: 0.7rem;
                    text-align: center;
                }

                .login-btn {
                    background: transparent;
                    border: 1px solid #0ff;
                    color: #0ff;
                    padding: 10px 30px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 0.8rem;
                    transition: all 0.3s;
                }

                .login-btn:hover {
                    background: rgba(0, 255, 255, 0.1);
                    box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
                }

                /* TERMINAL VIEW */
                .terminal-view {
                    flex: 1;
                    overflow-y: auto;
                    color: #0f0;
                    font-size: 0.8rem;
                    padding: 10px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .terminal-header {
                    color: #0ff;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.7rem;
                }

                .terminal-line {
                    word-break: break-all;
                }

                .cursor-prefix {
                    color: #0ff;
                    margin-right: 8px;
                }

                .blinking-cursor {
                    animation: blink 1s step-end infinite;
                }

                @keyframes blink {
                    50% { opacity: 0; }
                }

                .pulse {
                    animation: pulse 1.5s ease-in-out infinite;
                }

                @keyframes pulse {
                    0% { opacity: 0.4; }
                    50% { opacity: 1; }
                    100% { opacity: 0.4; }
                }

                /* SUCCESS VIEW */
                .success-view {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    flex: 1;
                    gap: 20px;
                    text-align: center;
                }

                .success-circle {
                    width: 100px;
                    height: 100px;
                    border: 2px solid #0f0;
                    border-radius: 50%;
                    display: grid;
                    place-items: center;
                    color: #0f0;
                    box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
                }

                .success-view h2 {
                    color: #0f0;
                    font-size: 1.1rem;
                    margin: 0;
                    letter-spacing: 2px;
                }

                .success-view p {
                    color: rgba(0, 255, 0, 0.7);
                    font-size: 0.75rem;
                    max-width: 300px;
                }

                .success-footer {
                    margin-top: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }

                .security-code {
                    font-size: 0.6rem;
                    color: rgba(0, 255, 0, 0.4);
                }

                .close-btn-final {
                    background: #0f0;
                    color: #000;
                    border: none;
                    padding: 8px 20px;
                    font-family: inherit;
                    font-size: 0.75rem;
                    cursor: pointer;
                    font-weight: bold;
                }

                /* GLITCH EFFECT */
                .glitch {
                    position: relative;
                }

                .glitch::before, .glitch::after {
                    content: attr(data-text);
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                }

                .glitch::before {
                    left: 2px;
                    text-shadow: -2px 0 #ff00c1;
                    clip: rect(44px, 450px, 56px, 0);
                    animation: glitch-anim 5s infinite linear alternate-reverse;
                }

                .glitch::after {
                    left: -2px;
                    text-shadow: -2px 0 #00fff9, 2px 2px #ff00c1;
                    animation: glitch-anim2 1s infinite linear alternate-reverse;
                }

                @keyframes glitch-anim {
                    0% { clip: rect(31px, 9999px, 94px, 0); }
                    20% { clip: rect(62px, 9999px, 42px, 0); }
                    40% { clip: rect(16px, 9999px, 78px, 0); }
                    60% { clip: rect(58px, 9999px, 22px, 0); }
                    80% { clip: rect(93px, 9999px, 86px, 0); }
                    100% { clip: rect(4px, 9999px, 63px, 0); }
                }

                @keyframes glitch-anim2 {
                    0% { clip: rect(65px, 9999px, 100px, 0); }
                    20% { clip: rect(31px, 9999px, 18px, 0); }
                    40% { clip: rect(11px, 9999px, 81px, 0); }
                    60% { clip: rect(84px, 9999px, 49px, 0); }
                    80% { clip: rect(19px, 9999px, 33px, 0); }
                    100% { clip: rect(54px, 9999px, 92px, 0); }
                }
            `}</style>
        </div>,
        document.body
    );
}
