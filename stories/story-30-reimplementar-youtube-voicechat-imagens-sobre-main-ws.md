---
story: story-30
title: "Reimplementar YouTube no MusicPlayer + Imagem/Dispositivos no VoiceChatPanel (sobre main WebSocket)"
status: pronto-para-implementar
priority: alta
tags: [ui, voicechat, music, webrtc, feature]
created: 2026-04-06
---

# Story-30: Reimplementar YouTube + VoiceChat Melhorado (sobre main com WebSocket)

## Contexto

A branch `4.0_freature_youtubesound` foi descartada. O amigo fez um PR (#11) que migrou
a sinalização WebRTC de Supabase para WebSocket (socket.io). A main está atualizada com
essa arquitetura nova.

Esta story reimplementa **duas features** que existiam na branch descartada, aplicando-as
diretamente na main sem conflitos. Nenhum arquivo de sinalização (screen-share-manager,
VoiceChatManager, eventStore) é tocado.

---

## Arquivos modificados

| Arquivo | Feature | O que muda |
|---|---|---|
| `package.json` | YouTube | Adicionar `react-player` |
| `src/components/MusicPlayer.tsx` | YouTube | Suporte a URL do YouTube via ReactPlayer |
| `src/components/VoiceChatPanel.tsx` | VoiceChat | Avatar de personagem + seleção de dispositivo de áudio |

**Nenhum outro arquivo é alterado.**

---

## Feature 1 — YouTube no MusicPlayer

### Visão Geral

O Mestre (GM) pode colar uma URL do YouTube no MusicPlayer e ela toca para todos os
jogadores sincronizados, exatamente como uma faixa de áudio normal do Supabase Storage.
A URL é transmitida via Event Sourcing (mesmo mecanismo de qualquer outra faixa).

### Passo 1 — Instalar dependência

No `package.json`, dentro de `"dependencies"`, adicionar:

```json
"react-player": "^3.4.0"
```

Depois rodar `npm install`.

### Passo 2 — Imports no MusicPlayer

**Arquivo**: `src/components/MusicPlayer.tsx`

Localizar o bloco de imports atual (topo do arquivo):
```ts
import { useEffect, useRef, useState, useCallback } from "react";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Play, Pause, Repeat, Volume2, VolumeX, SkipBack, SkipForward, ListMusic, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
```

Substituir por:
```ts
import { useEffect, useRef, useState, useCallback } from "react";
import ReactPlayer from "react-player";
import { globalEventStore } from "@/lib/eventStore";
import { v4 as uuidv4 } from "uuid";
import { Play, Pause, Repeat, Volume2, VolumeX, SkipBack, SkipForward, ListMusic, RefreshCw, Link } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
```

Dois acréscimos: `import ReactPlayer from "react-player"` e o ícone `Link` no lucide.

### Passo 3 — Helper de detecção de URL YouTube

Logo após os imports e antes da interface `MusicPlayerProps`, adicionar:

```ts
const isYouTubeUrl = (url: string) =>
    /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
```

### Passo 4 — Novos refs e estado dentro do componente

Dentro de `export function MusicPlayer(...)`, logo após a declaração do `audioRef`:

```ts
const audioRef = useRef<HTMLAudioElement | null>(null);
// Adicionar abaixo:
const reactPlayerRef = useRef<any>(null);
const pendingSeekRef = useRef<number | null>(null);  // seek pendente até ReactPlayer estar pronto
const isTemporaryRef = useRef(false);
const restoreUrlRef = useRef("");
const restoreLoopRef = useRef(true);
```

E junto aos outros `useState`, adicionar:
```ts
const [youtubeInputUrl, setYoutubeInputUrl] = useState("");
```

### Passo 5 — Ref espelho de `isPlaying` (evita stale closure em callbacks)

Após os `useState` existentes, adicionar:

```ts
const isPlayingRef = useRef(isPlaying);
useEffect(() => {
    isPlayingRef.current = isPlaying;
}, [isPlaying]);
```

### Passo 6 — Modificar o subscriber de eventos para tratar YouTube

Dentro do `useEffect` que processa eventos do `globalEventStore`, localizar o bloco onde
`setCurrentTrack(url)`, `setIsPlaying(playing)` e a lógica do `audioRef` são usados.

O bloco atual trata apenas `audioRef`. Ele precisa ser expandido para bifurcar entre
YouTube e áudio normal. A lógica é:

**Se `isYouTubeUrl(url)` → controlar via ReactPlayer (apenas sincronizar seek)**:
```ts
if (isYouTubeUrl(url)) {
    setCurrentTrack(url);
    setIsPlaying(playing);
    setIsLooping(loop);
    // Sincronizar seek se player estiver montado
    if (playing && event.payload.startedAt) {
        const elapsed = (Date.now() - new Date(event.payload.startedAt).getTime()) / 1000;
        if (reactPlayerRef.current) {
            const internalPlayer = reactPlayerRef.current.getInternalPlayer();
            if (internalPlayer?.seekTo) {
                internalPlayer.seekTo(elapsed, 'seconds');
            }
        } else {
            pendingSeekRef.current = elapsed;
        }
    }
    isTemporaryRef.current = !!event.payload.isTemporary;
    restoreUrlRef.current = event.payload.restoreUrl || "";
    restoreLoopRef.current = event.payload.restoreLoop ?? true;
    return;
}
```

**Se URL normal → manter lógica existente do `audioRef`** (não alterar).

Também armazenar os flags de "isTemporary" nos refs ao final do bloco de áudio normal:
```ts
isTemporaryRef.current = !!event.payload.isTemporary;
restoreUrlRef.current = event.payload.restoreUrl || "";
restoreLoopRef.current = event.payload.restoreLoop ?? true;
```

### Passo 7 — Modificar `handleTrackEnded` para unificar YouTube e áudio

Localizar a função `handleTrackEnded` (ou equivalente que trata o fim da faixa).
Ela deve usar os `refs` em vez de estado direto:

```ts
const handleTrackEnded = () => {
    if (isLooping) {
        // YouTube: loop prop cuida disso nativamente
        // Áudio normal: reset manual de segurança
        if (!isYouTubeUrl(currentTrack) && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(console.warn);
        }
        return;
    }
    if (isTemporaryRef.current && restoreUrlRef.current && userRole === "GM") {
        broadcastUpdate(restoreUrlRef.current, true, restoreLoopRef.current);
        isTemporaryRef.current = false;
        return;
    }
    if (userRole === "GM") {
        playNext();
    }
};
```

### Passo 8 — Callback `handleYouTubeReady`

Adicionar função que aplica seek pendente quando o ReactPlayer termina de carregar:

```ts
const handleYouTubeReady = () => {
    if (pendingSeekRef.current !== null && reactPlayerRef.current) {
        reactPlayerRef.current.seekTo(pendingSeekRef.current, 'seconds');
        pendingSeekRef.current = null;
    }
};
```

### Passo 9 — Input de URL YouTube na UI

No JSX do MusicPlayer, existe uma linha de controles com `<select>` de faixa e botões.
Adicionar um bloco de input **abaixo** do select de faixa existente:

```tsx
const youtubeInputRow = (
    <div className="control-row">
        <input
            type="text"
            placeholder="URL do YouTube..."
            value={youtubeInputUrl}
            onChange={(e) => setYoutubeInputUrl(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === "Enter" && isYouTubeUrl(youtubeInputUrl.trim())) {
                    handleTrackChange(youtubeInputUrl.trim());
                    setYoutubeInputUrl("");
                }
            }}
            className="track-select youtube-url-input"
        />
        <button
            className="control-btn"
            onClick={() => {
                if (isYouTubeUrl(youtubeInputUrl.trim())) {
                    handleTrackChange(youtubeInputUrl.trim());
                    setYoutubeInputUrl("");
                }
            }}
            disabled={!isYouTubeUrl(youtubeInputUrl.trim())}
            title="Tocar Link do YouTube"
        >
            <Link size={12} />
        </button>
    </div>
);
```

Renderizar `{youtubeInputRow}` logo abaixo do `<select>` de faixa existente.
No modo `unifiedMode` também renderizar `{youtubeInputRow}` no mesmo ponto correspondente.

### Passo 10 — ReactPlayer no JSX (oculto — apenas áudio)

No final do JSX, após o `<audio ref={audioRef} />`, adicionar:

```tsx
{/* ReactPlayer: apenas para URLs YouTube — display:none suprime vídeo/thumbnail */}
{isYouTubeUrl(currentTrack) && (
    <div style={{ display: "none" }}>
        <ReactPlayer
            ref={reactPlayerRef}
            url={currentTrack}
            playing={isPlaying}
            loop={isLooping}
            volume={isMuted ? 0 : volume}
            muted={isMuted}
            onEnded={handleTrackEnded}
            onReady={handleYouTubeReady}
        />
    </div>
)}
```

### Passo 11 — Exibir "YouTube ▶" no indicador de faixa

Localizar onde o nome da faixa atual é exibido (geralmente um `<span>` com `currentTrack`).
Modificar para mostrar texto especial quando for YouTube:

```tsx
{isPlaying
    ? (isYouTubeUrl(currentTrack)
        ? "YouTube ▶"
        : (currentTrack.split('/').pop()?.replace(/\.(mp3|wav|ogg)$/i, '') || "Reproduzindo..."))
    : "Pausado"}
```

### Passo 12 — CSS do input YouTube

Nos estilos inline ou `<style jsx>` existentes no componente, adicionar:

```css
.youtube-url-input {
    background-image: none;
    padding: 6px 8px;
    flex: 1;
    min-width: 0;
}

.youtube-url-input::placeholder {
    color: rgba(197, 160, 89, 0.4);
    font-style: italic;
}
```

---

## Feature 2 — Avatar de Personagem + Seleção de Dispositivo no VoiceChatPanel

### Visão Geral

Dois grupos de melhorias no painel de voz:
1. **Avatar**: o ícone circular de cada participante exibe a foto do personagem (se houver) em vez de emoji
2. **Dispositivos de áudio**: seletores de microfone (entrada) e fone (saída) persistidos em localStorage

Ambas as funcionalidades já existem no `VoiceChatManager` — são apenas adições de UI no painel.

### O que o amigo JÁ tem na main (não reimplementar)

O `VoiceChatPanel.tsx` na main **já tem**:
- `characterId` como prop
- `state.characters` computado via `computeState`
- `getDisplayName` e `getCharacterImage` helpers (verificar se estão presentes; se não, implementar conforme Passo A)
- A estrutura base do painel com lista de peers

Leia o arquivo completo antes de começar para confirmar o que já existe.

### Passo A — Verificar/adicionar helpers `getDisplayName` e `getCharacterImage`

**Estes helpers lêem `state.characters` (do Event Sourcing) e resolvem nome e foto do personagem.**

Se já existirem, pular. Se não existirem, adicionar após a computação de `state`:

```ts
const getDisplayName = useCallback((uid: string, charId?: string) => {
    const uidLower = uid.trim().toLowerCase();
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'PLAYER';

    // Mestre não tem personagem
    if (uidLower.includes('mestre') || uidLower === 'gm' || uidLower === 'narrador') return uid;
    if (storedRole === 'GM' && uid === userId) return uid;

    const allChars = Object.values(state.characters);

    if (charId) {
        const byId = allChars.find(c => c.id === charId);
        if (byId) return byId.name;
    }

    const matchedChar = allChars.find(c => {
        const ownerMatch = (c.ownerUserId || "").trim().toLowerCase() === uidLower;
        const nameMatch = (c.name || "").trim().toLowerCase() === uidLower;
        const idMatch = c.id.toLowerCase() === uidLower;
        return (ownerMatch || nameMatch || idMatch);
    });

    return matchedChar ? matchedChar.name : uid;
}, [state.characters, userId]);

const getCharacterImage = useCallback((uid: string, charId?: string): string | null => {
    const uidLower = uid.trim().toLowerCase();
    const storedRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : 'PLAYER';

    // Mestre não tem avatar de personagem
    if (uidLower.includes('mestre') || uidLower === 'gm' || uidLower === 'narrador') return null;
    if (storedRole === 'GM' && uid === userId) return null;

    const allChars = Object.values(state.characters);

    if (charId) {
        const byId = allChars.find(c => c.id === charId && c.imageUrl);
        if (byId) return byId.imageUrl;
    }

    const matchedChar = allChars.find(c => {
        const ownerMatch = (c.ownerUserId || "").trim().toLowerCase() === uidLower;
        const nameMatch = (c.name || "").trim().toLowerCase() === uidLower;
        const idMatch = c.id.toLowerCase() === uidLower;
        return (ownerMatch || nameMatch || idMatch) && c.imageUrl;
    });

    return matchedChar?.imageUrl || null;
}, [state.characters, userId]);
```

> `state.characters` vem do `computeState` já presente na main.
> `imageUrl` é o campo da entidade `Character` no Event Sourcing.

### Passo B — Adicionar estados de dispositivos de áudio

Junto aos outros `useState` do componente, adicionar:

```ts
const [audioInputDeviceId, setAudioInputDeviceId] = useState<string>('');
const [audioOutputDeviceId, setAudioOutputDeviceId] = useState<string>('');
const [inputDevices, setInputDevices] = useState<MediaDeviceInfo[]>([]);
const [outputDevices, setOutputDevices] = useState<MediaDeviceInfo[]>([]);
const [devicesLoaded, setDevicesLoaded] = useState(false);
const supportsSinkId = typeof (new Audio() as any).setSinkId === 'function';
```

### Passo C — Restaurar dispositivos salvos no mount

```ts
useEffect(() => {
    const savedInput = localStorage.getItem('voice_input_device');
    const savedOutput = localStorage.getItem('voice_output_device');
    if (savedInput) setAudioInputDeviceId(savedInput);
    if (savedOutput) setAudioOutputDeviceId(savedOutput);
}, []);
```

### Passo D — Carregar lista de dispositivos quando conectado

```ts
const loadDevices = useCallback(async () => {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setInputDevices(devices.filter(d => d.kind === 'audioinput' && d.deviceId));
        setOutputDevices(devices.filter(d => d.kind === 'audiooutput' && d.deviceId));
        setDevicesLoaded(true);
    } catch (e) {
        console.warn('[VoiceChatPanel] Error enumerating devices', e);
    }
}, []);

useEffect(() => {
    if (isConnected) {
        loadDevices();
        navigator.mediaDevices.addEventListener('devicechange', loadDevices);
        return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices);
    }
}, [isConnected, loadDevices]);
```

### Passo E — Handlers de troca de dispositivo

```ts
const handleInputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setAudioInputDeviceId(deviceId);
    localStorage.setItem('voice_input_device', deviceId);
    if (managerRef.current && isConnected) {
        await managerRef.current.setMicDevice(deviceId);
    }
}, [isConnected]);

const handleOutputDeviceChange = useCallback(async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deviceId = e.target.value;
    setAudioOutputDeviceId(deviceId);
    localStorage.setItem('voice_output_device', deviceId);
    if (managerRef.current) {
        await managerRef.current.setOutputDevice(deviceId);
    }
}, []);
```

### Passo F — Passar dispositivo salvo ao entrar no voice

Localizar onde `mgr.joinVoice(...)` é chamado (no useEffect de inicialização do manager).
Garantir que passa o dispositivo salvo:

```ts
const savedInput = localStorage.getItem('voice_input_device') || undefined;
const ok = await mgr.joinVoice(savedInput);

// Após joinVoice, restaurar output device também:
const savedOutput = localStorage.getItem('voice_output_device');
if (savedOutput) {
    mgr.setOutputDevice(savedOutput).catch(console.warn);
}
```

### Passo G — Avatar circular com foto do personagem na lista expandida

Na lista de participantes do painel expandido (`allUsers.map(user => {...})`),
localizar o bloco do ícone/avatar de cada usuário.

**Antes** (provavelmente só emoji):
```tsx
<div style={{ width: '42px', height: '42px', borderRadius: '50%', ... }}>
    {user.inVoice ? (user.muted ? '🔇' : (user.speaking ? '🔊' : '🎤')) : '👤'}
</div>
```

**Depois** (com imagem de personagem):
```tsx
const charImg = getCharacterImage(user.id, user.characterId);
const displayName = getDisplayName(user.id, user.characterId);

<div style={{
    position: 'relative',
    flexShrink: 0
}}>
    <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        border: `2px solid ${user.inVoice
            ? (user.speaking ? '#50c878' : 'rgba(80,200,120,0.3)')
            : 'rgba(255,255,255,0.08)'}`,
        boxShadow: user.speaking
            ? '0 0 10px rgba(80,200,120,0.6), 0 0 20px rgba(80,200,120,0.3)'
            : 'none',
        background: charImg
            ? 'transparent'
            : (user.inVoice
                ? (user.speaking ? 'rgba(80,200,120,0.35)' : 'rgba(80,200,120,0.08)')
                : 'rgba(255,255,255,0.04)'),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.1rem',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
    }}>
        {charImg
            ? <img src={charImg} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (!user.inVoice ? '👤' : (user.muted ? '🔇' : (user.speaking ? '🔊' : '🎤')))
        }
    </div>
    {/* Badge de mudo sobre avatar quando há imagem */}
    {charImg && user.inVoice && user.muted && (
        <div style={{
            position: 'absolute', bottom: '-2px', right: '-2px',
            width: '16px', height: '16px',
            background: '#ff4d4d', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.55rem', border: '1px solid #111', zIndex: 2,
        }}>🔇</div>
    )}
</div>
```

Usar `displayName` no lugar de `user.id` para exibir nome do personagem:
```tsx
<span>{displayName}{user.isMe && <span style={{ color: 'var(--accent-color)', fontSize: '0.55rem', marginLeft: '4px' }}>EU</span>}</span>
```

### Passo H — Avatar com foto na visualização compacta (mini-avatares)

Na visualização compacta/collapsed do painel (onde aparecem os mini-avatares dos peers),
localizar o bloco que renderiza cada participante com inicial de letra.

**Antes**:
```tsx
<div style={{ ... }}>
    {initial}
</div>
```

**Depois**:
```tsx
const charImg = getCharacterImage(user.id, user.characterId);
const initial = getDisplayName(user.id, user.characterId).charAt(0).toUpperCase();

<div style={{
    overflow: 'hidden',
    background: charImg ? 'transparent' : /* cor existente */,
    // manter demais estilos existentes
}}>
    {charImg
        ? <img src={charImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initial
    }
</div>
```

### Passo I — Seletores de dispositivo na UI do painel expandido

No painel expandido (`isOpen === true`), após o botão de conectar/desconectar,
adicionar os seletores de dispositivo quando `isConnected && devicesLoaded`:

```tsx
{isConnected && devicesLoaded && (
    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)' }}>
                MIC (ENTRADA)
            </label>
            <select
                value={audioInputDeviceId}
                onChange={handleInputDeviceChange}
                style={{
                    background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff', padding: '4px 6px', fontSize: '0.7rem',
                    borderRadius: '4px', outline: 'none', cursor: 'pointer', width: '100%',
                }}
            >
                <option value="" style={{ background: '#1a1a1a' }}>Padrão do Sistema</option>
                {inputDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId} style={{ background: '#1a1a1a' }}>
                        {d.label || 'Microfone'}
                    </option>
                ))}
            </select>
        </div>

        {supportsSinkId ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-header)' }}>
                    FONE (SAÍDA)
                </label>
                <select
                    value={audioOutputDeviceId}
                    onChange={handleOutputDeviceChange}
                    style={{
                        background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff', padding: '4px 6px', fontSize: '0.7rem',
                        borderRadius: '4px', outline: 'none', cursor: 'pointer', width: '100%',
                    }}
                >
                    <option value="" style={{ background: '#1a1a1a' }}>Padrão do Sistema</option>
                    {outputDevices.map(d => (
                        <option key={d.deviceId} value={d.deviceId} style={{ background: '#1a1a1a' }}>
                            {d.label || 'Alto-falante'}
                        </option>
                    ))}
                </select>
            </div>
        ) : (
            <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', opacity: 0.6 }}>
                SAÍDA: não suportado neste browser
            </div>
        )}
    </div>
)}
```

---

## Critérios de Aceitação

### YouTube
- [ ] GM cola URL `youtube.com` ou `youtu.be` no input e pressiona Enter ou clica no botão Link
- [ ] A URL toca para todos os players sincronizados (via Event Sourcing)
- [ ] Jogadores que entram depois sincronizam o seek automaticamente
- [ ] Faixas normais do Supabase continuam funcionando sem regressão
- [ ] O indicador de faixa exibe "YouTube ▶" quando uma URL YouTube está ativa
- [ ] Não aparece thumbnail/vídeo visível na tela (ReactPlayer em `display:none`)

### VoiceChat — Avatar
- [ ] Participante com personagem cadastrado exibe foto no ícone circular
- [ ] Badge 🔇 aparece sobre a foto quando o peer está mutado
- [ ] Participante sem personagem (ex: Mestre) continua exibindo emoji
- [ ] Mini-avatares na view compacta também exibem foto quando disponível

### VoiceChat — Dispositivos
- [ ] Dropdown de mic lista todos os dispositivos de entrada disponíveis
- [ ] Dropdown de fone lista todos os dispositivos de saída (quando browser suporta setSinkId)
- [ ] Seleção persiste após reload (via localStorage)
- [ ] Trocar mic enquanto conectado muda o stream ao vivo sem desconectar
- [ ] Em browsers que não suportam setSinkId (Firefox), exibe mensagem "não suportado"

---

## O que NÃO alterar

- `src/lib/VoiceChatManager.ts` — não tocar
- `src/lib/screen-share-manager.ts` — não tocar
- `src/lib/eventStore.ts` — não tocar
- `src/lib/socketClient.ts` — não tocar
- Qualquer outro arquivo fora dos 3 listados em "Arquivos modificados"
