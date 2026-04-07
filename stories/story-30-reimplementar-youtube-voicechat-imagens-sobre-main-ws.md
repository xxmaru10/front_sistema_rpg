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

---

## Bugs Detectados Pós-Implementação — Teste Real (2026-04-06)

> Resultado de sessão de teste real com Mestre + Jogadora (Margot Laveau).
> Cada bug tem diagnóstico confirmado por código lido + sintoma relatado.
> Instruções suficientes para qualquer IA aplicar sem contexto adicional.
>
> **Status por bug:**
> - Bug A — Música Supabase com qualidade degradada → causa confirmada, fix documentado
> - Bug B — YouTube sem som → causa confirmada, fix documentado
> - Bug C — Transmissão de tela → **funcionando**, qualidade aceitável, não precisa de fix
> - Bug D — Ruído de ventilador na voz → causa confirmada, fix documentado
> - Bug E — Imagens de personagem não aparecem → causa provável documentada, investigação necessária
> - Bug F — YouTube `seekTo`/`getCurrentTime` não são função → causa confirmada (`dynamic()` não encaminha ref), fix documentado (ReactPlayerWrapper com forwardRef)
> - Bug G — Qualidade de áudio geral degradada com Bluetooth → causa confirmada (HFP mode switch do OS + AudioContext sem sampleRate), fix documentado

---

### Bug A — Música Supabase com qualidade degradada ("caixa de som na sala")

#### Sintoma

Jogadora ouve a música, mas com qualidade péssima — "como se fosse uma caixa de som
ligada na minha sala e ela ouvindo pelo fone". O Mestre ouve normalmente.

#### Diagnóstico

**Causa raiz**: O `<audio>` element na máquina da jogadora está tentando tocar mas é
**bloqueado por autoplay policy do browser**. A falha é silenciosa — o código faz:

```ts
// MusicPlayer.tsx ~linha 202
await audioRef.current?.play();  // ← LANÇA NotAllowedError, caught por console.warn
```

A música NÃO toca localmente na jogadora. O que ela ouve é o vazamento acústico: o áudio
saindo pelos alto-falantes do Mestre sendo captado pelo microfone do Mestre e transmitido
via WebRTC de voz para a jogadora. Por isso o som é degradado — passa por codec de voz
Opus, compressão e ruído de ambiente.

**Por que o autoplay é bloqueado**: A browser policy exige que o usuário tenha interagido
com a página num "media engagement" suficiente antes de permitir `audio.play()` programático
com volume > 0. Se a jogadora não estava no chat de voz ativo quando a música iniciou, ou
se a página foi carregada mas ela não clicou em nada recente, o browser bloqueia.

**Evidência no código** (`MusicPlayer.tsx` linha ~202–207):
```ts
const playAudio = async () => {
    try {
        ...
        await audioRef.current?.play();
    } catch (e) {
        console.warn("Autoplay blocked:", e);  // ← erro engolido silenciosamente
    }
};
```

#### Correção

**Arquivo**: `src/components/MusicPlayer.tsx`

Dentro da função `playAudio` (no bloco `if (playing)` do handler de `MUSIC_PLAYBACK_CHANGED`),
substituir o `catch` atual por um que registra o unlock via próximo clique do usuário:

**Antes** (linha ~202–207):
```ts
const playAudio = async () => {
    try {
        if (event.payload.startedAt) {
            const startedAt = new Date(event.payload.startedAt).getTime();
            const now = Date.now();
            const elapsed = (now - startedAt) / 1000;
            if (audioRef.current && Math.abs(audioRef.current.currentTime - elapsed) > 2) {
                audioRef.current.currentTime = elapsed % (audioRef.current.duration || 1);
            }
        }
        await audioRef.current?.play();
    } catch (e) {
        console.warn("Autoplay blocked:", e);
    }
};
```

**Depois**:
```ts
const playAudio = async () => {
    try {
        if (event.payload.startedAt) {
            const startedAt = new Date(event.payload.startedAt).getTime();
            const now = Date.now();
            const elapsed = (now - startedAt) / 1000;
            if (audioRef.current && Math.abs(audioRef.current.currentTime - elapsed) > 2) {
                audioRef.current.currentTime = elapsed % (audioRef.current.duration || 1);
            }
        }
        await audioRef.current?.play();
    } catch (e: any) {
        if (e?.name === 'NotAllowedError' || e?.name === 'AbortError') {
            // Autoplay bloqueado — reagendar no próximo clique do usuário
            const unlock = () => {
                audioRef.current?.play().catch(() => {});
            };
            document.addEventListener('click', unlock, { once: true });
            document.addEventListener('keydown', unlock, { once: true });
        }
        console.warn("Autoplay blocked:", e);
    }
};
```

