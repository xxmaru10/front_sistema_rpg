"use client";
// Atualização simples para trigger de deploy - 17/02/2026

import { useRouter } from "next/navigation";
import NextImage from "next/image";
import { useState, useEffect } from "react";
import { Plus, Users, ChevronRight, Play, Shield } from "lucide-react";
import { CreateSessionCard } from "@/components/home/CreateSessionCard";
import { JoinSessionCard } from "@/components/home/JoinSessionCard";
import { CharacterSelection } from "@/components/home/CharacterSelection";
import { v4 as uuidv4 } from "uuid";
import { globalEventStore } from "@/lib/eventStore";
import * as apiClient from "@/lib/apiClient";

interface SessionData {
  id: string;
  name: string;
  gmUserId: string;
}

export default function Home() {
  const router = useRouter();

  // Estados de Criação
  const [userName, setUserName] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [customGmCode, setCustomGmCode] = useState(""); // Novo estado para código do mestre
  const [customPlayerCode, setCustomPlayerCode] = useState(""); // Novo estado para código de jogador
  const [selectedSystem, setSelectedSystem] = useState("fate");

  // Estados de Entrada
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);
  const [joinRole, setJoinRole] = useState<'PLAYER' | 'GM'>('PLAYER'); // Papel escolhido
  const [accessCodeInput, setAccessCodeInput] = useState(""); // Código digitado (GM ou Player)
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Estados de Fluxo
  const [step, setStep] = useState<'HOME' | 'JOIN_CHARACTER'>('HOME');
  const [availableCharacters, setAvailableCharacters] = useState<any[]>([]);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [homeError, setHomeError] = useState<string | null>(null);

  // Buscar sessões ao carregar
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    console.log('[Home] Buscando sessões...');

    try {
      const data = await apiClient.fetchSessions();
      console.log('[Home] Sessões encontradas:', data.length);
      setSessions(data);
    } catch (err: any) {
      console.error('[Home] Erro ao buscar sessões:', err.message || err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleCreateSession = async () => {
    setHomeError(null);
    if (!userName.trim() || !sessionName.trim()) {
      setHomeError("Por favor, preencha o seu nome e o nome da sessão.");
      return;
    }

    setIsActionLoading(true);

    const sessionId = uuidv4().slice(0, 8); // ID curto
    // Define os códigos: customizados ou padrão
    const finalGmCode = customGmCode.trim() || `${sessionId}-GM`;
    const finalPlayerCode = customPlayerCode.trim() || sessionId;

    try {
      await apiClient.createSession({
        id: sessionId,
        name: sessionName.trim(),
        gmUserId: userName.trim(),
        system: selectedSystem,
      });
    } catch {
      setHomeError("Erro ao criar sessão no banco.");
      setIsActionLoading(false);
      return;
    }

    await globalEventStore.append({
      id: uuidv4(),
      sessionId: sessionId,
      seq: 0,
      type: "SESSION_CREATED",
      actorUserId: userName.trim(),
      visibility: "PUBLIC",
      createdAt: new Date().toISOString(),
      payload: {
        sessionId,
        name: sessionName.trim(),
        gmCode: finalGmCode, // Salva o código no evento
        playerCode: finalPlayerCode
      }
    });

    router.push(`/session/${sessionId}?u=${encodeURIComponent(userName.trim())}&r=GM`);
  };

  const handleJoinSession = async () => {
    setHomeError(null);
    if (!selectedSession || isActionLoading) return;

    setIsActionLoading(true);
    let joinInfo: apiClient.SessionJoinInfo;
    try {
      joinInfo = await apiClient.fetchSessionJoinInfo(selectedSession.id);
    } catch {
      setHomeError("Erro ao verificar dados da sessão.");
      setIsActionLoading(false);
      return;
    }

    const expectedGmCode = String(joinInfo.gmCode).toUpperCase();
    const expectedPlayerCode = String(joinInfo.playerCode).toUpperCase();
    const inputCode = accessCodeInput.trim().toUpperCase();

    if (joinRole === 'GM') {
      if (inputCode !== expectedGmCode) {
        setHomeError("Código de Mestre incorreto.");
        setIsActionLoading(false);
        return;
      }
      router.push(`/session/${selectedSession.id}?u=Mestre&r=GM`);

    } else {
      if (inputCode !== expectedPlayerCode) {
        setHomeError("Código da Mesa incorreto. Peça ao mestre o Código do Jogador.");
        setIsActionLoading(false);
        return;
      }

      const playableCharacters = joinInfo.characters;
      if (playableCharacters.length === 0) {
        setHomeError("Esta sala ainda não possui personagens jogáveis disponíveis.");
        setIsActionLoading(false);
        return;
      }

      setAvailableCharacters(playableCharacters);
      setStep('JOIN_CHARACTER');
      setIsActionLoading(false);
    }
  };

  const handleSelectCharacter = (char: any) => {
    if (!selectedSession || isActionLoading) return;
    setIsActionLoading(true);
    router.push(`/session/${selectedSession.id}?u=${encodeURIComponent(char.name)}&r=PLAYER&c=${char.id}`);
  };

  return (
    <div className="home-container">
      {/* Background Decorative Type */}
      <div className="bg-decor mystical-overlay"></div>

      <div className="hero-section">
        <div className="banner-container">
          <NextImage
            src="/banners/header-banner.png"
            alt="Cronos Vtt Banner"
            width={1200}
            height={300}
            className="header-banner"
            priority
          />
        </div>
        <h1 className="main-title glitch-text" data-text="CRONOS VTT">CRONOS VTT</h1>
      </div>

      {homeError && (
        <div className="home-error-banner" role="alert" aria-live="polite">
          {homeError}
        </div>
      )}

      {step === 'HOME' && (
        <div className="actions-grid">
          <CreateSessionCard
            userName={userName}
            setUserName={setUserName}
            sessionName={sessionName}
            setSessionName={setSessionName}
            customGmCode={customGmCode}
            setCustomGmCode={setCustomGmCode}
            customPlayerCode={customPlayerCode}
            setCustomPlayerCode={setCustomPlayerCode}
            selectedSystem={selectedSystem}
            setSelectedSystem={setSelectedSystem}
            onCreate={handleCreateSession}
            isLoading={isActionLoading}
          />

          <JoinSessionCard
            sessions={sessions}
            loadingSessions={loadingSessions}
            selectedSession={selectedSession}
            setSelectedSession={setSelectedSession}
            joinRole={joinRole}
            setJoinRole={setJoinRole}
            accessCodeInput={accessCodeInput}
            setAccessCodeInput={setAccessCodeInput}
            onJoin={handleJoinSession}
            isJoining={isActionLoading}
          />
        </div>
      )}

      {step === 'JOIN_CHARACTER' && (
        <CharacterSelection
          availableCharacters={availableCharacters}
          onSelectCharacter={handleSelectCharacter}
          onBack={() => setStep('HOME')}
          isLoading={isActionLoading}
        />
      )}

      <style jsx global>{`
        .home-container {
          padding-top: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          position: relative;
          min-height: 100vh;
          overflow-x: hidden;
          overflow-y: visible;
        }

        .mystic-select {
            width: 100%;
            background: #080808;
            border: 1px solid rgba(197, 160, 89, 0.2);
            color: var(--accent-color);
            padding: 12px;
            font-family: var(--font-header);
            margin-bottom: 16px;
            outline: none;
            cursor: pointer;
            color-scheme: dark;
        }
        
        .mystic-select option {
            background: #080808;
            color: var(--accent-color);
        }

        .session-select-shell {
            position: relative;
            margin-bottom: 16px;
            overflow: visible;
        }

        .mystic-select-trigger {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            text-align: left;
        }

        .mystic-select-trigger.open {
            border-color: var(--accent-color);
            box-shadow: 0 0 18px rgba(197, 160, 89, 0.12);
        }

        .session-select-chevron {
            flex-shrink: 0;
            transition: transform 0.2s ease;
        }

        .session-select-chevron.open {
            transform: rotate(180deg);
        }

        .session-select-dropdown {
            position: absolute;
            top: calc(100% + 6px);
            left: 0;
            right: 0;
            z-index: 40;
            display: flex;
            flex-direction: column;
            max-height: min(52vh, 320px);
            overflow-y: auto;
            background: #080808;
            border: 1px solid rgba(197, 160, 89, 0.32);
            box-shadow: 0 14px 32px rgba(0, 0, 0, 0.68);
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
        }

        .session-select-dropdown.up {
            top: auto;
            bottom: calc(100% + 6px);
        }

        .session-select-option {
            appearance: none;
            width: 100%;
            border: none;
            border-bottom: 1px solid rgba(197, 160, 89, 0.08);
            background: transparent;
            color: var(--accent-color);
            text-align: left;
            padding: 12px 14px;
            font-family: var(--font-header);
            font-size: 0.82rem;
            letter-spacing: 0.04em;
            cursor: pointer;
            transition: background 0.18s ease, color 0.18s ease;
        }

        .session-select-option:last-child {
            border-bottom: none;
        }

        .session-select-option:hover,
        .session-select-option.selected {
            background: rgba(197, 160, 89, 0.16);
            color: #f7dfae;
        }

        @media (max-width: 768px) {
            .session-select-dropdown {
                max-height: min(58vh, 360px);
            }
        }

        .role-selector {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
        }

        .role-option {
            flex: 1;
            cursor: pointer;
        }

        .role-option input { display: none; }

        .role-box {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
            border: 1px solid rgba(197, 160, 89, 0.2);
            background: rgba(197, 160, 89, 0.02);
            font-family: var(--font-header);
            font-size: 0.7rem;
            color: var(--text-secondary);
            transition: all 0.3s;
        }

        .role-option input:checked + .role-box {
            border-color: var(--accent-color);
            background: rgba(197, 160, 89, 0.1);
            color: var(--accent-color);
            box-shadow: 0 0 15px rgba(197, 160, 89, 0.1);
        }

        .gm-code-area {
            margin-bottom: 16px;
        }

        .animate-fade-in {
            animation: fadeIn 0.4s ease forwards;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .hero-section {
          text-align: center;
          z-index: 2;
          margin-top: -20px;
          margin-bottom: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .banner-container {
            margin-bottom: 20px;
            border: 5px solid var(--accent-color);
            box-shadow: 0 0 25px rgba(197, 160, 89, 0.6), inset 0 0 15px rgba(197, 160, 89, 0.3);
            background: rgba(0,0,0,0.5);
            display: inline-flex;
            max-width: 90vw; /* Garante margem lateral para vermos as bordas */
            box-sizing: border-box;
            position: relative;
        }

        .header-banner {
            max-width: 100%;
            height: auto;
            object-fit: contain;
            display: block; /* Remove espaço em branco inferior de imagens inline */
        }

        .main-title {
          font-family: var(--font-victorian);
          font-size: 4rem;
          color: var(--accent-color);
          text-shadow: 0 0 20px rgba(197, 160, 89, 0.4);
          margin: 0;
          letter-spacing: 0.1em;
          position: relative;
        }

        .subtitle {
          font-family: var(--font-header);
          font-size: 0.8rem;
          letter-spacing: 0.5em;
          color: var(--text-secondary);
          margin-top: 15px;
          opacity: 0.8;
        }

        .loading-text {
            color: var(--text-secondary);
            font-family: var(--font-header);
            font-size: 0.8rem;
            text-align: center;
            padding: 20px;
        }

        .home-error-banner {
            width: min(900px, 92vw);
            border: 1px solid rgba(255, 90, 90, 0.45);
            background: rgba(42, 6, 6, 0.86);
            color: #ffd0d0;
            font-family: var(--font-header);
            font-size: 0.78rem;
            letter-spacing: 0.08em;
            text-align: center;
            padding: 10px 14px;
            margin: 4px 0 8px;
            box-shadow: 0 0 14px rgba(255, 90, 90, 0.18);
        }
      `}</style>
    </div>
  );
}