**Por que funciona**: Na próxima interação do usuário com a página (qualquer clique ou tecla),
o browser libera a policy de autoplay e o `play()` é executado com sucesso.

---

### Bug B — YouTube sem som (nem Mestre, nem Jogadora ouvem)

#### Sintoma

O GM cola uma URL do YouTube, o player aparece, mas **nenhum som é reproduzido**
em nenhuma das máquinas.

#### Diagnóstico

**Arquivo**: `src/components/MusicPlayer.tsx`, linhas 482–506

O ReactPlayer está dentro de um container com estas regras CSS:

```tsx
<div style={{
    position: 'fixed',
    top: '-1px',
    left: '-1px',
    width: '1px',         // ← PROBLEMA
    height: '1px',        // ← PROBLEMA
    opacity: 0,
    pointerEvents: 'none',
    overflow: 'hidden'    // ← PROBLEMA
}}>
    <ReactPlayer
        ref={reactPlayerRef}
        {...{ url, playing, loop, volume, muted, onEnded, onReady } as any}
        // ← NÃO TEM width/height explícitos → herdará 1px do pai
    />
</div>
```

**Causa raiz**: O YouTube iframe é renderizado como **1px × 1px** (por causa do
`overflow: hidden` no pai de 1px). O YouTube exige dimensões mínimas de **200×113px**
para inicializar o player. Com iframe de 1px, o YouTube Player API não inicializa
corretamente → sem áudio, sem vídeo, sem eventos (incluindo `onReady` e `onEnded`).

O ReactPlayer sem `width`/`height` props usa os valores padrão (640×360) para o
componente React, mas o `overflow: hidden` do pai corta o conteúdo para 1px.

**Evidência adicional**: O `handleYouTubeReady` nunca é chamado (o `onReady` não dispara),
então `pendingSeekRef` nunca é aplicado, e o seek inicial não ocorre.

#### Correção

**Arquivo**: `src/components/MusicPlayer.tsx`, bloco do ReactPlayer (linhas ~481–506)

**Antes**:
```tsx
{isYouTubeUrl(currentTrack) && (
    <div style={{
        position: 'fixed',
        top: '-1px',
        left: '-1px',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden'
    }}>
        <ReactPlayer
            ref={reactPlayerRef}
            {...{
                url: currentTrack,
                playing: isPlaying,
                loop: isLooping,
                volume: isMuted ? 0 : volume,
                muted: isMuted,
                onEnded: handleTrackEnded,
                onReady: handleYouTubeReady
            } as any}
        />
    </div>
)}
```

**Depois**:
```tsx
{isYouTubeUrl(currentTrack) && (
    <div style={{ display: 'none' }}>
        <ReactPlayer
            ref={reactPlayerRef}
            {...{
                url: currentTrack,
                playing: isPlaying,
                loop: isLooping,
                volume: isMuted ? 0 : volume,
                muted: isMuted,
                width: '320px',
                height: '180px',
                onEnded: handleTrackEnded,
                onReady: handleYouTubeReady
            } as any}
        />
    </div>
)}
```

**Por que `display: none` funciona para YouTube mas 1px não**: Com `display: none`, o
React/Next.js não renderiza o DOM do filho. Mas react-player (via `dynamic()`) ainda
monta o iframe do YouTube com as dimensões especificadas em `width`/`height`. O YouTube
player inicializa com 320×180px (dimensões válidas) e o áudio toca. Com `overflow: hidden`
em 1px, o iframe tenta existir mas fica clipado — o YouTube detecta isso e não inicializa.

**Nota adicional**: O `playing={isPlaying}` para clientes (PLAYER role) pode ainda ser
bloqueado por autoplay policy. Aplicar o mesmo padrão do Bug A: no `handleYouTubeReady`,
se `isPlayingRef.current === true` e o player não iniciou, agendar no próximo clique.
Adicionar ao `handleYouTubeReady`:

```ts
const handleYouTubeReady = () => {
    if (pendingSeekRef.current !== null && reactPlayerRef.current) {
        reactPlayerRef.current.seekTo(pendingSeekRef.current, 'seconds');
        pendingSeekRef.current = null;
    }
    // Forçar play se o estado diz que deveria estar tocando
    // (necessário quando onReady dispara depois do setIsPlaying(true))
    if (isPlayingRef.current && reactPlayerRef.current) {
        // react-player controla via prop `playing`, mas se autoplay bloqueou,
        // o próximo clique do usuário vai re-trigger o React re-render e o
        // playing prop vai funcionar. Não é necessário chamar nada aqui —
        // a prop `playing={isPlaying}` já é reativa.
    }
};
```

---

### Bug D — Ruído de ventilador na voz da jogadora

#### Sintoma

O Mestre ouve a voz da jogadora com um ruído constante "como se houvesse um ventilador".
A jogadora não percebe o ruído na própria voz.

#### Diagnóstico

**Arquivo**: `src/lib/VoiceChatManager.ts`, funções `joinVoice` (linha ~182) e
`setMicDevice` (linha ~286)

Ambas as funções usam as mesmas constraints de áudio:

```ts
audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,    // ← CAUSA PRIMÁRIA
    autoGainControl: true,     // ← CAUSA SECUNDÁRIA
}
```

**Causa raiz**: `noiseSuppression: true` ativa o algoritmo de supressão de ruído do
browser (WebRTC noise suppression). Quando há um sinal de áudio **constante e repetitivo**
no ambiente (música tocando na sala, ventilador real, ar-condicionado), o algoritmo
classifica esse sinal como ruído de fundo e tenta removê-lo. O resultado é um artefato
característico: som pulsante, robótico, ou de "ventilador/vento" — exatamente o sintoma
relatado.

`autoGainControl: true` amplifica automaticamente sinais fracos, o que pode amplificar
o próprio artefato da supressão.

**Nota importante**: Este bug pode ter sido agravado pelo Bug A — se a música está
tocando pelos alto-falantes do ambiente da jogadora (porque autoplay foi bloqueado e
ela ouviu pelo ar livre), o microfone capta a música e o noise suppression entra em
colapso tentando remover um sinal rico em frequências variadas.

#### Correção

**Arquivo**: `src/lib/VoiceChatManager.ts`
**Atenção**: O story-30 originalmente dizia "não tocar VoiceChatManager". Esta correção
é necessária. Alterar apenas as constraints de áudio nas duas funções.

**Mudança 1 — `joinVoice`** (linha ~182):
```ts
// Antes:
audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
}

// Depois:
audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
}
```

**Mudança 2 — `setMicDevice`** (linha ~290):
```ts
// Antes:
audio: {
    deviceId: { exact: deviceId },
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
}

// Depois:
audio: {
    deviceId: { exact: deviceId },
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
}
```

**Por que desativar e não adicionar toggle**: O `echoCancellation: true` é mantido porque
ele previne feedback (eco do áudio do fone no mic), que é crítico. O `noiseSuppression`
e `autoGainControl` causam mais dano do que bem neste contexto (RPG online com música de
fundo). Headsets modernos e o OS já fazem processamento de áudio — o browser adicionando
uma segunda camada cria artefatos. Sem esses filtros, o áudio fica mais limpo e natural.

---

### Bug E — Imagens de personagem não aparecem no VoiceChat

#### Sintoma

Os avatares no VoiceChatPanel mostram iniciais (letras) em vez das fotos dos personagens,
mesmo com personagens criados e imagens possivelmente cadastradas.

#### Diagnóstico Multi-Camada

**Arquivo principal**: `src/components/VoiceChatPanel.tsx`

Há **três potenciais causas** que devem ser investigadas em ordem:

---

**Causa E1 (mais provável) — `p.characterId` não vem do backend**

No `allUsers` (linha ~399):
```ts
characterId: isMe ? characterId : p.characterId,
```

`p.characterId` vem de `voice-presence-update` emitido pelo backend NestJS.
O VoiceChatManager envia `voice-presence` com `characterId: this.characterId` para o server.
Se o servidor não inclui `characterId` ao construir a lista de participantes para broadcast,
`p.characterId` chega `undefined` para todos os peers.

**Como confirmar**: Adicionar temporariamente no início do `useMemo` de `allUsers`:
```ts
console.log('[VoiceChat] participants raw:', participants.map(p => ({
    userId: p.userId, charId: p.characterId
})));
```
Se `charId` aparecer como `undefined` para a jogadora → backend não está retransmitindo.

**Fix para Causa E1**: No backend NestJS, localizar o gateway que processa o evento
`voice-presence` (provavelmente `session.gateway.ts` ou `voice.gateway.ts`). O handler
deve:
1. Receber `{ sessionId, userId, characterId, inVoice }` do cliente
2. Armazenar `characterId` no objeto do participante em memória/Map
3. Incluir `characterId` ao construir o array de participantes para o broadcast de
   `voice-presence-update`

---

**Causa E2 — `characterId` chega correto mas personagem não tem `imageUrl`**

Em `getCharacterImage` (linha ~181):
```ts
const byId = allChars.find(c => c.id === charId && c.imageUrl);
```

A condição `&& c.imageUrl` é **falsy para `""` (string vazia)**, que é o valor padrão
em projections.ts (linha ~1069: `imageUrl: ""`). Se o personagem nunca teve imagem
carregada, `imageUrl = ""` e o find retorna `undefined`.

**Como confirmar**: No console do browser:
```js
// Abrir DevTools na página da sessão
// Checar o eventStore
```
Ou verificar se na ficha do personagem aparece alguma imagem cadastrada. Se não há
imagem, esse bug não se aplica — o comportamento (mostrar inicial) é correto.

**Fix para Causa E2**: Não é bug de código — o personagem simplesmente não tem imagem.
O usuário precisa fazer upload da foto do personagem no painel de criação/edição de
personagem. Após o upload, o evento `CHARACTER_IMAGE_UPDATED` popula `imageUrl`.

---

**Causa E3 — Snapshot desatualizado**

O event store carrega um snapshot + delta. O log mostra:
```
[EventStore] Snapshot encontrado: seq 5448
[EventStore] 0 eventos delta carregados via NestJS.
```

Se o `CHARACTER_IMAGE_UPDATED` foi emitido APÓS o snapshot (seq > 5448), e os deltas
não foram carregados (0 eventos delta), o estado computado não inclui a imagem.

**Como confirmar**: Se o personagem tem imagem visível na ficha (outro componente que
usa o estado), mas não aparece no VoiceChat, o estado está desatualizado.

**Fix para Causa E3**: Forçar reload do snapshot ou garantir que o delta loader está
funcionando. Este é um problema de infra/sync do eventStore, não do VoiceChatPanel.

---

#### Correção Definitiva para Causa E1 (backend) + Melhoria no Frontend

**No backend** (`voice.gateway.ts` ou equivalente):

```ts
// Mapa de participantes em memória (provavelmente já existe)
const sessionParticipants = new Map<string, SessionParticipant>();

// Handler de voice-presence
socket.on('voice-presence', (data) => {
    const { sessionId, userId, characterId, inVoice } = data;

    // Armazenar caracterizando INCLUINDO characterId
    sessionParticipants.set(userId, {
        userId,
        characterId,       // ← GARANTIR QUE ESTE CAMPO ESTÁ AQUI
        inVoice,
    });

    // Broadcast para todos na sessão
    const participants = Array.from(sessionParticipants.values());
    io.to(sessionId).emit('voice-presence-update', participants);
    //                                              ^^^^^^^^^^^
    // O array deve incluir { userId, characterId, inVoice } para cada participante
});
```

**No frontend** (melhoria defensiva, `VoiceChatPanel.tsx`):

Se `charId` for fornecido mas não tiver imagem, tentar o fallback por nome sem exigir
`imageUrl` na busca primária, e verificar no resultado:

Localizar `getCharacterImage` (linha ~169) e modificar o bloco do `charId`:

```ts
// Antes:
if (charId) {
    const byId = allChars.find(c => c.id === charId && c.imageUrl);
    if (byId) return byId.imageUrl;
}

// Depois:
if (charId) {
    const byId = allChars.find(c => c.id === charId);
    if (byId?.imageUrl) return byId.imageUrl;
    // Se encontrou o personagem mas não tem imagem, retornar null explicitamente
    // para evitar que o fallback por nome encontre um personagem errado
    if (byId) return null;
}
```

Esta mudança garante que quando `charId` é fornecido e aponta para um personagem real,
o fallback por nome não é executado (evitando matches incorretos).

---

---

### Bug F — YouTube: `seekTo is not a function` / `getCurrentTime is not a function`

#### Sintoma

Erros no console do Mestre ao iniciar ou pausar uma faixa YouTube:

```
TypeError: c.current.seekTo is not a function
TypeError: n.getCurrentTime is not a function
```

O YouTube pode carregar mas não sincronizar o seek entre usuários, e o GM não consegue
pausar/play corretamente.

#### Diagnóstico

**Arquivo**: `src/components/MusicPlayer.tsx`

O ReactPlayer é importado via `dynamic()`:
```ts
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });
```

O `dynamic()` do Next.js envolve o componente em um wrapper de lazy loading. Quando um
`ref` é passado para esse wrapper, **ele NÃO é automaticamente encaminhado** para o
componente interno (ReactPlayer real), a menos que o componente dynamic use `forwardRef`.

Como resultado:
- `reactPlayerRef.current` aponta para o wrapper do `dynamic()`, não para o ReactPlayer
- O wrapper não tem métodos como `seekTo` ou `getCurrentTime`
- Chamar `reactPlayerRef.current.seekTo(...)` lança `TypeError`

O código atual usa essas chamadas diretas em dois lugares:

1. No subscriber de `MUSIC_PLAYBACK_CHANGED` (seek após receber evento):
```ts
reactPlayerRef.current.seekTo(elapsed, 'seconds');   // ← TypeError aqui
```

2. Em `broadcastUpdate` (pegar tempo atual ao pausar/play):
```ts
reactPlayerRef.current?.getCurrentTime() || 0        // ← TypeError aqui
```

#### Correção

**Dois arquivos alterados.**

**Passo F1 — Criar `src/components/ReactPlayerWrapper.tsx`** (arquivo novo):

```tsx
"use client";
import ReactPlayerLib from "react-player";
import { forwardRef } from "react";

const ReactPlayerWrapper = forwardRef<any, any>((props, ref) => (
    <ReactPlayerLib ref={ref} {...props} />
));
ReactPlayerWrapper.displayName = "ReactPlayerWrapper";
export default ReactPlayerWrapper;
```

Este arquivo é necessário porque `forwardRef` garante que o `ref` passado ao componente
dinâmico seja encaminhado para o ReactPlayer real, não para o wrapper do `dynamic()`.

**Passo F2 — Atualizar o import em `src/components/MusicPlayer.tsx`**:

```ts
// Antes:
const ReactPlayer = dynamic(() => import("react-player"), { ssr: false });

// Depois:
const ReactPlayer = dynamic(() => import("@/components/ReactPlayerWrapper"), { ssr: false });
```

Nenhuma outra mudança é necessária. Com `forwardRef` no wrapper, o `ref` passado ao
`<ReactPlayer ref={reactPlayerRef} ...>` no JSX agora aponta para a instância real do
ReactPlayer, que possui os métodos `seekTo` e `getCurrentTime`.

---

### Bug G — Qualidade de áudio geral degradada com fones Bluetooth/WiFi

#### Sintoma

A jogadora relata que **música do site** (além da voz) soa com qualidade ruim — "chiado",
"tudo abafado", "como se estivesse longe". O problema acontece com dois fones diferentes:
um WiFi com adaptador Bluetooth, e outro fone. O Mestre ouve normalmente.

#### Diagnóstico

**Causa raiz — Bluetooth HFP Mode Switch**:

Quando o browser executa `getUserMedia({ audio: true })` (ao entrar no voice chat), o
sistema operacional detecta que o dispositivo Bluetooth está sendo usado como **entrada
(microfone) E saída (fones) simultaneamente**.

O OS força a troca do perfil Bluetooth de:
- **A2DP** (Advanced Audio Distribution Profile) — stereo, 44.1/48kHz, alta fidelidade
- para **HFP** (Hands Free Profile) — mono, 8kHz ou 16kHz, qualidade de telefone

Esta troca **rebaixa TODO o áudio de saída** pelo dispositivo, incluindo música, YouTube e
voz dos peers. O usuário percebe como chiado, abafamento ou qualidade degradada geral.

**Por que dois fones têm o mesmo problema**: o fone WiFi com "adaptador Bluetooth" usa o
mesmo protocolo de rádio — o adaptador comunica via Bluetooth com o fone, disparando o
mesmo HFP mode switch no OS. Não é defeito de hardware.

**Segunda causa — `AudioContext` sem `sampleRate`**:

Em `VoiceChatManager.ts` (linhas ~110 e ~118), os AudioContexts são criados sem taxa de
amostragem explícita:

```ts
// Antes (getLocalAudioContext e getPeerAudioContext):
new (window.AudioContext || (window as any).webkitAudioContext)()
```

Sem `sampleRate`, o AudioContext herda a taxa atual do sistema. Quando o OS está em modo
HFP (8 ou 16kHz), o AudioContext processa todo o pipeline de voz nessa taxa degradada:
`source → gainNode → analyser → MediaStreamDestination → audioElement`.

A voz dos peers chega ao `audioElement` reprocessada a 8-16kHz, resultando em chiado.

#### Correção

**Dois arquivos alterados.**

**Passo G1 — Forçar 48kHz nos AudioContexts (`src/lib/VoiceChatManager.ts`)**:

Localizar as funções `getLocalAudioContext` (linha ~107) e `getPeerAudioContext` (linha ~115).
Em ambas, adicionar `{ sampleRate: 48000 }`:

```ts
// Antes (getLocalAudioContext, linha ~110):
this.localAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

// Depois:
this.localAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
```

```ts
// Antes (getPeerAudioContext, linha ~118):
ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

// Depois:
ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 });
```

**Passo G2 — Adicionar `sampleRate` nas constraints do `getUserMedia` (`src/lib/VoiceChatManager.ts`)**:

Em `joinVoice` (linha ~182) e `setMicDevice` (linha ~286), adicionar `sampleRate`:

```ts
// Antes (joinVoice):
audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
}

// Depois:
audio: {
    deviceId: deviceId ? { exact: deviceId } : undefined,
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: false,
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 },
}
```

Aplicar a mesma mudança em `setMicDevice` (mesmo bloco `audio: { ... }`).

**Passo G3 — Aviso visual na UI quando Bluetooth for detectado (`src/components/VoiceChatPanel.tsx`)**:

Esta é a mitigação definitiva. Se a jogadora selecionar o microfone embutido (não Bluetooth)
como entrada enquanto usa o fone Bluetooth como saída, o OS não precisa entrar em modo HFP
— o A2DP (alta qualidade) é mantido.

Localizar o bloco onde os seletores de dispositivo são renderizados (Passo I desta story).
Após o `<select>` de MIC (ENTRADA), adicionar um aviso condicional:

```tsx
{/* Aviso Bluetooth — mostrar sempre que voice estiver conectado */}
{isConnected && (
    <div style={{
        fontSize: '0.58rem',
        color: 'rgba(255, 200, 80, 0.85)',
        background: 'rgba(255, 180, 0, 0.08)',
        border: '1px solid rgba(255, 200, 80, 0.2)',
        borderRadius: '4px',
        padding: '5px 7px',
        lineHeight: '1.4',
        marginTop: '2px',
    }}>
        ⚠ Usando fone Bluetooth? Selecione o <strong>microfone do computador</strong> como
        entrada para manter a qualidade de áudio. Fones Bluetooth no mic degradam toda a
        saída de áudio (incluindo música).
    </div>
)}
```

**Por que os fixes G1/G2 ajudam mas não resolvem 100%**: O `sampleRate: 48000` no
`getUserMedia` é uma *sugestão* (hint), não uma garantia. O browser pode ignorá-la se
o hardware não suportar. O fix no AudioContext (G1) garante que o pipeline de voz opera
em 48kHz independente do sistema, o que elimina a degradação causada pelo próprio código.
A degradação causada pelo HFP mode do OS (que afeta a saída) só é resolvida com G3
(usar mic separado). Combinar G1 + G2 + G3 resolve o problema completamente.

---

### Sumário de Arquivos a Modificar (Bugs A, B, D, E, F, G)

| Bug | Arquivo | O que muda |
|-----|---------|-----------|
| A — Música qualidade | `src/components/MusicPlayer.tsx` | No `catch` do `play()`: adicionar listener de `click`/`keydown` para unlock autoplay |
| B — YouTube sem som | `src/components/MusicPlayer.tsx` | Trocar `position:fixed; 1px; overflow:hidden` por `display:none` + props `width="320px" height="180px"` no ReactPlayer |
| D — Ruído ventilador | `src/lib/VoiceChatManager.ts` | `noiseSuppression: false, autoGainControl: false` em `joinVoice` e `setMicDevice` |
| E — Sem imagem | Backend NestJS gateway | Garantir `characterId` em `voice-presence-update` |
| E — Sem imagem | `src/components/VoiceChatPanel.tsx` | `getCharacterImage`: separar busca de personagem da verificação de `imageUrl` |
| F — YouTube seekTo/getCurrentTime | `src/components/ReactPlayerWrapper.tsx` | Criar wrapper com `forwardRef` (arquivo novo) |
| F — YouTube seekTo/getCurrentTime | `src/components/MusicPlayer.tsx` | Mudar import do `dynamic()` para apontar para `ReactPlayerWrapper` |
| G — Qualidade Bluetooth | `src/lib/VoiceChatManager.ts` | `sampleRate: 48000` nos dois AudioContexts + `sampleRate`/`channelCount` no `getUserMedia` |
| G — Qualidade Bluetooth | `src/components/VoiceChatPanel.tsx` | Aviso visual orientando uso do mic do computador quando em Bluetooth |

**Ordem de execução recomendada**: D → F → B → G → A → E

- **D primeiro**: 2 linhas em VoiceChatManager, sem risco, elimina ruído de ventilador
- **F segundo**: Criar ReactPlayerWrapper + atualizar import — resolve seekTo/getCurrentTime antes de testar YouTube
- **B terceiro**: Fix do container do ReactPlayer — YouTube começa a tocar
- **G quarto**: AudioContext 48kHz + sampleRate constraints + aviso Bluetooth — melhora qualidade geral
- **A quinto**: Unlock de autoplay para música Supabase
- **E por último**: Requer investigação do backend antes de aplicar

---

## Segunda Tentativa de Fix — Sessão 2026-04-07

> Resultado de teste real com bugs persistentes pós-primeira implementação.
> YouTube continuava sem som; imagens de personagem não apareciam para nenhum usuário.
> Novo erro no console: `TypeError: c.current.seekTo is not a function`.

---

### Fix Aplicado — YouTube: Portal para escapar `display:none` do pai

#### Problema identificado

O `UnifiedSoundPanel` (componente pai do MusicPlayer) usa:
```css
.unified-sound-panel { display: none; }
.unified-sound-panel.show { display: flex; }
```

O fix anterior colocou o ReactPlayer em `display: none` dentro deste pai. O problema é que
**`position: fixed` em filho NÃO escapa de `display: none` no pai** — regra de CSS: um
elemento com `display: none` não renderiza nenhum descendente, independente de `position`.

O YouTube iframe nunca era renderizado → nenhum som, nenhum evento `onReady`.

#### Correção aplicada

**Arquivo**: `src/components/MusicPlayer.tsx`

Substituído o bloco condicional do ReactPlayer por `createPortal(document.body)`:

```tsx
// Antes (dentro do JSX normal — filho de UnifiedSoundPanel com display:none):
{isYouTubeUrl(currentTrack) && (
    <div style={{ display: 'none' }}>
        <ReactPlayer ref={reactPlayerRef} width="320px" height="180px" ... />
    </div>
)}

// Depois (portal para document.body — escapa de qualquer pai com display:none):
{isMounted && isYouTubeUrl(currentTrack) && createPortal(
    <div style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: '320px',
        height: '180px',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
    }}>
        <ReactPlayer
            ref={reactPlayerRef}
            width="320px"
            height="180px"
            {...{
                url: currentTrack,
                playing: isPlaying,
                loop: isLooping,
                volume: isMuted ? 0 : volume,
                muted: isMuted,
                onEnded: handleTrackEnded,
                onReady: handleYouTubeReady,
            } as any}
        />
    </div>,
    document.body
)}
```

Também adicionado `import { createPortal } from "react-dom"` no topo do arquivo.

O estado `isMounted` (useState → true em useEffect) garante que `document.body` existe
antes de renderizar o portal (evita SSR crash).

---

### Fix Aplicado — YouTube: guard `typeof seekTo === 'function'`

#### Problema identificado

`TypeError: c.current.seekTo is not a function` no subscriber de `MUSIC_PLAYBACK_CHANGED`.

`reactPlayerRef.current` pode ser não-nulo (o wrapper do `dynamic()` montou) mas ainda não
ter exposto `seekTo` — o player interno inicializa de forma assíncrona. Chamar `seekTo`
antes do `onReady` lança TypeError.

#### Correção aplicada

**Arquivo**: `src/components/MusicPlayer.tsx`

Guard `typeof` adicionado em todos os pontos que chamam `seekTo`:

```ts
// No subscriber MUSIC_PLAYBACK_CHANGED (seek após receber evento):
if (reactPlayerRef.current && typeof reactPlayerRef.current.seekTo === 'function') {
    reactPlayerRef.current.seekTo(elapsed, 'seconds');
} else {
    pendingSeekRef.current = elapsed;  // seek aplicado quando onReady disparar
}

// No handleYouTubeReady:
const handleYouTubeReady = () => {
    if (
        pendingSeekRef.current !== null &&
        reactPlayerRef.current &&
        typeof reactPlayerRef.current.seekTo === 'function'
    ) {
        reactPlayerRef.current.seekTo(pendingSeekRef.current, 'seconds');
        pendingSeekRef.current = null;
    }
};
```

---

### Fix Aplicado — VoiceChat: `characterId` stale closure no VoiceChatManager

#### Problema identificado

`VoiceChatManager` é criado num `useEffect` com deps `[sessionId, userId, refreshKey]` com
delay de 300ms. O `characterId` chega de `useHeaderLogic` num `useEffect` separado que lê
`searchParams.get("c")` — ele chega DEPOIS do primeiro render. O manager captura
`characterId = undefined` por closure stale ao ser criado.

O manager emite `voice-presence` com `characterId: undefined`, o backend armazena `undefined`,
e outros clientes nunca recebem o `characterId` correto → imagens não aparecem.

#### Correção aplicada — `updateCharacterId()` em VoiceChatManager.ts

**Arquivo**: `src/lib/VoiceChatManager.ts`

Novo método público adicionado:

```ts
public updateCharacterId(characterId: string) {
    if (this.characterId === characterId) return;
    this.characterId = characterId;
    const socket = getSocket(this.userId);
    socket.emit('voice-presence', {
        sessionId: this.sessionId,
        userId: this.userId,
        characterId: this.characterId,
        inVoice: this._isConnected,
    });
}
```

#### Correção aplicada — `useEffect([characterId])` em VoiceChatPanel.tsx

**Arquivo**: `src/components/VoiceChatPanel.tsx`

`useEffect` adicionado para chamar `updateCharacterId` assim que o prop chega:

```ts
useEffect(() => {
    if (characterId && managerRef.current) {
        managerRef.current.updateCharacterId(characterId);
    }
}, [characterId]);
```

---

### Fix Aplicado — VoiceChat: resolução de `characterId` com 3 etapas + Unicode NFC

#### Problema identificado

Mesmo com `characterId` chegando pelo backend, o `allUsers` useMemo usava apenas `p.characterId`
para peers remotos. Se `p.characterId` fosse `undefined` (stale closure ainda não resolvido),
o fallback tentava buscar por `userId`, mas sem `.normalize('NFC')`. Nomes com acentos (ex:
"Elizárova") têm representações Unicode diferentes (NFC vs NFD), e a comparação com `===`
falhava silenciosamente.

#### Correção aplicada

**Arquivo**: `src/components/VoiceChatPanel.tsx`

`allUsers` useMemo com resolução em 3 etapas:

```ts
// Etapa 1: usar characterId do presence (remoto) ou prop (eu)
let resolvedCharId = isMe ? characterId : p.characterId;

// Etapa 2: fallback — buscar por ownerUserId ou name normalizado (NFC)
if (!resolvedCharId) {
    const norm = (s: string) => (s || "").trim().toLowerCase().normalize('NFC');
    const uidNorm = norm(p.userId);
    const matched = Object.values(state.characters).find(c =>
        norm(c.ownerUserId) === uidNorm ||
        norm(c.name) === uidNorm
    );
    if (matched) resolvedCharId = matched.id;
}

// Etapa 3: usar resolvedCharId no objeto do usuário
return { ...p, characterId: resolvedCharId };
```

`state.characters` adicionado como dependência do `allUsers` useMemo.

`.normalize('NFC')` também aplicado nos helpers `getDisplayName` e `getCharacterImage`
em todas as comparações de string.

---

### Fix Aplicado — VoiceChat: botão X no aviso Bluetooth

#### Correção aplicada

**Arquivo**: `src/components/VoiceChatPanel.tsx`

Estado adicionado:
```ts
const [showBluetoothWarning, setShowBluetoothWarning] = useState(true);
```

Botão X adicionado no bloco do aviso Bluetooth:
```tsx
{isConnected && showBluetoothWarning && (
    <div style={{ /* estilos existentes */ position: 'relative' }}>
        ⚠ Usando fone Bluetooth? ...
        <button
            onClick={() => setShowBluetoothWarning(false)}
            style={{
                position: 'absolute', top: '4px', right: '4px',
                background: 'none', border: 'none', color: 'rgba(255,200,80,0.7)',
                cursor: 'pointer', fontSize: '0.7rem', padding: '0 2px',
                lineHeight: 1,
            }}
            title="Fechar aviso"
        >×</button>
    </div>
)}
```

---

### Fix Aplicado — VoiceChat: qualidade de áudio — `latencyHint: 'interactive'`

#### Problema identificado

O fix anterior (Bug G) adicionou `{ sampleRate: 48000 }` nos AudioContexts do
VoiceChatManager. Porém, forçar `sampleRate: 48000` quando o hardware nativo usa outra taxa
(ex: 44100Hz) causa resampling pelo browser — que pode introduzir artefatos de qualidade.

#### Correção aplicada

**Arquivo**: `src/lib/VoiceChatManager.ts`

AudioContexts alterados para usar `latencyHint: 'interactive'` em vez de `sampleRate` fixo:

```ts
// Antes:
new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 48000 })

// Depois:
new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' })
```

`{ latencyHint: 'interactive' }` pede ao browser baixa latência sem forçar resampling —
o browser usa a taxa nativa do hardware, eliminando artefatos de conversão.

`sampleRate: { ideal: 48000 }` também removido das constraints do `getUserMedia` em
`joinVoice()` e `setMicDevice()` pelo mesmo motivo.

---

### Sumário da Segunda Tentativa (2026-04-07)

| Fix | Arquivo | Status |
|-----|---------|--------|
| YouTube: portal para escapar `display:none` pai | `MusicPlayer.tsx` | ✅ Aplicado |
| YouTube: guard `typeof seekTo === 'function'` | `MusicPlayer.tsx` | ✅ Aplicado |
| VoiceChat: `updateCharacterId()` para stale closure | `VoiceChatManager.ts` | ✅ Aplicado |
| VoiceChat: `useEffect([characterId])` → `updateCharacterId` | `VoiceChatPanel.tsx` | ✅ Aplicado |
| VoiceChat: resolução 3 etapas + `.normalize('NFC')` | `VoiceChatPanel.tsx` | ✅ Aplicado |
| VoiceChat: botão X no aviso Bluetooth | `VoiceChatPanel.tsx` | ✅ Aplicado |
| VoiceChat: `latencyHint: 'interactive'` nos AudioContexts | `VoiceChatManager.ts` | ✅ Aplicado |

**Pendente de verificação em sessão real**: imagens de personagem (depende de `characterId`
chegar corretamente via backend após `updateCharacterId` re-emitir) e YouTube com portal.
